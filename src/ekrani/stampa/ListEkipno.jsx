import { prikaz } from '../../../electron/racun/broj.mjs';
import { mestoTekst } from '../stampaStanje.js';

// Ekipna lista (POPIS 4.3): red ekipe pa njeni clanovi; ocene koje se ne broje su u zagradi.
export default function ListEkipno({ redovi, rez }) {
  const n = rez.sprave.length;
  return (
    <table className="st-tab">
      <thead><tr>
        <th style={{ width: 50 }}>Mesto</th><th className="levo">Ekipa, članovi</th>
        {rez.sprave.map((s) => <th key={s.id} style={{ width: n > 4 ? 66 : 84 }}>{n > 4 ? s.skracenica : s.naziv}</th>)}
        <th style={{ width: 84 }}>Ukupno</th>
      </tr></thead>
      <tbody>
        {redovi.map((ek) => [
          <tr key={`e${ek.klub.id}`} className="ekipa">
            <td className="centar">{mestoTekst(ek.mesto, ek.oznaka)}</td>
            <td className="levo">{ek.klub.puno_ime ?? ''}{(ek.klub.grad ?? '') !== '' ? ` ${ek.klub.grad}` : ''}</td>
            {rez.sprave.map((s) => <td key={s.id}>{prikaz(ek.po_spravi[s.id] ?? 0)}</td>)}
            <td style={{ fontSize: 14 }}>{prikaz(ek.ukupno)}</td>
          </tr>,
          ...ek.clanovi.map((c) => {
            const p = rez.prijave[c.prijava];
            return (
              <tr key={`c${ek.klub.id}-${c.prijava}`}>
                <td></td>
                <td className="levo" style={{ paddingLeft: 16 }}>{`${p.prezime} ${p.ime}`}</td>
                {rez.sprave.map((s) => {
                  const v = c.ocene[s.id] ?? null;
                  return <td key={s.id}>{v === null ? '–' : (c.broji[s.id] ? prikaz(v) : `(${prikaz(v)})`)}</td>;
                })}
                <td></td>
              </tr>
            );
          }),
        ])}
      </tbody>
    </table>
  );
}
