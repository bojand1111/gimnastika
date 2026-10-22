// Rezultat pripreme uvoza koji ekran Prijave predaje ekranu Uvoz (obican modulni podatak).
let stanje = null;

export function postavi(novo) { stanje = novo; }
export function uzmi() { return stanje; }
export function ocisti() { stanje = null; }
