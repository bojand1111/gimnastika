import { useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Ikona from '../komponente/Ikona.jsx';
import Koraci from '../komponente/Koraci.jsx';
import StanjeOznake from '../komponente/StanjeOznake.jsx';
import KluboviStanje from '../komponente/KluboviStanje.jsx';
import { obavesti } from '../okvir/Poruke.jsx';
import { obradiNemaAktivnog } from './aktivno.js';
import { tekstPlocice, tekstRotacije } from './pocetnaStanje.js';
import { tekstStanja } from './sinhroStanje.js';

// Pregled takmicenja (POPIS 2): jedan IPC poziv daje sve sto pogled treba.
export default function Takmicenje() {
  const [d, postaviD] = useState(null);
  const fokusRef = useRef(null);
  const fokusirano = useRef(false);

  useEffect(() => {
    let ziv = true;
    gim.takmicenje.podaci()
      .then((p) => { if (ziv) postaviD(p); })
      .catch((e) => { if (ziv && !obradiNemaAktivnog(e)) obavesti(e.message, 'greska'); });
    return () => { ziv = false; };
  }, []);

  // Autofokus (data-fokus) na plocici "Unos ocena".
  useEffect(() => {
    if (d && !fokusirano.current && fokusRef.current) { fokusRef.current.focus(); fokusirano.current = true; }
  }, [d]);

  if (!d) return null;
  const { takm, brojevi, stanje, napredak, nastavi } = d;
  const rot = tekstRotacije(napredak);
  const eSudija = Number(takm.broj_e_sudija) === 1 ? 'E sudija' : 'E sudije';

  return (
    <>
      <Koraci stanje={stanje} tekuci="pregled" takmId={takm.id} />
      <div className="red">
        <div className="kolona raste">
          <section className="kartica" style={{ padding: '20px 24px', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Aktivno takmičenje</span>
                {Number(takm.zavrseno) === 1 && <span className="status">Završeno</span>}
              </span>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <a href={`#/takmicenja/izmeni?id=${takm.id}`} className="dugme dugme-tekst dugme-malo">Izmeni podatke</a>
                <a href="#/takmicenja" className="dugme dugme-tekst dugme-malo">Sva takmičenja</a>
              </span>
            </div>
            <h2 style={{ fontSize: 32, lineHeight: '40px', fontWeight: 800, letterSpacing: '-0.02em' }}>{takm.naziv}</h2>
            <div className="sek" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 15 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Ikona ime="meni-takmicenja" velicina={16} />
                <span>{d.danUNedelji}, <span className="broj">{d.datumTekst}</span></span>
              </span>
              {takm.mesto && <span>{takm.mesto}</span>}
              <span>{takm.broj_e_sudija} {eSudija}</span>
              {takm.organizator && <span>Organizator: {takm.organizator}</span>}
              {takm.domacin && <span>Domaćin: {takm.domacin}</span>}
            </div>
            <span className="sivo mali">Rezultati uživo: {tekstStanja(d.sinhro)}</span>
            <div className="mreza-3">
              <div className="plocica-broj"><span className="broj">{brojevi.prijava}</span><span>prijavljenih takmičara</span></div>
              <div className="plocica-broj"><span className="broj">{brojevi.klubova}</span><span>klubova</span></div>
              <div className="plocica-broj"><span className="broj">{rot.broj}</span><span>{rot.tekst}</span></div>
            </div>
          </section>
          <div className="mreza-2">
            <a href={d.unosHash} className="velika-plocica velika-plocica-crvena" style={{ minHeight: 168 }} data-fokus ref={fokusRef}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Ikona ime="meni-unos-ocena" velicina={24} />
                <kbd style={{ background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.55)', color: '#fff' }}>F2</kbd>
              </span>
              <span className="velika-plocica-naslov">Unos ocena</span>
              <span style={{ fontSize: 15 }}>{tekstPlocice(napredak, nastavi)}</span>
            </a>
            <a href="#/rang" className="velika-plocica" style={{ minHeight: 168 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Ikona ime="meni-rang-liste" velicina={24} /><kbd>F4</kbd>
              </span>
              <span className="velika-plocica-naslov">Rang liste</span>
              <span className="sek" style={{ fontSize: 15 }}>Po spravi, višeboj i ekipno</span>
            </a>
          </div>
          <section className="kartica" style={{ overflow: 'hidden' }}>
            <div className="kartica-zaglavlje">
              <h2 className="kartica-naslov">Priprema po klubovima</h2>
              <StanjeOznake stanje={stanje} />
            </div>
            {stanje.redosled_klubova.length === 0
              ? <p className="prazno">Još nema prijava. <a href="#/prijave">Prijavite takmičare.</a></p>
              : <KluboviStanje stanje={stanje} />}
          </section>
        </div>
      </div>
    </>
  );
}
