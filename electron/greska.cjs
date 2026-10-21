// Greska sa porukom namenjenom korisniku (ne upisuje se u dnevnik).
class GreskaKorisnika extends Error {
  constructor(poruka) {
    super(poruka);
    this.name = 'GreskaKorisnika';
  }
}

module.exports = { GreskaKorisnika };
