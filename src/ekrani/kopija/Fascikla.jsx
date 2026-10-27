import Ikona from '../../komponente/Ikona.jsx';
import { fasciklaOpis } from '../kopijaStanje.js';

// Kartica sa fasciklom za kopije (POPIS 3.3, 6.5). "Vrati podrazumevanu" samo kad nije podrazumevana ili je izabrana nedostupna.
export default function Fascikla({ fascikla, zauzeto, naPromeni, naPodrazumevanu }) {
  const { naslov, napomena } = fasciklaOpis(fascikla);
  const onemoguci = zauzeto || undefined;
  const klasa = (osnova) => `${osnova}${zauzeto ? ' iskljuceno' : ''}`;
  return (
    <section className="kartica" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <Ikona ime="fascikla" velicina={18} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }}>
        <span className="oznaka">{naslov}</span>
        <span className="broj odseci" style={{ fontWeight: 600 }} title={fascikla.putanja}>{fascikla.putanja}</span>
        {napomena && <span className="mali" style={{ color: 'var(--warn)', fontWeight: 600 }} role="status">{napomena}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {(!fascikla.podrazumevana || fascikla.izabrana) && (
          <button type="button" className={klasa('dugme')} aria-disabled={onemoguci} onClick={naPodrazumevanu}>Vrati podrazumevanu</button>
        )}
        <button type="button" className={klasa('dugme')} aria-disabled={onemoguci} onClick={naPromeni}>Promeni fasciklu</button>
      </div>
    </section>
  );
}
