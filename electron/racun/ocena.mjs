// Racunanje ocene na spravi. Ciste funkcije nad celim brojevima (hiljaditi delovi).

export const PRAVILO_ODBACI = 'odbaci_krajnje';
export const PRAVILO_PROSEK = 'prosek_svih';
export const PRAVILA = {
  [PRAVILO_ODBACI]: 'Odbaci najvišu i najnižu, prosek ostalih',
  [PRAVILO_PROSEK]: 'Prosek svih E ocena',
};

// Prosek celih brojeva: 'odseci' (podrazumevano) ili 'zaokruzi'; prazna lista daje 0.
export function prosek(vrednosti, zaokruzivanje = 'odseci') {
  const n = vrednosti.length;
  if (n === 0) return 0;
  const zbir = vrednosti.reduce((a, b) => a + b, 0);
  return zaokruzivanje === 'zaokruzi' ? Math.floor(zbir / n + 0.5) : Math.floor(zbir / n);
}

// Konacna E ocena: odbaci_krajnje izbacuje jednu najvisu i jednu najnizu (od 3 sudije naviše).
export function konacnaE(e, pravilo, zaokruzivanje = 'odseci') {
  let vrednosti = [...e];
  if (vrednosti.length === 0) return 0;
  if (pravilo === PRAVILO_ODBACI && vrednosti.length >= 3) {
    vrednosti.sort((a, b) => a - b);
    vrednosti = vrednosti.slice(1, -1);
  }
  return prosek(vrednosti, zaokruzivanje);
}

// Konacna = D + E - odbitak, ne ispod nule.
export function konacna(d, e, odbitak) {
  return Math.max(0, d + e - odbitak);
}

// Indeksi odbacenih E ocena (za precrtavanje): jedna najvisa i jedna najniza, razlicite pozicije.
export function odbaceniIndeksi(e, pravilo) {
  if (pravilo !== PRAVILO_ODBACI || e.length < 3) return [];
  const min = Math.min(...e);
  const max = Math.max(...e);
  const iMin = e.indexOf(min);
  let iMax = e.findIndex((v, i) => v === max && i !== iMin);
  if (iMax === -1) iMax = e.indexOf(max);
  return iMin === iMax ? [iMin] : [iMin, iMax];
}
