const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori, Baza } = require('../electron/baza/baza.cjs');

test('migracije na praznoj bazi prave sve tabele i ponovo ne rade nista', () => {
  const b = otvori(':memory:');
  assert.equal(b.naCekanju().length, 5);
  const prvi = b.migriraj();
  assert.deepEqual(prvi, ['001_pocetna', '002_takmicenje_grb_domacin', '003_potvrde_klubova', '004_redosled_po_rotaciji', '005_pol_po_delu']);
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
