// Čitač starih Office fajlova (.doc, .xls): Compound File Binary, "fajl sistem u fajlu" sa
// sektorima, FAT tabelom i direktorijumom. Vraća tokove (streams) iz korena po imenu.
const fs = require('node:fs');
const path = require('node:path');

const POTPIS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const NAJVECI_FAJL = 200 * 1024 * 1024; // bajtova, kao kod zipa
const NAJVECI_TOK = 50 * 1024 * 1024;
const KRAJ_LANCA = 0xfffffffe;
const SLOBODAN = 0xffffffff;
const OSTECEN = 'Fajl je oštećen (neispravna struktura starog Office formata).';

function jeCfb(putanja) {
  try {
    const fd = fs.openSync(putanja, 'r');
    try {
      const b = Buffer.alloc(8);
      return fs.readSync(fd, b, 0, 8, 0) === 8 && b.equals(POTPIS);
    } finally { fs.closeSync(fd); }
  } catch {
    return false;
  }
}

function otvori(putanja) {
  let fajl;
  try {
    if (fs.statSync(putanja).size > NAJVECI_FAJL) throw new Error('Fajl je prevelik.');
    fajl = fs.readFileSync(putanja);
  } catch (e) {
    if (e.message === 'Fajl je prevelik.') throw e;
    throw new Error('Ne mogu da otvorim ' + path.basename(putanja));
  }
  if (fajl.length < 512 || !fajl.subarray(0, 8).equals(POTPIS)) throw new Error('Fajl nije stari Office dokument.');
  const pomak = fajl.readUInt16LE(0x1e);
  const miniPomak = fajl.readUInt16LE(0x20);
  if ((pomak !== 9 && pomak !== 12) || miniPomak !== 6) throw new Error(OSTECEN);
  const velSek = 1 << pomak;
  const brojSektora = Math.ceil((fajl.length - velSek) / velSek);

  function sektor(n) {
    const o = (n + 1) * velSek;
    if (n >= brojSektora || o >= fajl.length) throw new Error(OSTECEN);
    return fajl.subarray(o, Math.min(o + velSek, fajl.length));
  }

  // DIFAT: spisak FAT sektora (109 u zaglavlju, ostatak u lancu DIFAT sektora).
  const fatSektori = [];
  for (let i = 0; i < 109; i++) {
    const s = fajl.readUInt32LE(0x4c + i * 4);
    if (s !== SLOBODAN) fatSektori.push(s);
  }
  let dif = fajl.readUInt32LE(0x44);
  for (let k = 0; dif !== KRAJ_LANCA && dif !== SLOBODAN; k++) {
    if (k > brojSektora) throw new Error(OSTECEN);
    const b = sektor(dif);
    for (let i = 0; i < velSek / 4 - 1; i++) {
      const s = b.readUInt32LE(i * 4);
      if (s !== SLOBODAN) fatSektori.push(s);
    }
    dif = b.readUInt32LE(velSek - 4);
  }
  if (fatSektori.length > brojSektora) throw new Error(OSTECEN);
  const fat = [];
  for (const s of fatSektori) {
    const b = sektor(s);
    for (let i = 0; i + 4 <= b.length; i += 4) fat.push(b.readUInt32LE(i));
  }

  function lanac(pocetak, tabela, najvise) {
    const izlaz = [];
    for (let s = pocetak; s !== KRAJ_LANCA; s = tabela[s]) {
      if (s === SLOBODAN || s >= tabela.length || izlaz.length > najvise) throw new Error(OSTECEN);
      izlaz.push(s);
    }
    return izlaz;
  }

  // velicina null: ceo lanac (direktorijum nema zapisanu velicinu)
  function tokIzSektora(pocetak, velicina) {
    const delovi = lanac(pocetak, fat, brojSektora).map(sektor);
    const b = Buffer.concat(delovi);
    if (velicina === null) return b;
    if (b.length < velicina) throw new Error(OSTECEN);
    return b.subarray(0, velicina);
  }

  // Direktorijum: zapisi od 128 bajtova.
  const dir = tokIzSektora(fajl.readUInt32LE(0x30), null);
  const zapisi = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const duz = Math.min(64, dir.readUInt16LE(o + 64));
    zapisi.push({
      ime: dir.toString('utf16le', o, o + Math.max(0, duz - 2)),
      tip: dir[o + 66],
      levo: dir.readUInt32LE(o + 68),
      desno: dir.readUInt32LE(o + 72),
      dete: dir.readUInt32LE(o + 76),
      pocetak: dir.readUInt32LE(o + 116),
      velicina: dir.readUInt32LE(o + 120),
    });
  }
  const koren = zapisi[0];
  if (!koren || koren.tip !== 5) throw new Error(OSTECEN);

  const granica = fajl.readUInt32LE(0x38);
  let mini = null;
  let miniFat = null;
  function miniTok(pocetak, velicina) {
    if (mini === null) {
      mini = koren.velicina > 0 ? tokIzSektora(koren.pocetak, koren.velicina) : Buffer.alloc(0);
      const mf = fajl.readUInt32LE(0x3c);
      const b = mf === KRAJ_LANCA || mf === SLOBODAN ? Buffer.alloc(0) : Buffer.concat(lanac(mf, fat, brojSektora).map(sektor));
      miniFat = [];
      for (let i = 0; i + 4 <= b.length; i += 4) miniFat.push(b.readUInt32LE(i));
    }
    const delovi = lanac(pocetak, miniFat, mini.length >> 6).map((s) => {
      if ((s + 1) << 6 > mini.length) throw new Error(OSTECEN);
      return mini.subarray(s << 6, (s + 1) << 6);
    });
    const b = Buffer.concat(delovi);
    if (b.length < velicina) throw new Error(OSTECEN);
    return b.subarray(0, velicina);
  }

  // Deca korena (crveno-crno stablo preko levo/desno), samo tokovi.
  const tokovi = new Map();
  const videno = new Set();
  const stek = [koren.dete];
  while (stek.length > 0) {
    const i = stek.pop();
    if (i === SLOBODAN || i >= zapisi.length || videno.has(i)) continue;
    videno.add(i);
    const z = zapisi[i];
    if (z.tip === 2) tokovi.set(z.ime.toLowerCase(), z);
    stek.push(z.levo, z.desno);
  }

  return {
    ima: (ime) => tokovi.has(ime.toLowerCase()),
    // Ceo tok kao Buffer; null ako ga nema.
    tok(ime) {
      const z = tokovi.get(ime.toLowerCase());
      if (!z) return null;
      if (z.velicina > NAJVECI_TOK) throw new Error('Fajl je prevelik.');
      if (z.velicina === 0) return Buffer.alloc(0);
      return z.velicina < granica ? miniTok(z.pocetak, z.velicina) : tokIzSektora(z.pocetak, z.velicina);
    },
  };
}

module.exports = { jeCfb, otvori };
