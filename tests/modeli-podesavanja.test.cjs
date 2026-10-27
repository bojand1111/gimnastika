const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otvori, Baza } = require('../electron/baza/baza.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { napravi, PODRAZUMEVANO } = require('../electron/modeli/podesavanja.cjs');
const seme = require('../electron/baza/seme.cjs');

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-pod-'));
  return { baza, dir, p: napravi(baza, dir) };
}

function ocisti(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('PODRAZUMEVANO ima 12 kljuceva', () => {
  assert.equal(Object.keys(PODRAZUMEVANO).length, 12);
});

test('daj na praznoj tabeli vraca podrazumevano, postavi pa daj', () => {
  const { p, dir } = nova();
  try {
    assert.equal(p.daj('lekarski_prag_dana'), '30');
    assert.equal(p.dajInt('lekarski_prag_dana'), 30);
    assert.equal(p.daj('nepoznat', 'x'), 'x');
    p.postavi('organizator', 'GSV');
    assert.equal(p.daj('organizator'), 'GSV');
    p.postavi('organizator', 'Drugi');
    assert.equal(p.sva().organizator, 'Drugi');
    p.postavi('lekarski_prag_dana', '');
    assert.equal(p.dajInt('lekarski_prag_dana', 7), 7);
  } finally { ocisti(dir); }
});

test('aktivno takmicenje: prazno je null, postavljeno vraca red', () => {
  const { baza, p, dir } = nova();
  try {
    assert.equal(p.aktivnoTakmicenjeId(), null);
    assert.equal(p.aktivno(), null);
    const sad = Baza.sad();
    const id = baza.ubaci('takmicenja', { naziv: 'T', datum: '2026-10-25', kreirano: sad, izmenjeno: sad });
    p.postavi('aktivno_takmicenje', String(id));
    assert.equal(p.aktivnoTakmicenjeId(), id);
    assert.equal(p.aktivno().naziv, 'T');
    p.postavi('aktivno_takmicenje', '9999');
    assert.equal(p.aktivno(), null);
  } finally { ocisti(dir); }
});

test('sacuvajOpsta: nedozvoljen izbor ostaje, prag se ogranicava, organizator trim', () => {
  const { p, dir } = nova();
  try {
    p.sacuvajOpsta({ e_zaokruzivanje: 'pogresno', plasman_isti_rezultat: 'visa_e_pa_d', lekarski_prag_dana: '400', organizator: ' GSV ' });
    assert.equal(p.daj('e_zaokruzivanje'), 'odseci');
    assert.equal(p.daj('plasman_isti_rezultat'), 'visa_e_pa_d');
    assert.equal(p.daj('lekarski_prag_dana'), '365');
    assert.equal(p.daj('organizator'), 'GSV');
    p.sacuvajOpsta({ lekarski_prag_dana: 'abc', organizator: '' });
    assert.equal(p.daj('lekarski_prag_dana'), '0');
    assert.equal(p.daj('organizator'), '');
    p.sacuvajOpsta({ lekarski_prag_dana: '-5' });
    assert.equal(p.daj('lekarski_prag_dana'), '0');
  } finally { ocisti(dir); }
});

test('sacuvajOpsta: grb se kopira i upisuje, .txt baca bez ikakvog upisa', () => {
  const { p, dir } = nova();
  const izvor = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-izv-'));
  try {
    const slika = path.join(izvor, 'Grb.PNG');
    fs.writeFileSync(slika, 'png-podaci');
    p.sacuvajOpsta({ grb_levo: { putanja: slika } });
    assert.equal(p.daj('grb_levo'), 'grb/grb_levo.png');
    assert.equal(fs.readFileSync(path.join(dir, 'grb', 'grb_levo.png'), 'utf8'), 'png-podaci');
    // pregazi
    fs.writeFileSync(slika, 'novo');
    p.sacuvajOpsta({ grb_levo: { putanja: slika } });
    assert.equal(fs.readFileSync(path.join(dir, 'grb', 'grb_levo.png'), 'utf8'), 'novo');

    const tekst = path.join(izvor, 'x.txt');
    fs.writeFileSync(tekst, 'x');
    assert.throws(() => p.sacuvajOpsta({ organizator: 'Novi', grb_desno: { putanja: tekst } }),
      (e) => e instanceof GreskaKorisnika && e.message === 'Grb mora biti PNG, JPG, GIF ili SVG slika.');
    assert.equal(p.daj('organizator'), '');
    assert.equal(p.daj('grb_desno'), '');

    p.sacuvajOpsta({ organizator: 'Z' });
    assert.equal(p.daj('grb_levo'), 'grb/grb_levo.png');
    p.sacuvajOpsta({ grb_levo: { obrisi: true } });
    assert.equal(p.daj('grb_levo'), '');
  } finally { ocisti(dir); ocisti(izvor); }
});

test('seme: dva puta daje 10 sprava i prag jednom', () => {
  const baza = otvori(':memory:');
  baza.migriraj();
  assert.deepEqual(seme.pocetniPodaci(baza), { sprave: 10, podesavanja: 1 });
  assert.deepEqual(seme.pocetniPodaci(baza), { sprave: 0, podesavanja: 0 });
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM sprave'), 10);
  assert.equal(baza.vrednost("SELECT vrednost FROM podesavanja WHERE kljuc = 'lekarski_prag_dana'"), '30');
  const m = baza.svi("SELECT naziv, skracenica, redosled, ikona FROM sprave WHERE pol = 'M' ORDER BY redosled");
  assert.deepEqual(m.map((r) => r.skracenica), ['PA', 'KH', 'KA', 'PR', 'RA', 'VR']);
  assert.equal(m[1].naziv, 'Konj sa hvataljkama');
  assert.equal(m[0].ikona, 'sprava-PA');
  const z = baza.svi("SELECT skracenica FROM sprave WHERE pol = 'Z' ORDER BY redosled");
  assert.deepEqual(z.map((r) => r.skracenica), ['PR', 'DR', 'GR', 'PA']);
});

test('sacuvajOpsta: slika koja ne postoji baca bez upisa; vec sacuvani fajl prolazi', () => {
  const { p, dir } = nova();
  try {
    assert.throws(() => p.sacuvajOpsta({ organizator: 'Novi', grb_levo: { putanja: path.join(dir, 'nema.png') } }),
      (e) => e instanceof GreskaKorisnika && e.message === 'Izabrana slika više ne postoji.');
    assert.equal(p.daj('organizator'), '');
    assert.equal(p.daj('grb_levo'), '');

    fs.mkdirSync(path.join(dir, 'grb'));
    const cuvan = path.join(dir, 'grb', 'grb_levo.png');
    fs.writeFileSync(cuvan, 'stari');
    p.sacuvajOpsta({ grb_levo: { putanja: cuvan } });
    assert.equal(p.daj('grb_levo'), 'grb/grb_levo.png');
    assert.equal(fs.readFileSync(cuvan, 'utf8'), 'stari');
  } finally { ocisti(dir); }
});

test('sacuvajOpsta: sajt_url trim, kosa crta na kraju se skida, prazno je dozvoljeno, token trim', () => {
  const { dir, p } = nova();
  try {
    assert.equal(p.sva().sajt_url, '');
    assert.equal(p.sva().sajt_token, '');
    p.sacuvajOpsta({ sajt_url: '  https://rezultati.example.rs/  ', sajt_token: '  tajna  ' });
    assert.equal(p.sva().sajt_url, 'https://rezultati.example.rs');
    assert.equal(p.sva().sajt_token, 'tajna');
    p.sacuvajOpsta({ sajt_url: 'http://127.0.0.1:8080' });
    assert.equal(p.sva().sajt_url, 'http://127.0.0.1:8080');
    assert.equal(p.sva().sajt_token, 'tajna', 'nedostavljen kljuc se ne dira');
    p.sacuvajOpsta({ sajt_url: '', sajt_token: '' });
    assert.equal(p.sva().sajt_url, '');
    assert.equal(p.sva().sajt_token, '');
  } finally { ocisti(dir); }
});

test('sacuvajOpsta: sajt_url bez http:// ili https:// baca poruku i nista ne upisuje', () => {
  const { dir, p } = nova();
  try {
    for (const lose of ['rezultati.example.rs', 'ftp://x.rs', 'httpx://x', ' www.x.rs ']) {
      assert.throws(() => p.sacuvajOpsta({ organizator: 'Neko', sajt_url: lose }), (e) => e instanceof GreskaKorisnika
        && e.message === 'Adresa sajta mora da počinje sa http:// ili https://.');
    }
    assert.equal(p.sva().organizator, '', 'nista nije upisano');
    assert.equal(p.sva().sajt_url, '');
  } finally { ocisti(dir); }
});
