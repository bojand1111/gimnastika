import { useEffect, useState } from 'react';
import { dodaj, pokupi, trajanje } from '../najava.js';

// Kratko obavestenje u uglu (kao App.obavesti): 2500 ms, greska i najavljene poruke 6000 ms; klik zatvara.
let nextId = 0;
const slusaoci = new Set();

export function obavesti(tekst, vrsta = 'ok', ms = trajanje(vrsta)) {
  const stavka = { id: ++nextId, tekst, vrsta };
  slusaoci.forEach((s) => s({ dodaj: stavka }));
  setTimeout(() => ukloni(stavka.id), ms);
}

const ukloni = (id) => slusaoci.forEach((s) => s({ ukloni: id }));

// Poruka koja se prikazuje tek kad se ekran promeni (hashchange), npr. posle skretanja sa liste.
export function najavi(tekst, vrsta = 'ok') {
  dodaj(tekst, vrsta);
}

export default function Poruke() {
  const [stavke, postaviStavke] = useState([]);
  useEffect(() => {
    const s = (d) => postaviStavke((tr) => (d.dodaj ? [...tr, d.dodaj] : tr.filter((x) => x.id !== d.ukloni)));
    slusaoci.add(s);
    const naPromeni = () => pokupi().forEach((n) => obavesti(n.tekst, n.vrsta, trajanje(n.vrsta, true)));
    window.addEventListener('hashchange', naPromeni);
    return () => {
      slusaoci.delete(s);
      window.removeEventListener('hashchange', naPromeni);
    };
  }, []);
  if (!stavke.length) return null;
  return (
    <div id="obavestenja" style={{ position: 'fixed', right: 24, top: 68, zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
      {stavke.map((s) => (
        <div key={s.id} className={`poruka poruka-${s.vrsta}`} onClick={() => ukloni(s.id)} style={{ boxShadow: '0 8px 24px rgba(28,27,31,0.18)' }}>{s.tekst}</div>
      ))}
    </div>
  );
}

// Crveni blok sa jednom linijom po gresci (kao poruka-greska u formi).
export function Greske({ greske }) {
  if (!greske || !greske.length) return null;
  return (
    <div className="poruka poruka-greska" role="alert"><div>{greske.map((g, i) => <div key={i}>{g}</div>)}</div></div>
  );
}
