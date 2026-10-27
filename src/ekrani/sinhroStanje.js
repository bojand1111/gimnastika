// Tekst stanja "Rezultati uzivo" na Pregledu (SPEC8 4). Cista funkcija, bez React-a.
const dvocifreno = (n) => String(n).padStart(2, '0');

// 'GGGG-MM-DD HH:MM:SS' (UTC, kao Baza.sad()) u lokalno 'dd.mm.gggg. HH:MM'.
export function vremeLokalno(utcTekst) {
  const d = new Date(`${String(utcTekst).replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return String(utcTekst);
  return `${dvocifreno(d.getDate())}.${dvocifreno(d.getMonth() + 1)}.${d.getFullYear()}. ${dvocifreno(d.getHours())}:${dvocifreno(d.getMinutes())}`;
}

export function tekstStanja(stanje) {
  if (!stanje || !stanje.ukljuceno) return 'isključeno';
  if (stanje.uToku) return 'slanje u toku';
  if (stanje.greska) return `greška: ${stanje.greska}`;
  if (stanje.cekaSlanje) return 'čeka slanje';
  if (stanje.poslednje) return `poslato ${vremeLokalno(stanje.poslednje)}`;
  return 'čeka slanje';
}
