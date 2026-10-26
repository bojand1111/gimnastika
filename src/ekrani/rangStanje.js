// Cista logika ekrana Rang liste i Rezultati takmicara (POPIS 2.2, 3.2).

// Hash ekrana; prazne vrednosti (null, undefined, '') se ispustaju, 0 ostaje (kat=0 je "bez kategorije").
export function hashEkrana(ekran, parametri) {
  const upit = new URLSearchParams();
  for (const [k, v] of Object.entries(parametri)) {
    if (v !== null && v !== undefined && v !== '') upit.set(k, String(v));
  }
  const tekst = upit.toString();
  return `#/${ekran}${tekst ? `?${tekst}` : ''}`;
}

export const hashRang = (pol, kat, prog, tab) => hashEkrana('rang', { pol, kat, prog, tab });

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
