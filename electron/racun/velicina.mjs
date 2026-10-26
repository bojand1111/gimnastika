// Prikaz velicine fajla (port velicina_prikaz iz PHP): decimalni zarez, tacka za hiljade.

function saTackama(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function velicinaPrikaz(bajtova) {
  const b = Math.max(0, Math.trunc(Number(bajtova) || 0));
  if (b >= 1048576) {
    const mb = Math.round((b / 1048576) * 10) / 10;
    const [c, d = '0'] = mb.toFixed(1).split('.');
    return `${saTackama(c)},${d} MB`;
  }
  if (b >= 1024) return `${saTackama(Math.round(b / 1024))} KB`;
  return `${b} B`;
}
