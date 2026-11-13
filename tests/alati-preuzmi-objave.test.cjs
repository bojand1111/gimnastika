const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main } = require('../alati/preuzmi-objave.cjs');

const KLJUC = 'tajni-kljuc-12345';
const ADRESA = 'https://objave.example.test';
const UID1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function objava(uid, naziv = 'Memorijal', pol = 'M') {
  return { verzija_formata: 1, uid, takmicenje: { naziv, datum: '2026-10-17', pol }, klubovi: [], takmicari: [], kategorije: [], programi: [], sprave: [], prijave: [], grupe: [], ocene: [] };
}
const meta = (uid, pol = 'M') => ({ uid, naziv: 'Memorijal', datum: '2026-10-17', pol, objavljeno: '2026-11-13T10:05:00.000Z', verzija: '1.2.9' });

function okolina(telo = {}) {
  const fascikla = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-objave-'));
  const pozivi = [];
  const izlaz = [];
  const fetch = async (url, opt = {}) => {
    pozivi.push({ url, metoda: opt.method || 'GET', auth: opt.headers && opt.headers.Authorization });
    const odg = telo[(opt.method || 'GET') + ' ' + url.replace(ADRESA, '')];
    if (!odg) return { ok: false, status: 404, json: async () => ({ ok: false }), text: async () => '' };
    return { ok: true, status: 200, json: async () => odg, text: async () => (typeof odg === 'string' ? odg : JSON.stringify(odg)) };
  };
  const deps = { fetch, fascikla, kljuc: KLJUC, adresa: ADRESA, ispis: (s) => izlaz.push(String(s)) };
  return { deps, fascikla, pozivi, izlaz };
}
const spisak = (...m) => ({ ok: true, objave: m });

test('skida samo nove i ne dira postojece', async () => {
  const e = okolina({ ['GET /objave']: spisak(meta(UID1), meta(UID2, 'Z')), ['GET /objave/' + UID2]: objava(UID2, 'Novo', 'Z') });
  fs.writeFileSync(path.join(e.fascikla, UID1 + '.json'), 'staro');
  const kod = await main([], e.deps);
  assert.equal(kod, 0);
  assert.equal(fs.readFileSync(path.join(e.fascikla, UID1 + '.json'), 'utf8'), 'staro');
  assert.equal(JSON.parse(fs.readFileSync(path.join(e.fascikla, UID2 + '.json'), 'utf8')).takmicenje.naziv, 'Novo');
  assert.ok(!e.pozivi.some((p) => p.url.endsWith(UID1)));
  assert.ok(e.izlaz.some((s) => s.includes('17.10.2026.') && s.includes('ŽSG') && s.includes('novo')));
  assert.ok(e.izlaz.some((s) => s.includes('MSG') && s.includes('ima')));
  assert.ok(!fs.readdirSync(e.fascikla).some((f) => f.endsWith('.tmp')));
});

test('--sve prepisuje i postojece', async () => {
  const e = okolina({ ['GET /objave']: spisak(meta(UID1)), ['GET /objave/' + UID1]: objava(UID1, 'Sveze') });
  fs.writeFileSync(path.join(e.fascikla, UID1 + '.json'), 'staro');
  assert.equal(await main(['--sve'], e.deps), 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(e.fascikla, UID1 + '.json'), 'utf8')).takmicenje.naziv, 'Sveze');
});

test('los JSON se ne upisuje, kod 1', async () => {
  const e = okolina({ ['GET /objave']: spisak(meta(UID1)), ['GET /objave/' + UID1]: { uid: UID1 } });
  assert.equal(await main([], e.deps), 1);
  assert.deepEqual(fs.readdirSync(e.fascikla), []);
});

test('bez kljuca ili adrese kod 1', async () => {
  const e = okolina();
  assert.equal(await main([], { ...e.deps, kljuc: null }), 1);
  assert.equal(await main([], { ...e.deps, adresa: '' }), 1);
  assert.equal(e.pozivi.length, 0);
});

test('401 daje kod 1 a ispis ne sadrzi kljuc', async () => {
  const e = okolina();
  e.deps.fetch = async () => ({ ok: false, status: 401, json: async () => ({ ok: false }), text: async () => '' });
  assert.equal(await main([], e.deps), 1);
  assert.ok(!e.izlaz.join('\n').includes(KLJUC));
});

test('ispis ne sadrzi kljuc, a zahtev nosi Bearer', async () => {
  const e = okolina({ ['GET /objave']: spisak(meta(UID1)), ['GET /objave/' + UID1]: objava(UID1) });
  await main([], e.deps);
  assert.ok(!e.izlaz.join('\n').includes(KLJUC));
  assert.equal(e.pozivi[0].auth, 'Bearer ' + KLJUC);
});

test('--obrisi zove DELETE i ne brise lokalno', async () => {
  const e = okolina({ ['DELETE /objave/' + UID1]: { ok: true } });
  fs.writeFileSync(path.join(e.fascikla, UID1 + '.json'), 'lokalno');
  assert.equal(await main(['--obrisi', UID1], e.deps), 0);
  assert.equal(e.pozivi[0].metoda, 'DELETE');
  assert.ok(fs.existsSync(path.join(e.fascikla, UID1 + '.json')));
  assert.equal(await main(['--obrisi'], e.deps), 1);
});

test('ispis vremena objave: ISO sa Z i oblik bez zone daju isto lokalno vreme', async () => {
  const lokalno = (iso) => {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}. ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  for (const objavljeno of ['2026-11-13T18:00:00.000Z', '2026-11-13 18:00:00']) {
    const e = okolina({ ['GET /objave']: spisak({ ...meta(UID1), objavljeno }), ['GET /objave/' + UID1]: objava(UID1) });
    await main([], e.deps);
    assert.ok(e.izlaz.join('\n').includes('objavljeno ' + lokalno('2026-11-13T18:00:00.000Z')), objavljeno);
  }
});
