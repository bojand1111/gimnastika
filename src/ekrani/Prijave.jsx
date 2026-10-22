import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import { razlozi } from '../ruter.js';
import Koraci from '../komponente/Koraci.jsx';
import DijalogTakmicar from '../komponente/DijalogTakmicar.jsx';
import BazaTakmicara from './prijave/BazaTakmicara.jsx';
import TabelaPrijava from './prijave/TabelaPrijava.jsx';
import { najavi, obavesti } from '../okvir/Poruke.jsx';
import { porukaDalje } from './prijaveFilter.js';
import { poljaUcesca } from '../../electron/racun/priprema.mjs';
import * as uvozStanje from '../uvozStanje.js';

const NEMA_AKTIVNOG = 'Nema aktivnog takmičenja.';
const polIzHasha = () => {
  const p = razlozi(location.hash).parametri.pol;
  return p === 'M' || p === 'Z' ? p : '';
};

// Ekran Prijave aktivnog takmicenja (POPIS 6): ucitava sve jednim pozivom i posle radnji ponovo cita.
export default function Prijave() {
  const [pol, postaviPol] = useState(polIzHasha);
  const [d, postaviD] = useState(null);
  const [klub, postaviKlubDrzac] = useState('');
  const [izabranId, postaviIzabran] = useState(null);
  const [reset, postaviReset] = useState(0);
  const mounted = useRef(true);
  const radi = useRef({ dodaj: false, startni: false });
  const klubRef = useRef('');
  const polRef = useRef(pol);
  const brojac = useRef(0);
  const dijalog = useRef(null);
  const fokusId = useRef(null);

  // Filter kluba desno; pamti se po takmicenju u sessionStorage (briše se za "Svi klubovi").
  const postaviKlub = useCallback((k, takmId) => {
    klubRef.current = k;
    postaviKlubDrzac(k);
    if (takmId != null) {
      if (k === '') sessionStorage.removeItem(`prijave-klub-${takmId}`);
      else sessionStorage.setItem(`prijave-klub-${takmId}`, k);
    }
  }, []);

  // Sacuvani klub se vraca samo ako klub jos ima prijave, inace se kljuc brise.
  const uskladiKlub = useCallback((p) => {
    const kljuc = `prijave-klub-${p.takm.id}`;
    const k = klubRef.current || sessionStorage.getItem(kljuc) || '';
    if (k !== '' && p.stanje.redosled_klubova.map(String).includes(k)) { postaviKlub(k); return; }
    postaviKlub('', k !== '' ? p.takm.id : null);
  }, [postaviKlub]);

  const nemaAktivnog = useCallback((e) => {
    if (!mounted.current) return true;
    if (!String(e.message).startsWith(NEMA_AKTIVNOG)) return false;
    najavi('Prvo izaberite aktivno takmičenje.', 'upozorenje');
    location.hash = '#/takmicenja';
    return true;
  }, []);

  // Sve podatke ekrana ucitava iznova; zastarel odgovor se odbacuje.
  const ucitaj = useCallback(async (p = polRef.current) => {
    const moj = ++brojac.current;
    try {
      const podaci = await gim.prijave.podaci(p || null);
      if (moj !== brojac.current) return null;
      if (!mounted.current) return null;
      postaviD({ ...podaci, polPodaci: p });
      uskladiKlub(podaci);
      return podaci;
    } catch (e) {
      if (moj !== brojac.current || !mounted.current) return null;
      if (!nemaAktivnog(e)) obavesti(e.message, 'greska');
      return null;
    }
  }, [uskladiKlub, nemaAktivnog]);

  useEffect(() => {
    const naHash = () => { if (location.hash.startsWith('#/prijave')) postaviPol(polIzHasha()); };
    window.addEventListener('hashchange', naHash);
    return () => window.removeEventListener('hashchange', naHash);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { polRef.current = pol; ucitaj(pol); }, [pol, ucitaj]);

  // Posle novog takmicara: izabran red, centriran, fokus na prvu spravu.
  useEffect(() => {
    if (fokusId.current == null || !d) return;
    const tr = document.querySelector(`#tabela-prijave tr[data-id="${fokusId.current}"]`);
    fokusId.current = null;
    if (!tr) return;
    tr.scrollIntoView({ block: 'center' });
    const prvo = tr.querySelector('.sprava-dugme');
    if (prvo) prvo.focus();
  }, [d]);

  // Sveze stanje pripreme za traku koraka, bez ponovnog citanja cele liste.
  const osveziStanje = useCallback(async () => {
    try {
      const s = await gim.prijave.stanje();
      postaviD((x) => (x ? { ...x, stanje: s, ukupno: s.prijava } : x));
    } catch (e) { obavesti(`Prikaz stanja nije osvežen: ${e.message}`, 'upozorenje'); }
  }, []);

  const izmeniRed = (id, deo) => postaviD((x) => ({ ...x, prijave: x.prijave.map((p) => (p.id === id ? { ...p, ...deo } : p)) }));

  async function dodaj(ids) {
    if (!ids.length) { obavesti('Označite bar jednog takmičara.', 'upozorenje'); return false; }
    if (radi.current.dodaj) return false;
    radi.current.dodaj = true;
    try {
      const r = await gim.prijave.dodaj(ids);
      await ucitaj();
      obavesti(`Prijavljeno: ${r.dodato}.${r.preskoceno.length ? ` Preskočeno: ${r.preskoceno.join('; ')}.` : ''}`);
      return true;
    } catch (e) { obavesti(e.message, 'greska'); return false; } finally { radi.current.dodaj = false; }
  }

  // Greska se prikazuje ovde i baca dalje (polje startnog broja je oznacava crveno).
  async function izmeni(id, polje, vrednost) {
    try {
      const r = await gim.prijave.izmeni(id, polje, vrednost);
      izmeniRed(id, r.prijava);
      obavesti('Sačuvano.');
      if (polje !== 'startni_broj') osveziStanje();
      return r.prijava;
    } catch (e) { obavesti(e.message, 'greska'); throw e; }
  }

  const akcije = {
    // Select ostaje na staroj vrednosti jer je kontrolisan; greska je vec u toastu.
    izmeni: (id, polje, v) => izmeni(id, polje, v === '' ? null : v).catch(() => {}),
    startniBroj: (id, v) => izmeni(id, 'startni_broj', v === '' ? null : v).then((p) => p.startni_broj),
    async sprava(id, spravaId, radi) {
      try {
        await gim.prijave.sprava(id, spravaId, radi);
        const sid = Number(spravaId);
        postaviD((x) => ({ ...x, prijave: x.prijave.map((p) => (p.id !== id ? p : {
          ...p, sprave: radi ? [...p.sprave, sid] : p.sprave.filter((s) => s !== sid) })) }));
        osveziStanje();
      } catch (e) { obavesti(e.message, 'greska'); }
    },
    async ucesce(id, ucesce) {
      try {
        await gim.prijave.ucesce(id, ucesce);
        izmeniRed(id, poljaUcesca(ucesce));
        obavesti('Sačuvano.');
      } catch (e) { obavesti(e.message, 'greska'); }
    },
    async obrisi(id, ime) {
      if (!window.confirm(`Ukloniti prijavu za ${ime}?`)) return;
      try { await gim.prijave.obrisi(id); await ucitaj(); } catch (e) { obavesti(e.message, 'greska'); }
    },
    async potvrda(klubId, potvrdjeno) {
      try {
        await gim.prijave.potvrda(klubId, potvrdjeno);
        await osveziStanje();
        obavesti(potvrdjeno ? 'Spisak kluba je potvrđen.' : 'Potvrda je uklonjena.');
      } catch (e) { obavesti(e.message, 'greska'); }
    },
    async startni() {
      if (radi.current.startni) return;
      radi.current.startni = true;
      try {
        const r = await gim.prijave.startni();
        await ucitaj();
        obavesti(`Dodeljeno startnih brojeva: ${r.dodeljeno}.`);
      } catch (e) { obavesti(e.message, 'greska'); } finally { radi.current.startni = false; }
    },
    async dalje() {
      try {
        const s = await gim.prijave.stanje();
        const poruka = porukaDalje(s);
        if (s.prijava === 0) { obavesti(poruka, 'upozorenje'); return; }
        if (poruka) najavi(poruka, 'upozorenje');
        location.hash = '#/rotacije';
      } catch (e) { obavesti(e.message, 'greska'); }
    },
    async uvoz() {
      try {
        const putanje = await gim.uvoz.izaberiFajlove();
        if (!putanje.length) return;
        const r = await gim.uvoz.pripremi(putanje);
        if (!r.fajlovi.length) { r.greske.forEach((g) => obavesti(g, 'greska')); return; }
        r.greske.forEach((g) => obavesti(g, 'greska'));
        uvozStanje.postavi(r.fajlovi);
        location.hash = '#/uvoz';
      } catch (e) { obavesti(e.message, 'greska'); }
    },
  };

  function otvoriDijalog(klubLevo) {
    if (!d || !dijalog.current || dijalog.current.otvoren()) return;
    dijalog.current.otvori({ klub: klubLevo, pol, idBroj: d.sledeciIdBroj });
  }

  // Novi takmicar: upis u bazu, prijava, pa osvezen prikaz bez filtera pola (kao PHP).
  async function noviTakmicar(unos) {
    const r = await gim.prijave.noviTakmicar(unos);
    dijalog.current.zatvori();
    const ime = `${unos.prezime.trim()} ${unos.ime.trim()}`;
    // Poruka prvo, da je upis vidljiv i kad osvezavanje ne uspe.
    obavesti(r.prijava_id != null
      ? `${ime} je upisan u bazu takmičara i prijavljen. Izaberite sprave i učešće.`
      : `${ime} je upisan u bazu takmičara, ali nije prijavljen: ${r.preskoceno.join('; ')}.`);
    let podaci;
    try { podaci = await gim.prijave.podaci(null); } catch (e) { obavesti(e.message, 'greska'); return; }
    brojac.current += 1;
    postaviD({ ...podaci, polPodaci: '' });
    postaviReset((n) => n + 1);
    if (pol !== '') { polRef.current = ''; postaviPol(''); location.hash = '#/prijave'; }
    if (r.prijava_id != null) {
      const red = podaci.prijave.find((p) => p.id === r.prijava_id);
      if (klubRef.current !== '' && red && String(red.klub_id ?? 0) !== klubRef.current) postaviKlub('', podaci.takm.id);
      fokusId.current = r.prijava_id;
      postaviIzabran(r.prijava_id);
    }
  }

  if (!d) return null;
  const polD = d.polPodaci ?? pol; // pol za koji su podaci ucitani
  return (
    <>
      <Koraci stanje={d.stanje} tekuci="prijave" takmId={Number(d.takm.id)} />
      <div className="red red-rastegni raste" style={{ minHeight: 0 }} id="prijave">
        <BazaTakmicara d={d} pol={polD} naDodaj={dodaj} naNovi={otvoriDijalog} reset={reset} />
        <TabelaPrijava d={d} pol={polD} klub={klub} naKlub={(k) => postaviKlub(k, d.takm.id)}
          izabranId={izabranId} akcije={akcije} />
      </div>
      <DijalogTakmicar ref={dijalog} klubovi={d.klubovi} naSnimi={noviTakmicar} />
    </>
  );
}
