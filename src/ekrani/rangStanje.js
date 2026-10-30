// Cista logika ekrana Rang liste i Rezultati takmicara (POPIS 2.2, 3.2).
import { razlozi } from '../ruter.js';

// Hash ekrana; prazne vrednosti (null, undefined, '') se ispustaju, 0 ostaje (kat=0 je "bez kategorije").
export function hashEkrana(ekran, parametri) {
  const upit = new URLSearchParams();
  for (const [k, v] of Object.entries(parametri)) {
    if (v !== null && v !== undefined && v !== '') upit.set(k, String(v));
  }
  const tekst = upit.toString();
  return `#/${ekran}${tekst ? `?${tekst}` : ''}`;
}

// Hash Rang liste bez pola: ekran uvek prikazuje izabrani deo.
export const hashRang = (kat, prog, tab) => hashEkrana('rang', { kat, prog, tab });

// Parametri Ranga, Stampe i Biltena iz hasha; izbor i tab normalizuje server. Stari pol= se zanemaruje.
export function parRang(hash) {
  const { kat = '', prog = '', tab = '' } = razlozi(hash).parametri;
  return { kat, prog, tab };
}

// Parametri Rezultata takmicara iz hasha (t, tk, kat, prog). Stari pol= se zanemaruje.
export function parRezultati(hash) {
  const { t = '', tk = '', kat = '', prog = '' } = razlozi(hash).parametri;
  return { t, tk, kat, prog };
}

// Mesto: VK oznaka, bez mesta, prva tri (plocica) ili obicno.
export function mestoPodaci(mesto, oznaka) {
  if (oznaka === 'VK') return { vrsta: 'vk', tekst: 'VK' };
  if (mesto === null || mesto === undefined) return { vrsta: 'prazno', tekst: '–' };
  return { vrsta: mesto <= 3 ? 'plocica' : 'obicno', tekst: String(mesto) };
}

// Oznaka sa spravne liste (cifre ili "VK") u podatke za prikaz mesta.
export function mestoIzOznake(oznaka) {
  const oz = oznaka ?? '';
  return mestoPodaci(/^\d+$/.test(oz) ? Number(oz) : null, oz);
}

const SIRINE = { viseboj: [92, 116], ekipno: [100, 124], sva: [80, 96] };
// Sirina kolone sprave: uza kad ima vise od 4 sprave.
export function sirinaKolone(brojSprava, vrsta) {
  const [usko, siroko] = SIRINE[vrsta];
  return brojSprava > 4 ? usko : siroko;
}

export const nazivKolone = (sprava, brojSprava) => (brojSprava > 4 ? sprava.skracenica : sprava.naziv);
export const odustaoRec = (pol) => (pol === 'Z' ? 'Odustala' : 'Odustao');
export const mnozina = (pol) => (pol === 'Z' ? 'takmičarki' : 'takmičara');

// Levi deo podnozja; brojPrijava null = nema rezultata.
export function tekstPodnozja({ tabNaziv, pol, katNaziv, progNaziv, brojPrijava, ekipno, ekipnoBroji }) {
  let t = `${tabNaziv} · ${pol === 'Z' ? 'ŽSG' : 'MSG'} · ${katNaziv} · ${progNaziv}`;
  if (brojPrijava !== null && brojPrijava !== undefined) t += ` · ${brojPrijava} ${mnozina(pol)}`;
  if (ekipno) t += ` · ocene u zagradi se ne broje (broji se ${ekipnoBroji} najbolje po spravi)`;
  return t;
}
