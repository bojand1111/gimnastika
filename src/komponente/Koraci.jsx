import { koraci } from '../koraciStanje.js';
import Ikona from './Ikona.jsx';

// Traka koraka pripreme (POPIS 5). tekuci: podaci|prijave|rotacije|pregled.
export default function Koraci({ stanje, tekuci, takmId }) {
  return (
    <nav className="koraci" aria-label="Koraci pripreme takmičenja">
      {koraci(stanje, tekuci, takmId).map((k, i) => {
        const klase = ['korak', k.tekuci && 'tekuci', k.stanje, k.link === null && !k.tekuci && 'iskljucen']
          .filter(Boolean).join(' ');
        const sadrzaj = (
          <>
            <span className="korak-broj broj">
              {k.stanje === 'ok' ? <Ikona ime="kvacica" velicina={14} />
                : k.kljuc === 'pregled' ? <Ikona ime="strelica-desno" velicina={14} /> : i + 1}
            </span>
            <span className="korak-tekst"><b>{k.naslov}</b><span className="mali">{k.opis}</span></span>
          </>
        );
        const aria = k.tekuci ? { 'aria-current': 'step' } : {};
        return k.link !== null
          ? <a key={k.kljuc} href={k.link} className={klase} {...aria}>{sadrzaj}</a>
          : <span key={k.kljuc} className={klase} {...aria}>{sadrzaj}</span>;
      })}
    </nav>
  );
}
