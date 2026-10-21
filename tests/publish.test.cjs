const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spisakFajlova, citajToken } = require('../installer/github.cjs');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gim-pub-')); }
const IMENA = ['Gimnastika-Setup-0.1.0.exe', 'Gimnastika-Setup-0.1.0.exe.blockmap', 'latest.yml'];

test('spisakFajlova vraca tri imena kad postoje', () => {
  const d = tmp();
  for (const i of IMENA) fs.writeFileSync(path.join(d, i), 'x');
  assert.deepEqual(spisakFajlova(d, '0.1.0'), IMENA);
  fs.rmSync(d, { recursive: true });
});

test('spisakFajlova baca sa imenom fajla koji fali', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, IMENA[0]), 'x');
  fs.writeFileSync(path.join(d, IMENA[2]), 'x');
  assert.throws(() => spisakFajlova(d, '0.1.0'), /Gimnastika-Setup-0\.1\.0\.exe\.blockmap/);
  fs.rmSync(d, { recursive: true });
});

test('citajToken baca poruku sa putanjom kad fajla nema', () => {
  const p = path.join(tmp(), 'nema.txt');
  assert.throws(() => citajToken(p), (e) => e.message.includes(p));
});

test('citajToken vraca sadrzaj bez razmaka', () => {
  const d = tmp(), p = path.join(d, 't.txt');
  fs.writeFileSync(p, ' abc123\n');
  assert.equal(citajToken(p), 'abc123');
  fs.rmSync(d, { recursive: true });
});

test('citajToken baca na prazan fajl, bez ispisa sadrzaja', () => {
  const d = tmp(), p = path.join(d, 't.txt');
  fs.writeFileSync(p, '  \n');
  assert.throws(() => citajToken(p), /prazan/);
  fs.rmSync(d, { recursive: true });
});
