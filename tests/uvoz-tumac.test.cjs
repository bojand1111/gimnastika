const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tumac = require('../electron/uvoz/tumac-prijave.cjs');
const citac = require('../electron/uvoz/citac.cjs');
const { docxPrimer, docxBilten } = require('./pomoc/uzorci.cjs');

const FAJLOVI = path.join(__dirname, 'fajlovi');

function docxDokument() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-tumac-'));
  try {
    const put = path.join(dir, 'a.docx');
    docxPrimer(put);
    return citac.procitaj(put);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('tumac: docx uzorak', () => {
  const r = tumac.protumaci(docxDokument());
  assert.deepEqual(r.greske, []);
  assert.equal(r.klub, 'G.D.“PARTIZAN –ŽELJEZNIČAR“');
  assert.equal(r.pol, 'M');
  assert.equal(r.redovi.length, 3);
  const n = r.redovi[0];
  assert.equal(n.prezime, 'Neorčić');
  assert.equal(n.ime, 'Noah');
  assert.equal(n.datum, '2017-02-12');
  assert.equal(n.godina, 2017);
  assert.equal(n.oznaka, 'I “B”');
  assert.equal(n.kategorija, 'I');
  assert.equal(n.program, 'B');
  assert.equal(n.ucesce, 'pojedinac');
  assert.deepEqual(n.greske, []);
  const h = r.redovi[1];
  assert.equal(h.datum, '2012-04-25');
  assert.equal(h.ucesce, 'ekipa');
  assert.equal(h.kategorija, 'IV');
  assert.equal(h.program, 'A');
  const l = r.redovi[2];
  assert.equal(l.prezime, 'Laudis Nanaši');
  assert.equal(l.ucesce, 'pojedinac');
  assert.equal(l.rb, 3);
});

test('tumac: razne tabele', () => {
  const d = { tekst: 'Prijava za ŽSG\nKlub: GK Beograd', tabele: [[
    ['R.br.', 'Ime i prezime', 'Godište', 'Kat.', 'Program', 'Pol'],
    ['1', 'Ana Marija Kovač', '2014', 'III', 'c', 'ž'],
    ['R.br.', 'Ime i prezime', 'Godište', 'Kat.', 'Program', 'Pol'],
    ['2', 'MARKOVIĆ', '13.5.14', 'Kadeti', '', ''],
    ['3', 'Lena Jović', 'nepoznato', '2', '', ''],
  ]] };
  const r = tumac.protumaci(d);
  assert.equal(r.klub, 'GK Beograd');
  assert.equal(r.pol, 'Z');
  assert.equal(r.redovi.length, 3);
  const [a, b, c] = r.redovi;
  assert.equal(a.prezime, 'Kovač');
  assert.equal(a.ime, 'Ana Marija');
  assert.equal(a.godina, 2014);
  assert.equal(a.datum, null);
  assert.equal(a.kategorija, 'III');
  assert.equal(a.program, 'C');
  assert.equal(a.oznaka, 'III c');
  assert.equal(a.pol, 'Z');
  assert.equal(b.prezime, 'Marković');
  assert.deepEqual(b.greske, ['nedostaje ime']);
  assert.equal(b.datum, '2014-05-13');
  assert.equal(b.kategorija, 'Kadeti');
  assert.equal(b.program, null);
  assert.deepEqual(c.greske, ['datum rođenja nije razumljiv: nepoznato']);
  assert.equal(c.kategorija, '2');

  assert.deepEqual(tumac.protumaci({ tekst: '', tabele: [[['a', 'b'], ['c', 'd']]] }).greske,
    ['U fajlu nema tabele sa kolonama PREZIME i IME.']);
  assert.deepEqual(tumac.protumaci({ tekst: '', tabele: [[['Prezime', 'Ime']]] }).greske,
    ['Tabela sa prijavama je prazna.']);
});

test('tumac: pomocne funkcije', () => {
  const kp = tumac.kategorijaProgram;
  assert.deepEqual(kp('I “B”'), { kategorija: 'I', program: 'B' });
  assert.deepEqual(kp('III "A"'), { kategorija: 'III', program: 'A' });
  assert.deepEqual(kp('IV'), { kategorija: 'IV', program: null });
  assert.deepEqual(kp('2. kat. C program'), { kategorija: '2', program: 'C' });
  assert.deepEqual(kp('ii - a'), { kategorija: 'II', program: 'A' });
  assert.deepEqual(kp('Kadeti'), { kategorija: 'Kadeti', program: null });
  assert.deepEqual(kp(''), { kategorija: null, program: null });
  const d = tumac.datum;
  assert.deepEqual(d(' 25. 04. 2012.. '), { datum: '2012-04-25', godina: 2012, greska: false });
  assert.deepEqual(d('5/4/2012'), { datum: '2012-04-05', godina: 2012, greska: false });
  assert.deepEqual(d('2012-04-25'), { datum: '2012-04-25', godina: 2012, greska: false });
  assert.deepEqual(d('2012.'), { datum: null, godina: 2012, greska: false });
  assert.deepEqual(d('31.02.2012'), { datum: null, godina: null, greska: true });
  assert.deepEqual(d(''), { datum: null, godina: null, greska: false });
  assert.deepEqual(d('13.5.14'), { datum: '2014-05-13', godina: 2014, greska: false });
  assert.deepEqual(d('29.02.2012'), { datum: '2012-02-29', godina: 2012, greska: false });
  assert.deepEqual(d('29.02.2013'), { datum: null, godina: null, greska: true });
  assert.equal(tumac.ucesce('van konkurencije'), 'vk');
  assert.equal(tumac.ucesce('VK'), 'vk');
  assert.equal(tumac.ucesce('Ekipa'), 'ekipa');
  assert.equal(tumac.ucesce('pojedinac'), 'pojedinac');
  assert.equal(tumac.normalizuj('  Laudis-Nanaši '), 'laudis nanasi');
  assert.equal(tumac.normalizuj('Đorđe'), 'djordje');
});

test('tumac: lepo ime posle crtice i apostrofa', () => {
  const r = tumac.protumaci({ tekst: '', tabele: [[
    ['Prezime', 'Ime'], ['KOVAČ-NIKOLIĆ', 'laudis-nanaši'], ['O'+'\x27'+'BRIEN', 'McDonald'],
  ]] });
  assert.equal(r.redovi[0].prezime, 'Kovač-Nikolić');
  assert.equal(r.redovi[0].ime, 'Laudis-Nanaši');
  assert.equal(r.redovi[1].prezime, 'O\x27Brien');
  assert.equal(r.redovi[1].ime, 'McDonald');
});

test('tumac: duplikat u fajlu se ovde ne ocenjuje', () => {
  const r = tumac.protumaci({ tekst: '', tabele: [[
    ['Prezime', 'Ime', 'Godište'], ['Kovač', 'Ana', '2014'], ['Kovač', 'Ana', '2014'],
  ]] });
  assert.equal(r.redovi.length, 2);
  assert.deepEqual(r.redovi[1].greske, []);
});

test('tumac: probni fajlovi', () => {
  const d = tumac.protumaci(citac.procitaj(path.join(FAJLOVI, 'prijava-partizan.docx')));
  assert.deepEqual(d.greske, []);
  assert.equal(d.pol, 'M');
  assert.ok(d.klub.includes('PARTIZAN'));
  assert.equal(d.redovi.length, 9);
  const h = d.redovi[7];
  assert.deepEqual([h.prezime, h.ime, h.datum, h.kategorija, h.program, h.ucesce],
    ['Herceg', 'Aron', '2012-04-25', 'IV', 'A', 'ekipa']);

  const x = tumac.protumaci(citac.procitaj(path.join(FAJLOVI, 'prijava-vojvodina.xlsx')));
  assert.deepEqual(x.greske, []);
  assert.equal(x.pol, 'Z');
  assert.equal(x.klub, 'SD „Vojvodina“');
  assert.equal(x.redovi.length, 4);
  assert.equal(x.redovi[0].datum, '2014-01-01');
  assert.equal(x.redovi[2].godina, 2011);
  assert.equal(x.redovi[3].ucesce, 'vk');
  assert.deepEqual(x.redovi[3].greske, ['nedostaje ime']);
});

test('normalizuj i lepoIme: NFD i NFC unos daju isti rezultat', () => {
  const nfd = 'ČORIĆ'.normalize('NFD'); // slovo + kombinovani znak
  assert.equal(tumac.normalizuj(nfd), 'coric');
  assert.equal(tumac.normalizuj(nfd), tumac.normalizuj('ČORIĆ'));
  assert.equal(tumac.normalizuj(null), '');
  assert.equal(tumac.normalizuj(undefined), '');
});

test('protumaci: ime zapisano razlozeno (NFD) se lepo formatira', () => {
  const dok = { vrsta: 'docx', tekst: 'MSG', tabele: [[['Klub', 'K']], [['PREZIME', 'IME', 'KATEGORIJA', 'DATUM ROĐENJA', 'FUNKCIJA-EKIPA'], ['ČORIĆ'.normalize('NFD'), 'MARKO', 'I', '01.02.2012.', '']]] };
  const r = tumac.protumaci(dok).redovi[0];
  assert.equal(r.prezime, 'Čorić');
  assert.equal(r.ime, 'Marko');
});

function biltenDokument(opcije) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-tumac-'));
  try {
    const put = path.join(dir, 'b.docx');
    docxBilten(put, opcije);
    return citac.procitaj(put);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('tumac: bilten, zaglavlje iz okvira za tekst vazi za tabele bez zaglavlja, klub u svakom redu', () => {
  for (const mc of [false, true]) {
    const r = tumac.protumaci(biltenDokument({ mc }));
    assert.deepEqual(r.greske, []);
    assert.equal(r.pol, 'M');
    assert.equal(r.klub, '');
    // dve strane po tri reda; tabele rezultata i tabela bez zaglavlja posle njih se ne uvoze
    assert.deepEqual(r.redovi.map((x) => [x.rb, x.prezime, x.ime, x.godina, x.klub]), [
      [1, 'Kulić', 'Filip', 2006, 'GD"Partizan" Subotica'],
      [2, 'Testić', 'Ana', 2010, 'SD"Vojvodina" Novi Sad'],
      [3, 'Bezdatumić', 'Marko', null, 'SD"Vojvodina" Novi Sad'],
      [4, 'Lukić', 'Luka', 2011, 'SD „Vojvodina“ Novi Sad'],
      [5, 'Bezklubić', 'Ivan', 2012, ''],
      [6, 'Perić', 'Pera', 2013, 'SGU"AKRO"Paraćin'],
    ]);
    assert.equal(r.redovi[0].datum, '2006-10-26');
    assert.equal(r.redovi[0].oznaka, '');
    assert.equal(r.redovi[0].kategorija, null);
    assert.deepEqual(r.redovi[2].greske, []);
  }
});

test('tumac: tabela rezultata (Ime sa prezimenom, Kategorija) se ne uvozi', () => {
  const rezultati = [
    ['Ime', 'KLUB-DRUŠTVO', 'Kategorija', '', 'Ukupno'],
    ['Kulić Filip', 'GD Partizan', 'Seniori', '', '50,000'],
  ];
  const finale = [['Mesto', 'Ime', 'KLUB-DRUŠTVO', 'D', 'E', 'Bonus', 'Pen.', 'Ukupno'], ['1', 'Kulić Filip', 'GD Partizan', '3,0', '8,0', '', '', '11,000']];
  const r = tumac.protumaci({ tekst: 'MSG', tabele: [rezultati, finale] });
  assert.deepEqual(r.redovi, []);
  assert.deepEqual(r.greske, ['U fajlu nema tabele sa kolonama PREZIME i IME.']);
  // ni posle zaglavlja spiska: tabela rezultata iste sirine prekida prenos zaglavlja
  const zaglavlje = [['Rb.', 'Ime', 'Prezime', 'Datum rodjenja', 'Klub']];
  const ista = [['Ime', 'Klub', 'Kategorija', '', 'Ukupno'], ['Kulić Filip', 'GD Partizan', 'Seniori', '', '50,000']];
  const r2 = tumac.protumaci({ tekst: '', tabele: [zaglavlje, ista, [['1', 'Filip', 'Kulić', '2006', 'GD Partizan']]] });
  assert.deepEqual(r2.redovi, []);
  assert.deepEqual(r2.greske, ['Tabela sa prijavama je prazna.']);
});

test('tumac: prenos zaglavlja samo za susednu tabelu iste sirine, iz tabele bez redova', () => {
  const zaglavlje = [['Prezime', 'Ime', 'Godište']];
  const podaci = [['Kovač', 'Ana', '2014']];
  const prenos = (tabele) => tumac.protumaci({ tekst: '', tabele }).redovi.map((x) => x.prezime);
  assert.deepEqual(prenos([zaglavlje, podaci, [['Jović', 'Lena', '2013']]]), ['Kovač', 'Jović']);
  // druga sirina, tabela izmedju, zaglavlje sa redovima: nema prenosa
  assert.deepEqual(prenos([zaglavlje, [['Kovač', 'Ana', '2014', 'x']]]), []);
  assert.deepEqual(prenos([zaglavlje, [['nesto', 'drugo']], podaci]), []);
  assert.deepEqual(prenos([[...zaglavlje, ['Jović', 'Lena', '2013']], podaci]), ['Jović']);
  // prazan red posle zaglavlja ne smeta
  assert.deepEqual(prenos([[...zaglavlje, ['', '', '']], podaci]), ['Kovač']);
});

test('tumac: kolona kluba (Klub, KLUB-DRUŠTVO, Klub/Društvo, Društvo)', () => {
  for (const naziv of ['Klub', 'KLUB-DRUŠTVO', 'Klub/Društvo', 'Društvo', 'Naziv kluba']) {
    const r = tumac.protumaci({ tekst: '', tabele: [[['Prezime', 'Ime', naziv], ['Kovač', 'Ana', '  GK  „Niš“ ']]] });
    assert.equal(r.redovi[0].klub, 'GK „Niš“', naziv);
  }
  const bez = tumac.protumaci({ tekst: '', tabele: [[['Prezime', 'Ime'], ['Kovač', 'Ana']]] });
  assert.equal(bez.redovi[0].klub, '');
});

test('normalizuj: slova drugih jezika i cirilica, srpska latinica kao ranije', () => {
  const n = tumac.normalizuj;
  assert.equal(n('Rüstəmzadə'), 'rustemzade');
  assert.equal(n('Ömer Şahin Ağa'), 'omer sahin aga');
  assert.equal(n('Søren Ørsted'), 'soren orsted');
  assert.equal(n('Groß Łukasz'), 'gross lukasz');
  assert.equal(n('IŞIK İlkay'), 'isik ilkay');
  assert.equal(n('Петровић Ђорђе'), 'petrovic djordje');
  assert.equal(n('ЈОВАНОВИЋ Љиљана'), 'jovanovic ljiljana');
  assert.equal(n('Сергей Щукин'), 'sergej scukin');
  assert.equal(n('Neorčić Đokić'), 'neorcic djokic');
  assert.equal(n('KLUB-DRUŠTVO'), 'klub drustvo');
});

// Medjunarodna prijava (engleski, MAG): savez umesto kluba, "Name" spojen preko kolone Rb., tabela zvanicnika.
function prijavaSaveza(naslov = 'MAG - Nominative registration') {
  return {
    tekst: '17th MEMORIAL\nNovi Sad (SRB)\nForm to be sent to:',
    tabele: [
      [[naslov]],
      [['National Federation Name', 'Testland Gymnastics Federation', 'Country:', 'Testland'],
        ['Club Name', '-----', 'Contact person:', 'Neko Nekić']],
      [['GYMNASTS', 'GYMNASTS', 'GYMNASTS', 'GYMNASTS', 'GYMNASTS'],
        ['Name', 'Name', 'Date of Birth', 'Category', 'Apparatus'],
        ['1.', 'Aqil Rüstəmzadə', '30.09.2010', 'IV', 'All-around'],
        ['2.', 'Ilkin Ağayev Oğlu', '31.03.2011', 'IV', 'All-around'],
        ['3.', '', '', '', '']],
      [['Function', 'Name', 'M/F'], [naslov.slice(0, 3) + ' Coach 1.', 'Trener Testić', 'M'], [naslov.slice(0, 3) + ' Judge 1.', 'Sudija Testić', 'M']],
    ],
  };
}

test('protumaci: prijava saveza na engleskom (celo ime u koloni Name, klub je savez, MAG je M, bez zvanicnika)', () => {
  const p = tumac.protumaci(prijavaSaveza());
  assert.deepEqual(p.greske, []);
  assert.equal(p.klub, 'Testland Gymnastics Federation');
  assert.equal(p.drzava, 'Testland'); // "Country:" u trecoj celiji reda
  assert.equal(p.pol, 'M');
  assert.deepEqual(p.redovi.map((r) => [r.prezime, r.ime, r.datum, r.kategorija]), [
    ['Rüstəmzadə', 'Aqil', '2010-09-30', 'IV'],
    ['Oğlu', 'Ilkin Ağayev', '2011-03-31', 'IV'],
  ]);
  assert.equal(tumac.protumaci(prijavaSaveza('WAG - Nominative registration')).pol, 'Z');
});

test('protumaci: engleske kolone Surname / First name / Club / Sex i cirilicko zaglavlje', () => {
  const en = tumac.protumaci({ tekst: '', tabele: [[
    ['No.', 'Surname', 'Name', 'Year of birth', 'Club', 'Sex'],
    ['1', 'ŞAHİN', 'ÖMER', '2012', 'Gym Club Ankara', 'male'],
    ['2', 'Lindqvist', 'Åsa', '2013', 'Gym Club Ankara', 'F'],
  ]] });
  assert.deepEqual(en.greske, []);
  assert.deepEqual(en.redovi.map((r) => [r.prezime, r.ime, r.godina, r.klub, r.pol]), [
    ['Şahin', 'Ömer', 2012, 'Gym Club Ankara', 'M'],
    ['Lindqvist', 'Åsa', 2013, 'Gym Club Ankara', 'Z'],
  ]);
  const cir = tumac.protumaci({ tekst: 'ЖЕНСКА СПОРТСКА ГИМНАСТИКА', tabele: [[
    ['Р.б.', 'Презиме', 'Име', 'Датум рођења', 'Категорија'],
    ['1', 'Петровић', 'Ана', '01.02.2012.', 'II'],
  ]] });
  assert.deepEqual(cir.greske, []);
  assert.equal(cir.pol, 'Z');
  assert.deepEqual(cir.redovi.map((r) => [r.prezime, r.ime, r.godina, r.kategorija]), [['Петровић', 'Ана', 2012, 'II']]);
});

test('protumaci: kolona Name bez datuma rodjenja i bez prezimena nije tabela takmicara', () => {
  const p = tumac.protumaci({ tekst: '', tabele: [[['Function', 'Name', 'M/F'], ['Coach', 'Trener Testić', 'M']]] });
  assert.deepEqual(p.redovi, []);
  assert.deepEqual(p.greske, ['U fajlu nema tabele sa kolonama PREZIME i IME.']);
});
