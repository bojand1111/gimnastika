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
  return nadjiKlubDetaljno(tekst, klubovi).id;
}

// Isto kao nadjiKlub, uz oznaku da se poklapa samo deo naziva (jedno jezgro sadrži drugo).
function nadjiKlubDetaljno(tekst, klubovi) {
  const n = normalizuj(tekst);
  if (n === '') return { id: null, delimicno: false };
  const jezgro = jezgroKluba(n);
  for (const k of klubovi) {
    if (normalizuj(String(k.skracenica ?? '')) === n) return { id: Number(k.id), delimicno: false };
  }
  let delimicno = null;
  for (const k of klubovi) {
    const jk = jezgroKluba(normalizuj(String(k.puno_ime ?? '')));
    if (jk === '' || jezgro === '') continue;
    if (jk === jezgro) return { id: Number(k.id), delimicno: false };
    if (delimicno === null && (jk.includes(jezgro) || jezgro.includes(jk))) delimicno = Number(k.id);
  }
  return { id: delimicno, delimicno: delimicno !== null };
}

const NAVODNICI = '"„“”«»';
const RE_NAVODI = new RegExp(`\\s*[${NAVODNICI}]\\s*([^${NAVODNICI}]+?)\\s*[${NAVODNICI}]\\s*`, 'gu');
const OPSTE_SKR = [...OPSTE_RECI, 'sgu', 'su'];
const velika = (s) => s.toLocaleUpperCase('sr-Latn');

// Puno ime novog kluba iz teksta fajla: navodi kao „…“ sa razmakom spolja, jedan razmak.
// 'GK"Topličanin"Prokuplje' => 'GK „Topličanin“ Prokuplje'.
function nazivKluba(tekst) {
  return String(tekst ?? '').normalize('NFC').replace(RE_NAVODI, ' „$1“ ').replace(/\s+/g, ' ').trim();
}

// Predlozi skraćenice (2 do 4 slova, velika) za novi klub, najbolji prvi. Osnova je naziv pod
// navodnicima ('SD „Vojvodina“ Novi Sad' => VOJ), inače naziv bez opštih reči (GK, SD, klub...).
// Jedna reč: kratka reč velikim slovima ostaje (AKRO), inače prva tri slova; više reči: prva slova.
function skraceniceKluba(naziv) {
  const tekst = String(naziv ?? '').normalize('NFC');
  const reci = (s) => (s.match(/\p{L}+/gu) || []).filter((r) => Array.from(r).length > 1 && !OPSTE_SKR.includes(normalizuj(r)));
  const navod = new RegExp(`[${NAVODNICI}]([^${NAVODNICI}]+)[${NAVODNICI}]`, 'u').exec(tekst);
  let osnova = navod ? reci(navod[1]) : [];
  if (osnova.length === 0) osnova = reci(tekst);
  if (osnova.length === 0) osnova = ['Klub'];
  const sve = reci(tekst);
  const prva = Array.from(osnova[0]);
  const slova = Array.from(osnova.join(''));
  const pocetna = (lista) => lista.map((r) => Array.from(r)[0]).slice(0, 4).join('');
  const predlozi = [];
  if (osnova.length === 1) {
    if (prva.length <= 4 && osnova[0] === velika(osnova[0])) predlozi.push(osnova[0]);
    predlozi.push(prva.slice(0, 3).join(''));
  } else {
    predlozi.push(pocetna(osnova));
  }
  predlozi.push(pocetna(sve), prva.slice(0, 3).join(''), prva.slice(0, 4).join(''));
  if (osnova.length > 1) predlozi.push(prva.slice(0, 2).join('') + Array.from(osnova[1])[0]);
  // na kraju: prva dva ili tri slova osnove i još jedno slovo A..Z
  for (const pre of [slova.slice(0, 2).join(''), slova.slice(0, 3).join('')]) {
    for (const z of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') predlozi.push(pre + z);
  }
  const izlaz = [];
  for (const p of predlozi) {
    const v = velika(p);
    if (/^\p{L}{2,4}$/u.test(v) && !izlaz.includes(v)) izlaz.push(v);
  }
  return izlaz;
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
  const k1 = kljuc(String(r.prezime ?? ''), String(r.ime ?? ''));
  const k2 = kljuc(String(r.ime ?? ''), String(r.prezime ?? ''));
  const nadjeni = [];
  for (const t of takmicari) {
    const kt = kljuc(String(t.prezime ?? ''), String(t.ime ?? ''));
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
  const opis = `${najbolji.prezime} ${najbolji.ime} (${Number(najbolji.godina_rodjenja) || 0}, ${najbolji.klub_skr ?? 'bez kluba'})`;
  if (prijavljeni.some((p) => Number(p) === id)) {
    return { status: PRIJAVLJEN, takmicar_id: id, postupak: 'nista', napomena: 'već prijavljen: ' + opis };
  }
  if (bezGodine || Number(najbolji.godina_rodjenja) === Number(r.godina)) {
    return { status: POSTOJI, takmicar_id: id, postupak: 'postojeci', napomena: 'u bazi: ' + opis };
  }
  return { status: SLICAN, takmicar_id: id, postupak: 'novi', napomena: 'u bazi je ' + opis + ', godina se razlikuje' };
}

module.exports = { NOVI, POSTOJI, SLICAN, PRIJAVLJEN, GRESKA, kljuc, kandidati, oceni, nadjiKlub, nadjiKlubDetaljno, nadjiStavku, nazivKluba, skraceniceKluba };
