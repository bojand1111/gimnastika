import { useEffect, useRef, useState } from 'react';
import { parRang } from '../rangStanje.js';
import { najavi, obavesti } from '../../okvir/Poruke.jsx';
import { obradiNemaAktivnog } from '../aktivno.js';

// Parametri iz hasha (kat, prog, tab); izbor i tab normalizuje server.
export const izHasha = () => parRang(location.hash);

// Ucitava podatke ekrana cele strane. `ekran` je prvi deo hasha ('stampa' | 'bilten'), `pozovi(par)` zove IPC.
// Bez prijava server baca "Nema prijava ..." (POPIS 4.1, 5.1): upozorenje i povratak na Rang liste.
export default function useStampaPodaci(ekran, pozovi) {
  const [par, postaviPar] = useState(izHasha);
  const [d, postaviD] = useState(null);
  const brojac = useRef(0);
  const pozoviRef = useRef(pozovi);
  pozoviRef.current = pozovi;

  useEffect(() => {
    const naHash = () => {
      if (!location.hash.startsWith(`#/${ekran}`)) return;
      const n = izHasha();
      postaviPar((p) => (p.kat === n.kat && p.prog === n.prog && p.tab === n.tab ? p : n));
    };
    window.addEventListener('hashchange', naHash);
    return () => window.removeEventListener('hashchange', naHash);
  }, [ekran]);

  useEffect(() => {
    const moj = ++brojac.current;
    (async () => {
      try {
        const podaci = await pozoviRef.current(par);
        if (moj === brojac.current) postaviD(podaci);
      } catch (e) {
        if (moj !== brojac.current) return;
        if (obradiNemaAktivnog(e)) return;
        if (/^Nema prijava/.test(e.message)) {
          najavi(e.message, 'upozorenje');
          location.hash = '#/rang';
        } else {
          obavesti(e.message, 'greska');
        }
      }
    })();
    return () => { brojac.current += 1; };
  }, [par.kat, par.prog, par.tab]);

  return d;
}
