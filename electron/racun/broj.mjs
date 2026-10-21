// Ocene su celi brojevi u hiljaditim delovima: 13,050 je 13050. Nikad float.

export const MAKS = 20000;

// Unos korisnika ("8,3", "8.3", "8", "13,050"): najvise tri decimale, opseg 0 do 20.
export function izUnosa(tekst) {
  const t = String(tekst).trim().replace(/,/g, '.');
  const m = /^(\d{1,2})(?:\.(\d{0,3}))?$/.exec(t);
  if (!m) return null;
  const v = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'));
  return v > MAKS ? null : v;
}

// Ceo broj ostaje kakav jeste; tekst iz PHP kopije ("8.300", "8.3") ide u hiljadite.
export function izBaze(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const t = String(v);
  const neg = t.startsWith('-');
  const [c, d = ''] = t.replace(/^-+/, '').split('.', 2);
  const n = (parseInt(c, 10) || 0) * 1000 + (parseInt(d.slice(0, 3).padEnd(3, '0'), 10) || 0);
  return neg ? -n : n;
}

// Prikaz sa decimalnim zarezom: 13050 => "13,050". Manje decimala se odsecaju.
export function prikaz(v, decimala = 3) {
  if (v === null || v === undefined) return '';
  const a = Math.abs(v);
  const znak = v < 0 ? '-' : '';
  const dec = String(a % 1000).padStart(3, '0').slice(0, decimala);
  return znak + Math.floor(a / 1000) + (decimala > 0 ? ',' + dec : '');
}

// D ocena u biltenu: jedna decimala ako je "okrugla" (4,2), inace sve tri.
export function prikazD(v) {
  if (v === null || v === undefined) return '';
  return v % 100 === 0 ? prikaz(v, 1) : prikaz(v, 3);
}
