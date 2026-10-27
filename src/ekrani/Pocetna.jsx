import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import { datumPrikaz } from '../../electron/racun/datum.mjs';
import Ikona from '../komponente/Ikona.jsx';
import StanjeOznake from '../komponente/StanjeOznake.jsx';
import { najavi, obavesti } from '../okvir/Poruke.jsx';
import { porukaOtvaranja } from './takmicenjaPoruke.js';
import { porukaNapravljena } from './kopijaStanje.js';
import KartaAktivnog from './pocetna/KartaAktivnog.jsx';
import Lekarski from './pocetna/Lekarski.jsx';
import PoslednjaKopija from './pocetna/PoslednjaKopija.jsx';
import Precice from './pocetna/Precice.jsx';

const IDE = { prijave: '#/prijave', rotacije: '#/rotacije', spremno: '#/takmicenje' };

// Pocetna (POPIS 1): jedan IPC poziv daje sve sto pogled treba.
export default function Pocetna() {
  const [d, postaviD] = useState(null);
  const [zauzeto, postaviZauzeto] = useState(false);
  const ziv = useRef(true);
  const brojac = useRef(0); // stariji odgovor ne sme da pregazi noviji
  const fokusRef = useRef(null);
  const fokusirano = useRef(false);
  const otvaranje = useRef(false); // dvostruki klik salje jedan poziv

  const ucitaj = useCallback(async () => {
    const moj = ++brojac.current;
    try {
      const podaci = await gim.pocetna.podaci();
      if (moj === brojac.current && ziv.current) postaviD(podaci);
    } catch (e) {
      if (moj === brojac.current && ziv.current) obavesti(e.message, 'greska');
    }
  }, []);

  useEffect(() => { ziv.current = true; ucitaj(); return () => { ziv.current = false; }; }, [ucitaj]);

  // Podaci vraceni iz kopije (main salje dogadjaj): ponovo ucitaj ekran.
  useEffect(() => {
    if (!window.gim?.kopija?.naVraceni) return undefined;
    return window.gim.kopija.naVraceni(() => { ucitaj(); });
  }, [ucitaj]);

  // Autofokus (data-fokus) posle prvog ucitavanja.
  useEffect(() => {
    if (d && !fokusirano.current && fokusRef.current) { fokusRef.current.focus(); fokusirano.current = true; }
  }, [d]);

  const otvori = useCallback(async (id) => {
    if (otvaranje.current) return;
    otvaranje.current = true;
    try {
      const r = await gim.takmicenja.otvori(id);
      const poruka = porukaOtvaranja(r);
      if (poruka) najavi(poruka, 'upozorenje');
      document.dispatchEvent(new Event('app:aktivno'));
      location.hash = IDE[r.korak];
    } catch (e) {
      obavesti(e.message, 'greska');
    } finally {
      otvaranje.current = false;
    }
  }, []);

  // Rucna kopija (POPIS 3.2); Ctrl+S ovde ne radi, hvata ga samo ekran Rezervna kopija.
  const napraviKopiju = useCallback(async () => {
    postaviZauzeto(true);
    try {
      const r = await gim.kopija.napravi();
      obavesti(porukaNapravljena(r));
      await ucitaj();
    } catch (e) {
      obavesti(e.message, 'greska');
    } finally {
      if (ziv.current) postaviZauzeto(false);
    }
  }, [ucitaj]);

  if (!d) return null;
  const { takm, stanje, ostala } = d;

  return (
    <div className="red">
      <div className="kolona raste">
        <KartaAktivnog takm={takm} stanje={stanje} imaOstala={ostala.length > 0} fokusRef={fokusRef} />
        {ostala.length > 0 && (
          <section className="kartica" style={{ overflow: 'hidden' }}>
            <div className="kartica-zaglavlje">
              <h2 className="kartica-naslov">{takm === null ? 'Takmičenja' : 'Ostala takmičenja'}</h2>
              <a href="#/takmicenja/novo" className="dugme dugme-malo"><Ikona ime="plus" velicina={14} /><span>Novo takmičenje</span></a>
            </div>
            <table className="tabela tabela-zbijena">
              <thead>
                <tr>
                  <th>Naziv i mesto</th>
                  <th style={{ width: 100 }}>Datum</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 290 }}>Priprema</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {ostala.map((t) => (
                  <tr key={t.id} style={{ height: 48 }}>
                    <td>
                      <span className="dva-reda" style={{ lineHeight: '17px' }}>
                        <span className="odseci" style={{ fontWeight: 600 }}>{t.naziv}</span>
                        <span className="mali sivo odseci">{t.mesto}</span>
                      </span>
                    </td>
                    <td><span className="broj">{datumPrikaz(t.datum)}</span></td>
                    <td>{Number(t.zavrseno) === 1 ? <span className="status">Završeno</span> : <span className="status status-info">U pripremi</span>}</td>
                    <td><StanjeOznake stanje={t.stanje} /></td>
                    <td className="desno"><button type="button" className="dugme dugme-malo" onClick={() => otvori(t.id)}>Otvori</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
      <div className="kolona" style={{ width: 340, flexShrink: 0 }}>
        <Lekarski lekarski={d.lekarski} />
        <PoslednjaKopija kopija={d.poslednjaKopija} zauzeto={zauzeto} naNapravi={napraviKopiju} />
        <Precice precice={d.precice} />
      </div>
    </div>
  );
}
