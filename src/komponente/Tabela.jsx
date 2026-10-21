import { useEffect, useRef } from 'react';

// Tabela sa izborom reda. Strelice i Enter rade nad prikazanim redovima (redovi koje
// filter krije se ne renderuju). Props: redovi, izabranId, naIzbor(red), naOtvori(red) (opciono),
// kolone [{naslov, sirina, klasa, celija(red)}], prazno (tekst praznog stanja), id.
export default function Tabela({ redovi, izabranId, naIzbor, naOtvori, kolone, prazno, id }) {
  const telo = useRef(null);

  useEffect(() => {
    const tr = telo.current && telo.current.querySelector('tr.izabran');
    if (tr) tr.scrollIntoView({ block: 'nearest' });
  }, [izabranId]);

  function naKlik(ev) {
    if (ev.target.closest('button, a, input, select')) return;
    const tr = ev.target.closest('tr[data-id]');
    if (!tr) return;
    const red = redovi.find((r) => String(r.id) === tr.dataset.id);
    if (red) { naIzbor(red); naOtvori?.(red); }
  }

  function naTaster(ev) {
    const t = ev.target.tagName;
    if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || ev.target.isContentEditable) return;
    const trenutni = redovi.findIndex((r) => r.id === izabranId);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!redovi.length) return;
      const sledeci = ev.key === 'ArrowDown' ? Math.min(trenutni + 1, redovi.length - 1) : Math.max(trenutni - 1, 0);
      naIzbor(redovi[sledeci]);
    } else if (ev.key === 'Enter' && trenutni >= 0) {
      ev.preventDefault();
      naOtvori?.(redovi[trenutni]);
    }
  }

  return (
    <table className="tabela" id={id} onClick={naKlik} onKeyDown={naTaster}>
      <thead>
        <tr>{kolone.map((k, i) => <th key={i} style={k.sirina ? { width: k.sirina } : undefined}>{k.naslov}</th>)}</tr>
      </thead>
      <tbody ref={telo}>
        {prazno && <tr><td colSpan={kolone.length} className="prazno">{prazno}</td></tr>}
        {redovi.map((r) => (
          <tr key={r.id} data-id={r.id} tabIndex={-1} className={`klik ${r.id === izabranId ? 'izabran' : ''}`}>
            {kolone.map((k, i) => <td key={i} className={k.klasa}>{k.celija(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
