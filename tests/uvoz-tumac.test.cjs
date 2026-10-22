const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tumac = require('../electron/uvoz/tumac-prijave.cjs');
const citac = require('../electron/uvoz/citac.cjs');
const { docxPrimer } = require('./pomoc/uzorci.cjs');

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
