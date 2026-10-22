import Ikona from '../../komponente/Ikona.jsx';
import TabelaUvoza from './TabelaUvoza.jsx';
import { cipFajla } from '../uvozBrojac.js';

function Upozorenje({ tekst }) {
  return <div role="alert" className="uvoz-upozorenje"><Ikona ime="upozorenje" velicina={16} /><span>{tekst}</span></div>;
}

// Jedan fajl uvoza: zaglavlje, upozorenja, podesavanja (klub, pol, oznake) i tabela redova (POPIS 7.7).
export default function FajlKartica({ f, i, izbor, b, d, naPolje, naOznaku, naRed, naSve, naUkloni }) {
  return (
    <section className="kartica" style={{ overflow: 'hidden' }}>
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">{f.ime} <span className="status status-info" style={{ marginLeft: 6 }}>{f.vrsta.toUpperCase()}</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="status" data-brojac={i}>{cipFajla(b)}</span>
          <button type="button" className="dugme dugme-malo" title="Izbaci ovaj fajl iz uvoza" onClick={naUkloni}>
            <Ikona ime="iks" velicina={14} />Ukloni fajl
          </button>
        </div>
      </div>
      {f.greske.map((g, k) => <Upozorenje key={k} tekst={g} />)}
      {f.klub_id === null && f.klub_tekst !== '' && (
        <Upozorenje tekst={`Klub iz fajla „${f.klub_tekst}“ nije pronađen u bazi klubova. Izaberite klub ispod ili ga prvo dodajte na ekranu Klubovi.`} />
      )}
      <div className="uvoz-podesavanja">
        <label className="polje" style={{ width: 260 }}>
          <span className="oznaka">Klub{f.klub_tekst !== '' ? ` (u fajlu: ${f.klub_tekst})` : ''}</span>
          <select className="unos" aria-label="Klub" value={izbor.klub_id} onChange={(ev) => naPolje('klub_id', ev.target.value)}>
            <option value="">bez kluba</option>
            {d.klubovi.map((k) => <option key={k.id} value={k.id}>{`${k.skracenica} · ${k.puno_ime}`}</option>)}
          </select>
        </label>
        <label className="polje" style={{ width: 150 }}>
          <span className="oznaka">Pol takmičara u fajlu</span>
          <select className="unos uvoz-pol" data-pol-fajla={i} aria-label="Pol" value={izbor.pol} onChange={(ev) => naPolje('pol', ev.target.value)}>
            <option value="">izaberite</option>
            <option value="M">M · muški</option>
            <option value="Z">Ž · ženski</option>
          </select>
        </label>
        {f.oznake.map((o, oi) => (
          <div key={oi} className="polje uvoz-oznaka">
            <span className="oznaka">Oznaka u fajlu: <b>{o.oznaka}</b></span>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="unos" aria-label={`Kategorija za ${o.oznaka}`} title="Kategorija" style={{ width: 150 }}
                value={izbor.oznake[oi].kategorija} onChange={(ev) => naOznaku(oi, 'kategorija', ev.target.value)}>
                <option value="">kategorija: –</option>
                {d.kategorije.map((k) => <option key={k.id} value={k.id}>{k.naziv}</option>)}
                {o.kategorija_id === null && (o.kategorija || '') !== '' && <option value="novo">+ nova: {o.kategorija}</option>}
              </select>
              <select className="unos" aria-label={`Program za ${o.oznaka}`} title="Program" style={{ width: 150 }}
                value={izbor.oznake[oi].program} onChange={(ev) => naOznaku(oi, 'program', ev.target.value)}>
                <option value="">program: –</option>
                {d.programi.map((p) => <option key={p.id} value={p.id}>{p.naziv}</option>)}
                {o.program_id === null && (o.program || '') !== '' && <option value="novo">+ novi: {o.program}</option>}
              </select>
            </div>
          </div>
        ))}
      </div>
      {f.redovi.length > 0 && <TabelaUvoza f={f} izbor={izbor} naRed={naRed} naSve={naSve} />}
    </section>
  );
}
