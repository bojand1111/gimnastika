import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Ikona from './Ikona.jsx';
import { obavesti } from '../okvir/Poruke.jsx';
import { pomeri } from '../ekrani/redosled.js';

const NAZIV_NOVE = { sprave: 'Nova sprava', programi: 'Novi program', kategorije: 'Nova kategorija' };
const BEZ = { id: null, naziv: '', skr: '', ikona: '' };

// Jedna kartica liste: izmena na licu mesta, brisanje, dodavanje, redosled (prevlacenje i Alt+strelice).
export default function Sifarnik({ vrsta, meta, ikone, sprava, sirina }) {
  const [stavke, postaviStavke] = useState([]);
  const [ured, postaviUred] = useState(BEZ); // stavka u izmeni
  const [novaSkr, postaviNovuSkr] = useState('');
  const [noviNaziv, postaviNoviNaziv] = useState('');
  const kartRef = useRef(null);
  const nazivRef = useRef(null);
  const dodajNazivRef = useRef(null);
  const dodajSkrRef = useRef(null);
  const fokusId = useRef(null); // stavka koja dobija fokus posle sledeceg crtanja
  const vuceId = useRef(null);
  const zauzeto = useRef(false); // dodavanje u toku (dvostruki Enter)
  const stavkeRef = useRef([]);
  stavkeRef.current = stavke;

  // Lista se uvek cita ponovo iz baze.
  const ucitaj = useCallback(async () => {
    try { postaviStavke(await gim.sifarnici.lista(vrsta)); } catch (e) { obavesti(e.message, 'greska'); }
  }, [vrsta]);
  useEffect(() => { ucitaj(); }, [ucitaj]);

  useEffect(() => {
    if (ured.id !== null && nazivRef.current) { nazivRef.current.focus(); nazivRef.current.select(); }
  }, [ured.id]);

  useEffect(() => {
    if (fokusId.current === null || !kartRef.current) return;
    const li = kartRef.current.querySelector(`li.stavka[data-id="${fokusId.current}"]`);
    fokusId.current = null;
    if (li) li.focus();
  });

  const otvori = (s) => postaviUred({ id: s.id, naziv: s.naziv, skr: s.skracenica || '', ikona: s.ikona || '' });
  const zatvori = (id) => { fokusId.current = id; postaviUred(BEZ); };
  const promeniUred = (polje) => (ev) => postaviUred((u) => ({ ...u, [polje]: ev.target.value }));

  async function sacuvaj() {
    try {
      await gim.sifarnici.izmeni(vrsta, ured.id, { naziv: ured.naziv.trim(), skracenica: ured.skr.trim().toUpperCase(), ikona: ured.ikona });
      await ucitaj();
      obavesti('Sačuvano.');
      zatvori(ured.id);
    } catch (e) {
      obavesti(e.message, 'greska');
      if (nazivRef.current) nazivRef.current.focus();
    }
  }

  function tasterUred(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); sacuvaj(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); zatvori(ured.id); }
  }

  async function obrisi(s) {
    if (!window.confirm(`Obrisati „${s.naziv}“?`)) return;
    try {
      await gim.sifarnici.obrisi(vrsta, s.id);
      obavesti('Obrisano.');
      await ucitaj();
    } catch (e) {
      obavesti(e.message, 'greska');
    }
  }

  async function dodaj() {
    const naziv = noviNaziv.trim();
    if (naziv === '') { if (dodajNazivRef.current) dodajNazivRef.current.focus(); return; }
    if (zauzeto.current) return;
    zauzeto.current = true;
    try {
      await gim.sifarnici.dodaj(vrsta, { naziv, skracenica: sprava ? novaSkr.trim().toUpperCase() : '', ikona: '' });
      obavesti('Dodato.');
      postaviNoviNaziv('');
      postaviNovuSkr('');
      await ucitaj();
      const polje = sprava ? dodajSkrRef.current : dodajNazivRef.current;
      if (polje) polje.focus();
    } catch (e) {
      obavesti(e.message, 'greska');
    } finally {
      zauzeto.current = false;
    }
  }

  function tasterDodaj(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); dodaj(); }
  }

  async function posaljiRedosled(ids, fokus) {
    try {
      await gim.sifarnici.redosled(vrsta, ids);
      obavesti('Redosled sačuvan.');
    } catch (e) {
      obavesti(e.message, 'greska');
    }
    if (fokus !== undefined) fokusId.current = fokus;
    await ucitaj();
  }

  // Alt+gore/dole na fokusiranoj stavki (ne u polju za izmenu).
  function tasterStavka(ev, s) {
    if (ev.target !== ev.currentTarget || !ev.altKey) return;
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    const ids = stavke.map((x) => x.id);
    const novi = pomeri(ids, s.id, ev.key === 'ArrowUp' ? -1 : 1);
    if (novi === ids) return;
    postaviStavke(novi.map((id) => stavke.find((x) => x.id === id)));
    posaljiRedosled(novi, s.id);
  }

  function naPocetakVucenja(ev, s) {
    vuceId.current = s.id;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', String(s.id));
    ev.currentTarget.classList.add('kartica-vuci');
  }

  // Uzivo premesta vucenu stavku iznad ili ispod cilja, po polovini kursora.
  function naPreko(ev, s) {
    if (vuceId.current === null) return;
    ev.preventDefault();
    if (vuceId.current === s.id) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const ispod = ev.clientY > r.top + r.height / 2;
    postaviStavke((tr) => {
      const vucena = tr.find((x) => x.id === vuceId.current);
      if (!vucena) return tr;
      const bez = tr.filter((x) => x.id !== vuceId.current);
      const i = bez.findIndex((x) => x.id === s.id);
      const nova = bez.slice();
      nova.splice(ispod ? i + 1 : i, 0, vucena);
      return nova.every((x, k) => x === tr[k]) ? tr : nova;
    });
  }

  function naKrajVucenja(ev) {
    ev.currentTarget.classList.remove('kartica-vuci');
    if (vuceId.current === null) return;
    vuceId.current = null;
    posaljiRedosled(stavkeRef.current.map((x) => x.id));
  }

  const izborIkone = ikone.map((i) => [i, i.replace(/^sprava-/, '')]);

  return (
    <section className="kartica" ref={kartRef} style={{ ...sirina, overflow: 'hidden' }} data-vrsta={vrsta} data-sprava={sprava ? '1' : '0'}>
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">{meta.naziv}</h2>
        <span className="broj sivo brojac" style={{ fontSize: 13, fontWeight: 600 }}>{stavke.length}</span>
      </div>
      <ul className="lista-stavki">
        {stavke.map((s) => {
          const u = ured.id === s.id;
          return (
            <li key={s.id} className={u ? 'stavka uredjuje' : 'stavka'} draggable={!u} tabIndex={0} data-id={s.id}
              onKeyDown={(ev) => tasterStavka(ev, s)}
              onDoubleClick={(ev) => { if (!u && !ev.target.closest('input,select,button')) otvori(s); }}
              onDragStart={(ev) => naPocetakVucenja(ev, s)} onDragOver={(ev) => naPreko(ev, s)} onDragEnd={naKrajVucenja}>
              <span className="hvataljka" title="Prevuci za redosled"><Ikona ime="hvataljka" velicina={16} /></span>
              {u ? (
                <span className="uredi-red" onKeyDown={tasterUred}>
                  {sprava && (
                    <input type="text" className="unos broj u-skr" aria-label="Skraćenica" maxLength={4}
                      style={{ width: 56, flex: 'none', height: 34, textTransform: 'uppercase' }}
                      value={ured.skr} onChange={promeniUred('skr')} />
                  )}
                  {sprava && (
                    <select className="unos u-ikona" aria-label="Ikona" style={{ width: 118, flex: 'none', height: 34 }}
                      value={ured.ikona} onChange={promeniUred('ikona')}>
                      <option value="">bez ikone</option>
                      {izborIkone.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  )}
                  <input type="text" className="unos u-naziv" aria-label="Naziv" style={{ height: 34 }}
                    ref={nazivRef} value={ured.naziv} onChange={promeniUred('naziv')} />
                  <button type="button" className="dugme dugme-glavno dugme-malo" onClick={sacuvaj}>Sačuvaj</button>
                </span>
              ) : (
                <>
                  {sprava && (
                    <>
                      <span className="stavka-ikona">{s.ikona ? <Ikona ime={s.ikona} velicina={20} /> : null}</span>
                      <span className="stavka-skr broj">{s.skracenica}</span>
                    </>
                  )}
                  <span className="stavka-naziv">{s.naziv}</span>
                  <button type="button" className="dugme dugme-ikona izmeni" aria-label="Izmeni" style={{ width: 28, height: 28 }}
                    onClick={() => otvori(s)}><Ikona ime="olovka" velicina={16} /></button>
                  <button type="button" className="dugme dugme-ikona obrisi" aria-label="Obriši" style={{ width: 28, height: 28 }}
                    onClick={() => obrisi(s)}><Ikona ime="kanta" velicina={16} /></button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="dodaj" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10 }}>
        {sprava && (
          <input type="text" className="unos broj skr" placeholder="Skr." aria-label="Skraćenica" maxLength={4}
            style={{ width: 56, flex: 'none', padding: '0 8px', textTransform: 'uppercase' }}
            ref={dodajSkrRef} value={novaSkr} onChange={(ev) => postaviNovuSkr(ev.target.value)} onKeyDown={tasterDodaj} />
        )}
        <input type="text" className="unos naziv" placeholder={NAZIV_NOVE[vrsta]} aria-label="Naziv" style={{ minWidth: 0 }}
          ref={dodajNazivRef} value={noviNaziv} onChange={(ev) => postaviNoviNaziv(ev.target.value)} onKeyDown={tasterDodaj} />
        <button type="button" className="dugme dodaj-dugme" onClick={dodaj}>Dodaj</button>
      </div>
    </section>
  );
}
