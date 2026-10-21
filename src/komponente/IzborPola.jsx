import { useRef } from 'react';

// Grupa dugmadi (div.izbor) kao izbor jedne vrednosti: aria-pressed, strelice levo/desno
// biraju susedno dugme, Space/Enter biraju fokusirano. Props: opcije [{vrednost, tekst}],
// vrednost, naPromenu(vrednost), oznaka (aria-label), id.
export default function IzborPola({ opcije, vrednost, naPromenu, oznaka, id }) {
  const grupa = useRef(null);

  function naTaster(ev) {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    const dugmad = [...grupa.current.querySelectorAll('button')];
    const i = dugmad.indexOf(document.activeElement);
    if (i < 0) return;
    ev.preventDefault();
    const j = Math.max(0, Math.min(dugmad.length - 1, i + (ev.key === 'ArrowRight' ? 1 : -1)));
    dugmad[j].focus();
    naPromenu(opcije[j].vrednost);
  }

  return (
    <div className="izbor" role="group" aria-label={oznaka} id={id} ref={grupa} onKeyDown={naTaster}>
      {opcije.map((o) => (
        <button key={o.vrednost} type="button" aria-pressed={vrednost === o.vrednost ? 'true' : 'false'}
          onClick={() => naPromenu(o.vrednost)}>{o.tekst}</button>
      ))}
    </div>
  );
}
