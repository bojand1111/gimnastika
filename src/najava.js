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
