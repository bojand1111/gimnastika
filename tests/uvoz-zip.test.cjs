const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zip = require('../electron/uvoz/zip.cjs');

function privremeni(ime) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-zip-'));
  return { dir, put: path.join(dir, ime), ukloni: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('zip: napravi pa lista ima imena i metode, procitaj vraca isti sadrzaj', () => {
  const t = privremeni('a.zip');
  try {
    const tekst = 'Žaklina Đurđević, šuma čežnje ćuti. '.repeat(20);
    const binarni = crypto.randomBytes(70000);
    zip.napravi(t.put, {
      'a.txt': { sadrzaj: 'x' },
      'čitaj/šuma.txt': { sadrzaj: tekst },
      'prazno.txt': { sadrzaj: '' },
      'bin/nasumicno.bin': { sadrzaj: binarni },
    });
    const lista = zip.lista(t.put);
    assert.deepEqual(Object.keys(lista), ['a.txt', 'čitaj/šuma.txt', 'prazno.txt', 'bin/nasumicno.bin']);
    assert.equal(lista['a.txt'].metoda, 0);
    assert.equal(lista['čitaj/šuma.txt'].metoda, 8);
    assert.equal(lista['bin/nasumicno.bin'].metoda, 0);
    assert.equal(lista['bin/nasumicno.bin'].duz, 70000);
    assert.equal(zip.procitaj(t.put, 'a.txt').toString('utf8'), 'x');
    assert.equal(zip.procitaj(t.put, 'čitaj/šuma.txt', lista).toString('utf8'), tekst);
    assert.equal(zip.procitaj(t.put, 'prazno.txt').length, 0);
    assert.ok(zip.procitaj(t.put, 'bin/nasumicno.bin').equals(binarni));
  } finally { t.ukloni(); }
});

test('zip: fajl koji nije zip', () => {
  const t = privremeni('a.pdf');
  try {
    fs.writeFileSync(t.put, '%PDF-1.4 nije zip');
    assert.throws(() => zip.lista(t.put), { message: 'Fajl nije zip arhiva.' });
    fs.writeFileSync(t.put, '');
    assert.throws(() => zip.lista(t.put), { message: 'Fajl nije zip arhiva.' });
  } finally { t.ukloni(); }
});

test('zip: nepostojeca stavka i nepostojeci fajl', () => {
  const t = privremeni('a.zip');
  try {
    zip.napravi(t.put, { 'a.txt': { sadrzaj: 'x' } });
    assert.throws(() => zip.procitaj(t.put, 'x'), { message: 'U arhivi nema stavke x' });
    assert.throws(() => zip.lista(path.join(t.dir, 'nema.zip')), { message: 'Ne mogu da otvorim nema.zip' });
  } finally { t.ukloni(); }
});

test('zip: nepodrzana metoda, ostecen zapis, deflate i centralni direktorijum', () => {
  const t = privremeni('a.zip');
  try {
    zip.napravi(t.put, { 'a.txt': { sadrzaj: 'x' }, 'b.txt': { sadrzaj: 'abc'.repeat(100) } });
    const orig = fs.readFileSync(t.put);
    const cd = orig.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    const m = Buffer.from(orig);
    m.writeUInt16LE(12, cd + 10);
    fs.writeFileSync(t.put, m);
    assert.throws(() => zip.procitaj(t.put, 'a.txt'), { message: 'Nepodrzana metoda kompresije u zipu: 12' });
    const l = Buffer.from(orig);
    l.writeUInt32LE(0, 0);
    fs.writeFileSync(t.put, l);
    assert.throws(() => zip.procitaj(t.put, 'a.txt'), { message: 'Ostecen zapis u zipu: a.txt' });
    fs.writeFileSync(t.put, orig);
    const lista = zip.lista(t.put);
    const d = Buffer.from(orig);
    const poc = lista['b.txt'].ofset + 30 + 'b.txt'.length;
    d.fill(0xff, poc, poc + 4);
    fs.writeFileSync(t.put, d);
    assert.throws(() => zip.procitaj(t.put, 'b.txt'), { message: 'Ne mogu da raspakujem b.txt' });
    const c = Buffer.from(orig);
    c.writeUInt32LE(0, cd);
    fs.writeFileSync(t.put, c);
    assert.throws(() => zip.lista(t.put), { message: 'Ostecen centralni direktorijum zipa.' });
  } finally { t.ukloni(); }
});

test('zip: ogranicenje velicine stavke i provera deklarisane duzine', () => {
  const t = privremeni('a.zip');
  try {
    zip.napravi(t.put, { 'a.txt': { sadrzaj: 'x' }, 'b.txt': { sadrzaj: 'abc'.repeat(100) } });
    const orig = fs.readFileSync(t.put);
    const cd = orig.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    // a.txt je store, zaglavlje tvrdi 100 MB
    const velika = Buffer.from(orig);
    velika.writeUInt32LE(100 * 1024 * 1024, cd + 24);
    fs.writeFileSync(t.put, velika);
    assert.throws(() => zip.procitaj(t.put, 'a.txt'), { message: 'Prevelika stavka u zipu: a.txt' });
    // b.txt je deflate, zaglavlje potcenjuje duzinu za 1 bajt
    const cd2 = cd + 46 + 'a.txt'.length;
    const mala = Buffer.from(orig);
    mala.writeUInt32LE(299, cd2 + 24);
    fs.writeFileSync(t.put, mala);
    assert.throws(() => zip.procitaj(t.put, 'b.txt'), { message: 'Ne mogu da raspakujem b.txt' });
  } finally { t.ukloni(); }
});
