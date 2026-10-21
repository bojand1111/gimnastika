// Dnevnik u fascikli podataka: jedna linija po dogadjaju, vreme je UTC.
const fs = require('node:fs');
const path = require('node:path');
const { fasciklaPodataka } = require('./putanje.cjs');

function upisi(tekst) {
  const vreme = new Date().toISOString().slice(0, 19).replace('T', ' ');
  try {
    fs.appendFileSync(path.join(fasciklaPodataka(), 'dnevnik.log'), `${vreme} ${tekst}\n`);
  } catch (err) {
    // Neuspeo upis ne sme da obori pozivaoca; ispis ide na stderr.
    console.error(`dnevnik: upis nije uspeo (${err.message}): ${tekst}`);
  }
}

function info(tekst) {
  upisi(tekst);
}

function greska(tekst, err) {
  upisi(`GRESKA ${tekst}${err ? `: ${err.stack || err.message || err}` : ''}`);
}

module.exports = { info, greska };
