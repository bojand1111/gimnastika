const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori, Baza } = require('../electron/baza/baza.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { napravi, VRSTE, IKONE } = require('../electron/modeli/sifarnici.cjs');

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  return { baza, s: napravi(baza) };
}

function poruka(fn, tekst) {
  assert.throws(fn, (e) => e instanceof GreskaKorisnika && e.message === tekst);
}

function prijavaSa(baza, polja) {
  const sad = Baza.sad();
  const tk = baza.ubaci('takmicenja', { naziv: 'T', datum: '2026-10-25', pol: 'Z', kreirano: sad, izmenjeno: sad });
  const tm = baza.ubaci('takmicari', { id_broj: '1', ime: 'A', prezime: 'B', godina_rodjenja: 2012, pol: 'Z', kreirano: sad, izmenjeno: sad });
  return baza.ubaci('prijave', { takmicenje_id: tk, takmicar_id: tm, ...polja, kreirano: sad, izmenjeno: sad });
}

test('VRSTE i IKONE: tri liste, sve po polu, osam ikona', () => {
  assert.deepEqual(Object.keys(VRSTE), ['kategorije', 'programi', 'sprave']);
  assert.equal(VRSTE.sprave.naziv, 'Sprave');
  assert.equal(VRSTE.sprave.tabela, 'sprave');
  assert.equal(IKONE.length, 8);
});

test('meta: nepoznata vrsta baca poruku', () => {
  const { s } = nova();
  poruka(() => s.meta('x'), 'Nepoznata lista: x');
  poruka(() => s.meta('sprave_m'), 'Nepoznata lista: sprave_m');
  assert.equal(s.meta('programi').tabela, 'programi');
});

test('pol je obavezan i mora biti M ili Z', () => {
  const { s } = nova();
  for (const pol of [undefined, '', 'X']) {
    poruka(() => s.lista('kategorije', pol), 'Nepoznat pol.');
    poruka(() => s.dodaj('kategorije', { naziv: 'A' }, pol), 'Nepoznat pol.');
    poruka(() => s.redosled('kategorije', [], pol), 'Nepoznat pol.');
  }
});

test('kategorije: prazna lista, redosled 1 pa 2', () => {
  const { s } = nova();
  assert.deepEqual(s.lista('kategorije', 'Z'), []);
  const a = s.dodaj('kategorije', { naziv: 'Kadet' }, 'Z');
  const b = s.dodaj('kategorije', { naziv: ' Junior ' }, 'Z');
  assert.equal(s.nadji('kategorije', a).redosled, 1);
  assert.equal(s.nadji('kategorije', b).redosled, 2);
  assert.equal(s.nadji('kategorije', b).naziv, 'Junior');
  assert.deepEqual(s.lista('kategorije', 'Z').map((r) => r.id), [a, b]);
});

test('nova stavka sifarnika dobija pol, a redosled se broji po polu', () => {
  const { s } = nova();
  const z1 = s.dodaj('kategorije', { naziv: 'Kadet' }, 'Z');
  const z2 = s.dodaj('programi', { naziv: 'C' }, 'Z');
  const m1 = s.dodaj('kategorije', { naziv: 'Kadet' }, 'M');
  const m2 = s.dodaj('programi', { naziv: 'C' }, 'M');
  assert.equal(s.nadji('kategorije', z1).pol, 'Z');
  assert.equal(s.nadji('programi', z2).pol, 'Z');
  assert.equal(s.nadji('kategorije', m1).pol, 'M');
  assert.equal(s.nadji('programi', m2).pol, 'M');
  assert.equal(s.nadji('kategorije', m1).redosled, 1);
  const z3 = s.dodaj('kategorije', { naziv: 'Junior' }, 'Z');
  assert.equal(s.nadji('kategorije', z3).redosled, 2);
  assert.deepEqual(s.lista('kategorije', 'Z').map((r) => r.id), [z1, z3]);
  assert.deepEqual(s.lista('kategorije', 'M').map((r) => r.id), [m1]);
  assert.deepEqual(s.lista('programi', 'M').map((r) => r.id), [m2]);
});

test('dodaj: prazan naziv', () => {
  const { s } = nova();
  poruka(() => s.dodaj('programi', { naziv: '  ' }, 'M'), 'Naziv je obavezan.');
});

test('sprave: skracenica velikim slovima, ikona prazna, redosled po polu', () => {
  const { s } = nova();
  const id = s.dodaj('sprave', { naziv: 'Parter', skracenica: 'pa' }, 'M');
  const r = s.nadji('sprave', id);
  assert.equal(r.skracenica, 'PA');
  assert.equal(r.ikona, '');
  assert.equal(r.pol, 'M');
  assert.equal(r.redosled, 1);
  const z = s.dodaj('sprave', { naziv: 'Parter', skracenica: 'PA' }, 'Z');
  assert.equal(s.nadji('sprave', z).redosled, 1);
  assert.equal(s.nadji('sprave', z).pol, 'Z');
  assert.equal(s.sprave('M').length, 1);
  assert.equal(s.sprave('Z')[0].id, z);
  assert.deepEqual(s.lista('sprave', 'M').map((x) => x.id), [id]);
});

test('sprave: skracenica 1 do 4 slova', () => {
  const { s } = nova();
  for (const skr of ['', 'ABCDE', 'P1']) {
    poruka(() => s.dodaj('sprave', { naziv: 'X', skracenica: skr }, 'M'), 'Skraćenica sprave mora imati 1 do 4 slova.');
  }
  s.dodaj('sprave', { naziv: 'X', skracenica: 'šđ' }, 'M');
});

test('sprave: ista skracenica za isti pol baca, za drugi pol prolazi', () => {
  const { s } = nova();
  s.dodaj('sprave', { naziv: 'Parter', skracenica: 'PA' }, 'M');
  poruka(() => s.dodaj('sprave', { naziv: 'Drugi', skracenica: 'pa' }, 'M'), 'Skraćenica PA već postoji za taj pol.');
  s.dodaj('sprave', { naziv: 'Parter', skracenica: 'PA' }, 'Z');
});

test('izmeni: ista sprava zadrzava svoju skracenicu, nepoznata ikona baca', () => {
  const { s } = nova();
  const id = s.dodaj('sprave', { naziv: 'Parter', skracenica: 'PA' }, 'M');
  s.izmeni('sprave', id, { naziv: 'Parter 2', skracenica: 'pa', ikona: 'sprava-PA' }, 'M');
  const r = s.nadji('sprave', id);
  assert.equal(r.naziv, 'Parter 2');
  assert.equal(r.ikona, 'sprava-PA');
  assert.equal(r.redosled, 1);
  assert.equal(r.pol, 'M');
  poruka(() => s.izmeni('sprave', id, { naziv: 'P', skracenica: 'PA', ikona: 'nesto' }, 'M'), 'Nepoznata ikona.');
  const drugi = s.dodaj('sprave', { naziv: 'Konj', skracenica: 'KH' }, 'M');
  poruka(() => s.izmeni('sprave', drugi, { naziv: 'Konj', skracenica: 'PA' }, 'M'), 'Skraćenica PA već postoji za taj pol.');
});

test('stavka drugog pola se ne menja', () => {
  const { baza, s } = nova();
  const kat = s.dodaj('kategorije', { naziv: 'Kadet' }, 'M');
  const sp = s.dodaj('sprave', { naziv: 'Parter', skracenica: 'PA' }, 'M');
  poruka(() => s.izmeni('kategorije', kat, { naziv: 'Tudja' }, 'Z'), 'Stavka ne postoji.');
  poruka(() => s.izmeni('sprave', sp, { naziv: 'Tudja', skracenica: 'TU' }, 'Z'), 'Stavka ne postoji.');
  poruka(() => s.obrisi('kategorije', kat, 'Z'), 'Stavka ne postoji.');
  poruka(() => s.obrisi('sprave', sp, 'Z'), 'Stavka ne postoji.');
  poruka(() => s.obrisi('kategorije', 9999, 'M'), 'Stavka ne postoji.');
  assert.equal(s.nadji('kategorije', kat).naziv, 'Kadet');
  assert.equal(s.nadji('sprave', sp).naziv, 'Parter');
  assert.equal(Number(baza.vrednost('SELECT COUNT(*) FROM kategorije')), 1);
  // svoj pol prolazi
  s.izmeni('kategorije', kat, { naziv: 'Svoja' }, 'M');
  assert.equal(s.nadji('kategorije', kat).naziv, 'Svoja');
  s.obrisi('kategorije', kat, 'M');
  assert.equal(s.nadji('kategorije', kat), null);
});

test('redosled: menja redosled i izmenjeno, ignorise tudje id i drugi pol', () => {
  const { baza, s } = nova();
  const id1 = s.dodaj('kategorije', { naziv: 'A' }, 'Z');
  const id2 = s.dodaj('kategorije', { naziv: 'B' }, 'Z');
  const tudja = s.dodaj('kategorije', { naziv: 'C' }, 'M');
  const spr = s.dodaj('sprave', { naziv: 'Parter', skracenica: 'PA' }, 'M');
  baza.izvrsi("UPDATE kategorije SET izmenjeno = '2000-01-01 00:00:00'");
  s.redosled('kategorije', [id2, id1, tudja], 'Z');
  assert.equal(s.nadji('kategorije', id2).redosled, 1);
  assert.equal(s.nadji('kategorije', id1).redosled, 2);
  assert.notEqual(s.nadji('kategorije', id1).izmenjeno, '2000-01-01 00:00:00');
  assert.deepEqual(s.lista('kategorije', 'Z').map((r) => r.id), [id2, id1]);
  // kategorija i sprava drugog pola: ne menjaju se
  assert.equal(s.nadji('kategorije', tudja).redosled, 1);
  assert.equal(s.nadji('kategorije', tudja).izmenjeno, '2000-01-01 00:00:00');
  s.redosled('sprave', [spr], 'Z');
  assert.equal(s.nadji('sprave', spr).redosled, 1);
});

test('obrisi: bez upotrebe brise, kategorija u prijavi baca poruku sa brojem', () => {
  const { baza, s } = nova();
  const a = s.dodaj('kategorije', { naziv: 'A' }, 'Z');
  const b = s.dodaj('kategorije', { naziv: 'B' }, 'Z');
  s.obrisi('kategorije', a, 'Z');
  assert.equal(s.nadji('kategorije', a), null);
  prijavaSa(baza, { kategorija_id: b });
  poruka(() => s.obrisi('kategorije', b, 'Z'), 'Stavka se koristi u 1 prijava ili ocena i ne može se obrisati.');
  assert.ok(s.nadji('kategorije', b));
});

test('obrisi: sprava u prijava_sprave se ne brise', () => {
  const { baza, s } = nova();
  const sp = s.dodaj('sprave', { naziv: 'Greda', skracenica: 'GR' }, 'Z');
  const pr = prijavaSa(baza, {});
  baza.ubaci('prijava_sprave', { prijava_id: pr, sprava_id: sp });
  poruka(() => s.obrisi('sprave', sp, 'Z'), 'Stavka se koristi u 1 prijava ili ocena i ne može se obrisati.');
});
