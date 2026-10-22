import Ikona from '../../komponente/Ikona.jsx';
import RedPrijave from './RedPrijave.jsx';
import { grupisiPoKlubu, sirinaSprava, legenda, cipPrijava } from '../prijaveFilter.js';

// Desna kartica: zaglavlje sa filterom kluba i akcijama, upozorenja, tabela po klubovima, podnozje.
export default function TabelaPrijava({ d, pol, klub, naKlub, izabranId, akcije }) {
  const { prijave, stanje, upozorenja, sprave } = d;
  const grupe = grupisiPoKlubu(prijave, stanje);
  const vidljive = klub === '' ? grupe : grupe.filter((g) => String(g.klubId) === klub);
  const broj = vidljive.reduce((n, g) => n + g.prijave.length, 0);
  const najvise = Math.max(1, pol === '' ? Math.max(sprave.M.length, sprave.Z.length) : sprave[pol].length);
  const spraveLegende = legenda(sprave, pol).join(' · ');
  const tekstLegende = ['Poj. = pojedinac', 'VK = van konkurencije', spraveLegende].join(' · ');
  const naslov = `Prijavljeni${pol !== '' ? ` · ${pol === 'M' ? 'MSG' : 'ŽSG'}` : ''}`;

  return (
    <section className="kartica raste kartica-skriveno">
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">{naslov}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {stanje.redosled_klubova.length > 0 && (
            <select className="unos" id="p-klub" aria-label="Klub prijavljenih" title="Prikaži prijave jednog kluba"
              style={{ width: 132, height: 32, padding: '0 6px' }} value={klub} onChange={(ev) => naKlub(ev.target.value)}>
              <option value="">Svi klubovi</option>
              {stanje.redosled_klubova.map((kid) => (
                <option key={kid} value={String(kid)}>{kid === 0 ? 'bez kluba' : stanje.klubovi[kid].skracenica}</option>
              ))}
            </select>
          )}
          <span className="status" id="broj-prijava">{cipPrijava(broj, d.ukupno, pol !== '' || klub !== '')}</span>
          {upozorenja.length > 0 && (
            <span className="status status-bad"><Ikona ime="upozorenje" velicina={13} />
              {upozorenja.length} {upozorenja.length === 1 ? 'upozorenje' : 'upozorenja'}</span>
          )}
          <button type="button" className="dugme dugme-malo" id="startni" onClick={akcije.startni}>Dodeli startne brojeve</button>
          <button type="button" className="dugme dugme-malo" id="uvoz" onClick={akcije.uvoz}
            title="Prijava kluba kao Word (.docx) ili Excel (.xlsx) fajl; može više fajlova odjednom">
            <Ikona ime="fascikla" velicina={14} /><span>Uvezi iz fajla</span></button>
        </div>
      </div>
      {upozorenja.map((u, i) => (
        <div key={i} role="alert" className="prijave-upozorenje">
          <Ikona ime="upozorenje" velicina={16} /><span>{u}</span>
        </div>
      ))}
      <div className="kartica-skrol">
        <table className="tabela tabela-zbijena" id="tabela-prijave">
          <thead>
            <tr>
              <th style={{ width: 60 }}>St. br.</th><th className="k-takmicar">Takmičar</th>
              <th style={{ width: 108 }}>Kategorija</th><th style={{ width: 112 }}>Program</th>
              <th style={{ width: sirinaSprava(najvise) }}>Sprave</th><th style={{ width: 142 }}>Učešće</th>
              <th className="k-kraj"></th>
            </tr>
          </thead>
          <tbody>
            {prijave.length === 0 && (
              <tr><td colSpan={7} className="prazno">Još nema prijava. Označite takmičare levo i kliknite „Prijavi“.</td></tr>
            )}
            {vidljive.map((g) => <GrupaKluba key={g.klubId} g={g} d={d} pol={pol} izabranId={izabranId} akcije={akcije} />)}
          </tbody>
        </table>
      </div>
      <div className="prijave-podnozje">
        <span className="sivo mali odseci prijave-legenda" title={spraveLegende}>{tekstLegende}</span>
        <button type="button" className="dugme dugme-glavno" id="sledece" onClick={akcije.dalje}>
          <span>Sledeće: Rotacije</span><Ikona ime="strelica-desno" velicina={16} /></button>
      </div>
    </section>
  );
}

function GrupaKluba({ g, d, pol, izabranId, akcije }) {
  const k = d.stanje.klubovi[g.klubId];
  return (
    <>
      <tr className="klub-red" data-klub={g.klubId}>
        <td colSpan={7}>
          <div className="klub-naslov">
            <span className="skr">{g.klubId === 0 ? 'Bez kluba' : k.skracenica}</span>
            {g.klubId !== 0 && <span className="sivo odseci">{k.puno_ime}</span>}
            <span className="status">{g.prijave.length}</span>
            {g.klubId !== 0 && (
              <label className={`potvrda ${k.potvrdjeno ? 'potvrdjeno' : ''}`}>
                <input type="checkbox" value={g.klubId} checked={Boolean(k.potvrdjeno)}
                  onChange={(ev) => akcije.potvrda(g.klubId, ev.target.checked)} />
                <span>Spisak potvrdio klub</span>
              </label>
            )}
          </div>
        </td>
      </tr>
      {g.prijave.map((p) => (
        <RedPrijave key={p.id} p={p} izabran={p.id === izabranId} kategorije={d.kategorije} programi={d.programi}
          sprave={d.sprave} pol={pol} akcije={akcije} />
      ))}
    </>
  );
}
