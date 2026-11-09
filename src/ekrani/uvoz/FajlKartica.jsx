import Ikona from '../../komponente/Ikona.jsx';
import TabelaUvoza from './TabelaUvoza.jsx';
import { cipFajla } from '../uvozBrojac.js';

function Upozorenje({ tekst }) {
  return <div role="alert" className="uvoz-upozorenje"><Ikona ime="upozorenje" velicina={16} /><span>{tekst}</span></div>;
}

// Jedan fajl uvoza: zaglavlje, upozorenja, podesavanja (klub, oznake) i tabela redova (POPIS 7.7). Novi takmicari dobijaju pol izabranog dela.
export default function FajlKartica({ f, i, izbor, b, d, naPolje, naOznaku, naRed, naSve, naUkloni, zauzet }) {
  // Redovi sa svojim klubom (kolona Klub u fajlu): izbor kluba fajla vazi samo za redove bez kluba.
  const saKlubom = f.redovi.some((r) => (r.klub ?? '') !== '');
  const naKlub = (kljuc, v) => naPolje('klubovi', { ...(izbor.klubovi ?? {}), [kljuc]: v });
  return (
    <section className="kartica" style={{ overflow: 'hidden' }}>
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">{f.ime} <span className="status status-info" style={{ marginLeft: 6 }}>{f.vrsta.toUpperCase()}</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="status" data-brojac={i}>{cipFajla(b)}</span>
          <button type="button" className="dugme dugme-malo" title="Izbaci ovaj fajl iz uvoza" disabled={zauzet} onClick={naUkloni}>
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
          <span className="oznaka">{saKlubom ? 'Klub za redove bez kluba' : 'Klub'}{f.klub_tekst !== '' ? ` (u fajlu: ${f.klub_tekst})` : ''}</span>
          <select className="unos" aria-label={saKlubom ? 'Klub za redove bez kluba' : 'Klub'} value={izbor.klub_id} onChange={(ev) => naPolje('klub_id', ev.target.value)}>
            <option value="">bez kluba</option>
            {d.klubovi.map((k) => <option key={k.id} value={k.id}>{`${k.skracenica} · ${k.puno_ime}`}</option>)}
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
      {saKlubom && (
        <div className="uvoz-klubovi">
          <p className="sek" style={{ margin: 0 }}>
            Klub se čita iz kolone Klub u fajlu, za svaki red posebno. Proverite izbor za svaki klub: postojeći klub iz baze, novi klub ili bez kluba. Postojeći takmičari zadržavaju klub iz baze.
          </p>
          <div className="uvoz-podesavanja" style={{ padding: 0, borderBottom: 0 }}>
            {(f.klubovi_fajla ?? []).map((k) => (
              <label key={k.kljuc} className="polje" style={{ width: 260 }}>
                <span className="oznaka" title={k.tekst}>U fajlu: <b>{k.tekst}</b> ({k.redova})</span>
                {k.delimicno && String(izbor.klubovi?.[k.kljuc]) === String(k.klub_id) && (
                  <span className="uvoz-klub-proveri" role="note">Proverite: poklapa se samo deo naziva</span>
                )}
                <select className="unos" aria-label={`Klub za ${k.tekst}`} value={izbor.klubovi?.[k.kljuc] ?? 'novo'}
                  onChange={(ev) => naKlub(k.kljuc, ev.target.value)}>
                  <option value="novo">+ novi klub: {k.naziv}</option>
                  <option value="bez">bez kluba</option>
                  {d.klubovi.map((x) => <option key={x.id} value={x.id}>{`${x.skracenica} · ${x.puno_ime}`}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
      {f.redovi.length > 0 && <TabelaUvoza f={f} izbor={izbor} naRed={naRed} naSve={naSve} klubovi={d.klubovi} />}
    </section>
  );
}
