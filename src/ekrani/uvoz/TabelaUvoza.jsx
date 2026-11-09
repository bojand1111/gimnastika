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

// Kolona Klub postoji samo kad redovi fajla imaju svoj klub; tada su ostale kolone uze, da tabela stane u 1366 px.
const SIRINE = { prezime: 150, ime: 130, rodjen: 100, oznaka: 80, ucesce: 100, stanje: 140 };
const SIRINE_SA_KLUBOM = { prezime: 130, ime: 110, rodjen: 105, oznaka: 70, ucesce: 95, stanje: 140, klub: 140 };

// Klub reda po izboru za klub iz fajla: postojeci iz baze, bez kluba ili novi koji se pravi pri upisu.
function klubReda(r, klubovi, izborKluba) {
  const iz = izborKluba ?? (r.klub_id != null ? String(r.klub_id) : 'novo');
  if (iz === 'bez') return <span className="sivo" title={`u fajlu: ${r.klub}`}>bez kluba</span>;
  if (iz !== 'novo') {
    const k = klubovi.find((x) => String(x.id) === iz);
    if (k) return <span title={`${k.skracenica} · ${k.puno_ime} (u fajlu: ${r.klub})`}>{k.skracenica} · {k.puno_ime}</span>;
  }
  const naziv = r.klub_naziv || r.klub;
  return <span title={`Novi klub, biće dodat pri upisu: ${naziv} (u fajlu: ${r.klub})`}>+ novi: {naziv}</span>;
}

// Tabela redova jednog fajla (POPIS 7.7); izbor i postupak su u stanju ekrana.
export default function TabelaUvoza({ f, izbor, naRed, naSve, klubovi = [] }) {
  const saKlubom = f.redovi.some((r) => (r.klub ?? '') !== '');
  const w = saKlubom ? SIRINE_SA_KLUBOM : SIRINE;
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
          <th style={{ width: 40 }}>#</th><th style={{ width: w.prezime }}>Prezime</th><th style={{ width: w.ime }}>Ime</th>
          <th style={{ width: w.rodjen }}>Rođen</th><th style={{ width: w.oznaka }}>Oznaka</th><th style={{ width: w.ucesce }}>Učešće</th>
          {saKlubom && <th style={{ width: w.klub }}>Klub</th>}
          <th style={{ width: w.stanje }}>Stanje</th><th>Šta se radi</th>
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
              {saKlubom && <td>{(r.klub ?? '') !== '' ? klubReda(r, klubovi, izbor.klubovi?.[r.klub_kljuc]) : <span className="sivo">izbor za fajl</span>}</td>}
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
