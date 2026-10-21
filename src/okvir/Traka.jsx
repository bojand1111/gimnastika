import { useEffect, useState } from 'react';
import gim from '../gim.js';
import { url } from '../ruter.js';
import { datumPrikaz } from '../../electron/racun/datum.mjs';
import Azuriranje from './Azuriranje.jsx';
import { obavesti } from './Poruke.jsx';

// Gornja traka: naslov ekrana i aktivno takmicenje (cita se pri ucitavanju i na dogadjaj app:aktivno).
export default function Traka({ naslov }) {
  const [aktivno, postaviAktivno] = useState(null);
  useEffect(() => {
    // U obicnom browseru (bez window.gim) nema aktivnog takmicenja.
    if (!window.gim?.podesavanja) return undefined;
    let ziv = true;
    const citaj = () => gim.podesavanja.aktivno()
      .then((t) => { if (ziv) postaviAktivno(t); })
      .catch((err) => obavesti(err.message, 'greska'));
    citaj();
    document.addEventListener('app:aktivno', citaj);
    return () => { ziv = false; document.removeEventListener('app:aktivno', citaj); };
  }, []);
  return (
    <header className="traka">
      <h1>{naslov}</h1>
      <div className="traka-desno">
        <Azuriranje />
        <div className="traka-aktivno">
          {aktivno ? (
            <>
              <span className="mali">Aktivno takmičenje</span>
              <b>{aktivno.naziv}</b>
              <span className="traka-datum broj">{datumPrikaz(aktivno.datum)}</span>
            </>
          ) : (
            <span className="mali">Nema aktivnog takmičenja</span>
          )}
          <a href={url('takmicenja')} className="dugme dugme-malo">Izaberi</a>
        </div>
      </div>
    </header>
  );
}
