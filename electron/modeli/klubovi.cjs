// Model Klubovi (SQLite). Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { poImenu, istiTekst } = require('./sortiranje.cjs');

function napravi(baza) {
  // Ociscen unos: trim, skracenica velikim slovima.
  function ocisti(p) {
    return {
      puno_ime: String(p.puno_ime ?? '').trim(),
      skracenica: String(p.skracenica ?? '').trim().toUpperCase(),
      grad: String(p.grad ?? '').trim(),
    };
  }

  function svi() {
    const redovi = baza.svi(
      `SELECT k.*, (SELECT COUNT(*) FROM takmicari t WHERE t.klub_id = k.id) AS broj_takmicara
       FROM klubovi k ORDER BY k.id`);
    return poImenu(redovi, 'puno_ime');
  }

  function nadji(id) {
    return baza.jedan('SELECT * FROM klubovi WHERE id = ?', [id]);
  }

  function proveri(p, id) {
    const o = ocisti(p);
    const g = [];
    if (o.puno_ime === '') g.push('Puno ime kluba je obavezno.');
    if (!/^\p{L}{2,4}$/u.test(o.skracenica)) {
      g.push('Skraćenica mora imati 2 do 4 slova.');
    } else if (baza.svi('SELECT id, skracenica FROM klubovi').some(k => k.id !== id && istiTekst(k.skracenica, o.skracenica))) {
      g.push(`Skraćenica "${o.skracenica}" je već zauzeta.`);
    }
    return g;
  }

  function sacuvaj(p, id) {
    const greske = proveri(p, id);
    if (greske.length) throw new GreskaKorisnika(greske.join(' '));
    const o = ocisti(p);
    const sad = Baza.sad();
    o.izmenjeno = sad;
    try {
      if (id === null || id === undefined) {
        o.kreirano = sad;
        return baza.ubaci('klubovi', o);
      }
      baza.izmeni('klubovi', o, 'id = ?', [id]);
      return id;
    } catch (e) {
      // Druga garancija jedinstvenosti: SQL indeks.
      if (/UNIQUE/.test(String(e && e.message))) {
        throw new GreskaKorisnika(`Skraćenica "${o.skracenica}" je već zauzeta.`);
      }
      throw e;
    }
  }

  function obrisi(id) {
    let n = Number(baza.vrednost('SELECT COUNT(*) FROM takmicari WHERE klub_id = ?', [id]));
    if (n > 0) {
      throw new GreskaKorisnika(`Klub ima ${n} takmičara u bazi i ne može se obrisati. Prvo premestite ili obrišite takmičare.`);
    }
    n = Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE klub_id = ?', [id]));
    if (n > 0) {
      throw new GreskaKorisnika(`Klub ima ${n} prijava na takmičenjima i ne može se obrisati.`);
    }
    baza.izvrsi('DELETE FROM klubovi WHERE id = ?', [id]);
  }

  return { svi, nadji, proveri, sacuvaj, obrisi };
}

module.exports = { napravi };
