// Upisuje primer podatke u bazu: klubovi, sprave, kategorija Kadet, program C program, takmicari.
// Pokretanje: node alati/primer-podaci.cjs (GIM_PODACI bira fasciklu podataka).
// Takmicenja, prijave i ocene iz JSON-a dolaze tek u fazi 3.
const fs = require('node:fs');
const path = require('node:path');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { putanjaBaze } = require('../electron/putanje.cjs');
const { napravi: napraviKlubove } = require('../electron/modeli/klubovi.cjs');
const { napravi: napraviTakmicare } = require('../electron/modeli/takmicari.cjs');
const { napravi: napraviSifarnike } = require('../electron/modeli/sifarnici.cjs');
const { istiTekst } = require('../electron/modeli/sortiranje.cjs');

const JSON_PUTANJA = path.join(__dirname, '..', 'docs', 'proizvod', 'dizajn', 'primer-podaci.json');
const GODINA = { Z: 2012, M: 2011 };
// Lekarski koji ističu uskoro ili su istekli (kao u PHP verziji), ostali do 2027-03-01.
const LEKARSKI = { 'Simić Dunja': '2026-10-09', 'Nikolić Teodora': '2026-10-25', 'Stanković Luka': '2026-10-02' };

// Vraca id postojeceg reda sa istim nazivom ili ga dodaje.
function nadjiIliDodaj(baza, sifarnici, vrsta, tabela, naziv) {
  const postojeci = baza.svi(`SELECT id, naziv FROM ${tabela}`).find((r) => istiTekst(r.naziv, naziv));
  if (postojeci) return { id: postojeci.id, nov: false };
  return { id: sifarnici.dodaj(vrsta, { naziv }), nov: true };
}

function uvezi(baza, json) {
  const klubovi = napraviKlubove(baza);
  const takmicari = napraviTakmicare(baza);
  const sifarnici = napraviSifarnike(baza);
  const rez = { klubovi: 0, klubovi_novih: 0, takmicara: 0, takmicara_novih: 0, sprave: 0, kategorija: 'Kadet', program: 'C program' };

  // Sprave ako fale (tabela prazna).
  pocetniPodaci(baza);
  rez.sprave = Number(baza.vrednost('SELECT COUNT(*) FROM sprave'));

  nadjiIliDodaj(baza, sifarnici, 'kategorije', 'kategorije', rez.kategorija);
  nadjiIliDodaj(baza, sifarnici, 'programi', 'programi', rez.program);

  // Klubovi po skracenici.
  const klubId = {};
  for (const k of json.klubovi) {
    const postojeci = baza.svi('SELECT id, skracenica FROM klubovi').find((r) => istiTekst(r.skracenica, k.skracenica));
    rez.klubovi++;
    if (postojeci) {
      klubId[k.skracenica] = postojeci.id;
    } else {
      klubId[k.skracenica] = klubovi.sacuvaj({ puno_ime: k.puno_ime, skracenica: k.skracenica, grad: k.grad }, null);
      rez.klubovi_novih++;
    }
  }

  // Takmicari po id_broj = 100 + startni broj, 5 cifara (npr. startni 21 => 00121).
  for (const [pol, kljuc] of [['Z', 'zsg_kadet_c'], ['M', 'msg_kadet_c']]) {
    for (const t of json[kljuc].takmicari) {
      const idBroj = String(100 + t.startni_broj).padStart(5, '0');
      rez.takmicara++;
      if (baza.svi('SELECT id_broj FROM takmicari').some((r) => istiTekst(r.id_broj, idBroj))) continue;
      const razmak = t.prezime_ime.indexOf(' ');
      takmicari.sacuvaj({
        id_broj: idBroj,
        prezime: t.prezime_ime.slice(0, razmak),
        ime: t.prezime_ime.slice(razmak + 1),
        godina_rodjenja: GODINA[pol],
        pol,
        klub_id: klubId[t.klub],
        drzavljanstvo: 'Srbija',
        lekarski_do: LEKARSKI[t.prezime_ime] || '2027-03-01',
      }, null);
      rez.takmicara_novih++;
    }
  }
  return rez;
}

function poruka(r) {
  return `Primer podaci: klubova ${r.klubovi} (novih ${r.klubovi_novih}), takmičara ${r.takmicara} (novih ${r.takmicara_novih}), kategorija ${r.kategorija}, program ${r.program}, sprave ${r.sprave}`;
}

function pokreni() {
  const json = JSON.parse(fs.readFileSync(JSON_PUTANJA, 'utf8'));
  let baza;
  try {
    baza = otvori(putanjaBaze());
    baza.migriraj();
    console.log(poruka(uvezi(baza, json)));
  } catch (e) {
    if (/locked|busy/i.test(String(e && e.message))) {
      console.error('Zatvorite Gimnastiku pa pokušajte ponovo.');
      process.exitCode = 1;
      return;
    }
    throw e;
  } finally {
    if (baza) baza.zatvori();
  }
}

module.exports = { uvezi };
if (require.main === module) pokreni();
