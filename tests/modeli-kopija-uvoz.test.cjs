const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviKopiju } = require('../electron/modeli/kopija.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const zip = require('../electron/uvoz/zip.cjs');

const NEMI = { info() {}, greska() {} };
const KOSA = '\\';

function nova(verzija = '1.0.0') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-kopuvoz-'));
  const baza = otvori(path.join(dir, 'gimnastika.sqlite'));
  baza.migriraj();
  pocetniPodaci(baza);
  const podesavanja = napraviPodesavanja(baza, dir);
  const k = napraviKopiju(baza, {
    fasciklaPodrazumevana: path.join(dir, 'kopije'), podesavanja, verzija, dnevnik: NEMI,
  });
  const ukloni = () => { try { baza.zatvori(); } catch { /* vec zatvorena */ } fs.rmSync(dir, { recursive: true, force: true }); };
  return { dir, baza, podesavanja, k, ukloni };
}

// Sintetican baza.sql po formatu iz POPIS 4.
function bazaSql() {
  return [
    '-- gimnastika kopija baze', '-- verzija: 1.1.1', '',
    'SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS=0;', "SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';", '',
    '-- Tabela: klubovi', 'DROP TABLE IF EXISTS `klubovi`;', 'CREATE TABLE `klubovi` (`id` int(10) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;', '',
    'INSERT INTO `klubovi` (`id`, `puno_ime`, `skracenica`, `grad`, `kreirano`, `izmenjeno`) VALUES',
    `(1, 'Klub ${KOSA}'Soko${KOSA}'; Novi Sad', 'SOK', 'Novi Sad', '2026-10-01 18:44:06', '2026-10-01 18:44:06');`, '',
    'INSERT INTO `takmicari` (`id`, `id_broj`, `ime`, `prezime`, `godina_rodjenja`, `pol`, `klub_id`, `lekarski_do`, `kreirano`, `izmenjeno`) VALUES',
    "(1, 'A1', 'Ana', 'Anić', 2012, 'Z', 1, NULL, '2026-10-01 18:44:06', '2026-10-01 18:44:06');", '',
    'INSERT INTO `sprave` (`id`, `pol`, `naziv`, `skracenica`, `ikona`, `redosled`, `kreirano`, `izmenjeno`) VALUES',
    "(1, 'Z', 'Preskok', 'PR', 'sprava-PR', 1, '2026-10-01 18:44:06', '2026-10-01 18:44:06');", '',
    'INSERT INTO `takmicenja` (`id`, `naziv`, `datum`, `grb_levo`, `grb_desno`, `kreirano`, `izmenjeno`) VALUES',
    "(1, 'Kup', '2026-10-17', 'grb/levo.png', '', '2026-10-01 18:44:06', '2026-10-01 18:44:06');", '',
    'INSERT INTO `prijave` (`id`, `takmicenje_id`, `takmicar_id`, `klub_id`, `kreirano`, `izmenjeno`) VALUES',
    "(1, 1, 1, 1, '2026-10-01 18:44:06', '2026-10-01 18:44:06');", '',
    'INSERT INTO `ocene` (`id`, `prijava_id`, `sprava_id`, `d`, `e`, `odbitak`, `konacna`, `status`, `broj_ispravki`, `uneto_u`, `kreirano`, `izmenjeno`) VALUES',
    "(1, 1, 1, '4.200', '8.700', '0.000', '12.900', 'uneto', 0, '2026-10-01 18:44:06', '2026-10-01 18:44:06', '2026-10-01 18:44:06');", '',
    'INSERT INTO `ocene_e` (`ocena_id`, `sudija`, `vrednost`) VALUES', "(1, 1, '8.700'),", "(1, 2, '8.650');", '',
    '-- Tabela: migracije', 'INSERT INTO `migracije` (`verzija`, `naziv`, `primenjeno`) VALUES', "(1, '001_pocetna', '2026-10-01 18:44:06'),", "(2, '002_x', '2026-10-01 18:44:06');", '',
    'INSERT INTO `podesavanja` (`kljuc`, `vrednost`) VALUES', "('aktivno_takmicenje', '1'),", `('kopije_fascikla', 'E:${KOSA}${KOSA}Kopije'),`, "('grb_levo', 'grb/a.png'),", "('organizator', 'Savez');", '',
    'SET FOREIGN_KEY_CHECKS=1;', '-- kraj', '',
  ].join('\n');
}

function napraviZip(t, opis, sql = bazaSql(), ime = 'php.zip') {
  const p = path.join(t.dir, ime);
  const stavke = { 'opis.json': { sadrzaj: JSON.stringify(opis) } };
  if (sql !== null) stavke['baza.sql'] = { sadrzaj: sql };
  zip.napravi(p, stavke);
  return p;
}

const OPIS = { aplikacija: 'gimnastika', verzija: '1.1.1', baza_verzija: 2, vreme: '2026-10-01 22:11:32', vrsta: 'pre_migracije' };

test('uvoz PHP zip-a: vrednosti, apostrof, NULL, hiljaditi delovi, preskocena podesavanja', () => {
  const t = nova('1.0.0');
  try {
    t.baza.ubaci('klubovi', { puno_ime: 'Pre uvoza', skracenica: 'PRE', grad: '', kreirano: 'x', izmenjeno: 'x' });
    const p = napraviZip(t, OPIS);
    const r = t.k.vrati(p);
    assert.equal(r.uvoz, true);
    assert.equal(r.ime, 'php.zip');
    assert.equal(r.opis.format, 'zip');
    assert.equal(r.opis.verzija, '1.1.1');
    assert.match(r.sigurnosna, /^kopija_.*\.sqlite$/);
    const sig = t.k.lista().find((x) => x.ime === r.sigurnosna);
    assert.equal(sig.opis.vrsta, 'pre_vracanja');

    assert.equal(t.baza.vrednost('SELECT puno_ime FROM klubovi'), "Klub 'Soko'; Novi Sad");
    assert.equal(t.baza.vrednost('SELECT COUNT(*) FROM klubovi'), 1);
    assert.equal(t.baza.vrednost('SELECT lekarski_do FROM takmicari'), null);
    const o = t.baza.jedan('SELECT d, e, odbitak, konacna, typeof(konacna) AS tip FROM ocene');
    assert.deepEqual({ ...o }, { d: 4200, e: 8700, odbitak: 0, konacna: 12900, tip: 'integer' });
    assert.deepEqual(t.baza.svi('SELECT sudija, vrednost FROM ocene_e ORDER BY sudija').map((x) => ({ ...x })),
      [{ sudija: 1, vrednost: 8700 }, { sudija: 2, vrednost: 8650 }]);
    assert.equal(t.baza.vrednost('SELECT grb_levo FROM takmicenja'), '');
    assert.equal(t.podesavanja.daj('aktivno_takmicenje'), '1');
    assert.equal(t.podesavanja.daj('organizator'), 'Savez');
    assert.equal(t.podesavanja.daj('kopije_fascikla'), '');
    assert.equal(t.podesavanja.daj('grb_levo'), '');
    assert.equal(Number(t.baza.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc = 'grb_levo'")), 0);
    // migracije tabela je SQLite-ova, sa svim migracijama (migriraj posle uvoza)
    assert.equal(t.baza.svi('SELECT ime FROM migracije').length, 4);
    // sprave su iz kopije (pocetniPodaci nije zvan pre uvoza), pa ih je tacno jedna
    assert.equal(t.baza.vrednost('SELECT COUNT(*) FROM sprave'), 1);
    assert.equal(t.baza.vrednost('PRAGMA foreign_keys'), 1);
    assert.deepEqual(r.redovi.ocene, 1);
    assert.equal(r.redovi.migracije, undefined);
    t.baza.ubaci('klubovi', { puno_ime: 'Posle', skracenica: 'POS', grad: '', kreirano: 'x', izmenjeno: 'x' });
  } finally { t.ukloni(); }
});

test('uvoz PHP zip-a: zip bez baza.sql, tudja aplikacija, verzija 2.0.0', () => {
  const t = nova('1.0.0');
  try {
    t.baza.ubaci('klubovi', { puno_ime: 'Ostaje', skracenica: 'OST', grad: '', kreirano: 'x', izmenjeno: 'x' });
    assert.throws(() => t.k.vrati(napraviZip(t, OPIS, null, 'bez.zip')), (e) => e instanceof GreskaKorisnika && e.message ===
      'Fajl nije rezervna kopija ove aplikacije (nedostaje opis.json ili baza.sql).');
    assert.throws(() => t.k.vrati(napraviZip(t, { ...OPIS, aplikacija: 'druga' }, bazaSql(), 'tudja.zip')), /Opis kopije nije ispravan\./);
    assert.throws(() => t.k.vrati(napraviZip(t, { ...OPIS, verzija: '2.0.0' }, bazaSql(), 'nova.zip')), GreskaKorisnika);
    assert.equal(t.baza.vrednost('SELECT COUNT(*) FROM klubovi'), 1);
    assert.equal(t.baza.vrednost('SELECT puno_ime FROM klubovi'), 'Ostaje');
  } finally { t.ukloni(); }
});

test('uvoz PHP zip-a: PHP verzija 1.1.1 se uvozi i kad je program starije verzije (0.5.1)', () => {
  const t = nova('0.5.1');
  try {
    t.k.vrati(napraviZip(t, OPIS));
    assert.equal(t.baza.vrednost('SELECT COUNT(*) FROM ocene'), 1);
  } finally { t.ukloni(); }
});

test('uvoz PHP zip-a: naredba koja ne prolazi prekida uvoz, zivi podaci ostaju', () => {
  const t = nova('1.0.0');
  try {
    t.baza.ubaci('klubovi', { puno_ime: 'Ostaje', skracenica: 'OST', grad: '', kreirano: 'x', izmenjeno: 'x' });
    const lose = bazaSql().replace("'4.200', '8.700'", "'4.200', '8.700', 'visak'");
    assert.throws(() => t.k.vrati(napraviZip(t, OPIS, lose, 'lose.zip')), (e) => e instanceof GreskaKorisnika && /prekinut/.test(e.message));
    assert.equal(t.baza.vrednost('SELECT puno_ime FROM klubovi'), 'Ostaje');
    // veza ka nepostojecem klubu: kopija je u sebi nedosledna
    const orfan = bazaSql().replace("'A1', 'Ana', 'Anić', 2012, 'Z', 1,", "'A1', 'Ana', 'Anić', 2012, 'Z', 77,");
    assert.throws(() => t.k.vrati(napraviZip(t, OPIS, orfan, 'orfan.zip')), GreskaKorisnika);
    assert.equal(t.baza.vrednost('SELECT puno_ime FROM klubovi'), 'Ostaje');
    assert.equal(fs.existsSync(path.join(t.dir, 'gimnastika.sqlite.uvoz')), false);
  } finally { t.ukloni(); }
});

test('lista: PHP zip se prikazuje sa opisom iz opis.json', () => {
  const t = nova();
  try {
    const f = path.join(t.dir, 'kopije');
    fs.mkdirSync(f, { recursive: true });
    zip.napravi(path.join(f, 'kopija_2026-10-01_2211.zip'), {
      'opis.json': { sadrzaj: JSON.stringify(OPIS) }, 'baza.sql': { sadrzaj: bazaSql() },
    });
    const z = t.k.lista()[0];
    assert.equal(z.ime, 'kopija_2026-10-01_2211.zip');
    assert.deepEqual({ ...z.opis }, { verzija: '1.1.1', baza_verzija: 2, vreme: '2026-10-01 22:11:32', vrsta: 'pre_migracije', format: 'zip' });
  } finally { t.ukloni(); }
});

test('fascikla: izabrana, nedostupna pa podrazumevana; postaviFasciklu', () => {
  const t = nova();
  try {
    const podr = path.join(t.dir, 'kopije');
    assert.deepEqual({ ...t.k.fasciklaStanje() }, { putanja: podr, podrazumevana: true, izabrana: '', nedostupna: false });
    const izabrana = path.join(t.dir, 'usb');
    assert.equal(t.k.postaviFasciklu(izabrana + path.sep + path.sep), `Fascikla za kopije je promenjena: ${izabrana}`);
    assert.equal(t.podesavanja.daj('kopije_fascikla'), izabrana);
    assert.deepEqual({ ...t.k.fasciklaStanje() }, { putanja: izabrana, podrazumevana: false, izabrana, nedostupna: false });
    assert.equal(t.k.napravi('rucna').putanja.startsWith(izabrana), true);
    fs.rmSync(izabrana, { recursive: true, force: true });
    const s = t.k.fasciklaStanje();
    assert.deepEqual({ ...s }, { putanja: podr, podrazumevana: true, izabrana, nedostupna: true });
    assert.equal(t.k.napravi('rucna').putanja.startsWith(podr), true);
    assert.equal(t.k.postaviFasciklu(''), 'Kopije se ponovo čuvaju u podrazumevanoj fascikli.');
    assert.equal(t.podesavanja.daj('kopije_fascikla'), '');
    // ne moze da se napravi (ispod fajla)
    const fajl = path.join(t.dir, 'fajl.txt');
    fs.writeFileSync(fajl, 'x');
    const losa = path.join(fajl, 'ispod');
    assert.throws(() => t.k.postaviFasciklu(losa), (e) => e instanceof GreskaKorisnika &&
      e.message === `Fascikla ne postoji i ne može da se napravi: ${losa}`);
    assert.equal(t.podesavanja.daj('kopije_fascikla'), '');
  } finally { t.ukloni(); }
});

test('putanja(ime): provera imena i postojanja', () => {
  const t = nova();
  try {
    const r = t.k.napravi('rucna');
    assert.equal(t.k.putanja(r.ime), r.putanja);
    assert.throws(() => t.k.putanja('..' + path.sep + 'x.sqlite'), /Nevažeće ime fajla\./);
    assert.throws(() => t.k.putanja('a..b.sqlite'), /Nevažeće ime fajla\./);
    assert.throws(() => t.k.putanja('x.txt'), /Nevažeće ime fajla\./);
    assert.throws(() => t.k.putanja('nema.sqlite'), /Fajl ne postoji: nema\.sqlite/);
  } finally { t.ukloni(); }
});

test('uvoz PHP zip-a: identifikatori sa mesovitim velikim slovima ne zaobilaze pravila za grbove', () => {
  const t = nova('1.0.0');
  try {
    const sql = bazaSql()
      .replace('INSERT INTO `takmicenja` (`id`, `naziv`, `datum`, `grb_levo`, `grb_desno`,',
        'INSERT INTO `TAKMICENJA` (`Id`, `Naziv`, `Datum`, `Grb_Levo`, `GRB_DESNO`,')
      .replace("(1, 'Kup', '2026-10-17', 'grb/levo.png', '',", "(1, 'Kup', '2026-10-17', '//server/x/levo.png', 'C:/tudje.png',");
    assert.ok(sql.includes('Grb_Levo'));
    t.k.vrati(napraviZip(t, OPIS, sql, 'velika.zip'));
    assert.equal(t.baza.vrednost('SELECT naziv FROM takmicenja'), 'Kup', 'red je uvezen');
    assert.equal(t.baza.vrednost('SELECT grb_levo FROM takmicenja'), '');
    assert.equal(t.baza.vrednost('SELECT grb_desno FROM takmicenja'), '');
  } finally { t.ukloni(); }
});

test('uvoz PHP zip-a: nepoznata kolona prekida uvoz', () => {
  const t = nova('1.0.0');
  try {
    t.baza.ubaci('klubovi', { puno_ime: 'Ostaje', skracenica: 'OST', grad: '', kreirano: 'x', izmenjeno: 'x' });
    const nepoznata = bazaSql().replace('(`id`, `puno_ime`, `skracenica`,', '(`id`, `puno_ime`, `tudja_kolona`,');
    t.baza.ubaci('klubovi', { puno_ime: 'Drugi', skracenica: 'DRG', grad: '', kreirano: 'x', izmenjeno: 'x' });
    assert.throws(() => t.k.vrati(napraviZip(t, OPIS, nepoznata, 'kolona.zip')),
      (e) => e instanceof GreskaKorisnika && /Vraćanje prekinuto na naredbi \d+ od \d+: tabela klubovi nema kolonu tudja_kolona/.test(e.message));
    assert.equal(t.baza.vrednost("SELECT COUNT(*) FROM klubovi WHERE puno_ime = 'Drugi'"), 1);
  } finally { t.ukloni(); }
});

test('uvoz PHP zip-a: izabrana fascikla kopija ostaje, sigurnosna kopija je na listi', () => {
  const t = nova('1.0.0');
  try {
    const usb = path.join(t.dir, 'usb');
    t.k.postaviFasciklu(usb);
    const r = t.k.vrati(napraviZip(t, OPIS));
    assert.equal(t.podesavanja.daj('kopije_fascikla'), usb);
    assert.equal(t.k.fascikla(), usb);
    assert.ok(t.k.lista().some((x) => x.ime === r.sigurnosna && x.opis.vrsta === 'pre_vracanja'));
    assert.equal(Number(t.baza.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc = 'kopije_fascikla'")), 1);
  } finally { t.ukloni(); }
});
