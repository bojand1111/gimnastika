// Zapis izmene ocene: snimak reda i kratak opis razlike (port Ocene::snimak i Ocene::opisIzmene).
import { izBaze, prikaz } from './broj.mjs';

// Vrednosti reda za JSON zapis (celi brojevi, hiljaditi delovi).
export function snimak(o) {
  const eSudije = {};
  for (const [i, v] of Object.entries(o.e_sudije ?? {})) eSudije[Number(i)] = v;
  return {
    d: o.d ?? null,
    e: o.e ?? null,
    bonus: o.bonus ?? null,
    odbitak: o.odbitak ?? null,
    konacna: o.konacna ?? null,
    status: o.status ?? null,
    e_sudije: eSudije,
  };
}

const pr = (v) => prikaz(izBaze(v ?? null));
const razlicito = (a, b) => (a ?? null) !== (b ?? null);
// Bonus: stari zapisi i ocene pre migracije 006 nemaju bonus (null), sto je isto sto i 0.
const bezBonusa = (v) => v === null || v === undefined || v === 0;

// "E2 8,100 → 7,900 · konačna 13,050 → 12,950"; prazna vrednost je '' (razmak posle strelice ostaje).
// Odbitak se prikazuje kao "penalizacija" (kljuc u JSON-u ostaje odbitak).
export function opisIzmene(staro, novo) {
  const delovi = [];
  for (const [k, oz] of [['d', 'D'], ['bonus', 'bonus'], ['odbitak', 'penalizacija']]) {
    if (k === 'bonus' && bezBonusa(staro[k]) && bezBonusa(novo[k])) continue;
    if (razlicito(staro[k], novo[k])) delovi.push(`${oz} ${pr(staro[k])} → ${pr(novo[k])}`);
  }
  const se = staro.e_sudije ?? {};
  const ne = novo.e_sudije ?? {};
  const kljucevi = [...new Set([...Object.keys(se), ...Object.keys(ne)])].sort((a, b) => Number(a) - Number(b));
  for (const i of kljucevi) {
    if (razlicito(se[i], ne[i])) delovi.push(`E${i} ${pr(se[i])} → ${pr(ne[i])}`);
  }
  if ((novo.status ?? '') === 'odustao' && (staro.status ?? '') !== 'odustao') delovi.push('označeno odustajanje');
  if (razlicito(staro.konacna, novo.konacna)) delovi.push(`konačna ${pr(staro.konacna)} → ${pr(novo.konacna)}`);
  return delovi.join(' · ');
}
