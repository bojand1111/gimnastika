import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pozicijaURotaciji, redosledURotaciji, grupaNaSpravi } from '../electron/racun/grupe.mjs';

const c = (...ids) => ids.map((id) => ({ prijava_id: id }));
const ids = (niz) => niz.map((x) => x.prijava_id);

test('pozicijaURotaciji: kruzenje po spravama', () => {
  assert.equal(pozicijaURotaciji(1, 1, 4), 1);
  assert.equal(pozicijaURotaciji(1, 2, 4), 2);
  assert.equal(pozicijaURotaciji(4, 2, 4), 1);
  assert.equal(pozicijaURotaciji(2, 6, 4), 3);
});

test('pozicijaURotaciji: brojSprava manji od 1 vraca 1', () => {
  assert.equal(pozicijaURotaciji(3, 5, 0), 1);
});

test('redosledURotaciji: bez pomeranja ostaje osnovni', () => {
  assert.deepEqual(redosledURotaciji(['a', 'b', 'c'], 3, false), ['a', 'b', 'c']);
});

test('redosledURotaciji: pomeranje, prvi ide na kraj', () => {
  assert.deepEqual(redosledURotaciji(['a', 'b', 'c'], 2, true), ['b', 'c', 'a']);
  assert.deepEqual(redosledURotaciji(['a', 'b', 'c'], 3, true), ['c', 'a', 'b']);
  assert.deepEqual(redosledURotaciji(['a', 'b', 'c'], 4, true), ['a', 'b', 'c']);
});

test('redosledURotaciji: n < 2 vraca kopiju, ulaz se ne menja', () => {
  const ulaz = ['a'];
  const izlaz = redosledURotaciji(ulaz, 2, true);
  assert.deepEqual(izlaz, ['a']);
  assert.notEqual(izlaz, ulaz);
  const tri = ['a', 'b', 'c'];
  const kopija = redosledURotaciji(tri, 2, false);
  assert.notEqual(kopija, tri);
  redosledURotaciji(tri, 2, true);
  assert.deepEqual(tri, ['a', 'b', 'c']);
});

test('redosledURotaciji: rucni redosled ima prednost', () => {
  assert.deepEqual(ids(redosledURotaciji(c(1, 2, 3), 2, true, [3, 1, 2])), [3, 1, 2]);
});

test('redosledURotaciji: nepoznat id se preskace, novi clanovi idu na kraj', () => {
  assert.deepEqual(ids(redosledURotaciji(c(1, 2, 3, 4), 2, false, [2, 9, 1])), [2, 1, 3, 4]);
});

test('redosledURotaciji: prazan rucni redosled je isto sto i bez njega', () => {
  assert.deepEqual(ids(redosledURotaciji(c(1, 2, 3), 2, true, [])), [2, 3, 1]);
  assert.deepEqual(ids(redosledURotaciji(c(1, 2, 3), 2, true, null)), [2, 3, 1]);
});

test('redosledURotaciji: rucni poredi prijava_id kao broj', () => {
  assert.deepEqual(ids(redosledURotaciji([{ prijava_id: '1' }, { prijava_id: '2' }], 1, false, [2, 1])), ['2', '1']);
});

test('grupaNaSpravi: grupa na spravi sa pomerenim clanovima', () => {
  const grupe = [
    { id: 10, pocetna_pozicija: 1, clanovi: c(1, 2, 3), rucni: {} },
    { id: 20, pocetna_pozicija: 2, clanovi: c(4, 5), rucni: {} },
  ];
  const a = grupaNaSpravi(grupe, 2, 2, 2, true);
  assert.equal(a.id, 10);
  assert.deepEqual(ids(a.clanovi), [2, 3, 1]);
  assert.deepEqual(ids(grupe[0].clanovi), [1, 2, 3]);
  assert.notEqual(a, grupe[0]);
  const b = grupaNaSpravi(grupe, 1, 2, 2, true);
  assert.equal(b.id, 20);
  assert.deepEqual(ids(b.clanovi), [5, 4]);
  assert.equal(grupaNaSpravi(grupe, 3, 2, 2, true), null);
});

test('grupaNaSpravi: rucni redosled rotacije ima prednost', () => {
  const grupe = [{ id: 10, pocetna_pozicija: 1, clanovi: c(1, 2, 3), rucni: { 2: [3, 1, 2] } }];
  assert.deepEqual(ids(grupaNaSpravi(grupe, 2, 2, 2, true).clanovi), [3, 1, 2]);
  // rotacija 1 nema rucni redosled
  assert.deepEqual(ids(grupaNaSpravi(grupe, 1, 1, 2, true).clanovi), [1, 2, 3]);
});
