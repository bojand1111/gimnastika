// Datumi kao tekst gggg-mm-dd; racun preko Date.UTC da letnje vreme ne utice.

function ispravan(g, m, d) {
  if (g < 1 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(g, m, 0)).getUTCDate();
}

function slozi(g, m, d) {
  return ispravan(g, m, d) ? `${String(g).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : false;
}

// Prazno: null. Neispravno: false. Inace gggg-mm-dd.
export function datumParsiraj(unos) {
  const t = String(unos ?? '').trim();
  if (t === '') return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return slozi(Number(m[1]), Number(m[2]), Number(m[3])) ? t : false;
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(t) || /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(t);
  if (m) return slozi(Number(m[3]), Number(m[2]), Number(m[1]));
  return false;
}

// 2026-10-17 => "17.10.2026."; prazno ili 0000-... => "".
export function datumPrikaz(ymd, tacka = true) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  if (!m || m[1] === '0000') return '';
  return `${m[3]}.${m[2]}.${m[1]}` + (tacka ? '.' : '');
}

// Lokalni kalendarski datum, ne UTC.
export function danas() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function utc(ymd) {
  const [g, m, d] = ymd.split('-').map(Number);
  return Date.UTC(g, m - 1, d);
}

// Razlika kalendarskih dana (do minus od).
export function razlikaDana(odYmd, doYmd) {
  return Math.round((utc(doYmd) - utc(odYmd)) / 86400000);
}

const DANI = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];

// gggg-mm-dd => ime dana; neispravan datum => ''.
export function danUNedelji(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? ''));
  if (!m || !ispravan(Number(m[1]), Number(m[2]), Number(m[3]))) return '';
  return DANI[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
}
