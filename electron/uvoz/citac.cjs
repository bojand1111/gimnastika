// Bira čitač po sadržaju fajla, ne po ekstenziji: zip (docx, xlsx, odt, ods), stari Office
// (doc, xls) ili PDF. Za PDF vraća Promise (pdfjs čita asinhrono), za ostale odmah rezultat.
const fs = require('node:fs');
const zip = require('./zip.cjs');
const docx = require('./docx.cjs');
const xlsx = require('./xlsx.cjs');
const odf = require('./odf.cjs');
const cfb = require('./cfb.cjs');
const doc = require('./doc.cjs');
const xls = require('./xls.cjs');
const pdf = require('./pdf.cjs');
const { GreskaKorisnika } = require('../greska.cjs');

const EKSTENZIJE = ['docx', 'doc', 'xlsx', 'xls', 'odt', 'ods', 'pdf'];
const NIJE_PODRZAN = 'Fajl nije podržan dokument. Uvoze se Word (.docx, .doc), Excel (.xlsx, .xls), OpenDocument (.odt, .ods) i PDF sa tekstom; skenirani dokumenti i slike ne mogu.';

// Prvih 4 KB fajla (prazan Buffer ako fajl ne može da se pročita).
function pocetak(putanja) {
  try {
    const fd = fs.openSync(putanja, 'r');
    try {
      const b = Buffer.alloc(4096);
      return b.subarray(0, fs.readSync(fd, b, 0, b.length, 0));
    } finally { fs.closeSync(fd); }
  } catch {
    return Buffer.alloc(0);
  }
}

// Fajlovi koji imaju nastavak .doc ili .xls a nisu stari Office: RTF, web stranica, XML tabela.
function prepoznajTekstualni(b) {
  const s = b.toString('latin1').replace(/^\xef\xbb\xbf/, '').trimStart();
  if (s.startsWith('{\\rtf')) return 'Fajl je RTF dokument. Otvorite ga u Word-u i sačuvajte kao .docx pa ga uvezite ponovo.';
  if (/^<\?xml[^>]*>\s*(<\?mso-application progid="Excel\.Sheet"\?>|<Workbook)/i.test(s)) {
    return 'Fajl je Excel XML tabela (2003). Otvorite ga u Excel-u i sačuvajte kao .xlsx pa ga uvezite ponovo.';
  }
  if (/^(<!doctype html|<html|<\?xml[^>]*>\s*<html|<table|<meta)/i.test(s)) {
    return 'Fajl je web stranica (HTML), iako ima nastavak Word ili Excel fajla. Otvorite ga u Word-u ili Excel-u i sačuvajte kao .docx ili .xlsx pa ga uvezite ponovo.';
  }
  return null;
}

function citajZip(putanja) {
  let lista;
  try {
    lista = zip.lista(putanja);
  } catch (cause) {
    throw new GreskaKorisnika('Fajl je oštećen. ' + NIJE_PODRZAN, { cause });
  }
  if (lista['word/document.xml']) return { ...docx.procitaj(putanja), vrsta: 'docx' };
  if (lista['xl/workbook.xml']) return { ...xlsx.procitaj(putanja), vrsta: 'xlsx' };
  if (odf.vrsta(putanja, lista) !== null) return odf.procitaj(putanja);
  throw new GreskaKorisnika(NIJE_PODRZAN);
}

function citajCfb(putanja) {
  const c = cfb.otvori(putanja);
  if (c.ima('EncryptedPackage')) {
    throw new GreskaKorisnika('Dokument je zaštićen lozinkom. Sačuvajte ga bez lozinke pa ga uvezite ponovo.');
  }
  if (c.ima('WordDocument')) return { ...doc.procitaj(putanja), vrsta: 'doc' };
  if (c.ima('Workbook') || c.ima('Book')) return { ...xls.procitaj(putanja), vrsta: 'xls' };
  throw new Error('Fajl je stari Office dokument, ali nije Word ni Excel. ' + NIJE_PODRZAN);
}

// Greške čitača (običan Error sa porukom za korisnika) postaju GreskaKorisnika; programske greške
// (TypeError i slično) prolaze netaknute, da ih rukovalac zapiše u dnevnik.
function omotaj(err) {
  if (err.constructor !== Error) return err;
  return new GreskaKorisnika(err.message, { cause: err });
}

function citaj(putanja) {
  const b = pocetak(putanja);
  if (b.length === 0) {
    try {
      fs.accessSync(putanja, fs.constants.R_OK);
    } catch (cause) {
      throw new GreskaKorisnika('Ne mogu da otvorim fajl. ' + NIJE_PODRZAN, { cause });
    }
    throw new GreskaKorisnika('Fajl je prazan.');
  }
  if (b[0] === 0x50 && b[1] === 0x4b) return citajZip(putanja);
  if (cfb.jeCfb(putanja)) return citajCfb(putanja);
  if (b.subarray(0, 1024).includes('%PDF-')) {
    return pdf.procitaj(putanja).then((d) => ({ ...d, vrsta: 'pdf' }), (err) => { throw omotaj(err); });
  }
  const poruka = prepoznajTekstualni(b);
  throw new GreskaKorisnika(poruka ?? NIJE_PODRZAN);
}

// Vraća {tabele, tekst, vrsta: 'docx'|'doc'|'xlsx'|'xls'|'odt'|'ods'} ili, za PDF,
// Promise<{tabele, tekst, vrsta: 'pdf'}>.
function procitaj(putanja) {
  try {
    return citaj(putanja);
  } catch (err) {
    throw omotaj(err);
  }
}

module.exports = { procitaj, EKSTENZIJE };
