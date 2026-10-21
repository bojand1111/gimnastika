import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mesta, viseboj, ekipno, ISTI_DELI, ISTI_VISA_E_PA_D } from '../electron/racun/plasman.mjs';
import { izBaze } from '../electron/racun/broj.mjs';
import { konacna } from '../electron/racun/ocena.mjs';

test('mesta: deljenje, VK i bez ocene', () => {
  const m = mesta([
    { kljuc: 'a', vrednost: 12000 },
    { kljuc: 'b', vrednost: 13000 },
    { kljuc: 'vk', vrednost: 12500, vk: true },
    { kljuc: 'c', vrednost: 12000 },
    { kljuc: 'd', vrednost: 11000 },
    { kljuc: 'x', vrednost: null },
  ]);
  assert.equal(m.b.mesto, 1);
  assert.equal(m.vk.oznaka, 'VK');
  assert.equal(m.a.mesto, 2);
  assert.equal(m.c.mesto, 2);
  assert.equal(m.d.mesto, 4, 'posle deljenog mesta se preskace');
  assert.equal(m.x.mesto, null);
  assert.equal(m.x.redosled, 6, 'bez ocene je na dnu');
  assert.equal(m.vk.redosled, 2, 'VK je na mestu koje mu po oceni pripada');

  const m2 = mesta([
    { kljuc: 'a', vrednost: 12000, tie: [8000, 4000] },
    { kljuc: 'b', vrednost: 12000, tie: [8100, 3900] },
  ], ISTI_VISA_E_PA_D);
  assert.equal(m2.b.mesto, 1, 'visa E pobedjuje');
  assert.equal(m2.a.mesto, 2);
  assert.equal(ISTI_DELI, 'deli');
});

const podaci = JSON.parse(fs.readFileSync(new URL('../docs/proizvod/dizajn/primer-podaci.json', import.meta.url), 'utf8'));

function proveriGrupu(grupa, sprave, ekipnoBroji) {
  const sids = Object.keys(sprave).map(Number);
  const poSpravi = {};
  const takmicari = {};
  const clanovi = [];
  grupa.takmicari.forEach((t, i) => {
    const ocene = {};
    for (const sid of sids) {
      const sk = sprave[sid];
      const o = t.ocene[sk];
      if (o !== undefined && o !== null) {
        const k = konacna(izBaze(o.d), izBaze(o.e), izBaze(o.odbitak));
        assert.equal(k, izBaze(o.konacna), `${t.prezime_ime} ${sk} konacna`);
        ocene[sid] = k;
        (poSpravi[sid] ??= []).push({ kljuc: i, vrednost: k, vk: t.van_konkurencije });
      } else if (t.odustao) {
        ocene[sid] = null;
      }
    }
    takmicari[i] = { ocene, vk: t.van_konkurencije };
    if (!t.van_konkurencije) clanovi.push({ prijava: i, klub: t.klub, ocene });
  });
  for (const sid of sids) {
    const m = mesta(poSpravi[sid]);
    grupa.takmicari.forEach((t, i) => {
      const sk = sprave[sid];
      const o = t.ocene[sk];
      if (o !== undefined && o !== null) {
        assert.equal(m[i].oznaka, String(o.ocekivano_mesto), `${t.prezime_ime} mesto na ${sk}`);
      }
    });
  }
  const v = viseboj(takmicari, sids);
  grupa.takmicari.forEach((t, i) => {
    assert.equal(v[i].zbir, t.viseboj === null ? null : izBaze(t.viseboj), `${t.prezime_ime} viseboj zbir`);
    assert.equal(v[i].oznaka, String(t.ocekivano_mesto_viseboj ?? ''), `${t.prezime_ime} viseboj mesto`);
  });
  const redom = ekipno(clanovi, sids, ekipnoBroji);
  assert.equal(redom.length, grupa.ekipno.length, 'broj ekipa');
  grupa.ekipno.forEach((ek, j) => {
    assert.equal(redom[j].klub, ek.klub, 'ekipa redosled');
    assert.equal(redom[j].mesto, ek.ocekivano_mesto, `ekipa ${ek.klub} mesto`);
    assert.equal(redom[j].ukupno, izBaze(ek.ukupno), `ekipa ${ek.klub} ukupno`);
    for (const sid of sids) {
      assert.equal(redom[j].po_spravi[sid], izBaze(ek.po_spravi[sprave[sid]]), `ekipa ${ek.klub} ${sprave[sid]}`);
    }
  });
}

test('primer podaci: ZSG kadet C', () => {
  proveriGrupu(podaci.zsg_kadet_c, { 1: 'PR', 2: 'DR', 3: 'GR', 4: 'PA' }, podaci.takmicenje.ekipno_broji);
});

test('primer podaci: MSG kadet C', () => {
  proveriGrupu(podaci.msg_kadet_c, { 1: 'PA', 2: 'KH', 3: 'KA', 4: 'PR', 5: 'RA', 6: 'VR' }, podaci.takmicenje.ekipno_broji);
});
