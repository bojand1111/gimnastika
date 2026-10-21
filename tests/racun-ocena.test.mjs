import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRAVILO_ODBACI, PRAVILO_PROSEK, PRAVILA, konacnaE, prosek, konacna, odbaceniIndeksi,
} from '../electron/racun/ocena.mjs';

test('E ocena: primeri iz specifikacije', () => {
  const slucajevi = [
    // D, E sudije, pravilo, E, odbitak, konacna
    [4800, [8300, 8100, 8400, 8200], 'odbaci_krajnje', 8250, 0, 13050],
    [4500, [7900, 8000, 7700, 8100], 'odbaci_krajnje', 7950, 100, 12350],
    [5100, [7600, 7400, 7800, 7500], 'odbaci_krajnje', 7550, 0, 12650],
    [3900, [7800, 7900, 7800, 8000], 'odbaci_krajnje', 7850, 0, 11750],
    [4000, [8100, 8200, 8400], 'odbaci_krajnje', 8200, 0, 12200],
    [4000, [8100, 8200, 8400], 'prosek_svih', 8233, 0, 12233],
    [4000, [8100, 8200], 'odbaci_krajnje', 8150, 0, 12150],
    [4000, [8100], 'odbaci_krajnje', 8100, 0, 12100],
    [4000, [8100], 'prosek_svih', 8100, 100, 12000],
  ];
  slucajevi.forEach(([d, e, pravilo, ocekE, odbitak, ocekK], i) => {
    const E = konacnaE(e, pravilo);
    assert.equal(E, ocekE, `slucaj ${i} E`);
    assert.equal(konacna(d, E, odbitak), ocekK, `slucaj ${i} konacna`);
  });
});

test('E ocena: odsecanje i zaokruzivanje', () => {
  assert.equal(konacnaE([8100, 8200, 8500], 'prosek_svih'), 8266, 'odsecanje 8266,67');
  assert.equal(konacnaE([8100, 8200, 8500], 'prosek_svih', 'zaokruzi'), 8267, 'zaokruzivanje umesto odsecanja');
});

test('konacna ne ide ispod nule', () => {
  assert.equal(konacna(1000, 2000, 5000), 0);
});

test('odbaceniIndeksi', () => {
  assert.deepEqual(odbaceniIndeksi([8300, 8100, 8400, 8200], 'odbaci_krajnje'), [1, 2]);
  assert.deepEqual(odbaceniIndeksi([8000, 8000, 8000], 'odbaci_krajnje'), [0, 1], 'sve iste: dve razlicite pozicije');
  assert.deepEqual(odbaceniIndeksi([8000, 8100], 'odbaci_krajnje'), []);
  assert.deepEqual(odbaceniIndeksi([8000], 'odbaci_krajnje'), [], 'jedan sudija: nista se ne odbacuje');
});

test('prosek i pravila', () => {
  assert.equal(prosek([], 'odseci'), 0);
  assert.equal(konacnaE([], PRAVILO_ODBACI), 0);
  assert.deepEqual(odbaceniIndeksi([1, 2, 3], PRAVILO_PROSEK), []);
  assert.equal(PRAVILA[PRAVILO_ODBACI], 'Odbaci najvišu i najnižu, prosek ostalih');
  assert.equal(PRAVILA[PRAVILO_PROSEK], 'Prosek svih E ocena');
});
