// Mali citac i pisac zip arhiva preko Node zlib-a. Metode store (0) i deflate (8), bez zip64.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const POTPIS_LOKALNI = 0x04034b50;
const POTPIS_CENTRALNI = 0x02014b50;
const POTPIS_KRAJ = 0x06054b50;
const NAJVECA_STAVKA = 50 * 1024 * 1024; // bajtova, i kompresovano i raspakovano

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosVreme(d) {
  const vreme = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const datum = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [vreme, datum];
}

function otvoriFajl(putanja) {
  try {
    return fs.readFileSync(putanja);
  } catch {
    throw new Error('Ne mogu da otvorim ' + path.basename(putanja));
  }
}

// stavke: {ime: {sadrzaj: string|Buffer}}
function napravi(putanja, stavke) {
  const delovi = [];
  const centralni = [];
  let ofset = 0;
  let broj = 0;
  const [dv, dd] = dosVreme(new Date());
  for (const [imeUlaz, stavka] of Object.entries(stavke)) {
    const ime = Buffer.from(imeUlaz.replaceAll('\\', '/'), 'utf8');
    const sadrzaj = stavka.sadrzaj ?? '';
    const podaci = Buffer.isBuffer(sadrzaj) ? sadrzaj : Buffer.from(sadrzaj, 'utf8');
    const crc = crc32(podaci);
    let metoda = 0;
    let komp = podaci;
    if (podaci.length > 0) {
      const d = zlib.deflateRawSync(podaci, { level: 6 });
      if (d.length < podaci.length) { metoda = 8; komp = d; }
    }
    const lok = Buffer.alloc(30);
    lok.writeUInt32LE(POTPIS_LOKALNI, 0);
    lok.writeUInt16LE(20, 4);
    lok.writeUInt16LE(0x0800, 6);
    lok.writeUInt16LE(metoda, 8);
    lok.writeUInt16LE(dv, 10);
    lok.writeUInt16LE(dd, 12);
    lok.writeUInt32LE(crc, 14);
    lok.writeUInt32LE(komp.length, 18);
    lok.writeUInt32LE(podaci.length, 22);
    lok.writeUInt16LE(ime.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(POTPIS_CENTRALNI, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(metoda, 10);
    cen.writeUInt16LE(dv, 12);
    cen.writeUInt16LE(dd, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(komp.length, 20);
    cen.writeUInt32LE(podaci.length, 24);
    cen.writeUInt16LE(ime.length, 28);
    cen.writeUInt32LE(ofset, 42);
    delovi.push(lok, ime, komp);
    centralni.push(cen, ime);
    ofset += 30 + ime.length + komp.length;
    broj++;
  }
  const cd = Buffer.concat(centralni);
  const kraj = Buffer.alloc(22);
  kraj.writeUInt32LE(POTPIS_KRAJ, 0);
  kraj.writeUInt16LE(broj, 8);
  kraj.writeUInt16LE(broj, 10);
  kraj.writeUInt32LE(cd.length, 12);
  kraj.writeUInt32LE(ofset, 16);
  try {
    fs.writeFileSync(putanja, Buffer.concat([...delovi, cd, kraj]));
  } catch {
    throw new Error('Ne mogu da upisem ' + path.basename(putanja));
  }
}

// Vraca {ime: {metoda, kduz, duz, ofset}}.
function lista(putanja) {
  const fajl = otvoriFajl(putanja);
  const rep = fajl.subarray(Math.max(0, fajl.length - (65536 + 22)));
  const poz = rep.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (poz < 0 || poz + 22 > rep.length) throw new Error('Fajl nije zip arhiva.');
  const broj = rep.readUInt16LE(poz + 10);
  const cdDuz = rep.readUInt32LE(poz + 12);
  const cdOfset = rep.readUInt32LE(poz + 16);
  const cd = fajl.subarray(cdOfset, cdOfset + cdDuz);
  const stavke = {};
  let p = 0;
  for (let i = 0; i < broj; i++) {
    if (p + 46 > cd.length || cd.readUInt32LE(p) !== POTPIS_CENTRALNI) {
      throw new Error('Ostecen centralni direktorijum zipa.');
    }
    const imeDuz = cd.readUInt16LE(p + 28);
    const extraDuz = cd.readUInt16LE(p + 30);
    const komDuz = cd.readUInt16LE(p + 32);
    const ime = cd.toString('utf8', p + 46, p + 46 + imeDuz);
    stavke[ime] = {
      metoda: cd.readUInt16LE(p + 10),
      kduz: cd.readUInt32LE(p + 20),
      duz: cd.readUInt32LE(p + 24),
      ofset: cd.readUInt32LE(p + 42),
    };
    p += 46 + imeDuz + extraDuz + komDuz;
  }
  return stavke;
}

// Vraca Buffer sa sadrzajem jedne stavke.
function procitaj(putanja, ime, spisak = null) {
  spisak ??= lista(putanja);
  const s = spisak[ime];
  if (!s) throw new Error('U arhivi nema stavke ' + ime);
  if (s.duz > NAJVECA_STAVKA || s.kduz > NAJVECA_STAVKA) throw new Error('Prevelika stavka u zipu: ' + ime);
  const fajl = otvoriFajl(putanja);
  if (s.ofset + 30 > fajl.length || fajl.readUInt32LE(s.ofset) !== POTPIS_LOKALNI) {
    throw new Error('Ostecen zapis u zipu: ' + ime);
  }
  const pocetak = s.ofset + 30 + fajl.readUInt16LE(s.ofset + 26) + fajl.readUInt16LE(s.ofset + 28);
  const komp = fajl.subarray(pocetak, pocetak + s.kduz);
  if (s.metoda === 0) return Buffer.from(komp);
  if (s.metoda === 8) {
    if (komp.length === 0) return Buffer.alloc(0);
    let izlaz;
    try {
      izlaz = zlib.inflateRawSync(komp, { maxOutputLength: s.duz });
    } catch {
      throw new Error('Ne mogu da raspakujem ' + ime);
    }
    if (izlaz.length !== s.duz) throw new Error('Ostecen zapis u zipu: ' + ime);
    return izlaz;
  }
  throw new Error('Nepodrzana metoda kompresije u zipu: ' + s.metoda);
}

module.exports = { lista, procitaj, napravi };
