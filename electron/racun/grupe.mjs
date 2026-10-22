// Raspored grupa po rotaciji. Ciste funkcije, bez baze.

// Pozicija sprave (1..n) na kojoj je grupa u rotaciji R.
export function pozicijaURotaciji(pocetna, rotacija, brojSprava) {
  if (brojSprava < 1) return 1;
  return ((pocetna - 1 + rotacija - 1) % brojSprava) + 1;
}

// Redosled clanova u rotaciji R. Ne menja ulaz.
// Rucni redosled (niz id-jeva prijava) ima prednost; clanovi kojih u njemu nema idu na kraj.
// Inace, uz pomeranje, osnovni redosled se pomera za R-1 mesta (prvi ide na kraj).
export function redosledURotaciji(clanovi, rotacija, pomeraj, rucni = null) {
  if (rucni && rucni.length > 0) {
    const mesto = new Map();
    rucni.forEach((id, i) => mesto.set(Number(id), i));
    const poRucnom = [];
    const ostali = [];
    for (const c of clanovi) {
      const m = mesto.get(Number(c.prijava_id));
      if (m !== undefined) poRucnom[m] = c;
      else ostali.push(c);
    }
    // praznine (id iz rucnog koga nema medju clanovima) se preskacu
    return [...poRucnom.filter((c) => c !== undefined), ...ostali];
  }
  const n = clanovi.length;
  if (!pomeraj || n < 2) return [...clanovi];
  const k = (rotacija - 1) % n;
  return [...clanovi.slice(k), ...clanovi.slice(0, k)];
}

// Grupa koja je u rotaciji R na spravi sa datom pozicijom, sa clanovima u redosledu te rotacije.
// Vraca kopiju grupe (ulaz ostaje netaknut) ili null.
export function grupaNaSpravi(grupe, pozicijaSprave, rotacija, brojSprava, pomeraj) {
  for (const g of grupe) {
    if (pozicijaURotaciji(Number(g.pocetna_pozicija), rotacija, brojSprava) === pozicijaSprave) {
      return { ...g, clanovi: redosledURotaciji(g.clanovi, rotacija, pomeraj, g.rucni?.[rotacija] ?? null) };
    }
  }
  return null;
}
