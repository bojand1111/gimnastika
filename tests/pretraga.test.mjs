import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizuj, odgovara } from '../src/pretraga.js';

test('normalizuj: mala slova i slova sa kvacicama', () => {
  assert.equal(normalizuj('ČĆŠŽĐ'), 'ccszd');
  assert.equal(normalizuj('Kruševac'), 'krusevac');
  assert.equal(normalizuj('Đakovo Niš'), 'dakovo nis');
  assert.equal(normalizuj(null), '');
  assert.equal(normalizuj(undefined), '');
});

test('odgovara: podstring bez obzira na kvacice i velika slova', () => {
  assert.equal(odgovara('GK „Beograd“ BGD Beograd', 'beo'), true);
  assert.equal(odgovara('SD Spartak SPA Subotica', 'ŠPA'), true);
  assert.equal(odgovara('GK Niš NIŠ Niš', 'nis'), true);
  assert.equal(odgovara('SD Soko SOK Zrenjanin', 'xyz'), false);
});

test('odgovara: prazan upit uvek odgovara, razmaci na krajevima se skidaju', () => {
  assert.equal(odgovara('bilo sta', ''), true);
  assert.equal(odgovara('bilo sta', '   '), true);
  assert.equal(odgovara('', ''), true);
  assert.equal(odgovara('Novi Sad', '  novi  '), true);
});
