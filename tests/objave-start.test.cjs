const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { napravi } = require('../electron/modeli/objava.cjs');
const { napraviObjavu } = require('../electron/racun/objava-format.mjs');
const { uveziIzFascikle } = require('../electron/objave-start.cjs');
const { VRSTE } = require('../electron/modeli/kopija.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const UID1 = 'a1b2c3d4-0000-4000-8000-000000000001';
const UID2 = 'a1b2c3d4-0000-4000-8000-000000000002';

function prazna() {
  const baza = otvori(':memory:');
  baza.migriraj();
  pocetniPodaci(baza);
  return baza;
}

// Izvorna baza sa jednim takmicenjem; objava dobija uid i datum po potrebi.
function objava(uid, datum) {
  const A = otvori(':memory:');
  A.migriraj();
  const s = tokSeme(A);
  const o = JSON.parse(JSON.stringify(napraviObjavu(napravi(A).redoviTakmicenja(s.takm), { uid, verzija: '1.2.9', sad: '2026-11-13 09:00:00' })));
  o.takmicenje.datum = datum;
  return o;
}

function fascikla(fajlovi) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'objave-start-'));
  for (const [ime, sadrzaj] of Object.entries(fajlovi)) {
    fs.writeFileSync(path.join(d, ime), typeof sadrzaj === 'string' ? sadrzaj : JSON.stringify(sadrzaj));
  }
  return d;
}

function lazno(padaKopija = false) {
  const pozivi = [];
  const greske = [];
  return {
    pozivi, greske,
    kopija: { napravi(vrsta) { pozivi.push(vrsta); if (padaKopija) throw new Error('disk pun'); return {}; } },
    dnevnik: { info() {}, greska(k, e) { greske.push([k, e.message]); } },
  };
}

const poziv = (baza, f, l) => uveziIzFascikle({ baza, fascikla: f, kopija: l.kopija, dnevnik: l.dnevnik, verzija: '1.2.9', sad: '2026-11-13 10:00:00' });
const brojTakmicenja = (b) => Number(b.vrednost('SELECT COUNT(*) FROM takmicenja'));

test('VRSTE ima pre_uvoza', () => {
  assert.equal(VRSTE.pre_uvoza, 'Pre uvoza takmičenja');
});

test('dva dobra i jedan los fajl', () => {
  const baza = prazna();
  const f = fascikla({ 'b.json': objava(UID2, '2026-10-20'), 'a.json': objava(UID1, '2026-10-17'), 'c.json': '{ nije json' });
  const l = lazno();
  const r = poziv(baza, f, l);
  assert.equal(r.uvezena.length, 2);
  assert.deepEqual(r.uvezena.map((x) => x.uid), [UID1, UID2]); // po datumu
  assert.equal(r.uvezena[0].naziv, 'Test kup');
  assert.ok(Number.isInteger(r.uvezena[0].takmicenje_id));
  assert.equal(r.odbijena.length, 1);
  assert.equal(r.odbijena[0].fajl, 'c.json');
  assert.deepEqual(l.pozivi, ['pre_uvoza']);
  assert.equal(brojTakmicenja(baza), 2);
  assert.equal(l.greske.length, 1);
});

test('drugi start ne radi nista i ne pravi kopiju', () => {
  const baza = prazna();
  const f = fascikla({ 'a.json': objava(UID1, '2026-10-17') });
  poziv(baza, f, lazno());
  const l = lazno();
  const r = poziv(baza, f, l);
  assert.deepEqual(r, { uvezena: [], odbijena: [] });
  assert.deepEqual(l.pozivi, []);
  assert.equal(brojTakmicenja(baza), 1);
});

test('sve preskoceno: nema kopije', () => {
  const baza = prazna();
  const f = fascikla({ 'a.json': objava(UID1, '2026-10-17'), 'b.json': objava(UID2, '2026-10-18') });
  poziv(baza, f, lazno());
  const l = lazno();
  poziv(baza, f, l);
  assert.deepEqual(l.pozivi, []);
});

test('kopija pada: nista se ne uvozi, greska u dnevnik', () => {
  const baza = prazna();
  const f = fascikla({ 'a.json': objava(UID1, '2026-10-17') });
  const l = lazno(true);
  const r = poziv(baza, f, l);
  assert.deepEqual(r.uvezena, []);
  assert.equal(brojTakmicenja(baza), 0);
  assert.equal(Number(baza.vrednost('SELECT COUNT(*) FROM uvezene_objave')), 0);
  assert.equal(l.greske.length, 1);
  assert.match(l.greske[0][1], /disk pun/);
});

test('prazna ili nepostojeca fascikla: prazni nizovi', () => {
  const baza = prazna();
  const l = lazno();
  const prazno = { uvezena: [], odbijena: [] };
  assert.deepEqual(poziv(baza, fascikla({}), l), prazno);
  assert.deepEqual(poziv(baza, path.join(os.tmpdir(), 'nema-ove-fascikle-xyz'), l), prazno);
  assert.deepEqual(l.pozivi, []);
});

test('fajl bez uid-a se odbija po imenu fajla i ne zaustavlja ostale', () => {
  const baza = prazna();
  const bez = objava(UID2, '2026-10-18');
  delete bez.uid;
  const f = fascikla({ 'a.json': objava(UID1, '2026-10-17'), 'x.json': bez });
  const r = poziv(baza, f, lazno());
  assert.equal(r.uvezena.length, 1);
  assert.equal(r.odbijena[0].fajl, 'x.json');
});

test('fajl koji ne prolazi proveru dobija uid zapis, sam ne pravi kopiju', () => {
  const baza = prazna();
  const lose = objava(UID1, '2026-10-17');
  lose.takmicenje.naziv = '';
  const f = fascikla({ 'a.json': lose });
  const l = lazno();
  const r = poziv(baza, f, l);
  assert.deepEqual(l.pozivi, []);
  assert.equal(r.uvezena.length, 0);
  assert.equal(r.odbijena[0].uid, UID1);
  assert.equal(baza.vrednost('SELECT stanje FROM uvezene_objave WHERE uid = ?', [UID1]), 'odbijeno');
});

test('uvezi baca za jedan fajl: ostali se uvoze, taj ide u odbijena, start se nastavlja', () => {
  const baza = prazna();
  const pravi = napravi(baza);
  const model = { ...pravi, uvezi(o, opcije) { if (o.uid === UID2) throw new Error('puklo usred uvoza'); return pravi.uvezi(o, opcije); } };
  const f = fascikla({ 'a.json': objava(UID1, '2026-10-17'), 'b.json': objava(UID2, '2026-10-18'), 'c.json': objava('a1b2c3d4-0000-4000-8000-000000000003', '2026-10-19') });
  const l = lazno();
  const r = uveziIzFascikle({ baza, fascikla: f, kopija: l.kopija, dnevnik: l.dnevnik, verzija: '1.2.9', sad: '2026-11-13 10:00:00', model });
  assert.equal(r.uvezena.length, 2);
  assert.deepEqual(r.odbijena, [{ uid: UID2, poruka: 'puklo usred uvoza' }]);
  assert.equal(brojTakmicenja(baza), 2);
  assert.equal(l.greske.length, 1);
});

test('takmicar bez godine rodjenja: odbijeno bez kopije i bez izuzetka u uvozu', () => {
  const baza = prazna();
  const lose = objava(UID1, '2026-10-17');
  lose.takmicari.push({ id: 1, ime: 'Ana', prezime: 'Anic', godina_rodjenja: null, pol: 'Z', klub_id: null, drzavljanstvo: 'Srbija' });
  const l = lazno();
  const r = poziv(baza, fascikla({ 'a.json': lose }), l);
  assert.deepEqual(l.pozivi, []);
  assert.equal(r.uvezena.length, 0);
  assert.equal(baza.vrednost('SELECT stanje FROM uvezene_objave WHERE uid = ?', [UID1]), 'odbijeno');
  assert.deepEqual(l.greske, []);
});
