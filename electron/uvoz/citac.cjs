// Bira čitač po sadržaju fajla (docx ili xlsx), ne po ekstenziji.
const zip = require('./zip.cjs');
const docx = require('./docx.cjs');
const xlsx = require('./xlsx.cjs');

const EKSTENZIJE = ['docx', 'xlsx'];

// Vraća {tabele, tekst, vrsta: 'docx'|'xlsx'}.
function procitaj(putanja) {
  let lista;
  try {
    lista = zip.lista(putanja);
  } catch {
    throw new Error('Fajl nije Word (.docx) ni Excel (.xlsx) dokument. Skeniran PDF ili slika ne mogu da se uvezu.');
  }
  if (lista['word/document.xml']) return { ...docx.procitaj(putanja), vrsta: 'docx' };
  if (lista['xl/workbook.xml']) return { ...xlsx.procitaj(putanja), vrsta: 'xlsx' };
  throw new Error('Fajl nije Word (.docx) ni Excel (.xlsx) dokument. Stari .doc i .xls prvo sačuvajte kao .docx ili .xlsx.');
}

module.exports = { procitaj, EKSTENZIJE };
