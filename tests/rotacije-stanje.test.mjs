import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kp, imeKartice, naslovKartice, premestiLokalno, indeksZaAltStrelice, hashRotacija,
} from '../src/ekrani/rotacijeStanje.js';

const c = (id, extra = {}) => ({ prijava_id: id, ime: 'Ana', prezime: 'Pek', kategorija_id: 1, program_id: 2, ...extra });
const stanje = () => ({
  nerasporedjeni: [c(1), c(2)],
  grupe: [
    { id: 10, naziv: 'A', redosled_rot: [c(3), c(4), c(5)] },
    { id: 11, naziv: 'B', redosled_rot: [] },
  ],
});
const ids = (lista) => lista.map((x) => x.prijava_id);

test('kp: null postaje 0', () => {
  assert.equal(kp({ kategorija_id: null, program_id: null }), '0-0');
  assert.equal(kp({ kategorija_id: 3, program_id: 7 }), '3-7');
  assert.equal(kp({}), '0-0');
});

test('imeKartice: prezime i prvo slovo imena', () => {
  assert.equal(imeKartice({ prezime: 'Laudis Nanaši', ime: 'Dragan' }), 'Laudis Nanaši D.');
  assert.equal(imeKartice({ prezime: 'Pek', ime: '' }), 'Pek .');
  assert.equal(imeKartice({ prezime: 'Pek', ime: '😀x' }), 'Pek 😀.');
});

test('naslovKartice: prezime ime, kategorija, program', () => {
  assert.equal(naslovKartice({ prezime: 'Pek', ime: 'Ana', kategorija: 'Mlađe', program: 'Prvi' }), 'Pek Ana · Mlađe · Prvi');
  assert.equal(naslovKartice({ prezime: 'Pek', ime: 'Ana', kategorija: null, program: null }), 'Pek Ana ·  · ');
});

test('premestiLokalno: unutar kolone gore i dole', () => {
  const dole = premestiLokalno(stanje(), 3, 10, 2);
  assert.deepEqual(ids(dole.grupe[0].redosled_rot), [4, 5, 3]);
  const gore = premestiLokalno(stanje(), 5, 10, 0);
  assert.deepEqual(ids(gore.grupe[0].redosled_rot), [5, 3, 4]);
  const isto = premestiLokalno(stanje(), 4, 10, 1);
  assert.deepEqual(ids(isto.grupe[0].redosled_rot), [3, 4, 5]);
});

test('premestiLokalno: u drugu kolonu, iz neraspolozenih, preko kraja', () => {
  const s = stanje();
  const a = premestiLokalno(s, 4, 11, 0);
  assert.deepEqual(ids(a.grupe[0].redosled_rot), [3, 5]);
  assert.deepEqual(ids(a.grupe[1].redosled_rot), [4]);
  const b = premestiLokalno(s, 1, 10, 0);
  assert.deepEqual(ids(b.nerasporedjeni), [2]);
  assert.deepEqual(ids(b.grupe[0].redosled_rot), [1, 3, 4, 5]);
  const d = premestiLokalno(s, 1, 10, 99);
  assert.deepEqual(ids(d.grupe[0].redosled_rot), [3, 4, 5, 1]);
  const n = premestiLokalno(s, 3, 0, 1);
  assert.deepEqual(ids(n.nerasporedjeni), [1, 3, 2]);
});

test('premestiLokalno: ne menja ulaz, sakrivene kartice se broje, nepoznata prijava ne menja nista', () => {
  const s = stanje();
  const kopija = JSON.stringify(s);
  premestiLokalno(s, 3, 11, 0);
  assert.equal(JSON.stringify(s), kopija);
  // filter ne ulazi u stanje: pozicija je indeks medju svim karticama
  const s2 = { nerasporedjeni: [], grupe: [{ id: 1, redosled_rot: [c(1, { kategorija_id: 9 }), c(2), c(3)] }] };
  assert.deepEqual(ids(premestiLokalno(s2, 3, 1, 1).grupe[0].redosled_rot), [1, 3, 2]);
  assert.deepEqual(premestiLokalno(s, 99, 10, 0), s);
});

test('indeksZaAltStrelice: gore i dole u koloni', () => {
  const s = stanje();
  assert.deepEqual(indeksZaAltStrelice(s, 4, 'ArrowUp'), { grupaId: 10, pozicija: 0 });
  assert.deepEqual(indeksZaAltStrelice(s, 4, 'ArrowDown'), { grupaId: 10, pozicija: 2 });
  assert.equal(indeksZaAltStrelice(s, 3, 'ArrowUp'), null);
  assert.equal(indeksZaAltStrelice(s, 5, 'ArrowDown'), null);
});

test('indeksZaAltStrelice: levo i desno na kraj susedne kolone', () => {
  const s = stanje();
  assert.deepEqual(indeksZaAltStrelice(s, 4, 'ArrowLeft'), { grupaId: 0, pozicija: 2 });
  assert.deepEqual(indeksZaAltStrelice(s, 4, 'ArrowRight'), { grupaId: 11, pozicija: 0 });
  assert.deepEqual(indeksZaAltStrelice(s, 1, 'ArrowRight'), { grupaId: 10, pozicija: 3 });
  assert.equal(indeksZaAltStrelice(s, 1, 'ArrowLeft'), null);
  s.grupe[1].redosled_rot = [c(6)];
  assert.equal(indeksZaAltStrelice(s, 6, 'ArrowRight'), null);
});

test('indeksZaAltStrelice: drugi taster ili nepoznata prijava', () => {
  assert.equal(indeksZaAltStrelice(stanje(), 4, 'a'), null);
  assert.equal(indeksZaAltStrelice(stanje(), 99, 'ArrowUp'), null);
});

test('hashRotacija: kp se izostavlja kad je prazan', () => {
  assert.equal(hashRotacija('Z', 2, '1-2'), '#/rotacije?pol=Z&rot=2&kp=1-2');
  assert.equal(hashRotacija('M', 1, ''), '#/rotacije?pol=M&rot=1');
  assert.equal(hashRotacija('M', 1), '#/rotacije?pol=M&rot=1');
});
