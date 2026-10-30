// Podela postojecih podataka na MSG ('M') i ZSG ('Z') deo. Radi samo nad redovima sa pol = '' (idempotentno),
// u jednoj transakciji. Pravila: docs/superpowers/specs/2026-10-30-msg-zsg-odvojeno-design.md, odeljak 6.
const { Baza } = require('./baza.cjs');

const POLOVI = ['M', 'Z'];

// Kopija reda (sve kolone osim id) sa novim polom i vremenima; vraca novi id.
function kopirajRed(baza, tabela, red, pol, sad) {
  const podaci = {};
  for (const kolona of baza.svi(`PRAGMA table_info(${tabela})`).map((c) => c.name)) {
    if (kolona !== 'id') podaci[kolona] = red[kolona];
  }
  podaci.pol = pol;
  if ('kreirano' in podaci) podaci.kreirano = sad;
  if ('izmenjeno' in podaci) podaci.izmenjeno = sad;
  return baza.ubaci(tabela, podaci);
}

// Pol takmicenja iz prijava (takmicari.pol) i grupa (grupe.pol); vise prijava odlucuje ko zadrzava stari id, izjednaceno M.
function polovi(baza, id) {
  const prijave = { M: 0, Z: 0 };
  for (const r of baza.svi(
    'SELECT t.pol AS pol, COUNT(*) AS n FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.takmicenje_id = ? GROUP BY t.pol',
    [id],
  )) {
    if (POLOVI.includes(r.pol)) prijave[r.pol] = Number(r.n);
  }
  const prisutni = new Set(POLOVI.filter((p) => prijave[p] > 0));
  for (const r of baza.svi('SELECT DISTINCT pol FROM grupe WHERE takmicenje_id = ?', [id])) {
    if (POLOVI.includes(r.pol)) prisutni.add(r.pol);
  }
  return { prijave, prisutni };
}

function podeliTakmicenja(baza, sad, rez) {
  const podeljena = new Map(); // stari id -> { pol, noviId, noviPol }
  for (const t of baza.svi("SELECT * FROM takmicenja WHERE pol = '' ORDER BY id")) {
    rez.takmicenja++;
    const { prijave, prisutni } = polovi(baza, t.id);
    if (prisutni.size === 1) {
      baza.izmeni('takmicenja', { pol: [...prisutni][0] }, 'id = ?', [t.id]);
      podeljena.set(t.id, { pol: [...prisutni][0], noviId: null, noviPol: null });
      continue;
    }
    // Oba pola ili nijedan: stari id zadrzava pol sa vise prijava (M kad je jednako ili prazno), drugi pol dobija kopiju.
    const zadrzi = prijave.Z > prijave.M ? 'Z' : 'M';
    const drugi = zadrzi === 'M' ? 'Z' : 'M';
    const noviId = kopirajRed(baza, 'takmicenja', t, drugi, sad);
    baza.izmeni('takmicenja', { pol: zadrzi }, 'id = ?', [t.id]);
    baza.izvrsi(
      'UPDATE prijave SET takmicenje_id = ? WHERE takmicenje_id = ? AND takmicar_id IN (SELECT id FROM takmicari WHERE pol = ?)',
      [noviId, t.id, drugi],
    );
    baza.izvrsi('UPDATE grupe SET takmicenje_id = ? WHERE takmicenje_id = ? AND pol = ?', [noviId, t.id, drugi]);
    baza.izvrsi(
      'INSERT INTO potvrde_klubova (takmicenje_id, klub_id, potvrdjeno) SELECT ?, klub_id, potvrdjeno FROM potvrde_klubova WHERE takmicenje_id = ?',
      [noviId, t.id],
    );
    podeljena.set(t.id, { pol: zadrzi, noviId, noviPol: drugi });
    rez.podeljena++;
  }
  return podeljena;
}

// Svaka stavka postaje dve: stara id ostaje M, nova je Z; Z prijave prelaze na novu stavku.
function podeliSifarnik(baza, tabela, kolonaPrijave, sad) {
  let n = 0;
  for (const s of baza.svi(`SELECT * FROM ${tabela} WHERE pol = '' ORDER BY id`)) {
    const noviId = kopirajRed(baza, tabela, s, 'Z', sad);
    baza.izmeni(tabela, { pol: 'M' }, 'id = ?', [s.id]);
    baza.izvrsi(
      `UPDATE prijave SET ${kolonaPrijave} = ? WHERE ${kolonaPrijave} = ? AND takmicar_id IN (SELECT id FROM takmicari WHERE pol = 'Z')`,
      [noviId, s.id],
    );
    n++;
  }
  return n;
}

function upisiPodesavanje(baza, kljuc, vrednost) {
  baza.izvrsi(
    'INSERT INTO podesavanja (kljuc, vrednost) VALUES (?, ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost',
    [kljuc, vrednost],
  );
}

// Stari kljuc aktivno_takmicenje postaje aktivno takmicenje dela (oba dela kad je podeljeno) i odmah se brise.
function prevediAktivno(baza, podeljena, obradjeno) {
  const staro = baza.jedan("SELECT vrednost FROM podesavanja WHERE kljuc = 'aktivno_takmicenje'");
  let aktivniPol = null;
  if (staro) {
    const id = Number(staro.vrednost);
    const t = Number.isInteger(id) ? baza.jedan('SELECT id, pol FROM takmicenja WHERE id = ?', [id]) : null;
    if (t && POLOVI.includes(t.pol)) {
      upisiPodesavanje(baza, `aktivno_takmicenje_${t.pol}`, String(t.id));
      const p = podeljena.get(t.id);
      if (p && p.noviId !== null) upisiPodesavanje(baza, `aktivno_takmicenje_${p.noviPol}`, String(p.noviId));
      aktivniPol = t.pol;
    }
    baza.izvrsi("DELETE FROM podesavanja WHERE kljuc = 'aktivno_takmicenje'");
  }
  // Pol dela upisuje se samo kad ga nema, i samo kad je bilo sta za prevodjenje (nova instalacija bira sama).
  if ((staro || obradjeno) && baza.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc = 'aktivni_pol'") === 0) {
    upisiPodesavanje(baza, 'aktivni_pol', aktivniPol ?? 'M');
  }
}

// Vraca broj obradjenih redova; sve nule kad nema sta da se podeli.
function podeliPolove(baza) {
  return baza.transakcija(() => {
    const sad = Baza.sad();
    const rez = { takmicenja: 0, podeljena: 0, kategorije: 0, programi: 0 };
    const podeljena = podeliTakmicenja(baza, sad, rez);
    rez.kategorije = podeliSifarnik(baza, 'kategorije', 'kategorija_id', sad);
    rez.programi = podeliSifarnik(baza, 'programi', 'program_id', sad);
    prevediAktivno(baza, podeljena, rez.takmicenja > 0);
    return rez;
  });
}

module.exports = { podeliPolove };
