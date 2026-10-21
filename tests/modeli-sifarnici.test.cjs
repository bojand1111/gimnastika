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
  const tk = baza.ubaci('takmicenja', { naziv: 'T', datum: '2026-10-25', kreirano: sad, izmenjeno: sad });
  const tm = baza.ubaci('takmicari', { id_broj: '1', ime: 'A', prezime: 'B', godina_rodjenja: 2012, pol: 'Z', kreirano: sad, izmenjeno: sad });
  return baza.ubaci('prijave', { takmicenje_id: tk, takmicar_id: tm, ...polja, kreirano: sad, izmenjeno: sad });
}

test('VRSTE i IKONE: cetiri liste, osam ikona', () => {
  assert.deepEqual(Object.keys(VRSTE), ['kategorije', 'programi', 'sprave_m', 'sprave_z']);
  assert.equal(VRSTE.sprave_m.naziv, 'Sprave · muške');
  assert.equal(VRSTE.sprave_z.pol, 'Z');
  assert.equal(IKONE.length, 8);
});

test('meta: nepoznata vrsta baca poruku', () => {
  const { s } = nova();
  poruka(() => s.meta('x'), 'Nepoznata lista: x');
  assert.equal(s.meta('programi').tabela, 'programi');
});

test('kategorije: prazna lista, redosled 1 pa 2', () => {
  const { s } = nova();
  assert.deepEqual(s.lista('kategorije'), []);
  const a = s.dodaj('kategorije', { naziv: 'Kadet' });
  const b = s.dodaj('kategorije', { naziv: ' Junior ' });
  assert.equal(s.nadji('kategorije', a).redosled, 1);
  assert.equal(s.nadji('kategorije', b).redosled, 2);
  assert.equal(s.nadji('kategorije', b).naziv, 'Junior');
  assert.deepEqual(s.lista('kategorije').map((r) => r.id), [a, b]);
});

test('dodaj: prazan naziv', () => {
  const { s } = nova();
  poruka(() => s.dodaj('programi', { naziv: '  ' }), 'Naziv je obavezan.');
});

test('sprave: skracenica velikim slovima, ikona prazna, redosled po polu', () => {
  const { s } = nova();
  const id = s.dodaj('sprave_m', { naziv: 'Parter', skracenica: 'pa' });
  const r = s.nadji('sprave_m', id);
  assert.equal(r.skracenica, 'PA');
  assert.equal(r.ikona, '');
  assert.equal(r.pol, 'M');
  assert.equal(r.redosled, 1);
  const z = s.dodaj('sprave_z', { naziv: 'Parter', skracenica: 'PA' });
  assert.equal(s.nadji('sprave_z', z).redosled, 1);
  assert.equal(s.sprave('M').length, 1);
  assert.equal(s.sprave('Z')[0].id, z);
});

test('sprave: skracenica 1 do 4 slova', () => {
  const { s } = nova();
  for (const skr of ['', 'ABCDE', 'P1']) {
    poruka(() => s.dodaj('sprave_m', { naziv: 'X', skracenica: skr }), 'Skraćenica sprave mora imati 1 do 4 slova.');
  }
  s.dodaj('sprave_m', { naziv: 'X', skracenica: 'šđ' });
});

test('sprave: ista skracenica za isti pol baca, za drugi pol prolazi', () => {
  const { s } = nova();
  s.dodaj('sprave_m', { naziv: 'Parter', skracenica: 'PA' });
  poruka(() => s.dodaj('sprave_m', { naziv: 'Drugi', skracenica: 'pa' }), 'Skraćenica PA već postoji za taj pol.');
  s.dodaj('sprave_z', { naziv: 'Parter', skracenica: 'PA' });
});

test('izmeni: ista sprava zadrzava svoju skracenicu, nepoznata ikona baca', () => {
  const { s } = nova();
  const id = s.dodaj('sprave_m', { naziv: 'Parter', skracenica: 'PA' });
  s.izmeni('sprave_m', id, { naziv: 'Parter 2', skracenica: 'pa', ikona: 'sprava-PA' });
  const r = s.nadji('sprave_m', id);
  assert.equal(r.naziv, 'Parter 2');
  assert.equal(r.ikona, 'sprava-PA');
  assert.equal(r.redosled, 1);
  poruka(() => s.izmeni('sprave_m', id, { naziv: 'P', skracenica: 'PA', ikona: 'nesto' }), 'Nepoznata ikona.');
  const drugi = s.dodaj('sprave_m', { naziv: 'Konj', skracenica: 'KH' });
  poruka(() => s.izmeni('sprave_m', drugi, { naziv: 'Konj', skracenica: 'PA' }), 'Skraćenica PA već postoji za taj pol.');
});

test('redosled: menja redosled i izmenjeno, ignorise tudje id', () => {
  const { baza, s } = nova();
  const id1 = s.dodaj('kategorije', { naziv: 'A' });
  const id2 = s.dodaj('kategorije', { naziv: 'B' });
  const spr = s.dodaj('sprave_m', { naziv: 'Parter', skracenica: 'PA' });
  baza.izvrsi("UPDATE kategorije SET izmenjeno = '2000-01-01 00:00:00'");
  s.redosled('kategorije', [id2, id1]);
  assert.equal(s.nadji('kategorije', id2).redosled, 1);
  assert.equal(s.nadji('kategorije', id1).redosled, 2);
  assert.notEqual(s.nadji('kategorije', id1).izmenjeno, '2000-01-01 00:00:00');
  assert.deepEqual(s.lista('kategorije').map((r) => r.id), [id2, id1]);
  // sprava pripada drugom polu: ne menja se
  s.redosled('sprave_z', [spr]);
  assert.equal(s.nadji('sprave_m', spr).redosled, 1);
});

test('obrisi: bez upotrebe brise, kategorija u prijavi baca poruku sa brojem', () => {
  const { baza, s } = nova();
  const a = s.dodaj('kategorije', { naziv: 'A' });
  const b = s.dodaj('kategorije', { naziv: 'B' });
  s.obrisi('kategorije', a);
  assert.equal(s.nadji('kategorije', a), null);
  prijavaSa(baza, { kategorija_id: b });
  poruka(() => s.obrisi('kategorije', b), 'Stavka se koristi u 1 prijava ili ocena i ne može se obrisati.');
  assert.ok(s.nadji('kategorije', b));
});

test('obrisi: sprava u prijava_sprave se ne brise', () => {
  const { baza, s } = nova();
  const sp = s.dodaj('sprave_z', { naziv: 'Greda', skracenica: 'GR' });
  const pr = prijavaSa(baza, {});
  baza.ubaci('prijava_sprave', { prijava_id: pr, sprava_id: sp });
  poruka(() => s.obrisi('sprave_z', sp), 'Stavka se koristi u 1 prijava ili ocena i ne može se obrisati.');
});
