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
  assert.deepEqual(Object.keys(ipc.kanali).sort(), Object.entries(MODULI).flatMap(([m, r]) => r.map((x) => `gim:${m}:${x}`)).sort());
});

test('uspeh vraca ok i podatke (i async)', async () => {
  const ipc = lazniIpc();
  const m = { sistem: { verzija: () => '0.1.0', kasno: async (a, b) => a + b } };
  registruj(ipc, m, laznidnevnik(), { sistem: ['verzija', 'kasno'] });
  assert.deepEqual(await ipc.kanali['gim:sistem:verzija']({}), { ok: true, podaci: '0.1.0' });
  assert.deepEqual(await ipc.kanali['gim:sistem:kasno']({}, 2, 3), { ok: true, podaci: 5 });
});

test('GreskaKorisnika vraca poruku bez upisa u dnevnik', async () => {
  const ipc = lazniIpc(), dn = laznidnevnik();
  registruj(ipc, { klub: { brisi: () => { throw new GreskaKorisnika('Klub ima 3 takmičara.'); } } }, dn, { klub: ['brisi'] });
  assert.deepEqual(await ipc.kanali['gim:klub:brisi']({}), { ok: false, greska: 'Klub ima 3 takmičara.' });
  assert.equal(dn.poziva, 0);
});

test('druga greska vraca genericku poruku i upisuje u dnevnik jednom', async () => {
  const ipc = lazniIpc(), dn = laznidnevnik();
  registruj(ipc, { klub: { y: async () => { throw new TypeError('x'); } } }, dn, { klub: ['y'] });
  assert.deepEqual(await ipc.kanali['gim:klub:y']({}), { ok: false, greska: GENERICKA });
  assert.equal(dn.poziva, 1);
});

test('registruj baca ako MODULI radnja nema handler', () => {
  assert.throws(() => registruj(lazniIpc(), { sistem: {} }, laznidnevnik(), { sistem: ['verzija'] }), /Bez handlera: gim:sistem:verzija/);
});

test('registruj baca ako handler nije u MODULI', () => {
  const moduli = { sistem: { verzija: () => 1, visak: () => 2 } };
  assert.throws(() => registruj(lazniIpc(), moduli, laznidnevnik(), { sistem: ['verzija'] }), /Nije u MODULI: gim:sistem:visak/);
});

// Pravi moduli nad :memory: bazom.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');

function pravi() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ipc-'));
  const moduli = napraviModule(baza, { dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }, fasciklaPodataka: () => dir });
  return { baza, dir, moduli };
}

test('pravi moduli: registruj registruje tacno kanale iz MODULI', () => {
  const { moduli, dir } = pravi();
  const ipc = lazniIpc();
  const spisak = { ...MODULI };
  const bez = {};
  for (const k of Object.keys(spisak)) if (moduli[k]) bez[k] = moduli[k];
  registruj(ipc, bez, laznidnevnik(), Object.fromEntries(Object.keys(bez).map((k) => [k, MODULI[k]])));
  for (const k of ['klubovi', 'takmicari', 'sifarnici', 'podesavanja']) {
    for (const r of MODULI[k]) assert.ok(ipc.kanali[`gim:${k}:${r}`], `${k}:${r}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('klubovi.sacuvaj: krug preko IPC, greska korisnika, string id', async () => {
  const { moduli, dir } = pravi();
  const ipc = lazniIpc(), dn = laznidnevnik();
  registruj(ipc, { klubovi: moduli.klubovi }, dn, { klubovi: MODULI.klubovi });
  const k = ipc.kanali;
  assert.deepEqual(await k['gim:klubovi:sacuvaj']({}, { puno_ime: 'Sokol', skracenica: 'sok', grad: 'NS' }, null), { ok: true, podaci: { id: 1 } });
  assert.deepEqual(await k['gim:klubovi:sacuvaj']({}, { puno_ime: '', skracenica: 'x' }, null),
    { ok: false, greska: 'Puno ime kluba je obavezno. Skraćenica mora imati 2 do 4 slova.' });
  // string id ne sme da napravi laznu duplu skracenicu
  assert.deepEqual(await k['gim:klubovi:sacuvaj']({}, { puno_ime: 'Sokol 2', skracenica: 'SOK', grad: '' }, '1'), { ok: true, podaci: { id: 1 } });
  assert.equal(dn.poziva, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('podesavanja.sva dodaje grb URL samo kad fajl postoji; izaberiGrb vraca putanju ili null', async () => {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ipc-'));
  let odgovor = { canceled: true, filePaths: [] };
  const m = napraviModule(baza, { dialog: { showOpenDialog: async () => odgovor }, fasciklaPodataka: () => dir });
  let s = m.podesavanja.sva();
  assert.equal(s.grb_levo_url, '');
  assert.equal(s.grb_desno_url, '');
  fs.mkdirSync(path.join(dir, 'grb'));
  fs.writeFileSync(path.join(dir, 'grb', 'grb_levo.png'), 'x');
  baza.izvrsi("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('grb_levo','grb/grb_levo.png'), ('grb_desno','grb/nema.png') ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost");
  s = m.podesavanja.sva();
  assert.equal(s.grb_levo_url, require('node:url').pathToFileURL(path.join(dir, 'grb/grb_levo.png')).href);
  assert.equal(s.grb_desno_url, '');
  assert.equal(await m.podesavanja.izaberiGrb(), null);
  odgovor = { canceled: false, filePaths: ['C:\a.png', 'C:\b.png'] };
  assert.equal(await m.podesavanja.izaberiGrb(), 'C:\a.png');
  assert.equal(m.podesavanja.aktivno(), null);
  const sif = m.sifarnici.vrste();
  assert.ok(sif.vrste.kategorije && Array.isArray(sif.ikone));
  const d = m.sifarnici.dodaj('kategorije', { naziv: 'Pocetnice' });
  assert.equal(d.stavka.naziv, 'Pocetnice');
  assert.equal(d.id, d.stavka.id);
  fs.rmSync(dir, { recursive: true, force: true });
});
