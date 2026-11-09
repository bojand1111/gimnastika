import test from 'node:test';
import assert from 'node:assert/strict';
import { snimak, opisIzmene } from '../electron/racun/izmene.mjs';

const red = (o) => ({ d: 4800, e: 8250, odbitak: 0, konacna: 13050, status: 'uneto', e_sudije: { 1: 8300, 2: 8100, 3: 8400, 4: 8200 }, ...o });

test('snimak uzima samo bitna polja i e_sudije kao objekat', () => {
  const s = snimak({ id: 7, prijava_id: 1, d: 4800, e: 8250, odbitak: 0, konacna: 13050, status: 'uneto', e_sudije: { 1: 8300 } });
  assert.deepEqual(s, { d: 4800, e: 8250, bonus: null, odbitak: 0, konacna: 13050, status: 'uneto', e_sudije: { 1: 8300 } });
  assert.deepEqual(snimak({ ...s, bonus: 100 }).bonus, 100);
  assert.deepEqual(snimak({ status: 'odustao' }), { d: null, e: null, bonus: null, odbitak: null, konacna: null, status: 'odustao', e_sudije: {} });
});

test('opis ispravke E ocene i konacne (POPIS 8.1)', () => {
  const novo = red({ e_sudije: { 1: 8300, 2: 7900, 3: 8400, 4: 8200 }, konacna: 12950 });
  assert.equal(opisIzmene(red(), novo), 'E2 8,100 → 7,900 · konačna 13,050 → 12,950');
});

test('opis sa odbitkom (penalizacija) ide pre E ocena', () => {
  const novo = red({ odbitak: 100, e_sudije: { 1: 8300, 2: 7900, 3: 8400, 4: 8200 }, konacna: 12950 });
  assert.equal(opisIzmene(red(), novo), 'penalizacija 0,000 → 0,100 · E2 8,100 → 7,900 · konačna 13,050 → 12,950');
});

test('opis promene D ocene dolazi prvi', () => {
  assert.equal(opisIzmene(red(), red({ d: 5000, konacna: 13250 })), 'D 4,800 → 5,000 · konačna 13,050 → 13,250');
});

test('E ocene idu po rastucem broju sudije', () => {
  const novo = red({ e_sudije: { 4: 1000, 1: 1000, 3: 8400, 2: 8100 } });
  assert.equal(opisIzmene(red(), novo), 'E1 8,300 → 1,000 · E4 8,200 → 1,000');
});

test('obrisana vrednost ostavlja razmak posle strelice', () => {
  const novo = red({ e_sudije: { 2: 8100, 3: 8400, 4: 8200 } });
  assert.equal(opisIzmene(red(), novo), 'E1 8,300 → ');
});

test('odustajanje nad unetom ocenom (doslovni razmaci)', () => {
  const novo = { d: null, e: null, odbitak: null, konacna: null, status: 'odustao', e_sudije: {} };
  assert.equal(
    opisIzmene(red(), novo),
    'D 4,800 →  · penalizacija 0,000 →  · E1 8,300 →  · E2 8,100 →  · E3 8,400 →  · E4 8,200 →  · označeno odustajanje · konačna 13,050 → ',
  );
});

test('bonus: promena se zapisuje posle D, a pre penalizacije', () => {
  const novo = red({ d: 5000, bonus: 100, odbitak: 300, konacna: 13050 });
  assert.equal(opisIzmene(red({ bonus: 0 }), novo), 'D 4,800 → 5,000 · bonus 0,000 → 0,100 · penalizacija 0,000 → 0,300');
});

test('bonus: null (stara ocena ili stari zapis bez kljuca) i 0 su isto, nema stavke', () => {
  assert.equal(opisIzmene(red(), red({ bonus: 0 })), '');
  assert.equal(opisIzmene(red({ bonus: null }), red({ bonus: 0 })), '');
  assert.equal(opisIzmene(red({ bonus: 0 }), red({ bonus: null })), '');
  assert.equal(opisIzmene(red(), red({ bonus: 200, konacna: 13250 })), 'bonus  → 0,200 · konačna 13,050 → 13,250');
  const odustao = { d: null, e: null, bonus: null, odbitak: null, konacna: null, status: 'odustao', e_sudije: {} };
  assert.ok(opisIzmene(red({ bonus: 100 }), odustao).includes('bonus 0,100 →  · penalizacija 0,000 → '));
  assert.ok(!opisIzmene(red({ bonus: 0 }), odustao).includes('bonus'));
});

test('odustao koji je vec bio odustao nema oznaku', () => {
  assert.equal(opisIzmene(red({ status: 'odustao' }), red({ status: 'odustao' })), '');
});

test('bez razlike je prazan tekst', () => {
  assert.equal(opisIzmene(red(), red()), '');
  assert.equal(opisIzmene({}, {}), '');
});
