const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviPrijave } = require('../electron/modeli/prijave.cjs');
const { napravi: napraviOcene } = require('../electron/modeli/ocene.cjs');
const { napravi } = require('../electron/modeli/rezultati.cjs');
const { uvezi } = require('../alati/primer-podaci.cjs');
const { izBaze } = require('../electron/racun/broj.mjs');
const { tokSeme } = require('./pomoc/seme.cjs');
const json = require('../docs/proizvod/dizajn/primer-podaci.json');

// Baza sa semom (Ana, Bea, Ceca, Dona u ZSG takmicenju s.takm; Marko u MSG takmicenju s.takmM) i prijavama; svi Z su clanovi ekipe, Ceca je VK.
function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  const s = tokSeme(baza);
  const podesavanja = napraviPodesavanja(baza, '');
  const prijave = napraviPrijave(baza, podesavanja);
  prijave.dodajVise(s.takm, [s.t.Ana, s.t.Bea, s.t.Ceca, s.t.Dona]);
  prijave.dodajVise(s.takmM, [s.muski]);
  const pid = {};
  for (const r of baza.svi('SELECT p.id, t.ime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.takmicenje_id IN (?, ?)', [s.takm, s.takmM])) pid[r.ime] = r.id;
  for (const ime of ['Ana', 'Bea', 'Ceca', 'Dona']) prijave.izmeniPolje(s.takm, pid[ime], 'clan_ekipe', true);
  prijave.izmeniPolje(s.takm, pid.Ceca, 'van_konkurencije', true);
  const o = napraviOcene(baza, podesavanja);
  const unos = (ime, sprava, d, e) => o.sacuvaj(s.takm, pid[ime], sprava, { d, e: [e, e, e, e], odbitak: '' }, true);
  return { baza, s, pid, prijave, podesavanja, o, unos, r: napravi(baza, podesavanja), takm: () => baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [s.takm]), takmM: () => baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [s.takmM]) };
}

// Ocene iz POPIS 8.1.
function popuni(n) {
  const { s, o, unos, pid } = n;
  unos('Ana', s.pr, '4,0', '8,0');
  unos('Ana', s.gr, '4,0', '8,5');
  unos('Bea', s.pr, '4,0', '8,0');
  unos('Bea', s.gr, '4,0', '7,0');
  unos('Ceca', s.pr, '5,0', '8,0');
  unos('Ceca', s.gr, '5,0', '8,0');
  unos('Dona', s.pr, '3,0', '8,0');
  o.odustao(s.takm, pid.Dona, s.gr);
}

const oznake = (red) => Object.fromEntries(red.map((r) => [r.prijava, r.oznaka]));

test('izracunaj iz baze (POPIS 8.1)', () => {
  const n = nova();
  popuni(n);
  const { s, pid, r } = n;
  const rez = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);

  assert.deepEqual(rez.sprave.map((x) => x.id), [s.pr, s.gr]);
  assert.deepEqual(rez.prijave_redom.map((p) => p.id), [pid.Ana, pid.Bea, pid.Ceca, pid.Dona]);
  assert.equal(rez.prijave[pid.Ana].klub_skr, 'JED');
  assert.deepEqual(rez.prijave[pid.Ana].sprave.sort(), [s.pr, s.gr].sort());

  const pr = oznake(rez.po_spravi[s.pr]);
  assert.equal(pr[pid.Ceca], 'VK');
  assert.equal(pr[pid.Ana], '1');
  assert.equal(pr[pid.Bea], '1', 'isti rezultat deli mesto');
  assert.equal(pr[pid.Dona], '3', 'posle deljenog mesta se preskace');
  // redom po mestu: Ceca 13000 (VK) prva, pa Ana i Bea, pa Dona
  assert.deepEqual(rez.po_spravi[s.pr].map((x) => x.prijava), [pid.Ceca, pid.Ana, pid.Bea, pid.Dona]);

  const gr = rez.po_spravi[s.gr];
  assert.equal(gr[gr.length - 1].prijava, pid.Dona);
  assert.equal(gr[gr.length - 1].status, 'odustao');
  assert.equal(gr[gr.length - 1].mesto, null);

  const v = Object.fromEntries(rez.viseboj.map((x, i) => [x.prijava, { ...x, poz: i }]));
  assert.equal(v[pid.Ceca].poz, 0, 'VK je na mestu koje joj po oceni pripada');
  assert.equal(v[pid.Ceca].oznaka, 'VK');
  assert.equal(v[pid.Ana].mesto, 1);
  assert.equal(v[pid.Ana].zbir, 24500);
  assert.equal(v[pid.Bea].mesto, 2);
  assert.equal(v[pid.Dona].zbir, null, 'odustala nema zbir');
  assert.equal(v[pid.Dona].mesto, null);
  assert.equal(v[pid.Dona].poz, 3, 'odustala je na dnu');
  assert.equal(v[pid.Dona].odustao, true);
  assert.equal(v[pid.Ana].odustao, false);
  assert.equal(v[pid.Ana].mesta[s.gr], '1');

  assert.equal(rez.ekipno.length, 2);
  assert.equal(rez.ekipno[0].klub.skracenica, 'JED');
  assert.equal(rez.ekipno[0].ukupno, 24500, 'JED: 12,000 + 12,500');
  assert.equal(rez.ekipno[0].mesto, 1);
  assert.equal(rez.ekipno[1].klub.skracenica, 'DVA');
  assert.equal(rez.ekipno[1].ukupno, 11000, 'DVA: samo Dona na PR, Ceca je VK');
  assert.equal(rez.ekipno[1].clanovi.length, 1);
  assert.deepEqual(rez.ekipno[0].clanovi.map((c) => c.prijava), [pid.Ana, pid.Bea], 'clanovi po zbiru opadajuce');
  assert.equal(rez.ekipno[0].clanovi[0].zbir, 24500);
  assert.deepEqual(rez.ekipno[0].clanovi[0].broji, { [s.pr]: true, [s.gr]: true });
  assert.deepEqual(rez.ekipno[0].clanovi[1].broji, { [s.pr]: false, [s.gr]: false });
  assert.equal(rez.ekipno[1].clanovi[0].zbir, 11000);
  assert.equal(rez.ekipno[1].clanovi[0].ocene[s.gr], null, 'odustala na GR');

  // visa E pa D: Bea ispravka PR 3,9 / 8,1 = 12,000, visa E pobedjuje
  n.podesavanja.postavi('plasman_isti_rezultat', 'visa_e_pa_d');
  n.o.sacuvaj(s.takm, pid.Bea, s.pr, { d: '3,9', e: ['8,1', '8,1', '8,1', '8,1'], odbitak: '' }, true, 'test');
  const rez2 = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  const pr2 = oznake(rez2.po_spravi[s.pr]);
  assert.equal(pr2[pid.Bea], '1');
  assert.equal(pr2[pid.Ana], '2');
  n.baza.zatvori();
});

test('kombinacije: null kombinacija i redosled', () => {
  const n = nova();
  const { s, pid, prijave, baza, r } = n;
  // Dona bez kategorije i programa; Marko je u MSG takmicenju
  prijave.izmeniPolje(s.takm, pid.Dona, 'kategorija_id', 0);
  prijave.izmeniPolje(s.takm, pid.Dona, 'program_id', 0);
  const druga = baza.ubaci('kategorije', { naziv: 'Juniori', redosled: 2, pol: 'Z', kreirano: 'a', izmenjeno: 'a' });
  prijave.izmeniPolje(s.takm, pid.Bea, 'kategorija_id', druga);
  const k = r.kombinacije(s.takm);
  assert.deepEqual(k.map((x) => [x.pol, x.kategorija_id, x.kategorija, x.program_id, x.program, x.broj]), [
    ['Z', null, null, null, null, 1],
    ['Z', s.kat, 'Kadet', s.prog, 'C', 2],
    ['Z', druga, 'Juniori', s.prog, 'C', 1],
  ]);
  assert.deepEqual(r.kombinacije(s.takmM).map((x) => [x.pol, x.kategorija_id, x.program_id, x.broj]), [['M', s.katM, s.progM, 1]]);
  assert.deepEqual(r.kombinacije(s.takm, 'M'), []);
  assert.deepEqual(r.kombinacije(s.takm, 'Z').map((x) => x.pol), ['Z', 'Z', 'Z']);
  baza.zatvori();
});

test('izbor: podrazumevane vrednosti i nepostojeci kat', () => {
  const n = nova();
  const { s, r, baza } = n;
  let iz = r.izbor(s.takm, undefined, undefined, undefined);
  assert.equal(iz.ima, true);
  assert.equal(iz.pol, 'Z');
  assert.equal(iz.kat, s.kat);
  assert.equal(iz.prog, s.prog);
  assert.deepEqual(iz.kategorije, [{ id: s.kat, naziv: 'Kadet' }]);
  assert.deepEqual(iz.programi, [{ id: s.prog, naziv: 'C' }]);
  assert.equal(iz.kat_naziv, 'Kadet');
  assert.equal(iz.prog_naziv, 'C');

  // objekat takmicenja i id daju isto
  assert.deepEqual(r.izbor(n.takm(), undefined, undefined, undefined), iz);
  assert.equal(r.izbor({ id: s.takm }, 'M').pol, 'M');

  // nepostojeci kat i prog, nepoznat pol
  iz = r.izbor(s.takm, 'X', '999', '999');
  assert.equal(iz.pol, 'Z');
  assert.equal(iz.kat, s.kat);
  assert.equal(iz.prog, s.prog);
  iz = r.izbor(s.takmM, 'M', String(s.katM), '');
  assert.equal(iz.pol, 'M');
  assert.equal(iz.kat, s.katM);
  baza.zatvori();
});

test('izbor: pol bez ZSG prijava, null kategorija (0) i bez prijava', () => {
  const n = nova();
  const { s, r, baza, pid, prijave } = n;
  prijave.izmeniPolje(s.takmM, pid.Marko, 'kategorija_id', 0);
  prijave.izmeniPolje(s.takmM, pid.Marko, 'program_id', 0);
  let iz = r.izbor(s.takmM, 'M', '0', '0');
  assert.equal(iz.ima, true);
  assert.equal(iz.kat, null);
  assert.equal(iz.prog, null);
  assert.deepEqual(iz.kategorije, [{ id: 0, naziv: '–' }]);
  assert.deepEqual(iz.programi, [{ id: 0, naziv: '–' }]);
  assert.equal(iz.kat_naziv, '–');
  assert.equal(iz.prog_naziv, '–');
  // nepostojeci kat -> prva (null) kategorija
  iz = r.izbor(s.takmM, 'M', '77', '77');
  assert.equal(iz.kat, null);
  assert.equal(iz.kat_naziv, '–');

  // takmicenje bez prijava
  const drugo = baza.ubaci('takmicenja', { naziv: 'Prazno', datum: '2026-11-01', mesto: 'X', broj_e_sudija: 4, pravilo_e: 'prosek', ekipno_broji: 3, pol: 'Z', kreirano: 'a', izmenjeno: 'a' });
  iz = r.izbor(drugo, undefined, undefined, undefined);
  assert.equal(iz.ima, false);
  assert.equal(iz.pol, 'Z');
  assert.equal(iz.kat, null);
  assert.equal(iz.prog, null);
  assert.deepEqual(iz.kategorije, []);
  assert.deepEqual(iz.programi, []);
  baza.zatvori();
});

test('izbor: podrazumevani pol je M kad nema ZSG prijava', () => {
  const n = nova();
  const { s, r, baza } = n;
  baza.izvrsi("DELETE FROM prijave WHERE takmicar_id IN (SELECT id FROM takmicari WHERE pol = 'Z')");
  assert.equal(r.izbor(s.takmM, undefined, undefined, undefined).pol, 'M');
  baza.zatvori();
});

test('nacrt se ne racuna; prijava bez ocena nije u visebou', () => {
  const n = nova();
  const { s, pid, o, unos, r } = n;
  unos('Ana', s.pr, '4,0', '8,0');
  o.sacuvaj(s.takm, pid.Bea, s.pr, { d: '4,0', e: ['8,0', '8,0', '', ''], odbitak: '' }, false); // nacrt
  const rez = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  assert.deepEqual(rez.po_spravi[s.pr].map((x) => x.prijava), [pid.Ana]);
  assert.deepEqual(rez.po_spravi[s.gr], []);
  assert.deepEqual(rez.viseboj.map((x) => x.prijava), [pid.Ana], 'Bea (samo nacrt), Ceca i Dona nemaju ocene');
  n.baza.zatvori();
});

test('ne_ulazi iskljucuje iz viseboja, ne iz po spravi ni ekipe', () => {
  const n = nova();
  const { s, pid, prijave, unos, r, podesavanja } = n;
  prijave.postaviSpravu(s.takm, pid.Bea, s.gr, false); // Bea radi samo PR
  unos('Ana', s.pr, '4,0', '8,0');
  unos('Ana', s.gr, '4,0', '8,5');
  unos('Bea', s.pr, '4,0', '8,0');
  podesavanja.postavi('viseboj_nepotpun', 'ne_ulazi');
  const rez = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  const v = Object.fromEntries(rez.viseboj.map((x) => [x.prijava, x]));
  assert.equal(v[pid.Ana].mesto, 1);
  assert.equal(v[pid.Bea].zbir, null);
  assert.equal(v[pid.Bea].mesto, null);
  assert.equal(v[pid.Bea].oznaka, '');
  assert.equal(v[pid.Bea].odustao, false);
  assert.equal(rez.viseboj[rez.viseboj.length - 1].prijava, pid.Bea, 'iskljucena je na dnu');
  assert.deepEqual(oznake(rez.po_spravi[s.pr]), { [pid.Ana]: '1', [pid.Bea]: '1' });
  assert.equal(rez.ekipno[0].ukupno, 24500, 'Bea ostaje u ekipi, ali se broji najbolja');

  // sa ulazi: Bea dobija delimican zbir
  podesavanja.postavi('viseboj_nepotpun', 'ulazi');
  const rez2 = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  const v2 = Object.fromEntries(rez2.viseboj.map((x) => [x.prijava, x]));
  assert.equal(v2[pid.Bea].zbir, 12000);
  assert.equal(v2[pid.Bea].mesto, 2);
  n.baza.zatvori();
});

test('detalji.odbacene i ostali detalji ocene', () => {
  const n = nova();
  const { s, pid, o, r } = n;
  o.sacuvaj(s.takm, pid.Ana, s.pr, { d: '4,8', e: ['8,3', '8,1', '8,4', '8,2'], odbitak: '0,1' }, true);
  const rez = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  const red = rez.po_spravi[s.pr][0];
  assert.equal(red.prijava, pid.Ana);
  assert.equal(red.status, 'uneto');
  assert.equal(red.d, 4800);
  assert.equal(red.odbitak, 100);
  assert.deepEqual(red.odbacene, [1, 2]);
  assert.deepEqual(red.e_sudije, { 1: 8300, 2: 8100, 3: 8400, 4: 8200 });
  assert.equal(red.konacna, 4800 + 8250 - 100);
  const vr = rez.viseboj[0];
  assert.deepEqual(vr.detalji[s.pr].odbacene, [1, 2]);
  n.baza.zatvori();
});

test('ekipa bez kluba ne postoji; VK i ne-clanovi ne ulaze', () => {
  const n = nova();
  const { s, pid, baza, prijave, unos, r } = n;
  unos('Ana', s.pr, '4,0', '8,0');
  unos('Bea', s.pr, '4,0', '7,0');
  baza.izvrsi('UPDATE prijave SET klub_id = NULL WHERE id = ?', [pid.Bea]);
  let rez = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  // Bea (bez kluba) ne ulazi nigde; Ceca je VK; DVA ima samo Donu bez ocena (ekipa bez ocena ima ukupno 0)
  assert.deepEqual(rez.ekipno.map((e) => e.klub.skracenica), ['JED', 'DVA']);
  assert.equal(rez.ekipno[0].ukupno, 12000);
  assert.deepEqual(rez.ekipno[0].clanovi.map((c) => c.prijava), [pid.Ana]);
  assert.equal(rez.ekipno[1].ukupno, 0);
  assert.deepEqual(rez.ekipno[1].clanovi.map((c) => c.prijava), [pid.Dona]);
  assert.equal(rez.ekipno[1].clanovi[0].zbir, null);
  // Ana nije clan ekipe: ostaje samo DVA
  prijave.izmeniPolje(s.takm, pid.Ana, 'clan_ekipe', false);
  rez = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  assert.deepEqual(rez.ekipno.map((e) => e.klub.skracenica), ['DVA']);
  assert.equal(rez.viseboj.length, 2, 'bez kluba i dalje ulazi u viseboj');
  baza.zatvori();
});

test('izracunaj za drugu grupu i pol: samo njene prijave', () => {
  const n = nova();
  const { s, r, pid } = n;
  n.unos('Ana', s.pr, '4,0', '8,0');
  const m = r.izracunaj(n.takmM(), 'M', s.katM, s.progM);
  assert.deepEqual(m.sprave.map((x) => x.id), [s.pa]);
  assert.deepEqual(m.prijave_redom.map((p) => p.id), [pid.Marko]);
  assert.deepEqual(m.po_spravi[s.pa], []);
  assert.deepEqual(m.viseboj, []);
  assert.deepEqual(m.ekipno, []);
  const nista = r.izracunaj(n.takm(), 'Z', null, null);
  assert.deepEqual(nista.prijave_redom, []);
  n.baza.zatvori();
});

// Primer podaci: rezultati kroz model jednaki ocekivanim iz JSON-a.
function proveriPrimer(kljuc, pol) {
  const baza = otvori(':memory:');
  baza.migriraj();
  uvezi(baza, json);
  const podesavanja = napraviPodesavanja(baza, '');
  const r = napravi(baza, podesavanja);
  const takm = baza.jedan('SELECT * FROM takmicenja WHERE naziv = ? AND pol = ?', [json.takmicenje.naziv, pol]);
  const iz = r.izbor(takm.id, pol, undefined, undefined);
  assert.equal(iz.ima, true);
  assert.equal(iz.pol, pol);
  const rez = r.izracunaj(takm, pol, iz.kat, iz.prog);
  const grupa = json[kljuc];
  const sk = Object.fromEntries(rez.sprave.map((sp) => [sp.id, sp.skracenica]));
  const imena = (p) => `${p.prezime} ${p.ime}`;
  const poImenu = new Map(rez.prijave_redom.map((p) => [imena(p), p.id]));
  assert.equal(poImenu.size, grupa.takmicari.length);

  for (const sp of rez.sprave) {
    const oz = oznake(rez.po_spravi[sp.id]);
    for (const t of grupa.takmicari) {
      const o = t.ocene[sp.skracenica];
      if (o !== undefined && o !== null) {
        assert.equal(oz[poImenu.get(t.prezime_ime)], String(o.ocekivano_mesto), `${t.prezime_ime} ${sp.skracenica}`);
      }
    }
  }
  const v = Object.fromEntries(rez.viseboj.map((x) => [x.prijava, x]));
  for (const t of grupa.takmicari) {
    const x = v[poImenu.get(t.prezime_ime)];
    assert.ok(x, `${t.prezime_ime} je u visebou`);
    assert.equal(x.zbir, t.viseboj === null ? null : izBaze(t.viseboj), `${t.prezime_ime} viseboj zbir`);
    assert.equal(x.oznaka, String(t.ocekivano_mesto_viseboj ?? ''), `${t.prezime_ime} viseboj mesto`);
  }
  assert.equal(rez.ekipno.length, grupa.ekipno.length);
  grupa.ekipno.forEach((ek, j) => {
    assert.equal(rez.ekipno[j].klub.skracenica, ek.klub);
    assert.equal(rez.ekipno[j].mesto, ek.ocekivano_mesto);
    assert.equal(rez.ekipno[j].ukupno, izBaze(ek.ukupno));
    for (const sp of rez.sprave) assert.equal(rez.ekipno[j].po_spravi[sp.id], izBaze(ek.po_spravi[sk[sp.id]]));
  });
  baza.zatvori();
}

test('primer podaci kroz model: ZSG kadet C', () => proveriPrimer('zsg_kadet_c', 'Z'));
test('primer podaci kroz model: MSG kadet C', () => proveriPrimer('msg_kadet_c', 'M'));

test('VK koji je odustao na jednoj spravi: oznaka prazna, bez mesta, na dnu; VK ostaje na drugoj spravi', () => {
  const n = nova();
  const { s, pid, o, unos, r } = n;
  unos('Ana', s.pr, '4,0', '8,0');
  unos('Ana', s.gr, '4,0', '8,5');
  unos('Bea', s.pr, '4,0', '7,0');
  unos('Bea', s.gr, '4,0', '7,0');
  unos('Ceca', s.pr, '5,0', '8,0');
  o.odustao(s.takm, pid.Ceca, s.gr);
  const rez = r.izracunaj(n.takm(), 'Z', s.kat, s.prog);
  const v = rez.viseboj.map((x) => x.prijava);
  assert.deepEqual(v, [pid.Ana, pid.Bea, pid.Ceca], 'Ceca je poslednja iza rangiranih');
  const ceca = rez.viseboj[2];
  assert.equal(ceca.oznaka, '');
  assert.equal(ceca.mesto, null);
  assert.equal(ceca.odustao, true);
  assert.equal(oznake(rez.po_spravi[s.pr])[pid.Ceca], 'VK', 'na PR ostaje VK');
  for (const e of rez.ekipno) assert.ok(!e.clanovi.some((c) => c.prijava === pid.Ceca), 'VK nije u ekipnom');
  n.baza.zatvori();
});
