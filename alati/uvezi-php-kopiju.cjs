// Uvozi zip rezervnu kopiju PHP verzije u SQLite bazu Electron aplikacije.
// Pokretanje: GIM_PODACI=<fascikla> node alati/uvezi-php-kopiju.cjs <kopija.zip>
// GIM_PODACI je obavezan da se slucajno ne dira prava baza u %APPDATA%. Pre uvoza se pravi kopija pre_vracanja.
const path = require('node:path');
const { otvori } = require('../electron/baza/baza.cjs');
const { pocetniPodaci } = require('../electron/baza/seme.cjs');
const { putanjaBaze, fasciklaPodataka, fasciklaKopija } = require('../electron/putanje.cjs');
const { napravi: napraviPodesavanja } = require('../electron/modeli/podesavanja.cjs');
const { napravi: napraviKopiju } = require('../electron/modeli/kopija.cjs');
const dnevnik = require('../electron/dnevnik.cjs');
const { verzija } = require('../electron/sistem.cjs');

const TABELE = [
  'podesavanja', 'klubovi', 'takmicari', 'kategorije', 'programi', 'sprave', 'takmicenja', 'prijave',
  'prijava_sprave', 'grupe', 'grupa_clanovi', 'grupa_redosled', 'ocene', 'ocene_e', 'izmene_ocena', 'potvrde_klubova',
];

function main() {
  const zipPutanja = process.argv[2];
  if (!zipPutanja) {
    console.error('Upotreba: GIM_PODACI=<fascikla> node alati/uvezi-php-kopiju.cjs <kopija.zip>');
    return 1;
  }
  if (!process.env.GIM_PODACI) {
    console.error('GIM_PODACI nije postavljen. Postavite probnu fasciklu podataka, da se ne dira prava baza u %APPDATA%.');
    return 1;
  }
  const baza = otvori(putanjaBaze());
  try {
    baza.migriraj();
    pocetniPodaci(baza);
    const podesavanja = napraviPodesavanja(baza, fasciklaPodataka());
    const kopija = napraviKopiju(baza, { fasciklaPodrazumevana: fasciklaKopija(), podesavanja, verzija: verzija(), dnevnik });
    const r = kopija.uveziPhpZip(path.resolve(zipPutanja));
    dnevnik.info(`Uvezena PHP kopija ${r.ime}, stanje pre uvoza: ${r.sigurnosna}`);
    console.log(`Uvoz je gotov: ${r.ime} (PHP verzija ${r.opis.verzija}, ${r.opis.vreme}).`);
    console.log(`Stanje pre uvoza je sacuvano kao ${r.sigurnosna} u ${kopija.fascikla()}.`);
    for (const t of TABELE) {
      console.log(`${t}: ${Number(baza.vrednost(`SELECT COUNT(*) FROM ${t}`))}`);
    }
    return 0;
  } catch (err) {
    console.error(`Uvoz nije uspeo: ${err.message}`);
    return 1;
  } finally {
    baza.zatvori();
  }
}

process.exitCode = main();
