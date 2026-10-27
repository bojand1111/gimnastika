import Ikona from './Ikona.jsx';

// Tabela stanja pripreme po klubu (POPIS 1.3): redosled iz stanje.redosled_klubova, 0 = bez kluba.
export default function KluboviStanje({ stanje }) {
  return (
    <table className="tabela tabela-zbijena">
      <thead>
        <tr>
          <th>Klub</th>
          <th className="desno" style={{ width: 66 }}>Prijava</th>
          <th style={{ width: 120 }}>Prijave</th>
          <th style={{ width: 124 }}>Spisak</th>
          <th style={{ width: 132 }}>Rotacije</th>
        </tr>
      </thead>
      <tbody>
        {stanje.redosled_klubova.map((kid) => {
          const k = stanje.klubovi[kid];
          return (
            <tr key={kid}>
              <td title={k.puno_ime}>
                {Number(kid) === 0
                  ? <span className="sivo">bez kluba</span>
                  : <><span className="skr">{k.skracenica}</span> <span className="sivo">{k.puno_ime}</span></>}
              </td>
              <td className="desno"><span className="broj">{k.prijava}</span></td>
              <td>
                {k.nepotpune > 0
                  ? <span className="status status-bad"><Ikona ime="upozorenje" velicina={13} />Nepotpune: {k.nepotpune}</span>
                  : <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Potpune</span>}
              </td>
              <td>
                {Number(kid) === 0 ? <span className="sivo">–</span>
                  : k.potvrdjeno ? <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Potvrđen</span>
                    : <span className="status status-warn">Nije potvrđen</span>}
              </td>
              <td>
                {k.nerasporedjeni > 0
                  ? <span className="status status-warn">Neraspoređeni: {k.nerasporedjeni}</span>
                  : <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Raspoređeni</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
