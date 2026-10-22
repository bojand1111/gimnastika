import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizuj, vidljivTakmicar, grupisiPoKlubu, sirinaSprava, legenda, porukaDalje, cipPrijava, jediniSlobodan,
} from '../src/ekrani/prijaveFilter.js';

const red = { id_broj: '00203', ime: 'Teodora', prezime: 'Nikolić', klub_id: 3 };
const bez = { upit: '', klub: '' };

test('normalizuj: mala slova bez kvacica', () => {
  assert.equal(normalizuj('ČĆŠŽĐ Đorđe'), 'ccszd dorde');
});

test('vidljivTakmicar: pretraga podniz, redosled reci, ID, klub', () => {
  assert.equal(vidljivTakmicar(red, bez), true);
  assert.equal(vidljivTakmicar(red, { upit: 'NIKOLIC', klub: '' }), true);
  assert.equal(vidljivTakmicar(red, { upit: 'nikolic teodora', klub: '' }), true);
  assert.equal(vidljivTakmicar(red, { upit: '0203', klub: '' }), true);
  assert.equal(vidljivTakmicar(red, { upit: 'xyz', klub: '' }), false);
  assert.equal(vidljivTakmicar(red, { upit: '', klub: '3' }), true);
  assert.equal(vidljivTakmicar(red, { upit: '', klub: '4' }), false);
  assert.equal(vidljivTakmicar({ ...red, klub_id: null }, { upit: '', klub: '0' }), true);
  assert.equal(vidljivTakmicar(red, { upit: 'nik', klub: '4' }), false);
});

test('grupisiPoKlubu: redosled iz stanja, 0 na kraju, lista ostaje', () => {
  const prijave = [
    { id: 1, klub_id: null }, { id: 2, klub_id: 7 }, { id: 3, klub_id: 5 }, { id: 4, klub_id: 7 },
  ];
  const stanje = { redosled_klubova: [7, 5, 0], klubovi: { 5: {}, 7: {}, 0: {} } };
  const g = grupisiPoKlubu(prijave, stanje);
  assert.deepEqual(g.map((x) => x.klubId), [7, 5, 0]);
  assert.deepEqual(g[0].prijave.map((p) => p.id), [2, 4]);
  assert.deepEqual(g[2].prijave.map((p) => p.id), [1]);
});

test('grupisiPoKlubu: 0 se stavlja na kraj i kad je u sredini; prazne grupe nema', () => {
  const stanje = { redosled_klubova: [0, 5, 9], klubovi: {} };
  const g = grupisiPoKlubu([{ id: 1, klub_id: 5 }, { id: 2, klub_id: null }], stanje);
  assert.deepEqual(g.map((x) => x.klubId), [5, 0]);
  assert.deepEqual(grupisiPoKlubu([], stanje), []);
});

test('sirinaSprava: n*30 + (n-1)*3 + 16, najmanje jedna', () => {
  assert.equal(sirinaSprava(6), 211);
  assert.equal(sirinaSprava(4), 4 * 30 + 3 * 3 + 16);
  assert.equal(sirinaSprava(0), 46);
  assert.equal(sirinaSprava(1), 46);
});

const sprave = {
  Z: [{ skracenica: 'PA', naziv: 'Parter' }, { skracenica: 'GR', naziv: 'Greda' }],
  M: [{ skracenica: 'PA', naziv: 'Parter' }, { skracenica: 'KO', naziv: 'Konj sa hvataljkama' }],
};

test('legenda: Z pa M, ista skracenica se spaja, poslednja pobedjuje', () => {
  assert.deepEqual(legenda(sprave, ''), ['PA parter', 'GR greda', 'KO konj sa hvataljkama']);
  assert.deepEqual(legenda({ ...sprave, M: [{ skracenica: 'PA', naziv: 'Podna vezba' }] }, ''), ['PA podna vezba', 'GR greda']);
  assert.deepEqual(legenda(sprave, 'M'), ['PA parter', 'KO konj sa hvataljkama']);
  assert.deepEqual(legenda(sprave, 'Z'), ['PA parter', 'GR greda']);
});

test('porukaDalje: nista kad je sve u redu, inace tekst iz 6.2', () => {
  assert.equal(porukaDalje({ prijava: 5, nepotpune: 0, nepotvrdjeni_klubovi: 0 }), null);
  assert.equal(porukaDalje({ prijava: 5, nepotpune: 2, nepotvrdjeni_klubovi: 0 }),
    'U prijavama još nije dovršeno: prijave bez kategorije, programa ili sprava: 2.');
  assert.equal(porukaDalje({ prijava: 5, nepotpune: 2, nepotvrdjeni_klubovi: 1 }),
    'U prijavama još nije dovršeno: prijave bez kategorije, programa ili sprava: 2; klubovi čiji spisak nije potvrđen: 1.');
  assert.equal(porukaDalje({ prijava: 5, nepotpune: 0, nepotvrdjeni_klubovi: 3 }),
    'U prijavama još nije dovršeno: klubovi čiji spisak nije potvrđen: 3.');
  assert.equal(porukaDalje({ prijava: 0, nepotpune: 0, nepotvrdjeni_klubovi: 0 }), 'Još nema prijava. Prvo prijavite takmičare.');
});

test('jediniSlobodan: vec prijavljeni se ne broje', () => {
  const t = (id) => ({ id });
  assert.equal(jediniSlobodan([t(1), t(2)], new Set([1])), 2);
  assert.equal(jediniSlobodan([t(1), t(2)], new Set()), null);
  assert.equal(jediniSlobodan([t(1)], new Set([1])), null);
  assert.equal(jediniSlobodan([], new Set()), null);
  assert.equal(jediniSlobodan([t(5)], new Set()), 5);
});

test('cipPrijava: jednina, mnozina i ukupno uz filter pola', () => {
  assert.equal(cipPrijava(1, 4, ''), '1 prijava');
  assert.equal(cipPrijava(0, 0, ''), '0 prijave');
  assert.equal(cipPrijava(3, 9, ''), '3 prijave');
  assert.equal(cipPrijava(3, 9, 'M'), '3 prijave · ukupno 9');
  assert.equal(cipPrijava(1, 9, 'Z'), '1 prijava · ukupno 9');
});
