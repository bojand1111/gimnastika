// Turnusi kroz IPC: rotacije, unos, zapisnici i pregled takmicenja nad :memory: bazom.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const dn = { info() {}, greska() {} };
const ULAZ = { d: '4,8', e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '' };

// ZSG takmicenje (PR, GR) sa Anom, Beom, Cecom i Donom. Sa dvaTurnusa: grupa A (turnus 1: Ana, Bea), grupa B (turnus 2: Ceca, Dona).
function pripremi(dvaTurnusa = true) {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const moduli = napraviModule(baza, { dialog, fasciklaPodataka: () => os.tmpdir(), dnevnik: dn, kopijaLista: () => [] });
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(s.takm));
  moduli.prijave.dodaj([s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona]);
  const pid = {};
  for (const ime of ['Ana', 'Bea', 'Ceca', 'Dona']) pid[ime] = Number(baza.vrednost('SELECT id FROM prijave WHERE takmicar_id = ?', [s.t[ime]]));
  let a = null;
  let b = null;
  if (dvaTurnusa) {
    a = moduli.rotacije.dodaj(1).grupa;
    b = moduli.rotacije.dodaj(2).grupa;
    moduli.rotacije.premesti(pid.Ana, a.id, 0, 1);
    moduli.rotacije.premesti(pid.Bea, a.id, 1, 1);
    moduli.rotacije.premesti(pid.Ceca, b.id, 0, 1);
    moduli.rotacije.premesti(pid.Dona, b.id, 1, 1);
  }
  return { baza, moduli, s, pid, a, b };
}

// Unese sve ocene turnusa 1 (Ana i Bea na obe sprave).
function zavrsiTurnus1({ moduli, s, pid }) {
  for (const sp of [s.pr, s.gr]) for (const ime of ['Ana', 'Bea']) moduli.unos.potvrdi(pid[ime], sp, ULAZ, '');
}

test('api: rotacije ima predlog i rasporedi', () => {
  assert.ok(MODULI.rotacije.includes('predlog'));
  assert.ok(MODULI.rotacije.includes('rasporedi'));
});

test('rotacije.podaci sa dva turnusa vraca samo grupe izabranog turnusa', () => {
  const o = pripremi();
  const d1 = o.moduli.rotacije.podaci(1, 1);
  assert.deepEqual(d1.turnusi, [1, 2]);
  assert.equal(d1.turnus, 1);
  assert.deepEqual(d1.grupe.map((g) => [g.id, g.turnus]), [[o.a.id, 1]]);
  const d2 = o.moduli.rotacije.podaci(1, 2);
  assert.equal(d2.turnus, 2);
  assert.deepEqual(d2.grupe.map((g) => g.id), [o.b.id]);
  assert.equal(d2.grupe[0].sprava.naziv, 'Preskok');
  assert.ok('ikona' in d2.grupe[0].sprava);
  assert.equal(d2.nerasporedjeni.length, 0);
  structuredClone(d2);
});

test('rotacije.podaci tu=5 pada na 1; bez grupa turnusi [1]', () => {
  const o = pripremi();
  assert.equal(o.moduli.rotacije.podaci(1, 5).turnus, 1);
  assert.equal(o.moduli.rotacije.podaci(1, 'x').turnus, 1);
  const p = pripremi(false);
  const d = p.moduli.rotacije.podaci(1);
  assert.deepEqual(d.turnusi, [1]);
  assert.equal(d.turnus, 1);
});

test('rotacije.izmeni menja turnus grupe', () => {
  const o = pripremi();
  o.moduli.rotacije.izmeni(o.b.id, 'Grupa B', 2, 1);
  assert.deepEqual(o.moduli.rotacije.podaci(1, 1).grupe.map((g) => g.id), [o.a.id, o.b.id]);
  assert.deepEqual(o.moduli.rotacije.podaci(1).turnusi, [1]);
});

test('rotacije.predlog i rasporedi pa podaci: turnusi [1,2]', () => {
  const o = pripremi(false);
  const param = { maksimum: 1, poKategoriji: true, poKlubu: true, turnusPoKategoriji: false };
  const pr = o.moduli.rotacije.predlog(param);
  assert.equal(pr.ukupno, 4);
  assert.equal(pr.turnusi.length, 2);
  assert.equal(pr.imaGrupa, false);
  assert.equal(o.baza.vrednost('SELECT COUNT(*) FROM grupe'), 0);
  assert.deepEqual(o.moduli.rotacije.rasporedi(param), { grupa: 4, turnusa: 2 });
  assert.deepEqual(o.moduli.rotacije.podaci(1).turnusi, [1, 2]);
  assert.equal(o.moduli.rotacije.podaci(1, 2).grupe.length, 2);
});

test('unos.podaci: turnus 2 sprava 1 rot 1 daje prvu grupu turnusa 2', () => {
  const o = pripremi();
  const d = o.moduli.unos.podaci(o.s.pr, 1, 2);
  assert.equal(d.turnus, 2);
  assert.deepEqual(d.turnusi, [1, 2]);
  assert.equal(d.grupa.id, o.b.id);
  assert.deepEqual(d.redovi.map((r) => r.prijava_id), [o.pid.Ceca, o.pid.Dona]);
  assert.equal(o.moduli.unos.podaci(o.s.pr, 1, 1).grupa.id, o.a.id);
});

test('unos.podaci bez tu nastavlja u prvom nezavrsenom turnusu', () => {
  const o = pripremi();
  const pre = o.moduli.unos.podaci();
  assert.equal(pre.turnus, 1);
  assert.equal(pre.grupa.id, o.a.id);
  zavrsiTurnus1(o);
  const posle = o.moduli.unos.podaci();
  assert.equal(posle.turnus, 2);
  assert.equal(posle.rot, 1);
  assert.equal(posle.grupa.id, o.b.id);
  // nepostojeci turnus iz URL-a pada na turnus napretka
  assert.equal(o.moduli.unos.podaci(o.s.pr, 1, 9).turnus, 2);
});

test('zapisnici sa dva turnusa: listovi turnus 1 pa turnus 2, polje turnus', () => {
  const o = pripremi();
  const z = o.moduli.unos.zapisnici();
  assert.deepEqual(z.listovi.map((l) => [l.turnus, l.sprava.id, l.rot, l.grupa]), [
    [1, o.s.pr, 1, 'Grupa A'], [1, o.s.gr, 2, 'Grupa A'], [2, o.s.pr, 1, 'Grupa B'], [2, o.s.gr, 2, 'Grupa B']]);
  z.listovi.forEach((l) => assert.equal(l.turnusa, 2));
});

test('zapisnici bez grupa: Svi prijavljeni kao pre, turnus null', () => {
  const o = pripremi(false);
  const z = o.moduli.unos.zapisnici();
  assert.deepEqual(z.listovi.map((l) => [l.turnus, l.rot, l.grupa]), [[null, null, 'Svi prijavljeni'], [null, null, 'Svi prijavljeni']]);
});

test('takmicenje.podaci: posle turnusa 1 nastavak je u turnusu 2, hash sa tu', () => {
  const o = pripremi();
  const pre = o.moduli.takmicenje.podaci();
  assert.equal(pre.napredak.turnus, 1);
  assert.equal(pre.napredak.broj_turnusa, 2);
  assert.equal(pre.unosHash, `#/unos?sprava=${o.s.pr}&rot=1&tu=1`);
  zavrsiTurnus1(o);
  const d = o.moduli.takmicenje.podaci();
  assert.equal(d.napredak.turnus, 2);
  assert.equal(d.napredak.rotacija, 1);
  assert.equal(d.nastavi.turnus, 2);
  assert.equal(Number(d.nastavi.sprava.id), o.s.pr);
  assert.equal(d.nastavi.ukupno, 2);
  assert.equal(d.unosHash, `#/unos?sprava=${o.s.pr}&rot=1&tu=2`);
});
