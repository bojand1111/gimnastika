import Ikona from '../../komponente/Ikona.jsx';
import { prikaz } from '../../../electron/racun/broj.mjs';
import { mestoCelija, ImeSaOznakama } from './Mesto.jsx';

// Rang lista jedne sprave (POPIS 2.2): mesto, startni broj, takmicar, klub, D, E, odbitak, konacna.
export default function TabSprava({ rez, izbor, sprava }) {
  const lista = rez.po_spravi[sprava.id] ?? [];
  return (
    <table className="tabela rang-tabela">
      <thead><tr>
        <th style={{ width: 76 }}>Mesto</th><th style={{ width: 76 }}>St. br.</th><th>Takmičar</th><th style={{ width: 70 }}>Klub</th>
        <th className="desno" style={{ width: 100 }}>D</th><th className="desno" style={{ width: 100 }}>E</th><th className="desno" style={{ width: 100 }}>Odbitak</th>
        <th className="desno" style={{ width: 130 }}>
          <span className="rang-zag-ikona">{sprava.ikona !== '' && <Ikona ime={sprava.ikona} velicina={18} />}Konačna</span>
        </th>
      </tr></thead>
      <tbody>
        {lista.length === 0 && <tr><td colSpan={8} className="prazno">Još nema unetih ocena na ovoj spravi.</td></tr>}
        {lista.map((r) => {
          const p = rez.prijave[r.prijava];
          const od = r.status === 'odustao';
          return (
            <tr key={r.prijava} className={r.oznaka === 'VK' ? 'rang-vk' : ''}>
              <td>{mestoCelija(r.mesto, r.oznaka)}</td>
              <td><span className="broj rang-startni">{p.startni_broj ?? ''}</span></td>
              <td><ImeSaOznakama p={p} izbor={izbor} vk={r.oznaka === 'VK'} odustao={od} /></td>
              <td><span className="skr rang-klub">{p.klub_skr ?? ''}</span></td>
              <td className="desno"><span className="ocena-tekst">{od ? '–' : prikaz(r.d)}</span></td>
              <td className="desno"><span className="ocena-tekst">{od ? '–' : prikaz(r.e)}</span></td>
              <td className="desno"><span className="ocena-tekst">{od ? '–' : prikaz(r.odbitak)}</span></td>
              <td className="desno"><span className="broj rang-konacna">{od ? '–' : prikaz(r.konacna)}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
