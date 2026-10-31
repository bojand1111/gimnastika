// Spisak modula i radnji koje renderer vidi kao window.gim. Preload gradi objekat odavde.
const MODULI = {
  sistem: ['verzija'],
  pol: ['daj', 'postavi'],
  klubovi: ['svi', 'nadji', 'sacuvaj', 'obrisi'],
  takmicari: ['svi', 'nadji', 'sacuvaj', 'obrisi', 'sledeciIdBroj'],
  sifarnici: ['vrste', 'lista', 'dodaj', 'izmeni', 'obrisi', 'redosled'],
  podesavanja: ['sva', 'sacuvajOpsta', 'izaberiGrb', 'aktivno'],
  takmicenja: ['sva', 'nadji', 'prazno', 'sacuvaj', 'izaberiGrb', 'sacuvajGrb', 'ukloniGrb', 'obrisi', 'otvori', 'stanje'],
  prijave: ['lista', 'podaci', 'dodaj', 'izmeni', 'sprava', 'ucesce', 'obrisi', 'potvrda', 'startni', 'noviTakmicar', 'stanje'],
  rotacije: ['podaci', 'dodaj', 'izmeni', 'obrisi', 'premesti', 'vrati', 'pomeraj', 'zavrsi'],
  unos: ['podaci', 'nacrt', 'potvrdi', 'odustao', 'vrati', 'zapisnici'],
  rang: ['podaci', 'rezultati', 'stampa', 'bilten', 'bilteni'],
  stampa: ['stampaj', 'pdf'],
  kopija: ['podaci', 'napravi', 'vrati', 'izaberiFajl', 'izaberiFasciklu', 'podrazumevanaFascikla', 'prikazi'],
  sinhro: ['stanje', 'posalji', 'ping'],
  pocetna: ['podaci'],
  takmicenje: ['podaci'],
  uvoz: ['izaberiFajlove', 'pripremi', 'upisi'],
  azuriranje: ['stanje', 'proveri', 'preuzmi', 'instaliraj'],
};

module.exports = { MODULI };
