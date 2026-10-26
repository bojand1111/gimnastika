import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashEkrana, hashRang, tekstPodnozja, mestoPodaci, mestoIzOznake, sirinaKolone, nazivKolone, odustaoRec, mnozina,
} from '../src/ekrani/rangStanje.js';

test('hashRang: bez praznih vrednosti, sa i bez tab', () => {
  assert.equal(hashRang('Z', null, null, 'viseboj'), '#/rang?pol=Z&tab=viseboj');
  assert.equal(hashRang('M', 3, 7, 12), '#/rang?pol=M&kat=3&prog=7&tab=12');
  assert.equal(hashRang('Z', 0, undefined, undefined), '#/rang?pol=Z&kat=0');
  assert.equal(hashRang('Z', '', '', ''), '#/rang?pol=Z');
});

test('hashEkrana: redosled parametara i ispustanje praznih', () => {
  assert.equal(hashEkrana('bilten', { pol: 'Z', kat: 2, prog: null }), '#/bilten?pol=Z&kat=2');
  assert.equal(hashEkrana('rezultati', { t: 5, tk: null, pol: 'M', kat: 1, prog: 4 }), '#/rezultati?t=5&pol=M&kat=1&prog=4');
  assert.equal(hashEkrana('rang', {}), '#/rang');
});

test('mestoPodaci: cetiri slucaja', () => {
  assert.deepEqual(mestoPodaci(null, 'VK'), { vrsta: 'vk', tekst: 'VK' });
  assert.deepEqual(mestoPodaci(1, 'VK'), { vrsta: 'vk', tekst: 'VK' });
  assert.deepEqual(mestoPodaci(null, ''), { vrsta: 'prazno', tekst: '–' });
  assert.deepEqual(mestoPodaci(3, '3'), { vrsta: 'plocica', tekst: '3' });
  assert.deepEqual(mestoPodaci(4, '4'), { vrsta: 'obicno', tekst: '4' });
});

test('mestoIzOznake: cifre, VK, ostalo', () => {
  assert.deepEqual(mestoIzOznake('2'), { vrsta: 'plocica', tekst: '2' });
  assert.deepEqual(mestoIzOznake('VK'), { vrsta: 'vk', tekst: 'VK' });
  assert.deepEqual(mestoIzOznake(''), { vrsta: 'prazno', tekst: '–' });
  assert.deepEqual(mestoIzOznake(undefined), { vrsta: 'prazno', tekst: '–' });
});

test('sirinaKolone: po broju sprava', () => {
  assert.equal(sirinaKolone(4, 'viseboj'), 116);
  assert.equal(sirinaKolone(6, 'viseboj'), 92);
  assert.equal(sirinaKolone(4, 'ekipno'), 124);
  assert.equal(sirinaKolone(6, 'ekipno'), 100);
  assert.equal(sirinaKolone(4, 'sva'), 96);
  assert.equal(sirinaKolone(6, 'sva'), 80);
});

test('nazivKolone: naziv do 4 sprave, skracenica preko', () => {
  const s = { naziv: 'Preskok', skracenica: 'PR' };
  assert.equal(nazivKolone(s, 4), 'Preskok');
  assert.equal(nazivKolone(s, 5), 'PR');
});

test('tekstPodnozja: sa i bez broja prijava i ekipnog sufiksa', () => {
  const o = { tabNaziv: 'Višeboj', pol: 'Z', katNaziv: 'Kadet', progNaziv: 'C program', brojPrijava: 5 };
  assert.equal(tekstPodnozja(o), 'Višeboj · ŽSG · Kadet · C program · 5 takmičarki');
  assert.equal(tekstPodnozja({ ...o, pol: 'M', brojPrijava: null }), 'Višeboj · MSG · Kadet · C program');
  assert.equal(tekstPodnozja({ ...o, tabNaziv: 'Ekipno', ekipno: true, ekipnoBroji: 3 }),
    'Ekipno · ŽSG · Kadet · C program · 5 takmičarki · ocene u zagradi se ne broje (broji se 3 najbolje po spravi)');
});

test('odustaoRec i mnozina po polu', () => {
  assert.equal(odustaoRec('Z'), 'Odustala');
  assert.equal(odustaoRec('M'), 'Odustao');
  assert.equal(mnozina('Z'), 'takmičarki');
  assert.equal(mnozina('M'), 'takmičara');
});
