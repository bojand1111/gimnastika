// Fokus u tabeli unosa (POPIS 6, fokus()): polje reda ili, kad je zakljucano, dugme "Ispravi".
export function fokusiraj(prijavaId, polje) {
  const red = document.querySelector(`#unos .unos-red[data-prijava="${prijavaId}"]`);
  if (!red) return false;
  let el = polje ? red.querySelector(`input[data-polje="${polje}"]`) : null;
  if (!el || el.readOnly) el = red.querySelector('.ispravi');
  if (!el) return false;
  el.focus();
  if (typeof el.select === 'function') el.select();
  el.scrollIntoView({ block: 'nearest' });
  return true;
}
