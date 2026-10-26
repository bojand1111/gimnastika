import { prikaz } from '../../../electron/racun/broj.mjs';
import { mestoTekst, odustalaRec } from '../stampaStanje.js';

// Lista jedne sprave (POPIS 4.3): mesto, broj, ime, klub, D, E, odbitak, ocena.
export default function ListSprava({ redovi, rez, pol }) {
  const z = pol === 'Z';
  return (
    <table className="st-tab">
      <thead><tr>
        <th style={{ width: 50 }}>Mesto</th><th style={{ width: 40 }}>Br.</th><th className="levo">{z ? 'Takmičarka' : 'Takmičar'}</th>
        <th className="levo" style={{ width: 180 }}>Klub</th>
        <th style={{ width: 64 }}>D</th><th style={{ width: 64 }}>E</th><th style={{ width: 64 }}>Odb.</th><th style={{ width: 80 }}>Ocena</th>
      </tr></thead>
      <tbody>
        {redovi.map((r) => {
          const p = rez.prijave[r.prijava];
          const od = r.status === 'odustao';
          return (
            <tr key={r.prijava}>
              <td className="centar jako">{mestoTekst(r.mesto, r.oznaka)}</td>
              <td className="centar">{p.startni_broj ?? ''}</td>
              <td className="levo jako">
                {`${p.prezime} ${p.ime}`}
                {r.oznaka === 'VK' && <> <i style={{ fontWeight: 500 }}>van konkurencije</i></>}
                {od && <> <i style={{ fontWeight: 500 }}>{odustalaRec(pol)}</i></>}
              </td>
              <td className="levo">{p.klub_ime ?? ''}</td>
              <td>{od ? '–' : prikaz(r.d)}</td>
              <td>{od ? '–' : prikaz(r.e)}</td>
              <td>{od || !r.odbitak ? '' : `−${prikaz(r.odbitak)}`}</td>
              <td className="jako" style={{ fontSize: 14 }}>{od ? '–' : prikaz(r.konacna)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
