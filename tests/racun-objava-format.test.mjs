import test from 'node:test';
import assert from 'node:assert/strict';
import { VERZIJA_FORMATA, NAJVECA_VELICINA, napraviObjavu, proveriObjavu } from '../electron/racun/objava-format.mjs';

const UID = '8f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
const SAD = '2026-11-13T18:00:00.000Z';

function redovi() {
  return {
    takmicenje: {
      id: 1, naziv: 'Kup', datum: '15.03.2027.', mesto: 'Nis', pol: 'Z', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje',
      ekipno_broji: 3, pomeraj_redosled: 0, zaglavlje_biltena: '', organizator: 'Savez', domacin: 'Klub',
      zavrseno: 1, grb_levo: 'grb/a.png', grb_desno: 'grb/b.png', uid: 'x', kreirano: 'k', izmenjeno: 'i',
    },
    klubovi: [{ id: 5, puno_ime: 'Klub A', skracenica: 'KA', grad: 'Nis', kreirano: 'k', izmenjeno: 'i' }],
    takmicari: [{
      id: 7, id_broj: 'T1', ime: 'Ana', prezime: 'Anic', godina_rodjenja: 2012, pol: 'Z', klub_id: 5, drzavljanstvo: 'Srbija',
      lekarski_do: '2027-01-01', broj_licence: 'L', trener: 'Tr', kontakt_roditelja: 'k', kreirano: 'k', izmenjeno: 'i',
    }],
    kategorije: [{ id: 2, naziv: 'Mladje', pol: 'Z', redosled: 1, kreirano: 'k', izmenjeno: 'i' }],
    programi: [{ id: 3, naziv: 'P1', pol: 'Z', redosled: 1, kreirano: 'k', izmenjeno: 'i' }],
    sprave: [{ id: 4, pol: 'Z', skracenica: 'PR', naziv: 'Preskok', ikona: '', redosled: 1, kreirano: 'k', izmenjeno: 'i' }],
    prijave: [{
      id: 10, takmicenje_id: 1, takmicar_id: 7, klub_id: 5, kategorija_id: 2, program_id: 3, clan_ekipe: 1,
      van_konkurencije: 0, startni_broj: 12, kreirano: 'k', izmenjeno: 'i',
    }],
    prijavaSprave: [{ prijava_id: 10, sprava_id: 4 }],
    grupe: [{ id: 20, takmicenje_id: 1, pol: 'Z', naziv: 'G1', redosled: 1, pocetna_pozicija: 1, turnus: 1, kreirano: 'k', izmenjeno: 'i' }],
    clanovi: [{ grupa_id: 20, prijava_id: 10, redosled: 1 }],
    redosledi: [{ grupa_id: 20, rotacija: 2, prijava_id: 10, redosled: 3 }],
    ocene: [{
      id: 30, prijava_id: 10, sprava_id: 4, d: null, e: null, bonus: null, odbitak: null, konacna: null,
      status: 'nacrt', broj_ispravki: 0, uneto_u: null, kreirano: 'k', izmenjeno: 'i',
    }],
    oceneE: [{ ocena_id: 30, sudija: 1, vrednost: null }, { ocena_id: 30, sudija: 2, vrednost: 8500 }],
  };
}

const napravi = () => napraviObjavu(redovi(), { uid: UID, verzija: '1.2.9', sad: SAD });

test('konstante', () => {
  assert.equal(VERZIJA_FORMATA, 1);
  assert.equal(NAJVECA_VELICINA, 2097152);
});

test('napraviObjavu: zaglavlje i takmicenje bez zabranjenih polja', () => {
  const o = napravi();
  assert.equal(o.verzija_formata, 1);
  assert.equal(o.uid, UID);
  assert.deepEqual(o.program, { naziv: 'Gimnastika desktop', verzija: '1.2.9' });
  assert.equal(o.objavljeno, SAD);
  assert.deepEqual(Object.keys(o.takmicenje), ['naziv', 'datum', 'mesto', 'pol', 'broj_e_sudija', 'pravilo_e',
    'ekipno_broji', 'pomeraj_redosled', 'zaglavlje_biltena', 'organizator', 'domacin']);
  assert.equal(o.takmicenje.naziv, 'Kup');
});

test('napraviObjavu: takmicar bez zabranjenih polja', () => {
  const o = napravi();
  assert.deepEqual(Object.keys(o.takmicari[0]), ['id', 'ime', 'prezime', 'godina_rodjenja', 'pol', 'klub_id', 'drzavljanstvo']);
  const tekst = JSON.stringify(o);
  for (const k of ['kontakt_roditelja', 'lekarski_do', 'broj_licence', 'trener', 'id_broj', 'grb_levo', 'grb_desno',
    'zavrseno', 'izmene_ocena', 'potvrde_klubova', 'podesavanja', 'kreirano', 'izmenjeno']) {
    assert.ok(!tekst.includes('"' + k + '"'), k);
  }
});

test('napraviObjavu: ostali nizovi imaju samo dozvoljena polja', () => {
  const o = napravi();
  assert.deepEqual(Object.keys(o.klubovi[0]), ['id', 'puno_ime', 'skracenica', 'grad']);
  assert.deepEqual(Object.keys(o.kategorije[0]), ['id', 'naziv', 'pol', 'redosled']);
  assert.deepEqual(Object.keys(o.programi[0]), ['id', 'naziv', 'pol', 'redosled']);
  assert.deepEqual(Object.keys(o.sprave[0]), ['id', 'pol', 'skracenica', 'naziv']);
});

test('napraviObjavu: prijava nosi sprave', () => {
  const p = napravi().prijave[0];
  assert.deepEqual(Object.keys(p), ['id', 'takmicar_id', 'klub_id', 'kategorija_id', 'program_id', 'clan_ekipe',
    'van_konkurencije', 'startni_broj', 'sprave']);
  assert.deepEqual(p.sprave, [4]);
});

test('napraviObjavu: grupa nosi clanove i redosled po rotaciji', () => {
  const g = napravi().grupe[0];
  assert.deepEqual(Object.keys(g), ['id', 'pol', 'naziv', 'redosled', 'pocetna_pozicija', 'turnus', 'clanovi', 'redosled_po_rotaciji']);
  assert.deepEqual(g.clanovi, [{ prijava_id: 10, redosled: 1 }]);
  assert.deepEqual(g.redosled_po_rotaciji, [{ rotacija: 2, prijava_id: 10, redosled: 3 }]);
});

test('napraviObjavu: nacrt ocene zadrzava null', () => {
  const ocena = napravi().ocene[0];
  assert.deepEqual(Object.keys(ocena), ['prijava_id', 'sprava_id', 'd', 'e', 'bonus', 'odbitak', 'konacna', 'status',
    'broj_ispravki', 'uneto_u', 'e_sudije']);
  for (const k of ['d', 'e', 'konacna', 'bonus', 'odbitak', 'uneto_u']) assert.equal(ocena[k], null, k);
  assert.deepEqual(ocena.e_sudije, [{ sudija: 1, vrednost: null }, { sudija: 2, vrednost: 8500 }]);
});

test('proveriObjavu: ispravna objava', () => {
  assert.deepEqual(proveriObjavu(napravi()), []);
  assert.deepEqual(proveriObjavu(JSON.parse(JSON.stringify(napravi()))), []);
});

function jedna(izmeni) {
  const o = JSON.parse(JSON.stringify(napravi()));
  izmeni(o);
  const p = proveriObjavu(o);
  assert.equal(p.length, 1, JSON.stringify(p));
  return p[0];
}

test('proveriObjavu: po jedna poruka za svaku gresku', () => {
  jedna((o) => { o.verzija_formata = 2; });
  jedna((o) => { o.uid = 'nije-uuid'; });
  jedna((o) => { o.takmicenje.naziv = ''; });
  jedna((o) => { o.takmicenje.datum = ''; });
  jedna((o) => { o.takmicenje.pol = 'X'; });
  jedna((o) => { delete o.grupe; });
  jedna((o) => { o.prijave[0].takmicar_id = 999; });
  jedna((o) => { o.prijave[0].klub_id = 999; });
  jedna((o) => { o.prijave[0].sprave = [999]; });
  jedna((o) => { o.grupe[0].clanovi[0].prijava_id = 999; });
  jedna((o) => { o.grupe[0].redosled_po_rotaciji[0].prijava_id = 999; });
  jedna((o) => { o.ocene[0].prijava_id = 999; });
  jedna((o) => { o.ocene[0].sprava_id = 999; });
});

test('proveriObjavu: null klub, kategorija i program su dozvoljeni', () => {
  const o = napravi();
  o.prijave[0].klub_id = null;
  o.prijave[0].kategorija_id = null;
  o.prijave[0].program_id = null;
  assert.deepEqual(proveriObjavu(o), []);
});

test('proveriObjavu: nije objekat', () => {
  assert.equal(proveriObjavu(null).length, 1);
  assert.equal(proveriObjavu([]).length, 1);
});
