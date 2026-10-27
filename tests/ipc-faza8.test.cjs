// Faza 8: IPC modul sinhro, podesavanja sajta i slanje posle izmene ocene nad :memory: bazom i lazni HTTP sajt.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { uvezi } = require('../alati/primer-podaci.cjs');
const json = require('../docs/proizvod/dizajn/primer-podaci.json');

const TOKEN = 'ipc-token-456';
const ULAZ = { d: '4,8', e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '' };
const dnevnik = { info() {}, greska() {} };

async function sajt() {
  const zahtevi = [];
  const server = http.createServer((req, res) => {
    const delovi = [];
    req.on('data', (d) => delovi.push(d));
    req.on('end', () => {
      zahtevi.push({ metoda: req.method, putanja: req.url, zaglavlja: req.headers, telo: Buffer.concat(delovi).toString('utf8') });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true,"sajt":"Proba"}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    zahtevi,
    url: `http://127.0.0.1:${server.address().port}`,
    ugasi: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
  };
}

function pravi(opcije = {}) {
  const baza = otvori(':memory:');
  baza.migriraj();
  uvezi(baza, json);
  const pozivi = [];
  const fetchProba = (...a) => { pozivi.push(a[0]); return globalThis.fetch(...a); };
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  let klijent = null;
  const moduli = napraviModule(baza, {
    dialog, fasciklaPodataka: () => os.tmpdir(), dnevnik, fetch: fetchProba, sinhroOpcije: opcije.sinhroOpcije ?? {},
    sinhroSpreman: (s) => { klijent = s; },
  });
  return { baza, moduli, pozivi, klijent: () => klijent };
}
const podesi = (o, url) => o.moduli.podesavanja.sacuvajOpsta({ sajt_url: url, sajt_token: TOKEN });
// Prijava 1 i jedna sprava na kojoj ima unetu ocenu.
function ocena(o) {
  return o.baza.jedan("SELECT prijava_id, sprava_id FROM ocene WHERE prijava_id = 1 AND status = 'uneto' LIMIT 1");
}
const cekaj = async (uslov, ms = 3000) => {
  const kraj = Date.now() + ms;
  while (!uslov() && Date.now() < kraj) await new Promise((r) => setTimeout(r, 20));
  return uslov();
};
const brojPut = (s) => s.zahtevi.filter((z) => z.metoda === 'PUT').length;

test('api: sinhro modul je u MODULI i registruje se zajedno sa ostalima', () => {
  assert.deepEqual(MODULI.sinhro, ['stanje', 'posalji', 'ping']);
  const o = pravi();
  const kanali = [];
  // sistem i azuriranje dodaje main, pa se spisak sece na module koje pravi napraviModule
  const spisak = Object.fromEntries(Object.keys(o.moduli).map((m) => [m, MODULI[m]]));
  registruj({ handle: (k) => kanali.push(k) }, o.moduli, dnevnik, spisak);
  for (const r of MODULI.sinhro) assert.ok(kanali.includes(`gim:sinhro:${r}`));
  assert.deepEqual(Object.keys(o.moduli.sinhro), ['stanje', 'posalji', 'ping']);
});

test('sinhro.stanje: oblik i structuredClone; iskljuceno dok je adresa prazna', () => {
  const o = pravi();
  const s = o.moduli.sinhro.stanje();
  assert.deepEqual(s, { ukljuceno: false, poslednje: '', cekaSlanje: false, uToku: false, greska: '' });
  structuredClone(s);
  podesi(o, 'http://127.0.0.1:1');
  assert.equal(o.moduli.sinhro.stanje().ukljuceno, true);
});

test('podesavanja.sacuvajOpsta: lose sajt_url baca tekst, sva() vraca url i token', () => {
  const o = pravi();
  assert.throws(() => o.moduli.podesavanja.sacuvajOpsta({ sajt_url: 'sajt.rs' }),
    (e) => e instanceof GreskaKorisnika && e.message === 'Adresa sajta mora da počinje sa https:// (http:// samo za localhost).');
  o.moduli.podesavanja.sacuvajOpsta({ sajt_url: 'https://sajt.rs/', sajt_token: ' t ' });
  const sva = o.moduli.podesavanja.sva();
  assert.equal(sva.sajt_url, 'https://sajt.rs');
  assert.equal(sva.sajt_token, 't');
});

test('sinhro.ping i posalji: Bearer zaglavlje, 2 liste, stanje pokazuje poslato', async () => {
  const s = await sajt();
  try {
    const o = pravi();
    podesi(o, s.url);
    assert.deepEqual(await o.moduli.sinhro.ping(), { ok: true, sajt: 'Proba' });
    const r = await o.moduli.sinhro.posalji();
    assert.equal(r.ok, true);
    assert.equal(r.liste, 2);
    const put = s.zahtevi.find((z) => z.metoda === 'PUT');
    assert.equal(put.zaglavlja.authorization, `Bearer ${TOKEN}`);
    assert.equal(put.putanja, '/api/gimnastika/takmicenja/1');
    assert.equal(JSON.parse(put.telo).liste.length, 2);
    const st = o.moduli.sinhro.stanje();
    // cekaSlanje je zakazano slanje posle cuvanja adrese (nema veze sa rucnim slanjem)
    assert.match(st.poslednje, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    assert.equal(o.moduli.takmicenje.podaci().sinhro.poslednje, st.poslednje);
  } finally { await s.ugasi(); }
});

test('takmicenje.podaci: sinhro stanje je u odgovoru i moze da se klonira', () => {
  const o = pravi();
  const d = o.moduli.takmicenje.podaci();
  assert.equal(d.sinhro.ukljuceno, false);
  structuredClone(d);
});

test('unos.potvrdi, odustao i vrati zakazuju slanje; bez adrese ne ide nista', async () => {
  const s = await sajt();
  try {
    const o = pravi({ sinhroOpcije: { odlaganjeMs: 30 } });
    const { prijava_id: pid, sprava_id: sid } = ocena(o);
    o.moduli.unos.potvrdi(pid, sid, ULAZ, 'ispravka');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(s.zahtevi.length, 0, 'prazna adresa: nema zahteva');
    assert.equal(o.pozivi.length, 0);

    podesi(o, s.url);
    const prikaz = o.moduli.unos.potvrdi(pid, sid, ULAZ, 'ispravka 2');
    assert.ok(prikaz, 'rezultat unosa je nepromenjen');
    assert.ok(await cekaj(() => brojPut(s) === 1), 'potvrdi: PUT stigao');
    assert.equal(s.zahtevi[0].zaglavlja.authorization, `Bearer ${TOKEN}`);

    o.moduli.unos.odustao(pid, sid);
    assert.ok(await cekaj(() => brojPut(s) === 2), 'odustao: PUT stigao');
    assert.equal(JSON.parse(s.zahtevi[1].telo).liste.length, 2);

    o.moduli.unos.vrati(pid, sid);
    assert.ok(await cekaj(() => brojPut(s) === 3), 'vrati: PUT stigao');
  } finally { await s.ugasi(); }
});

test('unos.potvrdi: odbijena potvrda (nepotpun unos) ne zakazuje slanje', async () => {
  const s = await sajt();
  try {
    const o = pravi({ sinhroOpcije: { odlaganjeMs: 30 } });
    podesi(o, s.url);
    assert.ok(await cekaj(() => brojPut(s) === 1), 'cuvanje adrese salje neposlato');
    const pre = s.zahtevi.length;
    const { prijava_id: pid, sprava_id: sid } = ocena(o);
    assert.throws(() => o.moduli.unos.potvrdi(pid, sid, { d: '4,8', e: ['8,3'], odbitak: '' }, 'x'), GreskaKorisnika);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(s.zahtevi.length, pre);
  } finally { await s.ugasi(); }
});

test('sinhro.posalji: nedostupan sajt vraca poruku, stanje pamti gresku', async () => {
  const s = await sajt();
  const url = s.url;
  await s.ugasi();
  const o = pravi();
  podesi(o, url);
  const r = await o.moduli.sinhro.posalji();
  assert.equal(r.ok, false);
  assert.equal(r.greska, 'Sajt nije dostupan.');
  assert.equal(o.moduli.sinhro.stanje().greska, 'Sajt nije dostupan.');
  assert.equal(o.moduli.takmicenje.podaci().sinhro.greska, 'Sajt nije dostupan.');
});

test('sacuvajOpsta adrese i tokena salje ono sto jos nije poslato', async () => {
  const s = await sajt();
  try {
    const o = pravi({ sinhroOpcije: { odlaganjeMs: 30 } });
    const { prijava_id: pid, sprava_id: sid } = ocena(o);
    o.moduli.unos.potvrdi(pid, sid, ULAZ, 'ispravka');
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(s.zahtevi.length, 0);
    podesi(o, s.url);
    assert.ok(await cekaj(() => brojPut(s) === 1), 'posle cuvanja adrese stize PUT');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(brojPut(s), 1);
    // izmena drugih podesavanja ne salje nista
    o.moduli.podesavanja.sacuvajOpsta({ organizator: 'X' });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(brojPut(s), 1);
  } finally { await s.ugasi(); }
});

test('unos.potvrdi vraca normalan rezultat i kad zakazi() baci izuzetak', async () => {
  const s = await sajt();
  try {
    const o = pravi({ sinhroOpcije: { setTimeout: () => { throw new Error('tajmer'); } } });
    podesi(o, s.url);
    const { prijava_id: pid, sprava_id: sid } = ocena(o);
    const r = o.moduli.unos.potvrdi(pid, sid, ULAZ, 'ispravka');
    assert.ok(r && r.prikaz, 'rezultat unosa je ocuvan');
    assert.equal(s.zahtevi.length, 0);
  } finally { await s.ugasi(); }
});

test('sinhroSpreman daje klijenta sa imaPromena i zakazi za start programa', () => {
  const o = pravi();
  const k = o.klijent();
  assert.equal(typeof k.imaPromena, 'function');
  assert.equal(k.imaPromena(), true, 'uvezeni podaci nisu nikad poslati');
  assert.doesNotThrow(() => k.zakazi());
});
