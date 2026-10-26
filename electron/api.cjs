// Spisak modula i radnji koje renderer vidi kao window.gim. Preload gradi objekat odavde.
const MODULI = {
  sistem: ['verzija'],
  klubovi: ['svi', 'nadji', 'sacuvaj', 'obrisi'],
  takmicari: ['svi', 'nadji', 'sacuvaj', 'obrisi', 'sledeciIdBroj'],
  sifarnici: ['vrste', 'lista', 'dodaj', 'izmeni', 'obrisi', 'redosled'],
  podesavanja: ['sva', 'sacuvajOpsta', 'izaberiGrb', 'aktivno'],
  takmicenja: ['sva', 'nadji', 'prazno', 'sacuvaj', 'izaberiGrb', 'sacuvajGrb', 'ukloniGrb', 'obrisi', 'otvori', 'stanje'],
  prijave: ['lista', 'podaci', 'dodaj', 'izmeni', 'sprava', 'ucesce', 'obrisi', 'potvrda', 'startni', 'noviTakmicar', 'stanje'],
  rotacije: ['podaci', 'dodaj', 'izmeni', 'obrisi', 'premesti', 'vrati', 'pomeraj', 'zavrsi'],
  unos: ['podaci', 'nacrt', 'potvrdi', 'odustao', 'vrati'],
  rang: ['podaci', 'rezultati', 'stampa', 'bilten'],
  stampa: ['stampaj', 'pdf'],
  pocetna: ['podaci'],
  takmicenje: ['podaci'],
  uvoz: ['izaberiFajlove', 'pripremi', 'upisi'],
  azuriranje: ['stanje', 'proveri', 'preuzmi', 'instaliraj'],
};

module.exports = { MODULI };
