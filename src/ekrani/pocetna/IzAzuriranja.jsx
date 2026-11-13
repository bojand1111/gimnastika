import Ikona from '../../komponente/Ikona.jsx';

// Kartica "Iz ažuriranja dodata takmičenja" (objava, spec 5.6); redovi: pocetna.podaci().iz_azuriranja.
export default function IzAzuriranja({ redovi, naUredu }) {
  const dodata = redovi.filter((r) => r.stanje === 'uvezeno');
  const odbijena = redovi.filter((r) => r.stanje === 'odbijeno');
  return (
    <section className="kartica" style={{ overflow: 'hidden' }}>
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">Iz ažuriranja dodata takmičenja</h2>
        <button type="button" className="dugme dugme-malo" onClick={naUredu}><span>U redu</span></button>
      </div>
      {dodata.map((r) => (
        <div key={r.takmicenje_id} style={{ minHeight: 44, padding: '4px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ikona ime="kvacica" velicina={13} />
          <a href="#/takmicenja" className="odseci" style={{ fontWeight: 600 }} title={r.naziv}>{r.naziv}</a>
          {r.datumTekst !== '' && <span className="broj sivo">{r.datumTekst}</span>}
        </div>
      ))}
      {odbijena.length > 0 && (
        <>
          <p className="sivo mali" style={{ padding: '8px 16px 0' }}>Nisu dodata:</p>
          {odbijena.map((r, i) => (
            <div key={`${r.naziv}-${i}`} style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>{r.naziv || 'Fajl bez naziva'}</span>
              <span className="mali sivo">{r.poruka}</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
