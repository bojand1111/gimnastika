// Faza 3: IPC moduli takmicenja, prijave, uvoz nad :memory: bazom.
const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika, OPSTA_GRESKA } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

function lazniIpc() {
  return { kanali: {}, handle(kanal, fn) { this.kanali[kanal] = fn; } };
}
function laznidnevnik() {
  return { poziva: 0, info() {}, greska() { this.poziva++; } };
}

// Svi privremeni folderi se brisu na kraju fajla, i kad test padne pre svog cisti(dir).
const napravljeni = [];
after(() => { for (const d of napravljeni) fs.rmSync(d, { recursive: true, force: true }); });

function pravi(dialogOdgovor = { canceled: true, filePaths: [] }) {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ipc3-'));
  napravljeni.push(dir);
  const dn = laznidnevnik();
  const moduli = napraviModule(baza, { dialog: { showOpenDialog: async () => dialogOdgovor }, fasciklaPodataka: () => dir, dnevnik: dn });
  return { baza, dir, moduli, dn };
}
const NEMA_AKTIVNOG = 'Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.';
const cisti = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('guard: svi moduli iz MODULI imaju handler (nema viska ni manjka)', () => {
  const { moduli, dir } = pravi();
  for (const k of ['takmicenja', 'prijave', 'uvoz']) assert.ok(MODULI[k], `MODULI.${k}`);
  const ipc = lazniIpc();
  registruj(ipc, moduli, laznidnevnik(), Object.fromEntries(Object.keys(moduli).map((k) => [k, MODULI[k]])));
  for (const k of ['takmicenja', 'prijave', 'uvoz']) {
    for (const r of MODULI[k]) assert.ok(ipc.kanali[`gim:${k}:${r}`], `${k}:${r}`);
  }
  cisti(dir);
});

test('bez aktivnog takmicenja prijave i uvoz bacaju poruku', async () => {
  const { moduli, dir } = pravi();
  assert.throws(() => moduli.prijave.podaci(null), (e) => e instanceof GreskaKorisnika && e.message === NEMA_AKTIVNOG);
  assert.throws(() => moduli.prijave.stanje(), /Nema aktivnog/);
  await assert.rejects(async () => moduli.uvoz.pripremi(['x.docx']), (e) => e.message === NEMA_AKTIVNOG);
  cisti(dir);
});

test('takmicenja.sacuvaj: novo postaje aktivno, izmena ne; obrisi prazni aktivno', () => {
  const { moduli, dir } = pravi();
  const unos = { naziv: 'Kup', datum: '17.10.2026.', mesto: 'NS', broj_e_sudija: '4', pravilo_e: 'odbaci_krajnje', ekipno_broji: '3' };
  assert.deepEqual(moduli.takmicenja.sacuvaj(unos, null), { id: 1, novo: true, aktivno: true });
  assert.equal(moduli.podesavanja.aktivno().id, 1);
  assert.equal(moduli.takmicenja.sacuvaj({ ...unos, naziv: 'Drugo' }, '').id, 2);
  moduli.takmicenja.otvori('1');
  assert.deepEqual(moduli.takmicenja.sacuvaj({ ...unos, naziv: 'Kup 2' }, '2'), { id: 2, novo: false, aktivno: false });
  assert.equal(moduli.podesavanja.aktivno().id, 1);
  moduli.takmicenja.obrisi('2');
  assert.equal(moduli.podesavanja.aktivno().id, 1);
  moduli.takmicenja.obrisi('1');
  assert.equal(moduli.podesavanja.aktivno(), null);
  cisti(dir);
});

test('takmicenja.otvori vraca korak po POPIS 4.5', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  assert.throws(() => moduli.takmicenja.otvori(999), /Takmičenje ne postoji\./);
  let r = moduli.takmicenja.otvori(String(s.takm));
  assert.equal(r.korak, 'prijave');
  assert.equal(r.naziv, 'Test kup');
  assert.equal(r.stanje.prijava, 0);
  assert.equal(moduli.podesavanja.aktivno().id, s.takm);
  assert.equal(moduli.prijave.dodaj([s.t.Ana]).dodato, 1);
  r = moduli.takmicenja.otvori(s.takm);
  assert.equal(r.korak, 'rotacije');
  assert.equal(r.stanje.prijava, 1);
  assert.equal(r.stanje.nerasporedjeni, 1);
  const pid = moduli.prijave.podaci(null).prijave[0].id;
  moduli.prijave.izmeni(pid, 'kategorija_id', '');
  r = moduli.takmicenja.otvori(s.takm);
  assert.equal(r.korak, 'prijave');
  assert.equal(r.stanje.nepotpune, 1);
  const sva = moduli.takmicenja.sva();
  assert.equal(sva[0].status, 'aktivno');
  assert.equal(sva[0].stanje.prijava, 1);
  assert.equal(sva[0].broj_prijava, 1);
  structuredClone(r);
  cisti(dir);
});

test('takmicenja.sacuvajGrb i ukloniGrb: nepostojece takmicenje', () => {
  const { moduli, dir } = pravi();
  assert.throws(() => moduli.takmicenja.sacuvajGrb(999, 'grb_levo', 'nema.png'), (e) => e instanceof GreskaKorisnika && e.message === 'Takmičenje ne postoji.');
  assert.throws(() => moduli.takmicenja.ukloniGrb(999, 'grb_levo'), (e) => e instanceof GreskaKorisnika && e.message === 'Takmičenje ne postoji.');
  cisti(dir);
});

test('takmicenja.otvori vraca korak spremno kad su grupe rasporedjene', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(s.takm);
  moduli.prijave.dodaj([s.t.Ana]);
  const pid = moduli.prijave.podaci(null).prijave[0].id;
  const S = '2026-10-22 10:00:00';
  const gid = baza.ubaci('grupe', { takmicenje_id: s.takm, pol: 'Z', naziv: 'GZ', redosled: 0, pocetna_pozicija: 1, kreirano: S, izmenjeno: S });
  baza.ubaci('grupa_clanovi', { grupa_id: gid, prijava_id: pid, redosled: 0 });
  assert.equal(moduli.takmicenja.otvori(s.takm).korak, 'spremno');
  cisti(dir);
});

test('prijave.ucesce: nevazeca vrednost baca GreskaKorisnika', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(s.takm);
  moduli.prijave.dodaj([s.t.Ana]);
  const pid = moduli.prijave.podaci(null).prijave[0].id;
  assert.throws(() => moduli.prijave.ucesce(pid, 'nesto'), (e) => e instanceof GreskaKorisnika);
  cisti(dir);
});

test('prijave.podaci: oblik, lek_ne_vazi, upozorenja, filter pola', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(s.takm);
  const d = moduli.prijave.dodaj([s.t.Ana, s.t.Bea, s.t.Dona, s.muski]);
  // Marko je MSG takmicar: u ZSG takmicenju se preskace
  assert.deepEqual([d.dodato, d.preskoceno], [3, ['Test Marko: nije istog pola kao takmičenje.']]);
  const p = moduli.prijave.podaci(null);
  assert.deepEqual(Object.keys(p).sort(), ['kategorije', 'klubovi', 'prijave', 'prijavljeni', 'programi', 'sledeciIdBroj', 'sprave', 'stanje', 'takm', 'takmicari', 'ukupno', 'upozorenja']);
  assert.equal(p.takm.id, s.takm);
  assert.equal(p.ukupno, 3);
  assert.equal(p.prijave.length, 3);
  // samo ZSG takmicari (Marko je MSG), jer baza takmicara prati izabrani pol
  assert.equal(p.takmicari.length, 4);
  assert.ok('klub_skr' in p.takmicari[0]);
  assert.deepEqual([...p.prijavljeni].sort((a, b) => a - b), [s.t.Ana, s.t.Bea, s.t.Dona].sort((a, b) => a - b));
  assert.deepEqual(p.kategorije.map((k) => k.id), [s.kat]);
  assert.deepEqual(p.programi.map((k) => k.id), [s.prog]);
  assert.deepEqual(Object.keys(p.sprave).sort(), ['M', 'Z']);
  assert.equal(p.sprave.Z.length, 2);
  assert.equal(p.sledeciIdBroj, '100');
  assert.deepEqual(Object.fromEntries(p.prijave.map((r) => [r.ime, r.lek_ne_vazi])), { Ana: false, Bea: true, Dona: true });
  assert.deepEqual(p.upozorenja.slice().sort(), [
    'Test Bea: lekarski važi do 01.01.2026. i ne važi na dan takmičenja (17.10.2026.).',
    'Test Dona: nema unet lekarski pregled.',
  ]);
  // pol iz renderera se zanemaruje: izabrani deo je ZSG, pa lista ostaje ista
  for (const arg of ['Z', 'M', 'X']) {
    const z = moduli.prijave.podaci(arg);
    assert.equal(z.prijave.length, 3);
    assert.equal(z.ukupno, 3);
  }
  structuredClone(p);
  // MSG deo: Marko se prijavljuje u MSG takmicenju
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(s.takmM);
  assert.deepEqual(moduli.prijave.dodaj([s.muski]).dodato, 1);
  const m = moduli.prijave.podaci(null);
  assert.equal(m.takm.id, s.takmM);
  assert.deepEqual(m.prijave.map((r) => r.ime), ['Marko']);
  assert.deepEqual(m.kategorije.map((k) => k.id), [s.katM]);
  assert.deepEqual(m.upozorenja, ['Test Marko: nema unet lekarski pregled.']);
  cisti(dir);
});

test('prijave.noviTakmicar, izmeni, sprava, startni', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(s.takm);
  assert.throws(() => moduli.prijave.noviTakmicar({ prezime: '', ime: '', id_broj: '001', godina_rodjenja: '1800', pol: '', klub_id: '0' }),
    /ID broj 001 već postoji\. Ime je obavezno\./);
  const r = moduli.prijave.noviTakmicar({ prezime: 'Novak', ime: 'Eva', id_broj: '100', godina_rodjenja: '2013', pol: 'Z', klub_id: '0', lekarski_do: '' });
  assert.equal(r.dodato, 1);
  assert.ok(r.takmicar_id > 0 && r.prijava_id > 0);
  assert.deepEqual(r.preskoceno, []);
  assert.equal(r.upozorenja.length, 1);
  assert.equal(moduli.prijave.izmeni(String(r.prijava_id), 'startni_broj', '7').prijava.startni_broj, 7);
  moduli.prijave.sprava(r.prijava_id, s.gr, false);
  assert.equal(moduli.prijave.stanje().prijava, 1);
  assert.deepEqual(moduli.prijave.startni(), { dodeljeno: 0 });
  moduli.prijave.dodaj([s.t.Ana]);
  assert.deepEqual(moduli.prijave.startni(), { dodeljeno: 1 });
  baza.izvrsi("INSERT INTO podesavanja (kljuc, vrednost) VALUES ('lekarski_sprecava_prijavu','da') ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost");
  const b = moduli.prijave.noviTakmicar({ prezime: 'Bez', ime: 'Lek', id_broj: '101', godina_rodjenja: '2013', pol: 'Z', klub_id: '', lekarski_do: '' });
  assert.equal(b.prijava_id, null);
  assert.deepEqual(b.preskoceno, ['Bez Lek (lekarski ne važi na dan takmičenja)']);
  cisti(dir);
});

test('grbovi: sacuvajGrb vraca url, ukloniGrb, nadji i prazno', async () => {
  const { baza, moduli, dir } = pravi({ canceled: false, filePaths: ['a.png', 'b.png'] });
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  assert.equal(await moduli.takmicenja.izaberiGrb(), 'a.png');
  const slika = path.join(dir, 'izvor.png');
  fs.writeFileSync(slika, 'x');
  const g = moduli.takmicenja.sacuvajGrb(String(s.takm), 'grb_levo', slika);
  assert.match(g.vrednost, /^grb\/takmicenje_\d+_levo_/);
  assert.ok(g.url.startsWith('file:') && g.url.includes('?v='));
  const n = moduli.takmicenja.nadji(s.takm);
  assert.equal(n.grb_levo, g.vrednost);
  assert.equal(n.grb_levo_url, g.url);
  assert.equal(n.grb_desno_url, '');
  moduli.takmicenja.ukloniGrb(s.takm, 'grb_levo');
  assert.equal(moduli.takmicenja.nadji(s.takm).grb_levo_url, '');
  assert.equal(moduli.takmicenja.prazno().grb_levo_url, '');
  cisti(dir);
});

test('uvoz.pripremi: neocekivana greska se loguje i vraca opstu poruku', async () => {
  const { baza, moduli, dir, dn } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(s.takm);
  // model pripremiFajl baca neocekivani TypeError (nije GreskaKorisnika)
  const uvozModel = require('../electron/modeli/uvoz.cjs');
  const orig = uvozModel.napravi;
  uvozModel.napravi = (...arg) => ({ ...orig(...arg), pripremiFajl: () => { throw new TypeError('kvar'); } });
  try {
    const m2 = napraviModule(baza, { dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }, fasciklaPodataka: () => dir, dnevnik: dn });
    const r = await m2.uvoz.pripremi([path.join(dir, 'kvar.docx')]);
    assert.deepEqual(r.greske, ['kvar.docx: ' + OPSTA_GRESKA]);
    assert.equal(dn.poziva, 1);
  } finally { uvozModel.napravi = orig; }
  cisti(dir);
});

test('uvoz: izaberiFajlove, pripremi (greske po fajlu), upisi', async () => {
  const { baza, moduli, dir, dn } = pravi({ canceled: false, filePaths: ['a.docx', 'b.xlsx'] });
  const s = tokSeme(baza);
  assert.deepEqual(await moduli.uvoz.izaberiFajlove(), ['a.docx', 'b.xlsx']);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(s.takm);
  const lose = path.join(dir, 'lose.docx');
  fs.writeFileSync(lose, 'nije zip');
  const r = await moduli.uvoz.pripremi([lose, path.join(__dirname, 'fajlovi', 'prijava-partizan.docx')]);
  assert.equal(r.fajlovi.length, 1);
  assert.equal(r.fajlovi[0].ime, 'prijava-partizan.docx');
  assert.equal(r.greske.length, 1);
  assert.ok(r.greske[0].startsWith('lose.docx: '));
  assert.equal(dn.poziva, 0);
  structuredClone(r);
  const u = await moduli.uvoz.upisi(r.fajlovi, {});
  assert.equal(typeof u.prijavljeno, 'number');
  cisti(dir);
});

test('takmicenja.nadji: ima_ocena je 0 dok nema unetih ocena, pa 1', (t) => {
  const { baza, moduli, dir } = pravi();
  t.after(() => cisti(dir));
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  assert.equal(moduli.takmicenja.nadji(String(s.takm)).ima_ocena, 0);
  const pid = baza.ubaci('prijave', { takmicenje_id: s.takm, takmicar_id: s.t.Ana, klub_id: s.k1, kreirano: '2026-01-01 00:00:00', izmenjeno: '2026-01-01 00:00:00' });
  baza.ubaci('ocene', { prijava_id: pid, sprava_id: s.pr, status: 'nacrt', kreirano: '2026-01-01 00:00:00', izmenjeno: '2026-01-01 00:00:00' });
  assert.equal(moduli.takmicenja.nadji(s.takm).ima_ocena, 0);
  baza.izvrsi("UPDATE ocene SET status = 'uneto'");
  assert.equal(moduli.takmicenja.nadji(s.takm).ima_ocena, 1);
  assert.equal(moduli.takmicenja.nadji(999), null);
});

test('takmicenja.sacuvaj: lista gresaka provere ide u greske', async () => {
  const { moduli, dir, dn } = pravi();
  const ipc = lazniIpc();
  registruj(ipc, { takmicenja: moduli.takmicenja }, dn, { takmicenja: MODULI.takmicenja });
  try {
    const o = await ipc.kanali['gim:takmicenja:sacuvaj']({}, { naziv: '', datum: '' }, null);
    assert.equal(o.ok, false);
    assert.ok(o.greske.length >= 2);
    assert.equal(o.greske.join(' '), o.greska);
  } finally {
    cisti(dir);
  }
});

test('uvoz: prozor nudi sve podrzane vrste; pripremi cita PDF (asinhrono), xls i doc zajedno', async () => {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-ipc3-'));
  napravljeni.push(dir);
  let opcije = null;
  const dn = laznidnevnik();
  const moduli = napraviModule(baza, {
    dialog: { showOpenDialog: async (...a) => { opcije = a.at(-1); return { canceled: true, filePaths: [] }; } },
    fasciklaPodataka: () => dir,
    dnevnik: dn,
  });
  await moduli.uvoz.izaberiFajlove();
  assert.deepEqual(opcije.filters, [{ name: 'Prijave', extensions: ['docx', 'doc', 'xlsx', 'xls', 'odt', 'ods', 'pdf'] }]);
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(s.takm);
  const { docPrimer } = require('./pomoc/doc-pisac.cjs');
  const docPut = docPrimer(path.join(dir, 'prijava.doc'));
  const skeniran = path.join(dir, 'skeniran.pdf');
  fs.writeFileSync(skeniran, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const f = path.join(__dirname, 'fajlovi');
  const r = await moduli.uvoz.pripremi([path.join(f, 'prijava-partizan.pdf'), skeniran, path.join(f, 'prijava-vojvodina.xls'), docPut]);
  assert.deepEqual(r.fajlovi.map((x) => [x.ime, x.vrsta, x.redovi.length]), [
    ['prijava-partizan.pdf', 'pdf', 3], ['prijava-vojvodina.xls', 'xls', 4], ['prijava.doc', 'doc', 3],
  ]);
  assert.equal(r.greske.length, 1);
  assert.ok(r.greske[0].startsWith('skeniran.pdf: PDF nema teksta (verovatno je skeniran).'));
  assert.equal(dn.poziva, 0);
  structuredClone(r);
  cisti(dir);
});

test('takmicenja.otvori i obrisi rade po polu takmicenja', () => {
  const { baza, moduli, dir } = pravi();
  const sad = '2026-10-30 10:00:00';
  const m = baza.ubaci('takmicenja', { naziv: 'Kup M', datum: '2026-10-17', pol: 'M', kreirano: sad, izmenjeno: sad });
  const z = baza.ubaci('takmicenja', { naziv: 'Kup Z', datum: '2026-10-17', pol: 'Z', kreirano: sad, izmenjeno: sad });
  const pod = moduli.podesavanja;
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(m));
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(z));
  assert.equal(pod.aktivno().id, z, 'ZSG deo ima svoje aktivno');
  moduli.pol.postavi('M');
  assert.equal(pod.aktivno().id, m, 'M deo pamti svoje aktivno');
  moduli.pol.postavi('Z');
  moduli.takmicenja.obrisi(String(z));
  moduli.pol.postavi('M');
  assert.equal(pod.aktivno().id, m, 'brisanje Z takmicenja ne dira M aktivno');
  assert.equal(baza.vrednost("SELECT vrednost FROM podesavanja WHERE kljuc = 'aktivno_takmicenje_Z'"), '');
  cisti(dir);
});

// --- Izabrani pol (T4) ---
test('prijave.podaci: samo takmicari, sprave, kategorije i programi izabranog pola; pol iz renderera se zanemaruje', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(s.takm));
  moduli.prijave.dodaj([s.t.Ana]);
  for (const arg of [undefined, null, 'M', 'Z', 'X']) {
    const p = moduli.prijave.podaci(arg);
    assert.deepEqual(p.takmicari.map((r) => r.pol), ['Z', 'Z', 'Z', 'Z'], `arg ${arg}`);
    assert.deepEqual(p.sprave.M, [], 'sprave drugog pola nema');
    assert.equal(p.sprave.Z.length, 2);
    assert.deepEqual(p.kategorije.map((k) => k.id), [s.kat]);
    assert.deepEqual(p.programi.map((k) => k.id), [s.prog]);
    assert.equal(p.prijave.length, 1);
    assert.equal(moduli.prijave.lista(arg).length, 1);
  }
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  moduli.prijave.dodaj([s.muski]);
  const m = moduli.prijave.podaci('Z');
  assert.deepEqual(m.takmicari.map((r) => Number(r.id)), [s.muski]);
  assert.deepEqual(m.sprave.Z, []);
  assert.deepEqual(m.sprave.M.map((x) => x.skracenica), ['PA']);
  assert.deepEqual(m.kategorije.map((k) => k.id), [s.katM]);
  assert.deepEqual(m.programi.map((k) => k.id), [s.progM]);
  structuredClone(m);
  cisti(dir);
});

test('prijave.noviTakmicar: pol je pol izabranog dela, pol iz renderera se zanemaruje', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  const r = moduli.prijave.noviTakmicar({ prezime: 'Novi', ime: 'Dino', id_broj: '200', godina_rodjenja: '2013', pol: 'Z', klub_id: '', lekarski_do: '' });
  assert.equal(r.dodato, 1);
  assert.equal(baza.vrednost('SELECT pol FROM takmicari WHERE id = ?', [r.takmicar_id]), 'M');
  cisti(dir);
});

test('prijave: prijava drugog pola se ponasa kao da ne postoji', () => {
  const { baza, moduli, dir } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  moduli.prijave.dodaj([s.muski]);
  const tudja = Number(baza.vrednost('SELECT id FROM prijave WHERE takmicar_id = ?', [s.muski]));
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(s.takm));
  moduli.prijave.dodaj([s.t.Ana]);
  const nema = (f) => assert.throws(f, (e) => e instanceof GreskaKorisnika && e.message === 'Prijava ne postoji.');
  nema(() => moduli.prijave.izmeni(String(tudja), 'startni_broj', '5'));
  nema(() => moduli.prijave.sprava(String(tudja), s.pa, true));
  nema(() => moduli.prijave.ucesce(String(tudja), 'pojedinacno'));
  nema(() => moduli.prijave.obrisi(String(tudja)));
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE id = ?', [tudja]), 1);
  // takmicar drugog pola se u izabranom delu preskace
  const d = moduli.prijave.dodaj([s.muski]);
  assert.equal(d.dodato, 0);
  cisti(dir);
});
