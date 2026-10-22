const test = require('node:test');
const assert = require('node:assert/strict');
const u = require('../electron/uvoz/uparivanje.cjs');

const baza = [
  { id: 1, prezime: 'Lazić', ime: 'Pavle', godina_rodjenja: 2011, pol: 'M', klub_skr: 'PŽS' },
  { id: 2, prezime: 'Lazic', ime: 'Pavle', godina_rodjenja: 2015, pol: 'M', klub_skr: 'VOJ' },
  { id: 3, prezime: 'Jović', ime: 'Lena', godina_rodjenja: 2013, pol: 'Z', klub_skr: 'BGD' },
];
const red = (prezime, ime, godina, greske = []) => ({ prezime, ime, godina, greske });

test('uparivanje: oceni', () => {
  let o = u.oceni(red('LAZIC', 'pavle', 2011), baza, [], 'M');
  assert.equal(o.status, u.POSTOJI);
  assert.equal(o.takmicar_id, 1);
  assert.equal(o.postupak, 'postojeci');
  assert.ok(o.napomena.includes('Lazić Pavle (2011, PŽS)'));

  o = u.oceni(red('Pavle', 'Lazić', 2015), baza, [], null);
  assert.equal(o.takmicar_id, 2);
  assert.equal(o.status, u.POSTOJI);

  o = u.oceni(red('Lazić', 'Pavle', 2009), baza, [], 'M');
  assert.equal(o.status, u.SLICAN);
  assert.equal(o.postupak, 'novi');
  assert.equal(o.takmicar_id, 1);
  assert.equal(o.napomena, 'u bazi je Lazić Pavle (2011, PŽS), godina se razlikuje');

  o = u.oceni(red('Lazić', 'Pavle', null), baza, [], 'M');
  assert.equal(o.status, u.POSTOJI);

  o = u.oceni(red('Jović', 'Lena', 2013), baza, [3], 'Z');
  assert.equal(o.status, u.PRIJAVLJEN);
  assert.equal(o.postupak, 'nista');
  assert.equal(o.napomena, 'već prijavljen: Jović Lena (2013, BGD)');

  o = u.oceni(red('Novak', 'Ivan', 2012), baza, [], 'M');
  assert.equal(o.status, u.NOVI);
  assert.equal(o.postupak, 'novi');
  assert.equal(o.napomena, '');

  o = u.oceni(red('Novak', 'Ivan', null), baza, [], 'M');
  assert.equal(o.status, u.GRESKA);
  assert.equal(o.napomena, 'nema godine rođenja, a takmičara nema u bazi');

  o = u.oceni(red('Novak', '', 2012, ['nedostaje ime', 'x']), baza, [], 'M');
  assert.equal(o.status, u.GRESKA);
  assert.equal(o.napomena, 'nedostaje ime; x');
  assert.equal(o.takmicar_id, null);
});

test('uparivanje: konstante, kljuc, kandidati', () => {
  assert.deepEqual([u.NOVI, u.POSTOJI, u.SLICAN, u.PRIJAVLJEN, u.GRESKA],
    ['novi', 'postoji', 'slican', 'prijavljen', 'greska']);
  assert.equal(u.kljuc('Lazić', 'Pavle'), 'lazic|pavle');
  const k = u.kandidati(red('Lazić', 'Pavle', 2015), baza, 'M');
  assert.deepEqual(k.map((t) => [t.id, t.tezina]), [[2, 3], [1, 1]]);
});

test('uparivanje: nadjiKlub i nadjiStavku', () => {
  const klubovi = [
    { id: 1, puno_ime: 'SD „Vojvodina“', skracenica: 'VOJ' },
    { id: 5, puno_ime: 'GD „Partizan-Željezničar“', skracenica: 'PŽS' },
    { id: 6, puno_ime: 'SGK „ES-EM“', skracenica: 'ESM' },
  ];
  assert.equal(u.nadjiKlub('G.D.“PARTIZAN –ŽELJEZNIČAR“', klubovi), 5);
  assert.equal(u.nadjiKlub('Sportsko društvo Vojvodina', klubovi), 1);
  assert.equal(u.nadjiKlub('esm', klubovi), 6);
  assert.equal(u.nadjiKlub('GK Beograd', klubovi), null);
  assert.equal(u.nadjiKlub('', klubovi), null);

  const kat = [{ id: 1, naziv: 'Kadet' }, { id: 2, naziv: 'I kategorija' }, { id: 3, naziv: '2' }, { id: 4, naziv: 'III' }];
  assert.equal(u.nadjiStavku('I', kat), 2);
  assert.equal(u.nadjiStavku('1', kat), 2);
  assert.equal(u.nadjiStavku('II', kat), 3);
  assert.equal(u.nadjiStavku('3. kategorija', kat), 4);
  assert.equal(u.nadjiStavku('kadet', kat), 1);
  assert.equal(u.nadjiStavku('IV', kat), null);
  assert.equal(u.nadjiStavku(null, kat), null);
  const prog = [{ id: 7, naziv: 'B program' }, { id: 8, naziv: 'Program C' }];
  assert.equal(u.nadjiStavku('B', prog), 7);
  assert.equal(u.nadjiStavku('c', prog), 8);
  assert.equal(u.nadjiStavku('A', prog), null);
});
