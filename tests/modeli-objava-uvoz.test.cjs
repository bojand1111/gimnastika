const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviPrijave } = require('../electron/modeli/prijave.cjs');
const { napravi: napraviOcene } = require('../electron/modeli/ocene.cjs');
const { napravi: napraviRezultate } = require('../electron/modeli/rezultati.cjs');
const { napravi: napraviTakmicare } = require('../electron/modeli/takmicari.cjs');
const { napravi } = require('../electron/modeli/objava.cjs');
const { napraviObjavu } = require('../electron/racun/objava-format.mjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const S = '2026-01-01 00:00:00';
const UID = 'a1b2c3d4-0000-4000-8000-000000000001';
const TABELE = ['klubovi', 'takmicari', 'kategorije', 'programi', 'sprave', 'takmicenja', 'prijave', 'prijava_sprave', 'grupe',
  'grupa_clanovi', 'grupa_redosled', 'ocene', 'ocene_e', 'uvezene_objave', 'podesavanja'];

function prazna() {
  const baza = otvori(':memory:');
  baza.migriraj();
  pocetniPodaci(baza);
  return baza;
}

const ubaci = (baza, tabela, red) => baza.ubaci(tabela, { ...red, kreirano: S, izmenjeno: S });
const sprava = (baza, sk) => baza.vrednost("SELECT id FROM sprave WHERE pol = 'Z' AND skracenica = ?", [sk]);
const brojevi = (baza) => Object.fromEntries(TABELE.map((t) => [t, Number(baza.vrednost(`SELECT COUNT(*) FROM ${t}`))]));
const uvezi = (baza, o) => napravi(baza).uvezi(o, { verzija: '1.2.9', sad: '2026-11-13 10:00:00' });
const objava = (baza, tid, uid = UID) => JSON.parse(JSON.stringify(
  napraviObjavu(napravi(baza).redoviTakmicenja(tid), { uid, verzija: '1.2.9', sad: '2026-11-13 09:00:00' })));

// Izvorna baza: dva kluba, tri takmicara Z, jedna kategorija i program, ocene sa nacrtom i null poljima.
function izvor() {
  const baza = prazna();
  const k1 = ubaci(baza, 'klubovi', { puno_ime: 'Klub Jedan', skracenica: 'JED', grad: 'Nis' });
  const k2 = ubaci(baza, 'klubovi', { puno_ime: 'Klub Dva', skracenica: 'DVA' });
  const kat = ubaci(baza, 'kategorije', { naziv: 'Kadet', pol: 'Z', redosled: 1 });
  const prog = ubaci(baza, 'programi', { naziv: 'C', pol: 'Z', redosled: 1 });
  const tak = ubaci(baza, 'takmicenja', { naziv: 'Kup', datum: '17.10.2026.', pol: 'Z', mesto: 'NS', zavrseno: 0 });
  const takmicar = (broj, ime, prezime, klub) => ubaci(baza, 'takmicari', { id_broj: broj, ime, prezime, godina_rodjenja: 2012, pol: 'Z', klub_id: klub });
  const ana = takmicar('001', 'Ana', 'Anic', k1);
  const bea = takmicar('002', 'Bea', 'Bebic', k2);
  const ceca = takmicar('003', 'Ceca', 'Cecic', null);
  const prijava = (t, klub, k, p) => ubaci(baza, 'prijave', { takmicenje_id: tak, takmicar_id: t, klub_id: klub, kategorija_id: k, program_id: p });
  const pa = prijava(ana, k1, kat, prog);
  const pb = prijava(bea, k2, kat, prog);
  const pc = prijava(ceca, null, null, null);
  const pr = sprava(baza, 'PR');
  for (const p of [pa, pb, pc]) baza.ubaci('prijava_sprave', { prijava_id: p, sprava_id: pr });
  const oc = ubaci(baza, 'ocene', { prijava_id: pa, sprava_id: pr, d: 4000, e: 8000, bonus: null, odbitak: 100, konacna: 11900, status: 'potvrdjena', uneto_u: S });
  baza.ubaci('ocene_e', { ocena_id: oc, sudija: 1, vrednost: 8000 });
  baza.ubaci('ocene_e', { ocena_id: oc, sudija: 2, vrednost: null });
  ubaci(baza, 'ocene', { prijava_id: pb, sprava_id: pr, status: 'nacrt' });
  const g = ubaci(baza, 'grupe', { takmicenje_id: tak, pol: 'Z', naziv: 'G1', redosled: 1, turnus: 2 });
  baza.ubaci('grupa_clanovi', { grupa_id: g, prijava_id: pa, redosled: 1 });
  baza.ubaci('grupa_clanovi', { grupa_id: g, prijava_id: pb, redosled: 2 });
  baza.ubaci('grupa_redosled', { grupa_id: g, rotacija: 1, prijava_id: pb, redosled: 1 });
  return { baza, tak, ids: { k1, k2, kat, prog, ana, bea, ceca, pa, pb, pc } };
}

// Rezultati kao tekst: bez id-jeva, pa se baze sa razlicitim id-jevima mogu porediti.
function sazetak(baza, tid) {
  const r = napraviRezultate(baza, napraviPodesavanja(baza, ''));
  const takm = baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [tid]);
  const ime = (pid) => {
    const t = baza.jedan('SELECT t.ime, t.prezime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.id = ?', [pid]);
    return t.ime + ' ' + t.prezime;
  };
  return r.kombinacije(tid).map((k) => {
    const x = r.izracunaj(takm, k.pol, k.kategorija_id, k.program_id);
    return {
      kombinacija: [k.pol, k.kategorija, k.program],
      sprave: x.sprave.filter((s) => (x.po_spravi[s.id] ?? []).length > 0).map((s) => ({ sk: s.skracenica, red: x.po_spravi[s.id].map((v) => [ime(v.prijava), v.mesto, v.oznaka, v.status]) })),
      viseboj: x.viseboj.map((v) => [ime(v.prijava), v.mesto, v.zbir, v.oznaka]),
      ekipno: x.ekipno.map((e) => [e.klub.skracenica, e.ukupno, e.mesto]),
    };
  });
}

test('uvoz u praznu bazu daje iste rezultate', () => {
  const A = otvori(':memory:');
  A.migriraj();
  const s = tokSeme(A);
  const podA = napraviPodesavanja(A, '');
  const prijave = napraviPrijave(A, podA);
  prijave.dodajVise(s.takm, [s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona]);
  const pid = {};
  for (const r of A.svi('SELECT p.id, t.ime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.takmicenje_id = ?', [s.takm])) pid[r.ime] = r.id;
  for (const ime of ['Ana', 'Bea', 'Ceca', 'Dona']) prijave.izmeniPolje(s.takm, pid[ime], 'clan_ekipe', true);
  prijave.izmeniPolje(s.takm, pid.Ceca, 'van_konkurencije', true);
  const oc = napraviOcene(A, podA);
  const unos = (ime, sp, d, e) => oc.sacuvaj(s.takm, pid[ime], sp, { d, e: [e, e, e, e], odbitak: '' }, true);
  unos('Ana', s.pr, '4,0', '8,0');
  unos('Ana', s.gr, '4,0', '8,5');
  unos('Bea', s.pr, '4,0', '8,0');
  unos('Bea', s.gr, '4,0', '7,0');
  unos('Ceca', s.pr, '5,0', '8,0');
  unos('Dona', s.pr, '3,0', '8,0');
  oc.odustao(s.takm, pid.Dona, s.gr);

  const B = prazna();
  const rez = uvezi(B, objava(A, s.takm));
  assert.equal(rez.stanje, 'uvezeno');
  const pre = sazetak(A, s.takm);
  assert.ok(pre.length > 0 && pre[0].viseboj.length > 0);
  assert.deepEqual(sazetak(B, rez.takmicenje_id), pre);
});

test('postojeci klub i takmicar se uparuju, nista se ne menja', () => {
  const { baza: A, tak } = izvor();
  const o = objava(A, tak);
  const B = prazna();
  // isti klub pod drugim punim imenom i istom skracenicom; takmicar sa zamenjenim imenom i prezimenom
  const kb = ubaci(B, 'klubovi', { puno_ime: 'Drugo ime kluba', skracenica: 'jed', grad: 'Beograd' });
  const tb = ubaci(B, 'takmicari', { id_broj: '77', ime: 'Anic', prezime: 'Ana', godina_rodjenja: 2012, pol: 'Z', klub_id: null, trener: 'T' });
  const klubPre = B.svi('SELECT * FROM klubovi ORDER BY id');
  const takPre = B.svi('SELECT * FROM takmicari ORDER BY id');

  const rez = uvezi(B, o);
  assert.equal(rez.stanje, 'uvezeno');
  for (const r of klubPre) assert.deepEqual(B.jedan('SELECT * FROM klubovi WHERE id = ?', [r.id]), r);
  for (const r of takPre) assert.deepEqual(B.jedan('SELECT * FROM takmicari WHERE id = ?', [r.id]), r);
  assert.equal(B.vrednost("SELECT COUNT(*) FROM klubovi WHERE skracenica IN ('JED', 'jed')"), 1);
  assert.equal(B.vrednost('SELECT COUNT(*) FROM takmicari WHERE ime IN (?, ?)', ['Ana', 'Anic']), 1);
  const prijava = B.jedan('SELECT * FROM prijave WHERE takmicenje_id = ? AND takmicar_id = ?', [rez.takmicenje_id, tb]);
  assert.equal(prijava.klub_id, kb);
  // ostala dva takmicara i klub DVA su novi
  assert.equal(B.vrednost('SELECT COUNT(*) FROM takmicari'), 3);
  assert.equal(B.vrednost('SELECT COUNT(*) FROM klubovi'), 2);
});

test('isto ime u fajlu dvaput: jedan se upari, drugi nov', () => {
  const { baza: A, tak, ids } = izvor();
  const drugi = ubaci(A, 'takmicari', { id_broj: '004', ime: 'Ana', prezime: 'Anic', godina_rodjenja: 2012, pol: 'Z', klub_id: ids.k1 });
  ubaci(A, 'prijave', { takmicenje_id: tak, takmicar_id: drugi, klub_id: ids.k1 });
  const o = objava(A, tak);
  const B = prazna();
  const lokalni = ubaci(B, 'takmicari', { id_broj: '5', ime: 'Ana', prezime: 'Anic', godina_rodjenja: 2012, pol: 'Z' });

  const rez = uvezi(B, o);
  assert.equal(rez.stanje, 'uvezeno');
  const ane = B.svi("SELECT id FROM takmicari WHERE ime = 'Ana' ORDER BY id");
  assert.equal(ane.length, 2);
  assert.equal(ane[0].id, lokalni);
  assert.equal(B.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicenje_id = ?', [rez.takmicenje_id]), 4);
});

test('bez kluba i bez kategorije: null ostaje null', () => {
  const { baza: A, tak } = izvor();
  const B = prazna();
  const rez = uvezi(B, objava(A, tak));
  const ceca = B.jedan("SELECT id, klub_id FROM takmicari WHERE ime = 'Ceca'");
  assert.equal(ceca.klub_id, null);
  const p = B.jedan('SELECT * FROM prijave WHERE takmicenje_id = ? AND takmicar_id = ?', [rez.takmicenje_id, ceca.id]);
  assert.equal(p.klub_id, null);
  assert.equal(p.kategorija_id, null);
  assert.equal(p.program_id, null);
});

test('nacrt ocene ostaje null, ocene su celi brojevi', () => {
  const { baza: A, tak } = izvor();
  const B = prazna();
  const rez = uvezi(B, objava(A, tak));
  const prijavaOd = (ime) => B.jedan('SELECT p.id FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE t.ime = ? AND p.takmicenje_id = ?', [ime, rez.takmicenje_id]).id;
  const nacrt = B.jedan('SELECT * FROM ocene WHERE prijava_id = ?', [prijavaOd('Bea')]);
  assert.equal(nacrt.status, 'nacrt');
  for (const k of ['d', 'e', 'bonus', 'odbitak', 'konacna', 'uneto_u']) assert.equal(nacrt[k], null, k);
  const ocena = B.jedan('SELECT * FROM ocene WHERE prijava_id = ?', [prijavaOd('Ana')]);
  assert.deepEqual([ocena.d, ocena.e, ocena.odbitak, ocena.konacna, ocena.bonus, ocena.status], [4000, 8000, 100, 11900, null, 'potvrdjena']);
  assert.deepEqual(B.svi('SELECT sudija, vrednost FROM ocene_e WHERE ocena_id = ? ORDER BY sudija', [ocena.id]).map((r) => ({ ...r })),
    [{ sudija: 1, vrednost: 8000 }, { sudija: 2, vrednost: null }]);
});

test('nova kategorija ide na kraj redosleda', () => {
  const { baza: A, tak } = izvor();
  const B = prazna();
  ubaci(B, 'kategorije', { naziv: 'Ostala', pol: 'Z', redosled: 7 });
  ubaci(B, 'kategorije', { naziv: 'Muska', pol: 'M', redosled: 9 });
  uvezi(B, objava(A, tak));
  assert.equal(B.vrednost("SELECT redosled FROM kategorije WHERE naziv = 'Kadet' AND pol = 'Z'"), 8);
  assert.equal(B.vrednost("SELECT redosled FROM programi WHERE naziv = 'C' AND pol = 'Z'"), 1);
});

test('id_broj novog je U<8>-n i sledeciIdBroj se ne menja', () => {
  const { baza: A, tak } = izvor();
  const B = prazna();
  ubaci(B, 'takmicari', { id_broj: '00041', ime: 'X', prezime: 'Y', godina_rodjenja: 2000, pol: 'M' });
  const t = napraviTakmicare(B);
  const pre = t.sledeciIdBroj();
  uvezi(B, objava(A, tak));
  const novi = B.svi("SELECT id_broj FROM takmicari WHERE id_broj LIKE 'U%' ORDER BY id").map((r) => r.id_broj);
  assert.deepEqual(novi, ['Ua1b2c3d4-1', 'Ua1b2c3d4-2', 'Ua1b2c3d4-3']);
  assert.equal(t.sledeciIdBroj(), pre);
});

test('nema sprave: odbijeno, red u uvezene_objave, bez podataka', () => {
  const { baza: A, tak } = izvor();
  const o = objava(A, tak);
  const B = prazna();
  B.izvrsi("DELETE FROM sprave WHERE pol = 'Z' AND skracenica = 'PR'");
  const pre = brojevi(B);
  const rez = uvezi(B, o);
  assert.equal(rez.stanje, 'odbijeno');
  assert.equal(rez.takmicenje_id, null);
  assert.match(rez.poruka, /PR/);
  const red = B.jedan('SELECT * FROM uvezene_objave WHERE uid = ?', [UID]);
  assert.equal(red.stanje, 'odbijeno');
  assert.equal(red.takmicenje_id, null);
  assert.equal(red.naziv, 'Kup');
  assert.equal(red.pol, 'Z');
  assert.equal(red.izvor_verzija, '1.2.9');
  assert.deepEqual(brojevi(B), { ...pre, uvezene_objave: 1 });
});

test('proveri: greska formata i sprava bez upisa', () => {
  const { baza: A, tak } = izvor();
  const o = objava(A, tak);
  const B = prazna();
  const m = napravi(B);
  assert.deepEqual(m.proveri(o), []);
  assert.ok(m.proveri({ ...o, uid: 'x' }).length > 0);
  assert.equal(brojevi(B).uvezene_objave, 0);
});

test('isti naziv, datum i pol: postoji', () => {
  const { baza: A, tak } = izvor();
  const B = prazna();
  const lokalno = ubaci(B, 'takmicenja', { naziv: ' KUP ', datum: '17.10.2026.', pol: 'Z' });
  ubaci(B, 'takmicenja', { naziv: 'Kup', datum: '17.10.2026.', pol: 'M' });
  const pre = brojevi(B);
  const rez = uvezi(B, objava(A, tak));
  assert.deepEqual([rez.stanje, rez.takmicenje_id], ['postoji', lokalno]);
  assert.deepEqual(brojevi(B), { ...pre, uvezene_objave: 1 });
  assert.equal(B.vrednost('SELECT stanje FROM uvezene_objave WHERE uid = ?', [UID]), 'postoji');
  assert.equal(B.vrednost('SELECT takmicenje_id FROM uvezene_objave WHERE uid = ?', [UID]), lokalno);
});

test('isti uid i drugi poziv: preskoceno', () => {
  const { baza: A, tak } = izvor();
  const o = objava(A, tak);
  const B = prazna();
  assert.equal(uvezi(B, o).stanje, 'uvezeno');
  const pre = brojevi(B);
  const drugi = uvezi(B, o);
  assert.deepEqual([drugi.stanje, drugi.takmicenje_id], ['preskoceno', null]);
  assert.deepEqual(brojevi(B), pre);
  // uid samo u takmicenja.uid (bez reda u uvezene_objave)
  const C = prazna();
  ubaci(C, 'takmicenja', { naziv: 'Neko drugo', datum: '01.01.2020.', pol: 'M', uid: UID });
  assert.equal(uvezi(C, o).stanje, 'preskoceno');
  assert.equal(napravi(C).vecObradjen(UID), true);
  assert.equal(napravi(C).vecObradjen('b1b2c3d4-0000-4000-8000-000000000002'), false);
});

test('takmicenje je zavrseno i nije aktivno', () => {
  const { baza: A, tak } = izvor();
  const B = prazna();
  ubaci(B, 'takmicenja', { naziv: 'Moje', datum: '01.01.2026.', pol: 'Z' });
  B.ubaci('podesavanja', { kljuc: 'aktivno_takmicenje_Z', vrednost: '1' });
  const rez = uvezi(B, objava(A, tak));
  const t = B.jedan('SELECT * FROM takmicenja WHERE id = ?', [rez.takmicenje_id]);
  assert.deepEqual([t.zavrseno, t.uid, t.grb_levo, t.grb_desno, t.mesto], [1, UID, '', '', 'NS']);
  assert.equal(B.vrednost("SELECT vrednost FROM podesavanja WHERE kljuc = 'aktivno_takmicenje_Z'"), '1');
  assert.equal(B.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc = 'aktivno_takmicenje_M'"), 0);
  assert.equal(B.vrednost('SELECT turnus FROM grupe WHERE takmicenje_id = ?', [rez.takmicenje_id]), 2);
  assert.equal(B.vrednost('SELECT stanje FROM uvezene_objave WHERE uid = ?', [UID]), 'uvezeno');
});

test('greska usred upisa vraca sve', () => {
  const { baza: A, tak } = izvor();
  const o = objava(A, tak);
  const B = prazna();
  ubaci(B, 'klubovi', { puno_ime: 'Postojeci', skracenica: 'PST' });
  const pre = brojevi(B);
  const original = B.ubaci.bind(B);
  B.ubaci = (tabela, podaci) => {
    if (tabela === 'ocene') throw new Error('probni kvar');
    return original(tabela, podaci);
  };
  assert.throws(() => uvezi(B, o), /probni kvar/);
  B.ubaci = original;
  assert.deepEqual(brojevi(B), pre);
  assert.equal(B.vrednost('SELECT COUNT(*) FROM uvezene_objave'), 0);
  // posle kvara moze ponovo
  assert.equal(uvezi(B, o).stanje, 'uvezeno');
});
