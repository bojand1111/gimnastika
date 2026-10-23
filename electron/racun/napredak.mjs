// Napredak unosa po rotacijama (port Ocene::napredak, bez baze).
import { pozicijaURotaciji } from './grupe.mjs';

// ocene = {prijava_id: {sprava_id: {status}}}; radiSpravu(prijavaId, spravaId) → boolean.
export function napredak(ocene, grupe, sprave, radiSpravu) {
  const n = Math.max(1, sprave.length);
  let obradjeno = 0;
  let ukupno = 0;
  let prvaNepotpuna = null;
  for (let r = 1; r <= n; r++) {
    for (const g of grupe) {
      const poz = pozicijaURotaciji(Number(g.pocetna_pozicija), r, n);
      const sprava = sprave[poz - 1];
      if (!sprava) continue;
      for (const c of g.clanovi) {
        const pid = Number(c.prijava_id);
        if (!radiSpravu(pid, Number(sprava.id))) continue;
        ukupno++;
        const st = ocene[pid]?.[sprava.id]?.status ?? 'nacrt';
        if (st !== 'nacrt') obradjeno++;
        else if (prvaNepotpuna === null) prvaNepotpuna = r;
      }
    }
  }
  return { rotacija: prvaNepotpuna ?? n, ukupno_rotacija: n, obradjeno, ukupno, gotovo: prvaNepotpuna === null && ukupno > 0 };
}
