// Testovi Cloudflare Worker-a za objave (lazni KV na Map-u, stranice po 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/objave-worker.mjs';

const KLJUC = 'lazni-kljuc-za-test';
const UID = '123e4567-e89b-42d3-a456-426614174000';
const UID2 = '123e4567-e89b-42d3-a456-426614174001';
const UID3 = '123e4567-e89b-42d3-a456-426614174002';

function laznKv() {
  const mapa = new Map();
  return {
    mapa,
    async put(k, v, opcije = {}) {
      if (opcije.metadata && new TextEncoder().encode(JSON.stringify(opcije.metadata)).length > 1024) {
        throw new Error('metadata prevelik');
      }
      mapa.set(k, { v, metadata: opcije.metadata });
    },
    async get(k) { return mapa.has(k) ? mapa.get(k).v : null; },
    async delete(k) { mapa.delete(k); },
    async list({ prefix = '', cursor } = {}) {
      const imena = [...mapa.keys()].filter((k) => k.startsWith(prefix)).sort();
      const od = cursor ? Number(cursor) : 0;
      const deo = imena.slice(od, od + 2);
      const kraj = od + 2 >= imena.length;
      return {
        keys: deo.map((name) => ({ name, metadata: mapa.get(name).metadata })),
        list_complete: kraj,
        cursor: kraj ? undefined : String(od + 2),
      };
    },
  };
}

function objava(uid = UID, naziv = 'Memorijal') {
  return {
    verzija_formata: 1, uid, program: { naziv: 'Gimnastika', verzija: '1.0.0' },
    objavljeno: '2026-11-13T10:00:00Z',
    takmicenje: { naziv, datum: '2026-11-12', pol: 'M' },
  };
}

const okruzenje = (kljuc = KLJUC) => ({ OBJAVE: laznKv(), KLJUC: kljuc });
const adr = (p) => 'https://w.example' + p;
const post = (telo, env, zaglavlja = {}) => worker.fetch(new Request(adr('/objave'), {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', ...zaglavlja },
  body: typeof telo === 'string' ? telo : JSON.stringify(telo),
}), env);
const sKljucem = (metoda, p, env, kljuc = KLJUC) => worker.fetch(new Request(adr(p), {
  method: metoda, headers: { Authorization: 'Bearer ' + kljuc },
}), env);

test('POST ispravne objave pa GET sa kljucem vraca je', async () => {
  const env = okruzenje();
  const odg = await post(objava(), env);
  assert.equal(odg.status, 200);
  assert.deepEqual(await odg.json(), { ok: true });
  const citaj = await sKljucem('GET', '/objave/' + UID, env);
  assert.equal(citaj.status, 200);
  assert.deepEqual(await citaj.json(), objava());
});

test('GET /objave lista sve stranice sa metapodacima', async () => {
  const env = okruzenje();
  for (const u of [UID, UID2, UID3]) await post(objava(u, 'N' + u.slice(-1)), env);
  const odg = await sKljucem('GET', '/objave', env);
  assert.equal(odg.status, 200);
  const telo = await odg.json();
  assert.equal(telo.ok, true);
  assert.equal(telo.objave.length, 3);
  const prva = telo.objave.find((o) => o.uid === UID);
  assert.deepEqual(prva, {
    uid: UID, naziv: 'N0', datum: '2026-11-12', pol: 'M',
    objavljeno: '2026-11-13T10:00:00Z', verzija: '1.0.0',
  });
});

test('GET bez kljuca je 401', async () => {
  const env = okruzenje();
  await post(objava(), env);
  for (const p of ['/objave', '/objave/' + UID]) {
    const odg = await worker.fetch(new Request(adr(p)), env);
    assert.equal(odg.status, 401);
  }
  const brisi = await worker.fetch(new Request(adr('/objave/' + UID), { method: 'DELETE' }), env);
  assert.equal(brisi.status, 401);
});

test('pogresan kljuc je 401', async () => {
  const env = okruzenje();
  assert.equal((await sKljucem('GET', '/objave', env, 'pogresan')).status, 401);
  assert.equal((await sKljucem('GET', '/objave', env, KLJUC + 'x')).status, 401);
});

test('prazan KLJUC je uvek 401', async () => {
  for (const k of ['', undefined]) {
    const env = okruzenje(k);
    assert.equal((await sKljucem('GET', '/objave', env, '')).status, 401);
    assert.equal((await sKljucem('GET', '/objave', env, 'bilo sta')).status, 401);
  }
});

test('telo vece od 2 MB je 413', async () => {
  const env = okruzenje();
  const veliko = objava();
  veliko.takmicenje.opis = 'a'.repeat(2097152);
  assert.equal((await post(veliko, env)).status, 413);
  assert.equal(env.OBJAVE.mapa.size, 0);
});

test('Content-Length veci od 2 MB je 413 bez citanja tela', async () => {
  const env = okruzenje();
  const odg = await post(objava(), env, { 'Content-Length': '2097153' });
  assert.equal(odg.status, 413);
});

test('los uid, los JSON i losa verzija su 400', async () => {
  const env = okruzenje();
  const losi = [
    objava('nije-uuid'),
    { ...objava(), verzija_formata: 2 },
    { ...objava(), takmicenje: { naziv: '', datum: '2026-11-12' } },
    { ...objava(), takmicenje: { naziv: 'X', datum: '' } },
    { ...objava(), takmicenje: null },
    '{ nije json',
    '[]',
  ];
  for (const telo of losi) {
    const odg = await post(telo, env);
    assert.equal(odg.status, 400);
    const j = await odg.json();
    assert.equal(j.ok, false);
    assert.equal(typeof j.greska, 'string');
  }
  assert.equal(env.OBJAVE.mapa.size, 0);
});

test('ponovni POST istog uid prepisuje', async () => {
  const env = okruzenje();
  await post(objava(UID, 'Staro'), env);
  await post(objava(UID, 'Novo'), env);
  assert.equal(env.OBJAVE.mapa.size, 1);
  const citaj = await (await sKljucem('GET', '/objave/' + UID, env)).json();
  assert.equal(citaj.takmicenje.naziv, 'Novo');
});

test('DELETE brise, GET posle toga je 404', async () => {
  const env = okruzenje();
  await post(objava(), env);
  const odg = await sKljucem('DELETE', '/objave/' + UID, env);
  assert.equal(odg.status, 200);
  assert.deepEqual(await odg.json(), { ok: true });
  assert.equal((await sKljucem('GET', '/objave/' + UID, env)).status, 404);
});

test('nepoznata putanja je 404, losa metoda 405', async () => {
  const env = okruzenje();
  assert.equal((await sKljucem('GET', '/nesto', env)).status, 404);
  assert.equal((await sKljucem('GET', '/', env)).status, 404);
  const put = await worker.fetch(new Request(adr('/objave'), { method: 'PUT', body: '{}' }), env);
  assert.equal(put.status, 405);
});

test('dugacak naziv: telo ostaje celo, metapodaci ispod granice', async () => {
  const env = okruzenje();
  const o = objava(UID, 'N'.repeat(5000));
  assert.equal((await post(o, env)).status, 200);
  const citaj = await (await sKljucem('GET', '/objave/' + UID, env)).json();
  assert.equal(citaj.takmicenje.naziv.length, 5000);
  const meta = env.OBJAVE.mapa.get('objava:' + UID).metadata;
  assert.ok(new TextEncoder().encode(JSON.stringify(meta)).length <= 900);
});

test('pol koji nije tekst je 400', async () => {
  const env = okruzenje();
  const o = objava();
  o.takmicenje.pol = { x: 1 };
  assert.equal((await post(o, env)).status, 400);
  assert.equal(env.OBJAVE.mapa.size, 0);
});

test('telo u delovima preko 2 MB bez Content-Length je 413 i ne upisuje', async () => {
  const env = okruzenje();
  const deo = new Uint8Array(1024 * 1024).fill(97);
  let n = 0;
  const tok = new ReadableStream({
    pull(c) { if (n++ < 4) c.enqueue(deo); else c.close(); },
  });
  const odg = await worker.fetch(new Request(adr('/objave'), {
    method: 'POST', body: tok, duplex: 'half',
  }), env);
  assert.equal(odg.status, 413);
  assert.equal(env.OBJAVE.mapa.size, 0);
});

test('KV put koji baca daje 500 JSON', async () => {
  const env = okruzenje();
  env.OBJAVE.put = async () => { throw new Error('kv pao'); };
  const log = console.error;
  console.error = () => {};
  let odg;
  try { odg = await post(objava(), env); } finally { console.error = log; }
  assert.equal(odg.status, 500);
  assert.deepEqual(await odg.json(), { ok: false, greska: 'Greska servera.' });
});

test('uid velikim slovima POST pa malim GET vraca objavu', async () => {
  const env = okruzenje();
  assert.equal((await post(objava(UID.toUpperCase()), env)).status, 200);
  assert.equal((await sKljucem('GET', '/objave/' + UID, env)).status, 200);
  assert.equal((await sKljucem('GET', '/objave/' + UID.toUpperCase(), env)).status, 200);
  assert.equal(env.OBJAVE.mapa.size, 1);
});
