const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviTakmicare } = require('../electron/modeli/takmicari.cjs');
const { napravi } = require('../electron/modeli/prijave.cjs');
const { tokSeme } = require('./pomoc/seme.cjs');

const S = '2026-01-01 00:00:00';

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const s = tokSeme(baza);
  const podesavanja = napraviPodesavanja(baza, '');
  return { baza, s, podesavanja, p: napravi(baza, podesavanja) };
}

function svi(s) {
  return [s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona, s.muski];
}

function poruka(fn) {
  try {
    fn();
  } catch (e) {
    return e.message;
  }
  return null;
}

// Sirovi redovi: grupa sa datim prijavama.
function grupa(baza, takm, pol, prijave) {
  const gid = baza.ubaci('grupe', { takmicenje_id: takm, pol, naziv: 'G' + pol, redosled: 0, pocetna_pozicija: 1, kreirano: S, izmenjeno: S });
  prijave.forEach((pid, i) => baza.ubaci('grupa_clanovi', { grupa_id: gid, prijava_id: pid, redosled: i }));
}

test('tok prijava (POPIS 9.2)', () => {
  const { baza, s, podesavanja, p } = nova();
  // 1
  const r = p.dodajVise(s.takm, svi(s));
  assert.equal(r.dodato, 5);
  assert.equal(r.upozorenja.length, 3);
  // 2
  assert.equal(p.dodajVise(s.takm, [s.t.Ana]).dodato, 0);
  // 3
  const lista = p.lista(s.takm, 'Z');
  assert.equal(lista.length, 4);
  assert.deepEqual(lista[0].sprave, [s.pr, s.gr]);
  assert.equal(lista[0].kategorija_id, s.kat);
  assert.equal(lista[0].klub_id, s.k1);
  const ana = lista[0].id;
  const bea = lista[1].id;
  assert.equal(lista[0].ime, 'Ana');
  assert.equal(lista[1].ime, 'Bea');
  // 4
  baza.izmeni('takmicari', { klub_id: s.k2 }, 'id = ?', [s.t.Ana]);
  assert.equal(p.nadji(ana).klub_id, s.k1);
  // 5
  p.izmeniPolje(s.takm, ana, 'startni_broj', '21');
  p.izmeniPolje(s.takm, ana, 'clan_ekipe', true);
  assert.equal(poruka(() => p.izmeniPolje(s.takm, bea, 'startni_broj', '21')), 'Startni broj 21 već ima Test Ana.');
  assert.equal(poruka(() => p.izmeniPolje(s.takm, bea, 'startni_broj', 'x')), 'Startni broj mora biti pozitivan ceo broj.');
  // 6
  assert.equal(p.dodeliStartneBrojeve(s.takm), 4);
  const broj = (id) => p.nadji(id).startni_broj;
  assert.equal(broj(ana), 21);
  assert.equal(broj(bea), 24);
  const po = Object.fromEntries(p.lista(s.takm).map((x) => [x.ime, x.startni_broj]));
  assert.deepEqual(po, { Ana: 21, Ceca: 22, Dona: 23, Bea: 24, Marko: 25 });
  // 7
  assert.equal(poruka(() => p.postaviSpravu(s.takm, ana, s.pa, true)), 'Sprava ne odgovara polu takmičara.');
  p.postaviSpravu(s.takm, ana, s.gr, false);
  assert.deepEqual(p.nadji(ana).sprave, [s.pr]);
  // 8
  podesavanja.postavi('lekarski_sprecava_prijavu', 'da');
  p.obrisi(s.takm, bea);
  const ponovo = p.dodajVise(s.takm, [s.t.Bea]);
  assert.equal(ponovo.dodato, 0);
  assert.deepEqual(ponovo.preskoceno, ['Test Bea (lekarski ne važi na dan takmičenja)']);
});

test('priprema, potvrde i ucesce (POPIS 9.3)', () => {
  const { baza, s, p } = nova();
  assert.equal(p.stanjePripreme(s.takm).korak, 'prijave');
  p.dodajVise(s.takm, [s.t.Ana, s.t.Bea, s.t.Ceca]);
  let st = p.stanjePripreme(s.takm);
  assert.equal(st.prijava, 3);
  assert.equal(st.nepotpune, 0);
  assert.equal(st.nerasporedjeni, 3);
  assert.equal(st.korak, 'rotacije');
  assert.equal(st.nepotvrdjeni_klubovi, 2);
  assert.equal(st.klubovi[s.k1].skracenica, 'JED');
  assert.equal(st.klubovi[s.k1].puno_ime, 'Klub Jedan');
  assert.equal(st.klubovi[s.k1].prijava, 2);
  p.potvrdiKlub(s.takm, s.k1, true);
  p.potvrdiKlub(s.takm, s.k2, true);
  assert.equal(p.stanjePripreme(s.takm).nepotvrdjeni_klubovi, 0);
  p.dodajVise(s.takm, [s.t.Dona]);
  st = p.stanjePripreme(s.takm);
  assert.equal(st.klubovi[s.k2].potvrdjeno, false);
  assert.equal(st.klubovi[s.k1].potvrdjeno, true);
  const lista = p.lista(s.takm);
  const pid = Object.fromEntries(lista.map((x) => [x.ime, x.id]));
  p.obrisi(s.takm, pid.Bea);
  assert.equal(p.stanjePripreme(s.takm).klubovi[s.k1].potvrdjeno, false);
  assert.equal(poruka(() => p.potvrdiKlub(s.takm, 99999, true)), 'Klub nema prijava na ovom takmičenju.');
  // kategorija
  p.izmeniPolje(s.takm, pid.Ana, 'kategorija_id', '');
  st = p.stanjePripreme(s.takm);
  assert.equal(st.nepotpune, 1);
  assert.equal(st.korak, 'prijave');
  p.izmeniPolje(s.takm, pid.Ana, 'kategorija_id', s.kat);
  assert.equal(p.stanjePripreme(s.takm).nepotpune, 0);
  // rotacije: grupa sa Ana, Ceca, Dona
  grupa(baza, s.takm, 'Z', [pid.Ana, pid.Ceca, pid.Dona]);
  assert.equal(p.stanjePripreme(s.takm).korak, 'spremno');
  // ucesce
  const polja = () => { const x = p.nadji(pid.Ana); return [x.clan_ekipe, x.van_konkurencije]; };
  p.postaviUcesce(s.takm, pid.Ana, 'ekipa');
  assert.deepEqual(polja(), [1, 0]);
  p.postaviUcesce(s.takm, pid.Ana, 'vk');
  assert.deepEqual(polja(), [0, 1]);
  p.postaviUcesce(s.takm, pid.Ana, 'pojedinac');
  assert.deepEqual(polja(), [0, 0]);
  assert.equal(poruka(() => p.postaviUcesce(s.takm, pid.Ana, 'x')), 'Nepoznato učešće: x');
  assert.equal(napraviTakmicare(baza).sledeciIdBroj(), '100');
});

test('stanjePripreme: redosled klubova po skracenici, bez kluba na kraju', () => {
  const { baza, s, p } = nova();
  const bez = baza.ubaci('takmicari', { id_broj: '500', ime: 'Eva', prezime: 'Bez', godina_rodjenja: 2012, pol: 'Z', klub_id: null, kreirano: S, izmenjeno: S });
  p.dodajVise(s.takm, [bez, s.t.Ana, s.t.Ceca]);
  const st = p.stanjePripreme(s.takm);
  assert.deepEqual(st.redosled_klubova, [s.k2, s.k1, 0]);
  assert.deepEqual(st.klubovi[0], { prijava: 1, nepotpune: 0, nerasporedjeni: 1, potvrdjeno: false, skracenica: '', puno_ime: '' });
});

test('postaviSpravu: nacrt ocena nestaje, uneto blokira', () => {
  const { baza, s, p } = nova();
  p.dodajVise(s.takm, [s.t.Ana]);
  const ana = p.lista(s.takm)[0].id;
  baza.ubaci('ocene', { prijava_id: ana, sprava_id: s.gr, status: 'nacrt', kreirano: S, izmenjeno: S });
  baza.ubaci('ocene', { prijava_id: ana, sprava_id: s.pr, status: 'uneto', kreirano: S, izmenjeno: S });
  p.postaviSpravu(s.takm, ana, s.gr, false);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM ocene WHERE prijava_id = ? AND sprava_id = ?', [ana, s.gr]), 0);
  assert.equal(poruka(() => p.postaviSpravu(s.takm, ana, s.pr, false)),
    'Na toj spravi već postoji uneta ocena. Prvo je obrišite u unosu ocena.');
  assert.deepEqual(p.nadji(ana).sprave, [s.pr]);
  p.postaviSpravu(s.takm, ana, s.gr, true);
  p.postaviSpravu(s.takm, ana, s.gr, true);
  assert.deepEqual(p.nadji(ana).sprave, [s.pr, s.gr]);
});

test('obrisi blokira prijavu sa unetim ocenama', () => {
  const { baza, s, p } = nova();
  p.dodajVise(s.takm, [s.t.Ana]);
  const ana = p.lista(s.takm)[0].id;
  baza.ubaci('ocene', { prijava_id: ana, sprava_id: s.pr, status: 'uneto', kreirano: S, izmenjeno: S });
  baza.ubaci('ocene', { prijava_id: ana, sprava_id: s.gr, status: 'odustao', kreirano: S, izmenjeno: S });
  assert.equal(poruka(() => p.obrisi(s.takm, ana)), 'Test Ana ima 2 unetih ocena. Prijava se ne može obrisati.');
  assert.equal(poruka(() => p.obrisi(s.takm + 1, ana)), 'Prijava ne postoji.');
  assert.ok(p.nadji(ana));
});

test('izmeniPolje: ostala pravila', () => {
  const { s, p } = nova();
  p.dodajVise(s.takm, [s.t.Ana]);
  const ana = p.lista(s.takm)[0].id;
  assert.equal(poruka(() => p.izmeniPolje(s.takm, ana, 'kategorija_id', 9999)), 'Stavka ne postoji.');
  assert.equal(poruka(() => p.izmeniPolje(s.takm, ana, 'program_id', 9999)), 'Stavka ne postoji.');
  p.izmeniPolje(s.takm, ana, 'program_id', 0);
  assert.equal(p.nadji(ana).program_id, null);
  p.izmeniPolje(s.takm, ana, 'startni_broj', '7');
  assert.equal(p.nadji(ana).startni_broj, 7);
  p.izmeniPolje(s.takm, ana, 'startni_broj', '');
  assert.equal(p.nadji(ana).startni_broj, null);
  assert.equal(poruka(() => p.izmeniPolje(s.takm, ana, 'startni_broj', '0')), 'Startni broj mora biti pozitivan ceo broj.');
  p.izmeniPolje(s.takm, ana, 'van_konkurencije', '0');
  assert.equal(p.nadji(ana).van_konkurencije, 0);
  p.izmeniPolje(s.takm, ana, 'van_konkurencije', true);
  assert.equal(p.nadji(ana).van_konkurencije, 1);
  assert.equal(poruka(() => p.izmeniPolje(s.takm, ana, 'naziv', 'x')), 'Nepoznato polje: naziv');
  assert.equal(poruka(() => p.izmeniPolje(s.takm, 9999, 'clan_ekipe', 1)), 'Prijava ne postoji.');
});

test('dodajJednu: stanja i poruke', () => {
  const { s, p } = nova();
  assert.equal(poruka(() => p.dodajJednu(9999, s.t.Ana, null, null, 'pojedinac')), 'Takmičenje ne postoji.');
  assert.deepEqual(p.dodajJednu(s.takm, 9999, null, null, 'pojedinac'),
    { stanje: 'nema', ime: '', poruka: 'Takmičar ne postoji.', lekarski_ne_vazi: false, prijava_id: null });
  assert.equal(poruka(() => p.dodajJednu(s.takm, s.t.Ana, null, null, 'x')), 'Nepoznato učešće: x');
  const a = p.dodajJednu(s.takm, s.t.Ana, s.kat, s.prog, 'ekipa');
  assert.equal(a.stanje, 'dodato');
  assert.equal(a.ime, 'Test Ana');
  assert.equal(p.nadji(a.prijava_id).clan_ekipe, 1);
  const v = p.dodajJednu(s.takm, s.t.Ana, null, null, 'pojedinac');
  assert.equal(v.stanje, 'vec');
  assert.equal(v.poruka, 'Test Ana je već prijavljen.');
  assert.deepEqual(p.prijavljeniTakmicari(s.takm), [s.t.Ana]);
});

test('lista: filtar pola, redosled Z pa M', () => {
  const { s, p } = nova();
  p.dodajVise(s.takm, [s.muski, s.t.Dona, s.t.Ana]);
  assert.deepEqual(p.lista(s.takm).map((x) => x.ime), ['Ana', 'Dona', 'Marko']);
  assert.deepEqual(p.lista(s.takm, 'M').map((x) => x.ime), ['Marko']);
  assert.deepEqual(p.lista(s.takm, 'M')[0].sprave, [s.pa]);
  assert.equal(p.lista(s.takm)[0].klub_skr, 'JED');
});

test('lekarskiUpozorenja i brojevi', () => {
  const { baza, s, p } = nova();
  p.dodajVise(s.takm, svi(s));
  const u = p.lekarskiUpozorenja(30);
  assert.deepEqual(u.map((x) => x.ime), ['Bea', 'Dona', 'Marko']);
  assert.deepEqual(u.map((x) => x.lek.stanje), ['istekao', 'nema', 'nema']);
  assert.equal(u[0].takmicenje, 'Test kup');
  assert.deepEqual(p.brojevi(s.takm), { prijava: 5, klubova: 2 });
  baza.izmeni('takmicenja', { zavrseno: 1 }, 'id = ?', [s.takm]);
  assert.deepEqual(p.lekarskiUpozorenja(30), []);
});

test('lekarskiUpozorenja: vraca i red sa stanjem istice (u pragu)', () => {
  const { baza, s, p } = nova();
  p.dodajVise(s.takm, [s.t.Ana, s.t.Ceca]);
  assert.deepEqual(p.lekarskiUpozorenja(30), []);
  // takmicenje je 2026-10-17: 10 dana do isteka je u pragu od 30
  baza.izmeni('takmicari', { lekarski_do: '2026-10-27' }, 'id = ?', [s.t.Ceca]);
  const u = p.lekarskiUpozorenja(30);
  assert.deepEqual(u.map((x) => [x.ime, x.lek.stanje, x.lek.dana]), [['Ceca', 'istice', 10]]);
});

test('dodeliStartneBrojeve: postojeci brojevi sa rupama ostaju, novi idu posle najveceg', () => {
  const { baza, s, p } = nova();
  p.dodajVise(s.takm, [s.t.Ana, s.t.Bea, s.t.Ceca]);
  const pid = Object.fromEntries(p.lista(s.takm).map((x) => [x.ime, x.id]));
  p.izmeniPolje(s.takm, pid.Ana, 'startni_broj', '5');
  p.izmeniPolje(s.takm, pid.Bea, 'startni_broj', '2');
  assert.equal(p.dodeliStartneBrojeve(s.takm), 1);
  const br = Object.fromEntries(p.lista(s.takm).map((x) => [x.ime, x.startni_broj]));
  assert.deepEqual(br, { Ana: 5, Bea: 2, Ceca: 6 });
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE startni_broj IS NULL'), 0);
});

test('izmena polja, sprave i ucesca ne ponistava potvrdu kluba', () => {
  const { baza, s, p } = nova();
  p.dodajVise(s.takm, [s.t.Ana, s.t.Bea]);
  p.potvrdiKlub(s.takm, s.k1, true);
  const pid = p.lista(s.takm)[0].id;
  const potvrdjen = () => p.stanjePripreme(s.takm).klubovi[s.k1].potvrdjeno;
  assert.equal(potvrdjen(), true);
  p.izmeniPolje(s.takm, pid, 'kategorija_id', s.kat);
  p.izmeniPolje(s.takm, pid, 'program_id', s.prog);
  p.izmeniPolje(s.takm, pid, 'startni_broj', '9');
  assert.equal(potvrdjen(), true);
  p.postaviSpravu(s.takm, pid, s.gr, false);
  assert.equal(potvrdjen(), true);
  p.postaviUcesce(s.takm, pid, 'ekipa');
  assert.equal(potvrdjen(), true);
});

test('idZa: id prijave ili null', () => {
  const { s, p } = nova();
  p.dodajVise(s.takm, [s.t.Ana]);
  const pid = p.lista(s.takm)[0].id;
  assert.equal(p.idZa(s.takm, s.t.Ana), Number(pid));
  assert.equal(p.idZa(s.takm, s.t.Bea), null);
});
