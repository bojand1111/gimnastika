// Globalne precice: vraca ime radnje ili null. F2/F4 ne rade dok je fokus u polju.
function uPolju(el) {
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || Boolean(el.isContentEditable);
}

export function radnja(ev) {
  if (ev.ctrlKey && !ev.altKey) {
    const k = ev.key.toLowerCase();
    if (k === 'p') return 'stampa';
    if (k === 's') return 'kopija';
    return null;
  }
  if (ev.altKey && ev.key.toLowerCase() === 'n') return 'novi';
  if (ev.key === 'Escape') return 'otkazi';
  if (uPolju(ev.target)) return null;
  if (ev.key === 'F2') return 'unos';
  if (ev.key === 'F4') return 'rang';
  return null;
}
