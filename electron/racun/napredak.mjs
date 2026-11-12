// Napredak unosa po turnusima i rotacijama (port Ocene::napredak, bez baze).
import { pozicijaURotaciji, turnusiGrupa, grupeTurnusa } from './grupe.mjs';

// ocene = {prijava_id: {sprava_id: {status}}}; radiSpravu(prijavaId, spravaId) → boolean.
// Turnusi idu jedan za drugim; rotacija je unutar turnusa prve nepotpune rotacije.
export function napredak(ocene, grupe, sprave, radiSpravu) {
  const n = Math.max(1, sprave.length);
  const turnusi = turnusiGrupa(grupe);
  let obradjeno = 0;
  let ukupno = 0;
  let prva = null;
  for (const tu of turnusi) {
    const uTurnusu = grupeTurnusa(grupe, tu);
    for (let r = 1; r <= n; r++) {
      for (const g of uTurnusu) {
        const poz = pozicijaURotaciji(Number(g.pocetna_pozicija), r, n);
        const sprava = sprave[poz - 1];
        if (!sprava) continue;
        for (const c of g.clanovi) {
          const pid = Number(c.prijava_id);
          if (!radiSpravu(pid, Number(sprava.id))) continue;
          ukupno++;
          const st = ocene[pid]?.[sprava.id]?.status ?? 'nacrt';
          if (st !== 'nacrt') obradjeno++;
          else if (prva === null) prva = { turnus: tu, rotacija: r };
        }
      }
    }
  }
  return {
    rotacija: prva ? prva.rotacija : n,
    ukupno_rotacija: n,
    obradjeno,
    ukupno,
    gotovo: prva === null && ukupno > 0,
    turnus: prva ? prva.turnus : (turnusi.at(-1) ?? 1),
    broj_turnusa: turnusi.length || 1,
  };
}
