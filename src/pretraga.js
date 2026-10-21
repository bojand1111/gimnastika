// Pretraga uzivo: bez velikih slova i kvacica (kao normalizuj u klubovi.js).
export function normalizuj(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd');
}

// Podstring; prazan upit (posle trim) uvek odgovara.
export function odgovara(tekst, upit) {
  const q = normalizuj(String(upit ?? '').trim());
  return q === '' || normalizuj(tekst).includes(q);
}
