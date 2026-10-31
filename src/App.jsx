import { useEffect, useRef, useState } from 'react';
import gim from './gim.js';
import { razlozi } from './ruter.js';
import { radnja } from './precice.js';
import { napraviPromenu, pripremiPromenu, uskladiPol } from './promenaDela.js';
import Meni, { naslovEkrana } from './okvir/Meni.jsx';
import Traka from './okvir/Traka.jsx';
import Poruke, { obavesti } from './okvir/Poruke.jsx';
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
import Stampa from './ekrani/Stampa.jsx';
import Bilten from './ekrani/Bilten.jsx';
import Pocetna from './ekrani/Pocetna.jsx';
import Takmicenje from './ekrani/Takmicenje.jsx';
import Kopija from './ekrani/Kopija.jsx';

const EKRANI = { pocetna: Pocetna, takmicenje: Takmicenje, sistem: Sistem, klubovi: Klubovi, takmicari: Takmicari, podesavanja: Podesavanja, takmicenja: Takmicenja, prijave: Prijave, rotacije: Rotacije, unos: Unos, uvoz: Uvoz, rang: Rang, rezultati: Rezultati, stampa: Stampa, bilten: Bilten, kopija: Kopija,
  'takmicenja/novo': TakmicenjeForma, 'takmicenja/izmeni': TakmicenjeForma };
// Ekrani cele strane (POPIS 9.1): bez menija i trake, body.stampa dok su otvoreni.
const CELA_STRANA = new Set(['stampa', 'bilten']);
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
    // Rang liste hvataju app:stampa i otvaraju pregled za stampu, ekrani cele strane stampaju kroz IPC; ostali stampaju sami
    const { ekran } = razlozi(location.hash);
    if (ekran === 'rang' || CELA_STRANA.has(ekran)) document.dispatchEvent(new CustomEvent('app:stampa'));
    else window.print();
  }
  else if (r === 'kopija') { ev.preventDefault(); document.dispatchEvent(new CustomEvent('app:kopija')); }
}

export default function App() {
  const [hash, postaviHash] = useState(location.hash);
  const [verzija, postaviVerziju] = useState('');
  // Izabrani deo aplikacije: 'M' (MSG) ili 'Z' (ŽSG); null dok se ne procita.
  const [pol, postaviPol] = useState(null);
  const polRef = useRef(null); // trenutni deo; menja se samo iz primeniPol, nikad u renderu
  const primeniPol = (p) => { polRef.current = p; postaviPol(p); };

  // Promena dela: ekrani prvo snime nacrte (app:pre-pol), pa upis u glavnom procesu; drugi pritisak za to vreme se ignorise.
  const [promeni] = useState(() => napraviPromenu({
    trenutni: () => polRef.current,
    pripremi: () => pripremiPromenu(),
    postavi: (novi) => gim.pol.postavi(novi),
  }));

  // Posle uspeha: Pocetna tog dela i obavestenje ekranima (app:pol, app:aktivno); pri gresci ostaje stari deo.
  async function promeniPol(novi) {
    try {
      const stvarni = await promeni(novi);
      if (stvarni === null) return;
      primeniPol(stvarni);
      location.hash = '#/pocetna';
      document.dispatchEvent(new Event('app:pol'));
      document.dispatchEvent(new Event('app:aktivno'));
    } catch (err) { obavesti(err.message, 'greska'); }
  }

  // Posle vracanja kopije glavni proces je mozda promenio deo: ponovo ga procitaj; Pocetna samo ako se deo promenio.
  useEffect(() => {
    if (!window.gim?.kopija?.naVraceni) return undefined;
    return window.gim.kopija.naVraceni(async () => {
      try {
        const novi = await uskladiPol({ procitaj: () => gim.pol.daj(), trenutni: () => polRef.current, primeni: primeniPol });
        if (novi === null) return;
        location.hash = '#/pocetna';
        document.dispatchEvent(new Event('app:pol'));
        document.dispatchEvent(new Event('app:aktivno'));
      } catch (err) { obavesti(err.message, 'greska'); }
    });
  }, []);

  useEffect(() => {
    // Alt+M i Alt+Z rade i u polju za unos; podrazumevani postupak pregledaca se gasi.
    const naTaster = (ev) => {
      const r = radnja(ev);
      if (r !== 'pol-m' && r !== 'pol-z') return;
      if (document.querySelector('dialog[open]')) return; // otvoren dijalog ne sme da nestane usred unosa
      ev.preventDefault();
      promeniPol(r === 'pol-m' ? 'M' : 'Z');
    };
    document.addEventListener('keydown', naTaster);
    return () => document.removeEventListener('keydown', naTaster);
  }, []);

  useEffect(() => {
    // U obicnom browseru (bez window.gim) ostaje MSG.
    if (!window.gim?.pol) { primeniPol('M'); return; }
    gim.pol.daj().then(primeniPol).catch((err) => { primeniPol('M'); obavesti(err.message, 'greska'); });
  }, []);

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
  const celaStrana = CELA_STRANA.has(ekran);
  const naslov = celaStrana ? (ekran === 'bilten' ? 'Bilten' : 'Štampa') : naslovEkrana(ekran);
  useEffect(() => { document.title = `${naslov} · Gimnastika`; }, [naslov]);

  useEffect(() => {
    if (!celaStrana) return undefined;
    document.body.classList.add('stampa');
    return () => document.body.classList.remove('stampa');
  }, [celaStrana]);

  const Ekran = EKRANI[ekran];
  if (celaStrana) {
    return (
      <>
        {pol !== null && <Ekran key={pol} />}
        <Poruke />
      </>
    );
  }
  return (
    <div className="app">
      <Meni ekran={ekran} verzija={verzija} pol={pol} naPromenuPola={promeniPol} />
      <div className="glavno">
        <Traka naslov={naslov} />
        <main className={FIKSNO.has(ekran) ? 'sadrzaj sadrzaj-fiksno' : 'sadrzaj'}>
          {pol !== null && (Ekran ? <Ekran key={pol} /> : <Prazno key={pol} ime={ekran} />)}
        </main>
      </div>
      <Poruke />
    </div>
  );
}
