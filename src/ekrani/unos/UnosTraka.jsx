import { hashUnos, procenat, tekstOdustalo } from '../unosStanje.js';

// Traka iznad kartice (POPIS 5.1): pol, sprava, rotacija i napredak. Promena pola ne nosi spravu ni rotaciju.
export default function UnosTraka({ d, napredak }) {
  const { pol, sprava, sprave, rot, brojSprava } = d;
  const rotacije = Array.from({ length: brojSprava }, (_, i) => i + 1);
  return (
    <div className="kartica unos-traka" id="unos-traka">
      <div className="izbor" role="group" aria-label="Pol">
        <a href={hashUnos('Z')} className={pol === 'Z' ? 'izabrano' : ''}>ŽSG</a>
        <a href={hashUnos('M')} className={pol === 'M' ? 'izabrano' : ''}>MSG</a>
      </div>
      {sprava && (
        <>
          <div className="unos-traka-grupa"><span className="oznaka">Sprava</span>
            <div className="izbor" role="group" aria-label="Sprava">
              {sprave.map((s) => (
                <a key={s.id} href={hashUnos(pol, s.id, rot)} className={Number(s.id) === Number(sprava.id) ? 'izabrano' : ''}>{s.naziv}</a>
              ))}
            </div>
          </div>
          <div className="unos-traka-grupa"><span className="oznaka">Rotacija</span>
            <div className="izbor" role="group" aria-label="Rotacija">
              {rotacije.map((r) => (
                <a key={r} href={hashUnos(pol, sprava.id, r)} className={`broj unos-rot-link${rot === r ? ' izabrano' : ''}`}>{r}</a>
              ))}
            </div>
          </div>
          <span className="unos-razmak" />
          <div className="napredak" id="napredak">
            <span className="napredak-traka"><span className="napredak-punjenje" style={{ width: `${procenat(napredak.obradjeno, napredak.ukupno)}%` }} /></span>
            <span className="broj napredak-broj"><span id="napredak-obradjeno">{napredak.obradjeno}</span> / <span id="napredak-ukupno">{napredak.ukupno}</span></span>
            <span className="sek napredak-tekst">obrađeno<span id="napredak-odustalo">{tekstOdustalo(napredak.odustalo, pol)}</span></span>
          </div>
        </>
      )}
    </div>
  );
}
