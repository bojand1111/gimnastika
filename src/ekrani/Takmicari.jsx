import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gim from '../gim.js';
import Ikona from '../komponente/Ikona.jsx';
import Polje from '../komponente/Polje.jsx';
import DatumPolje from '../komponente/DatumPolje.jsx';
import IzborPola from '../komponente/IzborPola.jsx';
import Tabela from '../komponente/Tabela.jsx';
import { Greske, obavesti } from '../okvir/Poruke.jsx';
import { vidljiv, lekarskiPoruka } from './takmicariFilter.js';
import { datumPrikaz, danas } from '../../electron/racun/datum.mjs';
import { lekarski, lekarskiOznaka } from '../../electron/racun/lekarski.mjs';

const PRAZNA = {
  id_broj: '', ime: '', prezime: '', godina_rodjenja: '', pol: '', klub_id: '', drzavljanstvo: 'Srbija',
  lekarski_do: '', broj_licence: '', trener: '', kontakt_roditelja: '',
};
const POLOVI_FILTER = [{ vrednost: '', tekst: 'Svi' }, { vrednost: 'M', tekst: 'M' }, { vrednost: 'Z', tekst: 'Ž' }];
const POLOVI_FORMA = [{ vrednost: 'M', tekst: 'Muški' }, { vrednost: 'Z', tekst: 'Ženski' }];

// Red iz baze u vrednosti forme (sve tekst; lekarski kao dd.mm.gggg.).
function uFormu(r) {
  return {
    id_broj: r.id_broj ?? '', ime: r.ime ?? '', prezime: r.prezime ?? '',
    godina_rodjenja: r.godina_rodjenja ? String(r.godina_rodjenja) : '', pol: r.pol ?? '',
    klub_id: r.klub_id == null ? '' : String(r.klub_id), drzavljanstvo: r.drzavljanstvo ?? '',
    lekarski_do: datumPrikaz(r.lekarski_do), broj_licence: r.broj_licence ?? '',
    trener: r.trener ?? '', kontakt_roditelja: r.kontakt_roditelja ?? '',
  };
}

export default function Takmicari() {
  const [takmicari, postaviTakmicare] = useState([]);
  const [klubovi, postaviKlubove] = useState([]);
  const [prag, postaviPrag] = useState(30);
  const [izabranId, postaviIzabran] = useState(null);
  const [forma, postaviFormu] = useState(PRAZNA);
  const [greske, postaviGreske] = useState([]);
  const [filter, postaviFilter] = useState({ upit: '', klub: '', pol: '', god: '' });
  const formaRef = useRef(null);
  const idRef = useRef(null);

  // Lista se uvek cita ponovo iz baze.
  const ucitaj = useCallback(async () => {
    try {
      const lista = await gim.takmicari.svi();
      postaviTakmicare(lista);
      return lista;
    } catch (e) { obavesti(e.message, 'greska'); return []; }
  }, []);

  useEffect(() => {
    ucitaj();
    (async () => {
      try {
        postaviKlubove(await gim.klubovi.svi());
        const p = Number((await gim.podesavanja.sva()).lekarski_prag_dana);
        if (Number.isFinite(p)) postaviPrag(p);
      } catch (e) { obavesti(e.message, 'greska'); }
    })();
  }, [ucitaj]);

  const fokusId = () => { if (idRef.current) idRef.current.focus(); };

  const izaberi = useCallback((r) => {
    postaviIzabran(r.id);
    postaviFormu(uFormu(r));
    postaviGreske([]);
  }, []);

  const novi = useCallback(() => {
    postaviIzabran(null);
    postaviFormu(PRAZNA);
    postaviGreske([]);
    if (idRef.current) idRef.current.focus();
  }, []);

  useEffect(() => {
    fokusId(); // novi takmicar: fokus na ID broj pri otvaranju
    const naNovi = () => novi();
    const naOtkazi = () => {
      const a = document.activeElement;
      if (a && formaRef.current && formaRef.current.contains(a)) novi();
    };
    document.addEventListener('app:novi', naNovi);
    document.addEventListener('app:otkazi', naOtkazi);
    return () => {
      document.removeEventListener('app:novi', naNovi);
      document.removeEventListener('app:otkazi', naOtkazi);
    };
  }, [novi]);

  const vidljivi = useMemo(() => takmicari.filter((r) => vidljiv(r, filter)), [takmicari, filter]);
  const godista = useMemo(
    () => [...new Set(takmicari.map((r) => Number(r.godina_rodjenja)))].sort((a, b) => b - a), [takmicari]);
  const poruka = lekarskiPoruka(forma.lekarski_do, prag, danas());

  const promeni = (polje) => (ev) => postaviFormu((f) => ({ ...f, [polje]: ev.target.value }));
  const postaviPol = (pol) => postaviFormu((f) => ({ ...f, pol }));
  const filtriraj = (polje) => (ev) => postaviFilter((f) => ({ ...f, [polje]: ev.target.value }));

  async function sacuvaj(ev) {
    ev.preventDefault();
    if (forma.pol !== 'M' && forma.pol !== 'Z') {
      obavesti('Izaberite pol.', 'greska');
      const prvo = document.querySelector('#izbor-pol button');
      if (prvo) prvo.focus();
      return;
    }
    try {
      const { id } = await gim.takmicari.sacuvaj({ ...forma }, izabranId);
      const lista = await ucitaj();
      const r = lista.find((x) => x.id === id);
      postaviIzabran(id);
      postaviGreske([]);
      if (r) postaviFormu(uFormu(r));
      obavesti(`Takmičar ${r ? r.prezime : forma.prezime.trim()} ${r ? r.ime : forma.ime.trim()} je sačuvan.`);
    } catch (e) {
      postaviGreske([e.message]); // vrednosti ostaju, lekarski kako je kucano
    }
  }

  async function obrisi() {
    const r = takmicari.find((x) => x.id === izabranId);
    if (!r) return;
    if (!window.confirm(`Obrisati takmičara ${r.prezime} ${r.ime} (ID ${r.id_broj})?`)) return;
    try {
      await gim.takmicari.obrisi(r.id);
      obavesti('Takmičar je obrisan.');
      await ucitaj();
      novi();
    } catch (e) {
      obavesti(e.message, 'greska');
    }
  }

  // ArrowDown iz pretrage: izaberi i fokusiraj prvi vidljivi red.
  function izPretrage(ev) {
    if (ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    if (!vidljivi.length) return;
    izaberi(vidljivi[0]);
    const tr = document.querySelector(`#tabela tr[data-id="${vidljivi[0].id}"]`);
    if (tr) tr.focus();
  }

  const kolone = [
    { naslov: 'ID', sirina: 70, celija: (r) => <span className="sifra">{r.id_broj}</span> },
    { naslov: 'Prezime i ime', celija: (r) => `${r.prezime} ${r.ime}` },
    { naslov: 'God.', sirina: 66, celija: (r) => <span className="broj">{r.godina_rodjenja}</span> },
    { naslov: 'Pol', sirina: 48, celija: (r) => (r.pol === 'Z' ? 'Ž' : r.pol) },
    { naslov: 'Klub', sirina: 62, celija: (r) => <span className="skr">{r.klub_skr ?? ''}</span> },
    {
      naslov: 'Lekarski važi do', sirina: 292,
      celija: (r) => {
        const oz = lekarskiOznaka(lekarski(r.lekarski_do, prag, danas()));
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="broj">{datumPrikaz(r.lekarski_do)}</span>
            {oz.tekst && <span className={`status ${oz.klasa}`}><Ikona ime="upozorenje" velicina={13} />{oz.tekst}</span>}
          </span>
        );
      },
    },
  ];

  const izabran = takmicari.find((x) => x.id === izabranId);
  const bojaPoruke = poruka.klasa === 'greska'
    ? { background: 'var(--bad-soft)', color: 'var(--bad)' }
    : { background: 'var(--warn-soft)', color: 'var(--warn)' };

  return (
    <div className="red red-rastegni raste" style={{ minHeight: 0 }}>
      <section className="kartica raste" style={{ overflow: 'hidden' }}>
        <div className="kartica-zaglavlje">
          <h2 className="kartica-naslov">Takmičari u bazi</h2>
          <button type="button" className="dugme dugme-glavno" id="novi" onClick={novi}>
            <Ikona ime="plus" velicina={16} /><span>Novi takmičar</span><kbd>Alt+N</kbd>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
          <label className="pretraga raste">
            <span className="ikona-pretraga" style={{ display: 'flex' }}><Ikona ime="pretraga" velicina={16} /></span>
            <input type="text" className="unos" id="pretraga" value={filter.upit}
              onChange={filtriraj('upit')} onKeyDown={izPretrage}
              placeholder="Pretraga: ime, prezime ili ID" aria-label="Pretraga" autoComplete="off" />
          </label>
          <select className="unos" id="f-klub" aria-label="Klub" style={{ width: 138 }}
            value={filter.klub} onChange={filtriraj('klub')}>
            <option value="">Svi klubovi</option>
            {klubovi.map((k) => <option key={k.id} value={String(k.id)}>{k.skracenica}</option>)}
          </select>
          <IzborPola id="f-pol" oznaka="Pol" opcije={POLOVI_FILTER} vrednost={filter.pol}
            naPromenu={(pol) => postaviFilter((f) => ({ ...f, pol }))} />
          <select className="unos" id="f-god" aria-label="Godište" style={{ width: 128 }}
            value={filter.god} onChange={filtriraj('god')}>
            <option value="">Sva godišta</option>
            {godista.map((g) => <option key={g} value={String(g)}>{g}</option>)}
          </select>
        </div>
        <div className="kartica-skrol">
          <Tabela id="tabela" kolone={kolone} redovi={vidljivi} izabranId={izabranId}
            naIzbor={izaberi} naOtvori={fokusId}
            prazno={takmicari.length === 0 ? 'Još nema takmičara. Dodajte prvog u kartonu desno.' : null} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, padding: '0 16px', fontSize: 13, color: 'var(--muted)', flexShrink: 0, borderTop: '1px solid var(--line)' }}>
          <span id="brojac">Prikazano {vidljivi.length} od {takmicari.length} takmičara</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <kbd>↑</kbd><kbd>↓</kbd><span>izbor reda</span><kbd>Enter</kbd><span>otvori karton</span>
          </span>
        </div>
      </section>

      <section className="kartica" style={{ width: 400, flexShrink: 0, overflow: 'auto' }}>
        <div className="kartica-zaglavlje">
          <h2 className="kartica-naslov" id="naslov-forme">{izabranId ? 'Karton takmičara' : 'Novi takmičar'}</h2>
          <span className="broj sek" style={{ fontSize: 13, fontWeight: 600 }} id="naslov-id">
            {izabran ? `ID ${izabran.id_broj}` : ''}
          </span>
        </div>
        <form className="forma" id="forma" ref={formaRef} onSubmit={sacuvaj} style={{ padding: '14px 16px 16px', gap: 10 }}>
          <Greske greske={greske} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <Polje oznaka="ID broj" id="f-id_broj" klasa="broj" stil={{ width: 110, flex: 'none' }} unosRef={idRef}
              value={forma.id_broj} onChange={promeni('id_broj')} required />
            <div className="polje"><span className="oznaka">Pol</span>
              <IzborPola id="izbor-pol" oznaka="Pol" opcije={POLOVI_FORMA} vrednost={forma.pol} naPromenu={postaviPol} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Polje oznaka="Ime" id="f-ime" poljeKlasa="raste" value={forma.ime} onChange={promeni('ime')} required />
            <Polje oznaka="Prezime" id="f-prezime" poljeKlasa="raste" value={forma.prezime} onChange={promeni('prezime')} required />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Polje oznaka="Godina rođenja" id="f-godina_rodjenja" klasa="broj" stil={{ width: 110, flex: 'none' }}
              value={forma.godina_rodjenja} onChange={promeni('godina_rodjenja')}
              inputMode="numeric" pattern="\d{4}" required />
            <Polje oznaka="Državljanstvo" id="f-drzavljanstvo" poljeKlasa="raste"
              value={forma.drzavljanstvo} onChange={promeni('drzavljanstvo')} />
          </div>
          <label className="polje"><span className="oznaka">Klub</span>
            <select className="unos" id="f-klub_id" value={forma.klub_id} onChange={promeni('klub_id')}>
              <option value="">Bez kluba</option>
              {klubovi.map((k) => <option key={k.id} value={String(k.id)}>{k.puno_ime}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <DatumPolje oznaka="Lekarski važi do" id="f-lekarski_do" klasa={poruka.klasa} stil={{ width: 150, flex: 'none' }}
              value={forma.lekarski_do} placeholder="dd.mm.gggg"
              naPromenu={(v) => postaviFormu((f) => ({ ...f, lekarski_do: v }))} />
            <div id="lekarski-poruka" className={`raste ${poruka.tekst ? '' : 'sakriveno'}`}
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '6px 10px', borderRadius: 8, fontSize: 13, lineHeight: '16px', fontWeight: 600, ...bojaPoruke }}>
              <Ikona ime="upozorenje" velicina={16} /><span id="lekarski-tekst">{poruka.tekst}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            <span className="meni-grupa" style={{ padding: 0 }}>Opciono</span>
            <span style={{ flexGrow: 1, height: 1, background: 'var(--line)' }}></span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Polje oznaka="Broj licence" id="f-broj_licence" klasa="broj" stil={{ width: 150, flex: 'none' }}
              value={forma.broj_licence} onChange={promeni('broj_licence')} placeholder="Nije uneto" />
            <Polje oznaka="Trener" id="f-trener" poljeKlasa="raste" value={forma.trener} onChange={promeni('trener')} />
          </div>
          <Polje oznaka="Kontakt roditelja" id="f-kontakt_roditelja" value={forma.kontakt_roditelja}
            onChange={promeni('kontakt_roditelja')} placeholder="Ime i telefon" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <button type="submit" className="dugme dugme-glavno"><span>Sačuvaj</span><kbd>Enter</kbd></button>
            <button type="button" className="dugme" id="otkazi" onClick={novi}><span>Otkaži</span><kbd>Esc</kbd></button>
            <span style={{ flexGrow: 1 }}></span>
            <button type="button" className={`dugme dugme-opasno ${izabranId ? '' : 'sakriveno'}`} id="obrisi" onClick={obrisi}>
              <Ikona ime="kanta" velicina={16} /><span>Obriši</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
