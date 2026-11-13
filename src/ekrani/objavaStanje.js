// Tekstovi objave takmicenja na Pregledu. Cista logika, bez React-a.
import { vremeLokalno } from './sinhroStanje.js';

// s: rezultat objava.stanje (ili null dok se ucitava).
export function tekstObjave(s) {
  if (!s) return '';
  if (s.stanje === 'poslato' && s.poslato) return `Poslato ${vremeLokalno(s.poslato)}`;
  if (s.stanje === 'ceka') return 'Čeka internet';
  return 'Nije objavljeno';
}

// Tekst dijaloga potvrde; dodatna recenica kad takmicenje nije oznaceno kao zavrseno.
export function tekstPotvrdeObjave(zavrseno) {
  const osnova = 'Šalje se: rezultati, imena, klubovi i godine rođenja. Ne šalje se: kontakt roditelja, lekarski, broj licence, trener.';
  return Number(zavrseno) === 1 ? osnova : `${osnova} Takmičenje još nije označeno kao završeno.`;
}
