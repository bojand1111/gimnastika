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
const NA_UVOZ = 2; // Neorčić Noah i Herceg Aron: takmičari bez prijave
const svi = [...json.zsg_kadet_c.takmicari, ...json.msg_kadet_c.takmicari];

test('uvoz primera: klubovi, takmicari, sprave, kategorija i program', () => {
  const baza = nova();
  const rez = uvezi(baza, json);
  assert.equal(broj(baza, 'klubovi'), json.klubovi.length);
  assert.equal(broj(baza, 'takmicari'), svi.length + NA_UVOZ);
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
  assert.equal(broj(baza, 'takmicari'), svi.length + NA_UVOZ);
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

test('uvoz primera: ID broj je 100 + startni broj na 5 cifara', () => {
  const baza = nova();
  uvezi(baza, json);
  const t = baza.jedan("SELECT prezime, ime FROM takmicari WHERE id_broj = '00121'");
  assert.equal(`${t.prezime} ${t.ime}`, 'Petrović Ana');
  baza.zatvori();
});

const clanovi = new Set([...json.zsg_kadet_c.ekipno, ...json.msg_kadet_c.ekipno].flatMap((e) => e.clanovi));

function prijaveSa(baza) {
  return baza.svi(`SELECT p.*, t.prezime, t.ime, t.pol FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id`);
}

test('uvoz primera: takmicenje i prijave svih takmicara iz JSON-a', () => {
  const baza = nova();
  const rez = uvezi(baza, json);
  assert.equal(broj(baza, 'takmicenja'), 1);
  assert.equal(baza.vrednost('SELECT naziv FROM takmicenja'), json.takmicenje.naziv);
  const prijave = prijaveSa(baza);
  assert.equal(prijave.length, svi.length);
  assert.equal(rez.prijava, svi.length);
  assert.equal(rez.prijava_novih, svi.length);
  assert.equal(rez.takmicenje_novo, true);
  const brojSprava = { Z: Number(baza.vrednost("SELECT COUNT(*) FROM sprave WHERE pol = 'Z'")), M: Number(baza.vrednost("SELECT COUNT(*) FROM sprave WHERE pol = 'M'")) };
  assert.deepEqual(brojSprava, { Z: 4, M: 6 });
  for (const p of prijave) {
    assert.equal(Number(baza.vrednost('SELECT COUNT(*) FROM prijava_sprave WHERE prijava_id = ?', [p.id])), brojSprava[p.pol]);
  }
  baza.zatvori();
});

test('uvoz primera: startni brojevi, ekipa i van konkurencije iz JSON-a', () => {
  const baza = nova();
  uvezi(baza, json);
  const poImenu = Object.fromEntries(prijaveSa(baza).map((p) => [`${p.prezime} ${p.ime}`, p]));
  for (const t of svi) {
    const p = poImenu[t.prezime_ime];
    assert.equal(p.startni_broj, t.startni_broj, t.prezime_ime);
    assert.equal(p.van_konkurencije, t.van_konkurencije ? 1 : 0, t.prezime_ime);
    assert.equal(p.clan_ekipe, clanovi.has(t.prezime_ime) ? 1 : 0, t.prezime_ime);
  }
  assert.ok(prijaveSa(baza).some((p) => p.clan_ekipe === 1));
  assert.ok(prijaveSa(baza).some((p) => p.van_konkurencije === 1));
  baza.zatvori();
});

test('uvoz primera: dva takmicara bez prijave za probu uvoza', () => {
  const baza = nova();
  uvezi(baza, json);
  const noa = baza.jedan("SELECT * FROM takmicari WHERE prezime = 'Neorčić' AND ime = 'Noah'");
  const aron = baza.jedan("SELECT * FROM takmicari WHERE prezime = 'Herceg' AND ime = 'Aron'");
  assert.equal(noa.godina_rodjenja, 2017);
  assert.equal(aron.godina_rodjenja, 2013);
  assert.equal(noa.pol, 'M');
  assert.equal(aron.pol, 'M');
  assert.notEqual(noa.klub_id, null);
  assert.equal(noa.id_broj, '00151');
  assert.equal(aron.id_broj, '00152');
  assert.equal(Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicar_id IN (?, ?)', [noa.id, aron.id])), 0);
  baza.zatvori();
});

test('uvoz primera: drugi put ne duplira takmicenje i prijave i cuva startne brojeve', () => {
  const baza = nova();
  uvezi(baza, json);
  const pre = prijaveSa(baza).map((p) => [p.id, p.startni_broj]);
  const rez = uvezi(baza, json);
  assert.equal(broj(baza, 'takmicenja'), 1);
  assert.equal(broj(baza, 'prijave'), svi.length);
  assert.equal(broj(baza, 'takmicari'), svi.length + NA_UVOZ);
  assert.equal(rez.prijava_novih, 0);
  assert.equal(rez.takmicenje_novo, false);
  assert.deepEqual(prijaveSa(baza).map((p) => [p.id, p.startni_broj]), pre);
  baza.zatvori();
});

test('uvoz primera: aktivno takmicenje se postavlja samo ako nije izabrano', () => {
  const baza = nova();
  uvezi(baza, json);
  const id = Number(baza.vrednost('SELECT id FROM takmicenja'));
  assert.equal(baza.vrednost("SELECT vrednost FROM podesavanja WHERE kljuc = 'aktivno_takmicenje'"), String(id));
  baza.izvrsi("UPDATE podesavanja SET vrednost = '999' WHERE kljuc = 'aktivno_takmicenje'");
  uvezi(baza, json);
  assert.equal(baza.vrednost("SELECT vrednost FROM podesavanja WHERE kljuc = 'aktivno_takmicenje'"), '999');
  baza.zatvori();
});

test('uvoz primera: lekarski_sprecava_prijavu = da preskace prijave bez vazeceg lekarskog, bez greske', () => {
  const baza = nova();
  baza.ubaci('podesavanja', { kljuc: 'lekarski_sprecava_prijavu', vrednost: 'da' });
  let rez;
  assert.doesNotThrow(() => { rez = uvezi(baza, json); });
  assert.equal(rez.preskoceno.length, 2); // Simić Dunja i Stanković Luka: lekarski istekao pre takmicenja
  assert.ok(rez.preskoceno.every((p) => p.includes('lekarski ne važi na dan takmičenja')));
  assert.equal(rez.prijava, svi.length);
  assert.equal(rez.prijava_novih, svi.length - rez.preskoceno.length);
  assert.equal(broj(baza, 'prijave'), svi.length - 2);
  assert.equal(broj(baza, 'takmicari'), svi.length + NA_UVOZ);
  baza.zatvori();
});
