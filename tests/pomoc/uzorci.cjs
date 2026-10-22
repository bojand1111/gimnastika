// Sintetički docx i xlsx uzorci za testove čitača (port uvoz_docx_primer i uvoz_xlsx_primer).
const zip = require('../../electron/uvoz/zip.cjs');

function xml(t) {
  return t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function docxPrimer(putanja) {
  const p = (t) => '<w:p><w:r><w:t xml:space="preserve">' + xml(t) + '</w:t></w:r></w:p>';
  const tc = (t, span = 1) => '<w:tc>' + (span > 1 ? '<w:tcPr><w:gridSpan w:val="' + span + '"/></w:tcPr>' : '') + p(t) + '</w:tc>';
  const tr = (...celije) => '<w:tr>' + celije.join('') + '</w:tr>';
  const telo = p('I KOLO PGL VOJVODINE MSG A, B i C') + p('DEFINITIVNA I IMENIČNA PRIJAVA')
    + '<w:tbl>' + tr(tc('Klub'), tc('G.D.“PARTIZAN –ŽELJEZNIČAR“')) + tr(tc('Kontakt osoba'), tc('Robert M.')) + '</w:tbl>'
    + '<w:tbl>'
    + tr(tc('#'), tc('PREZIME'), tc('IME'), tc('KATEGORIJA'), '<w:tc>' + p('DATUM') + p('ROĐENJA') + '</w:tc>', tc('FUNKCIJA-EKIPA'))
    + tr(tc('1.'), tc('Neorčić'), '<w:tc><w:p><w:r><w:t>No</w:t></w:r><w:r><w:t>ah</w:t></w:r></w:p></w:tc>', tc('I “B”'), tc('12.02.2017.'), tc('pojedinac'))
    + tr(tc('2.'), tc('Herceg'), tc('Aron'), tc('IV “A”'), tc('25.04.2012..'), tc('ekipa'))
    + tr(tc('3.'), tc('Laudis Nanaši'), tc('Dragan'), tc('IV “A”'), tc('14.11.2012.'), tc(''))
    + tr(tc('4.'), tc(''), tc(''), tc(''), tc(''), tc(''))
    + tr(tc('napomena preko dve kolone', 2), tc(''), tc(''), tc(''), tc(''))
    + '</w:tbl>';
  const dok = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + telo + '<w:sectPr/></w:body></w:document>';
  zip.napravi(putanja, { '[Content_Types].xml': { sadrzaj: '<Types/>' }, 'word/document.xml': { sadrzaj: dok } });
  return putanja;
}

function xlsxPrimer(putanja) {
  const deljeni = ['Klub', 'SD „Vojvodina“', 'Prezime', 'Ime', 'Kategorija', 'Datum rođenja', 'Učešće', 'Petrović', 'Mina', 'II A', 'ekipa'];
  const ss = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + deljeni.map((s) => '<si><t>' + xml(s) + '</t></si>').join('') + '</sst>';
  const styles = '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy\\."/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>';
  const s = (r, i) => '<c r="' + r + '" t="s"><v>' + i + '</v></c>';
  const list = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + '<row r="1">' + s('A1', 0) + s('B1', 1) + '</row>'
    + '<row r="3">' + s('A3', 2) + s('B3', 3) + s('C3', 4) + s('D3', 5) + s('E3', 6) + '</row>'
    + '<row r="4">' + s('A4', 7) + s('B4', 8) + s('C4', 9) + '<c r="D4" s="2"><v>41640</v></c>' + s('E4', 10) + '</row>'
    + '<row r="5"><c r="A5" t="inlineStr"><is><t>Jović</t></is></c><c r="B5" t="inlineStr"><is><t>Lena</t></is></c><c r="D5"><v>2013</v></c></row>'
    + '</sheetData></worksheet>';
  const wb = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Prijava" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  zip.napravi(putanja, {
    '[Content_Types].xml': { sadrzaj: '<Types/>' },
    'xl/workbook.xml': { sadrzaj: wb },
    'xl/_rels/workbook.xml.rels': { sadrzaj: rels },
    'xl/sharedStrings.xml': { sadrzaj: ss },
    'xl/styles.xml': { sadrzaj: styles },
    'xl/worksheets/sheet1.xml': { sadrzaj: list },
  });
  return putanja;
}

module.exports = { docxPrimer, xlsxPrimer };
