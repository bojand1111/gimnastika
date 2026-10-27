import test from 'node:test';
import assert from 'node:assert/strict';
import {
  imaNedovrseno, tekstNastavi, hashNastavi, tekstPlocice, tekstRotacije, lekarskiOznaka,
} from '../src/ekrani/pocetnaStanje.js';

const st = (extra = {}) => ({ prijava: 5, nepotpune: 0, nerasporedjeni: 0, nepotvrdjeni_klubovi: 0, korak: 'spremno', ...extra });

test('imaNedovrseno: null, bez prijava i sve gotovo nisu nedovrseni', () => {
  assert.equal(imaNedovrseno(null), false);
  assert.equal(imaNedovrseno(st({ prijava: 0, nepotpune: 3 })), false);
  assert.equal(imaNedovrseno(st()), false);
});

test('imaNedovrseno: svaki od tri uslova', () => {
  assert.equal(imaNedovrseno(st({ nepotpune: 1 })), true);
  assert.equal(imaNedovrseno(st({ nerasporedjeni: 2 })), true);
  assert.equal(imaNedovrseno(st({ nepotvrdjeni_klubovi: 1 })), true);
});

test('tekstNastavi i hashNastavi prate korak', () => {
  assert.equal(tekstNastavi(st({ korak: 'spremno' })), 'Otvori takmičenje');
  assert.equal(hashNastavi(st({ korak: 'spremno' })), '#/takmicenje');
  assert.equal(tekstNastavi(st({ korak: 'prijave' })), 'Nastavi pripremu: Prijave');
  assert.equal(hashNastavi(st({ korak: 'prijave' })), '#/prijave');
  assert.equal(tekstNastavi(st({ korak: 'rotacije' })), 'Nastavi pripremu: Rotacije');
  assert.equal(hashNastavi(st({ korak: 'rotacije' })), '#/rotacije');
});

test('tekstPlocice: nastavi, gotovo, bez grupa', () => {
  const nastavi = { sprava: { naziv: 'Greda' }, rotacija: 2, uneto: 3, ukupno: 8, pol: 'Z' };
  assert.equal(tekstPlocice({ gotovo: false }, nastavi), 'Nastavi: Greda · Rotacija 2 · uneto 3 od 8');
  assert.equal(tekstPlocice({ gotovo: true }, null), 'Sve ocene su unete');
  assert.equal(tekstPlocice(null, null), 'Prepisivanje ocena sa sudijskih listića');
  assert.equal(tekstPlocice({ gotovo: false }, null), 'Prepisivanje ocena sa sudijskih listića');
});

test('tekstRotacije: broj i opis', () => {
  assert.deepEqual(tekstRotacije(null), { broj: '–', tekst: 'grupe još nisu napravljene' });
  assert.deepEqual(tekstRotacije({ rotacija: 4, ukupno_rotacija: 4, gotovo: true, pol: 'Z' }), { broj: '4 / 4', tekst: 'sve rotacije su unete' });
  assert.deepEqual(tekstRotacije({ rotacija: 2, ukupno_rotacija: 4, gotovo: false, pol: 'Z' }), { broj: '2 / 4', tekst: 'rotacija u toku (ŽSG)' });
  assert.deepEqual(tekstRotacije({ rotacija: 1, ukupno_rotacija: 6, gotovo: false, pol: 'M' }), { broj: '1 / 6', tekst: 'rotacija u toku (MSG)' });
  assert.equal(tekstRotacije({ rotacija: 1, ukupno_rotacija: 6, gotovo: false, pol: 'X' }).tekst, 'rotacija u toku ()');
});

test('lekarskiOznaka: nema, istekao, istice', () => {
  const l = (stanje, lekarski_do) => ({ lek: { stanje }, lekarski_do, datum: '2026-10-17' });
  assert.deepEqual(lekarskiOznaka(l('nema', null)), { klasa: 'status-bad', tekst: 'Nema lekarskog', title: '', datum: '' });
  assert.deepEqual(lekarskiOznaka(l('istekao', '2026-10-09')), {
    klasa: 'status-bad', tekst: 'Važio do', title: 'Ne važi na dan takmičenja (17.10.2026.)', datum: '09.10.2026.',
  });
  assert.deepEqual(lekarskiOznaka(l('istice', '2026-10-25')), {
    klasa: 'status-warn', tekst: 'Važi do', title: 'Važi na dan takmičenja (17.10.2026.), ali ističe ubrzo posle', datum: '25.10.2026.',
  });
});
