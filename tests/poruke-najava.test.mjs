import test from 'node:test';
import assert from 'node:assert/strict';
import { dodaj, pokupi, trajanje } from '../src/najava.js';

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

test('trajanje: greska i najavljene poruke 6000 ms, obicne 2500 ms', () => {
  assert.equal(trajanje('ok'), 2500);
  assert.equal(trajanje('upozorenje'), 2500);
  assert.equal(trajanje('greska'), 6000);
  for (const v of ['ok', 'upozorenje', 'info', 'greska']) assert.equal(trajanje(v, true), 6000);
});

test('pokupljene poruke dobijaju 6000 ms kroz trajanje(vrsta, true)', () => {
  pokupi();
  dodaj('uvoz zavrsen');
  dodaj('pazi', 'upozorenje');
  assert.deepEqual(pokupi().map((n) => trajanje(n.vrsta, true)), [6000, 6000]);
});
