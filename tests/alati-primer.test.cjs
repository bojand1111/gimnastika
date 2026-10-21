const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { uvezi } = require('../alati/primer-podaci.cjs');
const json = require('../docs/proizvod/dizajn/primer-podaci.json');

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  return baza;
}

const broj = (baza, tabela) => Number(baza.vrednost(`SELECT COUNT(*) FROM ${tabela}`));
const svi = [...json.zsg_kadet_c.takmicari, ...json.msg_kadet_c.takmicari];

test('uvoz primera: klubovi, takmicari, sprave, kategorija i program', () => {
  const baza = nova();
  const rez = uvezi(baza, json);
  assert.equal(broj(baza, 'klubovi'), json.klubovi.length);
  assert.equal(broj(baza, 'takmicari'), svi.length);
  assert.equal(Number(baza.vrednost('SELECT COUNT(*) FROM takmicari WHERE klub_id IS NULL')), 0);
  assert.equal(broj(baza, 'sprave'), 10);
  assert.equal(broj(baza, 'kategorije'), 1);
  assert.equal(broj(baza, 'programi'), 1);
  assert.equal(rez.klubovi_novih, json.klubovi.length);
  assert.equal(rez.takmicara_novih, svi.length);
  baza.zatvori();
});

test('uvoz primera: drugi put nista ne dodaje', () => {
  const baza = nova();
  uvezi(baza, json);
  const rez = uvezi(baza, json);
  assert.equal(broj(baza, 'klubovi'), json.klubovi.length);
  assert.equal(broj(baza, 'takmicari'), svi.length);
  assert.equal(broj(baza, 'sprave'), 10);
  assert.equal(broj(baza, 'kategorije'), 1);
  assert.equal(broj(baza, 'programi'), 1);
  assert.equal(rez.klubovi_novih, 0);
  assert.equal(rez.takmicara_novih, 0);
  baza.zatvori();
});

test('uvoz primera: postojeci klub i kategorija se prepoznaju bez obzira na velika slova', () => {
  const baza = nova();
  baza.ubaci('klubovi', { puno_ime: 'Moj klub', skracenica: 'voj', grad: 'X', kreirano: 'a', izmenjeno: 'a' });
  baza.ubaci('kategorije', { naziv: 'kadet', redosled: 1, kreirano: 'a', izmenjeno: 'a' });
  uvezi(baza, json);
  assert.equal(broj(baza, 'klubovi'), json.klubovi.length);
  assert.equal(broj(baza, 'kategorije'), 1);
  baza.zatvori();
});
