import test from 'node:test';
import assert from 'node:assert/strict';
import { prebroj, nedostajePol, cipFajla, zbir, pocetniIzbor } from '../src/ekrani/uvozBrojac.js';

const red = (status, postupak) => ({ status, postupak });
const fajl = (redovi, pol = null) => ({ ime: 'a.docx', pol, klub_id: null, oznake: [], redovi });

test('prebroj: novi, postoji, slican, prijavljen i greska po statusima', () => {
  const f = fajl([red('novi', 'novi'), red('postoji', 'postojeci'), red('slican', 'novi'),
    red('prijavljen', 'nista'), red('greska', 'nista')]);
  const izbor = { 0: { pol: 'M', redovi: {
    0: { uvezi: '1', postupak: 'novi' }, 1: { uvezi: '1', postupak: 'postojeci' }, 2: { uvezi: '1', postupak: 'novi' } } } };
  const b = prebroj([f], izbor);
  assert.deepEqual(b.poFajlu[0], { n: 3, prijavljeni: 1, greske: 1, novih: 2, postojecih: 1 });
  assert.deepEqual({ ukupno: b.ukupno, novih: b.novih, postojecih: b.postojecih }, { ukupno: 3, novih: 2, postojecih: 1 });
});

test('prebroj: odkacen red se ne broji, a postupak novi na postojecem ga broji kao novog', () => {
  const f = fajl([red('postoji', 'postojeci'), red('postoji', 'postojeci'), red('novi', 'novi')]);
  const izbor = { 0: { redovi: {
    0: { uvezi: '', postupak: 'postojeci' }, 1: { uvezi: '1', postupak: 'novi' }, 2: { uvezi: false, postupak: 'novi' } } } };
  const b = prebroj([f], izbor);
  assert.deepEqual(b.poFajlu[0], { n: 1, prijavljeni: 0, greske: 0, novih: 1, postojecih: 0 });
  assert.equal(b.ukupno, 1);
});

test('prebroj: vise fajlova se sabira, prazan izbor daje nulu', () => {
  const a = fajl([red('novi', 'novi')]);
  const c = fajl([red('postoji', 'postojeci')]);
  const b = prebroj([a, c], { 0: { redovi: { 0: { uvezi: '1', postupak: 'novi' } } }, 1: { redovi: { 0: { uvezi: '1', postupak: 'postojeci' } } } });
  assert.deepEqual([b.ukupno, b.novih, b.postojecih], [2, 1, 1]);
  const nula = prebroj([a], {});
  assert.deepEqual([nula.ukupno, nula.novih, nula.postojecih], [0, 0, 0]);
});

test('nedostajePol: fajl bez pola sa izabranim novim redom', () => {
  const f = fajl([red('novi', 'novi')]);
  const redovi = { 0: { uvezi: '1', postupak: 'novi' } };
  assert.equal(nedostajePol([f], { 0: { pol: '', redovi } }), 0);
  assert.equal(nedostajePol([f], { 0: { pol: 'Z', redovi } }), null);
});

test('nedostajePol: bez izabranog novog reda ne smeta; postoji sa postupkom novi smeta', () => {
  const f = fajl([red('postoji', 'postojeci'), red('postoji', 'postojeci')]);
  const sa = (p) => ({ 0: { pol: '', redovi: { 0: { uvezi: '1', postupak: 'postojeci' }, 1: { uvezi: '', postupak: 'novi' }, ...p } } });
  assert.equal(nedostajePol([f], sa({})), null);
  assert.equal(nedostajePol([f], sa({ 1: { uvezi: '1', postupak: 'novi' } })), 0);
});

test('nedostajePol: vraca indeks prvog fajla kome treba pol', () => {
  const a = fajl([red('novi', 'novi')]);
  const c = fajl([red('novi', 'novi')]);
  const r = { 0: { uvezi: '1', postupak: 'novi' } };
  assert.equal(nedostajePol([a, c], { 0: { pol: 'M', redovi: r }, 1: { pol: '', redovi: r } }), 1);
});

test('cipFajla i zbir: tekstovi', () => {
  assert.equal(cipFajla({ n: 4, prijavljeni: 0, greske: 0 }), 'za uvoz: 4');
  assert.equal(cipFajla({ n: 4, prijavljeni: 2, greske: 0 }), 'za uvoz: 4 · već prijavljeni: 2');
  assert.equal(cipFajla({ n: 0, prijavljeni: 1, greske: 3 }), 'za uvoz: 0 · već prijavljeni: 1 · ne mogu: 3');
  assert.equal(zbir({ ukupno: 0, novih: 0, postojecih: 0 }), 'Nijedan red nije izabran za uvoz.');
  assert.equal(zbir({ ukupno: 5, novih: 3, postojecih: 2 }), 'Za uvoz: 5 (novih takmičara 3, postojećih 2)');
});

test('pocetniIzbor: klub, pol, oznake sa novom stavkom i kucice', () => {
  const f = {
    klub_id: 7, pol: 'Z',
    oznake: [{ oznaka: 'A', kategorija: 'Kadet', program: 'C', kategorija_id: 3, program_id: null },
      { oznaka: 'B', kategorija: 'Nova kat', program: '', kategorija_id: null, program_id: null }],
    redovi: [red('novi', 'novi'), red('postoji', 'postojeci'), red('slican', 'novi'), red('prijavljen', 'nista'), red('greska', 'nista')],
  };
  const i = pocetniIzbor(f);
  assert.equal(i.klub_id, '7');
  assert.equal(i.pol, 'Z');
  assert.deepEqual(i.oznake[0], { kategorija: '3', program: 'novo' });
  assert.deepEqual(i.oznake[1], { kategorija: 'novo', program: '' });
  assert.deepEqual(i.redovi[1], { uvezi: true, postupak: 'postojeci' });
  assert.deepEqual(i.redovi[2], { uvezi: true, postupak: 'novi' });
  assert.equal(i.redovi[3].uvezi, false);
  assert.equal(i.redovi[4].uvezi, false);
  assert.equal(pocetniIzbor({ klub_id: null, pol: null, oznake: [], redovi: [] }).klub_id, '');
});

test('zaUpis: kucica postaje 1 ili prazno', async () => {
  const { zaUpis } = await import('../src/ekrani/uvozBrojac.js');
  const o = zaUpis({ 0: { pol: 'M', klub_id: '2', oznake: {}, redovi: { 0: { uvezi: true, postupak: 'novi' }, 1: { uvezi: false, postupak: 'postojeci' } } } });
  assert.deepEqual(o[0].redovi, { 0: { uvezi: '1', postupak: 'novi' }, 1: { uvezi: '', postupak: 'postojeci' } });
});
