const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { otvori, Baza } = require('../electron/baza/baza.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { napravi, PODRAZUMEVANO, POLNI_KLJUCEVI } = require('../electron/modeli/podesavanja.cjs');
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

test('PODRAZUMEVANO ima 14 kljuceva i nema starog aktivnog takmicenja', () => {
  assert.equal(Object.keys(PODRAZUMEVANO).length, 14);
  assert.equal('aktivno_takmicenje' in PODRAZUMEVANO, false);
  assert.equal(PODRAZUMEVANO.aktivni_pol, 'M');
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
    assert.equal(p.daj('organizator'), 'Drugi');
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
    const id = baza.ubaci('takmicenja', { naziv: 'T', datum: '2026-10-25', pol: 'M', kreirano: sad, izmenjeno: sad });
    p.postaviAktivno(id, 'M');
    assert.equal(p.aktivnoTakmicenjeId(), id);
    assert.equal(p.aktivno().naziv, 'T');
    p.postaviAktivno(9999, 'M');
    assert.equal(p.aktivno(), null);
  } finally { ocisti(dir); }
});

test('sacuvajOpsta: nedozvoljen izbor ostaje, prag se ogranicava, organizator trim', () => {
  const { p, dir } = nova();
  try {
    p.sacuvajOpsta({ e_zaokruzivanje: 'pogresno', plasman_isti_rezultat: 'visa_e_pa_d', lekarski_prag_dana: '400', organizator: ' GSV ' });
    assert.equal(p.dajPol('e_zaokruzivanje', 'M'), 'odseci');
    assert.equal(p.dajPol('plasman_isti_rezultat', 'M'), 'visa_e_pa_d');
    assert.equal(p.daj('lekarski_prag_dana'), '365');
    assert.equal(p.dajPol('organizator', 'M'), 'GSV');
    p.sacuvajOpsta({ lekarski_prag_dana: 'abc', organizator: '' });
    assert.equal(p.daj('lekarski_prag_dana'), '0');
    assert.equal(p.dajPol('organizator', 'M'), '');
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
    assert.equal(p.dajPol('grb_levo', 'M'), 'grb/grb_levo_M.png');
    assert.equal(fs.readFileSync(path.join(dir, 'grb', 'grb_levo_M.png'), 'utf8'), 'png-podaci');
    // pregazi
    fs.writeFileSync(slika, 'novo');
    p.sacuvajOpsta({ grb_levo: { putanja: slika } });
    assert.equal(fs.readFileSync(path.join(dir, 'grb', 'grb_levo_M.png'), 'utf8'), 'novo');

    const tekst = path.join(izvor, 'x.txt');
    fs.writeFileSync(tekst, 'x');
    assert.throws(() => p.sacuvajOpsta({ organizator: 'Novi', grb_desno: { putanja: tekst } }),
      (e) => e instanceof GreskaKorisnika && e.message === 'Grb mora biti PNG, JPG, GIF ili SVG slika.');
    assert.equal(p.dajPol('organizator', 'M'), '');
    assert.equal(p.dajPol('grb_desno', 'M'), '');

    p.sacuvajOpsta({ organizator: 'Z' });
    assert.equal(p.dajPol('grb_levo', 'M'), 'grb/grb_levo_M.png');
    p.sacuvajOpsta({ grb_levo: { obrisi: true } });
    assert.equal(p.dajPol('grb_levo', 'M'), '');
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
    assert.equal(p.dajPol('organizator', 'M'), '');
    assert.equal(p.dajPol('grb_levo', 'M'), '');

    fs.mkdirSync(path.join(dir, 'grb'));
    const cuvan = path.join(dir, 'grb', 'grb_levo_M.png');
    fs.writeFileSync(cuvan, 'stari');
    p.sacuvajOpsta({ grb_levo: { putanja: cuvan } });
    assert.equal(p.dajPol('grb_levo', 'M'), 'grb/grb_levo_M.png');
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
    for (const ok of ['http://localhost:3000', 'http://[::1]:8080/', 'https://sajt.rs']) {
      p.sacuvajOpsta({ sajt_url: ok });
      assert.equal(p.sva().sajt_url, ok.replace(/\/+$/, ''));
    }
    assert.equal(p.sva().sajt_token, 'tajna', 'nedostavljen kljuc se ne dira');
    p.sacuvajOpsta({ sajt_url: '', sajt_token: '' });
    assert.equal(p.sva().sajt_url, '');
    assert.equal(p.sva().sajt_token, '');
  } finally { ocisti(dir); }
});

test('sacuvajOpsta: sajt_url bez http:// ili https:// baca poruku i nista ne upisuje', () => {
  const { dir, p } = nova();
  try {
    for (const lose of ['rezultati.example.rs', 'ftp://x.rs', 'httpx://x', ' www.x.rs ', 'http://example.rs', 'http://127.0.0.1.evil.rs', 'https://']) {
      assert.throws(() => p.sacuvajOpsta({ organizator: 'Neko', sajt_url: lose }), (e) => e instanceof GreskaKorisnika
        && e.message === 'Adresa sajta mora da počinje sa https:// (http:// samo za localhost).');
    }
    for (const lose of ['https://korisnik:lozinka@sajt.rs', 'https://sajt.rs/?a=1', 'https://sajt.rs/#x', 'https://sajt.rs?']) {
      assert.throws(() => p.sacuvajOpsta({ sajt_url: lose }), (e) => e instanceof GreskaKorisnika
        && e.message === 'Adresa sajta ne sme da sadrži korisničko ime, lozinku ni upit.');
    }
    assert.equal(p.sva().organizator, '', 'nista nije upisano');
    assert.equal(p.sva().sajt_url, '');
  } finally { ocisti(dir); }
});

test('dajPol nasledjuje staru vrednost', () => {
  const { p, dir } = nova();
  try {
    p.postavi('e_zaokruzivanje', 'zaokruzi');
    assert.equal(p.dajPol('e_zaokruzivanje', 'M'), 'zaokruzi');
    assert.equal(p.dajPol('e_zaokruzivanje', 'Z'), 'zaokruzi');
    p.postavi('e_zaokruzivanje_Z', 'odseci');
    assert.equal(p.dajPol('e_zaokruzivanje', 'Z'), 'odseci');
    assert.equal(p.dajPol('e_zaokruzivanje', 'M'), 'zaokruzi');
    assert.equal(p.dajPol('nepoznat_kljuc', 'M', 'x'), 'x');
  } finally { ocisti(dir); }
});

test('sacuvajOpsta po polu ne dira drugi pol', () => {
  const { p, dir } = nova();
  try {
    p.sacuvajOpsta({ plasman_isti_rezultat: 'visa_e_pa_d' }, 'Z');
    assert.equal(p.dajPol('plasman_isti_rezultat', 'Z'), 'visa_e_pa_d');
    assert.equal(p.dajPol('plasman_isti_rezultat', 'M'), 'deli');
    assert.equal(p.sva('Z').plasman_isti_rezultat, 'visa_e_pa_d');
    assert.equal(p.sva('Z').pol, 'Z');
    assert.equal(p.sva('M').plasman_isti_rezultat, 'deli');
    assert.deepEqual(POLNI_KLJUCEVI, ['e_zaokruzivanje', 'plasman_isti_rezultat', 'viseboj_nepotpun', 'lekarski_sprecava_prijavu', 'organizator', 'grb_levo', 'grb_desno']);
    assert.deepEqual(p.POLNI_KLJUCEVI, POLNI_KLJUCEVI);
    assert.throws(() => p.sacuvajOpsta({ organizator: 'X' }, 'Q'), (e) => e instanceof GreskaKorisnika && e.message === 'Nepoznat pol.');
  } finally { ocisti(dir); }
});

test('grb se cuva po polu kao grb/<kljuc>_<pol>.<ext>', () => {
  const { p, dir } = nova();
  const izvor = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-izv-'));
  try {
    const slika = path.join(izvor, 'g.png');
    fs.writeFileSync(slika, 'z-grb');
    p.sacuvajOpsta({ grb_desno: { putanja: slika } }, 'Z');
    assert.equal(p.dajPol('grb_desno', 'Z'), 'grb/grb_desno_Z.png');
    assert.equal(p.dajPol('grb_desno', 'M'), '');
    assert.equal(fs.readFileSync(path.join(dir, 'grb', 'grb_desno_Z.png'), 'utf8'), 'z-grb');
    p.sacuvajOpsta({ grb_desno: { obrisi: true } }, 'Z');
    assert.equal(p.dajPol('grb_desno', 'Z'), '');
  } finally { ocisti(dir); ocisti(izvor); }
});

test('lekarski prag ostaje zajednicki', () => {
  const { p, dir } = nova();
  try {
    p.sacuvajOpsta({ lekarski_prag_dana: 10 }, 'Z');
    assert.equal(p.daj('lekarski_prag_dana'), '10');
    assert.equal(p.dajInt('lekarski_prag_dana'), 10);
  } finally { ocisti(dir); }
});

test('aktivno po polu', () => {
  const { baza, p, dir } = nova();
  try {
    const sad = Baza.sad();
    const Mid = baza.ubaci('takmicenja', { naziv: 'M', datum: '2026-10-25', pol: 'M', kreirano: sad, izmenjeno: sad });
    const Zid = baza.ubaci('takmicenja', { naziv: 'Z', datum: '2026-10-25', pol: 'Z', kreirano: sad, izmenjeno: sad });
    assert.equal(p.aktivniPol(), 'M');
    p.postaviAktivno(Zid, 'Z');
    p.postaviPol('M');
    assert.equal(p.aktivno(), null);
    assert.equal(p.aktivnoTakmicenjeId(), null);
    p.postaviPol('Z');
    assert.equal(p.aktivniPol(), 'Z');
    assert.equal(p.aktivno().id, Zid);
    assert.equal(p.aktivnoTakmicenjeId('Z'), Zid);
    // red drugog pola se ne vraca
    p.postaviAktivno(Mid, 'Z');
    assert.equal(p.aktivno('Z'), null);
    p.postaviAktivno(null, 'Z');
    assert.equal(p.aktivnoTakmicenjeId('Z'), null);
    assert.equal(p.daj('aktivno_takmicenje_Z'), '');
  } finally { ocisti(dir); }
});

test('aktivniPol: nepoznata ili prazna vrednost je M', () => {
  const { p, dir } = nova();
  try {
    p.postavi('aktivni_pol', '');
    assert.equal(p.aktivniPol(), 'M');
    p.postavi('aktivni_pol', 'X');
    assert.equal(p.aktivniPol(), 'M');
  } finally { ocisti(dir); }
});

test('postaviPol odbija nepoznat', () => {
  const { p, dir } = nova();
  try {
    assert.throws(() => p.postaviPol('X'), (e) => e instanceof GreskaKorisnika && e.message === 'Nepoznat pol.');
    assert.equal(p.aktivniPol(), 'M');
  } finally { ocisti(dir); }
});
