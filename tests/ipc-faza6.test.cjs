// Faza 6: IPC moduli rang i stampa nad primer podacima (:memory:).
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { napravi: napraviStampu } = require('../electron/stampa.cjs');
const { uvezi } = require('../alati/primer-podaci.cjs');
const json = require('../docs/proizvod/dizajn/primer-podaci.json');

const dn = { info() {}, greska() {} };

function pravi(opcije = {}) {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dialog = opcije.dialog ?? { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const moduli = napraviModule(baza, { dialog, fasciklaPodataka: () => opcije.podaci ?? os.tmpdir(), dnevnik: dn, roditelj: opcije.roditelj, dokumenti: opcije.dokumenti });
  return { baza, moduli };
}
// Primer ima dva takmicenja (ZSG i MSG); izabran je ZSG deo, a MSG se bira sa otvori(idMsg).
function sPrimerom(opcije) {
  const o = pravi(opcije);
  uvezi(o.baza, json);
  o.baza.ubaci('podesavanja', { kljuc: 'aktivni_pol', vrednost: 'Z' });
  o.idZ = Number(o.baza.vrednost("SELECT id FROM takmicenja WHERE pol = 'Z'"));
  o.idM = Number(o.baza.vrednost("SELECT id FROM takmicenja WHERE pol = 'M'"));
  return o;
}

test('guard: rang i stampa imaju handler za svaku radnju', () => {
  const { moduli } = pravi();
  assert.deepEqual(MODULI.rang, ['podaci', 'rezultati', 'stampa', 'bilten', 'bilteni']);
  assert.deepEqual(MODULI.stampa, ['stampaj', 'pdf']);
  const ipc = { kanali: {}, handle(k, fn) { this.kanali[k] = fn; } };
  registruj(ipc, moduli, dn, Object.fromEntries(Object.keys(moduli).map((k) => [k, MODULI[k]])));
  for (const m of ['rang', 'stampa']) for (const r of MODULI[m]) assert.ok(ipc.kanali[`gim:${m}:${r}`], r);
});

test('podaci(): podrazumevani izbor, nepoznat tab je viseboj, prvi je Petrovic', () => {
  const { moduli } = sPrimerom();
  const d = moduli.rang.podaci(undefined, undefined, 'nepoznat');
  assert.equal(d.izbor.pol, 'Z');
  assert.equal(d.izbor.kat_naziv, 'Kadet');
  assert.equal(d.izbor.prog_naziv, 'C program');
  assert.equal(d.tab, 'viseboj');
  assert.deepEqual(Object.keys(d.takm).sort(), ['ekipno_broji', 'id', 'naziv', 'pravilo_e']);
  assert.equal(d.rez.viseboj[0].prijava, Object.values(d.rez.prijave).find((p) => p.prezime === 'Petrović').id);
  const sid = d.rez.sprave[0].id;
  assert.equal(moduli.rang.podaci('', '', String(sid)).tab, sid);
  assert.equal(moduli.rang.podaci('', '', 'ekipno').tab, 'ekipno');
  structuredClone(d);
});

test('podaci() bez aktivnog takmicenja baca poruku', () => {
  const { moduli } = pravi();
  assert.throws(() => moduli.rang.podaci(), GreskaKorisnika);
});

test('rezultati(): Petrovic ima jednu stavku, zbir 50300, izabrano je aktivno', () => {
  const { baza, moduli } = sPrimerom();
  const tid = Number(baza.vrednost('SELECT id FROM takmicari WHERE prezime = ?', ['Petrović']));
  const r = moduli.rang.rezultati(String(tid), undefined);
  assert.equal(r.sva.length, 1);
  assert.equal(r.sva[0].red.zbir, 50300);
  assert.equal(r.takmicar.klub_ime, 'SD „Vojvodina“');
  assert.equal(r.izabranoId, Number(baza.vrednost("SELECT id FROM takmicenja WHERE pol = 'Z'")));
  assert.equal(r.izabranoId, r.sva[0].takm.id);
  structuredClone(r);
  assert.throws(() => moduli.rang.rezultati(99999), (e) => e instanceof GreskaKorisnika && e.message === 'Takmičar ne postoji.');
});

test('stampa(): bez prijava baca, viseboj ZSG 1 strana, MSG polozeno 2 strane po 6', () => {
  const { baza, moduli, idZ, idM } = sPrimerom();
  const z = moduli.rang.stampa('', '', 'viseboj');
  assert.equal(z.polozeno, false);
  assert.equal(z.strane.length, 1);
  assert.equal(z.naziv, 'Višeboj · ŽSG · Kadet · C program');
  assert.equal(z.grb, '');
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(idM));
  const m = moduli.rang.stampa('', '', 'viseboj');
  assert.equal(m.polozeno, true);
  assert.equal(m.rez.viseboj.length, 10);
  assert.deepEqual(m.strane.map((s) => s.length), [6, 4]);
  assert.equal(moduli.rang.stampa('', '', 'ekipno').polozeno, false);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(idZ));
  const sprava = z.rez.sprave[0];
  const sp = moduli.rang.stampa('', '', String(sprava.id));
  assert.equal(sp.sprava.id, sprava.id);
  assert.equal(sp.naziv, `${sprava.naziv} · ŽSG · Kadet · C program`);
  assert.equal(moduli.rang.stampa('', '', 'ekipno').naziv, 'Ekipno · ŽSG · Kadet · C program');
  structuredClone(m);
  baza.izvrsi('DELETE FROM prijave');
  assert.throws(() => moduli.rang.stampa(), (e) => e instanceof GreskaKorisnika && e.message === 'Nema prijava za štampu.');
  assert.throws(() => moduli.rang.bilten(), (e) => e instanceof GreskaKorisnika && e.message === 'Nema prijava za bilten.');
});

test('bilten(): polozeno po polu, disciplina, prva strana pocinje ekipom', () => {
  const { moduli, idM } = sPrimerom();
  const z = moduli.rang.bilten('', '');
  assert.equal(z.polozeno, false);
  assert.equal(z.disciplina, 'Ženska sportska gimnastika · Kadet · C program');
  assert.equal(z.strane[0][0].tip, 'ekipa');
  assert.equal(z.strane.flat().length, z.rez.viseboj.length + z.rez.ekipno.reduce((n, e) => n + 1 + e.clanovi.length, 0));
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(idM));
  const m = moduli.rang.bilten('', '');
  assert.equal(m.polozeno, true);
  assert.equal(m.disciplina, 'Muška sportska gimnastika · Kadet · C program');
  assert.equal(m.strane[0][0].tip, 'ekipa');
  assert.equal(z.grbLevo, '');
  structuredClone(m);
});

test('bilteni(): ceo bilten, sekcija po kategoriji i programu redom', () => {
  const { moduli, baza, idZ } = sPrimerom();
  const jedan = moduli.rang.bilteni();
  const b = moduli.rang.bilten('', '');
  assert.equal(jedan.polozeno, false);
  assert.equal(jedan.takm.naziv, b.takm.naziv);
  assert.equal(jedan.sekcije.length, 1);
  assert.equal(jedan.sekcije[0].disciplina, b.disciplina);
  assert.deepEqual(jedan.sekcije[0].strane, b.strane);
  // Druga kategorija ZSG (posle Kadet po redosledu) sa jednom prijavom.
  const kat = baza.ubaci('kategorije', { naziv: 'Junior', redosled: 99, pol: 'Z', kreirano: '2026-10-31 10:00:00', izmenjeno: '2026-10-31 10:00:00' });
  const pid = Number(baza.vrednost('SELECT id FROM prijave WHERE takmicenje_id = ? ORDER BY id LIMIT 1', [idZ]));
  baza.izvrsi('UPDATE prijave SET kategorija_id = ? WHERE id = ?', [kat, pid]);
  const dva = moduli.rang.bilteni();
  assert.deepEqual(dva.sekcije.map((x) => x.disciplina), [
    'Ženska sportska gimnastika · Kadet · C program', 'Ženska sportska gimnastika · Junior · C program']);
  const brojPrijava = Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicenje_id = ?', [idZ]));
  assert.equal(dva.sekcije.reduce((n, x) => n + x.rez.viseboj.length, 0), brojPrijava);
  assert.doesNotThrow(() => structuredClone(dva));
  baza.izvrsi('DELETE FROM prijave');
  assert.throws(() => moduli.rang.bilteni(), (e) => e instanceof GreskaKorisnika && e.message === 'Nema prijava za bilten.');
});

// Stub prozor sa webContents.
function stubProzor(ishod) {
  const poziv = {};
  const wc = {
    print(opcije, cb) { poziv.print = opcije; cb(ishod.print ?? true, ishod.razlog); },
    async printToPDF(opcije) { poziv.pdf = opcije; if (ishod.pdfGreska) throw new Error(ishod.pdfGreska); return Buffer.from('%PDF-test'); },
  };
  return { poziv, prozor: () => ({ webContents: wc }) };
}

test('stampa.stampaj: opcije i ishod', async () => {
  const s = stubProzor({});
  const st = napraviStampu({ prozor: s.prozor, dialog: {}, fs, dokumenti: os.tmpdir() });
  assert.deepEqual(await st.stampaj({ polozeno: true }), { ok: true });
  assert.deepEqual(s.poziv.print, { silent: false, printBackground: true, landscape: true, pageSize: 'A4', margins: { marginType: 'none' } });
  await st.stampaj({});
  assert.equal(s.poziv.print.landscape, false);
  const lose = napraviStampu({ prozor: stubProzor({ print: false, razlog: 'nema stampaca' }).prozor, dialog: {}, fs, dokumenti: os.tmpdir() });
  await assert.rejects(lose.stampaj({}), (e) => e instanceof GreskaKorisnika && e.message === 'Štampa nije uspela: nema stampaca');
  const otkazano = napraviStampu({ prozor: stubProzor({ print: false, razlog: 'cancelled' }).prozor, dialog: {}, fs, dokumenti: os.tmpdir() });
  assert.deepEqual(await otkazano.stampaj({}), { ok: false, otkazano: true });
});

test('stampa.pdf: upis fajla, otkazan dijalog, greska, ime bez nedozvoljenih znakova', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-pdf-'));
  const s = stubProzor({});
  let trazeno;
  const dialog = { showSaveDialog: async (w, o) => { trazeno = o; return { canceled: false, filePath: path.join(dir, 'a.pdf') }; } };
  const st = napraviStampu({ prozor: s.prozor, dialog, fs, dokumenti: dir });
  const r = await st.pdf({ polozeno: true, ime: 'Bilten: A/B?.pdf' });
  assert.deepEqual(r, { putanja: path.join(dir, 'a.pdf') });
  assert.equal(fs.readFileSync(r.putanja, 'utf8'), '%PDF-test');
  assert.equal(trazeno.defaultPath, path.join(dir, 'Bilten AB.pdf'));
  assert.deepEqual(trazeno.filters, [{ name: 'PDF', extensions: ['pdf'] }]);
  assert.deepEqual(s.poziv.pdf, { landscape: true, pageSize: 'A4', margins: { marginType: 'none' }, printBackground: true });
  const otkazan = napraviStampu({ prozor: s.prozor, dialog: { showSaveDialog: async () => ({ canceled: true }) }, fs, dokumenti: dir });
  assert.equal(await otkazan.pdf({ ime: 'x' }), null);
  const lose = napraviStampu({ prozor: stubProzor({ pdfGreska: 'puno' }).prozor, dialog, fs, dokumenti: dir });
  await assert.rejects(lose.pdf({ ime: 'x' }), (e) => e instanceof GreskaKorisnika && e.message === 'PDF nije sačuvan: puno');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('moduli.stampa koristi roditelj() kao prozor', async () => {
  const s = stubProzor({});
  const { moduli } = pravi({ roditelj: s.prozor });
  assert.deepEqual(await moduli.stampa.stampaj({ polozeno: false }), { ok: true });
});

// Drugo takmicenje (novije) sa prijavom Petrovica: kopija prvog reda takmicenja i prijave.
function drugoTakmicenje(baza) {
  const tak = baza.jedan('SELECT * FROM takmicenja');
  const { id: _t, ...t2 } = tak;
  const novo = Number(baza.ubaci('takmicenja', { ...t2, naziv: 'Novije takmicenje', datum: '2099-05-05' }));
  const tid = Number(baza.vrednost('SELECT id FROM takmicari WHERE prezime = ?', ['Petrović']));
  const { id: _p, ...pr } = baza.jedan('SELECT * FROM prijave WHERE takmicar_id = ?', [tid]);
  baza.ubaci('prijave', { ...pr, takmicenje_id: novo, startni_broj: null });
  return { stari: Number(tak.id), novo, tid };
}

test('rezultati(): vise takmicenja, izbor i fallback', () => {
  const { baza, moduli } = sPrimerom();
  const { stari, novo, tid } = drugoTakmicenje(baza);
  const r = moduli.rang.rezultati(tid);
  assert.deepEqual(r.sva.map((x) => x.takm.id), [novo, stari]);
  assert.equal(r.izabranoId, stari);
  assert.equal(moduli.rang.rezultati(tid, String(novo)).izabranoId, novo);
  assert.equal(moduli.rang.rezultati(tid, 'smece').izabranoId, stari);
  assert.equal(moduli.rang.rezultati(tid, 987654).izabranoId, novo);
  assert.equal(r.sva[0].red, null);
  baza.izvrsi("UPDATE podesavanja SET vrednost = '' WHERE kljuc = 'aktivno_takmicenje_Z'");
  assert.equal(moduli.rang.rezultati(tid).izabranoId, novo);
  assert.throws(() => moduli.rang.podaci(), (e) => e instanceof GreskaKorisnika && /Nema aktivnog/.test(e.message));
  assert.throws(() => moduli.rang.stampa(), (e) => /Nema aktivnog/.test(e.message));
  assert.throws(() => moduli.rang.bilten(), (e) => /Nema aktivnog/.test(e.message));
});

test('rezultati(): takmicar bez prijava', () => {
  const { baza, moduli } = sPrimerom();
  const id = Number(baza.ubaci('takmicari', {
    id_broj: '99999', ime: 'Nova', prezime: 'Bez', godina_rodjenja: 2012, pol: 'Z', kreirano: '2026-01-01 00:00:00', izmenjeno: '2026-01-01 00:00:00',
  }));
  const r = moduli.rang.rezultati(id);
  assert.deepEqual(r.sva, []);
  assert.equal(r.izabranoId, null);
});

test('stampa(): strane za spravu i ekipno', () => {
  const { moduli } = sPrimerom();
  const z = moduli.rang.stampa('', '', 'viseboj');
  const sid = z.rez.sprave[0].id;
  const sp = moduli.rang.stampa('', '', sid);
  assert.equal(sp.strane.length, 1);
  assert.equal(sp.strane[0].length, z.rez.po_spravi[sid].length);
  const ek = moduli.rang.stampa('', '', 'ekipno');
  assert.equal(ek.strane.flat().length, z.rez.ekipno.length);
  for (const s of ek.strane) assert.ok(s.reduce((n, e) => n + 1 + e.clanovi.length, 0) <= 30);
});

test('organizator i grb: rezervno iz podesavanja', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gim-f6-grb-')); // grb se cuva kao grb/<ime>
  const { baza, moduli } = sPrimerom({ podaci: dir });
  fs.mkdirSync(path.join(dir, 'grb'));
  const levo = `grb-f6-levo-${process.pid}.png`;
  const desno = `grb-f6-desno-${process.pid}.png`;
  fs.writeFileSync(path.join(dir, 'grb', levo), 'x');
  fs.writeFileSync(path.join(dir, 'grb', desno), 'x');
  try {
    baza.izvrsi("UPDATE takmicenja SET organizator = '', grb_levo = '', grb_desno = ''");
    for (const [k, v] of [['organizator', 'Savez'], ['grb_levo', `grb/${levo}`], ['grb_desno', `grb/${desno}`]]) {
      baza.izvrsi('INSERT INTO podesavanja (kljuc, vrednost) VALUES (?, ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost', [k, v]);
    }
    const b = moduli.rang.bilten('', '');
    assert.equal(b.organizator, 'Savez');
    assert.match(b.grbLevo, new RegExp(`${levo}[?]v=`));
    assert.match(b.grbDesno, new RegExp(`${desno}[?]v=`));
    assert.match(moduli.rang.stampa('', '', 'viseboj').grb, new RegExp(levo));
    baza.izvrsi("UPDATE takmicenja SET organizator = 'Klub X'");
    assert.equal(moduli.rang.bilten('', '').organizator, 'Klub X');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stampaj: razni zapisi otkazivanja i pad dijaloga za PDF', async () => {
  for (const razlog of ['canceled', 'Print job canceled', 'CANCELLED']) {
    const st = napraviStampu({ prozor: stubProzor({ print: false, razlog }).prozor, dialog: {}, fs, dokumenti: os.tmpdir() });
    assert.deepEqual(await st.stampaj({}), { ok: false, otkazano: true });
  }
  const st = napraviStampu({ prozor: stubProzor({}).prozor, dialog: { showSaveDialog: async () => { throw new Error('dijalog'); } }, fs, dokumenti: os.tmpdir() });
  await assert.rejects(st.pdf({ ime: 'x' }), (e) => e instanceof GreskaKorisnika && e.message === 'PDF nije sačuvan: dijalog');
});

test('rezultati(): prijava u kojoj je takmicar odustao na svim spravama', () => {
  const { baza, moduli } = sPrimerom();
  const tid = Number(baza.vrednost('SELECT id FROM takmicari WHERE prezime = ?', ['Petrović']));
  baza.izvrsi(
    `UPDATE ocene SET status = 'odustao', d = NULL, e = NULL, odbitak = NULL, konacna = NULL
     WHERE prijava_id IN (SELECT id FROM prijave WHERE takmicar_id = ?)`, [tid]);
  const r = moduli.rang.rezultati(tid);
  assert.equal(r.sva.length, 1);
  assert.equal(r.sva[0].red.odustao, true);
  assert.equal(r.sva[0].red.zbir, null);
  assert.equal(r.sva[0].red.oznaka, '');
  assert.ok(Object.values(r.sva[0].red.detalji).every((d) => d.status === 'odustao'));
  structuredClone(r);
});

test('cistoIme: prazno, same tacke i samo .pdf daju Stampa.pdf', () => {
  const { cistoIme } = require('../electron/stampa.cjs');
  assert.equal(cistoIme(''), 'Stampa.pdf');
  assert.equal(cistoIme('..'), 'Stampa.pdf');
  assert.equal(cistoIme('.pdf'), 'Stampa.pdf');
  assert.equal(cistoIme(undefined), 'Stampa.pdf');
});

// --- Izabrani pol (T4) ---
test('rang: izbor je pol takmicenja, dodatni argumenti se zanemaruju', () => {
  const { moduli, idM } = sPrimerom();
  assert.equal(moduli.rang.podaci(undefined, undefined, undefined, 'M').izbor.pol, 'Z');
  assert.match(moduli.rang.stampa('', '', 'viseboj', 'M').naziv, /ŽSG/);
  assert.equal(moduli.rang.bilten('', '', 'M').disciplina, 'Ženska sportska gimnastika · Kadet · C program');
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(idM));
  assert.equal(moduli.rang.podaci(undefined, undefined, undefined, 'Z').izbor.pol, 'M');
  assert.match(moduli.rang.stampa('', '', 'viseboj', 'Z').naziv, /MSG/);
  assert.equal(moduli.rang.bilten('', '', 'Z').disciplina, 'Muška sportska gimnastika · Kadet · C program');
});

test('rang.rezultati: takmicar drugog pola se ponasa kao da ne postoji', () => {
  const { baza, moduli } = sPrimerom();
  const muski = Number(baza.vrednost("SELECT id FROM takmicari WHERE pol = 'M' LIMIT 1"));
  const zenski = Number(baza.vrednost("SELECT id FROM takmicari WHERE pol = 'Z' LIMIT 1"));
  assert.throws(() => moduli.rang.rezultati(String(muski)), (e) => e instanceof GreskaKorisnika && e.message === 'Takmičar ne postoji.');
  assert.equal(moduli.rang.rezultati(String(zenski)).takmicar.pol, 'Z');
  moduli.pol.postavi('M');
  assert.equal(moduli.rang.rezultati(String(muski)).takmicar.pol, 'M');
});
