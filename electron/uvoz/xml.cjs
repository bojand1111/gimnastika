// Zajednički pomoćnici za čitanje XML-a iz docx i xlsx (fast-xml-parser, uređeno stablo).
const { XMLParser, XMLValidator } = require('fast-xml-parser');

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: false,
  parseTagValue: false,
  processEntities: true,
});

// Vraća uređeno stablo ili null ako XML nije ispravan.
function razberi(bafer) {
  let tekst = bafer.toString('utf8');
  if (tekst.charCodeAt(0) === 0xfeff) tekst = tekst.slice(1);
  if (XMLValidator.validate(tekst) !== true) return null;
  try {
    return parser.parse(tekst);
  } catch {
    return null;
  }
}

// Ime elementa (tekst i atributi nisu elementi).
function ime(cvor) {
  for (const k of Object.keys(cvor)) if (k !== ':@' && k !== '#text') return k;
  return null;
}

function deca(cvor) {
  const i = ime(cvor);
  return i === null ? [] : cvor[i];
}

function atribut(cvor, naziv) {
  const a = cvor[':@'];
  return a && a['@_' + naziv] !== undefined ? String(a['@_' + naziv]) : null;
}

// Svi potomci (redom dokumenta) kao spisak čvorova elemenata.
function potomci(cvor, izlaz = []) {
  for (const d of deca(cvor)) {
    if (ime(d) === null) continue;
    izlaz.push(d);
    potomci(d, izlaz);
  }
  return izlaz;
}

// Sav tekst direktno ispod elementa.
function tekstElementa(cvor) {
  let s = '';
  for (const d of deca(cvor)) if (d['#text'] !== undefined) s += String(d['#text']);
  return s;
}

// Ime bez prefiksa imenskog prostora.
function lokalno(naziv) {
  const i = naziv.indexOf(':');
  return i < 0 ? naziv : naziv.slice(i + 1);
}

module.exports = { razberi, ime, deca, atribut, potomci, tekstElementa, lokalno };
