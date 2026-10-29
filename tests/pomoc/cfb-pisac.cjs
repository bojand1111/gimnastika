// Mali pisac Compound File Binary (v3, sektori od 512 bajtova) samo za testove čitača .doc i .xls.
// Svi tokovi idu u obične sektore (dopunjeni do 4096 bajtova), bez mini toka.
const fs = require('node:fs');

const KRAJ = 0xfffffffe;
const SLOBODAN = 0xffffffff;
const FAT_SEKTOR = 0xfffffffd;

// tokovi: [[ime, Buffer], ...] redom; svi su deca korena.
function napravi(putanja, tokovi) {
  const podaci = tokovi.map(([ime, b]) => [ime, b.length >= 4096 ? b : Buffer.concat([b, Buffer.alloc(4096 - b.length)])]);
  const brojDir = Math.ceil((podaci.length + 1) / 4);
  const sektoriTokova = podaci.map(([, b]) => Math.ceil(b.length / 512));
  const ostalo = brojDir + sektoriTokova.reduce((a, b) => a + b, 0);
  let brojFat = 1;
  while (brojFat * 128 < brojFat + ostalo) brojFat++;
  if (brojFat > 109) throw new Error('prevelik test fajl');

  const fat = [];
  for (let i = 0; i < brojFat; i++) fat.push(FAT_SEKTOR);
  const lanac = (n) => {
    const pocetak = fat.length;
    for (let i = 0; i < n; i++) fat.push(i === n - 1 ? KRAJ : fat.length + 1);
    return pocetak;
  };
  const prviDir = lanac(brojDir);
  const pocetci = sektoriTokova.map((n) => lanac(n));
  while (fat.length < brojFat * 128) fat.push(SLOBODAN);

  const zapis = (ime, tip, pocetak, velicina, dete, desno) => {
    const z = Buffer.alloc(128);
    z.write(ime, 0, 'utf16le');
    z.writeUInt16LE((ime.length + 1) * 2, 64);
    z[66] = tip;
    z[67] = 1;
    z.writeUInt32LE(SLOBODAN, 68);
    z.writeUInt32LE(desno, 72);
    z.writeUInt32LE(dete, 76);
    z.writeUInt32LE(pocetak, 116);
    z.writeUInt32LE(velicina, 120);
    return z;
  };
  const dir = [zapis('Root Entry', 5, KRAJ, 0, podaci.length ? 1 : SLOBODAN, SLOBODAN)];
  podaci.forEach(([ime, b], i) => dir.push(zapis(ime, 2, pocetci[i], b.length, SLOBODAN, i + 1 < podaci.length ? i + 2 : SLOBODAN)));
  while (dir.length < brojDir * 4) {
    const z = Buffer.alloc(128);
    z.writeUInt32LE(SLOBODAN, 68); z.writeUInt32LE(SLOBODAN, 72); z.writeUInt32LE(SLOBODAN, 76);
    dir.push(z);
  }

  const h = Buffer.alloc(512);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(h, 0);
  h.writeUInt16LE(0x3e, 0x18);
  h.writeUInt16LE(3, 0x1a);
  h.writeUInt16LE(0xfffe, 0x1c);
  h.writeUInt16LE(9, 0x1e);
  h.writeUInt16LE(6, 0x20);
  h.writeUInt32LE(brojFat, 0x2c);
  h.writeUInt32LE(prviDir, 0x30);
  h.writeUInt32LE(4096, 0x38);
  h.writeUInt32LE(KRAJ, 0x3c);
  h.writeUInt32LE(KRAJ, 0x44);
  for (let i = 0; i < 109; i++) h.writeUInt32LE(i < brojFat ? i : SLOBODAN, 0x4c + i * 4);

  const fatB = Buffer.alloc(brojFat * 512);
  fat.forEach((v, i) => fatB.writeUInt32LE(v >>> 0, i * 4));
  const delovi = [h, fatB, Buffer.concat(dir)];
  podaci.forEach(([, b], i) => delovi.push(b, Buffer.alloc(sektoriTokova[i] * 512 - b.length)));
  fs.writeFileSync(putanja, Buffer.concat(delovi));
  return putanja;
}

// BIFF8 zapis: tip, duzina, podaci.
function zapisBiff(tip, podaci) {
  const z = Buffer.alloc(4);
  z.writeUInt16LE(tip, 0);
  z.writeUInt16LE(podaci.length, 2);
  return Buffer.concat([z, podaci]);
}

module.exports = { napravi, zapisBiff };
