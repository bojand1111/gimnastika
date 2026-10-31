import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kolone, mestoTekst, gdeKada, vremeStampe, imePdf, legendaStampe, legendaBiltena, ekipaRec, grupisiSekcije, odustalaRec,
} from '../src/ekrani/stampaStanje.js';

test('kolone: uspravno 104 px, polozeno 112 px po spravi', () => {
  assert.equal(kolone(4, false), '50px 32px minmax(0,1fr) 104px 104px 104px 104px 70px');
  assert.equal(kolone(6, true), '50px 32px minmax(0,1fr) 112px 112px 112px 112px 112px 112px 70px');
  assert.equal(kolone(0, false), '50px 32px minmax(0,1fr) 70px');
});

test('mestoTekst: VK, bez mesta, broj sa tackom', () => {
  assert.equal(mestoTekst(null, 'VK'), 'VK');
  assert.equal(mestoTekst(2, 'VK'), 'VK');
  assert.equal(mestoTekst(null, ''), '–');
  assert.equal(mestoTekst(undefined, undefined), '–');
  assert.equal(mestoTekst(1, '1'), '1.');
  assert.equal(mestoTekst(12, '12'), '12.');
});

test('gdeKada: mesto i datum, samo datum, prazan datum ostavlja zarez (kao PHP)', () => {
  assert.equal(gdeKada({ mesto: 'Novi Sad', datum: '2026-10-17' }), 'Novi Sad, 17.10.2026.');
  assert.equal(gdeKada({ mesto: '', datum: '2026-10-17' }), '17.10.2026.');
  assert.equal(gdeKada({ datum: '2026-10-17' }), '17.10.2026.');
  assert.equal(gdeKada({ mesto: 'Niš', datum: '' }), 'Niš, ');
  assert.equal(gdeKada({ mesto: 'Niš', datum: null }), 'Niš, ');
});

test('vremeStampe: puno i kratko, lokalno vreme sa nulama', () => {
  const d = new Date(2026, 9, 7, 9, 5);
  assert.deepEqual(vremeStampe(d), { puno: '07.10.2026. 09:05', kratko: '07.10. 09:05' });
  const k = new Date(2026, 11, 31, 23, 59);
  assert.deepEqual(vremeStampe(k), { puno: '31.12.2026. 23:59', kratko: '31.12. 23:59' });
});

test('imePdf: bilten, rang lista, pol, bez nedozvoljenih znakova', () => {
  assert.equal(imePdf('bilten', 'Jesenji kup 2026', 'Z'), 'Bilten-Jesenji kup 2026-ŽSG.pdf');
  assert.equal(imePdf('Višeboj', 'Jesenji kup 2026', 'M'), 'Rang-lista-Jesenji kup 2026-Višeboj-MSG.pdf');
  assert.equal(imePdf('Dvovisinski razboj', 'Kup', 'Z'), 'Rang-lista-Kup-Dvovisinski razboj-ŽSG.pdf');
  assert.equal(imePdf('bilten', 'A/B: "C"? <D>*|E\\F', 'Z'), 'Bilten-AB C DEF-ŽSG.pdf');
  assert.equal(imePdf('Ekipno', '  Kup   2026 ', 'Z'), 'Rang-lista-Kup 2026-Ekipno-ŽSG.pdf');
  assert.equal(imePdf('bilten', '', 'Z'), 'Bilten-ŽSG.pdf');
  assert.equal(imePdf('ceo-bilten', 'Jesenji kup 2026', 'M'), 'Ceo-bilten-Jesenji kup 2026-MSG.pdf');
  assert.equal(imePdf('zapisnici', 'Kup', 'Z'), 'Zapisnici-Kup-ŽSG.pdf');
});

const takm = { pravilo_e: 'odbaci_krajnje', ekipno_broji: 3 };

test('legendaStampe: dva reda, pravilo E, pol i ekipni dodatak', () => {
  const z = legendaStampe(takm, 'viseboj', 'Z');
  assert.equal(z.length, 2);
  assert.equal(z[0], 'D = težina vežbe · E = izvođenje (prosek srednjih ocena E sudija) · Odb. = odbitak · (n) = mesto na spravi · Br. = startni broj');
  assert.equal(z[1], 'Ocena na spravi = D + E − odbitak. VK = van konkurencije: ocene se prikazuju, takmičarka ne zauzima mesto.');
  const m = legendaStampe({ ...takm, pravilo_e: 'prosek' }, 7, 'M');
  assert.match(m[0], /\(prosek ocena E sudija\)/);
  assert.match(m[1], /takmičar ne zauzima mesto\.$/);
  const e = legendaStampe(takm, 'ekipno', 'Z');
  assert.equal(e[1], `${z[1]} Ekipno: po spravi se broje 3 najbolje ocene, ocene u zagradi se ne broje.`);
});

test('legendaBiltena: jedan tekst sa ekipno_broji', () => {
  assert.equal(legendaBiltena({ ekipno_broji: 2 }),
    'D = težina vežbe, E = izvođenje, Uk. = ocena na spravi (D + E − odbitak). Ekipno: po spravi se broje 2 najbolje ocene, ocene u zagradi se ne broje. VK = van konkurencije.');
});

test('ekipaRec: jedna ekipa, ostalo ekipe', () => {
  assert.equal(ekipaRec(1), 'ekipa');
  assert.equal(ekipaRec(3), 'ekipe');
  assert.equal(ekipaRec(0), 'ekipe');
});

test('grupisiSekcije: uzastopne stavke iste sekcije, prazno daje prazan niz', () => {
  const st = [{ sekcija: 'ekipno', id: 1 }, { sekcija: 'ekipno', id: 2 }, { sekcija: 'viseboj', id: 3 }];
  assert.deepEqual(grupisiSekcije(st), [
    { sekcija: 'ekipno', stavke: [st[0], st[1]] },
    { sekcija: 'viseboj', stavke: [st[2]] },
  ]);
  assert.deepEqual(grupisiSekcije([]), []);
});

test('odustalaRec: mala slova po polu', () => {
  assert.equal(odustalaRec('Z'), 'odustala');
  assert.equal(odustalaRec('M'), 'odustao');
});

test('gdeKada: bez mesta i bez datuma je prazan tekst', () => {
  assert.equal(gdeKada({ datum: '' }), '');
  assert.equal(gdeKada({ mesto: undefined, datum: null }), '');
});
