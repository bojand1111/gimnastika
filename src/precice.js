// Globalne precice: vraca ime radnje ili null. F2/F4 rade i u polju (ekran Unos ocena, POPIS 7); Alt+N/M/Z takodje.
export function radnja(ev) {
  if (ev.ctrlKey && !ev.altKey) {
    const k = ev.key.toLowerCase();
    if (k === 'p') return 'stampa';
    if (k === 's') return 'kopija';
    return null;
  }
  if (ev.altKey && ev.key.toLowerCase() === 'n') return 'novi';
  // Alt+M / Alt+Z biraju deo aplikacije; AltGr (Ctrl+Alt) ostaje za unos znakova
  if (ev.altKey && !ev.ctrlKey && ev.key.toLowerCase() === 'm') return 'pol-m';
  if (ev.altKey && !ev.ctrlKey && ev.key.toLowerCase() === 'z') return 'pol-z';
  if (ev.key === 'Escape') return 'otkazi';
  if (ev.key === 'F2') return 'unos';
  if (ev.key === 'F4') return 'rang';
  return null;
}
