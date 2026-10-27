// Cista logika Pocetne i Pregleda (POPIS 1.2, 2.2): tekstovi i oznake bez React-a.
import { datumPrikaz } from '../../electron/racun/datum.mjs';

// stanje: iz stanjePripreme ili null.
export function imaNedovrseno(stanje) {
  return stanje != null && stanje.prijava > 0
    && (stanje.nepotpune > 0 || stanje.nerasporedjeni > 0 || stanje.nepotvrdjeni_klubovi > 0);
}

export function tekstNastavi(stanje) {
  if (stanje.korak === 'spremno') return 'Otvori takmičenje';
  return stanje.korak === 'prijave' ? 'Nastavi pripremu: Prijave' : 'Nastavi pripremu: Rotacije';
}

export function hashNastavi(stanje) {
  if (stanje.korak === 'spremno') return '#/takmicenje';
  return stanje.korak === 'prijave' ? '#/prijave' : '#/rotacije';
}

// Tekst pod plocicom "Unos ocena" na Pregledu.
export function tekstPlocice(napredak, nastavi) {
  if (nastavi) return `Nastavi: ${nastavi.sprava.naziv} · Rotacija ${nastavi.rotacija} · uneto ${nastavi.uneto} od ${nastavi.ukupno}`;
  return napredak && napredak.gotovo ? 'Sve ocene su unete' : 'Prepisivanje ocena sa sudijskih listića';
}

const POL = { M: 'MSG', Z: 'ŽSG' };

// Treca plocica Pregleda: broj (rotacija / ukupno) i opis.
export function tekstRotacije(napredak) {
  if (!napredak) return { broj: '–', tekst: 'grupe još nisu napravljene' };
  return {
    broj: `${napredak.rotacija} / ${napredak.ukupno_rotacija}`,
    tekst: napredak.gotovo ? 'sve rotacije su unete' : `rotacija u toku (${POL[napredak.pol] ?? ''})`,
  };
}

// Oznaka reda u listi lekarskih: l je red iz pocetna.podaci().lekarski.
export function lekarskiOznaka(l) {
  const stanje = l.lek && l.lek.stanje;
  if (stanje === 'nema') return { klasa: 'status-bad', tekst: 'Nema lekarskog', title: '', datum: '' };
  const naDan = datumPrikaz(l.datum);
  if (stanje === 'istekao') {
    return { klasa: 'status-bad', tekst: 'Važio do', title: `Ne važi na dan takmičenja (${naDan})`, datum: datumPrikaz(l.lekarski_do) };
  }
  return { klasa: 'status-warn', tekst: 'Važi do', title: `Važi na dan takmičenja (${naDan}), ali ističe ubrzo posle`, datum: datumPrikaz(l.lekarski_do) };
}
