import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { listaIzRezultata, snimak } from '../electron/racun/sinhro-paket.mjs';

const require = createRequire(import.meta.url);
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviRezultate } = require('../electron/modeli/rezultati.cjs');
const { napravi: napraviSifarnike } = require('../electron/modeli/sifarnici.cjs');
const { uvezi } = require('../alati/primer-podaci.cjs');
const json = require('../docs/proizvod/dizajn/primer-podaci.json');

// Snimak aktivnog takmicenja jednog dela (pol) nad primer podacima, napravljen kroz modele u memoriji.
function gradi(pol = 'Z') {
  const baza = otvori(':memory:');
  baza.migriraj();
  uvezi(baza, json);
  const podesavanja = napraviPodesavanja(baza, '');
  const rezultati = napraviRezultate(baza, podesavanja);
  const sifarnici = napraviSifarnike(baza);
  podesavanja.postaviPol(pol);
  const takm = podesavanja.aktivno(pol);
  const liste = rezultati.kombinacije(Number(takm.id)).map((k) => listaIzRezultata(k, rezultati.izracunaj(takm, k.pol, k.kategorija_id ?? null, k.program_id ?? null)));
  const s = snimak({ takm, sprave: { Z: sifarnici.sprave('Z'), M: sifarnici.sprave('M') }, liste, verzija: '1.2.3', sad: '2026-10-27 10:15:30' });
  return { s, baza };
}

test('snimak: zaglavlje, takmicenje i sprave po polu', () => {
  const { s } = gradi();
  assert.equal(s.verzija_formata, 1);
  assert.deepEqual(s.program, { naziv: 'Gimnastika desktop', verzija: '1.2.3' });
  assert.equal(s.poslato, '2026-10-27T10:15:30.000Z');
  assert.equal(s.takmicenje.naziv, json.takmicenje.naziv);
  assert.deepEqual(Object.keys(s.takmicenje), ['id', 'naziv', 'datum', 'mesto', 'organizator', 'domacin', 'zavrseno', 'izmenjeno']);
  assert.equal(s.sprave.Z.length, 4);
  assert.equal(s.sprave.M.length, 6);
  assert.deepEqual(Object.keys(s.sprave.Z[0]), ['id', 'naziv', 'skracenica']);
  assert.equal(s.liste.length, 1);
  assert.deepEqual(s.liste.map((l) => l.pol), ['Z']);
  assert.equal(s.liste[0].kategorija.naziv, 'Kadet');
  assert.equal(s.liste[0].program.naziv, 'C program');
});

test('snimak: MSG takmicenje nosi samo MSG listu', () => {
  const { s } = gradi('M');
  assert.equal(s.takmicenje.naziv, json.takmicenje.naziv);
  assert.equal(s.liste.length, 1);
  assert.deepEqual(s.liste.map((l) => l.pol), ['M']);
  assert.equal(s.liste[0].viseboj.length, json.msg_kadet_c.takmicari.length);
  assert.equal(s.sprave.Z.length, 4);
  assert.equal(s.sprave.M.length, 6);
});

test('snimak: visebojska rang lista Z, Petrovic Ana', () => {
  const { s } = gradi();
  const z = s.liste[0];
  const ana = z.viseboj[0];
  assert.equal(ana.prezime, 'Petrović');
  assert.equal(ana.ime, 'Ana');
  assert.equal(ana.mesto, 1);
  assert.equal(ana.zbir_h, 50300);
  assert.equal(ana.zbir, '50,300');
  assert.equal(ana.odustao, false);
  assert.equal(Number.isInteger(ana.zbir_h), true);
  const sid = Object.keys(ana.po_spravi)[0];
  assert.equal(ana.po_spravi[sid].konacna, `${Math.floor(ana.po_spravi[sid].konacna_h / 1000)},${String(ana.po_spravi[sid].konacna_h % 1000).padStart(3, '0')}`);
});

test('snimak: ekipno VOJ ukupno 144,550', () => {
  const { s } = gradi();
  const voj = s.liste[0].ekipno.find((e) => e.klub === 'VOJ');
  assert.equal(voj.ukupno_h, 144550);
  assert.equal(voj.ukupno, '144,550');
  assert.equal(voj.mesto, 1);
  assert.ok(voj.clanovi.length >= 3);
  assert.ok(voj.clanovi.every((c) => typeof c.prijava_id === 'number' && c.ime && c.prezime));
  assert.equal(voj.klub_ime.length > 0, true);
});

test('snimak: odustala Djordjevic Sara ima odustao true i mesto null', () => {
  const { s } = gradi();
  const z = s.liste[0];
  const naSpravi = Object.values(z.po_spravi).flat().filter((r) => r.prezime === 'Đorđević' && r.ime === 'Sara');
  const odustale = naSpravi.filter((r) => r.odustao);
  assert.ok(odustale.length >= 1, 'odustala je na bar jednoj spravi (GR/PA)');
  for (const r of odustale) {
    assert.equal(r.mesto, null);
    assert.equal('konacna_h' in r, false, 'odustao nema ocenu');
  }
  const vb = z.viseboj.find((r) => r.prezime === 'Đorđević' && r.ime === 'Sara');
  assert.equal(vb.odustao, true);
  assert.equal(vb.mesto, null);
  // nedostajuca ocena (odustao) se izostavlja iz po_spravi viseboja
  assert.ok(Object.keys(vb.po_spravi).length < Object.keys(z.po_spravi).length);
});

test('snimak: oblik reda sprave i JSON se vraca kroz stringify bez gubitka', () => {
  const { s } = gradi();
  const red = Object.values(s.liste[0].po_spravi)[0][0];
  for (const k of ['mesto', 'oznaka', 'prijava_id', 'startni_broj', 'ime', 'prezime', 'klub', 'klub_ime', 'd', 'e', 'odbitak', 'konacna', 'konacna_h', 'odustao']) {
    assert.ok(k in red, k);
  }
  assert.equal(typeof red.konacna_h, 'number');
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('listaIzRezultata: viseboj bez ijedne ocene nema zbir ni zbir_h', () => {
  const rez = {
    prijave: { 5: { ime: 'A', prezime: 'B', klub_skr: 'X', klub_ime: 'Klub X', startni_broj: 1 } },
    po_spravi: {},
    viseboj: [
      { prijava: 5, zbir: null, mesto: null, oznaka: '', odustao: true, ocene: { 7: null } },
    ],
    ekipno: [],
  };
  const l = listaIzRezultata({ pol: 'Z', kategorija_id: 1, kategorija: 'K', program_id: 1, program: 'P' }, rez);
  const red = l.viseboj[0];
  assert.equal('zbir' in red, false);
  assert.equal('zbir_h' in red, false);
  assert.deepEqual(red.po_spravi, {});
  assert.equal(red.odustao, true);
  assert.equal(red.mesto, null);
});

test('snimak: tacan skup kljuceva (cuvar od curenja licnih podataka)', () => {
  const { s } = gradi();
  const l = s.liste[0];
  assert.deepEqual(Object.keys(l), ['pol', 'kategorija', 'program', 'po_spravi', 'viseboj', 'ekipno']);
  assert.deepEqual(Object.keys(s), ['verzija_formata', 'program', 'poslato', 'takmicenje', 'sprave', 'liste']);
  const red = Object.values(l.po_spravi).flat().find((r) => !r.odustao);
  assert.deepEqual(Object.keys(red), ['mesto', 'oznaka', 'prijava_id', 'startni_broj', 'ime', 'prezime', 'klub', 'klub_ime', 'd', 'e', 'odbitak', 'konacna', 'konacna_h', 'odustao']);
  assert.deepEqual(Object.keys(l.viseboj[0]), ['mesto', 'oznaka', 'prijava_id', 'ime', 'prezime', 'klub', 'po_spravi', 'odustao', 'zbir', 'zbir_h']);
  assert.deepEqual(Object.keys(l.ekipno[0]), ['mesto', 'oznaka', 'klub', 'klub_ime', 'po_spravi', 'ukupno', 'ukupno_h', 'clanovi']);
  assert.deepEqual(Object.keys(l.ekipno[0].clanovi[0]), ['prijava_id', 'ime', 'prezime']);
});
