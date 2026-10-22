import { useEffect, useRef } from 'react';
import { datumPrikaz } from '../../../electron/racun/datum.mjs';

const UCESCA = { ekipa: 'Ekipa', pojedinac: 'Pojedinac', vk: 'Van konkurencije' };
const STATUSI = {
  novi: ['status-ok', 'Novi'],
  postoji: ['status-warn', 'Verovatno postoji'],
  slican: ['status-warn', 'Isto ime, druga godina'],
  prijavljen: ['status-info', 'Već prijavljen'],
  greska: ['status-bad', 'Ne može'],
};
const ucfirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const rodjen = (r) => (r.datum ? datumPrikaz(r.datum) : r.godina != null ? `${r.godina}.` : '–');

// Tabela redova jednog fajla (POPIS 7.7); izbor i postupak su u stanju ekrana.
export default function TabelaUvoza({ f, izbor, naRed, naSve }) {
  const sveRef = useRef(null);
  const izborni = f.redovi.map((r, ri) => ri).filter((ri) => f.redovi[ri].postupak !== 'nista');
  const cekirano = izborni.filter((ri) => izbor.redovi[ri].uvezi).length;
  useEffect(() => {
    if (sveRef.current) sveRef.current.indeterminate = cekirano > 0 && cekirano < izborni.length;
  }, [cekirano, izborni.length]);

  return (
    <table className="tabela tabela-zbijena uvoz-tabela">
      <thead>
        <tr>
          <th style={{ width: 40 }}>
            <input ref={sveRef} type="checkbox" className="uvoz-sve" aria-label="Uvezi sve iz fajla" title="Uvezi sve"
              checked={izborni.length > 0 && cekirano === izborni.length} disabled={izborni.length === 0}
              onChange={(ev) => naSve(ev.target.checked)} />
          </th>
          <th style={{ width: 40 }}>#</th><th style={{ width: 150 }}>Prezime</th><th style={{ width: 130 }}>Ime</th>
          <th style={{ width: 100 }}>Rođen</th><th style={{ width: 80 }}>Oznaka</th><th style={{ width: 100 }}>Učešće</th>
          <th style={{ width: 140 }}>Stanje</th><th>Šta se radi</th>
        </tr>
      </thead>
      <tbody>
        {f.redovi.map((r, ri) => {
          const ime = `${r.prezime} ${r.ime}`;
          const moze = r.postupak !== 'nista';
          const iz = izbor.redovi[ri];
          const [klasa, tekst] = STATUSI[r.status];
          const iskljucen = moze && !iz.uvezi;
          return (
            <tr key={ri} className={`uvoz-red uvoz-${r.status}${iskljucen ? ' uvoz-iskljucen' : ''}`}>
              <td>{moze && <input type="checkbox" className="uvoz-uvezi" aria-label={`Uvezi ${ime}`} checked={iz.uvezi}
                onChange={(ev) => naRed(ri, { uvezi: ev.target.checked })} />}</td>
              <td className="broj sivo">{r.rb}</td>
              <td style={{ fontWeight: 600 }}>{r.prezime}</td>
              <td>{r.ime}</td>
              <td className="broj">{rodjen(r)}</td>
              <td>{r.oznaka !== '' && r.oznaka != null ? r.oznaka : '–'}</td>
              <td>{UCESCA[r.ucesce] ?? r.ucesce}</td>
              <td><span className={`status ${klasa}`}>{tekst}</span></td>
              <td>
                {r.status === 'postoji' || r.status === 'slican' ? (
                  <select className="unos uvoz-postupak" aria-label={`Postupak za ${ime}`} style={{ height: 30, maxWidth: 420 }}
                    value={iz.postupak} onChange={(ev) => naRed(ri, { postupak: ev.target.value })}>
                    <option value="postojeci">Prijavi postojećeg: {String(r.napomena).replace(/^u bazi(?: je)?:? /, '')}</option>
                    <option value="novi">Upiši kao novog takmičara</option>
                  </select>
                ) : r.status === 'novi' ? (
                  <span className="sek">Upisuje se u bazu takmičara i prijavljuje</span>
                ) : (
                  <span className={r.status === 'greska' ? 'uvoz-razlog' : 'sivo'}>{ucfirst(r.napomena)}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
