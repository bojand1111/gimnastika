import { useRef } from 'react';

// Grupa dugmadi 1..max (broj E sudija); aria-pressed na izabranom, strelice levo/desno menjaju izbor.
export default function IzborBroja({ id, oznaka, vrednost, naPromenu, od = 1, do: max = 6, disabled = false }) {
  const grupa = useRef(null);
  const brojevi = [];
  for (let n = od; n <= max; n++) brojevi.push(n);

  function tipka(ev) {
    if (disabled || (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight')) return;
    ev.preventDefault();
    const n = Math.min(max, Math.max(od, vrednost + (ev.key === 'ArrowRight' ? 1 : -1)));
    if (n === vrednost) return;
    naPromenu(n);
    const dugme = grupa.current.querySelector(`button[data-n="${n}"]`);
    if (dugme) dugme.focus();
  }

  return (
    <div className="izbor" role="group" aria-label={oznaka} id={id} ref={grupa} onKeyDown={tipka}>
      {brojevi.map((n) => (
        <button key={n} type="button" data-n={n} className="broj izbor-broj" disabled={disabled}
          aria-pressed={vrednost === n ? 'true' : 'false'} onClick={() => naPromenu(n)}>{n}</button>
      ))}
    </div>
  );
}
