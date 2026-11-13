const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');

const S = '2026-01-01 00:00:00';

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  return baza;
}

function takmicenje(baza, uid) {
  const data = { naziv: 'Kup', datum: '15.03.2027.', kreirano: S, izmenjeno: S };
  if (uid !== undefined) data.uid = uid;
  return baza.ubaci('takmicenja', data);
}

test('migracija 009: uid, objave, uvezene_objave', () => {
  const baza = nova();

  const kolone = baza.svi('PRAGMA table_info(takmicenja)').map((k) => k.name);
  assert.ok(kolone.includes('uid'));
  const staro = takmicenje(baza);
  assert.equal(baza.vrednost('SELECT uid FROM takmicenja WHERE id = ?', [staro]), '');

  // prazan uid nije jedinstven
  takmicenje(baza, '');
  takmicenje(baza, '');
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM takmicenja WHERE uid = ?', ['']), 3);

  // neprazan uid jedinstven
  takmicenje(baza, 'abc-1');
  assert.throws(() => takmicenje(baza, 'abc-1'), /UNIQUE/);

  // objave
  baza.ubaci('objave', {
    takmicenje_id: staro, uid: 'abc-2', fajl: 'x.sbsta', stanje: 'ceka',
    poslednji_pokusaj: S, poslato: null,
  });
  const o = baza.jedan('SELECT * FROM objave WHERE takmicenje_id = ?', [staro]);
  assert.equal(o.uid, 'abc-2');
  assert.equal(o.poruka, '');
  assert.equal(o.poslato, null);

  // uvezene_objave
  baza.ubaci('uvezene_objave', { uid: 'u-1', stanje: 'uvezeno', vreme: S });
  const u = baza.jedan('SELECT * FROM uvezene_objave WHERE uid = ?', ['u-1']);
  assert.equal(u.takmicenje_id, null);
  assert.equal(u.poruka, '');
  assert.equal(u.izvor_verzija, '');
  assert.equal(u.naziv, '');
  assert.equal(u.pol, '');
  assert.equal(u.prikazano, 0);
});
