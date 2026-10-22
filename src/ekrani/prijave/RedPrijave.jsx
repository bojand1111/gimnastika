import { useRef, useState } from 'react';
import Ikona from '../../komponente/Ikona.jsx';
import { datumPrikaz } from '../../../electron/racun/datum.mjs';
import { ucesce as ucesceRed, EKIPA, POJEDINAC, VK } from '../../../electron/racun/priprema.mjs';

const UCESCA = [[EKIPA, 'Ekipa', 'Član ekipe'], [POJEDINAC, 'Poj.', 'Pojedinac'], [VK, 'VK', 'Van konkurencije']];
const poStilu = { height: 50 };

// Polje startnog broja: snima na blur (Enter prebacuje fokus na sledece polje, to okida blur).
function StartniBroj({ red, naSnimi }) {
  const ref = useRef(null);
  const [greska, postaviGresku] = useState(false);

  async function snimi() {
    const unos = ref.current.value.trim();
    if (unos === String(red.startni_broj ?? '')) { postaviGresku(false); return; }
    try {
      const novi = await naSnimi(red.id, unos);
      ref.current.value = novi == null ? '' : String(novi);
      postaviGresku(false);
    } catch {
      postaviGresku(true); // poruku je vec prikazao vlasnik (toast)
      if (document.activeElement === document.body) ref.current.focus();
    }
  }

  function naTaster(ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    let tr = ev.currentTarget.closest('tr').nextElementSibling;
    while (tr && !tr.querySelector('.startni-broj')) tr = tr.nextElementSibling;
    ev.currentTarget.blur();
    const sledece = tr && tr.querySelector('.startni-broj');
    if (sledece) { sledece.focus(); sledece.select(); }
  }

  return (
    <input type="text" ref={ref} key={`${red.id}:${red.startni_broj ?? ''}`} defaultValue={red.startni_broj ?? ''}
      className={`unos broj startni-broj ${greska ? 'greska' : ''}`} placeholder="–" aria-label="Startni broj"
      inputMode="numeric" style={{ width: 44, height: 32, padding: 0, textAlign: 'center' }}
      onBlur={snimi} onKeyDown={naTaster} />
  );
}

// Jedan red prijave (POPIS 6.4); sve izmene idu preko akcija iz vlasnika ekrana.
export default function RedPrijave({ p, izabran, kategorije, programi, sprave, pol, akcije }) {
  const ime = `${p.prezime} ${p.ime}`;
  const uc = ucesceRed(p.clan_ekipe, p.van_konkurencije);
  const klase = [p.lek_ne_vazi && 'upozorenje-red', izabran && 'izabran'].filter(Boolean).join(' ');
  const opcije = (lista) => lista.map((k) => <option key={k.id} value={String(k.id)}>{k.naziv}</option>);
  const polje = (naziv, sirina, lista, vrednost) => (
    <select className="unos polje" data-polje={naziv} aria-label={naziv === 'kategorija_id' ? 'Kategorija' : 'Program'}
      style={{ width: sirina, height: 32, padding: '0 4px' }} value={vrednost == null ? '' : String(vrednost)}
      onChange={(ev) => akcije.izmeni(p.id, naziv, ev.target.value)}>
      <option value="">–</option>{opcije(lista)}
    </select>
  );

  return (
    <tr data-id={p.id} data-klub={p.klub_id ?? 0} className={klase} style={poStilu}>
      <td style={poStilu}><StartniBroj red={p} naSnimi={akcije.startniBroj} /></td>
      <td style={poStilu} title={ime}>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '17px', minWidth: 0 }}>
          <span className="ime odseci" style={{ fontWeight: 600 }}>{ime}</span>
          {p.lek_ne_vazi
            ? <span className="odseci" style={{ fontSize: 12, fontWeight: 600, color: 'var(--bad)' }}>
              {p.lekarski_do ? `Lek. do ${datumPrikaz(p.lekarski_do)}` : 'Nema lekarskog'}</span>
            : <span className="mali sivo odseci">
              {p.klub_skr || 'bez kluba'} · {p.godina_rodjenja}{pol === '' ? ` · ${p.pol === 'Z' ? 'Ž' : 'M'}` : ''}</span>}
        </span>
      </td>
      <td style={poStilu}>{polje('kategorija_id', 92, kategorije, p.kategorija_id)}</td>
      <td style={poStilu}>{polje('program_id', 96, programi, p.program_id)}</td>
      <td style={poStilu}>
        <div className="sprave-red">
          {sprave[p.pol].map((s) => {
            const radi = p.sprave.includes(Number(s.id));
            return (
              <button key={s.id} type="button" className="sprava-dugme" aria-pressed={radi ? 'true' : 'false'}
                title={s.naziv} onClick={() => akcije.sprava(p.id, s.id, !radi)}>{s.skracenica}</button>
            );
          })}
        </div>
      </td>
      <td style={poStilu}>
        <div className="izbor izbor-mali ucesce" role="group" aria-label="Učešće">
          {UCESCA.map(([kljuc, kratko, puno]) => (
            <button key={kljuc} type="button" aria-pressed={uc === kljuc ? 'true' : 'false'} title={puno}
              aria-label={puno} onClick={() => { if (uc !== kljuc) akcije.ucesce(p.id, kljuc); }}>{kratko}</button>
          ))}
        </div>
      </td>
      <td className="desno" style={{ ...poStilu, padding: '0 6px 0 0' }}>
        <button type="button" className="dugme dugme-ikona obrisi" aria-label="Ukloni prijavu" title="Ukloni prijavu"
          onClick={() => akcije.obrisi(p.id, ime)}><Ikona ime="kanta" velicina={16} /></button>
      </td>
    </tr>
  );
}
