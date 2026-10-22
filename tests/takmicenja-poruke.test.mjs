import test from 'node:test';
import assert from 'node:assert/strict';
import { porukaOtvaranja } from '../src/ekrani/takmicenjaPoruke.js';

const r = (korak, stanje) => ({ korak, naziv: 'Prvenstvo', stanje: { prijava: 0, nepotpune: 0, nerasporedjeni: 0, ...stanje } });

test('porukaOtvaranja: prijave 0', () => {
  assert.equal(porukaOtvaranja(r('prijave', {})), 'Aktivno takmičenje: Prvenstvo. Još nema prijava: prvo prijavite takmičare.');
});

test('porukaOtvaranja: nepotpune N', () => {
  assert.equal(porukaOtvaranja(r('prijave', { prijava: 5, nepotpune: 2 })),
    'Aktivno takmičenje: Prvenstvo. Prijave bez kategorije, programa ili sprava: 2.');
});

test('porukaOtvaranja: rotacije N', () => {
  assert.equal(porukaOtvaranja(r('rotacije', { prijava: 5, nerasporedjeni: 3 })),
    'Aktivno takmičenje: Prvenstvo. Takmičari koji nisu raspoređeni u grupe: 3.');
});

test('porukaOtvaranja: spremno nema poruku', () => {
  assert.equal(porukaOtvaranja(r('spremno', { prijava: 5 })), null);
});
