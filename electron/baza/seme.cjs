// Pocetni podaci (iz PHP instalacije). Idempotentno: puni samo prazne tabele.
const { Baza } = require('./baza.cjs');

const SPRAVE = [
  ['M', 'Parter', 'PA', 1], ['M', 'Konj sa hvataljkama', 'KH', 2], ['M', 'Karike', 'KA', 3],
  ['M', 'Preskok', 'PR', 4], ['M', 'Razboj', 'RA', 5], ['M', 'Vratilo', 'VR', 6],
  ['Z', 'Preskok', 'PR', 1], ['Z', 'Dvovisinski razboj', 'DR', 2], ['Z', 'Greda', 'GR', 3], ['Z', 'Parter', 'PA', 4],
];

function pocetniPodaci(baza) {
  const rez = { sprave: 0, podesavanja: 0 };
  baza.transakcija(() => {
    if (Number(baza.vrednost('SELECT COUNT(*) FROM sprave')) === 0) {
      const sad = Baza.sad();
      for (const [pol, naziv, skracenica, redosled] of SPRAVE) {
        baza.ubaci('sprave', { pol, naziv, skracenica, ikona: `sprava-${skracenica}`, redosled, kreirano: sad, izmenjeno: sad });
        rez.sprave++;
      }
    }
    if (Number(baza.vrednost('SELECT COUNT(*) FROM podesavanja')) === 0) {
      baza.ubaci('podesavanja', { kljuc: 'lekarski_prag_dana', vrednost: '30' });
      rez.podesavanja++;
    }
  });
  return rez;
}

module.exports = { pocetniPodaci };
