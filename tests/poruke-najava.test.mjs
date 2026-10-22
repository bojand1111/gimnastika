import test from 'node:test';
import assert from 'node:assert/strict';
import { dodaj, pokupi } from '../src/najava.js';

test('pokupi vraca poruke redom i prazni red', () => {
  pokupi();
  dodaj('prva');
  dodaj('druga', 'greska');
  assert.deepEqual(pokupi(), [{ tekst: 'prva', vrsta: 'ok' }, { tekst: 'druga', vrsta: 'greska' }]);
  assert.deepEqual(pokupi(), []);
});

test('pokupi vraca kopiju, ne zivi red', () => {
  pokupi();
  dodaj('a');
  const r = pokupi();
  dodaj('b');
  assert.equal(r.length, 1);
  assert.deepEqual(pokupi(), [{ tekst: 'b', vrsta: 'ok' }]);
});
