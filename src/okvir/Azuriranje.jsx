import { useEffect, useState } from 'react';
import gim from '../gim.js';
import { obavesti } from './Poruke.jsx';

// Stanje azuriranja: prvo upit, posle toga guranje iz main procesa.
export function useAzuriranje() {
  const [stanje, postaviStanje] = useState(null);
  useEffect(() => {
    let ziv = true;
    let odjava = () => {};
    // U obicnom browseru (bez window.gim) nema azuriranja.
    if (window.gim?.azuriranje) {
      gim.azuriranje.stanje().then((s) => { if (ziv) postaviStanje((tr) => tr || s); }).catch((err) => obavesti(err.message, 'greska'));
      odjava = window.gim.azuriranje.naStanje((s) => { if (ziv) postaviStanje(s); });
    }
    return () => { ziv = false; odjava(); };
  }, []);
  return stanje;
}

async function pozovi(radnja) {
  try { await gim.azuriranje[radnja](); } catch (err) { obavesti(err.message, 'greska'); }
}

// Dugme u traci: vidi se samo kad ima sta da se uradi.
export default function Azuriranje() {
  const s = useAzuriranje();
  if (!s) return null;
  if (s.stanje === 'available') return <button className="dugme dugme-malo dugme-glavno" onClick={() => pozovi('preuzmi')}>Nova verzija {s.verzija}</button>;
  if (s.stanje === 'downloading') return <button className="dugme dugme-malo" disabled>Preuzimanje {s.procenat ?? 0}%</button>;
  if (s.stanje === 'ready') return <button className="dugme dugme-malo dugme-glavno" onClick={() => pozovi('instaliraj')}>Ponovo pokreni i ažuriraj</button>;
  if (s.stanje === 'error') return <span className="status status-bad">{s.poruka}</span>;
  return null;
}

// Kartica na ekranu Sistem.
export function AzuriranjeKartica() {
  const s = useAzuriranje();
  const zauzet = s && ['checking', 'downloading', 'ready'].includes(s.stanje);
  let tekst = '';
  if (s) {
    if (s.stanje === 'none') tekst = s.poruka || 'Program je ažuran.';
    else if (s.stanje === 'checking') tekst = 'Provera je u toku.';
    else if (s.stanje === 'available') tekst = `Dostupna je verzija ${s.verzija}.`;
    else tekst = s.poruka;
  }
  return (
    <div className="kartica">
      <div className="kartica-zaglavlje"><h2 className="kartica-naslov">Ažuriranje</h2></div>
      <div className="kartica-telo">
        <div>Trenutna verzija: <span className="broj">{s ? s.trenutna : '?'}</span></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="dugme" disabled={!s || zauzet} onClick={() => pozovi('proveri')}>Proveri ažuriranje</button>
          {tekst && <span className="sivo mali">{tekst}</span>}
        </div>
      </div>
    </div>
  );
}
