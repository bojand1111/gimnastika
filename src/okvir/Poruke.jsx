import { useEffect, useState } from 'react';

// Kratko obavestenje u uglu (kao App.obavesti): 2500 ms, greska 6000 ms.
let nextId = 0;
const slusaoci = new Set();

export function obavesti(tekst, vrsta = 'ok') {
  const stavka = { id: ++nextId, tekst, vrsta };
  slusaoci.forEach((s) => s({ dodaj: stavka }));
  setTimeout(() => slusaoci.forEach((s) => s({ ukloni: stavka.id })), vrsta === 'greska' ? 6000 : 2500);
}

export default function Poruke() {
  const [stavke, postaviStavke] = useState([]);
  useEffect(() => {
    const s = (d) => postaviStavke((tr) => (d.dodaj ? [...tr, d.dodaj] : tr.filter((x) => x.id !== d.ukloni)));
    slusaoci.add(s);
    return () => slusaoci.delete(s);
  }, []);
  if (!stavke.length) return null;
  return (
    <div id="obavestenja" style={{ position: 'fixed', right: 24, top: 68, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
      {stavke.map((s) => (
        <div key={s.id} className={`poruka poruka-${s.vrsta}`} style={{ boxShadow: '0 8px 24px rgba(28,27,31,0.18)' }}>{s.tekst}</div>
      ))}
    </div>
  );
}
