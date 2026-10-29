// Čita listove iz Excel .xlsx fajla (zip sa xl/workbook.xml). Svaki list je jedna tabela;
// ćelije sa formatom datuma se vraćaju kao dd.mm.gggg.
const zip = require('./zip.cjs');
const xml = require('./xml.cjs');

const DATUMSKI_UGRADJENI = [14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58];
const NAJVISE_REDOVA = 1048576;
const NAJVISE_KOLONA = 16384;
const NAJVISE_CELIJA = 2_000_000; // ukupno u svim listovima, sa popunjenim praznim (prazan red je jedna)
const GRESKA_XML = 'Excel fajl je oštećen (XML nije ispravan).';

function ucitaj(putanja, lista, ime) {
  const stablo = xml.razberi(zip.procitaj(putanja, ime, lista));
  if (stablo === null) throw new Error(GRESKA_XML);
  return stablo;
}

// Svi elementi sa datim lokalnim imenom (bez prefiksa) u celom stablu.
function svi(stablo, naziv) {
  const izlaz = [];
  for (const n of stablo) {
    if (xml.ime(n) === null) continue;
    if (xml.lokalno(xml.ime(n)) === naziv) izlaz.push(n);
    for (const x of svi(xml.deca(n), naziv)) izlaz.push(x);
  }
  return izlaz;
}

function atr(cvor, naziv) {
  return xml.atribut(cvor, naziv);
}

function spojiT(cvor) {
  return svi(xml.deca(cvor), 't').map((t) => xml.tekstElementa(t)).join('');
}

function putanjeListova(putanja, lista) {
  const rels = Object.create(null); // kljucevi su iz fajla
  if (lista['xl/_rels/workbook.xml.rels']) {
    for (const r of svi(ucitaj(putanja, lista, 'xl/_rels/workbook.xml.rels'), 'Relationship')) {
      const cilj = atr(r, 'Target') ?? '';
      rels[atr(r, 'Id')] = cilj.startsWith('/') ? cilj.replace(/^\/+/, '') : 'xl/' + cilj;
    }
  }
  const putanje = [];
  for (const s of svi(ucitaj(putanja, lista, 'xl/workbook.xml'), 'sheet')) {
    const rid = atr(s, 'r:id') ?? '';
    if (rid !== '' && rels[rid]) putanje.push(rels[rid]);
  }
  if (putanje.length === 0) {
    // bez rels fajla: listovi redom kako su u arhivi, prirodnim redosledom
    return Object.keys(lista)
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
      .sort((a, b) => parseInt(a.match(/\d+/), 10) - parseInt(b.match(/\d+/), 10));
  }
  return putanje;
}

function datumskiStilovi(stablo) {
  const formati = new Set(DATUMSKI_UGRADJENI);
  for (const f of svi(stablo, 'numFmt')) {
    const kod = (atr(f, 'formatCode') ?? '').replace(/\[[^\]]*\]|"[^"]*"/g, '');
    if (/[dmy]/i.test(kod) && !/[#0]/.test(kod)) formati.add(parseInt(atr(f, 'numFmtId'), 10) || 0);
  }
  const xfs = svi(stablo, 'cellXfs')[0];
  const stilovi = new Set();
  if (!xfs) return stilovi;
  let i = 0;
  for (const xf of xml.deca(xfs)) {
    if (xml.ime(xf) === null || xml.lokalno(xml.ime(xf)) !== 'xf') continue;
    if (formati.has(parseInt(atr(xf, 'numFmtId'), 10) || 0)) stilovi.add(i);
    i++;
  }
  return stilovi;
}

// "C7" -> 2; null ako nema oznake.
function indeksKolone(ref) {
  const m = /^([A-Z]+)\d*$/.exec(ref ?? '');
  if (!m) return null;
  let n = 0;
  for (const slovo of m[1]) n = n * 26 + (slovo.charCodeAt(0) - 64);
  return n - 1;
}

// Excel serijski broj (1900 sistem) u dd.mm.gggg.
function datumIzBroja(broj) {
  let dana = Math.floor(broj);
  if (dana > 59) dana--; // Excelov nepostojeći 29.02.1900.
  const d = new Date(Date.UTC(1900, 0, dana));
  if (Number.isNaN(d.getTime())) return String(broj);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return dd + '.' + mm + '.' + d.getUTCFullYear() + '.';
}

function jeBroj(s) {
  return /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(s) && Number.isFinite(Number(s));
}

function vrednostCelije(c, deljeni, stilovi) {
  const tip = atr(c, 't') ?? '';
  if (tip === 'inlineStr') return spojiT(c);
  const v = xml.deca(c).find((n) => xml.ime(n) !== null && xml.lokalno(xml.ime(n)) === 'v');
  if (!v) return '';
  const vrednost = xml.tekstElementa(v);
  if (tip === 's') return deljeni[parseInt(vrednost, 10)] ?? '';
  if (tip === 'b') return vrednost === '1' ? 'da' : 'ne';
  if ((tip === '' || tip === 'n') && jeBroj(vrednost)) {
    const broj = Number(vrednost);
    const s = atr(c, 's');
    if (s !== null && stilovi.has(parseInt(s, 10))) return datumIzBroja(broj);
    return String(broj);
  }
  return vrednost;
}

function sredi(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// brojac.n je zajednički za sve listove radne sveske.
function citajList(stablo, deljeni, stilovi, brojac) {
  const redovi = [];
  for (const redEl of svi(stablo, 'row')) {
    // redovi koji nedostaju u XML-u ostaju prazni da brojevi redova odgovaraju Excelu
    const broj = parseInt(atr(redEl, 'r'), 10) || 0;
    if (broj > NAJVISE_REDOVA) throw new Error(GRESKA_XML);
    if (broj > 0 && redovi.length < broj - 1) {
      brojac.n += broj - 1 - redovi.length;
      if (brojac.n > NAJVISE_CELIJA) throw new Error(GRESKA_XML);
    }
    while (broj > 0 && redovi.length < broj - 1) redovi.push([]);
    const red = [];
    for (const c of xml.deca(redEl)) {
      if (xml.ime(c) === null || xml.lokalno(xml.ime(c)) !== 'c') continue;
      let kolona = indeksKolone(atr(c, 'r'));
      if ((parseInt((atr(c, 'r') ?? '').replace(/^[A-Z]+/, ''), 10) || 0) > NAJVISE_REDOVA) throw new Error(GRESKA_XML);
      if (kolona === null) kolona = red.length;
      if (kolona >= NAJVISE_KOLONA) throw new Error(GRESKA_XML);
      while (red.length < kolona) red.push('');
      red[kolona] = vrednostCelije(c, deljeni, stilovi);
    }
    brojac.n += red.length;
    if (brojac.n > NAJVISE_CELIJA) throw new Error(GRESKA_XML);
    redovi.push(red.map(sredi));
  }
  return redovi;
}

// Vraća {tabele: string[][][], tekst: ''}.
function procitaj(putanja) {
  const lista = zip.lista(putanja);
  if (!lista['xl/workbook.xml']) throw new Error('Fajl nije Excel radna sveska (.xlsx).');
  const deljeni = lista['xl/sharedStrings.xml']
    ? svi(ucitaj(putanja, lista, 'xl/sharedStrings.xml'), 'si').map((si) => sredi(spojiT(si)))
    : [];
  const stilovi = lista['xl/styles.xml'] ? datumskiStilovi(ucitaj(putanja, lista, 'xl/styles.xml')) : new Set();
  const tabele = [];
  const brojac = { n: 0 };
  // isti list naveden više puta se čita jednom
  for (const put of new Set(putanjeListova(putanja, lista))) {
    if (!lista[put]) continue;
    tabele.push(citajList(ucitaj(putanja, lista, put), deljeni, stilovi, brojac));
  }
  return { tabele, tekst: '' };
}

module.exports = { procitaj, DATUMSKI_UGRADJENI, datumIzBroja };
