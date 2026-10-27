const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviKopiju, oporaviStaro } = require('../electron/modeli/kopija.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');

const NEMI = { info() {}, greska() {} };
const SAD = '2026-10-01 18:44:06';

function nova(opcije = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-kopsig-'));
  const baza = otvori(path.join(dir, 'gimnastika.sqlite'));
  baza.migriraj();
  pocetniPodaci(baza);
  const podesavanja = napraviPodesavanja(baza, dir);
  const k = napraviKopiju(baza, {
    fasciklaPodrazumevana: path.join(dir, 'kopije'), podesavanja, verzija: '1.0.0', dnevnik: NEMI, ...opcije,
  });
  const ukloni = () => { try { baza.zatvori(); } catch { /* vec zatvorena */ } fs.rmSync(dir, { recursive: true, force: true }); };
  return { dir, baza, podesavanja, k, ukloni, zivi: path.join(dir, 'gimnastika.sqlite') };
}

function klub(baza, naziv, skr) {
  return baza.ubaci('klubovi', { puno_ime: naziv, skracenica: skr, grad: '', kreirano: SAD, izmenjeno: SAD });
}

function brojKlubova(baza) {
  return Number(baza.vrednost('SELECT COUNT(*) FROM klubovi'));
}

function izmeniKopiju(putanja, fn) {
  const db = new DatabaseSync(putanja);
  try { fn(db); } finally { db.close(); }
}

function preVracanja(t) {
  return t.k.lista().filter((x) => x.opis && x.opis.vrsta === 'pre_vracanja');
}

test('vrati sqlite: fascikla kopija ostaje sa ovog racuna, tudje putanje grbova se prazne', () => {
  const t = nova();
  try {
    const usb = path.join(t.dir, 'usb');
    t.k.postaviFasciklu(usb);
    t.baza.ubaci('takmicenja', { naziv: 'Kup', datum: '2026-10-17', kreirano: SAD, izmenjeno: SAD });
    const kopija = t.k.napravi('rucna');
    izmeniKopiju(kopija.putanja, (db) => {
      db.prepare("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('kopije_fascikla', ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost")
        .run('//server/deljeno');
      db.prepare("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('grb_levo', 'C:/tudje/grb.png') ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost").run();
      db.prepare("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('grb_desno', 'grb/grb_desno.png') ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost").run();
      db.exec("UPDATE takmicenja SET grb_levo = '../../x.png', grb_desno = 'grb/grb_desno.png'");
    });
    t.k.vrati(kopija.putanja);
    assert.equal(t.podesavanja.daj('kopije_fascikla'), usb);
    assert.equal(t.podesavanja.daj('grb_levo'), '');
    assert.equal(t.podesavanja.daj('grb_desno'), 'grb/grb_desno.png');
    const r = t.baza.jedan('SELECT grb_levo, grb_desno FROM takmicenja');
    assert.deepEqual({ ...r }, { grb_levo: '', grb_desno: 'grb/grb_desno.png' });
    assert.equal(t.k.fasciklaStanje().putanja, usb);
  } finally { t.ukloni(); }
});

test('vrati sqlite: kad ziva baza nema izabranu fasciklu, ni kopija je ne namece', () => {
  const t = nova();
  try {
    const kopija = t.k.napravi('rucna');
    izmeniKopiju(kopija.putanja, (db) => {
      db.prepare("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('kopije_fascikla', '//server/x') ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost").run();
    });
    t.k.vrati(kopija.putanja);
    assert.equal(t.podesavanja.daj('kopije_fascikla'), '');
    assert.equal(t.k.fasciklaStanje().nedostupna, false);
  } finally { t.ukloni(); }
});

test('oporaviStaro: vraca .staro samo kad nema zive baze', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-opor-'));
  try {
    const p = path.join(dir, 'gimnastika.sqlite');
    assert.equal(oporaviStaro(p), false, 'nista ne postoji');
    fs.writeFileSync(`${p}.staro`, 'stara');
    fs.writeFileSync(`${p}-wal`, 'smece');
    assert.equal(oporaviStaro(p), true);
    assert.equal(fs.readFileSync(p, 'utf8'), 'stara');
    assert.equal(fs.existsSync(`${p}.staro`), false);
    assert.equal(fs.existsSync(`${p}-wal`), false);
    fs.writeFileSync(`${p}.staro`, 'druga');
    assert.equal(oporaviStaro(p), false, 'ziva baza postoji');
    assert.equal(fs.readFileSync(p, 'utf8'), 'stara');
    assert.equal(fs.readFileSync(`${p}.staro`, 'utf8'), 'druga');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('vrati: postojeci .staro se ne brise nego dobija vremenski sufiks', () => {
  const t = nova();
  try {
    const kopija = t.k.napravi('rucna');
    fs.writeFileSync(`${t.zivi}.staro`, 'ostatak prekinutog vracanja');
    t.k.vrati(kopija.putanja);
    const ostaci = fs.readdirSync(t.dir).filter((f) => f.startsWith('gimnastika.sqlite.staro'));
    assert.equal(ostaci.length, 1);
    assert.match(ostaci[0], /^gimnastika\.sqlite\.staro\.\d+$/);
    assert.equal(fs.readFileSync(path.join(t.dir, ostaci[0]), 'utf8'), 'ostatak prekinutog vracanja');
  } finally { t.ukloni(); }
});

test('vrati: neuspela zamena vraca staro stanje, fajlovi su ocisceni', () => {
  const t = nova();
  const original = fs.renameSync;
  try {
    klub(t.baza, 'Prvi', 'PRV');
    const kopija = t.k.napravi('rucna');
    klub(t.baza, 'Drugi', 'DRG');
    fs.renameSync = (a, b) => {
      if (String(a).endsWith('.vracanje') && b === t.zivi) throw new Error('zakljucan fajl');
      return original(a, b);
    };
    assert.throws(() => t.k.vrati(kopija.putanja), /zakljucan fajl/);
    fs.renameSync = original;
    assert.equal(brojKlubova(t.baza), 2, 'podaci su nepromenjeni');
    klub(t.baza, 'Treci', 'TRC');
    assert.equal(brojKlubova(t.baza), 3, 'baza je upotrebljiva');
    assert.deepEqual(fs.readdirSync(t.dir).filter((f) => /.(staro|vracanje|uvoz)/.test(f)), []);
    assert.equal(fs.existsSync(`${t.zivi}.staro`), false);
    assert.equal(fs.existsSync(`${t.zivi}.vracanje`), false);
  } finally { fs.renameSync = original; t.ukloni(); }
});

test('vrati sqlite: ostecen a otvoriv fajl hvata quick_check, bez sigurnosne kopije i bez izmene baze', () => {
  const t = nova();
  try {
    for (let i = 0; i < 400; i++) klub(t.baza, `Klub ${i} ${'x'.repeat(60)}`, `K${i}`);
    const kopija = t.k.napravi('rucna');
    const bajtovi = fs.readFileSync(kopija.putanja);
    const los = Buffer.from(bajtovi);
    los.fill(0xff, 8192, 8192 + 4096); // cela jedna stranica u sredini
    const losaPutanja = path.join(t.dir, 'kopije', 'ostecena.sqlite');
    fs.writeFileSync(losaPutanja, los);
    assert.throws(() => t.k.vrati(losaPutanja), (e) => e instanceof GreskaKorisnika && e.message === 'Kopija je oštećena.');
    assert.equal(brojKlubova(t.baza), 400);
    assert.equal(preVracanja(t).length, 0, 'nema zalutale sigurnosne kopije');
  } finally { t.ukloni(); }
});

test('vrati sqlite: zaostali -wal pored cilja se brise pre zamene', () => {
  const t = nova();
  try {
    klub(t.baza, 'Prvi', 'PRV');
    const kopija = t.k.napravi('rucna');
    klub(t.baza, 'Drugi', 'DRG');
    const stvarna = t.baza.zatvori.bind(t.baza);
    t.baza.zatvori = () => {
      delete t.baza.zatvori; // samo prvo zatvaranje (u zameni)
      stvarna();
      fs.writeFileSync(`${t.zivi}-wal`, Buffer.alloc(4152, 7)); // kao da je ostao od pada
      fs.writeFileSync(`${t.zivi}-shm`, Buffer.alloc(32768, 7));
    };
    t.k.vrati(kopija.putanja);
    const wal = `${t.zivi}-wal`;
    assert.ok(!fs.existsSync(wal) || fs.readFileSync(wal)[0] !== 7, 'zaostali wal nije ostao');
    assert.equal(brojKlubova(t.baza), 1);
    klub(t.baza, 'Novi', 'NOV');
    assert.equal(brojKlubova(t.baza), 2);
  } finally { t.ukloni(); }
});

test('lista: .tmp i .sqlite-journal se ignorisu', () => {
  const t = nova();
  try {
    const r = t.k.napravi('rucna');
    fs.writeFileSync(path.join(t.dir, 'kopije', `${r.ime}.tmp`), 'pola');
    fs.writeFileSync(path.join(t.dir, 'kopije', 'x.sqlite-journal'), 'dnevnik');
    assert.deepEqual(t.k.lista().map((x) => x.ime), [r.ime]);
  } finally { t.ukloni(); }
});

test('vrati: greska u posleVracanja se javlja sa imenom sigurnosne kopije', () => {
  const t = nova({ posleVracanja: () => { throw new Error('migracija pukla'); } });
  try {
    const kopija = t.k.napravi('rucna');
    assert.throws(() => t.k.vrati(kopija.putanja), (e) => e instanceof GreskaKorisnika &&
      /^Vraćanje nije dovršeno: migracija pukla\. Stanje pre vraćanja je u fajlu kopija_.*\.sqlite\.$/.test(e.message));
    const sig = preVracanja(t);
    assert.equal(sig.length, 1);
  } finally { t.ukloni(); }
});

test('vrati sqlite: okidaci i pogledi iz kopije se brisu, pa ne ponistavaju ciscenje', () => {
  const t = nova();
  try {
    const usb = path.join(t.dir, 'usb');
    t.k.postaviFasciklu(usb);
    const kopija = t.k.napravi('rucna');
    izmeniKopiju(kopija.putanja, (db) => {
      db.exec(`CREATE TRIGGER "vra""ti" AFTER UPDATE ON podesavanja BEGIN
        UPDATE podesavanja SET vrednost = '//server/deljeno' WHERE kljuc = 'kopije_fascikla'; END`);
      db.exec('CREATE VIEW pogled AS SELECT * FROM klubovi');
      db.exec("UPDATE podesavanja SET vrednost = '//server/deljeno' WHERE kljuc = 'kopije_fascikla'");
    });
    t.k.vrati(kopija.putanja);
    assert.equal(t.podesavanja.daj('kopije_fascikla'), usb);
    assert.equal(t.baza.vrednost("SELECT COUNT(*) FROM sqlite_master WHERE type IN ('trigger', 'view')"), 0);
    t.podesavanja.postavi('organizator', 'X');
    assert.equal(t.podesavanja.daj('kopije_fascikla'), usb);
  } finally { t.ukloni(); }
});

test('vrati sqlite: grb sa samo tackama ili ".." se prazni', () => {
  const t = nova();
  try {
    t.baza.ubaci('takmicenja', { naziv: 'Kup', datum: '2026-10-17', kreirano: SAD, izmenjeno: SAD });
    const kopija = t.k.napravi('rucna');
    izmeniKopiju(kopija.putanja, (db) => {
      db.exec("UPDATE takmicenja SET grb_levo = 'grb/..', grb_desno = 'grb/a..b.png'");
      db.exec("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('grb_levo', 'grb/.') ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost");
      db.exec("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('grb_desno', 'grb/ok-1_a.png') ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost");
    });
    t.k.vrati(kopija.putanja);
    assert.deepEqual({ ...t.baza.jedan('SELECT grb_levo, grb_desno FROM takmicenja') }, { grb_levo: '', grb_desno: '' });
    assert.equal(t.podesavanja.daj('grb_levo'), '');
    assert.equal(t.podesavanja.daj('grb_desno'), 'grb/ok-1_a.png');
  } finally { t.ukloni(); }
});
