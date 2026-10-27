import Ikona from '../../komponente/Ikona.jsx';
import { lekarskiOznaka } from '../pocetnaStanje.js';

// Kartica "Lekarski pregledi" (POPIS 1.2); lekarski: red iz pocetna.podaci().lekarski.
export default function Lekarski({ lekarski }) {
  return (
    <section className="kartica" style={{ overflow: 'hidden' }}>
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">Lekarski pregledi</h2>
        {lekarski.length > 0
          ? <span className="status status-bad"><Ikona ime="upozorenje" velicina={13} />{lekarski.length}</span>
          : <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />U redu</span>}
      </div>
      {lekarski.length === 0
        ? <p className="sivo" style={{ padding: '12px 16px', fontSize: 13 }}>Svim prijavljenima na nezavršena takmičenja lekarski važi.</p>
        : (
          <>
            <div style={{ maxHeight: 264, overflow: 'auto' }}>
              {lekarski.map((l) => {
                const o = lekarskiOznaka(l);
                return (
                  <div key={`${l.takmicenje_id}-${l.takmicar_id}`} style={{ minHeight: 44, padding: '4px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="dva-reda">
                      <span className="odseci" style={{ fontWeight: 600 }}>{l.prezime} {l.ime}</span>
                      <span className="mali sivo odseci" title={l.takmicenje}>{l.klub_skr ?? 'bez kluba'} · {l.takmicenje}</span>
                    </span>
                    <span className={`status ${o.klasa}`} title={o.title || undefined}>
                      {o.tekst}{o.datum !== '' && <> <span className="broj">{o.datum}</span></>}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="sivo mali" style={{ padding: '8px 16px' }}>Prijavljeni na nezavršena takmičenja. Datum lekarskog se menja u kartonu takmičara.</p>
          </>
        )}
    </section>
  );
}
