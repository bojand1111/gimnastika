// Cista logika ekrana Takmicari: filteri liste, poruka o lekarskom u kartonu i tekstovi o prebacivanju u drugi deo.
import { odgovara } from '../pretraga.js';
import { datumParsiraj, razlikaDana } from '../../electron/racun/datum.mjs';

// Red je vidljiv ako ispunjava sve uslove (I); klub i god su tekst. Pola nema: server vraca samo izabrani deo.
export function vidljiv(red, { upit, klub, god }) {
  const tekst = `${red.prezime} ${red.ime} ${red.ime} ${red.prezime} ${red.id_broj}`;
  if (!odgovara(tekst, upit)) return false;
  if (klub !== '' && String(red.klub_id ?? 0) !== klub) return false;
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

// Naziv dela aplikacije za pol takmicara.
export const deoNaziv = (pol) => (pol === 'Z' ? 'ŽSG' : 'MSG');

// Napomena uz izbor pola u kartonu: samo kad se pol stvarno menja, jer takmicar tada prelazi u drugi deo.
export function napomenaPola(sacuvanPol, noviPol) {
  if ((sacuvanPol !== 'M' && sacuvanPol !== 'Z') || (noviPol !== 'M' && noviPol !== 'Z') || sacuvanPol === noviPol) return '';
  return `Čuvanjem se takmičar prebacuje u ${deoNaziv(noviPol)}.`;
}

// Poruka posle uspesne promene pola: takmicar vise nije na listi ovog dela.
export const porukaPrebacen = (ime, pol) => `Takmičar ${ime} je prebačen u ${deoNaziv(pol)}.`;
