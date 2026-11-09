const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zip = require('../electron/uvoz/zip.cjs');
const U = require('../electron/uvoz/uparivanje.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviPrijave } = require('../electron/modeli/prijave.cjs');
const { napravi } = require('../electron/modeli/uvoz.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');
const { docxPrimer, docxBilten } = require('./pomoc/uzorci.cjs');

const S = '2026-01-01 00:00:00';
const BEZ_DNEVNIKA = { info() {}, greska() {} };

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const s = tokSeme(baza);
  const podesavanja = napraviPodesavanja(baza, '');
  const poruke = [];
  const dnevnik = { info: (t) => poruke.push(t), greska() {} };
  return { baza, s, podesavanja, poruke, uvoz: napravi(baza, podesavanja, dnevnik), prijave: napraviPrijave(baza, podesavanja) };
}

// Privremeni docx; vraca putanju i brise je posle fn.
function saFajlom(pravi, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-uvoz-'));
  try {
    const put = path.join(dir, 'p.docx');
    pravi(put);
    return fn(put);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const priprema = (uvoz, takm, pravi, ime = 'prijava.docx') => saFajlom(pravi, (put) => uvoz.pripremiFajl(put, ime, takm));

function xml(t) {
  return t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// Mali docx: naslov, klub i tabela (prezime, ime, kategorija, datum, ucesce).
function docxRedovi(klub, redovi, naslov = 'MSG PRIJAVA') {
  return (putanja) => {
    const p = (t) => '<w:p><w:r><w:t xml:space="preserve">' + xml(t) + '</w:t></w:r></w:p>';
    const tc = (t) => '<w:tc>' + p(t) + '</w:tc>';
    const tr = (...c) => '<w:tr>' + c.map(tc).join('') + '</w:tr>';
    const telo = p(naslov)
      + '<w:tbl>' + tr('Klub', klub) + '</w:tbl>'
      + '<w:tbl>' + tr('#', 'PREZIME', 'IME', 'KATEGORIJA', 'DATUM ROĐENJA', 'FUNKCIJA-EKIPA')
      + redovi.map((r, i) => tr(String(i + 1) + '.', ...r)).join('') + '</w:tbl>';
    const dok = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
      + telo + '<w:sectPr/></w:body></w:document>';
    zip.napravi(putanja, { '[Content_Types].xml': { sadrzaj: '<Types/>' }, 'word/document.xml': { sadrzaj: dok } });
  };
}

const broj = (baza, tabela) => Number(baza.vrednost(`SELECT COUNT(*) FROM ${tabela}`));
const poruka = (fn) => {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  return null;
};

test('upis u bazu: pun tok (POPIS 9.7)', () => {
  const { baza, s, uvoz, prijave, poruke } = nova();
  // Marko Test (2011, M, JED) postaje Neorčić Noah 2017 iz kluba PŽS; Herceg Aron ne postoji
  const klubP = baza.ubaci('klubovi', { puno_ime: 'GD „Partizan-Željezničar“', skracenica: 'PŽS', kreirano: S, izmenjeno: S });
  baza.izmeni('takmicari', { prezime: 'Neorčić', ime: 'Noah', godina_rodjenja: 2017, klub_id: klubP }, 'id = ?', [s.muski]);

  const fajl = priprema(uvoz, s.takmM, docxPrimer);
  assert.equal(fajl.vrsta, 'docx');
  assert.equal(fajl.klub_id, klubP);
  assert.equal(fajl.pol, 'M');
  assert.equal(fajl.redovi.length, 3);
  assert.equal(fajl.redovi[0].status, U.POSTOJI);
  assert.equal(fajl.redovi[0].takmicar_id, s.muski);
  assert.equal(fajl.redovi[1].status, U.NOVI);
  assert.equal(fajl.redovi[2].status, U.NOVI);
  assert.equal(fajl.oznake.length, 2);
  assert.equal(fajl.oznake[0].kategorija_id, null);
  assert.equal(fajl.oznake[0].program_id, null);
  assert.equal(fajl.redovi[0].oznaka_i, 0);
  assert.equal(fajl.redovi[1].oznaka_i, 1);

  const izbor = { 0: {
    pol: 'M',
    klub_id: String(klubP),
    oznake: { 0: { kategorija: 'novo', program: 'novo' }, 1: { kategorija: String(s.katM), program: '' } },
    redovi: { 0: { uvezi: '1', postupak: 'postojeci' }, 1: { uvezi: '1', postupak: 'novi' } },
  } };
  let r = uvoz.upisi(s.takmM, [fajl], izbor);
  assert.equal(r.prijavljeno, 2);
  assert.equal(r.novih, 1);
  assert.equal(r.postojecih, 1);
  assert.deepEqual(r.preskoceno, []);
  assert.deepEqual(poruke, ['Uvoz prijava (takmičenje ' + s.takmM + '): prijavljeno 2, novih takmičara 1, preskočeno 0']);
  const novaKat = baza.jedan('SELECT * FROM kategorije WHERE naziv = ?', ['I']);
  assert.ok(novaKat !== null);
  const noviProg = baza.jedan('SELECT * FROM programi WHERE naziv = ?', ['B']);
  assert.ok(noviProg !== null);
  const herceg = baza.jedan('SELECT * FROM takmicari WHERE prezime = ?', ['Herceg']);
  assert.equal(herceg.ime, 'Aron');
  assert.equal(Number(herceg.godina_rodjenja), 2012);
  assert.equal(herceg.pol, 'M');
  assert.equal(Number(herceg.klub_id), klubP);
  assert.equal(herceg.id_broj, '100');
  assert.equal(baza.vrednost('SELECT id FROM takmicari WHERE prezime = ?', ['Laudis Nanaši']), null);
  const lista = prijave.lista(s.takmM, 'M');
  assert.equal(lista.length, 2);
  const poImenu = Object.fromEntries(lista.map((p) => [p.prezime, p]));
  assert.equal(Number(poImenu['Neorčić'].program_id), Number(noviProg.id));
  assert.equal(Number(poImenu['Neorčić'].kategorija_id), Number(novaKat.id));
  assert.equal(Number(poImenu['Neorčić'].clan_ekipe), 0);
  assert.equal(Number(poImenu.Herceg.kategorija_id), s.katM);
  assert.equal(poImenu.Herceg.program_id, null);
  assert.equal(Number(poImenu.Herceg.clan_ekipe), 1);
  assert.deepEqual(poImenu.Herceg.sprave, [s.pa]);

  // Ponovni uvoz: prva dva su vec prijavljena, Laudis Nanaši je novi
  const fajl2 = priprema(uvoz, s.takmM, docxPrimer);
  assert.equal(fajl2.redovi[0].status, U.PRIJAVLJEN);
  assert.equal(fajl2.redovi[1].status, U.PRIJAVLJEN);
  assert.equal(fajl2.oznake[0].kategorija_id, Number(novaKat.id));
  r = uvoz.upisi(s.takmM, [fajl2], { 0: { pol: 'M', redovi: { 0: { uvezi: '1' }, 2: { uvezi: '1', postupak: 'novi' } } } });
  assert.equal(r.prijavljeno, 1);
  assert.equal(r.novih, 1);
  assert.equal(prijave.lista(s.takmM, 'M').length, 3);
});

test('izbor sa brojevima umesto tekstova daje isti rezultat', () => {
  const { baza, s, uvoz } = nova();
  const klubP = baza.ubaci('klubovi', { puno_ime: 'GD „Partizan-Željezničar“', skracenica: 'PŽS', kreirano: S, izmenjeno: S });
  const fajl = priprema(uvoz, s.takmM, docxPrimer);
  const r = uvoz.upisi(s.takmM, [fajl], { 0: {
    pol: 'M',
    klub_id: klubP,
    oznake: { 0: { kategorija: s.katM, program: s.progM }, 1: { kategorija: s.katM, program: 0 } },
    redovi: { 0: { uvezi: 1, postupak: 'novi' }, 1: { uvezi: 1 } },
  } });
  assert.equal(r.prijavljeno, 2);
  assert.equal(r.novih, 2);
  assert.equal(broj(baza, 'kategorije'), 2);
});

test('duplikat imena u istom fajlu: drugi red je greska', () => {
  const { s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [
    ['Petrović', 'Pera', 'I', '01.02.2012.', 'ekipa'],
    ['Petrović', 'Pera', 'I', '01.02.2012.', 'ekipa'],
  ]));
  assert.equal(fajl.redovi[0].status, U.NOVI);
  assert.equal(fajl.redovi[1].status, U.GRESKA);
  assert.equal(fajl.redovi[1].napomena, 'isti takmičar je već u redu 1');
  assert.equal(fajl.redovi[1].postupak, 'nista');
});

test('dva fajla sa istom novom kategorijom prave jednu kategoriju', () => {
  const { baza, s, uvoz } = nova();
  const f1 = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac']]), 'a.docx');
  const f2 = priprema(uvoz, s.takmM, docxRedovi('Klub Dva', [['Bbb', 'Mika', 'I', '03.04.2013.', 'pojedinac']]), 'b.docx');
  const ulaz = (klub) => ({ pol: 'M', klub_id: klub, oznake: { 0: { kategorija: 'novo', program: '' } }, redovi: { 0: { uvezi: '1', postupak: 'novi' } } });
  const r = uvoz.upisi(s.takmM, [f1, f2], { 0: ulaz(s.k1), 1: ulaz(s.k2) });
  assert.equal(r.prijavljeno, 2);
  assert.equal(baza.svi("SELECT id FROM kategorije WHERE naziv = 'I'").length, 1);
  assert.equal(broj(baza, 'kategorije'), 3);
  const kat = baza.svi('SELECT DISTINCT kategorija_id FROM prijave WHERE takmicenje_id = ?', [s.takmM]);
  assert.equal(kat.length, 1);
});

test('lekarski_sprecava_prijavu: novi takmicar upisan, prijava preskocena', () => {
  const { baza, s, podesavanja, uvoz, poruke } = nova();
  podesavanja.postavi('lekarski_sprecava_prijavu', 'da');
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac']]));
  const r = uvoz.upisi(s.takmM, [fajl], { 0: { pol: 'M', klub_id: s.k1, redovi: { 0: { uvezi: '1', postupak: 'novi' } } } });
  assert.equal(r.prijavljeno, 0);
  assert.equal(r.novih, 1);
  assert.equal(r.preskoceno.length, 1);
  assert.match(r.preskoceno[0], /lekarski ne važi na dan takmičenja/);
  assert.notEqual(baza.vrednost('SELECT id FROM takmicari WHERE prezime = ?', ['Aaa']), null);
  assert.equal(broj(baza, 'prijave'), 0);
  assert.match(poruke[0], /prijavljeno 0, novih takmičara 1, preskočeno 1$/);
});

test('greska u fazi 1 (nepostojeci klub) ne upisuje nista', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac']]));
  const pre = ['takmicari', 'prijave', 'kategorije', 'programi'].map((t) => broj(baza, t));
  const msg = poruka(() => uvoz.upisi(s.takmM, [fajl], { 0: {
    pol: 'M',
    klub_id: '9999',
    oznake: { 0: { kategorija: 'novo', program: 'novo' } },
    redovi: { 0: { uvezi: '1', postupak: 'novi' } },
  } }));
  assert.equal(msg, 'Klub za fajl prijava.docx ne postoji.');
  assert.deepEqual(['takmicari', 'prijave', 'kategorije', 'programi'].map((t) => broj(baza, t)), pre);
});

test('nepostojeca stavka u izboru baca gresku pre upisa', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac']]));
  const msg = poruka(() => uvoz.upisi(s.takmM, [fajl], { 0: { pol: 'M', oznake: { 0: { kategorija: '9999' } }, redovi: { 0: { uvezi: '1' } } } }));
  assert.equal(msg, 'Izabrana stavka ne postoji (kategorije).');
  assert.equal(broj(baza, 'prijave'), 0);
});

test('pol fajla i izbora se ne koristi: novi takmicar ima pol takmicenja', () => {
  const { baza, s, uvoz } = nova();
  // fajl bez oznake pola i izbor sa praznim ili tudjim polom: pol je uvek pol takmicenja
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac']], 'PRIJAVA'));
  assert.equal(fajl.pol, 'M');
  const fajlZ = priprema(uvoz, s.takm, docxRedovi('Klub Jedan', [['Bbb', 'Mika', 'I', '01.02.2012.', 'pojedinac']], 'MSG PRIJAVA'));
  assert.equal(fajlZ.pol, 'Z');
  uvoz.upisi(s.takmM, [fajl], { 0: { pol: '', redovi: { 0: { uvezi: '1', postupak: 'novi' } } } });
  uvoz.upisi(s.takm, [fajlZ], { 0: { pol: 'M', redovi: { 0: { uvezi: '1', postupak: 'novi' } } } });
  assert.equal(baza.vrednost('SELECT pol FROM takmicari WHERE prezime = ?', ['Aaa']), 'M');
  assert.equal(baza.vrednost('SELECT pol FROM takmicari WHERE prezime = ?', ['Bbb']), 'Z');
  assert.equal(broj(baza, 'takmicari'), 7);
});

test('uvoz: postojeci takmicar drugog pola je greska', () => {
  const { baza, s, uvoz } = nova();
  // Marko Test je M (2011); u ZSG takmicenju njegov red ne sme da se uveze
  const fajl = priprema(uvoz, s.takm, docxRedovi('Klub Jedan', [['Test', 'Marko', 'I', '01.02.2011.', 'pojedinac']]));
  assert.equal(fajl.redovi[0].status, U.GRESKA);
  assert.equal(fajl.redovi[0].napomena, 'takmičar je drugog pola');
  assert.equal(fajl.redovi[0].takmicar_id, null);
  assert.equal(fajl.redovi[0].postupak, 'nista');
  const pre = broj(baza, 'takmicari');
  const r = uvoz.upisi(s.takm, [fajl], { 0: { redovi: { 0: { uvezi: '1', postupak: 'postojeci' } } } });
  assert.equal(r.prijavljeno, 0);
  assert.equal(broj(baza, 'prijave'), 0);
  assert.equal(broj(baza, 'takmicari'), pre);
  // u MSG takmicenju isti red je postojeci takmicar
  const fajlM = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Test', 'Marko', 'I', '01.02.2011.', 'pojedinac']]));
  assert.equal(fajlM.redovi[0].status, U.POSTOJI);
  assert.equal(fajlM.redovi[0].takmicar_id, s.muski);
});

test('uvoz: isto ime drugog pola, druga godina je novi takmicar pola takmicenja', () => {
  const { baza, s, uvoz } = nova();
  // Marko Test je M (2011); u ZSG takmicenju red iste osobe sa godinom 2015 nije ista osoba
  const fajl = priprema(uvoz, s.takm, docxRedovi('Klub Jedan', [['Test', 'Marko', 'I', '01.02.2015.', 'pojedinac']]));
  assert.equal(fajl.redovi[0].status, U.NOVI);
  assert.equal(fajl.redovi[0].takmicar_id, null);
  assert.equal(fajl.redovi[0].postupak, 'novi');
  assert.equal(fajl.redovi[0].napomena, '');
  const r = uvoz.upisi(s.takm, [fajl], { 0: { redovi: { 0: { uvezi: '1' } } } });
  assert.equal(r.prijavljeno, 1);
  assert.equal(r.novih, 1);
  const novi = baza.jedan("SELECT * FROM takmicari WHERE prezime = 'Test' AND ime = 'Marko' AND godina_rodjenja = 2015");
  assert.equal(novi.pol, 'Z');
  assert.notEqual(Number(novi.id), s.muski);
  assert.equal(baza.vrednost('SELECT pol FROM takmicari WHERE id = ?', [s.muski]), 'M');
});

test('uvoz: kandidat istog pola sa drugom godinom ima prednost nad istom godinom drugog pola', () => {
  const { baza, s, uvoz } = nova();
  const red = [['Test', 'Marko', 'I', '01.02.2011.', 'pojedinac']];
  // bez kandidata istog pola: ista osoba drugog pola je greska
  assert.equal(priprema(uvoz, s.takm, docxRedovi('Klub Jedan', red)).redovi[0].status, U.GRESKA);
  // Marko Test (Z, 2013) isto ime, ista godina samo kod M Marka (2011): ishod prati kandidata istog pola
  const zena = baza.ubaci('takmicari', { id_broj: '555', ime: 'Marko', prezime: 'Test', godina_rodjenja: 2013, pol: 'Z', kreirano: S, izmenjeno: S });
  const r = priprema(uvoz, s.takm, docxRedovi('Klub Jedan', red)).redovi[0];
  assert.equal(r.status, U.SLICAN);
  assert.equal(r.takmicar_id, zena);
  assert.equal(r.postupak, 'novi');
  assert.notEqual(r.napomena, 'takmičar je drugog pola');
  // isti ishod kao kad drugog pola uopste nema u bazi
  baza.izvrsi('DELETE FROM takmicari WHERE id = ?', [s.muski]);
  const bez = priprema(uvoz, s.takm, docxRedovi('Klub Jedan', red)).redovi[0];
  assert.deepEqual([bez.status, bez.takmicar_id, bez.postupak, bez.napomena], [r.status, r.takmicar_id, r.postupak, r.napomena]);
});

test('uvoz: nova kategorija dobija pol takmicenja', () => {
  const { baza, s, uvoz } = nova();
  const izbor = { 0: { oznake: { 0: { kategorija: 'novo', program: 'novo' } }, redovi: { 0: { uvezi: '1', postupak: 'novi' } } } };
  // docxPrimer: prvi red ima kategoriju I i program B
  const fajlZ = priprema(uvoz, s.takm, docxPrimer);
  uvoz.upisi(s.takm, [fajlZ], izbor);
  const kat = baza.jedan("SELECT * FROM kategorije WHERE naziv = 'I'");
  const prog = baza.jedan("SELECT * FROM programi WHERE naziv = 'B'");
  assert.equal(kat.pol, 'Z');
  assert.equal(prog.pol, 'Z');
  assert.equal(baza.vrednost('SELECT kategorija_id FROM prijave WHERE takmicenje_id = ?', [s.takm]), kat.id);
  // isti naziv u MSG uvozu pravi zasebnu stavku MSG, a postojeca stavka istog naziva samo svog pola se prepoznaje
  const fajlM = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Bbb', 'Mika', 'I', '03.04.2013.', 'pojedinac']]));
  uvoz.upisi(s.takmM, [fajlM], { 0: { oznake: { 0: { kategorija: 'novo', program: 'novo' } }, redovi: { 0: { uvezi: '1', postupak: 'novi' } } } });
  assert.deepEqual(baza.svi("SELECT pol FROM kategorije WHERE naziv = 'I' ORDER BY pol").map((r) => r.pol), ['M', 'Z']);
  assert.equal(baza.vrednost('SELECT k.pol FROM prijave p JOIN kategorije k ON k.id = p.kategorija_id WHERE p.takmicenje_id = ?', [s.takmM]), 'M');
  // postojeca Kadet stavka MSG se prepoznaje po nazivu i ne dupira
  const kadet = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', [['Ccc', 'Pavle', 'Kadet', '03.04.2013.', 'pojedinac']]));
  assert.equal(kadet.oznake[0].kategorija_id, s.katM);
  // stavka drugog pola se ne moze izabrati
  const msg = poruka(() => uvoz.upisi(s.takmM, [kadet], { 0: { oznake: { 0: { kategorija: String(s.kat) } }, redovi: { 0: { uvezi: '1', postupak: 'novi' } } } }));
  assert.equal(msg, 'Izabrana stavka ne postoji (kategorije).');
});

test('ID broj koji vec postoji: uzima se sledeci slobodan', () => {
  const { baza, s, podesavanja, uvoz } = nova();
  // izvor ID brojeva vidi samo '00001', pa je prvi predlog '00002', a on postoji u bazi
  baza.ubaci('takmicari', { id_broj: '00002', ime: 'Zauzet', prezime: 'Broj', godina_rodjenja: 2012, pol: 'M', klub_id: null, kreirano: S, izmenjeno: S });
  const lazna = Object.create(baza);
  // prefiks SQL-a je kontrakt sa takmicari.sledeciIdBroj: ako se upit promeni, ovaj test mora da se uskladi
  lazna.svi = (sql, params) => (sql.startsWith('SELECT id_broj FROM takmicari') ? [{ id_broj: '00001' }] : baza.svi(sql, params));
  const uvozL = napravi(lazna, podesavanja, BEZ_DNEVNIKA);
  const fajl = priprema(uvozL, s.takmM, docxRedovi('Klub Jedan', [
    ['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac'],
    ['Bbb', 'Mika', 'I', '03.04.2013.', 'pojedinac'],
  ]));
  uvozL.upisi(s.takmM, [fajl], { 0: { pol: 'M', redovi: { 0: { uvezi: '1', postupak: 'novi' }, 1: { uvezi: '1', postupak: 'novi' } } } });
  assert.equal(baza.vrednost('SELECT id_broj FROM takmicari WHERE prezime = ?', ['Aaa']), '00003');
  assert.equal(baza.vrednost('SELECT id_broj FROM takmicari WHERE prezime = ?', ['Bbb']), '00004');
});

test('greska u upisu ne ostavlja polovican uvoz (jedna transakcija)', () => {
  const { baza, s, podesavanja } = nova();
  let poziva = 0;
  const lazna = Object.create(baza);
  lazna.ubaci = (tabela, red) => {
    if (tabela === 'prijave' && ++poziva === 2) throw new Error('kvar');
    return baza.ubaci(tabela, red);
  };
  const upisano = [];
  const uvozL = napravi(lazna, podesavanja, { info: (t) => upisano.push(t), greska() {} });
  const fajl = priprema(uvozL, s.takmM, docxRedovi('Klub Jedan', [
    ['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac'],
    ['Bbb', 'Mika', 'I', '03.04.2013.', 'pojedinac'],
  ]));
  const pre = ['takmicari', 'prijave', 'kategorije'].map((t) => broj(baza, t));
  const msg = poruka(() => uvozL.upisi(s.takmM, [fajl], { 0: {
    pol: 'M',
    oznake: { 0: { kategorija: 'novo', program: '' } },
    redovi: { 0: { uvezi: '1', postupak: 'novi' }, 1: { uvezi: '1', postupak: 'novi' } },
  } }));
  assert.equal(msg, 'kvar');
  assert.deepEqual(upisano, []); // posle neuspeha nema reda u dnevniku
  assert.deepEqual(['takmicari', 'prijave', 'kategorije'].map((t) => broj(baza, t)), pre);
});

const REDOVI_A = [['Aaa', 'Pera', 'I', '01.02.2012.', 'pojedinac']];
const IZBOR_NOVI = (dopuna = {}) => ({ 0: { pol: 'M', redovi: { 0: { uvezi: '1', postupak: 'novi' } }, ...dopuna } });

test('drugi fajl koristi takmicara koga je prvi napravio u istom uvozu', () => {
  const { baza, s, uvoz } = nova();
  const f1 = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', REDOVI_A), 'a.docx');
  const f2 = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', REDOVI_A), 'b.docx');
  const pre = broj(baza, 'takmicari');
  const r = uvoz.upisi(s.takmM, [f1, f2], { 0: IZBOR_NOVI()[0], 1: IZBOR_NOVI()[0] });
  assert.equal(broj(baza, 'takmicari'), pre + 1);
  assert.equal(r.novih, 1);
  assert.equal(r.prijavljeno, 1);
  assert.equal(r.vec, 1); // isti takmicar je u drugom fajlu vec prijavljen
  assert.equal(r.postojecih, 0);
  assert.equal(broj(baza, 'prijave'), 1);
});

test('red bez godine rodjenja se preskace i ne pravi takmicara', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', REDOVI_A));
  fajl.redovi[0].godina = null;
  const pre = broj(baza, 'takmicari');
  const r = uvoz.upisi(s.takmM, [fajl], IZBOR_NOVI());
  assert.deepEqual(r.preskoceno, ['Aaa Pera (nema godine rođenja)']);
  assert.equal(r.prijavljeno, 0);
  assert.equal(r.novih, 0);
  assert.equal(broj(baza, 'takmicari'), pre);
});

test('red koji ne prodje proveru takmicara se preskace sa porukama provere', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', REDOVI_A));
  fajl.redovi[0].godina = 1800;
  const pre = broj(baza, 'takmicari');
  const r = uvoz.upisi(s.takmM, [fajl], IZBOR_NOVI());
  assert.equal(r.preskoceno.length, 1);
  assert.match(r.preskoceno[0], /^Aaa Pera \(.+\)$/);
  assert.equal(r.prijavljeno, 0);
  assert.equal(broj(baza, 'takmicari'), pre);
});

test('izbor bez kljuca klub_id koristi klub prepoznat u fajlu', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', REDOVI_A));
  assert.equal(fajl.klub_id, s.k1);
  uvoz.upisi(s.takmM, [fajl], IZBOR_NOVI());
  assert.equal(Number(baza.vrednost('SELECT klub_id FROM takmicari WHERE prezime = ?', ['Aaa'])), s.k1);
  assert.equal(Number(baza.vrednost('SELECT klub_id FROM prijave WHERE takmicenje_id = ?', [s.takmM])), s.k1);
});

test('postupak nista se preskace bez upisa', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Jedan', REDOVI_A));
  const pre = broj(baza, 'takmicari');
  const r = uvoz.upisi(s.takmM, [fajl], { 0: { pol: 'M', redovi: { 0: { uvezi: '1', postupak: 'nista' } } } });
  assert.equal(r.prijavljeno, 0);
  assert.deepEqual(r.preskoceno, []);
  assert.equal(broj(baza, 'takmicari'), pre);
  assert.equal(broj(baza, 'prijave'), 0);
});

// Izbor koji uvozi sve redove fajla sa predlozenim postupkom.
const IZBOR_SVE = (f, dopuna = {}) => ({
  redovi: Object.fromEntries(f.redovi.map((r, ri) => [ri, { uvezi: '1', postupak: r.postupak }])),
  ...dopuna,
});
const klubTakmicara = (baza, prezime) => baza.jedan(
  'SELECT k.* FROM takmicari t LEFT JOIN klubovi k ON k.id = t.klub_id WHERE t.prezime = ?', [prezime]);

test('bilten: klub iz svakog reda, postojeci po nazivu, novi jednom, skracenica jedinstvena, izbor fajla za red bez kluba', () => {
  const { baza, s, uvoz, prijave, poruke } = nova();
  const partizan = baza.ubaci('klubovi', { puno_ime: 'GD „Partizan“ Subotica', skracenica: 'PAR', kreirano: S, izmenjeno: S });
  baza.ubaci('klubovi', { puno_ime: 'Vojni', skracenica: 'voj', kreirano: S, izmenjeno: S }); // VOJ je zauzeto
  // Kulić Filip vec postoji (klub JED): ostaje u svom klubu
  const kulic = baza.ubaci('takmicari', { id_broj: '050', ime: 'Filip', prezime: 'Kulić', godina_rodjenja: 2006, pol: 'M', klub_id: s.k1, kreirano: S, izmenjeno: S });

  const fajl = priprema(uvoz, s.takmM, docxBilten, 'bilten.docx');
  assert.deepEqual(fajl.greske, []);
  assert.equal(fajl.klub_id, null);
  assert.deepEqual(fajl.redovi.map((r) => [r.prezime, r.status, r.klub_id]), [
    ['Kulić', U.POSTOJI, partizan],
    ['Testić', U.NOVI, null],
    ['Bezdatumić', U.GRESKA, null],
    ['Lukić', U.NOVI, null],
    ['Bezklubić', U.NOVI, null],
    ['Perić', U.NOVI, null],
  ]);
  assert.equal(fajl.redovi[0].takmicar_id, kulic);
  assert.equal(fajl.redovi[2].napomena, 'nema godine rođenja, a takmičara nema u bazi');
  assert.equal(fajl.redovi[4].klub, '');
  assert.equal(fajl.redovi[4].klub_naziv, '');
  assert.equal(fajl.redovi[1].klub_naziv, 'SD „Vojvodina“ Novi Sad');
  assert.deepEqual(fajl.novi_klubovi, ['SD „Vojvodina“ Novi Sad', 'SGU „AKRO“ Paraćin']);
  assert.deepEqual(fajl.oznake, []);

  // drugi fajl sa istim novim klubom u istom uvozu
  const fajl2 = priprema(uvoz, s.takmM, (put) => docxBilten(put, { strane: [[['1', 'Mila', 'Milić', '1.1.2012.', 'SD "Vojvodina" Novi Sad', 'SRB'], ['2', 'Sava', 'Savić', '2.2.2012.', 'GD Partizan Subotica', 'SRB']]] }));
  const klubova = broj(baza, 'klubovi');
  const r = uvoz.upisi(s.takmM, [fajl, fajl2], { 0: IZBOR_SVE(fajl, { klub_id: String(s.k2) }), 1: IZBOR_SVE(fajl2) });
  assert.equal(r.prijavljeno, 7);
  assert.equal(r.novih, 6);
  assert.equal(r.postojecih, 1);
  assert.deepEqual(r.preskoceno, []);
  assert.deepEqual(r.noviKlubovi, ['SD „Vojvodina“ Novi Sad (VNS)', 'SGU „AKRO“ Paraćin (AKRO)']);
  assert.equal(broj(baza, 'klubovi'), klubova + 2);
  const voj = klubTakmicara(baza, 'Testić');
  assert.equal(voj.puno_ime, 'SD „Vojvodina“ Novi Sad');
  assert.equal(voj.skracenica, 'VNS');
  assert.equal(voj.grad, '');
  assert.equal(klubTakmicara(baza, 'Lukić').id, voj.id);
  assert.equal(klubTakmicara(baza, 'Milić').id, voj.id);
  assert.equal(klubTakmicara(baza, 'Perić').skracenica, 'AKRO');
  assert.equal(Number(klubTakmicara(baza, 'Savić').id), partizan);
  assert.equal(Number(klubTakmicara(baza, 'Bezklubić').id), s.k2);
  assert.equal(Number(klubTakmicara(baza, 'Kulić').id), s.k1);
  assert.equal(baza.vrednost('SELECT id FROM takmicari WHERE prezime = ?', ['Bezdatumić']), null);
  assert.equal(baza.vrednost('SELECT id FROM takmicari WHERE prezime = ?', ['Rezultatić']), null);
  const lista = prijave.lista(s.takmM, 'M');
  assert.equal(lista.length, 7);
  const testic = lista.find((p) => p.prezime === 'Testić');
  assert.equal(Number(testic.klub_id), Number(voj.id));
  assert.equal(testic.kategorija_id, null);
  assert.equal(testic.program_id, null);
  assert.equal(poruke.at(-1), `Uvoz prijava (takmičenje ${s.takmM}): prijavljeno 7, novih takmičara 6, preskočeno 0, novi klubovi: SD „Vojvodina“ Novi Sad (VNS), SGU „AKRO“ Paraćin (AKRO)`);

  // ponovni uvoz istog fajla: klubovi se sada nalaze u bazi, nista novo se ne pravi
  const opet = priprema(uvoz, s.takmM, docxBilten);
  assert.deepEqual(opet.novi_klubovi, []);
  assert.equal(opet.redovi[1].klub_id, Number(voj.id));
  assert.equal(opet.redovi[1].status, U.PRIJAVLJEN);
});

test('bilten: izbor kluba po klubu iz fajla (postojeci, novi uprkos poklapanju, bez kluba) i nepostojeci id', () => {
  const { baza, s, uvoz } = nova();
  const partizan = baza.ubaci('klubovi', { puno_ime: 'GD „Partizan“ Subotica', skracenica: 'PAR', kreirano: S, izmenjeno: S });
  const fajl = priprema(uvoz, s.takmM, docxBilten, 'bilten.docx');
  // jedan zapis po klubu iz fajla, sa predlogom iz baze i brojem redova
  assert.deepEqual(fajl.klubovi_fajla.map((k) => [k.kljuc, k.klub_id, k.redova]), [
    ['gd partizan subotica', partizan, 1],
    ['sd vojvodina novi sad', null, 3],
    ['sgu akro paracin', null, 1],
  ]);
  assert.deepEqual(fajl.redovi.map((r) => r.klub_kljuc), ['gd partizan subotica', 'sd vojvodina novi sad', 'sd vojvodina novi sad', 'sd vojvodina novi sad', '', 'sgu akro paracin']);

  // nepostojeci izabrani klub: greska, nista se ne upisuje
  const takmicara = broj(baza, 'takmicari');
  assert.equal(poruka(() => uvoz.upisi(s.takmM, [fajl], { 0: IZBOR_SVE(fajl, { klubovi: { 'sd vojvodina novi sad': '9999' } }) })),
    'Izabrani klub za fajl bilten.docx ne postoji.');
  assert.equal(broj(baza, 'takmicari'), takmicara);

  const klubova = broj(baza, 'klubovi');
  const r = uvoz.upisi(s.takmM, [fajl], { 0: IZBOR_SVE(fajl, {
    klub_id: String(s.k2),
    klubovi: { 'gd partizan subotica': 'novo', 'sd vojvodina novi sad': String(s.k1), 'sgu akro paracin': 'bez' },
  }) });
  assert.equal(r.novih, 5);
  // samo Partizan je nov (izabrano "novi" iako postoji klub sa istim imenom); Vojvodina ide u JED, AKRO bez kluba
  assert.equal(broj(baza, 'klubovi'), klubova + 1);
  assert.equal(r.noviKlubovi.length, 1);
  const testic = klubTakmicara(baza, 'Testić');
  assert.equal(Number(testic.id), s.k1);
  assert.equal(Number(klubTakmicara(baza, 'Lukić').id), s.k1);
  assert.equal(klubTakmicara(baza, 'Perić').id, null);
  assert.equal(Number(klubTakmicara(baza, 'Bezklubić').id), s.k2);
  // Kulic dobija novi klub istog imena (izbor 'novo'), sa drugom skracenicom
  const kulic = klubTakmicara(baza, 'Kulić');
  assert.notEqual(Number(kulic.id), partizan);
  assert.equal(kulic.puno_ime, 'GD „Partizan“ Subotica');
  assert.notEqual(kulic.skracenica, 'PAR');
});

test('bilten: klub se ne pravi za postojeceg takmicara ni za red koji ne prodje proveru', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, (put) => docxBilten(put, { strane: [[
    ['1', 'Marko', 'Test', '1.1.2011.', 'GK"Novi" Grad', 'SRB'],
    ['2', 'Pera', 'Starić', '1.1.1800.', 'GK"Drugi" Grad', 'SRB'],
  ]] }));
  assert.equal(fajl.redovi[0].status, U.POSTOJI);
  assert.equal(fajl.redovi[0].takmicar_id, s.muski);
  const klubova = broj(baza, 'klubovi');
  const r = uvoz.upisi(s.takmM, [fajl], { 0: IZBOR_SVE(fajl) });
  assert.equal(r.postojecih, 1);
  assert.equal(r.preskoceno.length, 1);
  assert.match(r.preskoceno[0], /^Starić Pera \(Godina rođenja nije ispravna\.\)$/);
  assert.deepEqual(r.noviKlubovi, []);
  assert.equal(broj(baza, 'klubovi'), klubova);
  assert.equal(Number(baza.vrednost('SELECT klub_id FROM takmicari WHERE id = ?', [s.muski])), s.k1);
});

test('bilten: greska u upisu vraca i napravljene klubove (jedna transakcija)', () => {
  const { baza, s, podesavanja } = nova();
  const lazna = Object.create(baza);
  lazna.ubaci = (tabela, red) => {
    if (tabela === 'prijave') throw new Error('kvar');
    return baza.ubaci(tabela, red);
  };
  const uvozL = napravi(lazna, podesavanja, BEZ_DNEVNIKA);
  const fajl = priprema(uvozL, s.takmM, docxBilten);
  const pre = ['takmicari', 'prijave', 'klubovi'].map((t) => broj(baza, t));
  assert.equal(poruka(() => uvozL.upisi(s.takmM, [fajl], { 0: IZBOR_SVE(fajl) })), 'kvar');
  assert.deepEqual(['takmicari', 'prijave', 'klubovi'].map((t) => broj(baza, t)), pre);
});

test('prijava kluba (bez kolone Klub) i dalje koristi klub fajla', () => {
  const { baza, s, uvoz } = nova();
  const fajl = priprema(uvoz, s.takmM, docxRedovi('Klub Dva', REDOVI_A));
  assert.equal(fajl.klub_id, s.k2);
  assert.equal(fajl.redovi[0].klub, '');
  assert.equal(fajl.redovi[0].klub_id, null);
  assert.deepEqual(fajl.novi_klubovi, []);
  const klubova = broj(baza, 'klubovi');
  const r = uvoz.upisi(s.takmM, [fajl], IZBOR_NOVI());
  assert.deepEqual(r.noviKlubovi, []);
  assert.equal(broj(baza, 'klubovi'), klubova);
  assert.equal(Number(baza.vrednost('SELECT klub_id FROM takmicari WHERE prezime = ?', ['Aaa'])), s.k2);
});
