const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi } = require('../electron/modeli/objava.cjs');

const S = '2026-01-01 00:00:00';

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  return { baza, o: napravi(baza) };
}

const tak = (baza, naziv) => baza.ubaci('takmicenja', { naziv, datum: '15.03.2027.', pol: 'Z', kreirano: S, izmenjeno: S });

// Klub, takmicar, kategorija, program, prijava (sa spravom, ocenom i grupom) za takmicenje.
function ceo(baza, tid, oznaka, sprava) {
  const klub = baza.ubaci('klubovi', { puno_ime: 'Klub ' + oznaka, skracenica: oznaka, kreirano: S, izmenjeno: S });
  const t = baza.ubaci('takmicari', { id_broj: oznaka, ime: 'A' + oznaka, prezime: 'B', godina_rodjenja: 2012, pol: 'Z', klub_id: klub, kreirano: S, izmenjeno: S });
  const kat = baza.ubaci('kategorije', { naziv: 'K' + oznaka, pol: 'Z', kreirano: S, izmenjeno: S });
  const prog = baza.ubaci('programi', { naziv: 'P' + oznaka, pol: 'Z', kreirano: S, izmenjeno: S });
  const p = baza.ubaci('prijave', { takmicenje_id: tid, takmicar_id: t, klub_id: klub, kategorija_id: kat, program_id: prog, kreirano: S, izmenjeno: S });
  baza.ubaci('prijava_sprave', { prijava_id: p, sprava_id: sprava });
  const oc = baza.ubaci('ocene', { prijava_id: p, sprava_id: sprava, kreirano: S, izmenjeno: S });
  baza.ubaci('ocene_e', { ocena_id: oc, sudija: 1, vrednost: 8000 });
  const g = baza.ubaci('grupe', { takmicenje_id: tid, pol: 'Z', naziv: 'G' + oznaka, kreirano: S, izmenjeno: S });
  baza.ubaci('grupa_clanovi', { grupa_id: g, prijava_id: p, redosled: 1 });
  baza.ubaci('grupa_redosled', { grupa_id: g, rotacija: 1, prijava_id: p, redosled: 1 });
  return { klub, t, kat, prog, p, oc, g };
}

const sprava = (baza, naziv, sk) => baza.ubaci('sprave', { pol: 'Z', naziv, skracenica: sk, kreirano: S, izmenjeno: S });

test('redoviTakmicenja: samo ono sto takmicenje koristi', () => {
  const { baza, o } = nova();
  const s1 = sprava(baza, 'Preskok', 'PR');
  const s2 = sprava(baza, 'Greda', 'GR');
  const t1 = tak(baza, 'Prvo');
  const t2 = tak(baza, 'Drugo');
  const a = ceo(baza, t1, 'A', s1);
  const b = ceo(baza, t2, 'B', s2);

  const r = o.redoviTakmicenja(t1);
  assert.equal(r.takmicenje.id, t1);
  assert.deepEqual(r.klubovi.map((x) => x.id), [a.klub]);
  assert.deepEqual(r.takmicari.map((x) => x.id), [a.t]);
  assert.deepEqual(r.kategorije.map((x) => x.id), [a.kat]);
  assert.deepEqual(r.programi.map((x) => x.id), [a.prog]);
  assert.deepEqual(r.sprave.map((x) => x.id), [s1]);
  assert.deepEqual(r.prijave.map((x) => x.id), [a.p]);
  assert.deepEqual(r.prijavaSprave.map((x) => ({ ...x })), [{ prijava_id: a.p, sprava_id: s1 }]);
  assert.deepEqual(r.grupe.map((x) => x.id), [a.g]);
  assert.deepEqual(r.clanovi.map((x) => x.prijava_id), [a.p]);
  assert.deepEqual(r.redosledi.map((x) => x.prijava_id), [a.p]);
  assert.deepEqual(r.ocene.map((x) => x.id), [a.oc]);
  assert.deepEqual(r.oceneE.map((x) => x.ocena_id), [a.oc]);
  assert.ok(!r.klubovi.some((x) => x.id === b.klub));
  assert.ok(!r.takmicari.some((x) => x.id === b.t));
});

test('redoviTakmicenja: klub takmicara ulazi ako ga koristi takmicar ili prijava', () => {
  const { baza, o } = nova();
  const s = sprava(baza, 'Preskok', 'PR');
  const t1 = tak(baza, 'Prvo');
  const a = ceo(baza, t1, 'A', s);
  const drugi = baza.ubaci('klubovi', { puno_ime: 'Drugi', skracenica: 'DR', kreirano: S, izmenjeno: S });
  baza.izvrsi('UPDATE takmicari SET klub_id = ? WHERE id = ?', [drugi, a.t]);
  const ids = o.redoviTakmicenja(t1).klubovi.map((x) => x.id).sort();
  assert.deepEqual(ids, [a.klub, drugi].sort());
});

test('redoviTakmicenja: takmicenje bez prijava daje prazne nizove', () => {
  const { baza, o } = nova();
  const t = tak(baza, 'Prazno');
  const r = o.redoviTakmicenja(t);
  assert.equal(r.takmicenje.naziv, 'Prazno');
  for (const k of ['klubovi', 'takmicari', 'kategorije', 'programi', 'sprave', 'prijave', 'prijavaSprave', 'grupe',
    'clanovi', 'redosledi', 'ocene', 'oceneE']) {
    assert.deepEqual(r[k], [], k);
  }
});

test('redoviTakmicenja: nepostojece takmicenje baca gresku', () => {
  const { o } = nova();
  assert.throws(() => o.redoviTakmicenja(999));
});
