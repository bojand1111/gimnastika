// Redovi ekrana Unos ocena iz odgovora IPC-a (oblik reda: vidi zaglavlje ../unosStanje.js).
import { NEMA, preracunaj } from '../unosStanje.js';

export function izPodataka(d) {
  return d.redovi.map((r) => {
    const vrednosti = { d: r.d ?? '', odbitak: r.odbitak ?? '' };
    (r.e_sudije ?? []).forEach((x, i) => { vrednosti[`e${i + 1}`] = x ?? ''; });
    const red = {
      prijava_id: r.prijava_id,
      status: r.radi ? r.status : 'ne_radi',
      ispravlja: false,
      greskaCuvanja: false,
      vrednosti,
      greske: new Set(),
      e: r.e || NEMA,
      konacna: r.konacna || NEMA,
      rb: r.rb,
      startni_broj: r.startni_broj,
      ime: r.ime,
      pol: r.pol,
      opis: r.opis,
      vk: r.vk,
      radi: r.radi,
    };
    // Nacrt se racuna iznova kao u PHP-u (POPIS 6, pocetni fokus).
    return red.status === 'nacrt' ? { ...red, ...preracunaj(red, d.brojSudija, d.pravilo, d.zaokruzivanje) } : red;
  });
}

// Kolone mreze (POPIS 5): #, St. br., Takmicar, D, E1..EN, E, Odb., Konacna, Status.
export const kolone = (brojSudija) => `36px 44px minmax(0,1fr) 64px ${'60px '.repeat(brojSudija)}66px 60px 104px 146px`;

// "vreme" u bazi je UTC (YYYY-MM-DD HH:MM:SS); prikaz je HH:mm lokalnog vremena racunara.
export function vremeIzmene(vreme) {
  const t = new Date(`${String(vreme).replace(' ', 'T')}Z`);
  if (Number.isNaN(t.getTime())) return '';
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
