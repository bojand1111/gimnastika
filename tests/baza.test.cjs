const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori, Baza } = require('../electron/baza/baza.cjs');

test('migracija 006: postojece ocene dobijaju bonus NULL, vrednosti i konacna ostaju iste', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const b = otvori(':memory:');
  const fascikla = path.join(__dirname, '..', 'electron', 'baza', 'migracije');
  // baza do migracije 005, sa jednom unetom ocenom (006 i 007 se primenjuju)
  b.db.exec('CREATE TABLE IF NOT EXISTS migracije (ime TEXT PRIMARY KEY, primenjeno TEXT)');
  for (const f of fs.readdirSync(fascikla).filter((x) => /^00[1-5]_/.test(x) && x.endsWith('.sql')).sort()) {
    b.db.exec(fs.readFileSync(path.join(fascikla, f), 'utf8'));
    b.ubaci('migracije', { ime: f.slice(0, -'.sql'.length), primenjeno: 'x' });
  }
  const S = '2026-01-01 00:00:00';
  b.izvrsi("INSERT INTO sprave (id, pol, naziv, skracenica, redosled, kreirano, izmenjeno) VALUES (1, 'Z', 'Greda', 'GR', 1, ?, ?)", [S, S]);
  b.izvrsi("INSERT INTO takmicenja (id, naziv, datum, pol, kreirano, izmenjeno) VALUES (1, 'Kup', '2026-11-01', 'Z', ?, ?)", [S, S]);
  b.izvrsi("INSERT INTO takmicari (id, id_broj, ime, prezime, godina_rodjenja, pol, kreirano, izmenjeno) VALUES (1, 'T1', 'A', 'B', 2012, 'Z', ?, ?)", [S, S]);
  b.izvrsi('INSERT INTO prijave (id, takmicenje_id, takmicar_id, kreirano, izmenjeno) VALUES (1, 1, 1, ?, ?)', [S, S]);
  b.izvrsi("INSERT INTO ocene (id, prijava_id, sprava_id, d, e, odbitak, konacna, status, kreirano, izmenjeno) VALUES (1, 1, 1, 4200, 8700, 300, 12600, 'uneto', ?, ?)", [S, S]);
  assert.deepEqual(b.naCekanju(), ['006_bonus', '007_lekarski_ne_prati', '008_turnus']);
  assert.deepEqual(b.migriraj(), ['006_bonus', '007_lekarski_ne_prati', '008_turnus']);
  assert.deepEqual({ ...b.jedan('SELECT d, e, bonus, odbitak, konacna, status FROM ocene WHERE id = 1') },
    { d: 4200, e: 8700, bonus: null, odbitak: 300, konacna: 12600, status: 'uneto' });
  b.zatvori();
});

test('migracije na praznoj bazi prave sve tabele i ponovo ne rade nista', () => {
  const b = otvori(':memory:');
  assert.equal(b.naCekanju().length, 8);
  const prvi = b.migriraj();
  assert.deepEqual(prvi, ['001_pocetna', '002_takmicenje_grb_domacin', '003_potvrde_klubova', '004_redosled_po_rotaciji', '005_pol_po_delu', '006_bonus', '007_lekarski_ne_prati', '008_turnus']);
  assert.deepEqual(b.tabele().sort(), ['grupa_clanovi', 'grupa_redosled', 'grupe', 'izmene_ocena', 'kategorije', 'klubovi', 'migracije', 'ocene', 'ocene_e', 'podesavanja', 'potvrde_klubova', 'prijava_sprave', 'prijave', 'programi', 'sprave', 'takmicari', 'takmicenja']);
  assert.deepEqual(b.migriraj(), []);
  assert.deepEqual(b.naCekanju(), []);
  b.zatvori();
});

test('ubaci, izmeni, jedan, vrednost, transakcija', () => {
  const b = otvori(':memory:'); b.migriraj();
  const sad = Baza.sad(); assert.match(sad, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const id = b.ubaci('klubovi', { puno_ime: 'Klub Jedan', skracenica: 'JED', kreirano: sad, izmenjeno: sad });
  assert.equal(id, 1);
  assert.equal(b.izmeni('klubovi', { grad: 'Novi Sad' }, 'id = ?', [id]), 1);
  assert.equal(b.jedan('SELECT * FROM klubovi WHERE id = ?', [id]).grad, 'Novi Sad');
  assert.equal(b.jedan('SELECT * FROM klubovi WHERE id = ?', [999]), null);
  assert.equal(b.vrednost('SELECT COUNT(*) FROM klubovi'), 1);
  assert.equal(b.svi('SELECT * FROM klubovi').length, 1);
  assert.throws(() => b.transakcija(x => { x.ubaci('klubovi', { puno_ime: 'Dva', skracenica: 'DVA', kreirano: sad, izmenjeno: sad }); throw new Error('stop'); }), /stop/);
  assert.equal(b.vrednost('SELECT COUNT(*) FROM klubovi'), 1, 'transakcija je vracena');
  assert.throws(() => b.ubaci('klubovi', { puno_ime: 'Tri', skracenica: 'JED', kreirano: sad, izmenjeno: sad }), /UNIQUE/);
  assert.throws(() => b.ubaci('takmicari', { id_broj: 'x', ime: 'a', prezime: 'b', godina_rodjenja: 2010, pol: 'Z', klub_id: 77, kreirano: sad, izmenjeno: sad }), /FOREIGN KEY/);
  b.zatvori();
});

test('ocene su celi brojevi u hiljaditim delovima', () => {
  const b = otvori(':memory:'); b.migriraj();
  const sad = Baza.sad();
  const klub = b.ubaci('klubovi', { puno_ime: 'Klub', skracenica: 'KLB', kreirano: sad, izmenjeno: sad });
  const takmicar = b.ubaci('takmicari', { id_broj: 'T1', ime: 'Ana', prezime: 'Anic', godina_rodjenja: 2012, pol: 'Z', klub_id: klub, kreirano: sad, izmenjeno: sad });
  const takmicenje = b.ubaci('takmicenja', { naziv: 'Kup', datum: '2026-11-01', kreirano: sad, izmenjeno: sad });
  const prijava = b.ubaci('prijave', { takmicenje_id: takmicenje, takmicar_id: takmicar, klub_id: klub, kreirano: sad, izmenjeno: sad });
  const sprava = b.ubaci('sprave', { pol: 'Z', naziv: 'Preskok', skracenica: 'PRE', kreirano: sad, izmenjeno: sad });
  b.ubaci('prijava_sprave', { prijava_id: prijava, sprava_id: sprava });
  b.ubaci('ocene', { prijava_id: prijava, sprava_id: sprava, konacna: 13050, kreirano: sad, izmenjeno: sad });
  const k = b.vrednost('SELECT konacna FROM ocene WHERE prijava_id = ?', [prijava]);
  assert.equal(typeof k, 'number');
  assert.equal(k, 13050);
  b.zatvori();
});

test('zatvori brise WAL i fajl baze se ponovo otvara sa podacima', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-baza-'));
  try {
    const putanja = path.join(dir, 'gimnastika.sqlite');
    const b = otvori(putanja); b.migriraj();
    const sad = Baza.sad();
    b.ubaci('klubovi', { puno_ime: 'Klub WAL', skracenica: 'WAL', kreirano: sad, izmenjeno: sad });
    b.zatvori();
    const wal = putanja + '-wal';
    assert.ok(!fs.existsSync(wal) || fs.statSync(wal).size === 0, 'WAL je prazan ili ne postoji');
    const b2 = otvori(putanja);
    assert.equal(b2.vrednost('SELECT puno_ime FROM klubovi'), 'Klub WAL');
    b2.zatvori();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('migracija 007: sacuvano "samo upozorenje" za lekarski postaje "ne prati se", "sprecava prijavu" ostaje', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const b = otvori(':memory:');
  const fascikla = path.join(__dirname, '..', 'electron', 'baza', 'migracije');
  b.db.exec('CREATE TABLE IF NOT EXISTS migracije (ime TEXT PRIMARY KEY, primenjeno TEXT)');
  for (const f of fs.readdirSync(fascikla).filter((x) => /^00[1-6]_/.test(x) && x.endsWith('.sql')).sort()) {
    b.db.exec(fs.readFileSync(path.join(fascikla, f), 'utf8'));
    b.ubaci('migracije', { ime: f.slice(0, -'.sql'.length), primenjeno: 'x' });
  }
  for (const [kljuc, vrednost] of [['lekarski_sprecava_prijavu', 'ne'], ['lekarski_sprecava_prijavu_M', 'ne'], ['lekarski_sprecava_prijavu_Z', 'da'], ['lekarski_prag_dana', '30']]) {
    b.ubaci('podesavanja', { kljuc, vrednost });
  }
  assert.deepEqual(b.migriraj(), ['007_lekarski_ne_prati', '008_turnus']);
  const p = Object.fromEntries(b.svi('SELECT kljuc, vrednost FROM podesavanja').map((r) => [r.kljuc, r.vrednost]));
  assert.deepEqual(p, { lekarski_sprecava_prijavu: 'ne_prati', lekarski_sprecava_prijavu_M: 'ne_prati', lekarski_sprecava_prijavu_Z: 'da', lekarski_prag_dana: '30' });
  b.zatvori();
});

test('migracija 008: postojece grupe dobijaju turnus 1', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const b = otvori(':memory:');
  const fascikla = path.join(__dirname, '..', 'electron', 'baza', 'migracije');
  b.db.exec('CREATE TABLE IF NOT EXISTS migracije (ime TEXT PRIMARY KEY, primenjeno TEXT)');
  for (const f of fs.readdirSync(fascikla).filter((x) => /^00[1-7]_/.test(x) && x.endsWith('.sql')).sort()) {
    b.db.exec(fs.readFileSync(path.join(fascikla, f), 'utf8'));
    b.ubaci('migracije', { ime: f.slice(0, -'.sql'.length), primenjeno: 'x' });
  }
  const S = '2026-01-01 00:00:00';
  b.izvrsi("INSERT INTO takmicenja (id, naziv, datum, pol, kreirano, izmenjeno) VALUES (1, 'Kup', '2026-11-01', 'M', ?, ?)", [S, S]);
  b.izvrsi("INSERT INTO grupe (id, takmicenje_id, pol, naziv, redosled, pocetna_pozicija, kreirano, izmenjeno) VALUES (1, 1, 'M', 'Grupa A', 1, 3, ?, ?)", [S, S]);
  assert.deepEqual(b.migriraj(), ['008_turnus']);
  assert.deepEqual({ ...b.jedan('SELECT naziv, pocetna_pozicija, turnus FROM grupe WHERE id = 1') },
    { naziv: 'Grupa A', pocetna_pozicija: 3, turnus: 1 });
  b.zatvori();
});
