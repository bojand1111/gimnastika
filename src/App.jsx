import { useEffect, useState } from 'react';
import gim from './gim.js';
import { razlozi } from './ruter.js';
import { radnja } from './precice.js';
import Meni, { naslovEkrana } from './okvir/Meni.jsx';
import Traka from './okvir/Traka.jsx';
import Poruke from './okvir/Poruke.jsx';
import Sistem from './ekrani/Sistem.jsx';
import Prazno from './ekrani/Prazno.jsx';
import Klubovi from './ekrani/Klubovi.jsx';
import Takmicari from './ekrani/Takmicari.jsx';
import Podesavanja from './ekrani/Podesavanja.jsx';
import Takmicenja from './ekrani/Takmicenja.jsx';
import TakmicenjeForma from './ekrani/TakmicenjeForma.jsx';
import Prijave from './ekrani/Prijave.jsx';
import Uvoz from './ekrani/Uvoz.jsx';
import Rotacije from './ekrani/Rotacije.jsx';
import Unos from './ekrani/Unos.jsx';
import Rang from './ekrani/Rang.jsx';
import Rezultati from './ekrani/Rezultati.jsx';

const EKRANI = { sistem: Sistem, klubovi: Klubovi, takmicari: Takmicari, podesavanja: Podesavanja, takmicenja: Takmicenja, prijave: Prijave, rotacije: Rotacije, unos: Unos, uvoz: Uvoz, rang: Rang, rezultati: Rezultati,
  'takmicenja/novo': TakmicenjeForma, 'takmicenja/izmeni': TakmicenjeForma };
// Ekrani ciju tabelu skroluje kartica, ne cela strana (PHP sadrzajKlasa).
const FIKSNO = new Set(['klubovi', 'takmicari', 'takmicenja', 'prijave', 'rotacije', 'unos', 'rang']);

// Globalne precice: radnja(ev) -> hash ili dogadjaj na documentu.
function izvrsi(ev) {
  const r = radnja(ev);
  if (r === 'unos') { ev.preventDefault(); location.hash = '#/unos'; }
  else if (r === 'rang') { ev.preventDefault(); location.hash = '#/rang'; }
  else if (r === 'novi') { ev.preventDefault(); document.dispatchEvent(new CustomEvent('app:novi')); }
  else if (r === 'otkazi') document.dispatchEvent(new CustomEvent('app:otkazi'));
  else if (r === 'stampa') {
    ev.preventDefault();
    // Rang liste hvata app:stampa i otvara pregled za stampu; ostali ekrani stampaju sami
    if (razlozi(location.hash).ekran === 'rang') document.dispatchEvent(new CustomEvent('app:stampa'));
    else window.print();
  }
  else if (r === 'kopija') { ev.preventDefault(); document.dispatchEvent(new CustomEvent('app:kopija')); }
}

export default function App() {
  const [hash, postaviHash] = useState(location.hash);
  const [verzija, postaviVerziju] = useState('');

  useEffect(() => {
    const naPromeni = () => postaviHash(location.hash);
    window.addEventListener('hashchange', naPromeni);
    document.addEventListener('keydown', izvrsi);
    return () => {
      window.removeEventListener('hashchange', naPromeni);
      document.removeEventListener('keydown', izvrsi);
    };
  }, []);

  useEffect(() => {
    // U obicnom browseru (bez window.gim) pokazi ? umesto da pukne.
    (async () => {
      try { postaviVerziju(await gim.sistem.verzija()); } catch { postaviVerziju('?'); }
    })();
  }, []);

  const { ekran } = razlozi(hash);
  const naslov = naslovEkrana(ekran);
  useEffect(() => { document.title = `${naslov} · Gimnastika`; }, [naslov]);

  const Ekran = EKRANI[ekran];
  return (
    <div className="app">
      <Meni ekran={ekran} verzija={verzija} />
      <div className="glavno">
        <Traka naslov={naslov} />
        <main className={FIKSNO.has(ekran) ? 'sadrzaj sadrzaj-fiksno' : 'sadrzaj'}>
          {Ekran ? <Ekran /> : <Prazno ime={ekran} />}
        </main>
      </div>
      <Poruke />
    </div>
  );
}
