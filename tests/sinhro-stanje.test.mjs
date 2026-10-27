import test from 'node:test';
import assert from 'node:assert/strict';
import { tekstStanja, vremeLokalno } from '../src/ekrani/sinhroStanje.js';

const st = (extra = {}) => ({ ukljuceno: true, poslednje: '', cekaSlanje: false, uToku: false, greska: '', ...extra });

test('tekstStanja: isključeno kad nije uključeno (i bez stanja)', () => {
  assert.equal(tekstStanja(st({ ukljuceno: false, greska: 'x', uToku: true })), 'isključeno');
  assert.equal(tekstStanja(null), 'isključeno');
});

test('tekstStanja: prioritet uToku > greska > cekaSlanje > poslato', () => {
  assert.equal(tekstStanja(st({ uToku: true, greska: 'x', cekaSlanje: true })), 'slanje u toku');
  assert.equal(tekstStanja(st({ greska: 'Sajt nije dostupan.', cekaSlanje: true, poslednje: '2026-10-27 10:00:00' })), 'greška: Sajt nije dostupan.');
  assert.equal(tekstStanja(st({ cekaSlanje: true, poslednje: '2026-10-27 10:00:00' })), 'čeka slanje');
  assert.equal(tekstStanja(st()), 'čeka slanje');
});

test('tekstStanja: poslato u lokalnom vremenu iz UTC teksta', () => {
  const d = new Date('2026-10-27T10:05:09Z');
  const p = (n) => String(n).padStart(2, '0');
  const ocekivano = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}. ${p(d.getHours())}:${p(d.getMinutes())}`;
  assert.equal(tekstStanja(st({ poslednje: '2026-10-27 10:05:09' })), `poslato ${ocekivano}`);
  assert.match(vremeLokalno('2026-01-02 03:04:05'), /^\d\d\.\d\d\.\d{4}\. \d\d:\d\d$/);
});
