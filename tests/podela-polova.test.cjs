const test = require('node:test');
const assert = require('node:assert/strict');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { podeliPolove } = require('../electron/baza/podela-polova.cjs');

const SAD = '2026-10-01 18:44:06';

function nova() {
  const baza = otvori(':memory:');
  baza.migriraj();
  pocetniPodaci(baza);
  return baza;
}

let brojac = 0;
function takmicenje(baza, naziv, dodatno = {}) {
  return baza.ubaci('takmicenja', {
    naziv, datum: '2026-11-01', mesto: 'Beograd', kreirano: SAD, izmenjeno: SAD, ...dodatno,
  });
}

function klub(baza) {
  brojac++;
  return baza.ubaci('klubovi', { puno_ime: `Klub ${brojac}`, skracenica: `K${brojac}`, grad: '', kreirano: SAD, izmenjeno: SAD });
}

function takmicar(baza, pol, klubId) {
  brojac++;
  return baza.ubaci('takmicari', {
    id_broj: `T${brojac}`, ime: `Ime${brojac}`, prezime: `Prez${brojac}`, godina_rodjenja: 2012, pol, klub_id: klubId,
    kreirano: SAD, izmenjeno: SAD,
  });
}

function prijava(baza, takmId, pol, klubId, dodatno = {}) {
  return baza.ubaci('prijave', {
    takmicenje_id: takmId, takmicar_id: takmicar(baza, pol, klubId), klub_id: klubId,
    kreirano: SAD, izmenjeno: SAD, ...dodatno,
  });
}

function grupa(baza, takmId, pol, naziv) {
  return baza.ubaci('grupe', { takmicenje_id: takmId, pol, naziv, kreirano: SAD, izmenjeno: SAD });
}

function brojRedova(baza, tabela) {
  return Number(baza.vrednost(`SELECT COUNT(*) FROM ${tabela}`));
}

test('jedan pol: takmicenje dobija pol prijava', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Samo dečaci');
  const k = klub(baza);
  prijava(baza, id, 'M', k);
  prijava(baza, id, 'M', k);
  const r = podeliPolove(baza);
  assert.deepEqual(r, { takmicenja: 1, podeljena: 0, kategorije: 0, programi: 0 });
  assert.equal(brojRedova(baza, 'takmicenja'), 1);
  assert.equal(baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [id]), 'M');
});

test('grupa drugog pola racuna se kao pol: M prijave i prazna Z grupa daju dva takmicenja', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Mešano');
  const k = klub(baza);
  const p1 = prijava(baza, id, 'M', k);
  const gM = grupa(baza, id, 'M', 'Grupa M');
  baza.ubaci('grupa_clanovi', { grupa_id: gM, prijava_id: p1, redosled: 1 });
  const gZ = grupa(baza, id, 'Z', 'Grupa Z');
  const r = podeliPolove(baza);
  assert.equal(r.takmicenja, 1);
  assert.equal(r.podeljena, 1);
  assert.equal(brojRedova(baza, 'takmicenja'), 2);
  assert.equal(baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [id]), 'M');
  const novi = baza.jedan("SELECT * FROM takmicenja WHERE pol = 'Z'");
  assert.equal(baza.vrednost('SELECT takmicenje_id FROM grupe WHERE id = ?', [gZ]), novi.id);
  assert.equal(baza.vrednost('SELECT takmicenje_id FROM grupe WHERE id = ?', [gM]), id);
  assert.equal(baza.vrednost('SELECT takmicenje_id FROM prijave WHERE id = ?', [p1]), id);
});

test('oba pola: deli se, ocene idu sa prijavama', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Kup', {
    mesto: 'Niš', broj_e_sudija: 5, pravilo_e: 'prosek', ekipno_broji: 2, pomeraj_redosled: 1, zavrseno: 1,
    zaglavlje_biltena: 'Zaglavlje', organizator: 'Org', domacin: 'Dom', grb_levo: 'grb/l.png', grb_desno: 'grb/d.png',
  });
  const k1 = klub(baza);
  const k2 = klub(baza);
  const spraveZ = baza.svi("SELECT id FROM sprave WHERE pol = 'Z' ORDER BY id").map((s) => s.id);
  const spraveM = baza.svi("SELECT id FROM sprave WHERE pol = 'M' ORDER BY id").map((s) => s.id);
  const z = [1, 2, 3].map((n) => prijava(baza, id, 'Z', k1, { startni_broj: n }));
  const m = [1, 2].map((n) => prijava(baza, id, 'M', k2, { startni_broj: 10 + n }));
  let ocenaId;
  for (const [lista, sprave] of [[z, spraveZ], [m, spraveM]]) {
    for (const p of lista) {
      baza.ubaci('prijava_sprave', { prijava_id: p, sprava_id: sprave[0] });
      ocenaId = baza.ubaci('ocene', {
        prijava_id: p, sprava_id: sprave[0], d: 5000, e: 8000, konacna: 13000, status: 'potvrdjena', kreirano: SAD, izmenjeno: SAD,
      });
      baza.ubaci('ocene_e', { ocena_id: ocenaId, sudija: 1, vrednost: 8000 });
      baza.ubaci('izmene_ocena', { ocena_id: ocenaId, vreme: SAD, razlog: 'ispravka', staro: '1', novo: '2' });
    }
  }
  const gZ = grupa(baza, id, 'Z', 'Z grupa');
  const gM = grupa(baza, id, 'M', 'M grupa');
  z.forEach((p, i) => baza.ubaci('grupa_clanovi', { grupa_id: gZ, prijava_id: p, redosled: i + 1 }));
  m.forEach((p, i) => baza.ubaci('grupa_clanovi', { grupa_id: gM, prijava_id: p, redosled: i + 1 }));
  baza.ubaci('grupa_redosled', { grupa_id: gM, rotacija: 2, prijava_id: m[0], redosled: 2 });
  baza.ubaci('grupa_redosled', { grupa_id: gZ, rotacija: 2, prijava_id: z[0], redosled: 3 });
  baza.ubaci('potvrde_klubova', { takmicenje_id: id, klub_id: k1, potvrdjeno: SAD });
  baza.ubaci('potvrde_klubova', { takmicenje_id: id, klub_id: k2, potvrdjeno: SAD });

  const pre = Object.fromEntries(['ocene', 'ocene_e', 'izmene_ocena', 'grupa_clanovi', 'grupa_redosled', 'prijave', 'grupe']
    .map((t) => [t, brojRedova(baza, t)]));
  const brojeviPre = baza.svi('SELECT id, startni_broj FROM prijave ORDER BY id');

  const r = podeliPolove(baza);
  assert.deepEqual(r, { takmicenja: 1, podeljena: 1, kategorije: 0, programi: 0 });
  assert.equal(brojRedova(baza, 'takmicenja'), 2);

  const staro = baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [id]);
  assert.equal(staro.pol, 'Z', 'stari id ostaje polu sa vise prijava');
  const novo = baza.jedan("SELECT * FROM takmicenja WHERE pol = 'M'");
  assert.notEqual(novo.id, id);
  for (const polje of ['naziv', 'datum', 'mesto', 'broj_e_sudija', 'pravilo_e', 'ekipno_broji', 'pomeraj_redosled', 'zavrseno',
    'zaglavlje_biltena', 'organizator', 'domacin', 'grb_levo', 'grb_desno']) {
    assert.equal(novo[polje], staro[polje], polje);
  }
  assert.match(novo.kreirano, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
  assert.match(novo.izmenjeno, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);

  for (const p of m) assert.equal(baza.vrednost('SELECT takmicenje_id FROM prijave WHERE id = ?', [p]), novo.id);
  for (const p of z) assert.equal(baza.vrednost('SELECT takmicenje_id FROM prijave WHERE id = ?', [p]), id);
  assert.equal(baza.vrednost('SELECT takmicenje_id FROM grupe WHERE id = ?', [gM]), novo.id);
  assert.equal(baza.vrednost('SELECT takmicenje_id FROM grupe WHERE id = ?', [gZ]), id);
  for (const t of Object.keys(pre)) assert.equal(brojRedova(baza, t), pre[t], t);
  assert.deepEqual(baza.svi('SELECT id, startni_broj FROM prijave ORDER BY id'), brojeviPre);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM potvrde_klubova WHERE takmicenje_id = ?', [id]), 2);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM potvrde_klubova WHERE takmicenje_id = ?', [novo.id]), 2);
  assert.deepEqual(baza.svi('PRAGMA foreign_key_check'), []);
});

test('isti broj prijava: stari id ostaje M', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Jednako');
  const k = klub(baza);
  prijava(baza, id, 'Z', k);
  prijava(baza, id, 'Z', k);
  prijava(baza, id, 'M', k);
  prijava(baza, id, 'M', k);
  podeliPolove(baza);
  assert.equal(baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [id]), 'M');
  const novo = baza.jedan("SELECT id FROM takmicenja WHERE pol = 'Z'");
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicenje_id = ?', [novo.id]), 2);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicenje_id = ?', [id]), 2);
});

test('prazno takmicenje ide u oba dela', () => {
  const baza = nova();
  const id = takmicenje(baza, 'test');
  const r = podeliPolove(baza);
  assert.deepEqual(r, { takmicenja: 1, podeljena: 1, kategorije: 0, programi: 0 });
  assert.equal(brojRedova(baza, 'takmicenja'), 2);
  assert.equal(baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [id]), 'M');
  const novo = baza.jedan("SELECT * FROM takmicenja WHERE pol = 'Z'");
  assert.equal(novo.naziv, 'test');
  assert.notEqual(novo.id, id);
});

test('kategorije i programi u oba dela', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Kup');
  const k = klub(baza);
  const kat = baza.ubaci('kategorije', { naziv: 'Pioniri', redosled: 3, kreirano: SAD, izmenjeno: SAD });
  baza.ubaci('kategorije', { naziv: 'Nekorišćena', redosled: 4, kreirano: SAD, izmenjeno: SAD });
  const prog = baza.ubaci('programi', { naziv: 'Program 1', redosled: 7, kreirano: SAD, izmenjeno: SAD });
  const pZ = prijava(baza, id, 'Z', k, { kategorija_id: kat, program_id: prog });
  const pM = prijava(baza, id, 'M', k, { kategorija_id: kat, program_id: prog });
  const r = podeliPolove(baza);
  assert.equal(r.kategorije, 2);
  assert.equal(r.programi, 1);
  assert.equal(brojRedova(baza, 'kategorije'), 4);
  assert.equal(brojRedova(baza, 'programi'), 2);
  const zKat = baza.jedan("SELECT * FROM kategorije WHERE pol = 'Z' AND naziv = 'Pioniri'");
  assert.equal(baza.vrednost('SELECT pol FROM kategorije WHERE id = ?', [kat]), 'M');
  assert.equal(zKat.redosled, 3);
  assert.notEqual(zKat.id, kat);
  assert.equal(baza.vrednost("SELECT COUNT(*) FROM kategorije WHERE pol = 'Z' AND naziv = 'Nekorišćena' AND redosled = 4"), 1);
  const zProg = baza.jedan("SELECT * FROM programi WHERE pol = 'Z'");
  assert.equal(zProg.naziv, 'Program 1');
  assert.equal(zProg.redosled, 7);
  assert.equal(baza.vrednost('SELECT pol FROM programi WHERE id = ?', [prog]), 'M');
  const redZ = baza.jedan('SELECT kategorija_id, program_id FROM prijave WHERE id = ?', [pZ]);
  assert.equal(redZ.kategorija_id, zKat.id);
  assert.equal(redZ.program_id, zProg.id);
  const redM = baza.jedan('SELECT kategorija_id, program_id FROM prijave WHERE id = ?', [pM]);
  assert.equal(redM.kategorija_id, kat);
  assert.equal(redM.program_id, prog);
  assert.deepEqual(baza.svi('PRAGMA foreign_key_check'), []);
});

test('aktivno po polu: podeljeno aktivno takmicenje postaje aktivno u oba dela', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Kup');
  const k = klub(baza);
  prijava(baza, id, 'Z', k);
  prijava(baza, id, 'Z', k);
  prijava(baza, id, 'M', k);
  baza.ubaci('podesavanja', { kljuc: 'aktivno_takmicenje', vrednost: String(id) });
  podeliPolove(baza);
  const novoM = baza.jedan("SELECT id FROM takmicenja WHERE pol = 'M'").id;
  const kljuc = (k2) => baza.vrednost('SELECT vrednost FROM podesavanja WHERE kljuc = ?', [k2]);
  assert.equal(kljuc('aktivno_takmicenje_Z'), String(id));
  assert.equal(kljuc('aktivno_takmicenje_M'), String(novoM));
  assert.equal(baza.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc = 'aktivno_takmicenje'"), 0);
  assert.equal(kljuc('aktivni_pol'), 'Z');
});

test('aktivno po polu: nepodeljeno aktivno ide samo u deo svog pola', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Kup');
  prijava(baza, id, 'M', klub(baza));
  baza.ubaci('podesavanja', { kljuc: 'aktivno_takmicenje', vrednost: String(id) });
  podeliPolove(baza);
  const kljuc = (k2) => baza.vrednost('SELECT vrednost FROM podesavanja WHERE kljuc = ?', [k2]);
  assert.equal(kljuc('aktivno_takmicenje_M'), String(id));
  assert.equal(kljuc('aktivno_takmicenje_Z'), null);
  assert.equal(kljuc('aktivni_pol'), 'M');
});

test('aktivno po polu: bez aktivnog takmicenja aktivni_pol je M, postojeci se ne prepisuje', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Kup');
  prijava(baza, id, 'Z', klub(baza));
  podeliPolove(baza);
  const kljuc = (k2) => baza.vrednost('SELECT vrednost FROM podesavanja WHERE kljuc = ?', [k2]);
  assert.equal(kljuc('aktivni_pol'), 'M');
  assert.equal(kljuc('aktivno_takmicenje_Z'), null);
  assert.equal(kljuc('aktivno_takmicenje_M'), null);

  const druga = nova();
  const id2 = takmicenje(druga, 'Kup');
  prijava(druga, id2, 'Z', klub(druga));
  druga.ubaci('podesavanja', { kljuc: 'aktivni_pol', vrednost: 'Z' });
  podeliPolove(druga);
  assert.equal(druga.vrednost("SELECT vrednost FROM podesavanja WHERE kljuc = 'aktivni_pol'"), 'Z');
});

test('aktivno po polu: stari kljuc koji ne pokazuje ni na sta se samo brise', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Kup');
  prijava(baza, id, 'M', klub(baza));
  baza.ubaci('podesavanja', { kljuc: 'aktivno_takmicenje', vrednost: '999' });
  podeliPolove(baza);
  assert.equal(baza.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc = 'aktivno_takmicenje'"), 0);
  assert.equal(baza.vrednost("SELECT COUNT(*) FROM podesavanja WHERE kljuc IN ('aktivno_takmicenje_M', 'aktivno_takmicenje_Z')"), 0);
});

test('drugi poziv ne menja nista', () => {
  const baza = nova();
  const id = takmicenje(baza, 'Kup');
  const k = klub(baza);
  prijava(baza, id, 'Z', k);
  prijava(baza, id, 'M', k);
  baza.ubaci('kategorije', { naziv: 'Pioniri', redosled: 1, kreirano: SAD, izmenjeno: SAD });
  baza.ubaci('programi', { naziv: 'P1', redosled: 1, kreirano: SAD, izmenjeno: SAD });
  takmicenje(baza, 'prazno');
  baza.ubaci('podesavanja', { kljuc: 'aktivno_takmicenje', vrednost: String(id) });
  const prvi = podeliPolove(baza);
  assert.equal(prvi.takmicenja, 2);
  const tabele = ['takmicenja', 'kategorije', 'programi', 'prijave', 'grupe', 'podesavanja', 'potvrde_klubova'];
  const pre = tabele.map((t) => brojRedova(baza, t));
  const podesavanjaPre = baza.svi('SELECT * FROM podesavanja ORDER BY kljuc');
  assert.deepEqual(podeliPolove(baza), { takmicenja: 0, podeljena: 0, kategorije: 0, programi: 0 });
  assert.deepEqual(tabele.map((t) => brojRedova(baza, t)), pre);
  assert.deepEqual(baza.svi('SELECT * FROM podesavanja ORDER BY kljuc'), podesavanjaPre);
});

test('prazna baza: sve nule, bez upisa u podesavanja', () => {
  const baza = nova();
  const pre = baza.svi('SELECT * FROM podesavanja ORDER BY kljuc');
  assert.deepEqual(podeliPolove(baza), { takmicenja: 0, podeljena: 0, kategorije: 0, programi: 0 });
  assert.deepEqual(baza.svi('SELECT * FROM podesavanja ORDER BY kljuc'), pre);
});

// 1.1.x: pol takmicara se mogao ispraviti i dok ima prijave; prijava prelazi u drugi deo, a clan stare grupe ne sme da ostane.
test('clan grupe cijem se polu promenio pol postaje nerasporedjen u svom delu', () => {
  const { napraviModule } = require('../electron/moduli.cjs');
  const baza = nova();
  const id = takmicenje(baza, 'Kup');
  const k = klub(baza);
  const g = grupa(baza, id, 'M', 'A');
  const prijave = [prijava(baza, id, 'M', k), prijava(baza, id, 'M', k), prijava(baza, id, 'M', k)];
  prijave.forEach((p, i) => {
    baza.izvrsi('INSERT INTO grupa_clanovi (grupa_id, prijava_id, redosled) VALUES (?, ?, ?)', [g, p, i + 1]);
    baza.izvrsi('INSERT INTO grupa_redosled (grupa_id, rotacija, prijava_id, redosled) VALUES (?, 2, ?, ?)', [g, p, 3 - i]);
  });
  const ispravljena = prijave[2];
  baza.izvrsi("UPDATE takmicari SET pol = 'Z' WHERE id = (SELECT takmicar_id FROM prijave WHERE id = ?)", [ispravljena]);
  const brojevi = () => ['prijave', 'ocene', 'ocene_e', 'izmene_ocena'].map((t) => (baza.tabele().includes(t) ? brojRedova(baza, t) : 0));
  const pre = brojevi();

  podeliPolove(baza);

  const zsg = baza.jedan("SELECT id FROM takmicenja WHERE pol = 'Z'").id;
  assert.equal(baza.vrednost('SELECT takmicenje_id FROM prijave WHERE id = ?', [ispravljena]), zsg);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupa_clanovi WHERE prijava_id = ?', [ispravljena]), 0);
  assert.equal(baza.vrednost('SELECT COUNT(*) FROM grupa_redosled WHERE prijava_id = ?', [ispravljena]), 0);
  assert.equal(brojRedova(baza, 'grupa_clanovi'), 2);
  assert.equal(brojRedova(baza, 'grupa_redosled'), 2);
  assert.deepEqual(brojevi(), pre, 'prijave i ocene se ne brisu');

  const m = napraviModule(baza, { dialog: {}, fasciklaPodataka: () => require('node:os').tmpdir(), dnevnik: { info() {}, greska() {} } });
  m.pol.postavi('M');
  m.takmicenja.otvori(String(id));
  const msg = m.rotacije.podaci(1);
  assert.deepEqual(msg.grupe.map((x) => x.clanovi.map((c) => Number(c.prijava_id))), [[Number(prijave[0]), Number(prijave[1])]]);
  assert.equal(msg.nerasporedjeni.length, 0);
  m.pol.postavi('Z');
  m.takmicenja.otvori(String(zsg));
  const z = m.rotacije.podaci(1);
  assert.equal(z.grupe.length, 0);
  assert.deepEqual(z.nerasporedjeni.map((c) => Number(c.prijava_id)), [Number(ispravljena)]);

  // drugi prolaz: nista se ne menja
  const pocetak = JSON.stringify([baza.svi('SELECT * FROM grupa_clanovi ORDER BY prijava_id'), baza.svi('SELECT * FROM grupa_redosled ORDER BY prijava_id'), baza.svi('SELECT id, takmicenje_id FROM prijave ORDER BY id')]);
  assert.deepEqual(podeliPolove(baza), { takmicenja: 0, podeljena: 0, kategorije: 0, programi: 0 });
  assert.equal(JSON.stringify([baza.svi('SELECT * FROM grupa_clanovi ORDER BY prijava_id'), baza.svi('SELECT * FROM grupa_redosled ORDER BY prijava_id'), baza.svi('SELECT id, takmicenje_id FROM prijave ORDER BY id')]), pocetak);
  assert.deepEqual(baza.svi('PRAGMA foreign_key_check'), []);
});
