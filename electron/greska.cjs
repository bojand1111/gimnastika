// Greska sa porukom namenjenom korisniku (ne upisuje se u dnevnik).
// opcije.greske: pojedinacne poruke provere (poruka ih spaja razmakom); opcije.cause kao kod Error.
class GreskaKorisnika extends Error {
  constructor(poruka, opcije) {
    super(poruka, opcije);
    this.name = 'GreskaKorisnika';
    if (opcije && Array.isArray(opcije.greske)) this.greske = [...opcije.greske];
  }
}

// Opsta poruka za neocekivane greske (detalji su u dnevniku).
const OPSTA_GRESKA = 'Greška u programu. Pogledajte dnevnik.log.';

module.exports = { GreskaKorisnika, OPSTA_GRESKA };
