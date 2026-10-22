// Zajednicko za ekrane koji traze aktivno takmicenje (Prijave, Uvoz).
import { najavi } from '../okvir/Poruke.jsx';

export const NEMA_AKTIVNOG = 'Nema aktivnog takmičenja.';

// Ako je greska "nema aktivnog": najava i povratak na Takmicenja; vraca true kad je obradjena.
export function obradiNemaAktivnog(e) {
  if (!String(e && e.message).startsWith(NEMA_AKTIVNOG)) return false;
  najavi('Prvo izaberite aktivno takmičenje.', 'upozorenje');
  location.hash = '#/takmicenja';
  return true;
}
