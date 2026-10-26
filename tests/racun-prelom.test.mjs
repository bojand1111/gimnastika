import test from 'node:test';
import assert from 'node:assert/strict';
import { straneSprava, straneEkipno, straneViseboj, stavkeBiltena, straneBilten } from '../electron/racun/prelom.mjs';

const redovi = (n) => Array.from({ length: n }, (_, i) => ({ i }));
const ekipa = (n) => ({ clanovi: redovi(n) });

test('straneSprava: 30 redova po strani', () => {
  assert.equal(straneSprava(redovi(30)).length, 1);
  const s = straneSprava(redovi(31));
  assert.deepEqual(s.map((x) => x.length), [30, 1]);
  assert.equal(s[1][0].i, 30);
  assert.deepEqual(straneSprava(redovi(7), 5).map((x) => x.length), [5, 2]);
});

test('straneEkipno: ekipa se ne deli, velika ekipa ide sama na stranu', () => {
  // 1+5 = 6 redova po ekipi: pet ekipa staje u 30
  assert.deepEqual(straneEkipno([1, 2, 3, 4, 5].map(() => ekipa(5))).map((x) => x.length), [5]);
  assert.deepEqual(straneEkipno([1, 2, 3, 4, 5, 6].map(() => ekipa(5))).map((x) => x.length), [5, 1]);
  // ekipa od 1+28 = 29 redova, pa 6 ne staje uz nju
  const s = straneEkipno([ekipa(5), ekipa(28), ekipa(5)]);
  assert.deepEqual(s.map((x) => x.length), [1, 1, 1]);
  assert.equal(s[1][0].clanovi.length, 28);
  // sama ekipa veca od strane ide na svoju stranu
  assert.deepEqual(straneEkipno([ekipa(40)]).map((x) => x.length), [1]);
  assert.deepEqual(straneEkipno([ekipa(2), ekipa(40), ekipa(2)]).map((x) => x.length), [1, 1, 1]);
});

test('straneViseboj: 11 uspravno, 6 polozeno', () => {
  assert.deepEqual(straneViseboj(redovi(12), false).map((x) => x.length), [11, 1]);
  assert.deepEqual(straneViseboj(redovi(11), false).map((x) => x.length), [11]);
  assert.deepEqual(straneViseboj(redovi(7), true).map((x) => x.length), [6, 1]);
});

test('prazno je jedna prazna strana', () => {
  assert.deepEqual(straneSprava([]), [[]]);
  assert.deepEqual(straneEkipno([]), [[]]);
  assert.deepEqual(straneViseboj([], false), [[]]);
  assert.deepEqual(straneBilten([], { polozeno: false, organizator: '', zaglavlje: '', domacin: '' }), [[]]);
  assert.deepEqual(stavkeBiltena({ ekipno: [], viseboj: [] }), []);
});

test('stavkeBiltena: ekipa, clanovi, pa redovi viseboja sa visinama', () => {
  const rez = { ekipno: [{ clanovi: [{ a: 1 }, { a: 2 }] }], viseboj: [{ b: 1 }] };
  const s = stavkeBiltena(rez);
  assert.deepEqual(s.map((x) => [x.tip, x.sekcija, x.v]), [
    ['ekipa', 'ekipno', 24], ['clan', 'ekipno', 23], ['clan', 'ekipno', 23], ['red', 'viseboj', 37],
  ]);
  assert.equal(s[0].podaci, rez.ekipno[0]);
  assert.equal(s[3].podaci, rez.viseboj[0]);
});

function bilten(polozeno, extra = {}) {
  const rez = {
    ekipno: [1, 2, 3].map(() => ({ clanovi: redovi(4) })),
    viseboj: Array.from({ length: 25 }, (_, i) => ({ i })),
  };
  return straneBilten(stavkeBiltena(rez), { polozeno, organizator: '', zaglavlje: '', domacin: '', ...extra });
}

test('bilten uspravno: 3 ekipe x 4 clana + 25 redova viseboja daju dve strane', () => {
  // prva: 1123-96 = 1027; zaglavlje 96 -> kapacitet 851; ekipno 64 + 3*(24+4*23) = 412; viseboj 86 + 9*37 = 419 (831)
  const s = bilten(false);
  assert.deepEqual(s.map((x) => x.length), [24, 16]);
  assert.equal(s[0].filter((x) => x.sekcija === 'viseboj').length, 9);
  // druga strana ponavlja sekciju viseboj
  assert.equal(s[1][0].tip, 'red');
  assert.ok(s[1].every((x) => x.sekcija === 'viseboj'));
});

test('bilten: organizator, zaglavlje i domacin smanjuju prvu stranu', () => {
  // zaglavlje 96+18+16+16 = 146 -> kapacitet 801: viseboj staje 8 redova (412+86+8*37=794; 9 -> 831)
  const s = bilten(false, { organizator: 'Savez', zaglavlje: 'Zaglavlje', domacin: 'Klub' });
  assert.deepEqual(s.map((x) => x.length), [23, 17]);
});

test('bilten polozeno: manje mesta, vise strana, sekcija se ponavlja', () => {
  // 794-96 = 698; prva 698-96-80 = 522: ekipno 412, viseboj 86 -> 498, + 0 redova (535 > 522)
  const s = bilten(true);
  assert.ok(s.length >= 3);
  assert.equal(s.flat().length, 15 + 25);
  assert.equal(s[0].filter((x) => x.sekcija === 'viseboj').length, 0);
  assert.equal(s[1][0].sekcija, 'viseboj');
  // ostale strane: 698-30-80 = 588 -> 86 + 13*37 = 567
  assert.equal(s[1].length, 13);
  assert.equal(s[2].length, 12);
});

test('bilten: ekipa moze da se podeli izmedju strana', () => {
  const s = straneBilten(stavkeBiltena({
    ekipno: Array.from({ length: 10 }, () => ({ clanovi: redovi(4) })), viseboj: [],
  }), { polozeno: true, organizator: '', zaglavlje: '', domacin: '' });
  assert.ok(s.length > 1);
  assert.equal(s.flat().length, 50);
  assert.ok(s.slice(1).every((st) => st[0].sekcija === 'ekipno'));
});

test('straneBilten: tacno popunjena strana se ne prelama, jedna stavka vise prelama', () => {
  // prva strana uspravno: 1027 - 96 - 80 = 851; zaglavlje sekcije viseboj 86
  const opc = { polozeno: false, organizator: '', zaglavlje: '', domacin: '' };
  const st = (...v) => v.map((x) => ({ tip: 'red', sekcija: 'viseboj', v: x, podaci: {} }));
  assert.equal(straneBilten(st(764, 1), opc).length, 1, '86 + 764 + 1 = 851 staje tacno');
  assert.deepEqual(straneBilten(st(765, 1), opc).map((x) => x.length), [1, 1], '852 ne staje');
});
