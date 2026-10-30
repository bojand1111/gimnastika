const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori, Baza } = require('../electron/baza/baza.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { napravi } = require('../electron/modeli/takmicari.cjs');

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  return { baza, t: napravi(baza) };
}

function ispravan(izmena = {}) {
  return { id_broj: '00203', ime: 'Ana', prezime: 'Petrović', godina_rodjenja: '2012', pol: 'Z', ...izmena };
}

function ubaciIdBroj(baza, idBroj) {
  const sad = Baza.sad();
  baza.ubaci('takmicari', { id_broj: idBroj, ime: 'A', prezime: 'B', godina_rodjenja: 2012, pol: 'Z', kreirano: sad, izmenjeno: sad });
}

test('sledeciIdBroj: prazna baza daje 00001', () => {
  const { t } = nova();
  assert.equal(t.sledeciIdBroj(), '00001');
});

test('sledeciIdBroj: 001..004 i 099 daje 100', () => {
  const { baza, t } = nova();
  for (const x of ['001', '002', '003', '004', '099']) ubaciIdBroj(baza, x);
  assert.equal(t.sledeciIdBroj(), '100');
});

test('sledeciIdBroj: preskace id koji nisu samo cifre, preliv duzine', () => {
  const { baza, t } = nova();
  ubaciIdBroj(baza, 'A7');
  ubaciIdBroj(baza, '99999');
  assert.equal(t.sledeciIdBroj(), '100000');
});

test('proveri: prazan objekat daje 5 poruka tim redom', () => {
  const { t } = nova();
  assert.deepEqual(t.proveri({}, null), [
    'ID broj je obavezan.', 'Ime je obavezno.', 'Prezime je obavezno.',
    'Godina rođenja nije ispravna.', 'Izaberite pol.',
  ]);
});

test('proveri: ispravan unos nema poruka', () => {
  const { t } = nova();
  assert.deepEqual(t.proveri(ispravan(), null), []);
});

test('proveri: godina van opsega i pol', () => {
  const { t } = nova();
  const iduca = String(new Date().getFullYear() + 1);
  assert.deepEqual(t.proveri(ispravan({ godina_rodjenja: iduca }), null), ['Godina rođenja nije ispravna.']);
  assert.deepEqual(t.proveri(ispravan({ godina_rodjenja: '1899' }), null), ['Godina rođenja nije ispravna.']);
  assert.deepEqual(t.proveri(ispravan({ godina_rodjenja: 'abc' }), null), ['Godina rođenja nije ispravna.']);
  assert.deepEqual(t.proveri(ispravan({ pol: 'm' }), null), ['Izaberite pol.']);
});

test('proveri: duplikat id_broj (trim, velika/mala), ne i za isti id', () => {
  const { t } = nova();
  const id = t.sacuvaj(ispravan(), null);
  assert.deepEqual(t.proveri(ispravan({ id_broj: ' 00203 ' }), null), ['ID broj 00203 već postoji.']);
  assert.deepEqual(t.proveri(ispravan({ id_broj: ' 00203 ' }), id), []);
  t.sacuvaj(ispravan({ id_broj: 'a1' }), null);
  assert.deepEqual(t.proveri(ispravan({ id_broj: 'A1' }), null), ['ID broj A1 već postoji.']);
});

test('proveri: klub koji ne postoji', () => {
  const { baza, t } = nova();
  assert.deepEqual(t.proveri(ispravan({ klub_id: '999' }), null), ['Klub ne postoji.']);
  const sad = Baza.sad();
  const k = baza.ubaci('klubovi', { puno_ime: 'Klub', skracenica: 'KLB', grad: '', kreirano: sad, izmenjeno: sad });
  assert.deepEqual(t.proveri(ispravan({ klub_id: String(k) }), null), []);
  assert.deepEqual(t.proveri(ispravan({ klub_id: '' }), null), []);
  assert.deepEqual(t.proveri(ispravan({ klub_id: null }), null), []);
});

test('proveri: neispravan datum lekarskog', () => {
  const { t } = nova();
  assert.deepEqual(t.proveri(ispravan({ lekarski_do: '31.02.2027' }), null), ['Datum lekarskog nije ispravan (dd.mm.gggg).']);
  assert.deepEqual(t.proveri(ispravan({ lekarski_do: '' }), null), []);
});

test('sacuvaj: lekarski 25.10.2026. se cuva kao 2026-10-25, defaulti, filtriranje', () => {
  const { t } = nova();
  const id = t.sacuvaj(ispravan({ lekarski_do: '25.10.2026.', drzavljanstvo: '', nepoznato: 'x' }), null);
  const r = t.nadji(id);
  assert.equal(r.lekarski_do, '2026-10-25');
  assert.equal(r.drzavljanstvo, 'Srbija');
  assert.equal(r.godina_rodjenja, 2012);
  assert.equal(r.klub_id, null);
  assert.equal(r.nepoznato, undefined);
  assert.ok(r.kreirano && r.izmenjeno);
});

test('sacuvaj: bez lekarskog cuva null, izmena vraca isti id', () => {
  const { t } = nova();
  const id = t.sacuvaj(ispravan(), null);
  assert.equal(t.nadji(id).lekarski_do, null);
  assert.equal(t.sacuvaj(ispravan({ ime: 'Bea' }), id), id);
  assert.equal(t.nadji(id).ime, 'Bea');
});

test('sacuvaj: greske se spajaju u GreskaKorisnika', () => {
  const { t } = nova();
  assert.throws(() => t.sacuvaj({}, null), (e) => e instanceof GreskaKorisnika
    && e.message === 'ID broj je obavezan. Ime je obavezno. Prezime je obavezno. Godina rođenja nije ispravna. Izaberite pol.');
});

test('svi: sortirano po prezimenu pa imenu, sa klubom', () => {
  const { baza, t } = nova();
  const sad = Baza.sad();
  const k = baza.ubaci('klubovi', { puno_ime: 'Beograd', skracenica: 'BGD', grad: '', kreirano: sad, izmenjeno: sad });
  t.sacuvaj(ispravan({ id_broj: '1', prezime: 'Đorđević', ime: 'Ana' }), null);
  t.sacuvaj(ispravan({ id_broj: '2', prezime: 'Dragić', ime: 'Zora', klub_id: String(k) }), null);
  t.sacuvaj(ispravan({ id_broj: '3', prezime: 'Dragić', ime: 'Bea' }), null);
  const r = t.svi();
  assert.deepEqual(r.map(x => `${x.prezime} ${x.ime}`), ['Dragić Bea', 'Dragić Zora', 'Đorđević Ana']);
  assert.equal(r[1].klub_skr, 'BGD');
  assert.equal(r[1].klub_ime, 'Beograd');
  assert.equal(r[0].klub_skr, null);
});

test('nadji: nepostojeci id daje prazno, postojeci ima klub_skr', () => {
  const { t } = nova();
  assert.ok(!t.nadji(123));
  const id = t.sacuvaj(ispravan(), null);
  assert.equal(t.nadji(id).id_broj, '00203');
});

test('obrisi: bez prijava brise, sa prijavom baca poruku sa brojem', () => {
  const { baza, t } = nova();
  const a = t.sacuvaj(ispravan({ id_broj: '1' }), null);
  const b = t.sacuvaj(ispravan({ id_broj: '2' }), null);
  t.obrisi(a);
  assert.ok(!t.nadji(a));
  const sad = Baza.sad();
  const tk = baza.ubaci('takmicenja', { naziv: 'T', datum: '2026-10-25', mesto: 'M', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje', ekipno_broji: 3, kreirano: sad, izmenjeno: sad });
  baza.ubaci('prijave', { takmicenje_id: tk, takmicar_id: b, kreirano: sad, izmenjeno: sad });
  assert.throws(() => t.obrisi(b), (e) => e instanceof GreskaKorisnika
    && e.message === 'Takmičar ima 1 prijava na takmičenjima i ne može se obrisati.');
  assert.ok(t.nadji(b));
});

function prijaviNa(baza, takmicarId) {
  const sad = Baza.sad();
  const tk = baza.ubaci('takmicenja', { naziv: 'T', datum: '2026-10-25', mesto: 'M', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje', ekipno_broji: 3, pol: 'Z', kreirano: sad, izmenjeno: sad });
  baza.ubaci('prijave', { takmicenje_id: tk, takmicar_id: takmicarId, kreirano: sad, izmenjeno: sad });
}

test('svi: bez argumenta svi, sa polom samo taj pol', () => {
  const { t } = nova();
  const z = t.sacuvaj(ispravan({ id_broj: '1', pol: 'Z' }), null);
  const m = t.sacuvaj(ispravan({ id_broj: '2', pol: 'M' }), null);
  assert.deepEqual(t.svi().map((r) => r.id).sort(), [z, m].sort());
  assert.deepEqual(t.svi(null).map((r) => r.id).sort(), [z, m].sort());
  assert.deepEqual(t.svi('Z').map((r) => r.id), [z]);
  assert.deepEqual(t.svi('M').map((r) => r.id), [m]);
});

test('pol se ne menja ako ima prijave', () => {
  const { baza, t } = nova();
  const id = t.sacuvaj(ispravan({ pol: 'Z' }), null);
  prijaviNa(baza, id);
  assert.throws(() => t.sacuvaj(ispravan({ pol: 'M' }), id), (e) => e instanceof GreskaKorisnika
    && e.message === 'Takmičar ima prijave, pa mu se pol ne može promeniti.');
  assert.equal(t.nadji(id).pol, 'Z');
  // isti pol i druga polja se i dalje cuvaju
  t.sacuvaj(ispravan({ pol: 'Z', ime: 'Bea' }), id);
  assert.equal(t.nadji(id).ime, 'Bea');
});

test('pol se menja bez prijava', () => {
  const { t } = nova();
  const id = t.sacuvaj(ispravan({ pol: 'Z' }), null);
  t.sacuvaj(ispravan({ pol: 'M' }), id);
  assert.equal(t.nadji(id).pol, 'M');
});
