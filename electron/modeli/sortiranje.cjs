// Sortiranje i poredjenje teksta (zamena za croatian_ci iz MySQL-a).
const KOLATOR = new Intl.Collator('hr', { sensitivity: 'base' });

// Stabilno sortira kopiju po navedenim poljima, pa po id.
function poImenu(redovi, ...polja) {
  return [...redovi].sort((a, b) => {
    for (const polje of polja) {
      const r = KOLATOR.compare(String(a[polje] ?? ''), String(b[polje] ?? ''));
      if (r !== 0) return r;
    }
    return a.id - b.id;
  });
}

// Isti tekst bez razlike velikih/malih slova; c, č, ć ostaju razlicita slova.
function istiTekst(a, b) {
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
}

module.exports = { KOLATOR, poImenu, istiTekst };
