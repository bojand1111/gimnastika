const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zip = require('../electron/uvoz/zip.cjs');
const docx = require('../electron/uvoz/docx.cjs');
const xlsx = require('../electron/uvoz/xlsx.cjs');
const citac = require('../electron/uvoz/citac.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { docxPrimer, xlsxPrimer } = require('./pomoc/uzorci.cjs');

const FAJLOVI = path.join(__dirname, 'fajlovi');
const NIJE_PODRZAN = 'Fajl nije podržan dokument. Uvoze se Word (.docx, .doc), Excel (.xlsx, .xls), OpenDocument (.odt, .ods) i PDF sa tekstom; skenirani dokumenti i slike ne mogu.';

function privremeni(ime) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-citac-'));
  return { put: path.join(dir, ime), ukloni: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('docx: citanje sinteticki uzorak', () => {
  const t = privremeni('a.docx');
  try {
    docxPrimer(t.put);
    const d = docx.procitaj(t.put);
    assert.equal(d.tabele.length, 2);
    assert.ok(d.tekst.includes('MSG'));
    assert.deepEqual(d.tabele[0][0], ['Klub', 'G.D.“PARTIZAN –ŽELJEZNIČAR“']);
    const tb = d.tabele[1];
    assert.deepEqual(tb[0], ['#', 'PREZIME', 'IME', 'KATEGORIJA', 'DATUM ROĐENJA', 'FUNKCIJA-EKIPA']);
    assert.equal(tb[1][2], 'Noah');
    assert.equal(tb[5].length, 6);
    assert.equal(tb[5][0], tb[5][1]);
    assert.equal(citac.procitaj(t.put).vrsta, 'docx');
  } finally { t.ukloni(); }
});

test('xlsx: citanje sinteticki uzorak', () => {
  const t = privremeni('a.xlsx');
  try {
    xlsxPrimer(t.put);
    const d = xlsx.procitaj(t.put);
    assert.equal(d.tabele.length, 1);
    assert.equal(d.tekst, '');
    const tb = d.tabele[0];
    assert.deepEqual(tb[0], ['Klub', 'SD „Vojvodina“']);
    assert.deepEqual(tb[1], []);
    assert.deepEqual(tb[3], ['Petrović', 'Mina', 'II A', '01.01.2014.', 'ekipa']);
    assert.deepEqual(tb[4], ['Jović', 'Lena', '', '2013']);
    assert.equal(citac.procitaj(t.put).vrsta, 'xlsx');
  } finally { t.ukloni(); }
});

test('citac: odbija tudj fajl', async () => {
  const t = privremeni('a.pdf');
  try {
    // pocinje kao PDF: ide u PDF citac, koji ga odbija (Promise)
    fs.writeFileSync(t.put, '%PDF-1.4 nije zip');
    await assert.rejects(citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message === 'PDF fajl je oštećen ili nije PDF.');
    zip.napravi(t.put, { 'a.txt': { sadrzaj: 'x' } });
    assert.throws(() => citac.procitaj(t.put), { message: NIJE_PODRZAN });
    fs.writeFileSync(t.put, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])); // JPEG slika
    assert.throws(() => citac.procitaj(t.put), { message: NIJE_PODRZAN });
    assert.throws(() => citac.procitaj(t.put + '.nema'), { message: 'Ne mogu da otvorim fajl. ' + NIJE_PODRZAN });
    fs.writeFileSync(t.put, '');
    assert.throws(() => citac.procitaj(t.put), { message: 'Fajl je prazan.' });
  } finally { t.ukloni(); }
});

test('citac: greske citaca su GreskaKorisnika sa cause', () => {
  const t = privremeni('a.docx');
  try {
    fs.writeFileSync(t.put, 'nije zip');
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message === NIJE_PODRZAN);
    // pocinje kao zip, ali je ostecen
    fs.writeFileSync(t.put, 'PK ostecen');
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message === 'Fajl je oštećen. ' + NIJE_PODRZAN && e.cause instanceof Error);
    zip.napravi(t.put, { 'a.txt': { sadrzaj: 'x' } });
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message === NIJE_PODRZAN);
    // pokvaren docx: greska iz docx citaca
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: '<w:document><w:body></w:document>' } });
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message.includes('oštećen') && e.cause instanceof Error);
  } finally { t.ukloni(); }
});

test('docx: poruke gresaka', () => {
  const t = privremeni('a.docx');
  try {
    zip.napravi(t.put, { 'x.txt': { sadrzaj: 'x' } });
    assert.throws(() => docx.procitaj(t.put), { message: 'Fajl nije Word dokument (.docx).' });
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: '<w:document><w:body></w:document>' } });
    assert.throws(() => docx.procitaj(t.put), { message: 'Word dokument je oštećen (document.xml nije ispravan XML).' });
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: '<w:document xmlns:w="u"></w:document>' } });
    assert.throws(() => docx.procitaj(t.put), { message: 'Word dokument nema sadržaj.' });
  } finally { t.ukloni(); }
});

test('docx: sdt/ins omotaci, tab/br kao razmak, ugnjezdena tabela', () => {
  const t = privremeni('a.docx');
  try {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const p = (x) => '<w:p><w:r><w:t>' + x + '</w:t></w:r></w:p>';
    const telo = '<w:sdt><w:sdtContent>' + p('  naslov  ') + '</w:sdtContent></w:sdt>'
      + '<w:tbl><w:sdt><w:sdtContent><w:tr><w:ins><w:tc><w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r></w:p></w:tc></w:ins>'
      + '<w:customXml><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>' + p('d') + '<w:tbl><w:tr><w:tc>' + p('ugn') + '</w:tc></w:tr></w:tbl></w:tc></w:customXml>'
      + '</w:tr></w:sdtContent></w:sdt></w:tbl>';
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: '<w:document ' + W + '><w:body>' + telo + '</w:body></w:document>' } });
    const d = docx.procitaj(t.put);
    assert.equal(d.tekst, 'naslov');
    assert.deepEqual(d.tabele, [[['ugn']], [['a b c', 'd', 'd']]]);
  } finally { t.ukloni(); }
});

test('xlsx: poruke gresaka, bez rels prirodni redosled listova, datumi i tipovi', () => {
  const t = privremeni('a.xlsx');
  try {
    zip.napravi(t.put, { 'x.txt': { sadrzaj: 'x' } });
    assert.throws(() => xlsx.procitaj(t.put), { message: 'Fajl nije Excel radna sveska (.xlsx).' });
    zip.napravi(t.put, { 'xl/workbook.xml': { sadrzaj: '<workbook><sheets></workbook>' } });
    assert.throws(() => xlsx.procitaj(t.put), { message: 'Excel fajl je oštećen (XML nije ispravan).' });
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const list = '<worksheet ' + NS + '><sheetData><row r="2"><c r="B2" t="b"><v>1</v></c><c t="str"><v>  dva   razmaka </v></c>'
      + '<c r="E2" s="1"><v>60.9</v></c><c r="F2"><v>2.5</v></c><c r="G2" t="s"><v>99</v></c><c r="H2" s="1"/></row></sheetData></worksheet>';
    const styles = '<styleSheet ' + NS + '><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
    zip.napravi(t.put, {
      'xl/workbook.xml': { sadrzaj: '<workbook ' + NS + '><sheets/></workbook>' },
      'xl/styles.xml': { sadrzaj: styles },
      'xl/worksheets/sheet2.xml': { sadrzaj: list },
      'xl/worksheets/sheet10.xml': { sadrzaj: '<worksheet ' + NS + '><sheetData/></worksheet>' },
    });
    const d = xlsx.procitaj(t.put);
    assert.equal(d.tabele.length, 2);
    // serijski 60.9 -> dana 60 -> 59 posle ispravke -> 28.02.1900.; ćelija bez r ide na sledeću poziciju
    assert.deepEqual(d.tabele[0], [[], ['', 'da', 'dva razmaka', '', '28.02.1900.', '2.5', '', '']]);
    assert.deepEqual(d.tabele[1], []);
  } finally { t.ukloni(); }
});

test('fikstura: prijava-partizan.docx', () => {
  const d = citac.procitaj(path.join(FAJLOVI, 'prijava-partizan.docx'));
  assert.equal(d.vrsta, 'docx');
  assert.equal(d.tabele.length, 2);
  assert.deepEqual(d.tabele[0][0], ['Klub', 'G.D.“PARTIZAN –ŽELJEZNIČAR“']);
  const tb = d.tabele[1];
  assert.deepEqual(tb[0], ['#', 'PREZIME', 'IME', 'KATEGORIJA', 'DATUM ROĐENJA', 'FUNKCIJA-EKIPA']);
  const podaci = tb.slice(1);
  assert.equal(podaci.length, 11);
  const prazan = (r) => r.slice(1).every((c) => c === '');
  assert.equal(podaci.filter((r) => !prazan(r)).length, 9);
  assert.equal(podaci.filter(prazan).length, 2);
});

test('fikstura: prijava-vojvodina.xlsx', () => {
  const d = citac.procitaj(path.join(FAJLOVI, 'prijava-vojvodina.xlsx'));
  assert.equal(d.vrsta, 'xlsx');
  assert.equal(d.tabele.length, 1);
  const tb = d.tabele[0];
  assert.deepEqual(tb.find((r) => r[0] === 'Klub'), ['Klub', 'SD „Vojvodina“']);
  // red ima kolonu R.br. ispred prezimena, pa je datum na indeksu 4 (cetvrta celija posle R.br.)
  const red = tb.find((r) => r[1] === 'Petrović' && r[2] === 'Mina');
  assert.deepEqual(red, ['1', 'Petrović', 'Mina', 'II "A"', '01.01.2014.', 'ekipa']);
});

// ---- ispravke posle pregleda ----
const NSX = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const GRESKA_XLSX = 'Excel fajl je oštećen (XML nije ispravan).';

// Pravi xlsx sa jednim listom (sheet1) i opcionim delovima.
function xlsxSaListom(put, redovi, dodatno = {}) {
  zip.napravi(put, {
    'xl/workbook.xml': { sadrzaj: '<workbook ' + NSX + '><sheets/></workbook>' },
    'xl/worksheets/sheet1.xml': { sadrzaj: '<worksheet ' + NSX + '><sheetData>' + redovi + '</sheetData></worksheet>' },
    ...dodatno,
  });
}

test('docx i xlsx: numericke reference znakova se dekodiraju', () => {
  const t = privremeni('a.docx');
  const x = privremeni('a.xlsx');
  try {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: '<w:document ' + W + '><w:body><w:p><w:r><w:t>&#65;&#x42;</w:t></w:r></w:p></w:body></w:document>' } });
    assert.equal(docx.procitaj(t.put).tekst, 'AB');
    xlsxSaListom(x.put, '<row r="1"><c r="A1" t="s"><v>0</v></c></row>', {
      'xl/sharedStrings.xml': { sadrzaj: '<sst ' + NSX + '><si><t>&#65;&#x42;</t></si></sst>' },
    });
    assert.deepEqual(xlsx.procitaj(x.put).tabele[0], [['AB']]);
  } finally { t.ukloni(); x.ukloni(); }
});

test('docx: gridSpan se ogranicava na 63 celije', () => {
  const t = privremeni('a.docx');
  try {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const tbl = '<w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="500"/></w:tcPr><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: '<w:document ' + W + '><w:body>' + tbl + '</w:body></w:document>' } });
    assert.equal(docx.procitaj(t.put).tabele[0][0].length, 63);
  } finally { t.ukloni(); }
});

test('xlsx: red ili kolona van granica Excela i previse celija je ostecen fajl', () => {
  const t = privremeni('a.xlsx');
  try {
    xlsxSaListom(t.put, '<row r="1"><c r="A2000000"><v>1</v></c></row>');
    assert.throws(() => xlsx.procitaj(t.put), { message: GRESKA_XLSX });
    xlsxSaListom(t.put, '<row r="1"><c r="XFE1"><v>1</v></c></row>');
    assert.throws(() => xlsx.procitaj(t.put), { message: GRESKA_XLSX });
    xlsxSaListom(t.put, '<row r="1048577"><c r="A1"><v>1</v></c></row>');
    assert.throws(() => xlsx.procitaj(t.put), { message: GRESKA_XLSX });
    // poslednja kolona Excela je dozvoljena
    xlsxSaListom(t.put, '<row r="1"><c r="XFD1"><v>1</v></c></row>');
    assert.equal(xlsx.procitaj(t.put).tabele[0][0].length, 16384);
    // 123 reda sa po 16384 celije prelaze 2.000.000 ukupno
    let redovi = '';
    for (let n = 1; n <= 123; n++) redovi += '<row r="' + n + '"><c r="XFD' + n + '"><v>1</v></c></row>';
    xlsxSaListom(t.put, redovi);
    assert.throws(() => xlsx.procitaj(t.put), { message: GRESKA_XLSX });
  } finally { t.ukloni(); }
});

test('xlsx: nevazeci datum vraca broj kao tekst, a 0x10 nije broj', () => {
  const t = privremeni('a.xlsx');
  try {
    const styles = '<styleSheet ' + NSX + '><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>';
    xlsxSaListom(t.put, '<row r="1"><c r="A1" s="1"><v>1e12</v></c><c r="B1" s="1"><v>0x10</v></c></row>', {
      'xl/styles.xml': { sadrzaj: styles },
    });
    assert.deepEqual(xlsx.procitaj(t.put).tabele[0], [['1000000000000', '0x10']]);
  } finally { t.ukloni(); }
});

test('xlsx: redosled listova prema rels, apsolutni Target, rich text i obican broj format', () => {
  const t = privremeni('a.xlsx');
  try {
    const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const wb = '<workbook ' + NSX + ' ' + R + '><sheets><sheet name="B" r:id="rId2"/><sheet name="A" r:id="rId1"/></sheets></workbook>';
    const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>';
    const list = (s) => '<worksheet ' + NSX + '><sheetData><row r="1"><c r="A1" t="s"><v>' + s + '</v></c><c r="B1" s="1"><v>41640</v></c></row></sheetData></worksheet>';
    const ss = '<sst ' + NSX + '><si><t>prvi</t></si><si><r><t>dru</t></r><r><rPr/><t>gi</t></r></si></sst>';
    // numFmt 0.00 nije datum, pa 41640 ostaje broj (negativna kontrola)
    const styles = '<styleSheet ' + NSX + '><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>';
    zip.napravi(t.put, {
      'xl/workbook.xml': { sadrzaj: wb },
      'xl/_rels/workbook.xml.rels': { sadrzaj: rels },
      'xl/sharedStrings.xml': { sadrzaj: ss },
      'xl/styles.xml': { sadrzaj: styles },
      'xl/worksheets/sheet1.xml': { sadrzaj: list(0) },
      'xl/worksheets/sheet2.xml': { sadrzaj: list(1) },
    });
    const d = xlsx.procitaj(t.put);
    assert.deepEqual(d.tabele, [[['drugi', '41640']], [['prvi', '41640']]]);
  } finally { t.ukloni(); }
});

test('citac: programska greska (TypeError) prolazi netaknuta, ne postaje poruka za korisnika', () => {
  const t = privremeni('a.docx');
  const orig = docx.procitaj;
  try {
    docxPrimer(t.put);
    docx.procitaj = () => { throw new TypeError('kvar u citacu'); };
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof TypeError && !(e instanceof GreskaKorisnika));
    docx.procitaj = () => { throw new Error('Poruka citaca.'); };
    assert.throws(() => citac.procitaj(t.put), (e) => e instanceof GreskaKorisnika && e.message === 'Poruka citaca.' && e.cause instanceof Error);
  } finally { docx.procitaj = orig; t.ukloni(); }
});

test('docx: ukupan broj celija je ogranicen (spojene celije se rasiruju)', () => {
  const t = privremeni('a.docx');
  try {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const tc = '<w:tc><w:tcPr><w:gridSpan w:val="63"/></w:tcPr><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc>';
    const dok = (n) => '<w:document ' + W + '><w:body><w:tbl><w:tr>' + tc.repeat(n) + '</w:tr></w:tbl></w:body></w:document>';
    // 31746 * 63 = 1999998 celija: prolazi; 31747 * 63 = 2000061: odbijeno
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: dok(31746) } });
    assert.equal(docx.procitaj(t.put).tabele[0][0].length, 1999998);
    zip.napravi(t.put, { 'word/document.xml': { sadrzaj: dok(31747) } });
    assert.throws(() => docx.procitaj(t.put), { message: 'Word dokument je oštećen (document.xml nije ispravan XML).' });
  } finally { t.ukloni(); }
});
