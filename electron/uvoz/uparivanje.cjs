// Uparuje red iz prijave sa takmičarima iz baze po imenu i prezimenu (bez kvačica i velikih slova,
// i sa zamenjenim redosledom), pa po godini rođenja. Čiste funkcije, bez baze.
const { normalizuj } = require('./tumac-prijave.cjs');

const NOVI = 'novi'; // nema ga u bazi: upisuje se kao novi takmičar
const POSTOJI = 'postoji'; // isto ime, prezime i godina: verovatno isti takmičar
const SLICAN = 'slican'; // isto ime i prezime, druga godina: verovatno drugi
const PRIJAVLJEN = 'prijavljen'; // već prijavljen na ovo takmičenje
const GRESKA = 'greska'; // red se ne može uvesti

const OPSTE_RECI = ['gd', 'g d', 'sd', 'gk', 'sgk', 'kg', 'ugk', 'gimnasticki', 'gimnasticko', 'sportsko', 'sportski', 'drustvo', 'klub', 'za', 'gimnastiku'];

// Naziv kluba bez skraćenica vrste društva i opštih reči.
function jezgroKluba(n) {
  let s = ' ' + n + ' ';
  for (const r of OPSTE_RECI) s = s.replaceAll(' ' + r + ' ', ' ');
  return s.replace(/\s+/g, ' ').trim();
}

// Klub iz zaglavlja prijave među klubovima (id, puno_ime, skracenica): po skraćenici ili po jezgru naziva.
function nadjiKlub(tekst, klubovi) {
  const n = normalizuj(tekst);
  if (n === '') return null;
  const jezgro = jezgroKluba(n);
  for (const k of klubovi) {
    if (normalizuj(String(k.skracenica)) === n) return Number(k.id);
  }
  let delimicno = null;
  for (const k of klubovi) {
    const jk = jezgroKluba(normalizuj(String(k.puno_ime)));
    if (jk === '' || jezgro === '') continue;
    if (jk === jezgro) return Number(k.id);
    if (delimicno === null && (jk.includes(jezgro) || jezgro.includes(jk))) delimicno = Number(k.id);
  }
  return delimicno;
}

const RIMSKI = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

// Normalizovani oblici naziva: bez reči kategorija/program, rimski i arapski broj.
function oblici(naziv) {
  const n = normalizuj(naziv).replace(/\b(kategorija|kategorije|kat|program|programi|prog)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (n === '') return [];
  const lista = [n];
  if (Object.hasOwn(RIMSKI, n)) {
    lista.push(String(RIMSKI[n]));
  } else if (/^\d+$/.test(n)) {
    const r = Object.keys(RIMSKI).find((kljuc) => RIMSKI[kljuc] === Number(n));
    if (r !== undefined) lista.push(r);
  }
  return lista;
}

// Kategorija ili program (id, naziv) po oznaci iz fajla: "I" nalazi "I", "I kategorija", "1. kategorija".
function nadjiStavku(oznaka, stavke) {
  if (oznaka === null || oznaka === undefined || String(oznaka).trim() === '') return null;
  const trazeni = oblici(oznaka);
  for (const s of stavke) {
    const njeni = oblici(String(s.naziv));
    if (trazeni.some((o) => njeni.includes(o))) return Number(s.id);
  }
  return null;
}

// Ključ za poređenje imena: "prezime|ime" normalizovano.
function kljuc(prezime, ime) {
  return normalizuj(prezime) + '|' + normalizuj(ime);
}

// Kandidati za red među takmičarima (id, ime, prezime, godina_rodjenja, pol): najbolji prvi.
// Težina: ista godina 2, isti pol 1 (nepoznat pol ili godina se računaju kao isti).
function kandidati(r, takmicari, pol) {
  const k1 = kljuc(String(r.prezime), String(r.ime));
  const k2 = kljuc(String(r.ime), String(r.prezime));
  const nadjeni = [];
  for (const t of takmicari) {
    const kt = kljuc(String(t.prezime), String(t.ime));
    if (kt !== k1 && kt !== k2) continue;
    const istaGodina = r.godina === null || r.godina === undefined || Number(t.godina_rodjenja) === Number(r.godina);
    const istiPol = pol === null || pol === undefined || t.pol === pol;
    nadjeni.push({ ...t, tezina: (istaGodina ? 2 : 0) + (istiPol ? 1 : 0) });
  }
  return nadjeni.sort((a, b) => b.tezina - a.tezina);
}

// Status reda i predlog. postupak: 'postojeci' (prijavi postojećeg), 'novi' (upiši novog), 'nista'.
function oceni(r, takmicari, prijavljeni, pol) {
  if (r.greske.length > 0) {
    return { status: GRESKA, takmicar_id: null, postupak: 'nista', napomena: r.greske.join('; ') };
  }
  const lista = kandidati(r, takmicari, pol);
  const bezGodine = r.godina === null || r.godina === undefined;
  if (lista.length === 0) {
    if (bezGodine) {
      return { status: GRESKA, takmicar_id: null, postupak: 'nista', napomena: 'nema godine rođenja, a takmičara nema u bazi' };
    }
    return { status: NOVI, takmicar_id: null, postupak: 'novi', napomena: '' };
  }
  const najbolji = lista[0];
  const id = Number(najbolji.id);
  const opis = `${najbolji.prezime} ${najbolji.ime} (${Number(najbolji.godina_rodjenja)}, ${najbolji.klub_skr ?? 'bez kluba'})`;
  if (prijavljeni.some((p) => Number(p) === id)) {
    return { status: PRIJAVLJEN, takmicar_id: id, postupak: 'nista', napomena: 'već prijavljen: ' + opis };
  }
  if (bezGodine || Number(najbolji.godina_rodjenja) === Number(r.godina)) {
    return { status: POSTOJI, takmicar_id: id, postupak: 'postojeci', napomena: 'u bazi: ' + opis };
  }
  return { status: SLICAN, takmicar_id: id, postupak: 'novi', napomena: 'u bazi je ' + opis + ', godina se razlikuje' };
}

module.exports = { NOVI, POSTOJI, SLICAN, PRIJAVLJEN, GRESKA, kljuc, kandidati, oceni, nadjiKlub, nadjiStavku };
