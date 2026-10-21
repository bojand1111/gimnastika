// Stanje lekarskog pregleda takmicara.
import { danas, datumParsiraj, razlikaDana } from './datum.mjs';

// stanje: nema | istekao | istice (ukljucuje poslednji dan) | vazi
export function lekarski(vaziDo, pragDana, naDan = danas()) {
  const ymd = vaziDo ? datumParsiraj(String(vaziDo)) : null;
  if (!ymd) return { stanje: 'nema', dana: null };
  const dana = razlikaDana(naDan, ymd);
  if (dana < 0) return { stanje: 'istekao', dana };
  if (dana <= pragDana) return { stanje: 'istice', dana };
  return { stanje: 'vazi', dana };
}

// Klasa i tekst bedza; ikona je stvar UI-ja.
export function lekarskiOznaka(st) {
  if (st.stanje === 'istekao') return { klasa: 'status-bad', tekst: 'Istekao' };
  if (st.stanje === 'istice') return { klasa: 'status-warn', tekst: `Ističe za ${st.dana} dana` };
  if (st.stanje === 'nema') return { klasa: 'status-bad', tekst: 'Nema lekarskog' };
  return { klasa: '', tekst: '' };
}
