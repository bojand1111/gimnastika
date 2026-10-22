// Red poruka koje se prikazuju tek posle promene ekrana (npr. posle skretanja sa liste takmicenja).
let red = [];

export function dodaj(tekst, vrsta = 'ok') {
  red.push({ tekst, vrsta });
}

// Vraca sve najavljene poruke redom i prazni red.
export function pokupi() {
  const r = red;
  red = [];
  return r;
}

// Trajanje obavestenja u ms: greska i najavljene poruke (duge liste) 6000, ostalo 2500.
export function trajanje(vrsta, najavljeno = false) {
  return vrsta === 'greska' || najavljeno ? 6000 : 2500;
}
