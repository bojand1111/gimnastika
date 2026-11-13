const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otvori } = require('../electron/baza/baza.cjs');
const modelObjava = require('../electron/modeli/objava.cjs');
const { napravi } = require('../electron/objava.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');

const S = '2026-01-01 00:00:00';
const ADRESA = 'https://objave.example.test';

function okruzenje(opcije = {}) {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-objava-'));
  const model = modelObjava.napravi(baza);
  const pozivi = [];
  const dnevnik = { info() {}, greska() {} };
  const fetch = opcije.fetch ?? (async (url, init) => {
    pozivi.push({ url, init });
    return { status: 200, text: async () => '{"ok":true}' };
  });
  const wrap = async (url, init) => { if (!opcije.fetch) return fetch(url, init); pozivi.push({ url, init }); return fetch(url, init); };
  const k = napravi({
    baza, model, adresa: opcije.adresa ?? ADRESA, fasciklaPodataka: () => dir, dnevnik, verzija: '1.2.9',
    fetch: wrap, sad: () => '2026-11-13 10:00:00', ...(opcije.dodatno ?? {}),
  });
  return { baza, dir, k, pozivi };
}

function takmicenje(baza, naziv = 'Prvo') {
  const tid = baza.ubaci('takmicenja', { naziv, datum: '15.03.2027.', pol: 'Z', kreirano: S, izmenjeno: S });
  const klub = baza.ubaci('klubovi', { puno_ime: 'Klub ' + naziv, skracenica: 'K' + naziv, kreirano: S, izmenjeno: S });
  const t = baza.ubaci('takmicari', { id_broj: 'T' + naziv, ime: 'Ana', prezime: 'Bol', godina_rodjenja: 2012, pol: 'Z', klub_id: klub, kreirano: S, izmenjeno: S });
  baza.ubaci('prijave', { takmicenje_id: tid, takmicar_id: t, klub_id: klub, kreirano: S, izmenjeno: S });
  return tid;
}

const fajl = (dir, uid) => path.join(dir, 'objave', uid + '.json');
const uidOd = (baza, tid) => baza.vrednost('SELECT uid FROM takmicenja WHERE id = ?', [tid]);

test('fajl postoji pre slanja', async () => {
  let postojao = null;
  const e = okruzenje({
    fetch: async () => {
      const uid = uidOd(e.baza, 1);
      postojao = fs.existsSync(fajl(e.dir, uid));
      return { status: 200, text: async () => '{"ok":true}' };
    },
  });
  takmicenje(e.baza);
  await e.k.objavi(1);
  assert.equal(postojao, true);
});

test('uspeh: poslato', async () => {
  const e = okruzenje();
  const tid = takmicenje(e.baza);
  const s = await e.k.objavi(tid);
  assert.equal(s.stanje, 'poslato');
  assert.equal(s.poslato, '2026-11-13 10:00:00');
  assert.equal(s.moze, true);
  assert.equal(e.pozivi.length, 1);
  assert.equal(e.pozivi[0].url, ADRESA + '/objave');
  assert.equal(e.pozivi[0].init.method, 'POST');
  const telo = JSON.parse(e.pozivi[0].init.body);
  assert.equal(telo.uid, uidOd(e.baza, tid));
  assert.equal(e.pozivi[0].init.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(e.pozivi[0].init.headers['X-Gimnastika-Verzija'], '1.2.9');
  assert.equal(fs.readFileSync(fajl(e.dir, telo.uid), 'utf8'), e.pozivi[0].init.body);
});

test('bez mreze: ceka i poruka', async () => {
  const e = okruzenje({ fetch: async () => { throw new TypeError('fetch failed'); } });
  const tid = takmicenje(e.baza);
  const s = await e.k.objavi(tid);
  assert.equal(s.stanje, 'ceka');
  assert.equal(s.poruka, 'Biće poslato kad bude interneta.');
  assert.equal(s.poslato, null);
  assert.ok(fs.existsSync(fajl(e.dir, uidOd(e.baza, tid))));
});

test('greska servera: ceka i poruka sa kodom', async () => {
  const e = okruzenje({ fetch: async () => ({ status: 413, text: async () => '' }) });
  const tid = takmicenje(e.baza);
  const s = await e.k.objavi(tid);
  assert.equal(s.stanje, 'ceka');
  assert.equal(s.poruka, 'Server je javio grešku 413.');
});

test('ponovna objava koristi isti uid', async () => {
  const e = okruzenje();
  const tid = takmicenje(e.baza);
  await e.k.objavi(tid);
  const uid1 = uidOd(e.baza, tid);
  await e.k.objavi(tid);
  assert.equal(uidOd(e.baza, tid), uid1);
  assert.equal(JSON.parse(e.pozivi[1].init.body).uid, uid1);
  assert.equal(fs.readdirSync(path.join(e.dir, 'objave')).length, 1);
  assert.equal(e.baza.vrednost('SELECT COUNT(*) FROM objave'), 1);
});

test('uvezeno takmicenje: moze false, a postoji ne blokira', async () => {
  const e = okruzenje();
  const a = takmicenje(e.baza, 'A');
  const b = takmicenje(e.baza, 'B');
  e.baza.ubaci('uvezene_objave', { uid: 'u1', takmicenje_id: a, stanje: 'uvezeno', vreme: S });
  e.baza.ubaci('uvezene_objave', { uid: 'u2', takmicenje_id: b, stanje: 'postoji', vreme: S });
  const sa = e.k.stanje(a);
  assert.equal(sa.moze, false);
  assert.equal(sa.razlog, 'Takmičenje je dodato iz ažuriranja i ne objavljuje se ponovo.');
  await assert.rejects(() => e.k.objavi(a), GreskaKorisnika);
  assert.equal(e.pozivi.length, 0);
  assert.equal(e.k.stanje(b).moze, true);
});

test('prazna adresa: moze false, fetch se ne zove', async () => {
  const e = okruzenje({ adresa: '' });
  const tid = takmicenje(e.baza);
  const s = e.k.stanje(tid);
  assert.equal(s.moze, false);
  assert.equal(s.razlog, 'Adresa za objavu nije podešena.');
  assert.equal(s.stanje, 'nije');
  await assert.rejects(() => e.k.objavi(tid), GreskaKorisnika);
  assert.equal(e.pozivi.length, 0);
});

test('dupli klik: jedan fetch', async () => {
  let pusti;
  const kapija = new Promise((r) => { pusti = r; });
  const e = okruzenje({ fetch: async () => { await kapija; return { status: 200, text: async () => '{"ok":true}' }; } });
  const tid = takmicenje(e.baza);
  const p1 = e.k.objavi(tid);
  const p2 = e.k.objavi(tid);
  pusti();
  const [s1, s2] = await Promise.all([p1, p2]);
  assert.equal(e.pozivi.length, 1);
  assert.deepEqual(s1, s2);
  assert.equal(s1.stanje, 'poslato');
});

test('posaljiNaCekanju salje ceka redove', async () => {
  let radi = false;
  const e = okruzenje({
    fetch: async () => {
      if (!radi) throw new TypeError('fetch failed');
      return { status: 200, text: async () => '{"ok":true}' };
    },
  });
  const a = takmicenje(e.baza, 'A');
  const b = takmicenje(e.baza, 'B');
  await e.k.objavi(a);
  await e.k.objavi(b);
  assert.equal(e.k.stanje(a).stanje, 'ceka');
  const uidA = uidOd(e.baza, a);
  const sadrzaj = fs.readFileSync(fajl(e.dir, uidA), 'utf8');
  radi = true;
  const pre = e.pozivi.length;
  await e.k.posaljiNaCekanju();
  assert.equal(e.pozivi.length - pre, 2);
  assert.equal(e.k.stanje(a).stanje, 'poslato');
  assert.equal(e.k.stanje(b).stanje, 'poslato');
  assert.equal(e.pozivi[pre].init.body, sadrzaj); // postojeci fajl, ne nova objava
});

test('posaljiNaCekanju: greska ne baca', async () => {
  const e = okruzenje({ fetch: async () => { throw new TypeError('fetch failed'); } });
  const tid = takmicenje(e.baza);
  await e.k.objavi(tid);
  await e.k.posaljiNaCekanju();
  assert.equal(e.k.stanje(tid).stanje, 'ceka');
});

test('zaglavlje nema Authorization', async () => {
  const e = okruzenje();
  await e.k.objavi(takmicenje(e.baza));
  const h = Object.keys(e.pozivi[0].init.headers).map((x) => x.toLowerCase());
  assert.ok(!h.includes('authorization'));
});

test('preveliko takmicenje: GreskaKorisnika', async () => {
  const e = okruzenje();
  const tid = takmicenje(e.baza);
  e.baza.izvrsi('UPDATE takmicenja SET zaglavlje_biltena = ? WHERE id = ?', ['x'.repeat(2200000), tid]);
  await assert.rejects(() => e.k.objavi(tid), (err) => err instanceof GreskaKorisnika && err.message === 'Takmičenje je preveliko za objavu.');
  assert.equal(e.pozivi.length, 0);
});

test('istek: ceka, signal se prekida', async () => {
  let signal = null;
  const e = okruzenje({
    fetch: (url, init) => new Promise((_, odbij) => {
      signal = init.signal;
      init.signal.addEventListener('abort', () => odbij(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
    // obavijen tajmer bez unref, da proces ceka na istek
    dodatno: { istekMs: 10, setTimeout: (f, ms) => ({ t: setTimeout(f, ms) }), clearTimeout: (h) => clearTimeout(h.t) },
  });
  const s = await e.k.objavi(takmicenje(e.baza));
  assert.equal(signal.aborted, true);
  assert.equal(s.stanje, 'ceka');
  assert.equal(s.poruka, 'Biće poslato kad bude interneta.');
});

test('objavi tokom ponovnog pokusaja: stanje i svez izvoz', async () => {
  let radi = false;
  let pusti;
  const kapija = new Promise((r) => { pusti = r; });
  let blokiraj = false;
  const e = okruzenje({
    fetch: async () => {
      if (!radi) throw new TypeError('fetch failed');
      if (blokiraj) { blokiraj = false; await kapija; }
      return { status: 200, text: async () => '{"ok":true}' };
    },
  });
  const tid = takmicenje(e.baza, 'Staro');
  await e.k.objavi(tid);
  assert.equal(e.k.stanje(tid).stanje, 'ceka');
  radi = true;
  blokiraj = true;
  const pre = e.pozivi.length;
  const retry = e.k.posaljiNaCekanju();
  await new Promise((r) => setImmediate(r));
  assert.equal(e.pozivi.length - pre, 1); // ponovni pokusaj je u toku
  e.baza.izvrsi('UPDATE takmicenja SET naziv = ? WHERE id = ?', ['Novo', tid]);
  const p = e.k.objavi(tid);
  pusti();
  const s = await p;
  await retry;
  assert.equal(typeof s, 'object');
  assert.equal(s.stanje, 'poslato');
  assert.equal(s.moze, true);
  assert.equal(e.pozivi.length - pre, 2);
  assert.equal(JSON.parse(e.pozivi[pre].init.body).takmicenje.naziv, 'Staro');
  assert.equal(JSON.parse(e.pozivi[pre + 1].init.body).takmicenje.naziv, 'Novo');
});

test('posaljiNaCekanju ne krece pokusaj dok je objavi u toku', async () => {
  let pusti;
  const kapija = new Promise((r) => { pusti = r; });
  const e = okruzenje({ fetch: async () => { await kapija; return { status: 200, text: async () => '{"ok":true}' }; } });
  const tid = takmicenje(e.baza);
  const p = e.k.objavi(tid);
  await new Promise((r) => setImmediate(r));
  const retry = e.k.posaljiNaCekanju();
  pusti();
  await Promise.all([p, retry]);
  assert.equal(e.pozivi.length, 1);
});

test('dva preklapajuca objavi: jedan fetch (posle ponovnog pokusaja)', async () => {
  const e = okruzenje();
  const tid = takmicenje(e.baza);
  const [a, b] = await Promise.all([e.k.objavi(tid), e.k.objavi(tid)]);
  assert.equal(e.pozivi.length, 1);
  assert.deepEqual(a, b);
});
