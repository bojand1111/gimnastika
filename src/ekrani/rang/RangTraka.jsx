import Ikona from '../../komponente/Ikona.jsx';
import { hashEkrana, hashRang, odustaoRec } from '../rangStanje.js';

// Zaglavlje kartice (tabovi i dugmad) i red filtera (POPIS 2.2). Tabovi i pol su hash linkovi.
export default function RangTraka({ izbor, rez, tab, naKategoriju, naProgram }) {
  const { pol, kat, prog } = izbor;
  const tabId = (id) => String(tab) === String(id);
  const polTab = tab === 'viseboj' || tab === 'ekipno' ? tab : 'viseboj';
  const q = { pol, kat, prog };
  return (
    <>
      <div className="rang-zaglavlje">
        <div role="tablist" aria-label="Vrsta rang liste" className="rang-tabovi">
          {(rez ? rez.sprave : []).map((s) => (
            <a key={s.id} role="tab" aria-selected={tabId(s.id)} href={hashRang(pol, kat, prog, s.id)} className={`rang-tab ${tabId(s.id) ? 'aktivan' : ''}`}>{s.naziv}</a>
          ))}
          <a role="tab" aria-selected={tab === 'viseboj'} href={hashRang(pol, kat, prog, 'viseboj')} className={`rang-tab ${tab === 'viseboj' ? 'aktivan' : ''}`}>Višeboj</a>
          <a role="tab" aria-selected={tab === 'ekipno'} href={hashRang(pol, kat, prog, 'ekipno')} className={`rang-tab ${tab === 'ekipno' ? 'aktivan' : ''}`}>Ekipno</a>
        </div>
        <div className="rang-dugmad">
          <a href={hashEkrana('bilten', q)} className="dugme">Bilten takmičenja</a>
          <a href={hashEkrana('stampa', { ...q, tab })} className="dugme" id="stampa-link">
            <Ikona ime="stampac" velicina={16} /><span>Pregled za štampu</span><kbd>Ctrl+P</kbd>
          </a>
        </div>
      </div>
      <div className="rang-filter" id="rang-filter">
        <div className="izbor" role="group" aria-label="Pol">
          <a href={hashRang('Z', null, null, polTab)} className={pol === 'Z' ? 'izabrano' : ''} aria-current={pol === 'Z' ? 'true' : undefined}>ŽSG</a>
          <a href={hashRang('M', null, null, polTab)} className={pol === 'M' ? 'izabrano' : ''} aria-current={pol === 'M' ? 'true' : undefined}>MSG</a>
        </div>
        <label className="rang-polje"><span className="oznaka">Kategorija</span>
          <select className="unos rang-kat" aria-label="Kategorija" value={kat ?? 0} onChange={(ev) => naKategoriju(ev.target.value)}>
            {izbor.kategorije.map((k) => <option key={k.id} value={k.id}>{k.naziv}</option>)}
          </select>
        </label>
        <label className="rang-polje"><span className="oznaka">Program</span>
          <select className="unos rang-prog" aria-label="Program" value={prog ?? 0} onChange={(ev) => naProgram(ev.target.value)}>
            {izbor.programi.map((k) => <option key={k.id} value={k.id}>{k.naziv}</option>)}
          </select>
        </label>
        <span className="raste" />
        <span className="sek rang-legenda"><span className="status status-vk">VK</span><span>van konkurencije, ne zauzima mesto</span></span>
        <span className="sek rang-legenda">
          <span className="status status-crn"><Ikona ime="iks" velicina={13} />{odustaoRec(pol)}</span><span>bez plasmana</span>
        </span>
      </div>
    </>
  );
}
