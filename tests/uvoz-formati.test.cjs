// Čitači za .odt, .ods, .xls, .doc i PDF, i prepoznavanje vrste fajla po sadržaju.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zip = require('../electron/uvoz/zip.cjs');
const docx = require('../electron/uvoz/docx.cjs');
const xlsx = require('../electron/uvoz/xlsx.cjs');
const odf = require('../electron/uvoz/odf.cjs');
const xls = require('../electron/uvoz/xls.cjs');
const doc = require('../electron/uvoz/doc.cjs');
const pdf = require('../electron/uvoz/pdf.cjs');
const citac = require('../electron/uvoz/citac.cjs');
const tumac = require('../electron/uvoz/tumac-prijave.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { docxPrimer, odtPrimer } = require('./pomoc/uzorci.cjs');
const cfbPisac = require('./pomoc/cfb-pisac.cjs');
const { napravi: napraviDoc, docPrimer } = require('./pomoc/doc-pisac.cjs');

const FAJLOVI = path.join(__dirname, 'fajlovi');
const fajl = (ime) => path.join(FAJLOVI, ime);

function privremeni(ime) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-formati-'));
  return { put: path.join(dir, ime), ukloni: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function docxTabele() {
  const t = privremeni('a.docx');
  try { return docx.procitaj(docxPrimer(t.put)); } finally { t.ukloni(); }
}

// ---------- odt / ods ----------

test('odt: isti rezultat kao docx uzorak (spojene ćelije, zaglavlje, span, lista; bez fusnote)', () => {
  const t = privremeni('a.odt');
  try {
    odtPrimer(t.put);
    const d = odf.procitaj(t.put);
    assert.equal(d.vrsta, 'odt');
    assert.deepEqual(d.tabele, docxTabele().tabele);
    assert.equal(d.tekst, 'I KOLO PGL VOJVODINE MSG A, B i C\nDEFINITIVNA I IMENIČNA PRIJAVA');
    assert.equal(citac.procitaj(t.put).vrsta, 'odt');
    // bez stavke mimetype vrsta se prepoznaje po content.xml
    odtPrimer(t.put, { mimetype: false });
    assert.equal(citac.procitaj(t.put).vrsta, 'odt');
    const p = tumac.protumaci(d);
    assert.equal(p.klub, 'G.D.“PARTIZAN –ŽELJEZNIČAR“');
    assert.equal(p.redovi.length, 3);
  } finally { t.ukloni(); }
});

const ODS_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
function ods(put, listovi, { manifest = '' } = {}) {
  const dok = '<?xml version="1.0" encoding="UTF-8"?><office:document-content ' + ODS_NS + '><office:body><office:spreadsheet>'
    + listovi.map((l) => '<table:table table:name="L">' + l + '</table:table>').join('')
    + '</office:spreadsheet></office:body></office:document-content>';
  zip.napravi(put, {
    mimetype: { sadrzaj: 'application/vnd.oasis.opendocument.spreadsheet' },
    'content.xml': { sadrzaj: dok },
    'META-INF/manifest.xml': { sadrzaj: '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">' + manifest + '</manifest:manifest>' },
  });
  return put;
}

test('ods: vrste vrednosti, ponovljene ćelije i redovi, prazni redovi, drugi list', () => {
  const t = privremeni('a.ods');
  try {
    const s = (x) => '<table:table-cell office:value-type="string"><text:p>' + x + '</text:p></table:table-cell>';
    const prazno = (n) => '<table:table-cell table:number-columns-repeated="' + n + '"/>';
    const red = (...c) => '<table:table-row>' + c.join('') + '</table:table-row>';
    ods(t.put, [
      '<table:table-column table:number-columns-repeated="1024"/>'
      + red(s('Klub'), s('SD „Vojvodina“'), prazno(16382))
      + '<table:table-row table:number-rows-repeated="2">' + prazno(16384) + '</table:table-row>'
      + '<table:table-header-rows>' + red(s('Prezime'), s('Ime'), s('Datum rođenja'), s('Broj'), s('Ok')) + '</table:table-header-rows>'
      + red(s('Petrović'), s('Mina'), '<table:table-cell office:value-type="date" office:date-value="2014-01-01"><text:p>1.1.14</text:p></table:table-cell>',
        '<table:table-cell office:value-type="float" office:value="2013"><text:p>2.013</text:p></table:table-cell>',
        '<table:table-cell office:value-type="boolean" office:boolean-value="true"><text:p>TRUE</text:p></table:table-cell>', prazno(16379))
      + red(s('Jović'), '<table:covered-table-cell/>', '<table:table-cell office:value-type="date" office:date-value="2013-05-13T00:00:00"/>',
        '<table:table-cell office:value-type="percentage" office:value="0.5"><text:p>50%</text:p></table:table-cell>',
        '<table:table-cell table:number-columns-repeated="2" office:value-type="string"><text:p>x</text:p><text:p>y</text:p></table:table-cell>')
      + '<table:table-row table:number-rows-repeated="1048000">' + prazno(16384) + '</table:table-row>',
      red(s('drugi')),
    ]);
    const d = odf.procitaj(t.put);
    assert.equal(d.vrsta, 'ods');
    assert.equal(d.tekst, '');
    assert.deepEqual(d.tabele, [
      [
        ['Klub', 'SD „Vojvodina“'],
        [],
        [],
        ['Prezime', 'Ime', 'Datum rođenja', 'Broj', 'Ok'],
        ['Petrović', 'Mina', '01.01.2014.', '2013', 'da'],
        ['Jović', '', '13.05.2013.', '0.5', 'x y', 'x y'],
      ],
      [['drugi']],
    ]);
  } finally { t.ukloni(); }
});

test('ods: datum sa vremenskom zonom je lokalni datum', () => {
  const t = privremeni('a.ods');
  try {
    const trenutak = new Date(2014, 0, 1).toISOString(); // lokalna ponoć kao UTC, kako piše SheetJS
    ods(t.put, ['<table:table-row><table:table-cell office:value-type="date" office:date-value="' + trenutak + '"/></table:table-row>']);
    assert.deepEqual(odf.procitaj(t.put).tabele, [[['01.01.2014.']]]);
  } finally { t.ukloni(); }
});

test('ods: fajl iz SheetJS (prijava-vojvodina.ods) daje isto što i xlsx, osim datuma koji zavise od zone', () => {
  const o = odf.procitaj(fajl('prijava-vojvodina.ods'));
  const x = xlsx.procitaj(fajl('prijava-vojvodina.xlsx'));
  const bezDatuma = (tabele) => tabele.map((tb) => tb.map((r) => r.map((c) => (/^\d\d\.\d\d\.\d{4}\.$/.test(c) ? 'D' : c))));
  assert.deepEqual(bezDatuma(o.tabele), bezDatuma(x.tabele));
  assert.equal(citac.procitaj(fajl('prijava-vojvodina.ods')).vrsta, 'ods');
});

test('odf: zaštićen lozinkom, oštećen content.xml, nepoznat mimetype', () => {
  const t = privremeni('a.ods');
  try {
    ods(t.put, [''], { manifest: '<manifest:file-entry><manifest:encryption-data/></manifest:file-entry>' });
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message.startsWith('Dokument je zaštićen lozinkom.'));
    zip.napravi(t.put, { mimetype: { sadrzaj: 'application/vnd.oasis.opendocument.text' }, 'content.xml': { sadrzaj: '<office:document-content><office:body>' } });
    assert.throws(() => citac.procitaj(t.put), { message: 'OpenDocument fajl je oštećen (content.xml nije ispravan XML).' });
    zip.napravi(t.put, { mimetype: { sadrzaj: 'application/vnd.oasis.opendocument.presentation' }, 'content.xml': { sadrzaj: '<x/>' } });
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Fajl nije podržan dokument.'));
  } finally { t.ukloni(); }
});

// ---------- xls ----------

const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const f64 = (n) => { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b; };
const z = cfbPisac.zapisBiff;
const bof = (verzija, vrsta) => z(0x0809, Buffer.concat([u16(verzija), u16(vrsta), Buffer.alloc(12)]));
const EOF_ZAPIS = z(0x000a, Buffer.alloc(0));
const celija = (red, kol, xf) => Buffer.concat([u16(red), u16(kol), u16(xf)]);
// XLUnicodeString: duzina, zastavica, znakovi (jedan bajt ili UTF-16)
const niz = (s, siroki = /[^\x00-\xff]/.test(s)) => Buffer.concat([u16(s.length), Buffer.from([siroki ? 1 : 0]), Buffer.from(s, siroki ? 'utf16le' : 'latin1')]);
const rkCeo = (n) => ((n << 2) | 2) >>> 0;

// Ručno složen BIFF8 tok: SST se prekida usred niza (i menja kodiranje u nastavku), obogaćen niz,
// RK, MULRK, formule (tekst, logička, broj), BOOLERR, LABEL, ugrađen grafikon, list grafikona.
function xlsRucno(put, { verzija = 0x0600, sifra = false, datum1904 = false } = {}) {
  const sst1 = Buffer.concat([u32(4), u32(4), niz('Klub'), u16(8), Buffer.from([1]), Buffer.from('Đor', 'utf16le')]);
  const sst2 = Buffer.concat([Buffer.from([1]), Buffer.from('đević', 'utf16le'), u16(8), Buffer.from([0]), Buffer.from('Petrovi', 'latin1')]);
  const sst3 = Buffer.concat([Buffer.from([1]), Buffer.from('ć', 'utf16le'), u16(4), Buffer.from([0x08]), u16(1), Buffer.from('Mina', 'latin1'), Buffer.alloc(4)]);
  const list = (ime, vrsta, ofset) => z(0x0085, Buffer.concat([u32(ofset), Buffer.from([0, vrsta, ime.length, 0]), Buffer.from(ime, 'latin1')]));
  const xf = (fmt) => z(0x00e0, Buffer.concat([u16(0), u16(fmt), Buffer.alloc(16)]));
  const formula = (red, kol, vrednost) => z(0x0006, Buffer.concat([celija(red, kol, 0), vrednost, Buffer.alloc(8)]));
  const list1 = Buffer.concat([
    bof(0x0600, 0x0010),
    z(0x00fd, Buffer.concat([celija(0, 0, 0), u32(0)])),
    z(0x00fd, Buffer.concat([celija(0, 1, 0), u32(1)])),
    z(0x00fd, Buffer.concat([celija(2, 0, 0), u32(2)])),
    z(0x00fd, Buffer.concat([celija(2, 1, 0), u32(3)])),
    z(0x0203, Buffer.concat([celija(2, 2, 2), f64(41640)])),
    z(0x027e, Buffer.concat([celija(2, 3, 0), u32(rkCeo(2013))])),
    z(0x00bd, Buffer.concat([u16(3), u16(0), u16(0), u32(0x3ff80000), u16(1), u32(rkCeo(41640)), u16(1)])),
    formula(4, 0, Buffer.from([0, 0, 0, 0, 0, 0, 0xff, 0xff])),
    z(0x0207, niz('ekipa')),
    formula(4, 1, Buffer.from([1, 0, 1, 0, 0, 0, 0xff, 0xff])),
    formula(4, 2, f64(7)),
    z(0x0205, Buffer.concat([celija(4, 3, 0), Buffer.from([0, 0])])),
    z(0x0205, Buffer.concat([celija(4, 4, 0), Buffer.from([7, 1])])), // greska #DIV/0! se preskace
    z(0x0204, Buffer.concat([celija(5, 0, 0), niz('Jović')])),
    bof(0x0600, 0x0020), z(0x0204, Buffer.concat([celija(9, 9, 0), niz('grafikon')])), EOF_ZAPIS,
    EOF_ZAPIS,
  ]);
  const list2 = Buffer.concat([bof(0x0600, 0x0010), z(0x0204, Buffer.concat([celija(0, 0, 0), niz('drugi')])), EOF_ZAPIS]);
  const glava = (o1, o2) => Buffer.concat([
    bof(verzija, 0x0005),
    sifra ? z(0x002f, Buffer.alloc(6)) : Buffer.alloc(0),
    z(0x0022, u16(datum1904 ? 1 : 0)),
    z(0x041e, Buffer.concat([u16(164), niz('dd\.mm\.yyyy\.')])),
    xf(0), xf(14), xf(164),
    list('Prijava', 0, o1), list('Grafikon', 2, o2), list('Drugi', 0, o2),
    z(0x00fc, sst1), z(0x003c, sst2), z(0x003c, sst3),
    EOF_ZAPIS,
  ]);
  const duz = glava(0, 0).length;
  const tok = Buffer.concat([glava(duz, duz + list1.length), list1, list2]);
  return cfbPisac.napravi(put, [['Workbook', tok]]);
}

test('xls: ručno složen BIFF8 (SST preko CONTINUE sa promenom kodiranja, RK, MULRK, formule)', () => {
  const t = privremeni('a.xls');
  try {
    xlsRucno(t.put);
    const d = xls.procitaj(t.put);
    assert.deepEqual(d, {
      tabele: [
        [['Klub', 'Đorđević'], [], ['Petrović', 'Mina', '01.01.2014.', '2013'], ['1.5', '01.01.2014.'], ['ekipa', 'da', '7', 'ne'], ['Jović']],
        [['drugi']],
      ],
      tekst: '',
    });
    assert.equal(citac.procitaj(t.put).vrsta, 'xls');
    xlsRucno(t.put, { datum1904: true });
    assert.equal(xls.procitaj(t.put).tabele[0][2][2], '02.01.2018.');
  } finally { t.ukloni(); }
});

test('xls: RK brojevi', () => {
  assert.equal(xls.rk(rkCeo(2013)), 2013);
  assert.equal(xls.rk(rkCeo(-5)), -5);
  assert.equal(xls.rk(0x3ff80000), 1.5);
  assert.equal(xls.rk(0x3ff80001), 0.015);
  assert.equal(xls.rk(rkCeo(12345) | 1), 123.45);
});

test('xls: zaštićen, prestar (Excel 95), bez Workbook toka', () => {
  const t = privremeni('a.xls');
  try {
    xlsRucno(t.put, { sifra: true });
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message.startsWith('Excel fajl je zaštićen lozinkom.'));
    xlsRucno(t.put, { verzija: 0x0500 });
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Excel fajl je u prestarom formatu'));
    cfbPisac.napravi(t.put, [['Book', Buffer.alloc(10)]]);
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Excel fajl je u prestarom formatu'));
    cfbPisac.napravi(t.put, [['Nesto', Buffer.alloc(10)]]);
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Fajl je stari Office dokument, ali nije Word ni Excel.'));
  } finally { t.ukloni(); }
});

test('xls: fajlovi iz SheetJS (mali tok u mini toku; veliki SST sa 9 CONTINUE zapisa)', () => {
  assert.deepEqual(xls.procitaj(fajl('prijava-vojvodina.xls')).tabele, xlsx.procitaj(fajl('prijava-vojvodina.xlsx')).tabele);
  const v = xls.procitaj(fajl('mnogo-nizova.xls'));
  assert.equal(v.tabele.length, 2);
  assert.equal(v.tabele[0].length, 1504);
  assert.deepEqual(v.tabele[0][0], ['Klub', 'GK Šabac']);
  assert.deepEqual(v.tabele[0][3], ['Đorđević0ćšž', 'Žarko0', 'IV A', '01.01.2014.', 'pojedinac']);
  assert.deepEqual(v.tabele[0][1502], ['Đorđević1499ćšž', 'Žarko1499', 'I B', '08.02.2018.', 'ekipa']);
  assert.deepEqual(v.tabele[0][1503], ['Kraj', 'Broj', '1.5', '2013', 'da']);
  assert.deepEqual(v.tabele[1], [['drugi list', '42']]);
  const p = tumac.protumaci(citac.procitaj(fajl('prijava-vojvodina.xls')));
  assert.equal(p.klub, 'SD „Vojvodina“');
  assert.equal(p.redovi.length, 4);
});

// ---------- doc ----------

test('doc: isti rezultat kao docx uzorak (polje DATE, nelomljiva crtica, spojena ćelija po granicama)', () => {
  const t = privremeni('a.doc');
  try {
    docPrimer(t.put);
    const d = doc.procitaj(t.put);
    assert.deepEqual(d.tabele, docxTabele().tabele);
    assert.equal(d.tekst, 'I KOLO PGL VOJVODINE MSG A, B i C\nDEFINITIVNA I IMENIČNA PRIJAVA\nDatum: 29.10.2026');
    assert.equal(citac.procitaj(t.put).vrsta, 'doc');
    // tekst u dva dela, drugi deo ispred prvog u fajlu
    docPrimer(t.put, { delovi: 2 });
    assert.deepEqual(doc.procitaj(t.put), d);
    const p = tumac.protumaci(citac.procitaj(t.put));
    assert.equal(p.klub, 'G.D.“PARTIZAN –ŽELJEZNIČAR“');
    assert.equal(p.pol, 'M');
    assert.deepEqual(p.redovi.map((r) => [r.prezime, r.ime, r.datum]), [
      ['Neorčić', 'Noah', '2017-02-12'], ['Herceg', 'Aron', '2012-04-25'], ['Laudis Nanaši', 'Dragan', '2012-11-14'],
    ]);
  } finally { t.ukloni(); }
});

test('doc: tekst u jednom bajtu po znaku (cp1252), prazna ćelija na kraju reda, ćelija sa više pasusa', () => {
  const t = privremeni('a.doc');
  try {
    napraviDoc(t.put, [
      { p: 'Klub: GK Sabac \x80 \x9a' },
      { tabela: [['PREZIME', 'IME', 'GODISTE'], [['Petrovic', 'Mina'], 'Mina', ''], ['', '', '']] },
      { p: 'kraj' },
    ], { komprimovano: true, delovi: 2 });
    assert.deepEqual(doc.procitaj(t.put), {
      tabele: [[['PREZIME', 'IME', 'GODISTE'], ['Petrovic Mina', 'Mina', ''], ['', '', '']]],
      tekst: 'Klub: GK Sabac € š\nkraj',
    });
  } finally { t.ukloni(); }
});

test('doc: zaštićen, prestar (Word 95), nije Word', () => {
  const t = privremeni('a.doc');
  try {
    docPrimer(t.put, { sifrovano: true });
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message.startsWith('Word dokument je zaštićen lozinkom.'));
    docPrimer(t.put, { nFib: 0x65 });
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Word dokument je u prestarom formatu'));
    const w = Buffer.alloc(1024);
    w.writeUInt16LE(0x1234, 0);
    cfbPisac.napravi(t.put, [['WordDocument', w]]);
    assert.throws(() => citac.procitaj(t.put), { message: 'Fajl nije Word dokument (.doc).' });
    cfbPisac.napravi(t.put, [['EncryptedPackage', Buffer.alloc(10)], ['EncryptionInfo', Buffer.alloc(10)]]);
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Dokument je zaštićen lozinkom.'));
  } finally { t.ukloni(); }
});

// ---------- prepoznavanje ----------

test('citac: RTF, web stranica i Excel XML sa nastavkom .doc ili .xls dobijaju jasnu poruku', () => {
  const t = privremeni('a.doc');
  try {
    fs.writeFileSync(t.put, '{\\rtf1\\ansi prijava}');
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message.startsWith('Fajl je RTF dokument.'));
    fs.writeFileSync(t.put, '﻿  <html><body><table><tr><td>x</td></tr></table></body></html>');
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Fajl je web stranica (HTML)'));
    fs.writeFileSync(t.put, '<table><tr><td>x</td></tr></table>');
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Fajl je web stranica (HTML)'));
    fs.writeFileSync(t.put, '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook/>');
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.startsWith('Fajl je Excel XML tabela (2003).'));
  } finally { t.ukloni(); }
});

test('citac: EKSTENZIJE za prozor izbora fajla', () => {
  assert.deepEqual(citac.EKSTENZIJE, ['docx', 'doc', 'xlsx', 'xls', 'odt', 'ods', 'pdf']);
});

// ---------- pdf ----------

test('pdf: prijava iz Chromium-a (zaglavlje DATUM / ROĐENJA u dva reda, potpis ispod tabele)', async () => {
  const d = await citac.procitaj(fajl('prijava-partizan.pdf'));
  assert.equal(d.vrsta, 'pdf');
  assert.deepEqual(d.tabele, [
    [['I KOLO PGL VOJVODINE MSG A, B i C'], ['DEFINITIVNA I IMENIČNA PRIJAVA'], ['Klub', 'G.D.“PARTIZAN –ŽELJEZNIČAR“'], ['Kontakt osoba', 'Robert M.'], ['Odgovorno lice: ______________']],
    [
      ['#', 'PREZIME', 'IME', 'KATEGORIJA', 'DATUM ROĐENJA', 'FUNKCIJA-EKIPA'],
      ['1.', 'Neorčić', 'Noah', 'I “B”', '12.02.2017.', 'pojedinac'],
      ['2.', 'Herceg', 'Aron', 'IV “A”', '25.04.2012..', 'ekipa'],
      ['3.', 'Laudis Nanaši', 'Dragan', 'IV “A”', '14.11.2012.', ''],
      ['4.', '', '', '', '', ''],
    ],
  ]);
  const p = tumac.protumaci(d);
  assert.equal(p.klub, 'G.D.“PARTIZAN –ŽELJEZNIČAR“');
  assert.equal(p.pol, 'M');
  assert.equal(p.redovi.length, 3);
  assert.deepEqual(p.greske, []);
});

test('pdf: dve strane sa ponovljenim zaglavljem, vertikalno centrirano zaglavlje, prazna kategorija', async () => {
  const d = await pdf.procitaj(fajl('prijava-duga.pdf'));
  assert.equal(d.tabele.length, 3);
  assert.deepEqual(d.tabele[1][0], ['R.br.', 'PREZIME', 'IME', 'KATEGORIJA', 'DATUM ROĐENJA', 'UČEŠĆE']);
  assert.deepEqual(d.tabele[1][5], ['5.', 'Prezimić5', 'Ime5', '', '06.03.2014.', 'ekipa']);
  assert.deepEqual(d.tabele[2][0], d.tabele[1][0]);
  const p = tumac.protumaci(d);
  assert.equal(p.klub, 'GK Šabac');
  assert.equal(p.pol, 'Z');
  assert.equal(p.redovi.length, 45);
  assert.deepEqual(p.redovi.map((r) => r.prezime), Array.from({ length: 45 }, (_, i) => 'Prezimić' + (i + 1)));
  assert.ok(p.redovi.every((r) => r.greske.length === 0));
});

// Komadi teksta kao iz pdfjs: [tekst, x, y, sirina]; slova 10.
const komadi = (strana, lista) => pdf.redoviTeksta(lista.map(([s, x, y, w]) => ({ s, x0: x, x1: x + w, y, v: 10 }))).map((r) => ({ ...r, strana }));

test('pdf: tabela se nastavlja na novoj strani bez ponovljenog zaglavlja; naslov preko kolona je tekst', () => {
  const zag = [['PREZIME', 50, 700, 45], ['IME', 150, 700, 20], ['GODINA', 250, 700, 35]];
  const d = pdf.sklopi([
    ...komadi(1, [...zag, ['Petrović', 50, 685, 40], ['Mina', 150, 685, 22], ['2014', 250, 685, 20]]),
    ...komadi(2, [['Strana 2 prijave kluba', 40, 800, 260], ['Jović', 50, 780, 30], ['Lena', 150, 780, 22], ['2013', 250, 780, 20]]),
  ]);
  assert.deepEqual(d.tabele, [
    [['Strana 2 prijave kluba']],
    [['PREZIME', 'IME', 'GODINA'], ['Petrović', 'Mina', '2014'], ['Jović', 'Lena', '2013']],
  ]);
  assert.equal(d.tekst, 'Strana 2 prijave kluba');
});

test('pdf: veliki razmak posle tabele na istoj strani završava tabelu', () => {
  const d = pdf.sklopi(komadi(1, [
    ['PREZIME', 50, 700, 45], ['IME', 150, 700, 20],
    ['Petrović', 50, 685, 40], ['Mina', 150, 685, 22],
    ['Trener', 50, 600, 30], ['Marko', 150, 600, 30],
  ]));
  assert.deepEqual(d.tabele, [[['Trener', 'Marko']], [['PREZIME', 'IME'], ['Petrović', 'Mina']]]);
});

test('pdf: bez teksta (skeniran) i oštećen', async () => {
  const t = privremeni('a.pdf');
  try {
    fs.writeFileSync(t.put, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
      + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    await assert.rejects(citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message.startsWith('PDF nema teksta (verovatno je skeniran).'));
    fs.writeFileSync(t.put, '%PDF-1.7\nnije pdf');
    await assert.rejects(citac.procitaj(t.put), { message: 'PDF fajl je oštećen ili nije PDF.' });
  } finally { t.ukloni(); }
});

// ---------- zaštita od namerno napravljenih fajlova (1.1.1) ----------

test('doc: ugnježđena polja (kod unutar koda) i ograničenje dubine polja', () => {
  const t = privremeni('a.doc');
  try {
    napraviDoc(t.put, [{ p: 'A\x13 SPOLJA \x13 UNUTRA \x14u\x15 \x14x\x15B \x13 C \x14c\x15' }]);
    assert.equal(doc.procitaj(t.put).tekst, 'AxB c');
    napraviDoc(t.put, [{ p: 'x' + '\x13'.repeat(64) }]);
    assert.equal(doc.procitaj(t.put).tekst, 'x');
    napraviDoc(t.put, [{ p: 'x' + '\x13'.repeat(65) }]);
    assert.throws(() => doc.procitaj(t.put), { message: 'Word dokument je oštećen.' });
  } finally { t.ukloni(); }
});

test('doc: ista FKP strana navedena mnogo puta se čita jednom; delovi teksta van redosleda se odbijaju', () => {
  const t = privremeni('a.doc');
  try {
    docPrimer(t.put);
    const ocekivano = doc.procitaj(t.put);
    // bez provere ponavljanja ovo bi bilo preko milion runova (ograničenje NAJVISE_RUNOVA)
    docPrimer(t.put, { ponoviStrane: 100000 });
    assert.deepEqual(doc.procitaj(t.put), ocekivano);
    docPrimer(t.put, { delovi: 2, cpObrnuto: true });
    assert.throws(() => doc.procitaj(t.put), { message: 'Word dokument je oštećen.' });
  } finally { t.ukloni(); }
});

test('xls: prazne ćelije kojima se red dopunjava ulaze u ograničenje', () => {
  const t = privremeni('a.xls');
  try {
    // 65536 redova, u svakom samo ćelija u koloni 255: 65536 upisanih, a 16,7 miliona posle dopune
    const redovi = [];
    for (let r = 0; r < 65536; r++) redovi.push(z(0x0203, Buffer.concat([celija(r, 255, 0), f64(1)])));
    const list = Buffer.concat([bof(0x0600, 0x0010), ...redovi, EOF_ZAPIS]);
    const glava = (o) => Buffer.concat([bof(0x0600, 0x0005), z(0x0085, Buffer.concat([u32(o), Buffer.from([0, 0, 1, 0]), Buffer.from('L')])), EOF_ZAPIS]);
    const duz = glava(0).length;
    cfbPisac.napravi(t.put, [['Workbook', Buffer.concat([glava(duz), list])]]);
    assert.throws(() => xls.procitaj(t.put), { message: 'Excel fajl je oštećen.' });
  } finally { t.ukloni(); }
});

test('xls: listovi sa istim ofsetom se čitaju jednom; listovi koji se preklapaju se odbijaju', () => {
  const t = privremeni('a.xls');
  try {
    const zapisiLista = [bof(0x0600, 0x0010)];
    for (let i = 0; i < 300; i++) zapisiLista.push(z(0x0204, Buffer.concat([celija(i, 0, 0), niz('x' + i)])));
    zapisiLista.push(EOF_ZAPIS);
    const list = Buffer.concat(zapisiLista);
    const ofsetiZapisa = [];
    let o = 0;
    for (const zp of zapisiLista) { ofsetiZapisa.push(o); o += zp.length; }
    const sveska = (ofseti) => {
      const glava = (pocetak) => Buffer.concat([
        bof(0x0600, 0x0005),
        ...ofseti.map((x) => z(0x0085, Buffer.concat([u32(pocetak + x), Buffer.from([0, 0, 1, 0]), Buffer.from('L')]))),
        EOF_ZAPIS,
      ]);
      const duz = glava(0).length;
      return Buffer.concat([glava(duz), list]);
    };
    cfbPisac.napravi(t.put, [['Workbook', sveska(Array(2000).fill(0))]]);
    const d = xls.procitaj(t.put);
    assert.equal(d.tabele.length, 1);
    assert.equal(d.tabele[0].length, 300);
    // svaki "list" počinje na sledećem zapisu istog lista: posao raste sa kvadratom
    cfbPisac.napravi(t.put, [['Workbook', sveska(ofsetiZapisa.slice(0, 300))]]);
    assert.throws(() => xls.procitaj(t.put), { message: 'Excel fajl je oštećen.' });
  } finally { t.ukloni(); }
});

test('ods: ograničenje ćelija važi za ceo fajl, ne po listu', () => {
  const t = privremeni('a.ods');
  try {
    // jedan list: 16384 x 70 = 1146880 ćelija (prolazi); dva lista zajedno prelaze 2 miliona
    const list = '<table:table-row table:number-rows-repeated="70"><table:table-cell table:number-columns-repeated="16384" office:value-type="string"><text:p>x</text:p></table:table-cell></table:table-row>';
    ods(t.put, [list]);
    assert.equal(odf.procitaj(t.put).tabele[0].length, 70);
    ods(t.put, [list, list]);
    assert.throws(() => odf.procitaj(t.put), { message: 'OpenDocument fajl je oštećen (content.xml nije ispravan XML).' });
  } finally { t.ukloni(); }
});

test('xlsx: isti list naveden dva puta u workbook.xml se čita jednom', () => {
  const t = privremeni('a.xlsx');
  try {
    const wb = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
      + '<sheet name="A" sheetId="1" r:id="rId1"/><sheet name="B" sheetId="2" r:id="rId1"/></sheets></workbook>';
    const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
    const list = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row></sheetData></worksheet>';
    zip.napravi(t.put, { 'xl/workbook.xml': { sadrzaj: wb }, 'xl/_rels/workbook.xml.rels': { sadrzaj: rels }, 'xl/worksheets/sheet1.xml': { sadrzaj: list } });
    assert.deepEqual(xlsx.procitaj(t.put).tabele, [[['x']]]);
  } finally { t.ukloni(); }
});
