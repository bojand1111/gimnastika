import test from 'node:test';
import assert from 'node:assert/strict';
import { koraci } from '../src/koraciStanje.js';

const st = (o) => ({ prijava: 0, nepotpune: 0, nerasporedjeni: 0, nepotvrdjeni_klubovi: 0, korak: 'prijave', ...o });
const stanja = (k) => k.map((x) => x.stanje);

test('koraci: linkovi bez pola', () => {
  const k = koraci({ prijava: 5, nepotpune: 0, nerasporedjeni: 0, nepotvrdjeni_klubovi: 0 }, 'prijave', 7);
  for (const korak of k) assert.ok(!String(korak.link).includes('pol'), korak.kljuc);
});

test('koraci: bez takmicenja (nova forma)', () => {
  const k = koraci(null, 'podaci', null);
  assert.deepEqual(k.map((x) => x.kljuc), ['podaci', 'prijave', 'rotacije', 'pregled']);
  assert.deepEqual(k.map((x) => x.naslov), ['Podaci', 'Prijave', 'Rotacije', 'Pregled takmičenja']);
  assert.equal(k[0].opis, 'naziv, datum, pravila');
  assert.equal(k[1].opis, 'još nema prijava');
  assert.equal(k[2].opis, 'posle prijava');
  assert.equal(k[3].opis, 'unos ocena i rang liste');
  assert.deepEqual(k.map((x) => x.link), [null, null, null, null]);
  assert.deepEqual(stanja(k), ['', '', '', '']);
});

test('koraci: prijave 0 sa takmicenjem', () => {
  const k = koraci(st({}), 'podaci', 7);
  assert.equal(k[0].opis, 'uneti');
  assert.equal(k[0].link, '#/takmicenja/izmeni?id=7');
  assert.equal(k[1].link, '#/prijave');
  assert.equal(k[2].link, '#/rotacije');
  assert.deepEqual(stanja(k), ['ok', 'fali', 'fali', '']);
});

test('koraci: nepotpune 2 i nepotvrdjeni 1', () => {
  const k = koraci(st({ prijava: 5, nepotpune: 2, nepotvrdjeni_klubovi: 1, nerasporedjeni: 3 }), 'prijave', 7);
  assert.equal(k[1].opis, 'prijava: 5 · nepotpune: 2 · nepotvrđeni klubovi: 1');
  assert.equal(k[2].opis, 'neraspoređeni: 3');
  assert.deepEqual(stanja(k), ['ok', 'fali', 'fali', '']);
});

test('koraci: samo nepotvrdjeni klubovi ostaju fali, bez nepotpunih nema tog dela opisa', () => {
  const k = koraci(st({ prijava: 4, nepotvrdjeni_klubovi: 2 }), 'prijave', 1);
  assert.equal(k[1].opis, 'prijava: 4 · nepotvrđeni klubovi: 2');
  assert.equal(k[1].stanje, 'fali');
  assert.equal(k[2].opis, 'svi su raspoređeni');
  assert.equal(k[2].stanje, 'ok');
});

test('koraci: spremno', () => {
  const k = koraci(st({ prijava: 6, korak: 'spremno' }), 'pregled', 7);
  assert.equal(k[1].opis, 'prijava: 6');
  assert.equal(k[2].opis, 'svi su raspoređeni');
  assert.deepEqual(stanja(k), ['ok', 'ok', 'ok', '']);
});

test('koraci: tekuci je tacno jedan i prati zadati kljuc', () => {
  const k = koraci(st({ prijava: 2 }), 'rotacije', 3);
  assert.deepEqual(k.map((x) => x.tekuci), [false, false, true, false]);
  assert.deepEqual(koraci(null, 'podaci', null).map((x) => x.tekuci), [true, false, false, false]);
  assert.deepEqual(koraci(null, 'nepoznato', null).map((x) => x.tekuci), [false, false, false, false]);
});
