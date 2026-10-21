// Spisak modula i radnji koje renderer vidi kao window.gim. Preload gradi objekat odavde.
const MODULI = {
  sistem: ['verzija'],
  klubovi: ['svi', 'nadji', 'sacuvaj', 'obrisi'],
  takmicari: ['svi', 'nadji', 'sacuvaj', 'obrisi', 'sledeciIdBroj'],
  sifarnici: ['vrste', 'lista', 'dodaj', 'izmeni', 'obrisi', 'redosled'],
  podesavanja: ['sva', 'sacuvajOpsta', 'izaberiGrb', 'aktivno'],
  azuriranje: ['stanje', 'proveri', 'preuzmi', 'instaliraj'],
};

module.exports = { MODULI };
