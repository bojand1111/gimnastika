import test from 'node:test';
import assert from 'node:assert/strict';
import { straneZapisnika, naslovZapisnika, ZAPISNIK_REDOVA } from '../src/ekrani/zapisniciStanje.js';

const red = (n) => ({ rb: n, prijava_id: n, startni_broj: n, ime: `T ${n}`, opis: '', vk: false, radi: true });
const list = (naziv, rot, n) => ({ sprava: { id: naziv, naziv }, rot, grupa: 'A', redovi: Array.from({ length: n }, (_, i) => red(i + 1)) });

test('straneZapisnika: dug list se deli, kratki ostaje jedna strana, redosled ostaje', () => {
  assert.equal(ZAPISNIK_REDOVA, 14);
  const s = straneZapisnika([list('Preskok', 1, 3), list('Greda', 2, 30)]);
  assert.deepEqual(s.map((x) => [x.list.sprava.naziv, x.deo, x.delova, x.redovi.length]), [
    ['Preskok', 1, 1, 3], ['Greda', 1, 3, 14], ['Greda', 2, 3, 14], ['Greda', 3, 3, 2]]);
  assert.equal(s[2].redovi[0].rb, 15);
  assert.deepEqual(straneZapisnika([]), []);
});

test('naslovZapisnika: sprava, rotacija, grupa i deo', () => {
  assert.equal(naslovZapisnika({ list: list('Preskok', 2, 1), deo: 1, delova: 1 }), 'Preskok · Rotacija 2 · A');
  assert.equal(naslovZapisnika({ list: { ...list('Greda', null, 1), grupa: 'Svi prijavljeni' }, deo: 2, delova: 3 }), 'Greda · Svi prijavljeni (2/3)');
});
