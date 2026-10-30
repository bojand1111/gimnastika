import { useEffect, useMemo, useRef, useState } from 'react';
import Ikona from '../../komponente/Ikona.jsx';
import { vidljivTakmicar, jediniSlobodan } from '../prijaveFilter.js';

// Leva kartica: baza takmicara izabranog dela sa pretragom i klubom; Enter ili "Prijavi" prijavljuje oznacene.
export default function BazaTakmicara({ d, naDodaj, naNovi, reset }) {
  const [upit, postaviUpit] = useState('');
  const [klub, postaviKlub] = useState('');
  const [oznaceni, postaviOznaceni] = useState(() => new Set());
  const lista = useRef(null);
  const pretraga = useRef(null);

  const prijavljeni = useMemo(() => new Set(d.prijavljeni.map(Number)), [d.prijavljeni]);
  const vidljivi = useMemo(
    () => d.takmicari.filter((t) => vidljivTakmicar(t, { upit, klub })), [d.takmicari, upit, klub]);

  useEffect(() => { if (pretraga.current) pretraga.current.focus(); }, []);

  // Oznake takmicara kojih vise nema na listi se odbacuju.
  useEffect(() => {
    const ids = new Set(d.takmicari.map((t) => t.id));
    postaviOznaceni((s) => ([...s].every((id) => ids.has(id)) ? s : new Set([...s].filter((id) => ids.has(id)))));
  }, [d.takmicari]);

  // Spoljni reset (novi takmicar): prazna pretraga, svi klubovi, bez oznaka.
  useEffect(() => {
    if (!reset) return;
    postaviUpit(''); postaviKlub(''); postaviOznaceni(new Set());
  }, [reset]);

  // Alt+N otvara dijalog sa kluba iz leve liste.
  const novi = () => naNovi(klub);
  useEffect(() => {
    document.addEventListener('app:novi', novi);
    return () => document.removeEventListener('app:novi', novi);
  });

  function promeniOznaku(id, da) {
    postaviOznaceni((s) => { const n = new Set(s); if (da) n.add(id); else n.delete(id); return n; });
  }

  async function dodaj(ids) {
    if (await naDodaj(ids)) {
      // Kao PHP posle reload-a: prazna pretraga, "Svi klubovi", fokus u pretrazi.
      postaviUpit(''); postaviKlub(''); postaviOznaceni(new Set());
      if (pretraga.current) pretraga.current.focus();
    }
  }

  function izPretrage(ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      let ids = [...oznaceni];
      // Tacno jedan vidljiv neprijavljen i nista oznaceno: Enter ga prijavljuje.
      const jedini = jediniSlobodan(vidljivi, prijavljeni);
      if (!ids.length && jedini != null) ids = [jedini];
      dodaj(ids);
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const prvi = lista.current.querySelector('input:not(:disabled)');
      if (prvi) prvi.focus();
    }
  }

  function izListe(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); dodaj([...oznaceni]); return; }
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    ev.preventDefault();
    const sva = [...lista.current.querySelectorAll('input:not(:disabled)')];
    const sused = sva[sva.indexOf(ev.target) + (ev.key === 'ArrowDown' ? 1 : -1)];
    if (sused) sused.focus();
  }

  return (
    <section className="kartica baza-kartica">
      <div className="kartica-zaglavlje baza-zaglavlje">
        <h2 className="kartica-naslov">Baza takmičara</h2>
        <button type="button" className="dugme dugme-malo" id="novi-takmicar" title="Takmičar koga nema u bazi (Alt+N)" onClick={novi}>
          <Ikona ime="plus" velicina={14} />Novi</button>
      </div>
      <div className="baza-filteri">
        <label className="pretraga">
          <span className="ikona-pretraga" style={{ display: 'flex' }}><Ikona ime="pretraga" velicina={16} /></span>
          <input type="text" className="unos" id="pretraga" data-fokus ref={pretraga} value={upit} placeholder="Ime, prezime ili ID"
            aria-label="Pretraga" autoComplete="off" onChange={(ev) => postaviUpit(ev.target.value)} onKeyDown={izPretrage} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="unos" id="f-klub" aria-label="Klub" style={{ flex: '1 1 0', minWidth: 0 }}
            value={klub} onChange={(ev) => postaviKlub(ev.target.value)}>
            <option value="">Svi klubovi</option>
            {d.klubovi.map((k) => <option key={k.id} value={String(k.id)}>{k.skracenica}</option>)}
          </select>
        </div>
      </div>
      <div className="kartica-skrol" id="baza-lista" ref={lista} onKeyDown={izListe}>
        {vidljivi.map((t) => {
          const vec = prijavljeni.has(t.id);
          return (
            <label key={t.id} className={`baza-red ${vec ? 'vec' : ''}`}>
              <input type="checkbox" value={t.id} checked={vec || oznaceni.has(t.id)} disabled={vec}
                aria-label={`${t.prezime} ${t.ime}`} onChange={(ev) => promeniOznaku(t.id, ev.target.checked)} />
              <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: '17px' }}>
                <span className="odseci">{t.prezime} {t.ime}</span>
                <span className="mali sivo">{t.godina_rodjenja} · {t.klub_skr ?? ''}</span>
              </span>
              {vec && <span className="sivo" title="Već prijavljen"><Ikona ime="kvacica" velicina={14} /></span>}
            </label>
          );
        })}
      </div>
      <div className="baza-podnozje">
        <span className="sek" style={{ fontSize: 13 }} id="izabrano">Izabrano: {oznaceni.size}</span>
        <button type="button" className="dugme dugme-glavno" id="dodaj" style={{ padding: '0 10px' }}
          onClick={() => dodaj([...oznaceni])}><span>Prijavi</span><kbd>Enter</kbd></button>
      </div>
    </section>
  );
}
