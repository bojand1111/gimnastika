// Greska sa porukom namenjenom korisniku (ne upisuje se u dnevnik).
class GreskaKorisnika extends Error {
  constructor(poruka, opcije) {
    super(poruka, opcije);
    this.name = 'GreskaKorisnika';
  }
}

// Opsta poruka za neocekivane greske (detalji su u dnevniku).
const OPSTA_GRESKA = 'Greška u programu. Pogledajte dnevnik.log.';

module.exports = { GreskaKorisnika, OPSTA_GRESKA };
