import test from 'node:test';
import assert from 'node:assert/strict';
import { objavaOnemogucena, razlogObjave, tekstObjave } from '../src/ekrani/objavaStanje.js';

test('dugme je onemoguceno dok stanje ne stigne, pri slanju i bez moze', () => {
  assert.equal(objavaOnemogucena(null, false), true);
  assert.equal(objavaOnemogucena({ moze: true }, true), true);
  assert.equal(objavaOnemogucena({ moze: false, razlog: 'x' }, false), true);
  assert.equal(objavaOnemogucena({ moze: true }, false), false);
});

test('razlog je vidljiv samo kad objava nije moguca', () => {
  assert.equal(razlogObjave(null), '');
  assert.equal(razlogObjave({ moze: true, razlog: '' }), '');
  assert.equal(razlogObjave({ moze: false, razlog: 'Adresa za objavu nije podešena.' }), 'Adresa za objavu nije podešena.');
});

test('tekstObjave: stanja', () => {
  assert.equal(tekstObjave(null), '');
  assert.equal(tekstObjave({ stanje: 'ceka' }), 'Čeka internet');
  assert.equal(tekstObjave({ stanje: 'nije' }), 'Nije objavljeno');
});
