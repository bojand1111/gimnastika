const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviPrijave } = require('../electron/modeli/prijave.cjs');
const { napravi: napraviGrupe } = require('../electron/modeli/grupe.cjs');
const { napravi } = require('../electron/modeli/ocene.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const S = '2026-01-01 00:00:00';

// Baza sa semom i prijavama Ana, Bea, Ceca, Dona (Z) i Marko (M).
function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const s = tokSeme(baza);
  const podesavanja = napraviPodesavanja(baza, '');
  const prijave = napraviPrijave(baza, podesavanja);
  prijave.dodajVise(s.takm, [s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona, s.muski]);
  const pid = {};
  for (const r of baza.svi('SELECT p.id, t.ime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.takmicenje_id = ?', [s.takm])) pid[r.ime] = r.id;
  return { baza, s, pid, prijave, podesavanja, o: napravi(baza, podesavanja), grupe: napraviGrupe(baza) };
}

function poruka(fn) {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  return null;
}

const UNOS = { d: '4,8', e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '' };

test('nacrt, potvrda, ispravka, odustajanje (POPIS 8.1)', () => {
  const { baza, s, pid, prijave, o } = nova();
  const gr = s.gr;

  let r = o.sacuvaj(s.takm, pid.Ana, gr, { d: '4,8', e: ['8,3', '8.1', '', ''], odbitak: '' }, false);
  assert.equal(r.prikaz.status, 'nacrt');
  assert.equal(r.prikaz.d, '4,800');
  assert.deepEqual(r.prikaz.e_sudije, ['8,300', '8,100', '', '']);
  assert.equal(r.prikaz.konacna, '');

  assert.match(poruka(() => o.sacuvaj(s.takm, pid.Ana, gr, { d: '4,8', e: ['8,3', '8,1', '', ''], odbitak: '' }, true)), /Unesite sve E ocene \(4\)\./);
  assert.match(poruka(() => o.sacuvaj(s.takm, pid.Ana, gr, { d: '25', e: ['', '', '', ''], odbitak: '' }, true)), /neispravna vrednost/);

  r = o.sacuvaj(s.takm, pid.Ana, gr, UNOS, true);
  assert.equal(r.prikaz.status, 'uneto');
  assert.equal(r.prikaz.e, '8,250');
  assert.equal(r.prikaz.odbitak, '0,000');
  assert.equal(r.prikaz.konacna, '13,050');
  assert.equal(baza.vrednost('SELECT konacna FROM ocene WHERE prijava_id = ? AND sprava_id = ?', [pid.Ana, gr]), 13050);

  r = o.sacuvaj(s.takm, pid.Ana, gr, { d: '1', e: ['1', '1', '1', '1'] }, false);
  assert.equal(r.prikaz.konacna, '13,050');
  assert.equal(r.prikaz.status, 'uneto');

  const ispravka = { d: '4,8', e: ['8,3', '7,9', '8,4', '8,2'], odbitak: '0,1' };
  assert.equal(poruka(() => o.sacuvaj(s.takm, pid.Ana, gr, ispravka, true)), 'Za ispravku unete ocene obavezan je razlog.');
  assert.equal(poruka(() => o.sacuvaj(s.takm, pid.Ana, gr, ispravka, true, '   ')), 'Za ispravku unete ocene obavezan je razlog.');
  r = o.sacuvaj(s.takm, pid.Ana, gr, ispravka, true, 'pogrešno pročitan listić');
  assert.equal(r.prikaz.status, 'ispravljeno');
  assert.equal(r.prikaz.broj_ispravki, 1);
  assert.equal(r.prikaz.konacna, '12,950');
  const izm = o.izmeneNaSpravi(s.takm, gr);
  assert.equal(izm.length, 1);
  assert.equal(izm[0].razlog, 'pogrešno pročitan listić');
  assert.ok(izm[0].opis.includes('E2 8,100 → 7,900'));
  assert.ok(izm[0].opis.includes('konačna 13,050 → 12,950'));
  assert.equal(izm[0].opis, 'odbitak 0,000 → 0,100 · E2 8,100 → 7,900 · konačna 13,050 → 12,950');
  assert.equal(izm[0].ime, 'Ana');
  assert.equal(izm[0].prezime, 'Test');
  assert.equal(izm[0].staro.konacna, 13050);
  assert.equal(izm[0].novo.konacna, 12950);

  assert.equal(o.odustao(s.takm, pid.Bea, gr).prikaz.status, 'odustao');
  assert.equal(o.vrati(s.takm, pid.Bea, gr).prikaz.status, 'nacrt');

  prijave.postaviSpravu(s.takm, pid.Ceca, gr, false);
  assert.ok(poruka(() => o.sacuvaj(s.takm, pid.Ceca, gr, UNOS, true)));
});

test('poruke: takmicenje, prijava, sprava', () => {
  const { baza, s, pid, o } = nova();
  assert.equal(poruka(() => o.sacuvaj(999, pid.Ana, s.gr, UNOS, false)), 'Takmičenje ne postoji.');
  const drugo = baza.ubaci('takmicenja', { naziv: 'Drugo', datum: '2026-10-18', mesto: 'NS', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje', ekipno_broji: 1, kreirano: S, izmenjeno: S });
  assert.equal(poruka(() => o.sacuvaj(drugo, pid.Ana, s.gr, UNOS, false)), 'Prijava ne postoji na ovom takmičenju.');
  assert.equal(poruka(() => o.sacuvaj(s.takm, 9999, s.gr, UNOS, false)), 'Prijava ne postoji na ovom takmičenju.');
  // Marko (M) ne radi Gredu.
  assert.equal(poruka(() => o.sacuvaj(s.takm, pid.Marko, s.gr, UNOS, false)), 'Test Marko nije prijavljen/a na ovu spravu.');
  assert.equal(poruka(() => o.sacuvaj(s.takm, pid.Ana, s.gr, { d: '', e: ['8,x'], odbitak: '' }, false)), 'E1: neispravna vrednost „8,x“ (0 do 20, najviše tri decimale).');
  assert.equal(poruka(() => o.sacuvaj(s.takm, pid.Ana, s.gr, { d: '', e: [], odbitak: '' }, true)), 'Unesite D ocenu.');
  assert.equal(poruka(() => o.odustao(drugo, pid.Ana, s.gr)), 'Prijava ne postoji na ovom takmičenju.');
  assert.equal(poruka(() => o.vrati(drugo, pid.Ana, s.gr)), 'Prijava ne postoji na ovom takmičenju.');
  assert.equal(poruka(() => o.odustao(999, pid.Ana, s.gr)), 'Takmičenje ne postoji.');
});

test('nacrt nad odustao ostaje odustao ali upisuje brojeve', () => {
  const { s, pid, o } = nova();
  o.odustao(s.takm, pid.Ana, s.gr);
  const r = o.sacuvaj(s.takm, pid.Ana, s.gr, { d: '4,8', e: ['8,3', '', '', ''], odbitak: '' }, false);
  assert.equal(r.prikaz.status, 'odustao');
  assert.equal(r.prikaz.d, '4,800');
  assert.deepEqual(r.prikaz.e_sudije, ['8,300', '', '', '']);
  // vrati ih vraca kao nacrt sa tim brojevima
  const v = o.vrati(s.takm, pid.Ana, s.gr);
  assert.equal(v.prikaz.status, 'nacrt');
  assert.equal(v.prikaz.d, '4,800');
});

test('potvrda nad nacrtom i odustao je uneto, bez razloga i bez zapisa izmene', () => {
  const { baza, s, pid, o } = nova();
  o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, false);
  let r = o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, true);
  assert.equal(r.prikaz.status, 'uneto');
  assert.equal(r.prikaz.broj_ispravki, 0);
  o.odustao(s.takm, pid.Bea, s.gr);
  r = o.sacuvaj(s.takm, pid.Bea, s.gr, UNOS, true);
  assert.equal(r.prikaz.status, 'uneto');
  assert.equal(r.prikaz.broj_ispravki, 0);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM izmene_ocena'), 0);
  assert.ok(r.ocena.uneto_u);
});

test('odbitak: prazan je null u nacrtu, 0 u potvrdi', () => {
  const { s, pid, o } = nova();
  assert.equal(o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, false).ocena.odbitak, null);
  assert.equal(o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, true).ocena.odbitak, 0);
});

test('odustao nad unetom pravi zapis sa opisom', () => {
  const { baza, s, pid, o } = nova();
  o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, true);
  const r = o.odustao(s.takm, pid.Ana, s.gr);
  assert.equal(r.prikaz.status, 'odustao');
  assert.equal(r.prikaz.broj_ispravki, 1);
  assert.equal(r.prikaz.d, '');
  assert.equal(r.prikaz.konacna, '');
  assert.deepEqual(r.prikaz.e_sudije, ['', '', '', '']);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM ocene_e WHERE ocena_id = ?', [r.ocena.id]), 0);
  const izm = o.izmeneNaSpravi(s.takm, s.gr);
  assert.equal(izm.length, 1);
  assert.equal(izm[0].razlog, 'Označeno odustajanje');
  assert.ok(izm[0].opis.includes('označeno odustajanje'));
});

test('odustao nad nacrtom nema zapis izmene i brise brojeve', () => {
  const { baza, s, pid, o } = nova();
  o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, false);
  const r = o.odustao(s.takm, pid.Ana, s.gr);
  assert.equal(r.prikaz.status, 'odustao');
  assert.equal(r.prikaz.broj_ispravki, 0);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM izmene_ocena'), 0);
  assert.equal(r.ocena.d, null);
});

test('vrati bez ocene baca', () => {
  const { s, pid, o } = nova();
  assert.equal(poruka(() => o.vrati(s.takm, pid.Ana, s.gr)), 'Nema šta da se vrati.');
});

test('nadji i zaSpravu', () => {
  const { s, pid, o } = nova();
  assert.equal(o.nadji(pid.Ana, s.gr), null);
  assert.deepEqual(o.zaSpravu(s.gr, []), {});
  o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, true);
  o.sacuvaj(s.takm, pid.Bea, s.gr, { d: '3', e: ['7'], odbitak: '' }, false);
  const n = o.nadji(pid.Ana, s.gr);
  assert.deepEqual(n.e_sudije, { 1: 8300, 2: 8100, 3: 8400, 4: 8200 });
  assert.equal(n.d, 4800);
  const z = o.zaSpravu(s.gr, [pid.Ana, pid.Bea, pid.Ceca]);
  assert.deepEqual(Object.keys(z).map(Number).sort(), [pid.Ana, pid.Bea].sort());
  assert.deepEqual(z[pid.Bea].e_sudije, { 1: 7000 });
  assert.equal(z[pid.Ana].status, 'uneto');
});

test('zaTakmicenje: oblik pid -> sid -> ocena', () => {
  const { s, pid, o } = nova();
  o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, true);
  o.sacuvaj(s.takm, pid.Ana, s.pr, UNOS, false);
  o.sacuvaj(s.takm, pid.Marko, s.pa, UNOS, false);
  const z = o.zaTakmicenje(s.takm);
  assert.deepEqual(Object.keys(z).map(Number).sort(), [pid.Ana, pid.Marko].sort());
  assert.equal(z[pid.Ana][s.gr].status, 'uneto');
  assert.equal(z[pid.Ana][s.pr].status, 'nacrt');
  assert.deepEqual(z[pid.Ana][s.gr].e_sudije, { 1: 8300, 2: 8100, 3: 8400, 4: 8200 });
  assert.deepEqual(o.zaTakmicenje(999), {});
});

test('izmeneNaSpravi: najvise 5, najnovije prvo', () => {
  const { baza, s, pid, o } = nova();
  o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, true);
  for (let i = 1; i <= 7; i++) {
    o.sacuvaj(s.takm, pid.Ana, s.gr, { d: `4,${i}`, e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '' }, true, `razlog ${i}`);
  }
  // Isto vreme (sekunda): poredak ide po id opadajuce.
  const izm = o.izmeneNaSpravi(s.takm, s.gr);
  assert.equal(izm.length, 5);
  assert.deepEqual(izm.map((r) => r.razlog), ['razlog 7', 'razlog 6', 'razlog 5', 'razlog 4', 'razlog 3']);
  assert.equal(o.izmeneNaSpravi(s.takm, s.gr, 2).length, 2);
  assert.equal(o.izmeneNaSpravi(s.takm, s.pr).length, 0);
  baza.izvrsi('UPDATE izmene_ocena SET staro = ?, novo = NULL WHERE razlog = ?', ['nije json', 'razlog 7']);
  const prvi = o.izmeneNaSpravi(s.takm, s.gr)[0];
  assert.deepEqual(prvi.staro, {});
  assert.deepEqual(prvi.novo, {});
});

test('radiSpravu', () => {
  const { s, pid, o } = nova();
  assert.equal(o.radiSpravu(pid.Ana, s.gr), true);
  assert.equal(o.radiSpravu(pid.Marko, s.gr), false);
});

test('napredak modela nad semenom', () => {
  const { s, pid, o, grupe, prijave } = nova();
  const a = grupe.dodaj(s.takm, 'Z');
  const b = grupe.dodaj(s.takm, 'Z');
  grupe.premesti(s.takm, pid.Ana, a, 0);
  grupe.premesti(s.takm, pid.Bea, a, 1);
  grupe.premesti(s.takm, pid.Ceca, b, 0);
  // Dona ostaje nerasporedjena i ne broji se.
  const lista = grupe.lista(s.takm, 'Z');
  const sprave = [{ id: s.pr }, { id: s.gr }];
  let n = o.napredak(s.takm, 'Z', lista, sprave);
  assert.deepEqual(n, { rotacija: 1, ukupno_rotacija: 2, obradjeno: 0, ukupno: 6, gotovo: false });
  // Clan koji ne radi spravu se ne broji.
  prijave.postaviSpravu(s.takm, pid.Ceca, s.pr, false);
  assert.equal(o.napredak(s.takm, 'Z', lista, sprave).ukupno, 5);
  prijave.postaviSpravu(s.takm, pid.Ceca, s.pr, true);
  // Rotacija 1: grupa A na Preskoku, grupa B na Gredi.
  o.sacuvaj(s.takm, pid.Ana, s.pr, UNOS, true);
  o.odustao(s.takm, pid.Bea, s.pr);
  o.sacuvaj(s.takm, pid.Ceca, s.gr, UNOS, true);
  n = o.napredak(s.takm, 'Z', lista, sprave);
  assert.deepEqual(n, { rotacija: 2, ukupno_rotacija: 2, obradjeno: 3, ukupno: 6, gotovo: false });
  // Rotacija 2.
  o.sacuvaj(s.takm, pid.Ana, s.gr, UNOS, true);
  o.sacuvaj(s.takm, pid.Bea, s.gr, UNOS, true);
  o.sacuvaj(s.takm, pid.Ceca, s.pr, UNOS, true);
  n = o.napredak(s.takm, 'Z', lista, sprave);
  assert.deepEqual(n, { rotacija: 2, ukupno_rotacija: 2, obradjeno: 6, ukupno: 6, gotovo: true });
});
