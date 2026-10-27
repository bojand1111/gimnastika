// Faza 7: IPC modul kopija nad pravom (fajl) bazom; dijalog i shell su stubovi.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { napraviModule } = require('../electron/moduli.cjs');

const dn = { info() {}, greska() {} };
const SAD = '2026-10-01 18:44:06';

function pravi(opcije = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ipc-kop-'));
  const baza = otvori(path.join(dir, 'gimnastika.sqlite'));
  baza.migriraj();
  pocetniPodaci(baza);
  const poziv = { dijalog: [], shell: [], obavesti: [] };
  const dialog = {
    odgovor: { canceled: true, filePaths: [] },
    showOpenDialog: async (...a) => { poziv.dijalog.push(a); return dialog.odgovor; },
  };
  const shell = { showItemInFolder: (p) => poziv.shell.push(p) };
  const moduli = napraviModule(baza, {
    dialog, shell, fasciklaPodataka: () => dir, dnevnik: dn, verzija: opcije.verzija ?? '1.0.0',
    roditelj: opcije.roditelj, obavesti: (x) => poziv.obavesti.push(x),
  });
  const ukloni = () => { try { baza.zatvori(); } catch { /* vec zatvorena */ } fs.rmSync(dir, { recursive: true, force: true }); };
  return { dir, baza, moduli, dialog, shell, poziv, ukloni };
}

const klub = (baza, naziv, skr) => baza.ubaci('klubovi', { puno_ime: naziv, skracenica: skr, grad: '', kreirano: SAD, izmenjeno: SAD });
const brojKlubova = (baza) => Number(baza.vrednost('SELECT COUNT(*) FROM klubovi'));

test('guard: MODULI.kopija i handleri se poklapaju (registruj)', () => {
  const t = pravi();
  try {
    assert.deepEqual(MODULI.kopija, ['podaci', 'napravi', 'vrati', 'izaberiFajl', 'izaberiFasciklu', 'podrazumevanaFascikla', 'prikazi']);
    assert.deepEqual(Object.keys(t.moduli.kopija).sort(), [...MODULI.kopija].sort());
    const ipc = { kanali: {}, handle(k, fn) { this.kanali[k] = fn; } };
    registruj(ipc, t.moduli, dn, Object.fromEntries(Object.keys(t.moduli).map((k) => [k, MODULI[k]])));
    for (const r of MODULI.kopija) assert.ok(ipc.kanali[`gim:kopija:${r}`], r);
  } finally { t.ukloni(); }
});

test('podaci: bez kopija, oblik se moze klonirati', () => {
  const t = pravi();
  try {
    const d = t.moduli.kopija.podaci();
    assert.deepEqual(d.kopije, []);
    assert.equal(d.poslednjaTekst, 'Još nema nijedne kopije.');
    assert.equal(d.fascikla.putanja, path.join(t.dir, 'kopije'));
    assert.equal(d.fascikla.podrazumevana, true);
    assert.equal(d.fascikla.nedostupna, false);
    assert.equal(d.verzija, '1.0.0');
    assert.equal(d.bazaVerzija, '004_redosled_po_rotaciji');
    assert.equal(d.VRSTE.rucna, 'Ručna');
    structuredClone(d);
  } finally { t.ukloni(); }
});

test('napravi: vraca ime i tekst velicine; podaci je prikazuje', () => {
  const t = pravi();
  try {
    const r = t.moduli.kopija.napravi();
    assert.match(r.ime, /^kopija_\d{4}-\d\d-\d\d_\d{4}(_\d+)?\.sqlite$/);
    assert.match(r.velicinaTekst, /^\d+(\.\d+)* KB$|^\d+,\d MB$/);
    assert.deepEqual(Object.keys(r).sort(), ['ime', 'velicinaTekst']);
    const d = t.moduli.kopija.podaci();
    assert.equal(d.kopije.length, 1);
    const k = d.kopije[0];
    assert.equal(k.ime, r.ime);
    assert.equal(k.velicinaTekst, r.velicinaTekst);
    assert.equal(k.vrstaTekst, 'Ručna');
    assert.equal(k.format, 'sqlite');
    assert.equal(k.opis.vrsta, 'rucna');
    assert.match(k.vremeTekst, /^\d\d\.\d\d\.\d{4}\. \d\d:\d\d$/);
    assert.match(d.poslednjaTekst, /^Poslednja kopija: danas u \d\d:\d\d\.$/);
    structuredClone(d);
  } finally { t.ukloni(); }
});

test('podaci: fajl bez opisa je neispravan (opis null, vrstaTekst prazan)', () => {
  const t = pravi();
  try {
    fs.mkdirSync(path.join(t.dir, 'kopije'));
    fs.writeFileSync(path.join(t.dir, 'kopije', 'kopija_2020-01-01_0000.sqlite'), 'nije baza');
    const k = t.moduli.kopija.podaci().kopije[0];
    assert.equal(k.opis, null);
    assert.equal(k.vrstaTekst, '');
  } finally { t.ukloni(); }
});

test('vrati po imenu: menja podatke, pravi pre_vracanja, javlja vraceni', async () => {
  const t = pravi();
  try {
    const kop = t.moduli.kopija.napravi();
    klub(t.baza, 'Posle kopije', 'PK');
    assert.equal(brojKlubova(t.baza), 1);
    const r = await t.moduli.kopija.vrati(kop.ime);
    assert.equal(brojKlubova(t.baza), 0);
    assert.equal(r.ime, kop.ime);
    assert.equal(r.verzija, '1.0.0');
    assert.match(r.vreme, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    assert.match(r.sigurnosna, /^kopija_.*\.sqlite$/);
    assert.equal(r.uvoz, false);
    assert.match(r.poruka, new RegExp(`^Podaci su vraćeni iz ${kop.ime.replace('.', '\\.')} \\(verzija 1\\.0\\.0, \\d\\d\\.\\d\\d\\.\\d{4}\\. \\d\\d:\\d\\d\\)\\. Stanje pre vraćanja je sačuvano kao ${r.sigurnosna.replace('.', '\\.')}\\.$`));
    const pre = t.moduli.kopija.podaci().kopije.find((x) => x.ime === r.sigurnosna);
    assert.equal(pre.opis.vrsta, 'pre_vracanja');
    assert.equal(pre.vrstaTekst, 'Pre vraćanja');
    assert.equal(t.poziv.obavesti.length, 1);
    assert.equal(t.poziv.obavesti[0].ime, kop.ime);
    // baza je i dalje upotrebljiva i bez kopija_opis
    assert.ok(!t.baza.tabele().includes('kopija_opis'));
    structuredClone(r);
  } finally { t.ukloni(); }
});

test('vrati iz izabranog fajla ({putanja}): prima apsolutnu putanju', async () => {
  const t = pravi();
  try {
    const kop = t.moduli.kopija.napravi();
    const spolja = path.join(t.dir, 'spolja.sqlite');
    fs.copyFileSync(path.join(t.dir, 'kopije', kop.ime), spolja);
    klub(t.baza, 'Posle kopije', 'PK');
    const r = await t.moduli.kopija.vrati({ putanja: spolja });
    assert.equal(r.ime, 'spolja.sqlite');
    assert.equal(brojKlubova(t.baza), 0);
    await assert.rejects(() => t.moduli.kopija.vrati({ putanja: path.join(t.dir, 'nema.sqlite') }),
      (e) => e instanceof GreskaKorisnika && e.message.startsWith('Vraćanje nije uspelo: '));
    await assert.rejects(() => t.moduli.kopija.vrati({ putanja: 'relativno.sqlite' }),
      (e) => e instanceof GreskaKorisnika && e.message.startsWith('Vraćanje nije uspelo: '));
  } finally { t.ukloni(); }
});

test('vrati: kopija iz novije verzije daje poruku sa prefiksom, podaci ostaju', async () => {
  const t = pravi();
  try {
    const kop = t.moduli.kopija.napravi();
    const c = new DatabaseSync(path.join(t.dir, 'kopije', kop.ime));
    c.exec("UPDATE kopija_opis SET vrednost = '9.9.9' WHERE kljuc = 'verzija'");
    c.close();
    klub(t.baza, 'Ostaje', 'OST');
    await assert.rejects(() => t.moduli.kopija.vrati(kop.ime), (e) => e instanceof GreskaKorisnika && e.message ===
      'Vraćanje nije uspelo: Kopija je iz novije verzije aplikacije (9.9.9) nego što je instalirana (1.0.0). Prvo ažurirajte aplikaciju.');
    assert.equal(brojKlubova(t.baza), 1);
    assert.equal(t.poziv.obavesti.length, 0);
  } finally { t.ukloni(); }
});

test('izaberiFajl: otkazano je null, izbor vraca punu putanju, filteri iz POPIS 6.4', async () => {
  const t = pravi();
  try {
    assert.equal(await t.moduli.kopija.izaberiFajl(), null);
    t.dialog.odgovor = { canceled: false, filePaths: ['E:\\usb\\kopija.sqlite'] };
    assert.equal(await t.moduli.kopija.izaberiFajl(), 'E:\\usb\\kopija.sqlite');
    const opcije = t.poziv.dijalog[0].at(-1);
    assert.deepEqual(opcije.properties, ['openFile']);
    assert.deepEqual(opcije.filters, [{ name: 'Rezervne kopije', extensions: ['sqlite', 'zip'] }]);
  } finally { t.ukloni(); }
});

test('izaberiFasciklu: otkazano null, izbor postavlja fasciklu; podrazumevanaFascikla vraca poruku', async () => {
  const t = pravi({ roditelj: () => ({ id: 'prozor' }) });
  try {
    assert.equal(await t.moduli.kopija.izaberiFasciklu(), null);
    const nova = path.join(t.dir, 'usb', 'kopije');
    t.dialog.odgovor = { canceled: false, filePaths: [nova] };
    const r = await t.moduli.kopija.izaberiFasciklu();
    assert.deepEqual(r, { poruka: `Fascikla za kopije je promenjena: ${nova}` });
    const opcije = t.poziv.dijalog.at(-1).at(-1);
    assert.deepEqual(opcije.properties, ['openDirectory', 'createDirectory']);
    assert.deepEqual(t.poziv.dijalog.at(-1)[0], { id: 'prozor' });
    const d = t.moduli.kopija.podaci();
    assert.equal(d.fascikla.putanja, nova);
    assert.equal(d.fascikla.podrazumevana, false);
    assert.deepEqual(t.moduli.kopija.podrazumevanaFascikla(), { poruka: 'Kopije se ponovo čuvaju u podrazumevanoj fascikli.' });
    assert.equal(t.moduli.kopija.podaci().fascikla.podrazumevana, true);
  } finally { t.ukloni(); }
});

test('prikazi: prosledjuje punu putanju u shell; losa imena su GreskaKorisnika', () => {
  const t = pravi();
  try {
    const kop = t.moduli.kopija.napravi();
    assert.deepEqual(t.moduli.kopija.prikazi(kop.ime), { ok: true });
    assert.deepEqual(t.poziv.shell, [path.join(t.dir, 'kopije', kop.ime)]);
    assert.throws(() => t.moduli.kopija.prikazi('..\\x'), (e) => e instanceof GreskaKorisnika && e.message === 'Nevažeće ime fajla.');
    assert.throws(() => t.moduli.kopija.prikazi('nema.sqlite'), (e) => e instanceof GreskaKorisnika && e.message === 'Fajl ne postoji: nema.sqlite');
    assert.equal(t.poziv.shell.length, 1);
  } finally { t.ukloni(); }
});

test('pocetna.podaci koristi stvarnu listu kopija', () => {
  const t = pravi();
  try {
    assert.equal(t.moduli.pocetna.podaci().poslednjaKopija, null);
    const kop = t.moduli.kopija.napravi();
    const p = t.moduli.pocetna.podaci().poslednjaKopija;
    assert.equal(p.ime, kop.ime);
    assert.equal(p.danas, true);
  } finally { t.ukloni(); }
});

test('grb: samo grb/<ime> ostaje, sve ostalo je prazno', () => {
  const t = pravi();
  try {
    fs.mkdirSync(path.join(t.dir, 'grb'));
    fs.writeFileSync(path.join(t.dir, 'grb', 'levo.png'), 'x');
    fs.writeFileSync(path.join(t.dir, 'tajna.txt'), 'x');
    const url = (v) => {
      t.baza.izvrsi("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('grb_levo', ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost", [v]);
      return t.moduli.podesavanja.sva().grb_levo_url;
    };
    assert.match(url('grb/levo.png'), /^file:\/\/.*\/grb\/levo\.png\?v=\d+$/);
    for (const lose of ['tajna.txt', '../tajna.txt', 'grb/../tajna.txt', 'grb/a/b.png', 'grb/..', 'grb/.', 'C:\\Windows\\win.ini', '\\\\server\\s\\x.png', '/etc/passwd', 'grb/']) {
      assert.equal(url(lose), '', lose);
    }
  } finally { t.ukloni(); }
});
