import test from 'node:test';
import assert from 'node:assert/strict';
import { vidljiv, lekarskiPoruka, deoNaziv, napomenaPola, porukaPrebacen } from '../src/ekrani/takmicariFilter.js';

const red = { id_broj: '00203', ime: 'Teodora', prezime: 'Nikolić', klub_id: 3, pol: 'Z', godina_rodjenja: 2013 };
const svi = { upit: '', klub: '', god: '' };

test('vidljiv: prazni filteri propustaju sve', () => {
  assert.equal(vidljiv(red, svi), true);
});

test('vidljiv: tekst po prezimenu, imenu, ID broju, bez kvacica, podstring', () => {
  assert.equal(vidljiv(red, { ...svi, upit: 'nikolic' }), true);
  assert.equal(vidljiv(red, { ...svi, upit: 'TEO' }), true);
  assert.equal(vidljiv(red, { ...svi, upit: 'teodora nikolic' }), true);
  assert.equal(vidljiv(red, { ...svi, upit: 'nikolic teodora' }), true);
  assert.equal(vidljiv(red, { ...svi, upit: '0203' }), true);
  assert.equal(vidljiv(red, { ...svi, upit: '  dora ' }), true);
  assert.equal(vidljiv(red, { ...svi, upit: 'xyz' }), false);
});

test('vidljiv: klub poredi id kao tekst, bez kluba je 0', () => {
  assert.equal(vidljiv(red, { ...svi, klub: '3' }), true);
  assert.equal(vidljiv(red, { ...svi, klub: '4' }), false);
  assert.equal(vidljiv({ ...red, klub_id: null }, { ...svi, klub: '0' }), true);
  assert.equal(vidljiv({ ...red, klub_id: null }, { ...svi, klub: '3' }), false);
});

test('vidljiv: godiste', () => {
  assert.equal(vidljiv(red, { ...svi, god: '2013' }), true);
  assert.equal(vidljiv(red, { ...svi, god: '2012' }), false);
});

test('vidljiv: nema filtera pola, lista je vec samo izabrani deo', () => {
  assert.equal(vidljiv({ ...red, pol: 'M' }, svi), true);
  assert.equal(vidljiv({ ...red, pol: 'Z' }, svi), true);
  // pol u filteru se ne gleda (stari poziv ne sakriva red)
  assert.equal(vidljiv({ ...red, pol: 'M' }, { ...svi, pol: 'Z' }), true);
});

test('vidljiv: filteri se kombinuju (I)', () => {
  assert.equal(vidljiv(red, { upit: 'nik', klub: '3', god: '2013' }), true);
  assert.equal(vidljiv(red, { upit: 'nik', klub: '3', god: '2012' }), false);
});

test('lekarskiPoruka: prazno nema poruke', () => {
  assert.deepEqual(lekarskiPoruka('', 30, '2026-10-17'), { klasa: '', tekst: '' });
  assert.deepEqual(lekarskiPoruka('   ', 30, '2026-10-17'), { klasa: '', tekst: '' });
});

test('lekarskiPoruka: neispravan datum, ukljucujuci 31.02', () => {
  const g = { klasa: 'greska', tekst: 'Neispravan datum (dd.mm.gggg)' };
  assert.deepEqual(lekarskiPoruka('abc', 30, '2026-10-17'), g);
  assert.deepEqual(lekarskiPoruka('31.02.2026.', 30, '2026-10-17'), g);
  assert.deepEqual(lekarskiPoruka('31022026', 30, '2026-10-17'), g);
});

test('lekarskiPoruka: istekao, istice, vazi', () => {
  assert.deepEqual(lekarskiPoruka('01.01.2026.', 30, '2026-10-17'), { klasa: 'greska', tekst: 'Lekarski je istekao' });
  assert.deepEqual(lekarskiPoruka('16.10.2026.', 30, '2026-10-17'), { klasa: 'greska', tekst: 'Lekarski je istekao' });
  assert.deepEqual(lekarskiPoruka('25.10.2026.', 30, '2026-10-17'), { klasa: 'upozorenje', tekst: 'Ističe za 8 dana' });
  assert.deepEqual(lekarskiPoruka('17.10.2026', 30, '2026-10-17'), { klasa: 'upozorenje', tekst: 'Ističe za 0 dana' });
  assert.deepEqual(lekarskiPoruka('16.11.2026.', 30, '2026-10-17'), { klasa: 'upozorenje', tekst: 'Ističe za 30 dana' });
  assert.deepEqual(lekarskiPoruka('17.11.2026.', 30, '2026-10-17'), { klasa: '', tekst: '' });
  assert.deepEqual(lekarskiPoruka('25102026', 30, '2026-10-17'), { klasa: 'upozorenje', tekst: 'Ističe za 8 dana' });
});

test('deoNaziv: M je MSG, Z je ŽSG', () => {
  assert.equal(deoNaziv('M'), 'MSG');
  assert.equal(deoNaziv('Z'), 'ŽSG');
});

test('napomenaPola: tekst samo kad se pol stvarno menja', () => {
  assert.equal(napomenaPola('Z', 'Z'), '');
  assert.equal(napomenaPola('Z', 'M'), 'Čuvanjem se takmičar prebacuje u MSG.');
  assert.equal(napomenaPola('M', 'Z'), 'Čuvanjem se takmičar prebacuje u ŽSG.');
  assert.equal(napomenaPola('M', ''), '');
  assert.equal(napomenaPola('', 'Z'), '');
});

test('porukaPrebacen: ime i novi deo', () => {
  assert.equal(porukaPrebacen('Nikolić Teodora', 'M'), 'Takmičar Nikolić Teodora je prebačen u MSG.');
  assert.equal(porukaPrebacen('Nikolić Teodora', 'Z'), 'Takmičar Nikolić Teodora je prebačen u ŽSG.');
});
