// Cista logika ekrana Takmicari: filteri liste i poruka o lekarskom u kartonu.
import { odgovara } from '../pretraga.js';
import { datumParsiraj, razlikaDana } from '../../electron/racun/datum.mjs';

// Red je vidljiv ako ispunjava sve uslove (I). pol: 'M' | 'Z' | ''; klub i god su tekst.
export function vidljiv(red, { upit, klub, pol, god }) {
  const tekst = `${red.prezime} ${red.ime} ${red.ime} ${red.prezime} ${red.id_broj}`;
  if (!odgovara(tekst, upit)) return false;
  if (klub !== '' && String(red.klub_id ?? 0) !== klub) return false;
  if (pol !== '' && red.pol !== pol) return false;
  if (god !== '' && String(red.godina_rodjenja) !== god) return false;
  return true;
}

// Poruka pored polja lekarskog: prazno nema poruke, 31.02 je greska (jedno pravilo sa serverom).
export function lekarskiPoruka(tekst, prag, danas) {
  const t = String(tekst ?? '').trim();
  if (t === '') return { klasa: '', tekst: '' };
  const ymd = datumParsiraj(t);
  if (!ymd) return { klasa: 'greska', tekst: 'Neispravan datum (dd.mm.gggg)' };
  const dana = razlikaDana(danas, ymd);
  if (dana < 0) return { klasa: 'greska', tekst: 'Lekarski je istekao' };
  if (dana <= Number(prag)) return { klasa: 'upozorenje', tekst: `Ističe za ${dana} dana` };
  return { klasa: '', tekst: '' };
}
