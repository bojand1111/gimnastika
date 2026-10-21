const test = require('node:test');
const assert = require('node:assert/strict');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');

function lazniIpc() {
  return { kanali: {}, handle(kanal, fn) { this.kanali[kanal] = fn; } };
}
function laznidnevnik() {
  return { poziva: 0, info() {}, greska() { this.poziva++; } };
}
const GENERICKA = 'Greška u programu. Pogledajte dnevnik.log.';

test('registrovani kanali odgovaraju MODULI', () => {
  const ipc = lazniIpc();
  const moduli = {};
  for (const [m, radnje] of Object.entries(MODULI)) {
    moduli[m] = {};
    for (const r of radnje) moduli[m][r] = () => null;
  }
  registruj(ipc, moduli, laznidnevnik());
  assert.deepEqual(Object.keys(ipc.kanali), ['gim:sistem:verzija']);
});

test('uspeh vraca ok i podatke (i async)', async () => {
  const ipc = lazniIpc();
  registruj(ipc, { sistem: { verzija: () => '0.1.0', kasno: async (a, b) => a + b } }, laznidnevnik());
  assert.deepEqual(await ipc.kanali['gim:sistem:verzija']({}), { ok: true, podaci: '0.1.0' });
  assert.deepEqual(await ipc.kanali['gim:sistem:kasno']({}, 2, 3), { ok: true, podaci: 5 });
});

test('GreskaKorisnika vraca poruku bez upisa u dnevnik', async () => {
  const ipc = lazniIpc(), dn = laznidnevnik();
  registruj(ipc, { klub: { brisi: () => { throw new GreskaKorisnika('Klub ima 3 takmičara.'); } } }, dn);
  assert.deepEqual(await ipc.kanali['gim:klub:brisi']({}), { ok: false, greska: 'Klub ima 3 takmičara.' });
  assert.equal(dn.poziva, 0);
});

test('druga greska vraca genericku poruku i upisuje u dnevnik jednom', async () => {
  const ipc = lazniIpc(), dn = laznidnevnik();
  registruj(ipc, { klub: { y: async () => { throw new TypeError('x'); } } }, dn);
  assert.deepEqual(await ipc.kanali['gim:klub:y']({}), { ok: false, greska: GENERICKA });
  assert.equal(dn.poziva, 1);
});
