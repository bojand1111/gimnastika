// Bira čitač po sadržaju fajla (docx ili xlsx), ne po ekstenziji.
const zip = require('./zip.cjs');
const docx = require('./docx.cjs');
const xlsx = require('./xlsx.cjs');
const { GreskaKorisnika } = require('../greska.cjs');

const EKSTENZIJE = ['docx', 'xlsx'];

function citaj(putanja) {
  let lista;
  try {
    lista = zip.lista(putanja);
  } catch (cause) {
    throw new GreskaKorisnika('Fajl nije Word (.docx) ni Excel (.xlsx) dokument. Skeniran PDF ili slika ne mogu da se uvezu.', { cause });
  }
  if (lista['word/document.xml']) return { ...docx.procitaj(putanja), vrsta: 'docx' };
  if (lista['xl/workbook.xml']) return { ...xlsx.procitaj(putanja), vrsta: 'xlsx' };
  throw new GreskaKorisnika('Fajl nije Word (.docx) ni Excel (.xlsx) dokument. Stari .doc i .xls prvo sačuvajte kao .docx ili .xlsx.');
}

// Vraća {tabele, tekst, vrsta: 'docx'|'xlsx'}. Greške čitača (zip, docx, xlsx bacaju običan Error
// sa porukom za korisnika) postaju GreskaKorisnika; programske greške (TypeError i slično) prolaze
// netaknute, da ih rukovalac zapiše u dnevnik.
function procitaj(putanja) {
  try {
    return citaj(putanja);
  } catch (err) {
    if (err.constructor !== Error) throw err;
    throw new GreskaKorisnika(err.message, { cause: err });
  }
}

module.exports = { procitaj, EKSTENZIJE };
