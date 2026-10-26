import { useEffect, useRef, useState } from 'react';
import gim from '../../gim.js';
import { obavesti } from '../../okvir/Poruke.jsx';
import Ikona from '../../komponente/Ikona.jsx';

// Traka alata ekrana cele strane (POPIS 4.2): Nazad, naslov, napomena, Sacuvaj PDF i Stampaj.
// Ne stampa se (stampa.css @media print). Stampaj i Ctrl+P (app:stampa) zovu isti IPC.
// spremno: podaci su stigli; pre toga Stampaj, PDF i Ctrl+P ne rade (inace bi isao prazan list).
export function useStampanje({ polozeno, ime, nazad, spremno }) {
  const [zauzeto, postaviZauzeto] = useState(false);
  const radi = useRef(false);

  const obavi = async (posao) => {
    if (radi.current || !spremno) return;
    radi.current = true;
    postaviZauzeto(true);
    try {
      await posao();
    } catch (e) {
      obavesti(e.message, 'greska');
    } finally {
      radi.current = false;
      postaviZauzeto(false);
    }
  };

  // Otkazan dijalog stampe nije greska: gim.stampa.stampaj vraca {ok: false, otkazano: true}, bez poruke.
  const stampaj = () => obavi(() => gim.stampa.stampaj({ polozeno }));
  const sacuvajPdf = () => obavi(async () => {
    const r = await gim.stampa.pdf({ polozeno, ime });
    if (r && r.putanja) obavesti(`PDF je sačuvan: ${r.putanja}`);
  });

  const stampajRef = useRef(stampaj);
  stampajRef.current = stampaj;
  const nazadRef = useRef(nazad);
  nazadRef.current = nazad;

  useEffect(() => {
    const naStampu = () => stampajRef.current();
    const naOtkazi = () => { location.hash = nazadRef.current; };
    document.addEventListener('app:stampa', naStampu);
    document.addEventListener('app:otkazi', naOtkazi);
    return () => {
      document.removeEventListener('app:stampa', naStampu);
      document.removeEventListener('app:otkazi', naOtkazi);
    };
  }, []);

  return { zauzeto, stampaj, sacuvajPdf };
}

export default function StampaAlat({ naslov, polozeno, nazad, zauzeto, naStampaj, naPdf }) {
  return (
    <div className="stampa-alat">
      <a href={nazad} className="dugme"><Ikona ime="strelica-levo" velicina={16} /><span>Nazad</span><kbd>Esc</kbd></a>
      <span className="naslov">{naslov}</span>
      <span className="sivo mali">A4 {polozeno ? 'položeno' : 'uspravno'} · u dijalogu za štampu isključite zaglavlja i podnožja browsera</span>
      <button type="button" className="dugme" onClick={naPdf} aria-disabled={zauzeto || undefined}>Sačuvaj PDF</button>
      <button type="button" className="dugme dugme-glavno" onClick={naStampaj} aria-disabled={zauzeto || undefined} autoFocus>
        <Ikona ime="stampac" velicina={16} /><span>Štampaj</span><kbd>Ctrl+P</kbd>
      </button>
    </div>
  );
}
