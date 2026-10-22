// Spisak modula i radnji koje renderer vidi kao window.gim. Preload gradi objekat odavde.
const MODULI = {
  sistem: ['verzija'],
  klubovi: ['svi', 'nadji', 'sacuvaj', 'obrisi'],
  takmicari: ['svi', 'nadji', 'sacuvaj', 'obrisi', 'sledeciIdBroj'],
  sifarnici: ['vrste', 'lista', 'dodaj', 'izmeni', 'obrisi', 'redosled'],
  podesavanja: ['sva', 'sacuvajOpsta', 'izaberiGrb', 'aktivno'],
  takmicenja: ['sva', 'nadji', 'prazno', 'sacuvaj', 'izaberiGrb', 'sacuvajGrb', 'ukloniGrb', 'obrisi', 'otvori', 'stanje'],
  prijave: ['lista', 'podaci', 'dodaj', 'izmeni', 'sprava', 'ucesce', 'obrisi', 'potvrda', 'startni', 'noviTakmicar', 'stanje'],
  uvoz: ['izaberiFajlove', 'pripremi', 'upisi'],
  azuriranje: ['stanje', 'proveri', 'preuzmi', 'instaliraj'],
};

module.exports = { MODULI };
