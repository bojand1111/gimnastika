// Faza 7: IPC moduli pocetna i takmicenje (Pregled) nad :memory: bazom.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');
const { uvezi } = require('../alati/primer-podaci.cjs');
const json = require('../docs/proizvod/dizajn/primer-podaci.json');

const NEMA_AKTIVNOG = 'Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.';
const dn = { info() {}, greska() {} };

function pravi(opcije = {}) {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const moduli = napraviModule(baza, { dialog, fasciklaPodataka: () => os.tmpdir(), dnevnik: dn, kopijaLista: opcije.kopijaLista ?? (() => []) });
  return { baza, moduli };
}
// Primer ima dva takmicenja (ZSG i MSG); izabran je ZSG deo.
function sPrimerom(opcije) {
  const o = pravi(opcije);
  uvezi(o.baza, json);
  o.baza.ubaci('podesavanja', { kljuc: 'aktivni_pol', vrednost: 'Z' });
  return o;
}
// Seme: aktivno ZSG takmicenje sa 4 prijave i jednom grupom (Ana, Bea, Ceca) na pocetnoj poziciji 1; Marko je prijavljen u MSG takmicenju.
function sSemom(saGrupom = true) {
  const o = pravi();
  const s = tokSeme(o.baza);
  o.moduli.pol.postavi('Z');
  o.moduli.takmicenja.otvori(String(s.takm));
  o.moduli.prijave.dodaj([s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona]);
  o.moduli.pol.postavi('M');
  o.moduli.takmicenja.otvori(String(s.takmM));
  o.moduli.prijave.dodaj([s.muski]);
  o.moduli.pol.postavi('Z');
  o.moduli.takmicenja.otvori(String(s.takm));
  const pid = {};
  for (const [ime, id] of Object.entries({ Ana: s.t.Ana, Bea: s.t.Bea, Ceca: s.t.Ceca, Dona: s.t.Dona, Marko: s.muski })) {
    pid[ime] = Number(o.baza.vrednost('SELECT id FROM prijave WHERE takmicar_id = ?', [id]));
  }
  if (saGrupom) {
    const g = o.moduli.rotacije.dodaj('Z').grupa;
    for (const [i, ime] of ['Ana', 'Bea', 'Ceca'].entries()) o.moduli.rotacije.premesti(pid[ime], g.id, i, 1);
  }
  return { ...o, s, pid };
}

test('guard: pocetna i takmicenje imaju handler', () => {
  const { moduli } = pravi();
  assert.deepEqual(MODULI.pocetna, ['podaci']);
  assert.deepEqual(MODULI.takmicenje, ['podaci']);
  const ipc = { kanali: {}, handle(k, fn) { this.kanali[k] = fn; } };
  registruj(ipc, moduli, dn, Object.fromEntries(Object.keys(moduli).map((k) => [k, MODULI[k]])));
  assert.ok(ipc.kanali['gim:pocetna:podaci']);
  assert.ok(ipc.kanali['gim:takmicenje:podaci']);
});

test('takmicenje.podaci bez aktivnog baca poruku, pocetna.podaci radi', () => {
  const { moduli } = pravi();
  assert.throws(() => moduli.takmicenje.podaci(), (e) => e instanceof GreskaKorisnika && e.message === NEMA_AKTIVNOG);
  const d = moduli.pocetna.podaci();
  assert.equal(d.takm, null);
  assert.equal(d.stanje, null);
  assert.deepEqual(d.ostala, []);
  assert.deepEqual(d.lekarski, []);
  assert.equal(d.poslednjaKopija, null);
  assert.ok(Array.isArray(d.precice));
  structuredClone(d);
});

test('pocetna.podaci nad primerom: spremno, lekarski upozorenja, bez ostalih', () => {
  const { moduli, baza } = sPrimerom();
  const d = moduli.pocetna.podaci();
  assert.equal(d.stanje.korak, 'spremno');
  assert.deepEqual(d.ostala, []);
  const imena = d.lekarski.map((r) => `${r.prezime} ${r.ime}`);
  // ZSG deo: samo upozorenja za ZSG takmicenja
  for (const ime of ['Simić Dunja', 'Nikolić Teodora']) assert.ok(imena.includes(ime), ime);
  assert.ok(!imena.includes('Stanković Luka'));
  structuredClone(d);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(baza.vrednost("SELECT id FROM takmicenja WHERE pol = 'M'")));
  const m = moduli.pocetna.podaci();
  assert.equal(m.stanje.korak, 'spremno');
  assert.deepEqual(m.ostala, []);
  const imenaM = m.lekarski.map((r) => `${r.prezime} ${r.ime}`);
  assert.ok(imenaM.includes('Stanković Luka'));
  assert.ok(!imenaM.includes('Simić Dunja'));
});

test('pocetna.podaci: ostala su sva osim aktivnog, svako sa stanjem', () => {
  const { moduli, baza, s } = sSemom();
  baza.ubaci('takmicenja', { naziv: 'Stari kup', datum: '2025-05-05', mesto: '', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje',
    ekipno_broji: 1, pol: 'Z', kreirano: '2026-01-01 00:00:00', izmenjeno: '2026-01-01 00:00:00' });
  baza.ubaci('takmicenja', { naziv: 'Stari MSG kup', datum: '2025-05-05', mesto: '', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje',
    ekipno_broji: 1, pol: 'M', kreirano: '2026-01-01 00:00:00', izmenjeno: '2026-01-01 00:00:00' });
  const d = moduli.pocetna.podaci();
  assert.equal(Number(d.takm.id), s.takm);
  // MSG takmicenja (Test kup i Stari MSG kup) nisu u ZSG delu
  assert.equal(d.ostala.length, 1);
  assert.equal(d.ostala[0].naziv, 'Stari kup');
  assert.equal(d.ostala[0].stanje.prijava, 0);
  assert.ok(d.ostala.every((r) => Number(r.id) !== s.takm));
});

test('pocetna.podaci: poslednjaKopija iz kopijaLista (prva), danas i tekst lokalno', () => {
  const sada = new Date();
  const vreme = new Date(sada.getFullYear(), sada.getMonth(), sada.getDate(), 0, 5).getTime();
  const juce = new Date(sada.getFullYear(), sada.getMonth(), sada.getDate() - 1, 23, 59).getTime();
  const a = pravi({ kopijaLista: () => [{ ime: 'k1.sqlite', vreme }, { ime: 'k0.sqlite', vreme: juce }] });
  const d = a.moduli.pocetna.podaci();
  const p2 = (n) => String(n).padStart(2, '0');
  assert.equal(d.poslednjaKopija.ime, 'k1.sqlite');
  assert.equal(d.poslednjaKopija.vreme, vreme);
  assert.equal(d.poslednjaKopija.danas, true);
  assert.equal(d.poslednjaKopija.tekst, `${p2(sada.getDate())}.${p2(sada.getMonth() + 1)}.${sada.getFullYear()}. 00:05`);
  const b = pravi({ kopijaLista: () => [{ ime: 'k0.sqlite', vreme: juce }] });
  assert.equal(b.moduli.pocetna.podaci().poslednjaKopija.danas, false);
  assert.equal(pravi({ kopijaLista: () => [] }).moduli.pocetna.podaci().poslednjaKopija, null);
  structuredClone(d);
});

// Svako takmicenje ima svoj pol, pa i svoj napredak.
test('takmicenje.podaci nad primerom: ZSG i MSG gotovi, svako sa svojim polom, nastavi null, #/unos', () => {
  const { moduli, baza } = sPrimerom();
  const d = moduli.takmicenje.podaci();
  assert.equal(d.napredak.pol, 'Z');
  assert.equal(d.napredak.gotovo, true);
  assert.equal(d.napredak.rotacija, d.napredak.ukupno_rotacija);
  assert.equal(d.nastavi, null);
  assert.equal(d.unosHash, '#/unos');
  assert.equal(d.brojevi.prijava, d.stanje.prijava);
  structuredClone(d);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(baza.vrednost("SELECT id FROM takmicenja WHERE pol = 'M'")));
  const m = moduli.takmicenje.podaci();
  assert.equal(m.napredak.pol, 'M');
  assert.equal(m.napredak.gotovo, true);
  assert.equal(m.nastavi, null);
});

test('takmicenje.podaci nad semom: Z u toku, nastavi na PR, uneto 0, hash sa pol sprava rot', () => {
  const { moduli, s } = sSemom();
  const d = moduli.takmicenje.podaci();
  assert.equal(d.napredak.pol, 'Z');
  assert.equal(d.napredak.rotacija, 1);
  assert.equal(d.napredak.ukupno_rotacija, 2);
  assert.equal(d.napredak.gotovo, false);
  assert.equal(Number(d.nastavi.sprava.id), s.pr);
  assert.equal(d.nastavi.sprava.skracenica, 'PR');
  assert.equal(d.nastavi.rotacija, 1);
  assert.equal(d.nastavi.uneto, 0);
  assert.equal(d.nastavi.ukupno, 3);
  assert.equal(d.nastavi.pol, 'Z');
  assert.equal(d.unosHash, `#/unos?sprava=${s.pr}&rot=1`);
  assert.equal(d.danUNedelji, 'Subota');
  assert.equal(d.datumTekst, '17.10.2026.');
  assert.deepEqual(d.brojevi, { prijava: 4, klubova: 2 });
  structuredClone(d);
});

test('takmicenje.podaci: uneta prva ocena povecava uneto', () => {
  const { moduli, pid, s } = sSemom();
  moduli.unos.potvrdi(pid.Ana, s.pr, { d: '4,8', e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '' }, '');
  const d = moduli.takmicenje.podaci();
  assert.equal(d.nastavi.uneto, 1);
  assert.equal(d.nastavi.ukupno, 3);
});

test('takmicenje.podaci bez grupa: napredak null, nastavi null, #/unos', () => {
  const { moduli } = sSemom(false);
  const d = moduli.takmicenje.podaci();
  assert.equal(d.napredak, null);
  assert.equal(d.nastavi, null);
  assert.equal(d.unosHash, '#/unos');
  structuredClone(d);
});

const OCENA = { d: '4,8', e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '' };

test('takmicenje.podaci: MSG takmicenje u toku, nastavi je na prvoj nezavrsenoj spravi M', () => {
  const { moduli, pid, s } = sSemom();
  for (const sprava of [s.pr, s.gr]) {
    for (const ime of ['Ana', 'Bea', 'Ceca']) moduli.unos.potvrdi(pid[ime], sprava, OCENA, '');
  }
  // Z deo je gotov; MSG takmicenje je zasebno i ima svoj napredak
  assert.equal(moduli.takmicenje.podaci().napredak.gotovo, true);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  const m = moduli.rotacije.dodaj('M').grupa;
  moduli.rotacije.premesti(pid.Marko, m.id, 0, 1);
  const d = moduli.takmicenje.podaci();
  assert.equal(d.napredak.pol, 'M');
  assert.equal(d.napredak.gotovo, false);
  assert.equal(d.nastavi.pol, 'M');
  assert.equal(Number(d.nastavi.sprava.id), s.pa);
  assert.equal(d.nastavi.uneto, 0);
  assert.equal(d.nastavi.ukupno, 1);
  assert.equal(d.unosHash, `#/unos?sprava=${s.pa}&rot=1`);
});

test('takmicenje.podaci: kad je prva sprava potpuno uneta, nastavi prelazi na drugu', () => {
  const { moduli, pid, s } = sSemom();
  for (const ime of ['Ana', 'Bea', 'Ceca']) moduli.unos.potvrdi(pid[ime], s.pr, OCENA, '');
  const d = moduli.takmicenje.podaci();
  assert.equal(d.napredak.pol, 'Z');
  assert.equal(d.napredak.gotovo, false);
  assert.equal(d.nastavi.pol, 'Z');
  assert.equal(d.napredak.rotacija, 2);
  assert.equal(Number(d.nastavi.sprava.id), s.gr);
  assert.equal(d.nastavi.rotacija, 2);
  assert.equal(d.nastavi.uneto, 0);
  assert.equal(d.nastavi.ukupno, 3);
  assert.equal(d.unosHash, `#/unos?sprava=${s.gr}&rot=2`);
});

// --- Izabrani pol (T4) ---
test('PRECICE: prebacivanje na MSG i ZSG', () => {
  const { PRECICE } = require('../electron/pregled-paket.cjs');
  assert.deepEqual(PRECICE.slice(-2), [['Prebaci na MSG', ['Alt', 'M']], ['Prebaci na ŽSG', ['Alt', 'Z']]]);
  assert.ok(pravi().moduli.pocetna.podaci().precice.some(([t, k]) => t === 'Prebaci na ŽSG' && k.join('+') === 'Alt+Z'));
});

test('pocetna.podaci: pol, lekarski i ostala samo za izabrani pol', () => {
  const { moduli, baza } = sPrimerom();
  for (const [naziv, pol] of [['Drugi ZSG kup', 'Z'], ['Drugi MSG kup', 'M']]) {
    baza.ubaci('takmicenja', { naziv, datum: '2025-05-05', mesto: '', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje',
      ekipno_broji: 1, pol, kreirano: '2026-01-01 00:00:00', izmenjeno: '2026-01-01 00:00:00' });
  }
  const z = moduli.pocetna.podaci();
  assert.equal(z.pol, 'Z');
  assert.deepEqual(z.ostala.map((r) => r.naziv), ['Drugi ZSG kup']);
  const imenaZ = z.lekarski.map((r) => `${r.prezime} ${r.ime}`);
  assert.ok(imenaZ.includes('Simić Dunja'));
  assert.ok(!imenaZ.includes('Stanković Luka'));
  assert.equal(moduli.pol.postavi('M'), 'M');
  const m = moduli.pocetna.podaci();
  assert.equal(m.pol, 'M');
  assert.equal(m.takm.pol, 'M', 'MSG deo ima svoje aktivno takmicenje');
  const imenaM = m.lekarski.map((r) => `${r.prezime} ${r.ime}`);
  assert.ok(imenaM.includes('Stanković Luka'));
  assert.ok(!imenaM.includes('Simić Dunja'));
  assert.deepEqual(m.ostala.map((r) => r.naziv), ['Drugi MSG kup']);
  structuredClone(m);
});

test('takmicenje.podaci: napredak i nastavi samo za pol takmicenja, link bez pol=', () => {
  const { moduli, pid, s } = sSemom();
  // grupa postoji samo u ZSG; MSG takmicenje nema grupa pa nema ni napretka
  moduli.pol.postavi('M');
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  const m = moduli.takmicenje.podaci();
  assert.equal(m.napredak, null);
  assert.equal(m.nastavi, null);
  assert.equal(m.unosHash, '#/unos');
  const g = moduli.rotacije.dodaj('M').grupa;
  moduli.rotacije.premesti(pid.Marko, g.id, 0, 1);
  const m2 = moduli.takmicenje.podaci();
  assert.equal(m2.napredak.pol, 'M');
  assert.equal(m2.unosHash, `#/unos?sprava=${s.pa}&rot=1`);
  moduli.pol.postavi('Z');
  const z = moduli.takmicenje.podaci();
  assert.equal(z.napredak.pol, 'Z');
  assert.equal(z.unosHash, `#/unos?sprava=${s.pr}&rot=1`);
});
