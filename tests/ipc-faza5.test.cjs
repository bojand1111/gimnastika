// Faza 5: IPC modul unos (ocene) nad :memory: bazom.
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { registruj } = require('../electron/ipc.cjs');
const { GreskaKorisnika } = require('../electron/greska.cjs');
const { MODULI } = require('../electron/api.cjs');
const { otvori } = require('../electron/baza/baza.cjs');
const { napraviModule } = require('../electron/moduli.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const NEMA_AKTIVNOG = 'Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.';
const dn = { info() {}, greska() {} };
const ULAZ = { d: '4,8', e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '' };

function pravi() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const moduli = napraviModule(baza, { dialog, fasciklaPodataka: () => os.tmpdir(), dnevnik: dn });
  return { baza, moduli };
}
// Aktivno ZSG takmicenje sa prijavama (Ana, Bea, Ceca, Dona); grupa A sa Anom, Beom i Cecom na pocetnoj poziciji 1.
// Marko je prijavljen u MSG takmicenju (s.takmM); izabran ostaje ZSG deo.
function sa4(saGrupom = true) {
  const o = pravi();
  const s = tokSeme(o.baza);
  o.moduli.pol.postavi('Z');
  o.moduli.takmicenja.otvori(String(s.takm));
  o.moduli.prijave.dodaj([s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona]);
  o.moduli.pol.postavi('M');
  o.moduli.takmicenja.otvori(String(s.takmM));
  o.moduli.prijave.dodaj([s.muski]);
  o.moduli.pol.postavi('Z');
  o.moduli.takmicenja.otvori(String(s.takm));
  const pid = {};
  const tid = { Ana: s.t.Ana, Bea: s.t.Bea, Ceca: s.t.Ceca, Dona: s.t.Dona, Marko: s.muski };
  for (const [ime, id] of Object.entries(tid)) {
    pid[ime] = Number(o.baza.vrednost('SELECT id FROM prijave WHERE takmicar_id = ?', [id]));
  }
  if (saGrupom) {
    const g = o.moduli.rotacije.dodaj('Z').grupa;
    for (const [i, ime] of ['Ana', 'Bea', 'Ceca'].entries()) o.moduli.rotacije.premesti(pid[ime], g.id, i, 1);
  }
  return { ...o, s, pid };
}

test('guard: unos ima handler za svaku radnju', () => {
  const { moduli } = pravi();
  assert.deepEqual(MODULI.unos, ['podaci', 'nacrt', 'potvrdi', 'odustao', 'vrati', 'zapisnici']);
  const ipc = { kanali: {}, handle(k, fn) { this.kanali[k] = fn; } };
  registruj(ipc, moduli, dn, Object.fromEntries(Object.keys(moduli).map((k) => [k, MODULI[k]])));
  for (const r of MODULI.unos) assert.ok(ipc.kanali[`gim:unos:${r}`], r);
});

test('bez aktivnog takmicenja svaka radnja baca poruku', () => {
  const { moduli } = pravi();
  const u = moduli.unos;
  const pozivi = [() => u.podaci(1, 1), () => u.nacrt(1, 1, ULAZ), () => u.potvrdi(1, 1, ULAZ, ''),
    () => u.odustao(1, 1), () => u.vrati(1, 1), () => u.zapisnici()];
  for (const f of pozivi) assert.throws(f, (e) => e instanceof GreskaKorisnika && e.message === NEMA_AKTIVNOG);
});

test('podaci() bez parametara: pol Z, rotacija 1, prva sprava sa grupom i redovi', () => {
  const { moduli, pid, s } = sa4();
  const d = moduli.unos.podaci();
  assert.equal(d.pol, 'Z');
  assert.equal(d.rot, 1);
  assert.equal(d.brojSprava, 2);
  assert.equal(d.sprava.id, s.pr);
  assert.equal(d.sprava.naziv, 'Preskok');
  assert.equal(d.grupa.naziv.length > 0, true);
  assert.deepEqual(d.sprave.map((x) => x.skracenica), ['PR', 'GR']);
  assert.ok('ikona' in d.sprave[0]);
  assert.deepEqual(d.takm, { id: s.takm, naziv: 'Test kup', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje', pomeraj_redosled: 0 });
  assert.equal(d.brojSudija, 4);
  assert.equal(d.pravilo, 'odbaci_krajnje');
  assert.equal(d.zaokruzivanje, 'odseci');
  assert.equal(d.bezGrupa, false);
  assert.equal(d.redovi.length, 3);
  assert.deepEqual(d.redovi.map((r) => r.rb), [1, 2, 3]);
  assert.deepEqual(d.redovi.map((r) => r.prijava_id), [pid.Ana, pid.Bea, pid.Ceca]);
  for (const r of d.redovi) {
    assert.equal(r.status, 'nacrt');
    assert.equal(r.radi, true);
    assert.deepEqual(r.e_sudije, ['', '', '', '']);
    assert.equal(r.d, '');
    assert.equal(r.konacna, '');
  }
  assert.equal(d.redovi[0].ime, 'Test Ana');
  assert.deepEqual(d.napredak, { obradjeno: 0, ukupno: 3, odustalo: 0 });
  assert.deepEqual(d.izmene, []);
  assert.doesNotThrow(() => structuredClone(d));
});

test('zapisnici: list po spravi i rotaciji, isti redosled kao unos, bez ocena', () => {
  const { moduli, pid, s } = sa4();
  moduli.unos.potvrdi(pid.Ana, s.pr, ULAZ, '');
  const z = moduli.unos.zapisnici();
  assert.equal(z.pol, 'Z');
  assert.equal(z.brojSudija, 4);
  assert.equal(z.takm.naziv, 'Test kup');
  // Grupa A pocinje na PR: rotacija 1 na PR, rotacija 2 na GR.
  assert.deepEqual(z.listovi.map((l) => [l.sprava.id, l.rot]), [[s.pr, 1], [s.gr, 2]]);
  const prvi = z.listovi[0];
  assert.equal(prvi.sprava.naziv, 'Preskok');
  assert.equal(prvi.grupa, moduli.unos.podaci(s.pr, 1).grupa.naziv);
  assert.deepEqual(prvi.redovi.map((r) => [r.rb, r.prijava_id]), [[1, pid.Ana], [2, pid.Bea], [3, pid.Ceca]]);
  assert.deepEqual(prvi.redovi.map((r) => r.ime), moduli.unos.podaci(s.pr, 1).redovi.map((r) => r.ime));
  assert.deepEqual(Object.keys(prvi.redovi[0]).sort(), ['ime', 'opis', 'prijava_id', 'radi', 'rb', 'startni_broj', 'vk']);
  assert.doesNotThrow(() => structuredClone(z));
});

test('zapisnici bez grupa: jedan list po spravi sa svim prijavljenima, rot null', () => {
  const { moduli, s } = sa4(false);
  const z = moduli.unos.zapisnici();
  assert.deepEqual(z.listovi.map((l) => [l.sprava.id, l.rot, l.grupa]), [[s.pr, null, 'Svi prijavljeni'], [s.gr, null, 'Svi prijavljeni']]);
  assert.deepEqual(z.listovi[0].redovi.map((r) => r.ime), moduli.unos.podaci(s.pr, 1).redovi.map((r) => r.ime));
  assert.equal(z.listovi[0].redovi.length, 4);
});

test('posle unosa svih na PR podaci() bira GR; izmene i napredak', () => {
  const { moduli, pid, s } = sa4();
  const u = moduli.unos;
  for (const ime of ['Ana', 'Bea', 'Ceca']) u.potvrdi(String(pid[ime]), String(s.pr), ULAZ, '');
  const d = u.podaci();
  assert.equal(d.sprava.id, s.gr);
  assert.equal(d.rot, 2);
  assert.equal(d.napredak.ukupno, 3);
  const pr = u.podaci(s.pr, 1);
  assert.equal(pr.sprava.id, s.pr);
  assert.equal(pr.napredak.obradjeno, 3);
  assert.equal(pr.redovi[0].status, 'uneto');
  assert.equal(pr.redovi[0].konacna, '13,050');
  assert.equal(pr.redovi[0].e, '8,250');
  assert.deepEqual(pr.redovi[0].e_sudije, ['8,300', '8,100', '8,400', '8,200']);
  u.potvrdi(pid.Ana, s.pr, { d: '4,8', e: ['8,3', '7,9', '8,4', '8,2'], odbitak: '0,1' }, 'greška');
  const i = u.podaci(s.pr, 1).izmene;
  assert.equal(i.length, 1);
  assert.deepEqual(Object.keys(i[0]).sort(), ['id', 'ime', 'opis', 'prezime', 'razlog', 'vreme']);
  assert.match(i[0].opis, /E2 8,100 → 7,900/);
});

test('podaci("Z", 999, 9): nepoznata sprava i rotacija se biraju iz napretka', () => {
  const { moduli, s } = sa4();
  const d = moduli.unos.podaci(999, 9);
  assert.equal(d.sprava.id, s.pr);
  assert.equal(d.rot, 1);
  assert.equal(moduli.unos.podaci(String(s.gr), '2').sprava.id, s.gr);
});

test('podaci("M") bez grupa: svi prijavljeni, startni broj null poslednji', () => {
  const { moduli, baza, s, pid } = sa4(false);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  const d = moduli.unos.podaci();
  assert.equal(d.pol, 'M');
  assert.equal(d.bezGrupa, true);
  assert.deepEqual(d.grupa, { id: 0, naziv: 'Svi prijavljeni' });
  assert.equal(d.sprava.id, s.pa);
  assert.equal(d.redovi.length, 1);
  assert.equal(d.redovi[0].ime, 'Test Marko');
  assert.equal(d.redovi[0].prijava_id, pid.Marko);
  // Redosled: startni broj, pa bez broja po prezimenu i imenu.
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(s.takm));
  const z = moduli.unos.podaci();
  assert.equal(z.bezGrupa, true);
  assert.deepEqual(z.redovi.map((r) => r.ime), ['Test Ana', 'Test Bea', 'Test Ceca', 'Test Dona']);
  baza.izmeni('prijave', { startni_broj: 2 }, 'id = ?', [pid.Dona]);
  baza.izmeni('prijave', { startni_broj: 1 }, 'id = ?', [pid.Ceca]);
  assert.deepEqual(moduli.unos.podaci().redovi.map((r) => r.ime), ['Test Ceca', 'Test Dona', 'Test Ana', 'Test Bea']);
  assert.equal(moduli.unos.podaci().redovi[0].startni_broj, 1);
});

test('pol bez sprava je prazan prikaz', () => {
  const { moduli, baza } = pravi();
  const s = tokSeme(baza);
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  baza.izvrsi('DELETE FROM sprave WHERE pol = ?', ['M']);
  const d = moduli.unos.podaci();
  assert.equal(d.pol, 'M');
  assert.equal(d.sprava, null);
  assert.deepEqual(d.sprave, []);
  assert.equal(d.rot, 1);
  assert.equal(d.brojSprava, 1);
  assert.equal(d.grupa, null);
  assert.deepEqual(d.redovi, []);
  assert.deepEqual(d.napredak, { obradjeno: 0, ukupno: 0, odustalo: 0 });
  assert.deepEqual(d.izmene, []);
  assert.equal(d.bezGrupa, true);
  assert.doesNotThrow(() => structuredClone(d));
});

test('clan koji ne radi spravu: radi false, status nacrt, ne ulazi u napredak', () => {
  const { moduli, pid, s } = sa4();
  moduli.prijave.sprava(pid.Bea, s.pr, false);
  const d = moduli.unos.podaci(s.pr, 1);
  assert.equal(d.redovi.length, 3);
  const bea = d.redovi.find((r) => r.prijava_id === pid.Bea);
  assert.equal(bea.radi, false);
  assert.equal(bea.status, 'nacrt');
  assert.equal(d.napredak.ukupno, 2);
  assert.throws(() => moduli.unos.nacrt(pid.Bea, s.pr, ULAZ), (e) => e instanceof GreskaKorisnika && /nije prijavljen/.test(e.message));
});

test('nacrt, potvrdi, odustao, vrati: string id-jevi i prikaz', () => {
  const { moduli, pid, s } = sa4();
  const u = moduli.unos;
  const a = String(pid.Ana);
  const sp = String(s.pr);
  const n = u.nacrt(a, sp, { d: '4,8', e: ['8,3', '8.1'], odbitak: '' });
  assert.equal(n.prikaz.status, 'nacrt');
  assert.equal(n.prikaz.d, '4,800');
  assert.deepEqual(n.prikaz.e_sudije, ['8,300', '8,100', '', '']);
  assert.equal(n.prikaz.konacna, '');
  assert.throws(() => u.potvrdi(a, sp, { d: '4,8', e: ['8,3'], odbitak: '' }, ''), (e) => e instanceof GreskaKorisnika && /Unesite sve E ocene \(4\)\./.test(e.message));
  assert.throws(() => u.nacrt(a, sp, { d: '25', e: [], odbitak: '' }), (e) => e instanceof GreskaKorisnika && /neispravna vrednost/.test(e.message));
  const p = u.potvrdi(a, sp, ULAZ, undefined);
  assert.equal(p.prikaz.status, 'uneto');
  assert.equal(p.prikaz.konacna, '13,050');
  assert.throws(() => u.potvrdi(a, sp, ULAZ, ' '), (e) => e instanceof GreskaKorisnika && /obavezan je razlog/.test(e.message));
  assert.throws(() => u.potvrdi(a, sp, ULAZ, { x: 1 }), (e) => e instanceof GreskaKorisnika && e.message === 'Za ispravku unete ocene obavezan je razlog.');
  assert.equal(u.potvrdi(a, sp, { d: '4,8', e: ['8,3', '7,9', '8,4', '8,2'], odbitak: '0,1' }, 'ispravka').prikaz.status, 'ispravljeno');
  assert.equal(u.odustao(String(pid.Bea), sp).prikaz.status, 'odustao');
  assert.equal(u.vrati(String(pid.Bea), sp).prikaz.status, 'nacrt');
  assert.throws(() => u.vrati(pid.Ceca, s.pr), (e) => e instanceof GreskaKorisnika && e.message === 'Nema šta da se vrati.');
  assert.doesNotThrow(() => structuredClone(p));
  const d = u.podaci(s.pr, 1);
  assert.deepEqual(d.napredak, { obradjeno: 1, ukupno: 3, odustalo: 0 });
  u.odustao(pid.Ceca, s.pr);
  assert.deepEqual(u.podaci(s.pr, 1).napredak, { obradjeno: 2, ukupno: 3, odustalo: 1 });
});

test('ulaz bez e i d se tretira kao prazan', () => {
  const { moduli, pid, s } = sa4();
  const n = moduli.unos.nacrt(pid.Ana, s.pr, {});
  assert.equal(n.prikaz.d, '');
  assert.deepEqual(n.prikaz.e_sudije, ['', '', '', '']);
  assert.equal(moduli.unos.nacrt(pid.Ana, s.pr, null).prikaz.status, 'nacrt');
});

// Dve grupe: A (Ana, Bea) na pocetnoj poziciji 1, B (Ceca, Dona) na 2.
function sa2Grupe() {
  const o = sa4(false);
  const g = [o.moduli.rotacije.dodaj('Z').grupa, o.moduli.rotacije.dodaj('Z').grupa];
  [['Ana', 0, 0], ['Bea', 0, 1], ['Ceca', 1, 0], ['Dona', 1, 1]].forEach(([ime, k, i]) => o.moduli.rotacije.premesti(o.pid[ime], g[k].id, i, 1));
  const unesi = (ime, sprava) => o.moduli.unos.potvrdi(o.pid[ime], sprava, ULAZ, '');
  return { ...o, unesi };
}

test('gde se stalo: A zavrsena na PR, B ceka na GR, podrazumevana sprava je GR u rotaciji 1', () => {
  const { moduli, unesi, s } = sa2Grupe();
  assert.equal(moduli.unos.podaci().sprava.id, s.pr);
  unesi('Ana', s.pr);
  unesi('Bea', s.pr);
  const d = moduli.unos.podaci();
  assert.equal(d.rot, 1);
  assert.equal(d.sprava.id, s.gr);
  assert.deepEqual(d.redovi.map((r) => r.ime), ['Test Ceca', 'Test Dona']);
});

test('gde se stalo: rotacija 1 gotova daje rot 2, i kad URL trazi nepostojece vrednosti', () => {
  const { moduli, unesi, s } = sa2Grupe();
  unesi('Ana', s.pr); unesi('Bea', s.pr); unesi('Ceca', s.gr); unesi('Dona', s.gr);
  const d = moduli.unos.podaci(999, 9);
  assert.equal(d.rot, 2);
  assert.equal(d.sprava.id, s.pr);
  assert.deepEqual(d.redovi.map((r) => r.ime), ['Test Ceca', 'Test Dona']);
  assert.equal(moduli.unos.podaci(s.pr, 0).rot, 2);
  assert.equal(moduli.unos.podaci(s.pr, 1).rot, 1);
});

test('gde se stalo: sve uneto, rot je poslednja, sprava je prva sa grupom', () => {
  const { moduli, unesi, s } = sa2Grupe();
  unesi('Ana', s.pr); unesi('Bea', s.pr); unesi('Ceca', s.gr); unesi('Dona', s.gr);
  unesi('Ceca', s.pr); unesi('Dona', s.pr); unesi('Ana', s.gr); unesi('Bea', s.gr);
  const d = moduli.unos.podaci();
  assert.equal(d.rot, 2);
  assert.equal(d.sprava.id, s.pr);
  assert.equal(d.napredak.obradjeno, d.napredak.ukupno);
});

// --- Izabrani pol (T4) ---
test('unos.podaci: pol je pol takmicenja, dodatni argumenti se zanemaruju', () => {
  const { moduli, s } = sa4();
  for (const arg of [undefined, 'M', 'Z', 'X']) {
    const d = moduli.unos.podaci(undefined, undefined, arg);
    assert.equal(d.pol, 'Z', `arg ${arg}`);
    assert.deepEqual(d.sprave.map((x) => x.skracenica), ['PR', 'GR']);
    assert.ok(d.redovi.every((r) => r.pol === 'Z'));
  }
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  const m = moduli.unos.podaci();
  assert.equal(m.pol, 'M');
  assert.deepEqual(m.sprave.map((x) => x.skracenica), ['PA']);
  assert.deepEqual(m.redovi.map((r) => r.ime), ['Test Marko']);
});

// --- Prijava drugog dela se odbija, ocena ostaje ista ---
test('unos.nacrt, potvrdi, odustao i vrati odbijaju prijavu drugog dela, ocena se ne menja', () => {
  const { moduli, baza, s, pid } = sa4();
  const u = moduli.unos;
  // MSG: Marko ima potvrdjenu ocenu na parteru; ZSG: Ana na preskoku
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  u.potvrdi(pid.Marko, s.pa, ULAZ, undefined);
  moduli.pol.postavi('Z');
  moduli.takmicenja.otvori(String(s.takm));
  u.potvrdi(pid.Ana, s.pr, ULAZ, undefined);
  const stanje = (prijava, sprava) => JSON.stringify(baza.jedan('SELECT * FROM ocene WHERE prijava_id = ? AND sprava_id = ?', [prijava, sprava]));
  const odbijeno = (e) => e instanceof GreskaKorisnika && e.message === 'Prijava ne postoji na ovom takmičenju.';
  const proveri = (prijava, sprava) => {
    const pre = stanje(prijava, sprava);
    assert.notEqual(pre, 'null', 'ocena postoji pre pokusaja');
    assert.throws(() => u.nacrt(prijava, sprava, { d: '1', e: [], odbitak: '' }), odbijeno);
    assert.throws(() => u.potvrdi(prijava, sprava, { d: '4,8', e: ['7', '7', '7', '7'], odbitak: '' }, 'ispravka'), odbijeno);
    assert.throws(() => u.odustao(prijava, sprava), odbijeno);
    assert.throws(() => u.vrati(prijava, sprava), odbijeno);
    assert.equal(stanje(prijava, sprava), pre, 'ocena je ista');
  };
  proveri(pid.Marko, s.pa); // izabran ZSG, prijava iz MSG
  moduli.pol.postavi('M');
  moduli.takmicenja.otvori(String(s.takmM));
  proveri(pid.Ana, s.pr); // izabran MSG, prijava iz ZSG
});
