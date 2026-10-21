import test from 'node:test';
import assert from 'node:assert/strict';
import { razlozi, url } from '../src/ruter.js';

test('razlozi: ekran i parametri', () => {
  assert.deepEqual(razlozi('#/prijave?pol=M'), { ekran: 'prijave', parametri: { pol: 'M' } });
  assert.deepEqual(razlozi('#/takmicenja/izmeni?id=3'), { ekran: 'takmicenja/izmeni', parametri: { id: '3' } });
  assert.deepEqual(razlozi('#/sistem'), { ekran: 'sistem', parametri: {} });
});

test('razlozi: prazan hash vodi na pocetnu', () => {
  assert.deepEqual(razlozi(''), { ekran: 'pocetna', parametri: {} });
  assert.deepEqual(razlozi('#'), { ekran: 'pocetna', parametri: {} });
  assert.deepEqual(razlozi('#/'), { ekran: 'pocetna', parametri: {} });
});

test('url: sastavlja hash', () => {
  assert.equal(url('sistem'), '#/sistem');
  assert.equal(url('prijave', { pol: 'M' }), '#/prijave?pol=M');
  assert.equal(url('takmicenja/izmeni', { id: 3 }), '#/takmicenja/izmeni?id=3');
});

test('url i razlozi su inverzni', () => {
  const p = { ekran: 'prijave', parametri: { pol: 'Z', klub: 'a b' } };
  assert.deepEqual(razlozi(url(p.ekran, p.parametri)), p);
});
