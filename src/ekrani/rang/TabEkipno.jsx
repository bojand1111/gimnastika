import { prikaz } from '../../../electron/racun/broj.mjs';
import { mestoCelija, ImeLink } from './Mesto.jsx';
import { ZagSprave } from './TabViseboj.jsx';

// Ekipna lista (POPIS 2.2): red ekipe pa njeni clanovi; ocene koje se ne broje su u zagradi.
export default function TabEkipno({ rez, izbor }) {
  const n = rez.sprave.length;
  return (
    <table className="tabela rang-tabela">
      <thead><tr>
        <th style={{ width: 76 }}>Mesto</th><th>Klub i članovi</th>
        {rez.sprave.map((s) => <ZagSprave key={s.id} s={s} n={n} vrsta="ekipno" />)}
        <th className="desno" style={{ width: 124 }}>Ukupno</th>
      </tr></thead>
      <tbody>
        {rez.ekipno.length === 0 && <tr><td colSpan={3 + n} className="prazno">Nema ekipa. Označite „član ekipe“ u Prijavama.</td></tr>}
        {rez.ekipno.map((ek) => [
          <tr key={`e${ek.klub.id}`} className="rang-ekipa">
            <td>{mestoCelija(ek.mesto, ek.oznaka)}</td>
            <td><strong>{ek.klub.puno_ime ?? ''}</strong> <span className="skr sek">{ek.klub.skracenica ?? ''}</span></td>
            {rez.sprave.map((s) => <td key={s.id} className="desno"><span className="ocena-tekst rang-ekipa-ocena">{prikaz(ek.po_spravi[s.id] ?? 0)}</span></td>)}
            <td className="desno"><span className="broj rang-konacna">{prikaz(ek.ukupno)}</span></td>
          </tr>,
          ...ek.clanovi.map((c) => {
            const p = rez.prijave[c.prijava];
            return (
              <tr key={`c${ek.klub.id}-${c.prijava}`} className="rang-clan">
                <td></td>
                <td className="rang-clan-ime"><ImeLink p={p} izbor={izbor} /> <span className="broj sivo mali">{p.startni_broj ?? ''}</span></td>
                {rez.sprave.map((s) => {
                  const v = c.ocene[s.id] ?? null;
                  const broji = !!c.broji[s.id];
                  return (
                    <td key={s.id} className="desno">
                      <span className={`broj ${broji ? '' : 'sivo'}`}>{v === null ? '–' : (broji ? prikaz(v) : `(${prikaz(v)})`)}</span>
                    </td>
                  );
                })}
                <td className="desno"><span className="broj sek">{c.zbir !== null ? prikaz(c.zbir) : '–'}</span></td>
              </tr>
            );
          }),
        ])}
      </tbody>
    </table>
  );
}
