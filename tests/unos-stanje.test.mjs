import test from 'node:test';
import assert from 'node:assert/strict';
import {
  polja, proveriPolje, preracunaj, podaciReda, sledeciOtvoren, sledecePolje, sledeciRedSaPoljem,
  prvoPraznoPolje, pocetniFokus, napredakIzRedova, tekstOdustalo, procenat, hashUnos, odustaoRec, primeniPrikaz,
} from '../src/ekrani/unosStanje.js';

const red = (status, extra = {}) => ({ prijava_id: 1, status, ispravlja: false, vrednosti: {}, ...extra });
const unos = (d, e, odbitak = '') => ({ d, e1: e[0] ?? '', e2: e[1] ?? '', e3: e[2] ?? '', e4: e[3] ?? '', odbitak });

test('polja: d, E sudije, odbitak', () => {
  assert.deepEqual(polja(4), ['d', 'e1', 'e2', 'e3', 'e4', 'odbitak']);
  assert.deepEqual(polja(1), ['d', 'e1', 'odbitak']);
});

test('proveriPolje: prazno, normalizacija, neispravno', () => {
  assert.deepEqual(proveriPolje(''), { ok: true, vrednost: null, prikaz: '' });
  assert.deepEqual(proveriPolje('  '), { ok: true, vrednost: null, prikaz: '' });
  assert.deepEqual(proveriPolje('8,3'), { ok: true, vrednost: 8300, prikaz: '8,300' });
  assert.equal(proveriPolje('25').ok, false);
  assert.equal(proveriPolje('abc').ok, false);
  assert.equal(proveriPolje('8,3333').ok, false);
});

test('preracunaj: primer iz specifikacije', () => {
  const r = { vrednosti: unos('4,8', ['8,3', '8,1', '8,4', '8,2']) };
  assert.deepEqual(preracunaj(r, 4, 'odbaci_krajnje', 'odseci'), { e: '8,250', konacna: '13,050' });
});

test('preracunaj: odbitak 0,1 daje 12,950; prazan odbitak je 0', () => {
  const r = { vrednosti: unos('4,8', ['8,3', '8,1', '8,4', '8,2'], '0,1') };
  assert.equal(preracunaj(r, 4, 'odbaci_krajnje', 'odseci').konacna, '12,950');
});

test('preracunaj: nepotpune E, bez D, neispravan odbitak, ne ispod nule', () => {
  const nep = { vrednosti: unos('4,8', ['8,3', '8,1', '', '8,2']) };
  assert.deepEqual(preracunaj(nep, 4, 'odbaci_krajnje', 'odseci'), { e: '–', konacna: '–' });
  const bezD = { vrednosti: unos('', ['8,3', '8,1', '8,4', '8,2']) };
  assert.deepEqual(preracunaj(bezD, 4, 'odbaci_krajnje', 'odseci'), { e: '8,250', konacna: '–' });
  const lose = { vrednosti: unos('4,8', ['8,3', '8,1', '8,4', '8,2'], 'x') };
  assert.deepEqual(preracunaj(lose, 4, 'odbaci_krajnje', 'odseci'), { e: '8,250', konacna: '–' });
  const neg = { vrednosti: unos('0', ['0', '0', '0', '0'], '5') };
  assert.equal(preracunaj(neg, 4, 'prosek_svih', 'odseci').konacna, '0,000');
});

test('podaciReda: trim', () => {
  const r = { vrednosti: unos(' 4,8 ', [' 8,3', '8,1 ', '', '8,2'], ' ') };
  assert.deepEqual(podaciReda(r, 4), { d: '4,8', e: ['8,3', '8,1', '', '8,2'], odbitak: '' });
});

test('sledeciOtvoren: kruzno, bez trenutnog, null kad nema', () => {
  const rs = [red('nacrt'), red('uneto'), red('nacrt'), red('odustao')];
  assert.equal(sledeciOtvoren(rs, 0), 2);
  assert.equal(sledeciOtvoren(rs, 2), 0);
  assert.equal(sledeciOtvoren([red('nacrt'), red('uneto')], 0), null);
  assert.equal(sledeciOtvoren([red('uneto'), red('nacrt')], 0), 1);
  assert.equal(sledeciOtvoren([red('ispravljeno', { ispravlja: true }), red('uneto')], 0), null);
});

test('sledecePolje: u redu, null na krajevima', () => {
  const p = polja(2);
  assert.equal(sledecePolje(p, 'd', 1), 'e1');
  assert.equal(sledecePolje(p, 'e2', 1), 'odbitak');
  assert.equal(sledecePolje(p, 'odbitak', 1), null);
  assert.equal(sledecePolje(p, 'e1', -1), 'd');
  assert.equal(sledecePolje(p, 'd', -1), null);
});

test('sledeciRedSaPoljem: preskace zakljucane i ne_radi', () => {
  const rs = [red('nacrt'), red('ne_radi'), red('odustao'), red('uneto'), red('ispravljeno', { ispravlja: true }), red('nacrt')];
  assert.equal(sledeciRedSaPoljem(rs, 0, 'd', 1), 4);
  assert.equal(sledeciRedSaPoljem(rs, 4, 'd', 1), 5);
  assert.equal(sledeciRedSaPoljem(rs, 5, 'd', 1), null);
  assert.equal(sledeciRedSaPoljem(rs, 5, 'd', -1), 4);
  assert.equal(sledeciRedSaPoljem(rs, 4, 'd', -1), 0);
  assert.equal(sledeciRedSaPoljem(rs, 0, 'd', -1), null);
});

test('prvoPraznoPolje: prvo prazno ili d', () => {
  const p = polja(2);
  assert.equal(prvoPraznoPolje({ vrednosti: { d: '4,800', e1: '8,000', e2: '', odbitak: '' } }, p), 'e2');
  assert.equal(prvoPraznoPolje({ vrednosti: { d: '4,800', e1: '8,000', e2: '8,000', odbitak: '0,000' } }, p), 'd');
  assert.equal(prvoPraznoPolje({ vrednosti: {} }, p), 'd');
});

test('pocetniFokus: pamcenje samo za nacrt, inace prvi nacrt', () => {
  const rs = [red('uneto', { prijava_id: 1 }), red('nacrt', { prijava_id: 2 }), red('nacrt', { prijava_id: 3 })];
  assert.equal(pocetniFokus(rs, 3), 2);
  assert.equal(pocetniFokus(rs, 1), 1);
  assert.equal(pocetniFokus(rs, 99), 1);
  assert.equal(pocetniFokus(rs, null), 1);
  assert.equal(pocetniFokus([red('uneto'), red('ne_radi')], null), null);
});

test('napredakIzRedova: bez ne_radi', () => {
  const rs = [red('nacrt'), red('uneto'), red('ispravljeno'), red('odustao'), red('ne_radi')];
  assert.deepEqual(napredakIzRedova(rs), { obradjeno: 3, ukupno: 4, odustalo: 1 });
  assert.deepEqual(napredakIzRedova([]), { obradjeno: 0, ukupno: 0, odustalo: 0 });
});

test('tekstOdustalo, procenat, odustaoRec', () => {
  assert.equal(tekstOdustalo(1, 'Z'), ' · 1 odustala');
  assert.equal(tekstOdustalo(2, 'M'), ' · 2 odustao');
  assert.equal(tekstOdustalo(0, 'Z'), '');
  assert.equal(procenat(1, 3), 33);
  assert.equal(procenat(2, 3), 67);
  assert.equal(procenat(0, 0), 0);
  assert.equal(odustaoRec('Z'), 'Odustala');
  assert.equal(odustaoRec('M'), 'Odustao');
});

test('hashUnos', () => {
  assert.equal(hashUnos('Z', 3, 2), '#/unos?pol=Z&sprava=3&rot=2');
});

test('primeniPrikaz: upis vrednosti, status, ciscenje oznaka', () => {
  const r = red('nacrt', { ispravlja: true, greskaCuvanja: true, greske: new Set(['d']), vrednosti: unos('', []) });
  const n = primeniPrikaz(r, { d: '4,800', e_sudije: ['8,300', '8,100', '8,400', '8,200'], odbitak: '0,000', e: '8,250', konacna: '13,050', status: 'uneto' });
  assert.deepEqual(n.vrednosti, { d: '4,800', e1: '8,300', e2: '8,100', e3: '8,400', e4: '8,200', odbitak: '0,000' });
  assert.equal(n.e, '8,250');
  assert.equal(n.konacna, '13,050');
  assert.equal(n.status, 'uneto');
  assert.equal(n.ispravlja, false);
  assert.equal(n.greskaCuvanja, false);
  assert.equal(n.greske.size, 0);
  assert.equal(r.status, 'nacrt');
  assert.equal(primeniPrikaz(r, { d: '', e_sudije: [], odbitak: '', e: '', konacna: '', status: 'nacrt' }).konacna, '–');
});
