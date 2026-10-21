import test from 'node:test';
import assert from 'node:assert/strict';
import { datumParsiraj, datumPrikaz, danas, razlikaDana } from '../electron/racun/datum.mjs';

test('datumParsiraj: podrzani formati', () => {
  assert.equal(datumParsiraj('17.10.2026.'), '2026-10-17');
  assert.equal(datumParsiraj('17.10.2026'), '2026-10-17');
  assert.equal(datumParsiraj('17102026'), '2026-10-17');
  assert.equal(datumParsiraj('7.3.2026'), '2026-03-07');
  assert.equal(datumParsiraj('2026-10-17'), '2026-10-17');
  assert.equal(datumParsiraj('  17.10.2026. '), '2026-10-17');
});

test('datumParsiraj: prazno je null', () => {
  assert.equal(datumParsiraj(''), null);
  assert.equal(datumParsiraj('   '), null);
});

test('datumParsiraj: neispravno je false, bez prelivanja', () => {
  assert.equal(datumParsiraj('31.02.2027'), false);
  assert.equal(datumParsiraj('2026-13-01'), false);
  assert.equal(datumParsiraj('2027-02-29'), false);
  assert.equal(datumParsiraj('abc'), false);
  assert.equal(datumParsiraj('1.1.26'), false);
  assert.equal(datumParsiraj('0000-01-01'), false);
  assert.equal(datumParsiraj('29.02.2028'), '2028-02-29');
});

test('datumPrikaz', () => {
  assert.equal(datumPrikaz('2026-10-17'), '17.10.2026.');
  assert.equal(datumPrikaz('2026-10-17', false), '17.10.2026');
  assert.equal(datumPrikaz(null), '');
  assert.equal(datumPrikaz(''), '');
  assert.equal(datumPrikaz('0000-00-00'), '');
});

test('danas: lokalni datum gggg-mm-dd', () => {
  assert.match(danas(), /^\d{4}-\d{2}-\d{2}$/);
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  assert.equal(danas(), `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
});

test('razlikaDana: kalendarski dani, bez letnjeg vremena', () => {
  assert.equal(razlikaDana('2026-10-17', '2026-10-25'), 8);
  assert.equal(razlikaDana('2026-03-28', '2026-03-30'), 2);
  assert.equal(razlikaDana('2026-10-24', '2026-10-26'), 2);
  assert.equal(razlikaDana('2026-10-25', '2026-10-17'), -8);
  assert.equal(razlikaDana('2026-10-17', '2026-10-17'), 0);
});
