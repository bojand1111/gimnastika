// Globalne precice: vraca ime radnje ili null. F2/F4 rade i u polju (ekran Unos ocena, POPIS 7).
export function radnja(ev) {
  if (ev.ctrlKey && !ev.altKey) {
    const k = ev.key.toLowerCase();
    if (k === 'p') return 'stampa';
    if (k === 's') return 'kopija';
    return null;
  }
  if (ev.altKey && ev.key.toLowerCase() === 'n') return 'novi';
  if (ev.key === 'Escape') return 'otkazi';
  if (ev.key === 'F2') return 'unos';
  if (ev.key === 'F4') return 'rang';
  return null;
}
