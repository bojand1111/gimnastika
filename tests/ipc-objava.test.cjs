// IPC objave i kartica uvoza na Pocetnoj nad :memory: bazom.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const dn = { info() {}, greska() {} };

function pravi(opcije = {}) {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const moduli = napraviModule(baza, { dialog, fasciklaPodataka: () => os.tmpdir(), dnevnik: dn, ...opcije });
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  return { baza, moduli, s };
}
const uvezena = (baza, uid, red) => baza.ubaci('uvezene_objave', { uid, stanje: 'uvezeno', poruka: '', vreme: '2026-11-13 10:00:00', ...red });

test('guard: MODULI objava i pocetna se poklapaju sa handlerima', () => {
  const { moduli } = pravi();
  assert.deepEqual(MODULI.objava, ['stanje', 'objavi']);
  assert.deepEqual(MODULI.pocetna, ['podaci', 'potvrdiUvoz']);
  const ipc = { kanali: {}, handle(k, fn) { this.kanali[k] = fn; } };
  registruj(ipc, moduli, dn, Object.fromEntries(Object.keys(moduli).map((k) => [k, MODULI[k]])));
  for (const k of ['gim:objava:stanje', 'gim:objava:objavi', 'gim:pocetna:potvrdiUvoz']) assert.ok(ipc.kanali[k], k);
});

test('objava.stanje i objava.objavi: takmicenje drugog dela i nepostojece bacaju', async () => {
  const { moduli, s } = pravi({ objavaOpcije: { adresa: '' } });
  assert.throws(() => moduli.objava.stanje(String(s.takmM)), (e) => e instanceof GreskaKorisnika && e.message === 'Takmičenje ne postoji.');
  assert.throws(() => moduli.objava.stanje('9999'), GreskaKorisnika);
  await assert.rejects(async () => moduli.objava.objavi(String(s.takmM)), GreskaKorisnika);
  const r = moduli.objava.stanje(String(s.takm));
  assert.equal(r.moze, false); // adresa je prazna
  assert.equal(r.stanje, 'nije');
  structuredClone(r);
});

test('objavaSpremna dobija klijenta', () => {
  let klijent = null;
  pravi({ objavaSpremna: (k) => { klijent = k; } });
  assert.equal(typeof klijent.posaljiNaCekanju, 'function');
});

test('pocetna.podaci vraca iz_azuriranja dok se ne pozove potvrdiUvoz', () => {
  const { moduli, baza, s } = pravi();
  assert.deepEqual(moduli.pocetna.podaci().iz_azuriranja, []);
  uvezena(baza, 'u1', { takmicenje_id: s.takm, naziv: 'Uvezeno Z', pol: 'Z' });
  uvezena(baza, 'u2', { takmicenje_id: null, stanje: 'odbijeno', poruka: 'Neispravan fajl.', naziv: 'Odbijeno', pol: '' });
  uvezena(baza, 'u3', { takmicenje_id: s.takmM, naziv: 'Uvezeno M', pol: 'M' });
  uvezena(baza, 'u4', { takmicenje_id: s.takm, naziv: 'Vec prikazano', pol: 'Z', prikazano: 1 });
  const d = moduli.pocetna.podaci();
  assert.deepEqual(d.iz_azuriranja.map((r) => r.naziv), ['Uvezeno Z', 'Odbijeno']);
  assert.equal(d.iz_azuriranja[0].takmicenje_id, s.takm);
  assert.equal(d.iz_azuriranja[0].datumTekst, '17.10.2026.');
  assert.equal(d.iz_azuriranja[1].stanje, 'odbijeno');
  assert.equal(d.iz_azuriranja[1].poruka, 'Neispravan fajl.');
  assert.equal(d.iz_azuriranja[1].datumTekst, '');
  structuredClone(d);
  // opet vraca isto dok se ne potvrdi
  assert.equal(moduli.pocetna.podaci().iz_azuriranja.length, 2);
  moduli.pocetna.potvrdiUvoz();
  assert.deepEqual(moduli.pocetna.podaci().iz_azuriranja, []);
  // potvrda vazi za aktivni deo i redove bez pola; drugi deo ostaje nepotvrdjen
  assert.equal(baza.vrednost("SELECT prikazano FROM uvezene_objave WHERE uid = 'u2'"), 1);
  assert.equal(baza.vrednost("SELECT prikazano FROM uvezene_objave WHERE uid = 'u3'"), 0);
  moduli.pol.postavi('M');
  assert.deepEqual(moduli.pocetna.podaci().iz_azuriranja.map((r) => r.naziv), ['Uvezeno M']);
  moduli.pocetna.potvrdiUvoz();
  assert.deepEqual(moduli.pocetna.podaci().iz_azuriranja, []);
});

test('pocetna.podaci: red stanja postoji se ne prikazuje u kartici', () => {
  const { moduli, baza, s } = pravi();
  uvezena(baza, 'u9', { takmicenje_id: s.takm, stanje: 'postoji', poruka: 'Takmičenje već postoji.', naziv: 'Vec bilo', pol: 'Z' });
  assert.deepEqual(moduli.pocetna.podaci().iz_azuriranja, []);
});
