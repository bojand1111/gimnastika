const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviPrijave } = require('../electron/modeli/prijave.cjs');
const { napravi: napraviTakmicenja } = require('../electron/modeli/takmicenja.cjs');
const { napravi } = require('../electron/modeli/grupe.cjs');
const { pozicijaURotaciji, redosledURotaciji, grupaNaSpravi } = require('../electron/racun/grupe.mjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const S = '2026-01-01 00:00:00';

// Baza sa semom i prijavama Ana, Bea, Ceca, Dona (Z) i Marko (M).
function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const s = tokSeme(baza);
  const prijave = napraviPrijave(baza, napraviPodesavanja(baza, ''));
  prijave.dodajVise(s.takm, [s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona, s.muski]);
  const pid = {};
  for (const r of baza.svi('SELECT p.id, t.ime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.takmicenje_id = ?', [s.takm])) pid[r.ime] = r.id;
  return { baza, s, pid, prijave, g: napravi(baza), takm: napraviTakmicenja(baza, '') };
}

function drugoTakmicenje(baza) {
  return baza.ubaci('takmicenja', { naziv: 'Drugo', datum: '2026-10-18', mesto: 'NS', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje', ekipno_broji: 1, kreirano: S, izmenjeno: S });
}

function poruka(fn) {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  return null;
}

const ids = (redovi) => redovi.map((r) => r.prijava_id);
const c = (...v) => v.map((id) => ({ prijava_id: id }));

// Redosled id-jeva prijava u rotaciji (kao PHP uRot).
function uRot(g, takm, grupaId, rot, pomeraj = false) {
  const gr = g.lista(takm, 'Z').find((x) => x.id === grupaId);
  return ids(redosledURotaciji(gr.clanovi, rot, pomeraj, gr.rucni[rot] ?? null));
}

test('tok grupa i rotacija (POPIS 8.1)', () => {
  const { baza, s, pid, g } = nova();
  assert.equal(pozicijaURotaciji(1, 1, 4), 1);
  assert.equal(pozicijaURotaciji(1, 2, 4), 2);
  assert.equal(pozicijaURotaciji(4, 2, 4), 1);
  assert.equal(pozicijaURotaciji(2, 6, 4), 3);
  assert.deepEqual(redosledURotaciji(c(1, 2, 3), 3, false), c(1, 2, 3));
  assert.deepEqual(redosledURotaciji(c(1, 2, 3), 2, true), c(2, 3, 1));
  assert.deepEqual(redosledURotaciji(c(1, 2, 3), 3, true), c(3, 1, 2));
  assert.deepEqual(redosledURotaciji(c(1, 2, 3), 4, true), c(1, 2, 3));

  const a = g.dodaj(s.takm, 'Z');
  const bb = g.dodaj(s.takm, 'Z');
  assert.equal(g.nadji(a).naziv, 'Grupa A');
  assert.equal(g.nadji(bb).naziv, 'Grupa B');
  assert.equal(g.nadji(bb).pocetna_pozicija, 2);
  assert.equal(g.nerasporedjeni(s.takm, 'Z').length, 4);

  g.premesti(s.takm, pid.Ana, a, 0);
  g.premesti(s.takm, pid.Bea, a, 1);
  g.premesti(s.takm, pid.Ceca, a, 0);
  assert.deepEqual(ids(g.clanovi(a)), [pid.Ceca, pid.Ana, pid.Bea]);
  g.premesti(s.takm, pid.Ceca, a, 2);
  assert.deepEqual(ids(g.clanovi(a)), [pid.Ana, pid.Bea, pid.Ceca]);
  g.premesti(s.takm, pid.Bea, bb, 0);
  assert.deepEqual(ids(g.clanovi(a)), [pid.Ana, pid.Ceca]);
  assert.deepEqual(g.clanovi(a).map((r) => r.redosled), [1, 2]);
  g.premesti(s.takm, pid.Bea, null, 0);
  assert.equal(g.nerasporedjeni(s.takm, 'Z').length, 2);

  assert.ok(poruka(() => g.obrisi(s.takm, a)));
  g.obrisi(s.takm, bb);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupe WHERE id = ?', [bb]), 0);

  const lista = g.lista(s.takm, 'Z');
  const gr = grupaNaSpravi(lista, 2, 2, 2, true);
  assert.equal(gr.id, a);
  assert.deepEqual(ids(gr.clanovi), [pid.Ceca, pid.Ana]);
  assert.equal(grupaNaSpravi(lista, 1, 2, 2, true), null);
});

test('redosled po rotaciji (POPIS 8.2)', () => {
  const { baza, s, pid, g } = nova();
  const T = s.takm;
  assert.deepEqual(redosledURotaciji(c(1, 2, 3), 2, true, [3, 1, 2]), c(3, 1, 2));
  assert.deepEqual(redosledURotaciji(c(1, 2, 3, 4), 2, false, [2, 9, 1]), c(2, 1, 3, 4));
  assert.deepEqual(redosledURotaciji(c(1, 2, 3), 2, true, []), c(2, 3, 1));

  const a = g.dodaj(T, 'Z');
  const bb = g.dodaj(T, 'Z');
  const { Ana, Bea, Ceca, Dona } = pid;
  g.premesti(T, Ana, a, 0);
  g.premesti(T, Bea, a, 1);
  g.premesti(T, Ceca, a, 2);

  g.premesti(T, Ceca, a, 0, 2);
  assert.deepEqual(uRot(g, T, a, 2), [Ceca, Ana, Bea]);
  assert.deepEqual(uRot(g, T, a, 1), [Ana, Bea, Ceca]);
  assert.deepEqual(g.rucniRedosledi(a), { 2: [Ceca, Ana, Bea] });

  g.premesti(T, Bea, a, 0, 1);
  assert.deepEqual(uRot(g, T, a, 1), [Bea, Ana, Ceca]);
  assert.deepEqual(uRot(g, T, a, 2), [Ceca, Ana, Bea]);
  assert.deepEqual(ids(grupaNaSpravi(g.lista(T, 'Z'), 2, 2, 2, false).clanovi), [Ceca, Ana, Bea]);

  g.premesti(T, Ceca, a, 2, 2);
  assert.deepEqual(uRot(g, T, a, 2), [Ana, Bea, Ceca]);
  g.premesti(T, Bea, a, 0, 2);
  assert.deepEqual(g.rucniRedosledi(a), {}, 'redosled jednak osnovnom se ne pamti');

  g.premesti(T, Dona, a, 0, 2);
  assert.deepEqual(uRot(g, T, a, 2), [Dona, Bea, Ana, Ceca]);
  assert.deepEqual(uRot(g, T, a, 1), [Bea, Ana, Ceca, Dona]);

  g.premesti(T, Ana, bb, 0, 2);
  assert.deepEqual(uRot(g, T, a, 2), [Dona, Bea, Ceca]);
  assert.deepEqual(uRot(g, T, a, 1), [Bea, Ceca, Dona]);
  assert.deepEqual(uRot(g, T, bb, 1), [Ana]);
  assert.deepEqual(uRot(g, T, bb, 2), [Ana]);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupa_redosled WHERE prijava_id = ?', [Ana]), 0);

  assert.deepEqual(uRot(g, T, a, 2, true), [Dona, Bea, Ceca], 'rucni ima prednost nad pomeranjem');
  g.vratiRedosled(T, a, 2);
  assert.deepEqual(uRot(g, T, a, 2, true), [Ceca, Dona, Bea]);
  assert.deepEqual(uRot(g, T, a, 2), [Bea, Ceca, Dona]);

  assert.ok(poruka(() => g.premesti(T, Bea, a, 0, 3)));
  g.premesti(T, Dona, a, 0, 2);
  baza.izvrsi('DELETE FROM prijave WHERE id = ?', [Dona]);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupa_redosled WHERE prijava_id = ?', [Dona]), 0);
});

test('rotacija 1 ne menja ostale (POPIS 8.3)', () => {
  const { baza, s, pid, g } = nova();
  const T = s.takm;
  const { Ana, Bea, Ceca, Dona } = pid;
  const a = g.dodaj(T, 'Z');
  g.premesti(T, Ana, a, 0);
  g.premesti(T, Bea, a, 1);
  g.premesti(T, Ceca, a, 2);
  assert.deepEqual(uRot(g, T, a, 2), [Ana, Bea, Ceca]);
  assert.deepEqual(g.rucniRedosledi(a), {});

  g.premesti(T, Ceca, a, 0, 1);
  assert.deepEqual(uRot(g, T, a, 1), [Ceca, Ana, Bea]);
  assert.deepEqual(uRot(g, T, a, 2), [Ana, Bea, Ceca]);

  g.vratiRedosled(T, a, 2);
  assert.deepEqual(uRot(g, T, a, 2), [Ceca, Ana, Bea]);

  baza.izvrsi('UPDATE takmicenja SET pomeraj_redosled = 1 WHERE id = ?', [T]);
  assert.deepEqual(uRot(g, T, a, 2, true), [Ana, Bea, Ceca]);
  g.premesti(T, Bea, a, 0, 1);
  assert.deepEqual(uRot(g, T, a, 1, true), [Bea, Ceca, Ana]);
  assert.deepEqual(uRot(g, T, a, 2, true), [Ana, Bea, Ceca]);

  g.premesti(T, Dona, a, 0, 1);
  assert.deepEqual(uRot(g, T, a, 1, true), [Dona, Bea, Ceca, Ana]);
  assert.deepEqual(uRot(g, T, a, 2, true), [Ana, Bea, Ceca, Dona]);
});

test('dodaj: nazivi, redosled i pocetna pozicija (POPIS 8.4)', () => {
  const { baza, s, g } = nova();
  const T = s.takm;
  const a = g.dodaj(T, 'Z');
  g.dodaj(T, 'Z');
  g.obrisi(T, a);
  const nova3 = g.dodaj(T, 'Z');
  assert.equal(g.nadji(nova3).naziv, 'Grupa B2');
  assert.deepEqual(g.lista(T, 'Z').map((x) => x.naziv), ['Grupa B', 'Grupa B2']);
  // redosled je n + 1 (posle brisanja ponavlja vrednost); lista je stabilna po redosled, id
  assert.deepEqual(g.lista(T, 'Z').map((x) => x.redosled), [2, 2]);
  assert.equal(g.nadji(nova3).pocetna_pozicija, 2);

  // treca grupa uz 2 sprave: pocetna_pozicija 1
  const T2 = drugoTakmicenje(baza);
  const [g1, g2, g3] = [g.dodaj(T2, 'Z'), g.dodaj(T2, 'Z'), g.dodaj(T2, 'Z')];
  assert.deepEqual([g1, g2, g3].map((i) => g.nadji(i).pocetna_pozicija), [1, 2, 1]);
  assert.deepEqual([g1, g2, g3].map((i) => g.nadji(i).redosled), [1, 2, 3]);
  assert.equal(g.nadji(g.dodaj(T2, 'M')).pocetna_pozicija, 1);
  assert.equal(g.brojSprava('Z'), 2);
  assert.equal(g.brojSprava('M'), 1);
  assert.equal(g.brojSprava('X'), 1);
  assert.equal(poruka(() => g.dodaj(T2, 'X')), 'Nepoznat pol.');
});

test('izmeni, obrisi i vratiRedosled: poruke', () => {
  const { s, pid, g } = nova();
  const T = s.takm;
  const a = g.dodaj(T, 'Z');
  assert.equal(poruka(() => g.izmeni(T + 100, a, 'X', 1)), 'Grupa ne postoji.');
  assert.equal(poruka(() => g.izmeni(T, a + 100, 'X', 1)), 'Grupa ne postoji.');
  assert.equal(poruka(() => g.izmeni(T, a, '   ', 1)), 'Naziv grupe je obavezan.');
  assert.equal(poruka(() => g.izmeni(T, a, 'X', 0)), 'Početna sprava mora biti između 1 i 2.');
  assert.equal(poruka(() => g.izmeni(T, a, 'X', 3)), 'Početna sprava mora biti između 1 i 2.');
  g.izmeni(T, a, '  Mlade  ', 2);
  assert.equal(g.nadji(a).naziv, 'Mlade');
  assert.equal(g.nadji(a).pocetna_pozicija, 2);
  g.premesti(T, pid.Ana, a, 0);
  assert.equal(poruka(() => g.obrisi(T, a)), 'Grupa ima 1 takmičara. Prvo je ispraznite.');
  assert.equal(poruka(() => g.obrisi(T + 100, a)), 'Grupa ne postoji.');
  assert.equal(poruka(() => g.vratiRedosled(T, a + 100, 2)), 'Grupa ne postoji.');
});

test('premesti: greske i granice pozicije', () => {
  const { baza, s, pid, g } = nova();
  const T = s.takm;
  const a = g.dodaj(T, 'Z');
  const m = g.dodaj(T, 'M');
  assert.equal(poruka(() => g.premesti(T, pid.Ana + 1000, a, 0)), 'Prijava ne postoji.');
  const T2 = drugoTakmicenje(baza);
  assert.equal(poruka(() => g.premesti(T2, pid.Ana, a, 0)), 'Prijava ne postoji.');
  assert.equal(poruka(() => g.premesti(T, pid.Marko, a, 0)), 'Grupa ne postoji ili nije za taj pol.');
  assert.equal(poruka(() => g.premesti(T, pid.Ana, m, 0)), 'Grupa ne postoji ili nije za taj pol.');
  assert.equal(poruka(() => g.premesti(T, pid.Ana, a + 1000, 0)), 'Grupa ne postoji ili nije za taj pol.');
  const tudja = g.dodaj(T2, 'Z');
  assert.equal(poruka(() => g.premesti(T, pid.Ana, tudja, 0)), 'Grupa ne postoji ili nije za taj pol.');
  assert.equal(poruka(() => g.premesti(T, pid.Ana, a, 0, 0)), 'Rotacija mora biti između 1 i 2.');
  assert.equal(poruka(() => g.premesti(T, pid.Ana, a, 0, 3)), 'Rotacija mora biti između 1 i 2.');
  assert.equal(poruka(() => g.premesti(T, pid.Marko, m, 0, 2)), 'Rotacija mora biti između 1 i 1.');
  // za neraspodeljene se rotacija ne proverava
  assert.equal(poruka(() => g.premesti(T, pid.Ana, null, 0, 9)), null);
  g.premesti(T, pid.Marko, m, 0);
  assert.deepEqual(ids(g.clanovi(m)), [pid.Marko]);
  // pozicija van opsega: 99 na kraj, -5 na pocetak
  g.premesti(T, pid.Ana, a, 0);
  g.premesti(T, pid.Bea, a, 99);
  g.premesti(T, pid.Ceca, a, -5);
  assert.deepEqual(ids(g.clanovi(a)), [pid.Ceca, pid.Ana, pid.Bea]);
  // ista pozicija: nista se ne menja, nema zamrzavanja
  g.premesti(T, pid.Ana, a, 1);
  assert.deepEqual(ids(g.clanovi(a)), [pid.Ceca, pid.Ana, pid.Bea]);
  assert.deepEqual(g.rucniRedosledi(a), {});
});

test('premesti: zamrzavanje i premestaj u drugu grupu', () => {
  const { baza, s, pid, g } = nova();
  const T = s.takm;
  const { Ana, Bea, Ceca } = pid;
  const a = g.dodaj(T, 'Z');
  const bb = g.dodaj(T, 'Z');
  g.premesti(T, Ana, a, 0);
  g.premesti(T, Bea, a, 1);
  // u drugu grupu u rotaciji 1: nista se ne zamrzava
  g.premesti(T, Ceca, bb, 0, 1);
  assert.deepEqual(g.rucniRedosledi(a), {});
  assert.deepEqual(g.rucniRedosledi(bb), {});
  // pravi premestaj u istoj grupi: zamrzava rotaciju 2 i kad je jednaka pomerenoj
  g.premesti(T, Bea, a, 0, 1);
  assert.deepEqual(uRot(g, T, a, 1), [Bea, Ana]);
  assert.deepEqual(g.rucniRedosledi(a), { 2: [Ana, Bea] });
  // pomeranje novog osnovnog redosleda za rotaciju 2 bi dalo isto, a ipak je upisano
  baza.izvrsi('UPDATE takmicenja SET pomeraj_redosled = 1 WHERE id = ?', [T]);
  assert.deepEqual(uRot(g, T, a, 2, true), [Ana, Bea]);
  // zamrznuta rotacija ne reaguje na kucicu pomeranja: novi pravi premestaj sa pomerajem
  g.premesti(T, Ana, a, 0, 1);
  assert.deepEqual(uRot(g, T, a, 1, true), [Ana, Bea]);
  assert.deepEqual(g.rucniRedosledi(a), { 2: [Ana, Bea] });
  baza.izvrsi('UPDATE takmicenja SET pomeraj_redosled = 0 WHERE id = ?', [T]);
  assert.deepEqual(uRot(g, T, a, 2), [Ana, Bea]);
  // grupa sa jednim clanom: premestaj na isto mesto ne zamrzava
  g.premesti(T, Ceca, bb, 0, 1);
  assert.deepEqual(g.rucniRedosledi(bb), {});
});

test('nerasporedjeni: redosled sa null kategorijom prvom i polja', () => {
  const { baza, s, pid, g } = nova();
  const T = s.takm;
  const pion = baza.ubaci('kategorije', { naziv: 'Pionir', redosled: 2, kreirano: S, izmenjeno: S });
  baza.izmeni('prijave', { kategorija_id: pion }, 'id = ?', [pid.Ana]);
  baza.izmeni('prijave', { kategorija_id: null }, 'id = ?', [pid.Dona]);
  baza.izmeni('prijave', { kategorija_id: s.kat }, 'id IN (?, ?)', [pid.Bea, pid.Ceca]);
  // Dona (bez kategorije) prva, pa Kadet: Ceca (DVA) pre Bee (JED), pa Pionir
  assert.deepEqual(ids(g.nerasporedjeni(T, 'Z')), [pid.Dona, pid.Ceca, pid.Bea, pid.Ana]);
  const red = g.nerasporedjeni(T, 'Z').find((r) => r.prijava_id === pid.Ceca);
  assert.deepEqual(Object.keys(red).sort(),
    ['ime', 'kategorija', 'kategorija_id', 'klub_skr', 'pol', 'prezime', 'prijava_id', 'program', 'program_id', 'startni_broj', 'van_konkurencije']);
  assert.equal(red.klub_skr, 'DVA');
  assert.equal(red.kategorija, 'Kadet');
  assert.equal(red.pol, 'Z');
  assert.deepEqual(ids(g.nerasporedjeni(T, 'M')), [pid.Marko]);
  const a = g.dodaj(T, 'Z');
  g.premesti(T, pid.Dona, a, 0);
  assert.equal(g.nerasporedjeni(T, 'Z').length, 3);
  assert.deepEqual(Object.keys(g.clanovi(a)[0]).sort(),
    ['ime', 'kategorija', 'kategorija_id', 'klub_skr', 'pol', 'prezime', 'prijava_id', 'program', 'program_id', 'redosled', 'startni_broj', 'van_konkurencije']);
});

test('brisanje prijave kaskadira iz grupa', () => {
  const { baza, s, pid, prijave, g } = nova();
  const T = s.takm;
  const a = g.dodaj(T, 'Z');
  g.premesti(T, pid.Ana, a, 0);
  g.premesti(T, pid.Bea, a, 1);
  g.premesti(T, pid.Bea, a, 0, 2);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupa_redosled WHERE grupa_id = ?', [a]), 2);
  prijave.obrisi(T, pid.Bea);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupa_clanovi WHERE prijava_id = ?', [pid.Bea]), 0);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupa_redosled WHERE prijava_id = ?', [pid.Bea]), 0);
});

test('takmicenja.postaviPomeraj', () => {
  const { baza, s, takm } = nova();
  baza.izmeni('takmicenja', { izmenjeno: '2000-01-01 00:00:00' }, 'id = ?', [s.takm]);
  takm.postaviPomeraj(s.takm, true);
  const t = takm.nadji(s.takm);
  assert.equal(t.pomeraj_redosled, 1);
  assert.notEqual(t.izmenjeno, '2000-01-01 00:00:00');
  takm.postaviPomeraj(s.takm, 0);
  assert.equal(takm.nadji(s.takm).pomeraj_redosled, 0);
  assert.equal(poruka(() => takm.postaviPomeraj(s.takm + 100, true)), 'Takmičenje ne postoji.');
});
