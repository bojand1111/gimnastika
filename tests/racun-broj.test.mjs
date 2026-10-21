import test from 'node:test';
import assert from 'node:assert/strict';
import { MAKS, izUnosa, izBaze, prikaz, prikazD } from '../electron/racun/broj.mjs';

test('izUnosa: zarez, tacka, cele i decimale', () => {
  assert.equal(izUnosa('8,3'), 8300);
  assert.equal(izUnosa('8.3'), 8300);
  assert.equal(izUnosa('8'), 8000);
  assert.equal(izUnosa('13,050'), 13050);
  assert.equal(izUnosa(' 12.35 '), 12350);
});

test('izUnosa: granice opsega', () => {
  assert.equal(MAKS, 20000);
  assert.equal(izUnosa('0'), 0);
  assert.equal(izUnosa('20'), 20000);
  assert.equal(izUnosa('20,001'), null);
});

test('izUnosa: neispravan unos daje null', () => {
  assert.equal(izUnosa(''), null);
  assert.equal(izUnosa('8,3456'), null, 'vise od tri decimale');
  assert.equal(izUnosa('21'), null, 'van opsega');
  assert.equal(izUnosa('-1'), null);
  assert.equal(izUnosa('a'), null);
});

test('prikaz i prikazD', () => {
  assert.equal(prikaz(13050), '13,050');
  assert.equal(prikaz(0), '0,000');
  assert.equal(prikaz(null), '');
  assert.equal(prikazD(4200), '4,2');
  assert.equal(prikazD(4250), '4,250');
});

test('izBaze: tekst iz PHP kopije i celi brojevi', () => {
  assert.equal(izBaze('8.300'), 8300);
  assert.equal(izBaze('8.3'), 8300);
  assert.equal(izBaze(8300), 8300);
  assert.equal(izBaze(null), null);
});
