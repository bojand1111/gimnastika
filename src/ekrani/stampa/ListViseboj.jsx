import Ikona from '../../komponente/Ikona.jsx';
import { prikaz } from '../../../electron/racun/broj.mjs';
import { kolone, mestoTekst, odustalaRec } from '../stampaStanje.js';

// Visebojna lista (POPIS 4.3): grid, blok po takmicaru sa D, E i odbitkom po spravi.
export default function ListViseboj({ redovi, rez, pol, polozeno }) {
  const z = pol === 'Z';
  const k = kolone(rez.sprave.length, polozeno);
  return (
    <div className="st-tabela">
      <div className="st-red st-glava" style={{ gridTemplateColumns: k }}>
        <span>Mesto</span><span style={{ paddingLeft: 0 }}>Br.</span><span>{z ? 'Takmičarka' : 'Takmičar'} / klub</span>
        {rez.sprave.map((s) => (
          <div key={s.id} className="st-sprava">
            {s.ikona !== '' && <Ikona ime={s.ikona} velicina={30} />}<b>{s.naziv}</b><span className="sivo">ocena (mesto)</span>
          </div>
        ))}
        <span className="st-ukupno">Ukupno</span>
      </div>
      {redovi.map((r) => {
        const p = rez.prijave[r.prijava];
        return (
          <div key={r.prijava} className="st-red" style={{ gridTemplateColumns: k }}>
            <span className="st-mesto broj">{mestoTekst(r.mesto, r.oznaka)}</span>
            <span className="st-br broj">{p.startni_broj ?? ''}</span>
            <span className="st-ime">
              <b>{`${p.prezime} ${p.ime}`}</b>
              <span>{p.klub_skr ?? ''}</span>
              {r.oznaka === 'VK' && <i>van konkurencije</i>}
              {r.odustao && <i>{odustalaRec(pol)}</i>}
            </span>
            {rez.sprave.map((s) => {
              const d = r.detalji[s.id] ?? null;
              if (d === null || d.status === 'odustao') return <div key={s.id} className="st-ocena prazno">–</div>;
              return (
                <div key={s.id} className="st-ocena">
                  <span className="glavna"><b className="broj">{prikaz(d.konacna)}</b><span className="broj">({r.mesta[s.id] ?? ''})</span></span>
                  <span className="deo"><span>D</span><span className="broj">{prikaz(d.d)}</span></span>
                  <span className="deo"><span>E</span><span className="broj">{prikaz(d.e)}</span></span>
                  {d.odbitak ? <span className="deo"><span>Odb.</span><span className="broj">{`−${prikaz(d.odbitak)}`}</span></span> : null}
                </div>
              );
            })}
            <span className="st-zbir broj">{r.zbir !== null ? prikaz(r.zbir) : '–'}</span>
          </div>
        );
      })}
    </div>
  );
}
