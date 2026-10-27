const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviRezultate } = require('../electron/modeli/rezultati.cjs');
const { napravi: napraviSifarnike } = require('../electron/modeli/sifarnici.cjs');
const { napravi: napraviOcene } = require('../electron/modeli/ocene.cjs');
const { napravi: napraviSinhro } = require('../electron/sinhro.cjs');
const { uvezi } = require('../alati/primer-podaci.cjs');
const json = require('../docs/proizvod/dizajn/primer-podaci.json');

const TOKEN = 'tajni-token-123';

// Lazni sajt: pamti zahteve, odgovor zadaje test.
async function sajt(odgovor) {
  const zahtevi = [];
  const server = http.createServer((req, res) => {
    const delovi = [];
    req.on('data', (d) => delovi.push(d));
    req.on('end', () => {
      zahtevi.push({ metoda: req.method, putanja: req.url, zaglavlja: req.headers, telo: Buffer.concat(delovi).toString('utf8') });
      const o = odgovor(req) ?? { status: 200, telo: '{"ok":true}' };
      if (o.nikad) return;
      res.writeHead(o.status, { 'Content-Type': 'application/json' });
      res.end(o.telo);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const ugasi = () => new Promise((r) => { server.closeAllConnections(); server.close(r); });
  return { zahtevi, url, ugasi };
}

function pravi(opcije = {}) {
  const baza = otvori(':memory:');
  baza.migriraj();
  uvezi(baza, json);
  const podesavanja = napraviPodesavanja(baza, '');
  const log = [];
  const dnevnik = { info: (t) => log.push(t), greska: (t) => log.push(`GRESKA ${t}`) };
  const sifarnici = napraviSifarnike(baza);
  const rezultati = napraviRezultate(baza, podesavanja);
  const sinhro = napraviSinhro({
    podesavanja, rezultati, takmicenja: null, sifarnici, baza, dnevnik, verzija: '9.9.9', fetch: globalThis.fetch, ...opcije.sinhro,
  });
  return { baza, podesavanja, log, sinhro, rezultati };
}

function podesi(p, url, token = TOKEN) {
  p.podesavanja.postavi('sajt_url', url);
  p.podesavanja.postavi('sajt_token', token);
}

test('ping: 200 vraca ok i ime sajta, zaglavlja su tacna', async () => {
  const s = await sajt(() => ({ status: 200, telo: '{"ok":true,"sajt":"Rezultati"}' }));
  try {
    const p = pravi();
    podesi(p, `${s.url}/`);
    assert.deepEqual(await p.sinhro.ping(), { ok: true, sajt: 'Rezultati' });
    const z = s.zahtevi[0];
    assert.equal(z.metoda, 'GET');
    assert.equal(z.putanja, '/api/gimnastika/ping');
    assert.equal(z.zaglavlja.authorization, `Bearer ${TOKEN}`);
    assert.equal(z.zaglavlja['x-gimnastika-verzija'], '9.9.9');
  } finally { await s.ugasi(); }
});

test('posalji: PUT 200 postavlja kljuc, dnevnik bez tokena, telo je snimak', async () => {
  const s = await sajt(() => null);
  try {
    const p = pravi();
    podesi(p, s.url);
    assert.equal(p.sinhro.stanje().poslednje, '');
    assert.equal(p.sinhro.imaPromena(), true);
    const r = await p.sinhro.posalji();
    assert.deepEqual(r, { ok: true, liste: 2, greska: '' });
    const z = s.zahtevi[0];
    const id = p.podesavanja.aktivnoTakmicenjeId();
    assert.equal(z.metoda, 'PUT');
    assert.equal(z.putanja, `/api/gimnastika/takmicenja/${id}`);
    assert.equal(z.zaglavlja['content-type'], 'application/json; charset=utf-8');
    assert.equal(z.zaglavlja.authorization, `Bearer ${TOKEN}`);
    const telo = JSON.parse(z.telo);
    assert.equal(telo.verzija_formata, 1);
    assert.equal(telo.liste.length, 2);
    assert.match(p.sinhro.stanje().poslednje, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(p.sinhro.stanje().greska, '');
    const linija = p.log.find((l) => l.startsWith('Sinhro: poslato takmicenje'));
    assert.match(linija, new RegExp(`^Sinhro: poslato takmicenje ${id} \\(2 lista, \\d+ B\\)$`));
    assert.equal(p.log.some((l) => l.includes(TOKEN)), false);
  } finally { await s.ugasi(); }
});

test('greske: 401, 403, 413, 500, nije JSON, nema ok', async () => {
  const slucajevi = [
    [{ status: 401, telo: '{}' }, 'Sajt nije prihvatio token.'],
    [{ status: 403, telo: '{}' }, 'Sajt nije prihvatio token.'],
    [{ status: 413, telo: '{}' }, 'Snimak je prevelik za sajt.'],
    [{ status: 500, telo: 'x' }, 'Sajt je javio grešku 500.'],
    [{ status: 200, telo: '<html>' }, 'Odgovor sajta nije ispravan.'],
    [{ status: 200, telo: '{"ok":false}' }, 'Odgovor sajta nije ispravan.'],
  ];
  for (const [odg, tekst] of slucajevi) {
    const s = await sajt(() => odg);
    try {
      const p = pravi();
      podesi(p, s.url);
      const r = await p.sinhro.posalji();
      assert.deepEqual(r, { ok: false, liste: 0, greska: tekst });
      assert.equal(p.sinhro.stanje().greska, tekst);
      assert.equal(p.sinhro.stanje().poslednje, '', 'kljuc se ne postavlja pri gresci');
      assert.ok(p.log.includes(`Sinhro greska: ${tekst}`));
      assert.equal(p.log.some((l) => l.includes(TOKEN)), false);
    } finally { await s.ugasi(); }
  }
});

test('server ugasen: Sajt nije dostupan', async () => {
  const s = await sajt(() => null);
  const url = s.url;
  await s.ugasi();
  const p = pravi();
  podesi(p, url);
  assert.equal((await p.sinhro.posalji()).greska, 'Sajt nije dostupan.');
  assert.deepEqual(await p.sinhro.ping(), { ok: false, greska: 'Sajt nije dostupan.' });
});

test('istek: server koji ne odgovara daje Sajt nije dostupan', async () => {
  const s = await sajt(() => ({ nikad: true }));
  try {
    const p = pravi({ sinhro: { istekMs: 100 } });
    podesi(p, s.url);
    const t0 = Date.now();
    assert.equal((await p.sinhro.posalji()).greska, 'Sajt nije dostupan.');
    assert.ok(Date.now() - t0 < 5000);
  } finally { await s.ugasi(); }
});

test('prazna adresa ili token: nema zahteva', async () => {
  const s = await sajt(() => null);
  try {
    const p = pravi();
    assert.equal(p.sinhro.stanje().ukljuceno, false);
    p.sinhro.zakazi();
    assert.equal(p.sinhro.stanje().cekaSlanje, false);
    assert.equal((await p.sinhro.posalji()).ok, false);
    assert.equal((await p.sinhro.ping()).ok, false);
    p.podesavanja.postavi('sajt_url', s.url);
    assert.equal(p.sinhro.stanje().ukljuceno, false, 'bez tokena');
    assert.equal((await p.sinhro.posalji()).greska, 'Unesite token sajta.');
    assert.equal((await p.sinhro.ping()).greska, 'Unesite token sajta.');
    assert.equal(s.zahtevi.length, 0);
  } finally { await s.ugasi(); }
});

test('bez aktivnog takmicenja: poruka i nema zahteva', async () => {
  const s = await sajt(() => null);
  try {
    const p = pravi();
    podesi(p, s.url);
    p.podesavanja.postavi('aktivno_takmicenje', '');
    const r = await p.sinhro.posalji();
    assert.deepEqual(r, { ok: false, liste: 0, greska: 'Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.' });
    assert.equal(p.sinhro.imaPromena(), false);
    assert.equal(s.zahtevi.length, 0);
  } finally { await s.ugasi(); }
});

test('zakazi: tri poziva u prozoru su jedan zahtev', async () => {
  const s = await sajt(() => null);
  try {
    const p = pravi({ sinhro: { odlaganjeMs: 50 } });
    podesi(p, s.url);
    p.sinhro.zakazi();
    p.sinhro.zakazi();
    p.sinhro.zakazi();
    assert.equal(p.sinhro.stanje().cekaSlanje, true);
    assert.equal(s.zahtevi.length, 0);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(s.zahtevi.length, 1);
    assert.equal(p.sinhro.stanje().cekaSlanje, false);
    assert.equal(p.sinhro.stanje().uToku, false);
  } finally { await s.ugasi(); }
});

test('zakazi: lazni tajmeri, odlaganje 3 s i unref', () => {
  const tajmeri = [];
  const postavi = (fn, ms) => { const t = { fn, ms, unref() { this.unrefovan = true; }, ukonjen: false }; tajmeri.push(t); return t; };
  const ukloni = (t) => { if (t) t.ukonjen = true; };
  const p = pravi({ sinhro: { setTimeout: postavi, clearTimeout: ukloni } });
  podesi(p, 'http://127.0.0.1:1');
  p.sinhro.zakazi();
  p.sinhro.zakazi();
  const zakazani = tajmeri.filter((t) => t.ms === 3000);
  assert.equal(zakazani.length, 2);
  assert.equal(zakazani[0].ukonjen, true);
  assert.equal(zakazani[1].ukonjen, false);
  assert.equal(zakazani[1].unrefovan, true);
});

test('istovremeni posalji: nikad dva zahteva u letu', async () => {
  let ulete = 0;
  let najvise = 0;
  const s = await sajt(() => null);
  const staro = globalThis.fetch;
  const fetchBrojac = async (...a) => {
    ulete++;
    najvise = Math.max(najvise, ulete);
    try { return await staro(...a); } finally { ulete--; }
  };
  try {
    const p = pravi({ sinhro: { fetch: fetchBrojac } });
    podesi(p, s.url);
    const prvi = p.sinhro.posalji();
    assert.equal(p.sinhro.stanje().uToku, true);
    const [a, b] = await Promise.all([prvi, p.sinhro.posalji()]);
    assert.equal(a.ok && b.ok, true);
    assert.equal(najvise, 1);
    assert.equal(s.zahtevi.length, 2);
  } finally { await s.ugasi(); }
});

test('imaPromena: false posle slanja, true posle izmene ocene', async () => {
  const s = await sajt(() => null);
  try {
    // Sat slanja je 2020; podaci su ucitani sa starijim vremenom, a prava izmena nosi danasnje vreme
    const p = pravi({ sinhro: { sad: () => '2020-06-01 00:00:00' } });
    for (const t of ['ocene', 'prijave', 'takmicenja', 'grupe']) p.baza.izvrsi(`UPDATE ${t} SET izmenjeno = '2020-01-01 00:00:00'`);
    podesi(p, s.url);
    assert.equal(p.sinhro.imaPromena(), true, 'nikad poslato');
    assert.equal((await p.sinhro.posalji()).ok, true);
    assert.equal(p.sinhro.stanje().poslednje, '2020-06-01 00:00:00');
    assert.equal(p.sinhro.imaPromena(), false);
    const takmId = p.podesavanja.aktivnoTakmicenjeId();
    const o = p.baza.jedan('SELECT prijava_id, sprava_id FROM ocene LIMIT 1');
    const ocene = napraviOcene(p.baza, p.podesavanja);
    ocene.sacuvaj(takmId, o.prijava_id, o.sprava_id, { d: '5,0', e: ['9,0', '9,0', '9,0', '9,0'], odbitak: '' }, true, 'ispravka u testu');
    assert.equal(p.sinhro.imaPromena(), true);
  } finally { await s.ugasi(); }
});

test('snimakAktivnog: snimak ili null', () => {
  const p = pravi();
  assert.equal(p.sinhro.snimakAktivnog().liste.length, 2);
  p.podesavanja.postavi('aktivno_takmicenje', '');
  assert.equal(p.sinhro.snimakAktivnog(), null);
});

test('PUT: zaglavlja, kosa crta na kraju adrese skinuta, token nije u putanji', async () => {
  const s = await sajt(() => null);
  try {
    const p = pravi();
    podesi(p, `${s.url}//`);
    assert.equal((await p.sinhro.posalji()).ok, true);
    await p.sinhro.ping();
    const id = p.podesavanja.aktivnoTakmicenjeId();
    const put = s.zahtevi[0];
    assert.equal(put.putanja, `/api/gimnastika/takmicenja/${id}`);
    assert.equal(put.zaglavlja.authorization, `Bearer ${TOKEN}`);
    assert.equal(put.zaglavlja['x-gimnastika-verzija'], '9.9.9');
    assert.equal(s.zahtevi.some((z) => z.putanja.includes(TOKEN)), false);
  } finally { await s.ugasi(); }
});

test('sad() se uzima pre gradnje snimka', async () => {
  const s = await sajt(() => null);
  try {
    let n = 0;
    const p = pravi({ sinhro: { sad: () => `2020-06-01 00:00:0${++n}` } });
    podesi(p, s.url);
    assert.equal((await p.sinhro.posalji()).ok, true);
    assert.equal(p.podesavanja.daj('sajt_poslednja_sinhronizacija'), '2020-06-01 00:00:01');
    assert.equal(JSON.parse(s.zahtevi[0].telo).poslato, '2020-06-01T00:00:01.000Z', 'jedan poziv sad() za kljuc i snimak');
    assert.equal(n, 1);
  } finally { await s.ugasi(); }
});

test('imaPromena: svaka od tabela prijave, takmicenja, grupe posebno', async () => {
  const s = await sajt(() => null);
  try {
    for (const t of ['prijave', 'takmicenja', 'grupe']) {
      const p = pravi({ sinhro: { sad: () => '2020-06-01 00:00:00' } });
      for (const x of ['ocene', 'prijave', 'takmicenja', 'grupe']) p.baza.izvrsi(`UPDATE ${x} SET izmenjeno = '2020-01-01 00:00:00'`);
      podesi(p, s.url);
      assert.equal((await p.sinhro.posalji()).ok, true);
      assert.equal(p.sinhro.imaPromena(), false, t);
      p.baza.izvrsi(`UPDATE ${t} SET izmenjeno = '2021-01-01 00:00:00'`);
      assert.equal(p.sinhro.imaPromena(), true, t);
    }
  } finally { await s.ugasi(); }
});

test('izuzetak pri gradnji snimka: tekst, dnevnik.greska, nema zahteva', async () => {
  const s = await sajt(() => null);
  try {
    const p = pravi();
    podesi(p, s.url);
    p.rezultati.kombinacije = () => { throw new Error('kvar'); };
    const r = await p.sinhro.posalji();
    assert.deepEqual(r, { ok: false, liste: 0, greska: 'Snimak nije mogao da se napravi.' });
    assert.ok(p.log.some((l) => l.startsWith('GRESKA Sinhro: snimak nije napravljen')));
    assert.equal(p.sinhro.stanje().greska, 'Snimak nije mogao da se napravi.');
    assert.equal(s.zahtevi.length, 0);
  } finally { await s.ugasi(); }
});

test('mrezna greska: dnevnik ima ime i kod, ne i adresu ni token', async () => {
  const s = await sajt(() => null);
  const url = s.url;
  await s.ugasi();
  const p = pravi();
  podesi(p, url);
  await p.sinhro.posalji();
  const linija = p.log.find((l) => l.startsWith('Sinhro greska: Sajt nije dostupan. ('));
  assert.ok(linija, p.log.join('|'));
  assert.equal(linija.includes(url), false);
  assert.equal(linija.includes('127.0.0.1'), false);
  assert.equal(linija.includes(TOKEN), false);
});

test('prazna adresa ili token cisti staru gresku i slanje na cekanju', async () => {
  const s = await sajt(() => ({ status: 500, telo: 'x' }));
  try {
    const p = pravi({ sinhro: { odlaganjeMs: 60000 } });
    podesi(p, s.url);
    await p.sinhro.posalji();
    p.sinhro.zakazi();
    assert.equal(p.sinhro.stanje().greska, 'Sajt je javio grešku 500.');
    assert.equal(p.sinhro.stanje().cekaSlanje, true);
    p.podesavanja.postavi('sajt_token', '');
    p.sinhro.zakazi();
    let st = p.sinhro.stanje();
    assert.equal(st.ukljuceno, false);
    assert.equal(st.greska, '');
    assert.equal(st.cekaSlanje, false);
    // isto preko posalji i ping
    podesi(p, s.url);
    await p.sinhro.posalji();
    p.podesavanja.postavi('sajt_url', '');
    await p.sinhro.ping();
    st = p.sinhro.stanje();
    assert.equal(st.greska, '');
    podesi(p, s.url);
    await p.sinhro.posalji();
    p.podesavanja.postavi('sajt_url', '');
    await p.sinhro.posalji();
    assert.deepEqual(p.sinhro.stanje(), { ukljuceno: false, poslednje: '', cekaSlanje: false, uToku: false, greska: '' });
  } finally { await s.ugasi(); }
});

test('tri posalji tokom slanja: tacno jedno naknadno slanje, bez neuhvacenih odbijanja', async () => {
  const neuhvaceno = [];
  const slusac = (e) => neuhvaceno.push(e);
  process.on('unhandledRejection', slusac);
  const s = await sajt(() => null);
  try {
    const p = pravi();
    podesi(p, s.url);
    const rez = await Promise.all([p.sinhro.posalji(), p.sinhro.posalji(), p.sinhro.posalji()]);
    assert.ok(rez.every((r) => r.ok));
    assert.equal(s.zahtevi.length, 2);
    assert.equal(p.sinhro.stanje().uToku, false);
    // odbijanje unutar slanja stize samo pozivaocu
    p.podesavanja.aktivno = () => { throw new Error('kvar baze'); };
    await assert.rejects(p.sinhro.posalji(), /kvar baze/);
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(neuhvaceno, []);
    assert.equal(p.sinhro.stanje().uToku, false);
  } finally {
    process.off('unhandledRejection', slusac);
    await s.ugasi();
  }
});
