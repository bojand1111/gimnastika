const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviKopiju } = require('../electron/modeli/kopija.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const zip = require('../electron/uvoz/zip.cjs');

const NEMI = { info() {}, greska() {} };
const SAD = '2026-10-01 18:44:06';

// Prava baza u privremenoj fascikli (vracanje menja fajl, pa :memory: ne dolazi u obzir).
function nova(verzija = '1.0.0') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-kop-'));
  const baza = otvori(path.join(dir, 'gimnastika.sqlite'));
  baza.migriraj();
  pocetniPodaci(baza);
  const podesavanja = napraviPodesavanja(baza, dir);
  const k = napraviKopiju(baza, {
    fasciklaPodrazumevana: path.join(dir, 'kopije'), podesavanja, verzija, dnevnik: NEMI,
  });
  const ukloni = () => { try { baza.zatvori(); } catch { /* vec zatvorena */ } fs.rmSync(dir, { recursive: true, force: true }); };
  return { dir, baza, podesavanja, k, ukloni };
}

function klub(baza, naziv, skr) {
  return baza.ubaci('klubovi', { puno_ime: naziv, skracenica: skr, grad: '', kreirano: SAD, izmenjeno: SAD });
}

function brojKlubova(baza) {
  return Number(baza.vrednost('SELECT COUNT(*) FROM klubovi'));
}

test('napravi: sqlite fajl sa kopija_opis (5 kljuceva), lista ga vraca prvim', () => {
  const t = nova();
  try {
    const r = t.k.napravi('rucna');
    assert.match(r.ime, /^kopija_\d{4}-\d\d-\d\d_\d{4}(_\d+)?\.sqlite$/);
    assert.equal(r.putanja, path.join(t.dir, 'kopije', r.ime));
    assert.equal(r.velicina, fs.statSync(r.putanja).size);
    const c = new DatabaseSync(r.putanja, { readOnly: true });
    const kljucevi = c.prepare('SELECT kljuc, vrednost FROM kopija_opis ORDER BY kljuc').all();
    c.close();
    assert.deepEqual(kljucevi.map((x) => x.kljuc), ['aplikacija', 'baza_verzija', 'verzija', 'vreme', 'vrsta']);
    const o = Object.fromEntries(kljucevi.map((x) => [x.kljuc, x.vrednost]));
    assert.equal(o.aplikacija, 'gimnastika');
    assert.equal(o.verzija, '1.0.0');
    assert.equal(o.baza_verzija, '004_redosled_po_rotaciji');
    assert.equal(o.vrsta, 'rucna');
    assert.match(o.vreme, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    const lista = t.k.lista();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].ime, r.ime);
    assert.equal(lista[0].opis.vrsta, 'rucna');
    assert.equal(lista[0].opis.format, 'sqlite');
    assert.equal(lista[0].velicina, r.velicina);
    assert.equal(typeof lista[0].vreme, 'number');
    assert.equal(fs.readdirSync(path.join(t.dir, 'kopije')).length, 1, 'bez privremenih fajlova');
  } finally { t.ukloni(); }
});

test('napravi: kopija sadrzi podatke i radi u istom minutu dva puta (_2)', () => {
  const t = nova();
  try {
    klub(t.baza, 'Soko', 'SOK');
    const a = t.k.napravi('rucna');
    const b = t.k.napravi('rucna');
    assert.notEqual(a.ime, b.ime);
    const bazaA = a.ime.replace(/\.sqlite$/, '');
    if (b.ime.startsWith(bazaA + '.') || b.ime.startsWith(bazaA + '_')) {
      assert.equal(b.ime, `${bazaA}_2.sqlite`);
    }
    const c = new DatabaseSync(a.putanja, { readOnly: true });
    assert.equal(c.prepare('SELECT COUNT(*) AS n FROM klubovi').get().n, 1);
    c.close();
    assert.throws(() => t.k.napravi('nepoznata'), /vrsta/i);
  } finally { t.ukloni(); }
});

test('opis i lista: neispravni fajlovi daju opis null i ne bacaju', () => {
  const t = nova();
  try {
    const f = path.join(t.dir, 'kopije');
    fs.mkdirSync(f, { recursive: true });
    fs.writeFileSync(path.join(f, 'smece.sqlite'), 'ovo nije sqlite');
    const bez = new DatabaseSync(path.join(f, 'bezopisa.sqlite'));
    bez.exec('CREATE TABLE x (a INTEGER)');
    bez.close();
    const tudj = new DatabaseSync(path.join(f, 'tudja.sqlite'));
    tudj.exec('CREATE TABLE kopija_opis (kljuc TEXT PRIMARY KEY, vrednost TEXT)');
    tudj.exec("INSERT INTO kopija_opis VALUES ('aplikacija', 'druga')");
    tudj.close();
    fs.writeFileSync(path.join(f, 'pokvaren.zip'), 'nije zip');
    fs.writeFileSync(path.join(f, 'beleska.txt'), 'ignorise se');
    t.k.napravi('rucna');
    const lista = t.k.lista();
    assert.deepEqual(lista.map((x) => x.ime).sort(),
      ['bezopisa.sqlite', lista.find((x) => x.opis && x.opis.format === 'sqlite').ime, 'pokvaren.zip', 'smece.sqlite', 'tudja.sqlite'].sort());
    for (const ime of ['smece.sqlite', 'bezopisa.sqlite', 'tudja.sqlite', 'pokvaren.zip']) {
      assert.equal(lista.find((x) => x.ime === ime).opis, null, ime);
    }
    assert.throws(() => t.k.opis(path.join(f, 'smece.sqlite')), GreskaKorisnika);
    assert.throws(() => t.k.opis(path.join(f, 'tudja.sqlite')), /Opis kopije nije ispravan\./);
  } finally { t.ukloni(); }
});

test('vrati: menja podatke, pravi pre_vracanja, kopija_opis nestaje, ista Baza radi dalje', () => {
  const t = nova();
  try {
    klub(t.baza, 'Prvi', 'PRV');
    const kopija = t.k.napravi('rucna');
    klub(t.baza, 'Drugi', 'DRG');
    assert.equal(brojKlubova(t.baza), 2);
    const r = t.k.vrati(kopija.putanja);
    assert.equal(r.ime, kopija.ime);
    assert.equal(r.uvoz, false);
    assert.equal(r.opis.vrsta, 'rucna');
    assert.match(r.sigurnosna, /^kopija_.*\.sqlite$/);
    assert.equal(brojKlubova(t.baza), 1);
    assert.equal(t.baza.vrednost("SELECT COUNT(*) FROM sqlite_master WHERE name = 'kopija_opis'"), 0);
    const sig = t.k.lista().find((x) => x.ime === r.sigurnosna);
    assert.equal(sig.opis.vrsta, 'pre_vracanja');
    const c = new DatabaseSync(sig.putanja, { readOnly: true });
    assert.equal(c.prepare('SELECT COUNT(*) AS n FROM klubovi').get().n, 2);
    c.close();
    // posle vracanja baza je upotrebljiva (zapis i WAL), i spremna za novu kopiju
    klub(t.baza, 'Treci', 'TRC');
    assert.equal(brojKlubova(t.baza), 2);
    assert.equal(t.baza.vrednost('PRAGMA foreign_keys'), 1);
    assert.equal(fs.existsSync(path.join(t.dir, 'gimnastika.sqlite.staro')), false);
    assert.equal(fs.existsSync(path.join(t.dir, 'gimnastika.sqlite.vracanje')), false);
  } finally { t.ukloni(); }
});

test('vrati: posleVracanja se poziva posle ponovnog otvaranja', () => {
  const t = nova();
  try {
    const kopija = t.k.napravi('rucna');
    let pozvano = 0;
    const k2 = napraviKopiju(t.baza, {
      fasciklaPodrazumevana: path.join(t.dir, 'kopije'), podesavanja: t.podesavanja, verzija: '1.0.0', dnevnik: NEMI,
      posleVracanja: () => { pozvano++; assert.equal(t.baza.vrednost('SELECT COUNT(*) FROM klubovi'), 0); },
    });
    k2.vrati(kopija.putanja);
    assert.equal(pozvano, 1);
  } finally { t.ukloni(); }
});

test('vrati: kopija iz novije verzije se odbija porukom iz POPIS 3.1, bez promene podataka', () => {
  const t = nova('1.0.0');
  try {
    const kopija = t.k.napravi('rucna');
    const c = new DatabaseSync(kopija.putanja);
    c.exec("UPDATE kopija_opis SET vrednost = '9.9.9' WHERE kljuc = 'verzija'");
    c.close();
    klub(t.baza, 'Ostaje', 'OST');
    assert.throws(() => t.k.vrati(kopija.putanja), (e) => e instanceof GreskaKorisnika && e.message ===
      'Kopija je iz novije verzije aplikacije (9.9.9) nego što je instalirana (1.0.0). Prvo ažurirajte aplikaciju.');
    assert.equal(brojKlubova(t.baza), 1);
    assert.equal(t.k.lista().filter((x) => x.opis && x.opis.vrsta === 'pre_vracanja').length, 0);
    // poredjenje je brojno: 1.10.0 je novije od 1.9.0
    const d = new DatabaseSync(kopija.putanja);
    d.exec("UPDATE kopija_opis SET vrednost = '1.10.0' WHERE kljuc = 'verzija'");
    d.close();
    const t2 = napraviKopiju(t.baza, { fasciklaPodrazumevana: path.join(t.dir, 'kopije'), podesavanja: t.podesavanja, verzija: '1.9.0', dnevnik: NEMI });
    assert.throws(() => t2.vrati(kopija.putanja), /novije verzije aplikacije \(1\.10\.0\)/);
  } finally { t.ukloni(); }
});

test('vrati: pokvaren sqlite fajl ne dira zivu bazu', () => {
  const t = nova();
  try {
    klub(t.baza, 'Ostaje', 'OST');
    const kopija = t.k.napravi('rucna');
    // ostetimo sadrzaj ali ostavimo ispravan zaglavni deo, kopija_opis ostaje citljiv
    const bajtovi = fs.readFileSync(kopija.putanja);
    fs.writeFileSync(path.join(t.dir, 'kopije', 'losa.sqlite'), bajtovi.subarray(0, 100));
    assert.throws(() => t.k.vrati(path.join(t.dir, 'kopije', 'losa.sqlite')), GreskaKorisnika);
    assert.equal(brojKlubova(t.baza), 1);
    klub(t.baza, 'Radi', 'RAD');
  } finally { t.ukloni(); }
});
