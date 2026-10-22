// Pripremljeni fajlovi koje ekran Prijave predaje ekranu Uvoz (obican modulni podatak).
// Svaka izmena pravi novi niz, a objekti fajlova ostaju isti (React ih prepoznaje po identitetu).
let stanje = null;

export function postavi(novo) { stanje = novo; }
export function uzmi() { return stanje; }
export function ocisti() { stanje = null; }
export function dodaj(fajlovi) { stanje = [...(stanje || []), ...fajlovi]; }
export function ukloni(i) {
  if (stanje) stanje = stanje.filter((_, k) => k !== i);
}
