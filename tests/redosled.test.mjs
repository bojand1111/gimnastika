import test from 'node:test';
import assert from 'node:assert/strict';
import { pomeri } from '../src/ekrani/redosled.js';

test('pomeri: dole zamenjuje sa sledecim, vraca novi niz', () => {
  const ulaz = [1, 2, 3];
  const izlaz = pomeri(ulaz, 1, 1);
  assert.deepEqual(izlaz, [2, 1, 3]);
  assert.notEqual(izlaz, ulaz);
  assert.deepEqual(ulaz, [1, 2, 3]);
});

test('pomeri: gore zamenjuje sa prethodnim', () => {
  assert.deepEqual(pomeri([1, 2, 3], 3, -1), [1, 3, 2]);
});

test('pomeri: krajevi se ne pomeraju', () => {
  assert.deepEqual(pomeri([1, 2, 3], 1, -1), [1, 2, 3]);
  assert.deepEqual(pomeri([1, 2, 3], 3, 1), [1, 2, 3]);
});

test('pomeri: nepoznat id vraca isti niz', () => {
  const ulaz = [1, 2, 3];
  assert.equal(pomeri(ulaz, 9, 1), ulaz);
});
