import Ikona from '../../komponente/Ikona.jsx';
import { hashRotacija } from '../rotacijeStanje.js';

// Traka iznad kolona (POPIS 5.2): filter, rotacija, pomeraj, nova grupa.
export default function RotTraka({ d, filter, naPomeraj, naNova }) {
  const rotacije = Array.from({ length: d.brojSprava }, (_, i) => i + 1);
  return (
    <div className="kartica" id="rot-traka" data-pol={d.pol} data-rot={d.rot} data-broj-sprava={d.brojSprava}>
      <select className="unos" id="filter-kp" aria-label="Kategorija i program" value={filter}
        onChange={(ev) => { location.hash = hashRotacija(d.rot, ev.target.value); }}>
        <option value="">Sve kategorije</option>
        {d.kombinacije.map((k) => {
          const v = `${Number(k.kid) || 0}-${Number(k.pid) || 0}`;
          return <option key={v} value={v}>{`${k.kat ?? '–'} · ${k.prog ?? '–'}`}</option>;
        })}
      </select>
      <div className="rot-rotacija"><span className="oznaka">Rotacija</span>
        <div className="izbor" role="group" aria-label="Rotacija">
          {rotacije.map((r) => (
            <a key={r} href={hashRotacija(r, filter)} className={`broj rot-rotacija-link${d.rot === r ? ' izabrano' : ''}`}>{r}</a>
          ))}
        </div>
      </div>
      <span className="rot-razmak" />
      <label className="kucica"><input type="checkbox" id="pomeraj" checked={d.pomeraj} onChange={(ev) => naPomeraj(ev.target.checked)} />
        <span>Pomeraj redosled u svakoj rotaciji (prvi ide na kraj)</span></label>
      <button type="button" className="dugme" id="nova-grupa" onClick={naNova}><Ikona ime="plus" velicina={16} />Nova grupa</button>
    </div>
  );
}
