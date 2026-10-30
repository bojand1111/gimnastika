const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { podeliPolove } = require('../electron/baza/podela-polova.cjs');
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

function posleZatvaranja(t, upis) {
  const stvarna = t.baza.zatvori.bind(t.baza);
  t.baza.zatvori = () => {
    delete t.baza.zatvori; // samo prvo zatvaranje (u zameni)
    stvarna();
    upis();
  };
}

test('vrati sqlite: prazan zaostali -wal i -shm se brisu pre zamene', () => {
  const t = nova();
  try {
    klub(t.baza, 'Prvi', 'PRV');
    const kopija = t.k.napravi('rucna');
    klub(t.baza, 'Drugi', 'DRG');
    posleZatvaranja(t, () => {
      fs.writeFileSync(`${t.zivi}-wal`, Buffer.alloc(0));
      fs.writeFileSync(`${t.zivi}-shm`, Buffer.alloc(0));
    });
    t.k.vrati(kopija.putanja);
    assert.equal(brojKlubova(t.baza), 1);
    klub(t.baza, 'Novi', 'NOV');
    assert.equal(brojKlubova(t.baza), 2);
  } finally { t.ukloni(); }
});

test('vrati sqlite: neprazan -wal posle zatvaranja prekida vracanje, podaci ostaju', () => {
  const t = nova();
  try {
    klub(t.baza, 'Prvi', 'PRV');
    const kopija = t.k.napravi('rucna');
    klub(t.baza, 'Drugi', 'DRG');
    // zatvaranje ostavlja WAL sa sadrzajem (drugi proces drzi fajl)
    posleZatvaranja(t, () => fs.writeFileSync(`${t.zivi}-wal`, Buffer.alloc(4152, 7)));
    assert.throws(() => t.k.vrati(kopija.putanja), (e) => e instanceof GreskaKorisnika &&
      e.message === 'Baza je zauzeta u drugom programu. Zatvorite ga i pokušajte ponovo.');
    assert.equal(fs.existsSync(`${t.zivi}.staro`), false);
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

function stanjeTabela(baza) {
  const rez = {};
  for (const t of baza.tabele().filter((x) => x !== 'migracije').sort()) {
    // kopije_fascikla i sajt_* su podesavanja ovog racuna i uvek se upisuje posle vracanja
    const uslov = t === 'podesavanja' ? " WHERE kljuc <> 'kopije_fascikla' AND kljuc NOT LIKE 'sajt_%'" : '';
    rez[t] = baza.svi(`SELECT * FROM ${t}${uslov}`).map((r) => ({ ...r }));
  }
  return rez;
}

function napuni(t) {
  klub(t.baza, 'Prvi', 'PRV');
  const zadnji = klub(t.baza, 'Drugi', 'DRG');
  t.baza.izvrsi('DELETE FROM klubovi WHERE id = ?', [zadnji]); // brojac ostaje ispred poslednjeg reda
  klub(t.baza, 'Treci', 'TRC');
  t.baza.ubaci('takmicenja', { naziv: 'Kup', datum: '2026-10-17', kreirano: SAD, izmenjeno: SAD });
  t.baza.ubaci('takmicari', { id_broj: 'A1', ime: 'Ana', prezime: 'Anic', godina_rodjenja: 2012, pol: 'Z', klub_id: 1, kreirano: SAD, izmenjeno: SAD });
}

test('vrati sqlite: svi redovi i sqlite_sequence su isti, tudji okidac i tabela ne prelaze', () => {
  const t = nova();
  try {
    napuni(t);
    podeliPolove(t.baza); // vracanje poziva podeluPolova, pa kopija mora vec biti podeljena da stanje bude isto
    const pre = stanjeTabela(t.baza);
    const seqPre = t.baza.svi('SELECT name, seq FROM sqlite_sequence ORDER BY name').map((r) => ({ ...r }));
    assert.ok(seqPre.some((r) => r.name === 'klubovi' && r.seq === 3));
    const kopija = t.k.napravi('rucna');
    klub(t.baza, 'Posle', 'POS');
    izmeniKopiju(kopija.putanja, (db) => {
      db.exec('CREATE TABLE tudja (a TEXT)');
      db.exec("INSERT INTO tudja VALUES ('x')");
      db.exec("CREATE TRIGGER okidac AFTER INSERT ON klubovi BEGIN DELETE FROM klubovi; END");
    });
    t.k.vrati(kopija.putanja);
    assert.deepEqual(stanjeTabela(t.baza), pre);
    assert.deepEqual(t.baza.svi('SELECT name, seq FROM sqlite_sequence ORDER BY name').map((r) => ({ ...r })), seqPre);
    assert.equal(t.baza.vrednost("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('tudja', 'okidac')"), 0);
    klub(t.baza, 'Novi', 'NOV'); // okidac ne radi
    assert.equal(brojKlubova(t.baza), 3);
  } finally { t.ukloni(); }
});

test('vrati sqlite: lazirani tip u sqlite_master se odbija ili se ne prenosi', () => {
  const t = nova();
  try {
    napuni(t);
    const kopija = t.k.napravi('rucna');
    izmeniKopiju(kopija.putanja, (db) => {
      db.exec("CREATE TRIGGER okidac AFTER INSERT ON klubovi BEGIN DELETE FROM klubovi; END");
      db.exec('PRAGMA writable_schema = ON');
      db.exec("UPDATE sqlite_master SET type = 'table' WHERE name = 'okidac'");
      db.exec('PRAGMA writable_schema = OFF');
    });
    const pre = stanjeTabela(t.baza);
    try {
      t.k.vrati(kopija.putanja);
    } catch (e) {
      assert.ok(e instanceof GreskaKorisnika, e.message);
      assert.deepEqual(stanjeTabela(t.baza), pre);
      return;
    }
    assert.equal(t.baza.vrednost("SELECT COUNT(*) FROM sqlite_master WHERE name = 'okidac' OR type = 'trigger'"), 0);
    klub(t.baza, 'Novi', 'NOV');
    assert.equal(brojKlubova(t.baza), 3);
  } finally { t.ukloni(); }
});

test('vrati sqlite: kopija starije seme (bez takmicenja.domacin) dobija podrazumevane vrednosti', () => {
  const t = nova();
  try {
    napuni(t);
    const kopija = t.k.napravi('rucna');
    izmeniKopiju(kopija.putanja, (db) => { db.exec('ALTER TABLE takmicenja DROP COLUMN domacin'); });
    t.baza.izvrsi("UPDATE takmicenja SET domacin = 'Tudji'");
    t.k.vrati(kopija.putanja);
    const r = t.baza.jedan('SELECT naziv, domacin FROM takmicenja');
    assert.deepEqual({ ...r }, { naziv: 'Kup', domacin: '' });
    assert.equal(brojKlubova(t.baza), 2);
  } finally { t.ukloni(); }
});

test('napravi: kopija_opis u zivoj bazi ne smeta, kopija ima jedan sveze popunjen', () => {
  const t = nova();
  try {
    t.baza.db.exec("CREATE TABLE kopija_opis (kljuc TEXT PRIMARY KEY, vrednost TEXT)");
    t.baza.db.exec("INSERT INTO kopija_opis VALUES ('aplikacija', 'gimnastika'), ('vrsta', 'stara')");
    const r = t.k.napravi('rucna');
    const c = new DatabaseSync(r.putanja, { readOnly: true });
    const redovi = c.prepare('SELECT kljuc, vrednost FROM kopija_opis').all().map((x) => ({ ...x }));
    const brojTabela = c.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'kopija_opis'").get().n;
    c.close();
    assert.equal(brojTabela, 1);
    assert.equal(redovi.length, 5);
    assert.equal(redovi.find((x) => x.kljuc === 'vrsta').vrednost, 'rucna');
    assert.equal(t.k.opis(r.putanja).vrsta, 'rucna');
  } finally { t.ukloni(); }
});

test('vrati sqlite: nevazeci brojaci iz kopije se preskacu', () => {
  const t = nova();
  try {
    klub(t.baza, 'Prvi', 'PRV');
    const kopija = t.k.napravi('rucna');
    izmeniKopiju(kopija.putanja, (db) => {
      db.exec('PRAGMA writable_schema = ON');
      db.exec("INSERT INTO sqlite_sequence (name, seq) VALUES ('kategorije', 'tekst')");
      db.exec("INSERT INTO sqlite_sequence (name, seq) VALUES ('programi', -5)");
      db.exec('PRAGMA writable_schema = OFF');
    });
    t.k.vrati(kopija.putanja);
    const seq = Object.fromEntries(t.baza.svi('SELECT name, seq FROM sqlite_sequence').map((r) => [r.name, r.seq]));
    assert.equal(seq.klubovi, 1);
    assert.equal(seq.kategorije, undefined);
    assert.equal(seq.programi, undefined);
    t.baza.ubaci('kategorije', { naziv: 'K', kreirano: SAD, izmenjeno: SAD });
    assert.equal(t.baza.vrednost('SELECT id FROM kategorije'), 1);
  } finally { t.ukloni(); }
});

const SAJT = ['sajt_url', 'sajt_token', 'sajt_poslednja_sinhronizacija'];

function tudjiSajt(putanja) {
  izmeniKopiju(putanja, (db) => {
    const u = db.prepare('INSERT INTO podesavanja (kljuc, vrednost) VALUES (?, ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost');
    u.run('sajt_url', 'https://tudji.example/api');
    u.run('sajt_token', 'TUDJI-TOKEN');
    u.run('sajt_poslednja_sinhronizacija', '2020-01-01 00:00:00');
  });
}

test('vrati sqlite: kljucevi sajta ostaju sa ovog racuna (i prazni ostaju prazni)', () => {
  const t = nova();
  try {
    const kopija = t.k.napravi('rucna');
    tudjiSajt(kopija.putanja);
    t.k.vrati(kopija.putanja);
    for (const k of SAJT) assert.equal(t.podesavanja.daj(k), '', k);
    t.podesavanja.postavi('sajt_url', 'https://moj.example/api');
    t.podesavanja.postavi('sajt_token', 'MOJ-TOKEN');
    t.podesavanja.postavi('sajt_poslednja_sinhronizacija', '2026-10-30 12:00:00');
    const druga = t.k.napravi('rucna');
    tudjiSajt(druga.putanja);
    t.k.vrati(druga.putanja);
    assert.equal(t.podesavanja.daj('sajt_url'), 'https://moj.example/api');
    assert.equal(t.podesavanja.daj('sajt_token'), 'MOJ-TOKEN');
    assert.equal(t.podesavanja.daj('sajt_poslednja_sinhronizacija'), '2026-10-30 12:00:00');
    assert.equal(Number(t.baza.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc LIKE 'sajt_%'")), 3);
  } finally { t.ukloni(); }
});
