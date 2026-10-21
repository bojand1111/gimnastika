import test from 'node:test';
import assert from 'node:assert/strict';
import { lekarski, lekarskiOznaka } from '../electron/racun/lekarski.mjs';

test('lekarski: istekao', () => {
  assert.equal(lekarski('2026-01-01', 30, '2026-10-17').stanje, 'istekao');
  assert.ok(lekarski('2026-01-01', 30, '2026-10-17').dana < 0);
});

test('lekarski: istice', () => {
  assert.deepEqual(lekarski('2026-10-25', 30, '2026-10-17'), { stanje: 'istice', dana: 8 });
  assert.deepEqual(lekarski('2026-10-17', 30, '2026-10-17'), { stanje: 'istice', dana: 0 });
  assert.equal(lekarski('2026-11-16', 30, '2026-10-17').stanje, 'istice');
});

test('lekarski: vazi', () => {
  assert.equal(lekarski('2027-10-25', 30, '2026-10-17').stanje, 'vazi');
  assert.equal(lekarski('2026-11-17', 30, '2026-10-17').stanje, 'vazi');
});

test('lekarski: nema', () => {
  assert.deepEqual(lekarski(null, 30), { stanje: 'nema', dana: null });
  assert.equal(lekarski('', 30).stanje, 'nema');
  assert.equal(lekarski('x', 30).stanje, 'nema');
  assert.equal(lekarski('2026-02-31', 30, '2026-10-17').stanje, 'nema');
});

test('lekarskiOznaka: sva cetiri stanja', () => {
  assert.deepEqual(lekarskiOznaka({ stanje: 'istekao', dana: -5 }), { klasa: 'status-bad', tekst: 'Istekao' });
  assert.deepEqual(lekarskiOznaka({ stanje: 'istice', dana: 8 }), { klasa: 'status-warn', tekst: 'Ističe za 8 dana' });
  assert.deepEqual(lekarskiOznaka({ stanje: 'istice', dana: 1 }), { klasa: 'status-warn', tekst: 'Ističe za 1 dana' });
  assert.deepEqual(lekarskiOznaka({ stanje: 'nema', dana: null }), { klasa: 'status-bad', tekst: 'Nema lekarskog' });
  assert.deepEqual(lekarskiOznaka({ stanje: 'vazi', dana: 100 }), { klasa: '', tekst: '' });
});
