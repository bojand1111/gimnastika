// Pomera id za jedno mesto (smer -1 gore, +1 dole). Vraca novi niz; ako nema pomeranja, isti niz.
export function pomeri(ids, id, smer) {
  const i = ids.indexOf(id);
  const j = i + smer;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const novi = ids.slice();
  [novi[i], novi[j]] = [novi[j], novi[i]];
  return novi;
}
