import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rasporedi, sazetak } from '../electron/racun/raspored.mjs';

// Prijava za test: kategorija_id = katRed, naziv 'K' + katRed.
function p(id, katRed, klub) {
  return {
    prijava_id: id,
    kategorija_id: katRed,
    kat_redosled: katRed,
    kategorija: katRed == null ? null : 'K' + katRed,
    program_id: null,
    prog_redosled: null,
    klub_id: klub,
    klub_skr: klub,
    prezime: 'P' + String(id).padStart(3, '0'),
    ime: 'I',
  };
}

// Pravi prijave po kategorijama; klubovi po 3 u nizu unutar kategorije.
function poKategorijama(velicine) {
  const out = [];
  let id = 1;
  velicine.forEach(([kat, n]) => {
    for (let i = 0; i < n; i++) out.push(p(id++, kat, 'Klub' + kat + '-' + Math.floor(i / 3)));
  });
  return out;
}

// Pravi prijave jedne kategorije sa klubovima zadatih veličina.
function poKlubovima(velicine, kat = 1) {
  const out = [];
  let id = 1;
  velicine.forEach((n, k) => {
    for (let i = 0; i < n; i++) out.push(p(id++, kat, 'Klub' + String(k).padStart(2, '0')));
  });
  return out;
}

const OPC = { brojSprava: 6, maksimum: 6, poKategoriji: true, poKlubu: true };
const ULAZ48 = () => poKategorijama([[1, 12], [2, 14], [3, 10], [4, 12]]);

const sviClanovi = (r) => r.turnusi.flatMap((t) => t.grupe.flatMap((g) => g.clanovi));
const velicine = (t) => t.grupe.map((g) => g.clanovi.length);
const zbir = (niz) => niz.reduce((a, b) => a + b, 0);

function katTurnusa(r, prijave) {
  const poId = new Map(prijave.map((x) => [x.prijava_id, x]));
  return r.turnusi.map((t) => [...new Set(t.grupe.flatMap((g) => g.clanovi.map((id) => poId.get(id).kategorija_id)))]);
}

test('48 takmicara, 6 sprava, max 6: dva turnusa po granici kategorija', () => {
  const ulaz = ULAZ48();
  const r = rasporedi(ulaz, OPC);
  assert.equal(r.turnusi.length, 2);
  assert.deepEqual(katTurnusa(r, ulaz), [[1, 2], [3, 4]]);
  assert.equal(zbir(velicine(r.turnusi[0])), 26);
  assert.equal(zbir(velicine(r.turnusi[1])), 22);
  r.turnusi.forEach((t, i) => {
    assert.equal(t.turnus, i + 1);
    assert.equal(t.grupe.length, 6);
    assert.deepEqual(t.grupe.map((g) => g.pocetna_pozicija), [1, 2, 3, 4, 5, 6]);
  });
});

test('nijedna grupa preko maksimuma', () => {
  const ulaz = ULAZ48();
  const r = rasporedi(ulaz, { ...OPC, maksimum: 5 });
  r.turnusi.forEach((t) => t.grupe.forEach((g) => assert.ok(g.clanovi.length <= 5)));
  const svi = sviClanovi(r);
  assert.equal(svi.length, 48);
  assert.equal(new Set(svi).size, 48);
});

test('klub ostaje ceo kad staje', () => {
  const ulaz = poKlubovima([5, 5, 4, 4, 4, 4]);
  const r = rasporedi(ulaz, OPC);
  assert.equal(r.turnusi.length, 1);
  const klub = new Map(ulaz.map((x) => [x.prijava_id, x.klub_id]));
  const t = r.turnusi[0];
  assert.equal(t.grupe.length, 6);
  t.grupe.forEach((g) => assert.equal(new Set(g.clanovi.map((id) => klub.get(id))).size, 1));
});

test('klub se ne deli radi ujednacenosti', () => {
  const ulaz = poKlubovima([1, 6, 6, 6, 6, 5]);
  const r = rasporedi(ulaz, OPC);
  const klub = new Map(ulaz.map((x) => [x.prijava_id, x.klub_id]));
  const t = r.turnusi[0];
  assert.deepEqual(velicine(t), [1, 6, 6, 6, 6, 5]);
  t.grupe.forEach((g) => assert.equal(new Set(g.clanovi.map((id) => klub.get(id))).size, 1));
});

test('klub veci od maksimuma se deli u susedne grupe', () => {
  const ulaz = poKlubovima([7]);
  const r = rasporedi(ulaz, OPC);
  const t = r.turnusi[0];
  assert.equal(t.grupe.length, 6);
  assert.equal(zbir(velicine(t)), 7);
  t.grupe.forEach((g) => assert.ok(g.clanovi.length <= 6 && g.clanovi.length >= 1));
});

test('kategorija veca od turnusa: prvi turnus pun', () => {
  const ulaz = poKategorijama([[1, 40]]);
  const r = rasporedi(ulaz, OPC);
  assert.equal(r.turnusi.length, 2);
  assert.equal(zbir(velicine(r.turnusi[0])), 36);
  assert.equal(zbir(velicine(r.turnusi[1])), 4);
  assert.equal(r.turnusi[1].grupe.length, 4);
});

test('ZSG: 4 sprave, max 4', () => {
  const ulaz = poKategorijama([[1, 9], [2, 11]]);
  const r = rasporedi(ulaz, { ...OPC, brojSprava: 4, maksimum: 4 });
  assert.equal(r.turnusi.length, 2);
  assert.deepEqual(r.turnusi.map((t) => zbir(velicine(t))), [9, 11]);
  r.turnusi.forEach((t) => {
    assert.equal(t.grupe.length, 4);
    t.grupe.forEach((g) => assert.ok(g.clanovi.length <= 4));
  });
});

test('prazan ulaz', () => {
  assert.deepEqual(rasporedi([], OPC), { turnusi: [] });
  assert.deepEqual(rasporedi([], { ...OPC, turnusPoKategoriji: true }), { turnusi: [] });
});

test('bez kategorije i bez kluba ide na kraj', () => {
  const ulaz = poKategorijama([[1, 5], [2, 5]]);
  const bez = { ...p(99, null, null), prezime: 'Aaa' };
  ulaz.unshift(bez);
  const r = rasporedi(ulaz, OPC);
  const posl = r.turnusi.at(-1).grupe.at(-1).clanovi;
  assert.equal(posl.at(-1), 99);
});

test('bez poKategoriji: ujednaceni turnusi', () => {
  const r = rasporedi(ULAZ48(), { ...OPC, poKategoriji: false });
  assert.deepEqual(r.turnusi.map((t) => zbir(velicine(t))), [24, 24]);
});

test('kategorije susedne u turnusu', () => {
  const ulaz = ULAZ48();
  const kat = new Map(ulaz.map((x) => [x.prijava_id, x.kat_redosled]));
  const r = rasporedi(ulaz, OPC);
  r.turnusi.forEach((t) => {
    const niz = t.grupe.flatMap((g) => g.clanovi.map((id) => kat.get(id)));
    for (let i = 1; i < niz.length; i++) assert.ok(niz[i] >= niz[i - 1]);
  });
});

test('sazetak', () => {
  const ulaz = ULAZ48();
  const s = sazetak(rasporedi(ulaz, OPC), ulaz);
  assert.equal(s.ukupno, 48);
  assert.equal(s.turnusi.length, 2);
  assert.equal(s.turnusi[0].turnus, 1);
  assert.equal(s.turnusi[0].broj, 26);
  assert.deepEqual(s.turnusi[0].kategorije, ['K1', 'K2']);
  assert.deepEqual(s.turnusi[1].kategorije, ['K3', 'K4']);
  s.turnusi.forEach((t) => assert.equal(zbir(t.velicine), t.broj));
});

test('sazetak: bez kategorije', () => {
  const ulaz = [p(1, null, 'A')];
  const s = sazetak(rasporedi(ulaz, OPC), ulaz);
  assert.deepEqual(s.turnusi[0].kategorije, ['bez kategorije']);
});

test('ulaz se ne menja', () => {
  const ulaz = ULAZ48();
  const pre = structuredClone(ulaz);
  rasporedi(ulaz, OPC);
  rasporedi(ulaz, { ...OPC, turnusPoKategoriji: true });
  assert.deepEqual(ulaz, pre);
});

test('turnus po kategoriji: svaka kategorija svoj turnus', () => {
  const ulaz = poKategorijama([[1, 19], [2, 22], [3, 20], [4, 13], [5, 17]]);
  const r = rasporedi(ulaz, { ...OPC, turnusPoKategoriji: true });
  assert.equal(r.turnusi.length, 5);
  assert.deepEqual(katTurnusa(r, ulaz), [[1], [2], [3], [4], [5]]);
  r.turnusi.forEach((t, i) => {
    assert.equal(t.turnus, i + 1);
    assert.equal(t.grupe.length, 6);
  });
});

test('turnus po kategoriji: kategorija veca od turnusa deli se ujednaceno', () => {
  const r = rasporedi(poKategorijama([[1, 40]]), { ...OPC, turnusPoKategoriji: true });
  assert.deepEqual(r.turnusi.map((t) => zbir(velicine(t))), [20, 20]);
});

test('turnus po kategoriji: bez kategorije je poslednji turnus', () => {
  const ulaz = [...poKategorijama([[1, 8]]), p(99, null, 'X')];
  const r = rasporedi(ulaz, { ...OPC, turnusPoKategoriji: true });
  assert.equal(r.turnusi.length, 2);
  assert.deepEqual(r.turnusi[1].grupe.flatMap((g) => g.clanovi), [99]);
});

test('turnus po kategoriji bez poKategoriji: ne gleda kategorije', () => {
  const r = rasporedi(ULAZ48(), { ...OPC, poKategoriji: false, turnusPoKategoriji: true });
  assert.deepEqual(r.turnusi.map((t) => zbir(velicine(t))), [24, 24]);
});

// Klubovi po grupama: za svaku grupu skup klubova; vraca broj klubova podeljenih u vise grupa.
function podeljeniKlubovi(r, ulaz) {
  const klub = new Map(ulaz.map((x) => [x.prijava_id, x.klub_id]));
  const grupaKluba = new Map();
  r.turnusi.forEach((t, ti) => t.grupe.forEach((g, gi) => g.clanovi.forEach((id) => {
    const k = klub.get(id);
    if (!grupaKluba.has(k)) grupaKluba.set(k, new Set());
    grupaKluba.get(k).add(ti + ':' + gi);
  })));
  return [...grupaKluba.values()].filter((s) => s.size > 1).length;
}

test('klub se ne deli kad postoji raspored sa svim klubovima celim', () => {
  for (const velicine of [[2, 3, 5, 4, 3, 5], [1, 4, 1, 1, 2, 4], [1, 1, 1, 1, 1, 1, 1, 5, 5, 5]]) {
    const ulaz = poKlubovima(velicine);
    const r = rasporedi(ulaz, OPC);
    assert.equal(podeljeniKlubovi(r, ulaz), 0, velicine.join(','));
    r.turnusi[0].grupe.forEach((g) => assert.ok(g.clanovi.length <= 6));
  }
});

test('kad deljenje mora: sto manje podela, pa ujednacene grupe', () => {
  const ulaz = poKlubovima([3, 3, 3, 3]);
  const r = rasporedi(ulaz, OPC);
  assert.equal(podeljeniKlubovi(r, ulaz), 2);
  assert.deepEqual(velicine(r.turnusi[0]).sort((a, b) => a - b), [1, 1, 2, 2, 3, 3]);
});

test('prijave bez kluba nisu jedan klub', () => {
  // klub A od 4 i cetiri prijave bez kluba, 3 sprave, max 4: A ostaje ceo, dele se prijave bez kluba
  const ulaz = [...poKlubovima([4]), ...[11, 12, 13, 14].map((id) => p(id, 1, null))];
  const r = rasporedi(ulaz, { ...OPC, brojSprava: 3, maksimum: 4 });
  const grupeA = r.turnusi[0].grupe.filter((g) => g.clanovi.some((id) => id <= 4));
  assert.equal(grupeA.length, 1);
});

test('dva kluba iste skracenice se ne mesaju', () => {
  const ulaz = ['A', 'C', 'E'].map((pr, i) => ({ ...p(i + 1, 1, 1), klub_skr: 'X', prezime: pr }))
    .concat(['B', 'D', 'F'].map((pr, i) => ({ ...p(i + 4, 1, 2), klub_skr: 'X', prezime: pr })));
  const r = rasporedi(ulaz, { ...OPC, brojSprava: 2, maksimum: 3 });
  const klub = new Map(ulaz.map((x) => [x.prijava_id, x.klub_id]));
  r.turnusi[0].grupe.forEach((g) => assert.equal(new Set(g.clanovi.map((id) => klub.get(id))).size, 1));
});
