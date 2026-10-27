import { datumPrikaz, danUNedelji } from '../../../electron/racun/datum.mjs';
import Ikona from '../../komponente/Ikona.jsx';
import StanjeOznake from '../../komponente/StanjeOznake.jsx';
import KluboviStanje from '../../komponente/KluboviStanje.jsx';
import { imaNedovrseno, tekstNastavi, hashNastavi } from '../pocetnaStanje.js';

// Leva strana Pocetne: kartica aktivnog takmicenja (ili prazno stanje) i priprema po klubovima (POPIS 1.2).
export default function KartaAktivnog({ takm, stanje, imaOstala, fokusRef }) {
  if (takm === null) {
    return (
      <section className="kartica">
        <div className="prazno-stanje">
          <h2>Nema aktivnog takmičenja</h2>
          <p>
            Napravite novo takmičenje{imaOstala ? ' ili otvorite neko od postojećih iz liste ispod' : ''}.
            {' '}Aktivno takmičenje je ono u koje idu prijave, rotacije, ocene i rang liste.
          </p>
          <a href="#/takmicenja/novo" className="dugme dugme-glavno dugme-veliko" data-fokus ref={fokusRef}>
            <Ikona ime="plus" velicina={16} /><span>Novo takmičenje</span>
          </a>
        </div>
      </section>
    );
  }
  const nedovrseno = imaNedovrseno(stanje);
  return (
    <>
      <section className="kartica" style={{ padding: '20px 24px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Aktivno takmičenje</span>
            {Number(takm.zavrseno) === 1 && <span className="status">Završeno</span>}
          </span>
          <a href="#/takmicenja" className="dugme dugme-tekst dugme-malo">Sva takmičenja</a>
        </div>
        <h2 style={{ fontSize: 28, lineHeight: '36px', fontWeight: 800, letterSpacing: '-0.02em' }}>{takm.naziv}</h2>
        <div className="sek" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 15 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Ikona ime="meni-takmicenja" velicina={16} />
            <span>{danUNedelji(String(takm.datum ?? ''))}, <span className="broj">{datumPrikaz(takm.datum)}</span></span>
          </span>
          {takm.mesto && <span>{takm.mesto}</span>}
          <StanjeOznake stanje={stanje} />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 4, flexWrap: 'wrap' }}>
          <a href={hashNastavi(stanje)} className="dugme dugme-glavno dugme-veliko" data-fokus ref={fokusRef}>
            <span>{tekstNastavi(stanje)}</span>
            <Ikona ime="strelica-desno" velicina={16} />
          </a>
          <a href="#/unos" className="dugme dugme-veliko"><span>Unos ocena</span><kbd>F2</kbd></a>
          <a href="#/rang" className="dugme dugme-veliko"><span>Rang liste</span><kbd>F4</kbd></a>
        </div>
      </section>
      <section className="kartica" style={{ overflow: 'hidden' }}>
        <div className="kartica-zaglavlje">
          <h2 className="kartica-naslov">Priprema po klubovima</h2>
          {stanje.prijava > 0 && (nedovrseno
            ? <span className="status status-warn"><Ikona ime="upozorenje" velicina={13} />Nije sve dovršeno</span>
            : <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Sve je dovršeno</span>)}
        </div>
        {stanje.redosled_klubova.length === 0
          ? <p className="prazno">Još nema prijava. <a href="#/prijave">Prijavite takmičare.</a></p>
          : <KluboviStanje stanje={stanje} />}
      </section>
    </>
  );
}
