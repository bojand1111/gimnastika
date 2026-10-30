import test from 'node:test';
import assert from 'node:assert/strict';
import { kolone, izPodataka, vremeIzmene } from '../src/ekrani/unos/redovi.js';

test('kolone: formula za 4 i 6 sudija', () => {
  assert.equal(kolone(4), '36px 44px minmax(0,1fr) 64px 60px 60px 60px 60px 66px 60px 104px 146px');
  assert.equal(kolone(6).split(' ').length, 4 + 6 + 4);
});

test('izPodataka: redovi, ne_radi i racun nacrta', () => {
  const d = {
    brojSudija: 4, pravilo: 'odbaci_krajnje', zaokruzivanje: 'odseci',
    redovi: [
      { prijava_id: 1, rb: 1, radi: true, status: 'nacrt', d: '4,800', e_sudije: ['8,300', '8,100', '8,400', '8,200'], odbitak: '', e: '', konacna: '', ime: 'A B', pol: 'Z', opis: '', vk: false, startni_broj: 5 },
      { prijava_id: 2, rb: 2, radi: false, status: 'nacrt', d: '', e_sudije: ['', '', '', ''], odbitak: '', e: '', konacna: '', ime: 'C D', pol: 'Z', opis: '', vk: false, startni_broj: null },
      { prijava_id: 3, rb: 3, radi: true, status: 'uneto', d: '1,000', e_sudije: ['1,000', '', '', ''], odbitak: '0,000', e: '', konacna: '', ime: 'E F', pol: 'M', opis: '', vk: true, startni_broj: 7 },
    ],
  };
  const r = izPodataka(d);
  assert.equal(r[0].e, '8,250');
  assert.equal(r[0].konacna, '13,050');
  assert.equal(r[0].vrednosti.e4, '8,200');
  assert.equal(r[1].status, 'ne_radi');
  assert.equal(r[2].e, '–');
  assert.equal(r[2].vrednosti.d, '1,000');
  assert.ok(r[0].greske instanceof Set);
});

test('vremeIzmene: UTC u HH:mm lokalno', () => {
  const t = new Date('2026-10-22T09:05:00Z');
  const ocekivano = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  assert.equal(vremeIzmene('2026-10-22 09:05:00'), ocekivano);
  assert.equal(vremeIzmene('nije vreme'), '');
});
