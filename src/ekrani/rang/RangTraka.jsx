import Ikona from '../../komponente/Ikona.jsx';
import { hashEkrana, hashRang, odustaoRec } from '../rangStanje.js';

// Zaglavlje kartice (tabovi i dugmad) i red filtera (POPIS 2.2). Tabovi su hash linkovi; pol je samo za tekst.
export default function RangTraka({ izbor, rez, tab, naKategoriju, naProgram }) {
  const { pol, kat, prog } = izbor;
  const tabId = (id) => String(tab) === String(id);
  const q = { kat, prog };
  return (
    <>
      <div className="rang-zaglavlje">
        <div role="tablist" aria-label="Vrsta rang liste" className="rang-tabovi">
          {(rez ? rez.sprave : []).map((s) => (
            <a key={s.id} role="tab" aria-selected={tabId(s.id)} href={hashRang(kat, prog, s.id)} className={`rang-tab ${tabId(s.id) ? 'aktivan' : ''}`}>{s.naziv}</a>
          ))}
          <a role="tab" aria-selected={tab === 'viseboj'} href={hashRang(kat, prog, 'viseboj')} className={`rang-tab ${tab === 'viseboj' ? 'aktivan' : ''}`}>Višeboj</a>
          <a role="tab" aria-selected={tab === 'ekipno'} href={hashRang(kat, prog, 'ekipno')} className={`rang-tab ${tab === 'ekipno' ? 'aktivan' : ''}`}>Ekipno</a>
        </div>
        <div className="rang-dugmad">
          <a href={hashEkrana('bilten', q)} className="dugme">Bilten takmičenja</a>
          <a href={hashEkrana('stampa', { ...q, tab })} className="dugme" id="stampa-link">
            <Ikona ime="stampac" velicina={16} /><span>Pregled za štampu</span><kbd>Ctrl+P</kbd>
          </a>
        </div>
      </div>
      <div className="rang-filter" id="rang-filter">
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
