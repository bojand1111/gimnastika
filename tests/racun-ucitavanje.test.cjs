const test = require('node:test');
const assert = require('node:assert/strict');

// Dokaz da require(esm) radi iz CJS (main proces Electrona).
test('konacnaE se ucitava iz CJS', () => {
  const { konacnaE } = require('../electron/racun/ocena.mjs');
  assert.equal(konacnaE([8300, 8100, 8400, 8200], 'odbaci_krajnje'), 8250);
});

test('prikaz se ucitava iz CJS', () => {
  const { prikaz } = require('../electron/racun/broj.mjs');
  assert.equal(prikaz(8250), '8,250');
});
