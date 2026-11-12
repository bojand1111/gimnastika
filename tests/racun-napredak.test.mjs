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
  assert.deepEqual(napredak({}, grupe, sprave, svi), { rotacija: 1, ukupno_rotacija: 2, obradjeno: 0, ukupno: 6, gotovo: false, turnus: 1, broj_turnusa: 1 });
});

test('rotacija 1 gotova, u toku je rotacija 2', () => {
  // R1: grupa A na spravi 10 (1, 2), grupa B na spravi 20 (3).
  const ocene = { 1: { 10: { status: 'uneto' } }, 2: { 10: { status: 'ispravljeno' } }, 3: { 20: { status: 'uneto' } } };
  assert.deepEqual(napredak(ocene, grupe, sprave, svi), { rotacija: 2, ukupno_rotacija: 2, obradjeno: 3, ukupno: 6, gotovo: false, turnus: 1, broj_turnusa: 1 });
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
  assert.deepEqual(napredak(ocene, grupe, sprave, svi), { rotacija: 2, ukupno_rotacija: 2, obradjeno: 6, ukupno: 6, gotovo: true, turnus: 1, broj_turnusa: 1 });
});

test('clan koji ne radi spravu se ne broji', () => {
  const radi = (pid, sid) => !(pid === 2 && sid === 10);
  const r = napredak({}, grupe, sprave, radi);
  assert.equal(r.ukupno, 5);
});

test('nerasporedjeni se ne broje; bez grupa nije gotovo', () => {
  assert.deepEqual(napredak({ 9: { 10: { status: 'uneto' } } }, [], sprave, svi),
    { rotacija: 2, ukupno_rotacija: 2, obradjeno: 0, ukupno: 0, gotovo: false, turnus: 1, broj_turnusa: 1 });
});

test('bez sprava je jedna rotacija', () => {
  assert.deepEqual(napredak({}, grupe, [], svi), { rotacija: 1, ukupno_rotacija: 1, obradjeno: 0, ukupno: 0, gotovo: false, turnus: 1, broj_turnusa: 1 });
});

const tg = (id, tu, poz, ...cl) => ({ id, turnus: tu, pocetna_pozicija: poz, clanovi: cl.map(clan) });

test('napredak: dva turnusa, turnus 1 gotov, turnus 2 rotacija 1 nepotpuna', () => {
  const dva = [tg(1, 1, 1, 1), tg(2, 1, 2, 2), tg(3, 2, 1, 3), tg(4, 2, 2, 4)];
  const ocene = { 1: { 10: { status: 'uneto' }, 20: { status: 'uneto' } }, 2: { 10: { status: 'uneto' }, 20: { status: 'uneto' } } };
  const r = napredak(ocene, dva, sprave, svi);
  assert.deepEqual(r, { rotacija: 1, ukupno_rotacija: 2, obradjeno: 4, ukupno: 8, gotovo: false, turnus: 2, broj_turnusa: 2 });
});

test('napredak: dve grupe na istoj spravi u razlicitim turnusima ne mesaju se', () => {
  // obe grupe pocinju na spravi 1; turnus 1 je gotov u rotaciji 1, turnus 2 nije poceo
  const dva = [tg(1, 1, 1, 1), tg(3, 2, 1, 3)];
  const ocene = { 1: { 10: { status: 'uneto' } } };
  const r = napredak(ocene, dva, sprave, svi);
  assert.equal(r.turnus, 1);
  assert.equal(r.rotacija, 2);
  const sveT1 = { 1: { 10: { status: 'uneto' }, 20: { status: 'uneto' } } };
  assert.deepEqual(napredak(sveT1, dva, sprave, svi), { rotacija: 1, ukupno_rotacija: 2, obradjeno: 2, ukupno: 4, gotovo: false, turnus: 2, broj_turnusa: 2 });
});

test('napredak: sve gotovo u dva turnusa daje poslednji turnus', () => {
  const dva = [tg(1, 1, 1, 1), tg(3, 2, 1, 3)];
  const sve = { 1: { 10: { status: 'uneto' }, 20: { status: 'uneto' } }, 3: { 10: { status: 'uneto' }, 20: { status: 'uneto' } } };
  const r = napredak(sve, dva, sprave, svi);
  assert.equal(r.gotovo, true);
  assert.equal(r.turnus, 2);
  assert.equal(r.rotacija, 2);
});
