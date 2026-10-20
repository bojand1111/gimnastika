// Putanje do podataka. GIM_PODACI se cita pri svakom pozivu.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function fasciklaPodataka() {
  const dir = process.env.GIM_PODACI
    || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Gimnastika');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function putanjaBaze() {
  return path.join(fasciklaPodataka(), 'gimnastika.sqlite');
}

function fasciklaKopija() {
  return path.join(fasciklaPodataka(), 'kopije');
}

module.exports = { fasciklaPodataka, putanjaBaze, fasciklaKopija };
