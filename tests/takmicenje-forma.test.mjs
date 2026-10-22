import test from 'node:test';
import assert from 'node:assert/strict';
import { izForme, uFormu, poljeGreske, listaGresaka } from '../src/ekrani/takmicenjeForma.js';

const red = {
  id: 7, naziv: 'Prvenstvo', datum: '2026-10-17', mesto: 'Novi Sad', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje',
  ekipno_broji: 3, pomeraj_redosled: 1, zavrseno: 0, zaglavlje_biltena: 'GSS', organizator: 'Org', domacin: 'Klub X',
  grb_levo: '', grb_desno: 'grb/x.png', grb_desno_url: 'file:///x.png?v=1',
};

test('uFormu: datum kao dd.mm.gggg., brojevi i kucice', () => {
  const f = uFormu(red);
  assert.equal(f.datum, '17.10.2026.');
  assert.equal(f.broj_e_sudija, 4);
  assert.equal(f.ekipno_broji, '3');
  assert.equal(f.pomeraj_redosled, true);
  assert.equal(f.zavrseno, false);
  assert.equal(f.naziv, 'Prvenstvo');
  assert.equal(f.domacin, 'Klub X');
});

test('uFormu: prazno takmicenje (datum null) daje prazan datum', () => {
  const f = uFormu({ ...red, datum: null });
  assert.equal(f.datum, '');
});

test('izForme: brojevi, 0/1 i trimovani tekst', () => {
  const p = izForme({
    naziv: '  Kup  ', datum: ' 17.10.2026. ', mesto: ' Niš ', broj_e_sudija: 5, pravilo_e: 'prosek_svih',
    ekipno_broji: ' 4 ', pomeraj_redosled: true, zavrseno: true, zaglavlje_biltena: ' H ', organizator: ' O ', domacin: ' D ',
  });
  assert.deepEqual(p, {
    naziv: 'Kup', datum: '17.10.2026.', mesto: 'Niš', broj_e_sudija: 5, pravilo_e: 'prosek_svih', ekipno_broji: 4,
    pomeraj_redosled: 1, zavrseno: 1, zaglavlje_biltena: 'H', organizator: 'O', domacin: 'D',
  });
});

test('izForme: neispravan broj postaje 0, datum ostaje sirov', () => {
  const p = izForme({ ...uFormu(red), ekipno_broji: 'abc', datum: '31.02.2026.', pomeraj_redosled: false, zavrseno: false });
  assert.equal(p.ekipno_broji, 0);
  assert.equal(p.datum, '31.02.2026.');
  assert.equal(p.pomeraj_redosled, 0);
  assert.equal(p.zavrseno, 0);
});

test('izForme na uFormu cuva vrednosti (krug)', () => {
  const p = izForme(uFormu(red));
  assert.equal(p.naziv, 'Prvenstvo');
  assert.equal(p.datum, '17.10.2026.');
  assert.equal(p.ekipno_broji, 3);
  assert.equal(p.pomeraj_redosled, 1);
  assert.equal(p.zavrseno, 0);
});

test('poljeGreske: poruka modela vodi na polje', () => {
  assert.equal(poljeGreske('Naziv takmičenja je obavezan.'), 'naziv');
  assert.equal(poljeGreske('Datum je obavezan.'), 'datum');
  assert.equal(poljeGreske('Datum nije ispravan (dd.mm.gggg).'), 'datum');
  assert.equal(poljeGreske('Broj ocena koje se broje za ekipu mora biti između 1 i 10.'), 'ekipno_broji');
  assert.equal(poljeGreske('Broj E sudija mora biti između 1 i 6.'), 'izbor-sudije');
  assert.equal(poljeGreske('Nepoznato pravilo za E ocenu.'), null);
  assert.equal(poljeGreske('Nešto treće.'), null);
});

test('listaGresaka: err.greske ima prednost, inace jedna err.message', () => {
  assert.deepEqual(listaGresaka({ message: 'A. B.', greske: ['A.', 'B.'] }), ['A.', 'B.']);
  assert.deepEqual(listaGresaka({ message: 'Jedna.', greske: null }), ['Jedna.']);
  assert.deepEqual(listaGresaka({ message: 'Jedna.', greske: [] }), ['Jedna.']);
  assert.deepEqual(listaGresaka(new Error('Nema veze.')), ['Nema veze.']);
});
