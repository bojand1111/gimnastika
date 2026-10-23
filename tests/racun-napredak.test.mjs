import test from 'node:test';
import assert from 'node:assert/strict';
import { napredak } from '../electron/racun/napredak.mjs';

const sprave = [{ id: 10 }, { id: 20 }];
const clan = (id) => ({ prijava_id: id });
// Grupa A pocinje na spravi 1, grupa B na spravi 2.
const grupe = [
  { id: 1, pocetna_pozicija: 1, clanovi: [clan(1), clan(2)] },
  { id: 2, pocetna_pozicija: 2, clanovi: [clan(3)] },
];
const svi = () => true;

test('bez ocena: rotacija 1, nista obradjeno', () => {
  assert.deepEqual(napredak({}, grupe, sprave, svi), { rotacija: 1, ukupno_rotacija: 2, obradjeno: 0, ukupno: 6, gotovo: false });
});

test('rotacija 1 gotova, u toku je rotacija 2', () => {
  // R1: grupa A na spravi 10 (1, 2), grupa B na spravi 20 (3).
  const ocene = { 1: { 10: { status: 'uneto' } }, 2: { 10: { status: 'ispravljeno' } }, 3: { 20: { status: 'uneto' } } };
  assert.deepEqual(napredak(ocene, grupe, sprave, svi), { rotacija: 2, ukupno_rotacija: 2, obradjeno: 3, ukupno: 6, gotovo: false });
});

test('nacrt se ne broji i drzi rotaciju', () => {
  const ocene = { 1: { 10: { status: 'uneto' } }, 2: { 10: { status: 'nacrt' } }, 3: { 20: { status: 'uneto' } } };
  const r = napredak(ocene, grupe, sprave, svi);
  assert.equal(r.rotacija, 1);
  assert.equal(r.obradjeno, 2);
});

test('gotovo tek kad je sve uneto; odustao je obradjeno', () => {
  const ocene = {
    1: { 10: { status: 'uneto' }, 20: { status: 'odustao' } },
    2: { 10: { status: 'uneto' }, 20: { status: 'uneto' } },
    3: { 20: { status: 'uneto' }, 10: { status: 'uneto' } },
  };
  assert.deepEqual(napredak(ocene, grupe, sprave, svi), { rotacija: 2, ukupno_rotacija: 2, obradjeno: 6, ukupno: 6, gotovo: true });
});

test('clan koji ne radi spravu se ne broji', () => {
  const radi = (pid, sid) => !(pid === 2 && sid === 10);
  const r = napredak({}, grupe, sprave, radi);
  assert.equal(r.ukupno, 5);
});

test('nerasporedjeni se ne broje; bez grupa nije gotovo', () => {
  assert.deepEqual(napredak({ 9: { 10: { status: 'uneto' } } }, [], sprave, svi),
    { rotacija: 2, ukupno_rotacija: 2, obradjeno: 0, ukupno: 0, gotovo: false });
});

test('bez sprava je jedna rotacija', () => {
  assert.deepEqual(napredak({}, grupe, [], svi), { rotacija: 1, ukupno_rotacija: 1, obradjeno: 0, ukupno: 0, gotovo: false });
});
