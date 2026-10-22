const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zip = require('../electron/uvoz/zip.cjs');
const docx = require('../electron/uvoz/docx.cjs');
const xlsx = require('../electron/uvoz/xlsx.cjs');
const citac = require('../electron/uvoz/citac.cjs');
const { docxPrimer, xlsxPrimer } = require('./pomoc/uzorci.cjs');

const FAJLOVI = path.join(__dirname, 'fajlovi');
const NIJE_WORD = 'Fajl nije Word (.docx) ni Excel (.xlsx) dokument.';

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

test('citac: odbija tudj fajl', () => {
  const t = privremeni('a.pdf');
  try {
    fs.writeFileSync(t.put, '%PDF-1.4 nije zip');
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.includes('nije Word') && e.message.includes('Skeniran PDF'));
    zip.napravi(t.put, { 'a.txt': { sadrzaj: 'x' } });
    assert.throws(() => citac.procitaj(t.put), (e) => e.message.includes('.doc i .xls'));
    assert.throws(() => citac.procitaj(t.put + '.nema'), (e) => e.message.startsWith(NIJE_WORD));
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

test('xlsx: poruke gresaka, apsolutni Target, bez rels, datumi i tipovi', () => {
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
