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
    { ok: false, greska: 'Puno ime kluba je obavezno. Skraćenica mora imati 2 do 4 slova.', greske: ['Puno ime kluba je obavezno.', 'Skraćenica mora imati 2 do 4 slova.'] });
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
  assert.ok(s.grb_levo_url.startsWith(require('node:url').pathToFileURL(path.join(dir, 'grb/grb_levo.png')).href + '?v='));
  assert.equal(s.grb_desno_url, '');
  assert.equal(await m.podesavanja.izaberiGrb(), null);
  odgovor = { canceled: false, filePaths: [String.raw`C:\a.png`, String.raw`C:\b.png`] };
  assert.equal(await m.podesavanja.izaberiGrb(), String.raw`C:\a.png`);
  assert.equal(m.podesavanja.aktivno(), null);
  const sif = m.sifarnici.vrste();
  assert.ok(sif.vrste.kategorije && Array.isArray(sif.ikone));
  const d = m.sifarnici.dodaj('kategorije', { naziv: 'Pocetnice' });
  assert.equal(d.stavka.naziv, 'Pocetnice');
  assert.equal(d.id, d.stavka.id);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('podesavanja.sva: URL grba se menja kad se fajl zameni (kes slike)', () => {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-grb-'));
  try {
    const m = napraviModule(baza, { dialog: {}, fasciklaPodataka: () => dir });
    fs.mkdirSync(path.join(dir, 'grb'));
    const fajl = path.join(dir, 'grb', 'grb_levo.png');
    fs.writeFileSync(fajl, 'x');
    fs.utimesSync(fajl, new Date(2026, 0, 1), new Date(2026, 0, 1));
    baza.izvrsi("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('grb_levo','grb/grb_levo.png')");
    const prvi = m.podesavanja.sva().grb_levo_url;
    assert.ok(prvi.includes('?v='));
    fs.utimesSync(fajl, new Date(2026, 5, 1), new Date(2026, 5, 1));
    assert.notEqual(m.podesavanja.sva().grb_levo_url, prvi);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('GreskaKorisnika sa listom: greske ide u odgovor kao niz, bez nje nema polja', async () => {
  const ipc = lazniIpc(), dn = laznidnevnik();
  registruj(ipc, { klub: {
    a: () => { throw new GreskaKorisnika('Prva. Druga.', { greske: ['Prva.', 'Druga.'] }); },
    b: () => { throw new GreskaKorisnika('Jedna.'); },
  } }, dn, { klub: ['a', 'b'] });
  assert.deepEqual(await ipc.kanali['gim:klub:a']({}), { ok: false, greska: 'Prva. Druga.', greske: ['Prva.', 'Druga.'] });
  assert.deepEqual(await ipc.kanali['gim:klub:b']({}), { ok: false, greska: 'Jedna.' });
  assert.equal(dn.poziva, 0);
});

test('GreskaKorisnika cuva cause i kopira listu gresaka', () => {
  const uzrok = new Error('x'), lista = ['A.', 'B.'];
  const g = new GreskaKorisnika('A. B.', { cause: uzrok, greske: lista });
  assert.equal(g.cause, uzrok);
  assert.deepEqual(g.greske, ['A.', 'B.']);
  assert.notEqual(g.greske, lista);
  assert.equal(new GreskaKorisnika('x').greske, undefined);
});

test('src/gim.js: greska postaje Error sa greske nizom (ili null)', async () => {
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const gim = (await import(pathToFileURL(path.join(__dirname, '..', 'src', 'gim.js')).href)).default;
  const prethodni = globalThis.window;
  globalThis.window = { gim: { m: {
    a: async () => ({ ok: false, greska: 'A. B.', greske: ['A.', 'B.'] }),
    b: async () => ({ ok: false, greska: 'Jedna.' }),
    c: async () => ({ ok: true, podaci: 5 }),
  } } };
  try {
    await assert.rejects(gim.m.a(), (e) => e.message === 'A. B.' && JSON.stringify(e.greske) === '["A.","B."]');
    await assert.rejects(gim.m.b(), (e) => e.message === 'Jedna.' && e.greske === null);
    assert.equal(await gim.m.c(), 5);
  } finally {
    if (prethodni === undefined) delete globalThis.window; else globalThis.window = prethodni;
  }
});

// --- Izabrani pol: svi ulazi rade samo za njega (T4) ---
const { tokSeme } = require('./pomoc/seme.cjs');

test('MODULI.pol: daj i postavi, i registruju se kanali', () => {
  assert.deepEqual(MODULI.pol, ['daj', 'postavi']);
  const { moduli, dir } = pravi();
  const ipc = lazniIpc();
  registruj(ipc, { pol: moduli.pol }, laznidnevnik(), { pol: MODULI.pol });
  assert.ok(ipc.kanali['gim:pol:daj']);
  assert.ok(ipc.kanali['gim:pol:postavi']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('pol.daj i pol.postavi: podrazumevano M, pamti izbor, nepoznat pol baca', () => {
  const { moduli, baza, dir } = pravi();
  assert.equal(moduli.pol.daj(), 'M');
  assert.equal(moduli.pol.postavi('Z'), 'Z');
  assert.equal(moduli.pol.daj(), 'Z');
  assert.equal(baza.vrednost("SELECT vrednost FROM podesavanja WHERE kljuc = 'aktivni_pol'"), 'Z');
  assert.throws(() => moduli.pol.postavi('X'), (e) => e instanceof GreskaKorisnika && e.message === 'Nepoznat pol.');
  assert.throws(() => moduli.pol.postavi(undefined), GreskaKorisnika);
  assert.equal(moduli.pol.daj(), 'Z', 'neuspeh ne menja izbor');
  assert.equal(moduli.pol.postavi('M'), 'M');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('pol.postavi menja listu takmicenja i cuva aktivno takmicenje svakog dela', () => {
  const { moduli, baza, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(s.takm));
  moduli.pol.postavi('M');
  assert.deepEqual(moduli.takmicenja.sva().map((r) => [Number(r.id), r.status]), [[s.takmM, 'priprema']]);
  moduli.takmicenja.otvori(String(s.takmM));
  assert.deepEqual(moduli.takmicenja.sva().map((r) => [Number(r.id), r.status]), [[s.takmM, 'aktivno']]);
  moduli.pol.postavi('Z');
  assert.deepEqual(moduli.takmicenja.sva().map((r) => [Number(r.id), r.status]), [[s.takm, 'aktivno']]);
  assert.equal(Number(moduli.podesavanja.aktivno().id), s.takm);
  moduli.pol.postavi('M');
  assert.equal(Number(moduli.podesavanja.aktivno().id), s.takmM, 'MSG pamti svoje aktivno');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('takmicari.svi vraca samo izabrani pol', () => {
  const { moduli, baza, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  assert.deepEqual(moduli.takmicari.svi().map((r) => r.pol), ['Z', 'Z', 'Z', 'Z']);
  moduli.pol.postavi('M');
  assert.deepEqual(moduli.takmicari.svi().map((r) => [Number(r.id), r.pol]), [[s.muski, 'M']]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('sifarnici.lista (ne-sprave) i dodaj rade za izabrani pol', () => {
  const { moduli, baza, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('M');
  assert.deepEqual(moduli.sifarnici.lista('kategorije').map((r) => Number(r.id)), [s.katM]);
  const d = moduli.sifarnici.dodaj('programi', { naziv: 'D' });
  assert.equal(d.stavka.pol, 'M');
  moduli.pol.postavi('Z');
  assert.deepEqual(moduli.sifarnici.lista('programi').map((r) => Number(r.id)), [s.prog]);
  // stavka drugog pola se ponasa kao da ne postoji
  assert.throws(() => moduli.sifarnici.izmeni('programi', d.id, { naziv: 'X' }), GreskaKorisnika);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('brisanje aktivnog u ZSG ne dira MSG', () => {
  const { moduli, baza, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(s.takm));
  moduli.takmicenja.obrisi(String(s.takm));
  assert.equal(moduli.podesavanja.aktivno(), null, 'ZSG ostaje bez aktivnog');
  moduli.pol.postavi('M');
  assert.equal(Number(moduli.podesavanja.aktivno().id), s.takmM);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM takmicenja WHERE id = ?', [s.takmM]), 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('takmicenja: id drugog pola se ponasa kao da ne postoji', () => {
  const { moduli, baza, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('M');
  const nema = (f) => assert.throws(f, (e) => e instanceof GreskaKorisnika && e.message === 'Takmičenje ne postoji.');
  nema(() => moduli.takmicenja.otvori(String(s.takm)));
  nema(() => moduli.takmicenja.obrisi(String(s.takm)));
  nema(() => moduli.takmicenja.sacuvaj({ naziv: 'X', datum: '17.10.2026.', broj_e_sudija: '4', pravilo_e: 'odbaci_krajnje', ekipno_broji: '3' }, String(s.takm)));
  nema(() => moduli.takmicenja.stanje(String(s.takm)));
  nema(() => moduli.takmicenja.sacuvajGrb(String(s.takm), 'grb_levo', 'x.png'));
  nema(() => moduli.takmicenja.ukloniGrb(String(s.takm), 'grb_levo'));
  assert.equal(moduli.takmicenja.nadji(String(s.takm)), null);
  assert.equal(Number(moduli.takmicenja.nadji(String(s.takmM)).id), s.takmM);
  assert.equal(moduli.podesavanja.aktivno(), null, 'otvaranje tudjeg ne menja aktivno');
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM takmicenja'), 2, 'obrisi tudjeg nista ne brise');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('takmicenja.sacuvaj: novo takmicenje dobija izabrani pol i u njemu postaje aktivno', () => {
  const { moduli, baza, dir } = pravi();
  moduli.pol.postavi('Z');
  const unos = { naziv: 'Kup', datum: '17.10.2026.', mesto: 'NS', broj_e_sudija: '4', pravilo_e: 'odbaci_krajnje', ekipno_broji: '3', pol: 'M' };
  const r = moduli.takmicenja.sacuvaj(unos, null);
  assert.equal(baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [r.id]), 'Z', 'pol iz renderera se zanemaruje');
  assert.equal(Number(moduli.podesavanja.aktivno().id), r.id);
  moduli.pol.postavi('M');
  assert.equal(moduli.podesavanja.aktivno(), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('takmicari: nadji, obrisi i sacuvaj tudjeg pola su odbijeni i ne menjaju redove', () => {
  const { moduli, baza, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('M');
  const nema = (f) => assert.throws(f, (e) => e instanceof GreskaKorisnika && e.message === 'Takmičar ne postoji.');
  const stanje = () => JSON.stringify(baza.svi('SELECT * FROM takmicari ORDER BY id'));
  const pre = stanje();
  assert.equal(moduli.takmicari.nadji(String(s.t.Ana)), null);
  assert.equal(Number(moduli.takmicari.nadji(String(s.muski)).id), s.muski);
  nema(() => moduli.takmicari.obrisi(String(s.t.Ana)));
  nema(() => moduli.takmicari.sacuvaj({ id_broj: '001', ime: 'Izmena', prezime: 'Test', godina_rodjenja: 2012, pol: 'Z' }, String(s.t.Ana)));
  nema(() => moduli.takmicari.obrisi('99999'));
  assert.equal(stanje(), pre);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('takmicari.sacuvaj: izmena pola takmicara bez prijava ga seli u drugi deo', () => {
  const { moduli, baza, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  const u = { id_broj: '001', ime: 'Ana', prezime: 'Test', godina_rodjenja: 2012, pol: 'M', klub_id: String(s.k1), lekarski_do: '01.01.2027.' };
  assert.deepEqual(moduli.takmicari.sacuvaj(u, String(s.t.Ana)), { id: s.t.Ana });
  assert.equal(moduli.takmicari.svi().some((r) => Number(r.id) === s.t.Ana), false);
  assert.equal(moduli.takmicari.nadji(String(s.t.Ana)), null, 'u ZSG delu vise ne postoji');
  moduli.pol.postavi('M');
  assert.ok(moduli.takmicari.svi().some((r) => Number(r.id) === s.t.Ana));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('takmicari.sacuvaj: novi takmicar dobija izabrani pol, pol iz renderera se zanemaruje', () => {
  const { moduli, baza, dir } = pravi();
  moduli.pol.postavi('Z');
  const u = { id_broj: '500', ime: 'Nova', prezime: 'Osoba', godina_rodjenja: 2012, klub_id: '' };
  for (const [i, pol] of ['M', 'X', undefined, null].entries()) {
    const r = moduli.takmicari.sacuvaj({ ...u, id_broj: String(500 + i), pol }, null);
    assert.equal(baza.vrednost('SELECT pol FROM takmicari WHERE id = ?', [r.id]), 'Z', `pol ${pol}`);
  }
  moduli.pol.postavi('M');
  const m = moduli.takmicari.sacuvaj({ ...u, id_broj: '600', pol: 'Z' }, '');
  assert.equal(baza.vrednost('SELECT pol FROM takmicari WHERE id = ?', [m.id]), 'M');
  fs.rmSync(dir, { recursive: true, force: true });
});
