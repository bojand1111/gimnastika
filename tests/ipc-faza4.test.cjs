// Faza 4: IPC modul rotacije nad :memory: bazom.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const NEMA_AKTIVNOG = 'Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.';
const dn = { info() {}, greska() {} };

function pravi() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const moduli = napraviModule(baza, { dialog, fasciklaPodataka: () => os.tmpdir(), dnevnik: dn });
  return { baza, moduli };
}
// Seme sa aktivnim ZSG takmicenjem i prijavama cetiri zene (Ana, Bea, Ceca, Dona); jedan muskarac je prijavljen u MSG takmicenju.
function sa4() {
  const o = pravi();
  const s = tokSeme(o.baza);
  o.moduli.pol.postavi('Z');
  o.moduli.takmicenja.otvori(String(s.takm));
  o.moduli.prijave.dodaj([s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona]);
  o.moduli.pol.postavi('M');
  o.moduli.takmicenja.otvori(String(s.takmM));
  o.moduli.prijave.dodaj([s.muski]);
  o.moduli.pol.postavi('Z');
  const pid = {};
  const tid = { Ana: s.t.Ana, Bea: s.t.Bea, Ceca: s.t.Ceca, Dona: s.t.Dona, Marko: s.muski };
  for (const [ime, id] of Object.entries(tid)) {
    pid[ime] = Number(o.baza.vrednost('SELECT id FROM prijave WHERE takmicar_id = ?', [id]));
  }
  return { ...o, s, pid };
}

test('guard: rotacije ima handler za svaku radnju', () => {
  const { moduli } = pravi();
  assert.deepEqual(MODULI.rotacije, ['podaci', 'dodaj', 'izmeni', 'obrisi', 'premesti', 'vrati', 'pomeraj', 'zavrsi']);
  const ipc = { kanali: {}, handle(k, fn) { this.kanali[k] = fn; } };
  registruj(ipc, moduli, dn, Object.fromEntries(Object.keys(moduli).map((k) => [k, MODULI[k]])));
  for (const r of MODULI.rotacije) assert.ok(ipc.kanali[`gim:rotacije:${r}`], r);
});

test('bez aktivnog takmicenja svaka radnja baca poruku', () => {
  const { moduli } = pravi();
  const r = moduli.rotacije;
  const pozivi = [() => r.podaci('Z', 1), () => r.dodaj('Z'), () => r.izmeni(1, 'x', 1), () => r.obrisi(1),
    () => r.premesti(1, 1, 0, 1), () => r.vrati(1, 1), () => r.pomeraj(true), () => r.zavrsi()];
  for (const f of pozivi) assert.throws(f, (e) => e instanceof GreskaKorisnika && e.message === NEMA_AKTIVNOG);
});

test('podaci: pol i rotacija se svode, grupe nose spravu, redosled i ručni flag', () => {
  const { moduli, pid, s } = sa4();
  const r = moduli.rotacije;
  const g1 = r.dodaj('Z').grupa;
  const g2 = r.dodaj('Z').grupa;
  assert.equal(g2.pocetna_pozicija, 2);
  for (const [i, ime] of ['Ana', 'Bea', 'Ceca'].entries()) r.premesti(String(pid[ime]), String(g1.id), i, 1);
  r.premesti(pid.Ceca, g1.id, 0, '2');
  const d = r.podaci('X', 9);
  assert.equal(d.pol, 'Z');
  assert.equal(d.rot, 2);
  assert.equal(d.brojSprava, 2);
  assert.equal(d.takm.pomeraj_redosled, 0);
  assert.equal(d.pomeraj, false);
  assert.deepEqual(d.sprave.map((x) => x.skracenica), ['PR', 'GR']);
  const [a, b] = d.grupe;
  assert.equal(a.sprava.naziv, 'Greda');
  assert.equal(b.sprava.naziv, 'Preskok');
  assert.deepEqual(a.clanovi.map((c) => c.prijava_id), [pid.Ana, pid.Bea, pid.Ceca]);
  assert.deepEqual(a.redosled_rot.map((c) => c.prijava_id), [pid.Ceca, pid.Ana, pid.Bea]);
  assert.equal(a.rucni_rot, true);
  assert.deepEqual(a.rucni_rotacije, [2]);
  assert.equal(b.rucni_rot, false);
  assert.deepEqual(d.nerasporedjeni.map((c) => c.prijava_id), [pid.Dona]);
  assert.equal(d.kombinacije.length, 1);
  assert.deepEqual(Object.keys(d.kombinacije[0]).sort(), ['kat', 'kid', 'pid', 'prog']);
  assert.equal(r.podaci('Z', 0).rot, 1);
  assert.equal(r.podaci('Z', 'abc').rot, 1);
  // MSG deo ima jednu spravu (pol se bira sa pol.postavi, ne argumentom)
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  assert.equal(r.podaci('Z', 1).brojSprava, 1);
  assert.equal(typeof d.stanje.prijava, 'number');
  assert.doesNotThrow(() => structuredClone(d));
});

test('kombinacije: null par ide prvo', () => {
  const { baza, moduli, s } = sa4();
  baza.izmeni('prijave', { kategorija_id: null, program_id: null }, 'takmicar_id = ?', [s.t.Dona]);
  const k = moduli.rotacije.podaci('Z', 1).kombinacije;
  assert.equal(k.length, 2);
  assert.deepEqual(k[0], { kid: null, kat: null, pid: null, prog: null });
  assert.equal(k[1].kat, 'Kadet');
});

test('premesti: string id-jevi i neraspoređeni (0, "", null)', () => {
  const { moduli, pid } = sa4();
  const r = moduli.rotacije;
  const g = r.dodaj('Z').grupa;
  r.premesti(String(pid.Ana), String(g.id), '0', '1');
  r.premesti(String(pid.Bea), String(g.id), 1, undefined);
  assert.equal(r.podaci('Z', 1).grupe[0].clanovi.length, 2);
  r.premesti(pid.Ana, '0', 0, 1);
  r.premesti(pid.Bea, '', 0, 1);
  const d = r.podaci('Z', 1);
  assert.equal(d.grupe[0].clanovi.length, 0);
  assert.equal(d.nerasporedjeni.length, 4);
  r.premesti(pid.Ana, g.id, 0, 1);
  r.premesti(pid.Ana, null, 0, 1);
  assert.equal(r.podaci('Z', 1).nerasporedjeni.length, 4);
  assert.throws(() => r.premesti(pid.Ana, g.id, 0, 3), (e) => e instanceof GreskaKorisnika && /Rotacija mora biti između 1 i 2\./.test(e.message));
  assert.throws(() => r.premesti(pid.Marko, g.id, 0, 1), (e) => e instanceof GreskaKorisnika);
});

test('premesti: grupaId "abc" je neraspoređeni, rotacija 2.5 se skraćuje', () => {
  const { moduli, pid } = sa4();
  const r = moduli.rotacije;
  const g = r.dodaj('Z').grupa;
  r.premesti(pid.Ana, g.id, 0, 1);
  r.premesti(pid.Ana, 'abc', 0, 1);
  const d = r.podaci('Z', 1);
  assert.equal(d.grupe[0].clanovi.length, 0);
  assert.equal(d.nerasporedjeni.length, 4);
  assert.doesNotThrow(() => r.premesti(pid.Bea, g.id, 0, 2.5));
});

test('izmeni, obrisi, vrati', () => {
  const { moduli, pid } = sa4();
  const r = moduli.rotacije;
  const g = r.dodaj('Z').grupa;
  r.izmeni(String(g.id), ' Moja ', '2');
  const x = r.podaci('Z', 1).grupe[0];
  assert.equal(x.naziv, 'Moja');
  assert.equal(x.pocetna_pozicija, 2);
  assert.throws(() => r.izmeni(g.id, ' ', 1), (e) => e instanceof GreskaKorisnika && e.message === 'Naziv grupe je obavezan.');
  r.premesti(pid.Ana, g.id, 0, 1);
  r.premesti(pid.Bea, g.id, 1, 1);
  r.premesti(pid.Bea, g.id, 0, 2);
  assert.equal(r.podaci('Z', 2).grupe[0].rucni_rot, true);
  r.vrati(String(g.id), '2');
  assert.equal(r.podaci('Z', 2).grupe[0].rucni_rot, false);
  assert.throws(() => r.obrisi(g.id), (e) => e instanceof GreskaKorisnika && /Prvo je ispraznite/.test(e.message));
  r.premesti(pid.Ana, 0, 0, 1);
  r.premesti(pid.Bea, 0, 0, 1);
  r.obrisi(String(g.id));
  assert.equal(r.podaci('Z', 1).grupe.length, 0);
});

test('pomeraj: PHP istinitost', () => {
  const { moduli } = sa4();
  const r = moduli.rotacije;
  assert.equal(r.pomeraj('0'), 0);
  assert.equal(r.podaci('Z', 1).pomeraj, false);
  assert.equal(r.pomeraj(true), 1);
  assert.equal(r.podaci('Z', 1).pomeraj, true);
  for (const v of ['', 0, false, null, undefined]) assert.equal(r.pomeraj(v), 0, String(v));
  assert.equal(r.pomeraj('1'), 1);
  assert.equal(r.pomeraj('da'), 1);
});

test('zavrsi: tri slucaja', () => {
  const o = pravi();
  const s = tokSeme(o.baza);
  const r = o.moduli.rotacije;
  o.moduli.pol.postavi('Z');
  o.moduli.takmicenja.otvori(String(s.takm));
  let z = r.zavrsi();
  assert.equal(z.ide, 'prijave');
  assert.deepEqual(z.poruka, { tekst: 'Još nema prijava. Prvo prijavite takmičare.', vrsta: 'upozorenje' });
  o.moduli.prijave.dodaj([s.t.Ana, s.t.Bea]);
  z = r.zavrsi();
  assert.equal(z.ide, 'takmicenje');
  assert.deepEqual(z.poruka, { tekst: 'Takmičari koji nisu raspoređeni u grupe: 2. Njih neće biti u unosu ocena dok se ne rasporede.', vrsta: 'upozorenje' });
  const g = r.dodaj('Z').grupa;
  for (const t of [s.t.Ana, s.t.Bea]) {
    r.premesti(Number(o.baza.vrednost('SELECT id FROM prijave WHERE takmicar_id = ?', [t])), g.id, 0, 1);
  }
  z = r.zavrsi();
  assert.deepEqual(z.poruka, { tekst: 'Priprema je završena: svi prijavljeni su raspoređeni u grupe.', vrsta: 'ok' });
  assert.equal(z.ide, 'takmicenje');
  assert.equal(z.stanje.nerasporedjeni, 0);
  assert.doesNotThrow(() => structuredClone(z));
});

// --- Izabrani pol (T4) ---
test('rotacije: pol iz renderera se zanemaruje, sve ide za izabrani pol', () => {
  const o = sa4();
  const r = o.moduli.rotacije;
  assert.equal(r.podaci('M', 1).pol, 'Z', 'ZSG deo ne moze da zatrazi MSG podatke');
  assert.equal(r.podaci(undefined, 1).pol, 'Z');
  assert.equal(r.podaci('M', 1).sprave.length, 2);
  assert.equal(r.dodaj('M').grupa.pol, 'Z');
  assert.equal(o.baza.vrednost("SELECT COUNT(*) FROM grupe WHERE pol = 'M'"), 0);
  o.moduli.pol.postavi('M');
  o.moduli.takmicenja.otvori(String(o.s.takmM));
  assert.equal(r.podaci('Z', 1).pol, 'M');
  assert.deepEqual(r.podaci('Z', 1).sprave.map((x) => x.skracenica), ['PA']);
  assert.equal(r.dodaj('Z').grupa.pol, 'M');
});

test('rotacije: grupa drugog pola se ponasa kao da ne postoji', () => {
  const o = sa4();
  const r = o.moduli.rotacije;
  const zg = r.dodaj('Z').grupa;
  o.moduli.pol.postavi('M');
  o.moduli.takmicenja.otvori(String(o.s.takmM));
  const nema = (f) => assert.throws(f, (e) => e instanceof GreskaKorisnika && /Grupa ne postoji/.test(e.message));
  nema(() => r.izmeni(zg.id, 'X', 1));
  nema(() => r.obrisi(zg.id));
  nema(() => r.vrati(zg.id, 2));
  assert.throws(() => r.premesti(o.pid.Marko, zg.id, 0, 1), GreskaKorisnika);
  assert.equal(o.baza.vrednost('SELECT COUNT(*) FROM grupe WHERE id = ?', [zg.id]), 1);
});
