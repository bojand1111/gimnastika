import Ikona from '../../komponente/Ikona.jsx';

// Kartica "Poslednja rezervna kopija" (POPIS 1.2); kopija: {tekst, danas} ili null.
export default function PoslednjaKopija({ kopija, zauzeto, naNapravi }) {
  return (
    <section className="kartica">
      <div className="kartica-zaglavlje"><h2 className="kartica-naslov">Poslednja rezervna kopija</h2></div>
      <div className="kartica-telo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="broj" style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600 }}>{kopija ? kopija.tekst : 'Još nema kopije'}</span>
          {kopija && (kopija.danas
            ? <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Danas</span>
            : <span className="status status-warn"><Ikona ime="upozorenje" velicina={13} />Nije od danas</span>)}
        </div>
        <button type="button" className="dugme" style={{ width: '100%', justifyContent: 'center' }} disabled={zauzeto} onClick={naNapravi}>
          <Ikona ime="kopija" velicina={16} /><span>Napravi rezervnu kopiju</span>
        </button>
        <a href="#/kopija" className="dugme dugme-tekst dugme-malo" style={{ justifyContent: 'center' }}>Sve kopije i vraćanje</a>
      </div>
    </section>
  );
}
