// Cista logika ekrana Unos ocena (POPIS 6, 10.3, 10.4, 10.6, 10.11): bez React-a, bez IPC-a, bez DOM-a.
// Red u stanju: { prijava_id, status ('nacrt'|'uneto'|'ispravljeno'|'odustao'|'ne_radi'), ispravlja: boolean,
//   greskaCuvanja: boolean, vrednosti: { d, e1..eN, odbitak } (tekst), greske: Set imena polja,
//   e: string, konacna: string, rb, startni_broj, ime, pol, opis, vk, radi }.
// Red je otvoren za unos kad je status 'nacrt' ili kad se ispravlja; inace su mu polja zakljucana.
import { izUnosa, prikaz } from '../../electron/racun/broj.mjs';
import { konacnaE, konacna } from '../../electron/racun/ocena.mjs';
import { url } from '../ruter.js';

const NEMA = '–';

export const otvoren = (red) => red.status === 'nacrt' || !!red.ispravlja;

// ['d', 'e1', ..., 'eN', 'odbitak']
export function polja(brojSudija) {
  return ['d', ...Array.from({ length: brojSudija }, (_, i) => `e${i + 1}`), 'odbitak'];
}

// Prazno je u redu (null); neispravno nije. Ispravan tekst se normalizuje ("8,3" => "8,300").
export function proveriPolje(tekst) {
  const t = String(tekst ?? '').trim();
  if (t === '') return { ok: true, vrednost: null, prikaz: '' };
  const v = izUnosa(t);
  if (v === null) return { ok: false, vrednost: null, prikaz: t };
  return { ok: true, vrednost: v, prikaz: prikaz(v) };
}

// E i konacna iz teksta polja; '–' kad se ne moze izracunati. Prazan odbitak je 0.
export function preracunaj(red, brojSudija, pravilo, zaokruzivanje) {
  const v = red.vrednosti ?? {};
  const e = polja(brojSudija).slice(1, -1).map((ime) => izUnosa(String(v[ime] ?? '')));
  const sveE = e.every((x) => x !== null);
  const E = sveE ? konacnaE(e, pravilo, zaokruzivanje) : null;
  const d = izUnosa(String(v.d ?? ''));
  const odbitakTekst = String(v.odbitak ?? '').trim();
  const odb = odbitakTekst === '' ? 0 : izUnosa(odbitakTekst);
  const ok = d !== null && E !== null && odb !== null;
  return {
    e: E === null ? NEMA : prikaz(E),
    konacna: ok ? prikaz(konacna(d, E, odb)) : NEMA,
  };
}

// Telo poziva ocena-nacrt / ocena-potvrdi (bez prijava_id i sprava_id).
export function podaciReda(red, brojSudija) {
  const v = red.vrednosti ?? {};
  const t = (ime) => String(v[ime] ?? '').trim();
  return {
    d: t('d'),
    e: polja(brojSudija).slice(1, -1).map(t),
    odbitak: t('odbitak'),
  };
}

// Sledeci red sa statusom 'nacrt' posle i, pa od pocetka; sam red se ne broji.
export function sledeciOtvoren(redovi, i) {
  const n = redovi.length;
  for (let k = 1; k < n; k += 1) {
    const j = (i + k) % n;
    if (redovi[j].status === 'nacrt') return j;
  }
  return null;
}

// Sledece (smer 1) ili prethodno (smer -1) polje u redu; null na kraju.
export function sledecePolje(lista, ime, smer) {
  const i = lista.indexOf(ime);
  if (i === -1) return null;
  return lista[i + smer] ?? null;
}

// Sledeci red u smeru ciji je red otvoren (polje nije zakljucano); ne_radi, odustao i zakljucani se preskacu.
// Zakljucavanje je po redu, pa se ime polja ne koristi.
export function sledeciRedSaPoljem(redovi, i, _ime, smer) {
  for (let j = i + smer; j >= 0 && j < redovi.length; j += smer) {
    if (otvoren(redovi[j])) return j;
  }
  return null;
}

export function prvoPraznoPolje(red, lista) {
  const v = red.vrednosti ?? {};
  return lista.find((ime) => String(v[ime] ?? '').trim() === '') ?? 'd';
}

// Zapamcena prijava samo ako je jos nacrt; inace prvi nacrt; inace null.
export function pocetniFokus(redovi, pamtiPrijava) {
  if (pamtiPrijava !== null && pamtiPrijava !== undefined) {
    const i = redovi.findIndex((r) => Number(r.prijava_id) === Number(pamtiPrijava));
    if (i !== -1 && redovi[i].status === 'nacrt') return i;
  }
  const prvi = redovi.findIndex((r) => r.status === 'nacrt');
  return prvi === -1 ? null : prvi;
}

// Redovi koji ne rade spravu se ne broje.
export function napredakIzRedova(redovi) {
  const rade = redovi.filter((r) => r.status !== 'ne_radi');
  return {
    obradjeno: rade.filter((r) => r.status !== 'nacrt').length,
    ukupno: rade.length,
    odustalo: rade.filter((r) => r.status === 'odustao').length,
  };
}

export const odustaoRec = (pol) => (pol === 'Z' ? 'Odustala' : 'Odustao');

export const tekstOdustalo = (n, pol) => (n > 0 ? ` · ${n} ${pol === 'Z' ? 'odustala' : 'odustao'}` : '');

export const procenat = (obradjeno, ukupno) => (ukupno > 0 ? Math.round((obradjeno * 100) / ukupno) : 0);

// Parametri koji nisu zadati (undefined/null) ne ulaze u hash.
export function hashUnos(pol, spravaId, rot) {
  const p = { pol, sprava: spravaId, rot };
  for (const k of Object.keys(p)) if (p[k] === undefined || p[k] === null) delete p[k];
  return url('unos', p);
}

// Novi red iz odgovora IPC-a (prikaz ocene); ciste oznake ispravke i gresaka.
export function primeniPrikaz(red, p) {
  const vrednosti = { ...red.vrednosti, d: p.d ?? '', odbitak: p.odbitak ?? '' };
  (p.e_sudije ?? []).forEach((x, i) => { vrednosti[`e${i + 1}`] = x ?? ''; });
  return {
    ...red,
    vrednosti,
    e: p.e || NEMA,
    konacna: p.konacna || NEMA,
    status: p.status,
    ispravlja: false,
    greskaCuvanja: false,
    greske: new Set(),
  };
}
