import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Ikona from '../komponente/Ikona.jsx';
import DijalogPotvrda from '../komponente/DijalogPotvrda.jsx';
import { AzuriranjeKartica } from '../okvir/Azuriranje.jsx';
import { obavesti } from '../okvir/Poruke.jsx';
import { porukaNapravljena, potvrdaTekst } from './kopijaStanje.js';
import Fascikla from './kopija/Fascikla.jsx';
import ListaKopija from './kopija/ListaKopija.jsx';

// Rezervna kopija (POPIS 3): napravi, vrati iz fajla ili iz liste, fascikla, azuriranje.
export default function Kopija() {
  const [d, postaviD] = useState(null);
  const [zauzeto, postaviZauzeto] = useState(false);
  const ziv = useRef(true);
  const brojac = useRef(0);
  const lokalnoVracanje = useRef(false); // vracanje pokrenuto ovde osvezava ekran samo jednom (ne i kroz dogadjaj)
  const radi = useRef(false); // jedan poziv u toku; aria-disabled ne gubi fokus kao disabled
  const dijalog = useRef(null);
  const fokusRef = useRef(null);
  const fokusirano = useRef(false);

  const ucitaj = useCallback(async () => {
    const moj = ++brojac.current;
    try {
      const podaci = await gim.kopija.podaci();
      if (moj === brojac.current && ziv.current) postaviD(podaci);
    } catch (e) {
      if (moj === brojac.current && ziv.current) obavesti(e.message, 'greska');
    }
  }, []);

  useEffect(() => { ziv.current = true; ucitaj(); return () => { ziv.current = false; }; }, [ucitaj]);

  // Autofokus (data-fokus) posle prvog ucitavanja.
  useEffect(() => {
    if (d && !fokusirano.current && fokusRef.current) { fokusRef.current.focus(); fokusirano.current = true; }
  }, [d]);

  // Jedna radnja u toku; greska ide u obavestenje (poruka vracanja vec ima prefiks).
  const uradi = useCallback(async (posao) => {
    if (radi.current) return;
    radi.current = true;
    postaviZauzeto(true);
    try {
      await posao();
    } catch (e) {
      obavesti(e.message, 'greska');
    } finally {
      radi.current = false;
      if (ziv.current) postaviZauzeto(false);
    }
  }, []);

  const posleVracanja = useCallback(() => {
    document.dispatchEvent(new Event('app:aktivno'));
    return ucitaj();
  }, [ucitaj]);

  const napravi = useCallback(() => uradi(async () => {
    const r = await gim.kopija.napravi();
    obavesti(porukaNapravljena(r));
    await ucitaj();
  }), [uradi, ucitaj]);

  const vrati = useCallback((sta, ime) => uradi(async () => {
    if (!(await dijalog.current.potvrdi(potvrdaTekst(ime), { potvrdaTekst: 'Vrati' }))) return;
    lokalnoVracanje.current = true;
    try {
      const r = await gim.kopija.vrati(sta);
      obavesti(r.poruka);
      await posleVracanja();
    } finally { lokalnoVracanje.current = false; }
  }), [uradi, posleVracanja]);

  const vratiIzFajla = useCallback(() => uradi(async () => {
    const putanja = await gim.kopija.izaberiFajl();
    if (!putanja) return;
    if (!(await dijalog.current.potvrdi(potvrdaTekst(), { potvrdaTekst: 'Vrati' }))) return;
    lokalnoVracanje.current = true;
    try {
      const r = await gim.kopija.vrati({ putanja });
      obavesti(r.poruka);
      await posleVracanja();
    } finally { lokalnoVracanje.current = false; }
  }), [uradi, posleVracanja]);

  const promeniFasciklu = useCallback(() => uradi(async () => {
    const r = await gim.kopija.izaberiFasciklu();
    if (!r) return;
    obavesti(r.poruka);
    await ucitaj();
  }), [uradi, ucitaj]);

  const podrazumevana = useCallback(() => uradi(async () => {
    const r = await gim.kopija.podrazumevanaFascikla();
    obavesti(r.poruka);
    await ucitaj();
  }), [uradi, ucitaj]);

  const prikazi = useCallback((ime) => uradi(async () => { await gim.kopija.prikazi(ime); }), [uradi]);

  // Ctrl+S (App salje app:kopija) samo dok je ovaj ekran otvoren i nijedan dijalog nije.
  const napraviRef = useRef(napravi);
  napraviRef.current = napravi;
  useEffect(() => {
    const naKopiju = () => { if (!dijalog.current?.otvoren()) napraviRef.current(); };
    document.addEventListener('app:kopija', naKopiju);
    return () => document.removeEventListener('app:kopija', naKopiju);
  }, []);

  // Vracanje iz drugog izvora (main salje dogadjaj): osvezi traku i ekran.
  useEffect(() => {
    if (!window.gim?.kopija?.naVraceni) return undefined;
    return window.gim.kopija.naVraceni(() => { if (!lokalnoVracanje.current) posleVracanja(); });
  }, [posleVracanja]);

  if (!d) return null;
  const onemoguci = zauzeto || undefined;
  const klasa = (osnova) => `${osnova}${zauzeto ? ' iskljuceno' : ''}`;

  return (
    <>
      <div className="mreza-2">
        <section className="kartica" style={{ padding: 20, gap: 12 }}>
          <h2 className="kartica-naslov" style={{ fontSize: 18 }}>Napravi rezervnu kopiju</h2>
          <p className="sek">Čuva celu bazu, sva takmičenja i sve ocene u jedan fajl. {d.poslednjaTekst}</p>
          <div>
            <button type="button" ref={fokusRef} data-fokus className={klasa('dugme dugme-glavno dugme-veliko')} aria-disabled={onemoguci} onClick={napravi}>
              <Ikona ime="kopija" velicina={16} /><span>Napravi rezervnu kopiju</span><kbd>Ctrl+S</kbd>
            </button>
          </div>
        </section>
        <section className="kartica" style={{ padding: 20, gap: 12 }}>
          <h2 className="kartica-naslov" style={{ fontSize: 18 }}>Vrati iz kopije</h2>
          <p className="sek">Zamenjuje sve trenutne podatke podacima iz kopije. Pre vraćanja se automatski pravi kopija trenutnog stanja.</p>
          <div>
            <button type="button" className={klasa('dugme dugme-opasno dugme-veliko')} aria-disabled={onemoguci} onClick={vratiIzFajla}>
              <Ikona ime="vracanje" velicina={16} /><span>Vrati iz kopije</span>
            </button>
          </div>
          <span className="sivo mali">Fajl može biti i sa drugog računara (npr. sa USB-a). Prihvata se i kopija iz stare PHP verzije.</span>
        </section>
      </div>

      <Fascikla fascikla={d.fascikla} zauzeto={zauzeto} naPromeni={promeniFasciklu} naPodrazumevanu={podrazumevana} />
      <ListaKopija kopije={d.kopije} VRSTE={d.VRSTE} zauzeto={zauzeto} naPrikazi={prikazi} naVrati={(ime) => vrati(ime, ime)} />
      <AzuriranjeKartica />
      <DijalogPotvrda ref={dijalog} />
    </>
  );
}
