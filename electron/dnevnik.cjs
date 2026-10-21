// Dnevnik u fascikli podataka: jedna linija po dogadjaju, vreme je UTC.
const fs = require('node:fs');
const path = require('node:path');
const { fasciklaPodataka } = require('./putanje.cjs');

function upisi(tekst) {
  const vreme = new Date().toISOString().slice(0, 19).replace('T', ' ');
  fs.appendFileSync(path.join(fasciklaPodataka(), 'dnevnik.log'), `${vreme} ${tekst}\n`);
}

function info(tekst) {
  upisi(tekst);
}

function greska(tekst, err) {
  upisi(`GRESKA ${tekst}${err ? `: ${err.stack || err.message || err}` : ''}`);
}

module.exports = { info, greska };
