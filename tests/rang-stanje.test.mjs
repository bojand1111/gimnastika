import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashEkrana, hashRang, parRang, parRezultati, tekstPodnozja, mestoPodaci, mestoIzOznake, sirinaKolone, nazivKolone, odustaoRec, mnozina,
} from '../src/ekrani/rangStanje.js';

test('hashRang: bez pola i praznih vrednosti, sa i bez tab', () => {
  assert.equal(hashRang(null, null, 'viseboj'), '#/rang?tab=viseboj');
  assert.equal(hashRang(3, 7, 12), '#/rang?kat=3&prog=7&tab=12');
  assert.equal(hashRang(0, undefined, undefined), '#/rang?kat=0');
  assert.equal(hashRang('', '', ''), '#/rang');
  assert.ok(!hashRang(3, 7, 12).includes('pol'));
});

test('hashEkrana: redosled parametara i ispustanje praznih', () => {
  assert.equal(hashEkrana('bilten', { kat: 2, prog: null }), '#/bilten?kat=2');
  assert.equal(hashEkrana('rezultati', { t: 5, tk: null, kat: 1, prog: 4 }), '#/rezultati?t=5&kat=1&prog=4');
  assert.equal(hashEkrana('rang', {}), '#/rang');
});

test('parRang: kat, prog i tab iz hasha, stari pol se zanemaruje', () => {
  assert.deepEqual(parRang('#/rang?kat=3&prog=7&tab=12'), { kat: '3', prog: '7', tab: '12' });
  assert.deepEqual(parRang('#/rang'), { kat: '', prog: '', tab: '' });
  assert.deepEqual(parRang('#/rang?pol=Z&kat=3&tab=ekipno'), { kat: '3', prog: '', tab: 'ekipno' });
  assert.ok(!('pol' in parRang('#/stampa?pol=M&kat=1')));
});

test('parRezultati: t, tk, kat i prog iz hasha, stari pol se zanemaruje', () => {
  assert.deepEqual(parRezultati('#/rezultati?t=5&tk=2&kat=1&prog=4'), { t: '5', tk: '2', kat: '1', prog: '4' });
  assert.deepEqual(parRezultati('#/rezultati?t=5&pol=M&kat=1&prog=4'), { t: '5', tk: '', kat: '1', prog: '4' });
  assert.ok(!('pol' in parRezultati('#/rezultati?pol=Z&t=5')));
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

test('granica od 5 sprava: sirinaKolone i nazivKolone', () => {
  assert.equal(sirinaKolone(5, 'viseboj'), 92);
  assert.equal(sirinaKolone(5, 'ekipno'), 100);
  assert.equal(nazivKolone({ naziv: 'Greda', skracenica: 'GR' }, 5), 'GR');
});

test('tekstPodnozja: 0 prijava se prikazuje, null ne', () => {
  const o = { tabNaziv: 'Višeboj', pol: 'M', katNaziv: 'Kadet', progNaziv: 'C program' };
  assert.equal(tekstPodnozja({ ...o, brojPrijava: 0 }), 'Višeboj · MSG · Kadet · C program · 0 takmičara');
});
