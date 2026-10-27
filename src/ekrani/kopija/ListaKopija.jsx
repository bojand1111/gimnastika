import { vrstaTekst } from '../kopijaStanje.js';

// Tabela "Prethodne kopije" (POPIS 3.3); kopije: lista iz gim.kopija.podaci().
export default function ListaKopija({ kopije, VRSTE, zauzeto, naPrikazi, naVrati }) {
  const onemoguci = zauzeto || undefined;
  const klasa = (osnova) => `${osnova}${zauzeto ? ' iskljuceno' : ''}`;
  return (
    <section className="kartica" style={{ overflow: 'hidden' }}>
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">Prethodne kopije</h2>
        <span className="broj sivo" style={{ fontSize: 13, fontWeight: 600 }}>{kopije.length}</span>
      </div>
      <table className="tabela">
        <thead>
          <tr>
            <th style={{ width: 170 }}>Datum i vreme</th>
            <th>Fajl</th>
            <th className="desno" style={{ width: 100 }}>Veličina</th>
            <th style={{ width: 150 }}>Vrsta</th>
            <th style={{ width: 100 }}>Verzija</th>
            <th style={{ width: 270 }} />
          </tr>
        </thead>
        <tbody>
          {kopije.length === 0 && <tr><td colSpan={6} className="prazno">Još nema rezervnih kopija.</td></tr>}
          {kopije.map((k) => {
            const vrsta = vrstaTekst(k.opis, VRSTE);
            return (
              <tr key={k.ime}>
                <td><span className="broj">{k.vremeTekst}</span></td>
                <td><span className="broj odseci" style={{ display: 'block' }} title={k.ime}>{k.ime}</span></td>
                <td className="desno"><span className="broj">{k.velicinaTekst}</span></td>
                <td>{vrsta === null ? <span className="status status-bad">neispravan fajl</span> : vrsta}</td>
                <td><span className="broj sivo">{k.opis ? k.opis.verzija : ''}</span></td>
                <td className="desno" style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className={klasa('dugme dugme-malo dugme-tekst')} aria-disabled={onemoguci} onClick={() => naPrikazi(k.ime)}>Prikaži u fascikli</button>
                  {k.opis && <button type="button" className={klasa('dugme dugme-malo')} aria-disabled={onemoguci} onClick={() => naVrati(k.ime)}>Vrati ovu</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
