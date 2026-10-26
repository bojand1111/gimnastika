import Ikona from '../../komponente/Ikona.jsx';
import { prikaz } from '../../../electron/racun/broj.mjs';
import { nazivKolone, sirinaKolone } from '../rangStanje.js';
import { mestoCelija, ImeSaOznakama } from './Mesto.jsx';

// Zaglavlje kolone sprave: ikona i naziv (ili skracenica kad je sprava vise od 4).
export function ZagSprave({ s, n, vrsta }) {
  return (
    <th className="desno" style={{ width: sirinaKolone(n, vrsta) }}>
      <span className="rang-zag-ikona">{s.ikona !== '' && <Ikona ime={s.ikona} velicina={18} />}<span>{nazivKolone(s, n)}</span></span>
    </th>
  );
}

// Visebojska lista (POPIS 2.2): odustali su sivi i na dnu bez zbira.
export default function TabViseboj({ rez, izbor }) {
  const n = rez.sprave.length;
  return (
    <table className="tabela rang-tabela">
      <thead><tr>
        <th style={{ width: 76 }}>Mesto</th><th style={{ width: 76 }}>St. br.</th><th>Takmičar</th><th style={{ width: 70 }}>Klub</th>
        {rez.sprave.map((s) => <ZagSprave key={s.id} s={s} n={n} vrsta="viseboj" />)}
        <th className="desno" style={{ width: 116 }}>Ukupno</th>
      </tr></thead>
      <tbody>
        {rez.viseboj.length === 0 && <tr><td colSpan={5 + n} className="prazno">Još nema unetih ocena.</td></tr>}
        {rez.viseboj.map((r) => {
          const p = rez.prijave[r.prijava];
          const klase = [r.oznaka === 'VK' ? 'rang-vk' : '', r.odustao ? 'sivo-red' : ''].join(' ').trim();
          return (
            <tr key={r.prijava} className={klase}>
              <td>{mestoCelija(r.mesto, r.oznaka)}</td>
              <td><span className="broj rang-startni">{p.startni_broj ?? ''}</span></td>
              <td><ImeSaOznakama p={p} izbor={izbor} vk={r.oznaka === 'VK'} odustao={r.odustao} /></td>
              <td><span className="skr rang-klub">{p.klub_skr ?? ''}</span></td>
              {rez.sprave.map((s) => {
                const v = r.ocene[s.id] ?? null;
                return <td key={s.id} className="desno"><span className="ocena-tekst">{v !== null ? prikaz(v) : '–'}</span></td>;
              })}
              <td className="desno"><span className="broj rang-konacna">{r.zbir !== null ? prikaz(r.zbir) : '–'}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
