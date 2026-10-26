// Cita INSERT naredbe iz PHP kopije (MariaDB izvoz) i pretvara vrednosti u oblik SQLite sheme. Bez baze i fajlova.
import { izBaze } from './broj.mjs';

// Tabele PHP sheme koje se ne uvoze (SQLite ima svoju tabelu migracije).
export const PRESKOCENE_TABELE = ['migracije'];
// Kljucevi podesavanja koji su putanje PHP instalacije.
export const PRESKOCENI_KLJUCEVI = ['kopije_fascikla', 'grb_levo', 'grb_desno'];
// DECIMAL(6,3) kolone koje postaju celi hiljaditi delovi.
const DECIMALNE = {
  ocene: ['d', 'e', 'odbitak', 'konacna'],
  ocene_e: ['vrednost'],
};

const ESCAPE = { 0: '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a' };

// Dekodira jedan MySQL token: NULL, broj ili string u jednostrukim navodnicima (backslash i dupli navodnik).
export function literal(tekst) {
  const t = String(tekst).trim();
  if (/^null$/i.test(t)) return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") {
    const u = t.slice(1, -1);
    let izlaz = '';
    for (let i = 0; i < u.length; i++) {
      const c = u[i];
      if (c === '\\' && i + 1 < u.length) {
        const n = u[++i];
        if (n === '%' || n === '_') izlaz += '\\' + n; // MySQL ih ostavlja sa kosom crtom
        else izlaz += Object.hasOwn(ESCAPE, n) ? ESCAPE[n] : n;
      } else if (c === "'" && u[i + 1] === "'") {
        izlaz += "'";
        i++;
      } else {
        izlaz += c;
      }
    }
    return izlaz;
  }
  throw new Error(`Nepoznat SQL izraz u vrednosti: ${t.slice(0, 40)}`);
}

function imeIzTokena(t) {
  return t.trim().replace(/^`|`$/g, '');
}

// INSERT INTO `t` (`a`, `b`) VALUES (..), (..) => {tabela, kolone, redovi}; sve drugo => null.
export function razlozi(naredba) {
  const m = /^\s*INSERT\s+INTO\s+(`[^`]+`|\w+)\s*\(([^)]*)\)\s*VALUES\s*/i.exec(naredba);
  if (!m) return null;
  const tabela = imeIzTokena(m[1]);
  const kolone = m[2].split(',').map(imeIzTokena);
  const s = naredba;
  const redovi = [];
  let i = m[0].length;
  const duz = s.length;
  while (i < duz) {
    while (i < duz && /[\s,]/.test(s[i])) i++;
    if (i >= duz) break;
    if (s[i] !== '(') throw new Error(`Ocekivana zagrada u INSERT naredbi za ${tabela}.`);
    i++;
    const red = [];
    let pocetak = i;
    let zatvoren = false;
    while (i < duz) {
      const c = s[i];
      if (c === "'") {
        i++;
        while (i < duz) {
          if (s[i] === '\\') { i += 2; continue; }
          if (s[i] === "'") {
            if (s[i + 1] === "'") { i += 2; continue; }
            break;
          }
          i++;
        }
        if (i >= duz) throw new Error(`Nezavrsen string u INSERT naredbi za ${tabela}.`);
        i++;
      } else if (c === ',' || c === ')') {
        red.push(literal(s.slice(pocetak, i)));
        i++;
        pocetak = i;
        if (c === ')') { zatvoren = true; break; }
      } else {
        i++;
      }
    }
    if (!zatvoren) throw new Error(`Nezavrsen red u INSERT naredbi za ${tabela}.`);
    if (red.length !== kolone.length) throw new Error(`Broj vrednosti ne odgovara kolonama u tabeli ${tabela}.`);
    redovi.push(red);
  }
  return { tabela, kolone, redovi };
}

// Vrednost iz PHP kopije u oblik SQLite kolone.
export function pretvori(tabela, kolona, vrednost) {
  if (tabela === 'takmicenja' && (kolona === 'grb_levo' || kolona === 'grb_desno')) return '';
  if (DECIMALNE[tabela]?.includes(kolona)) {
    if (vrednost === null || vrednost === '') return null;
    return izBaze(String(vrednost)); // i broj bez navodnika je decimalan tekst ("12" => 12000)
  }
  return vrednost;
}

// Red koji se ne uvozi (kljucevi podesavanja koji su putanje).
export function preskociRed(tabela, kolone, red) {
  if (tabela !== 'podesavanja') return false;
  const k = kolone.indexOf('kljuc');
  return k >= 0 && PRESKOCENI_KLJUCEVI.includes(red[k]);
}
