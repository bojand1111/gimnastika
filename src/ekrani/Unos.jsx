import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import { url } from '../ruter.js';
import Ikona from '../komponente/Ikona.jsx';
import { obavesti } from '../okvir/Poruke.jsx';
import { obradiNemaAktivnog } from './aktivno.js';
import {
  hashUnos, napredakIzRedova, parUnos, pocetniFokus, polja, prvoPraznoPolje,
} from './unosStanje.js';
import { izPodataka, kolone } from './unos/redovi.js';
import { napraviAkcije } from './unos/akcije.js';
import { fokusiraj } from './unos/fokus.js';
import UnosTraka from './unos/UnosTraka.jsx';
import UnosRed from './unos/UnosRed.jsx';
import UnosIzmene from './unos/UnosIzmene.jsx';
import DijalogRazlog from './unos/DijalogRazlog.jsx';

// Parametri hasha (POPIS 10.4): nezadati ostaju undefined, pa IPC bira "gde se stalo". Pola nema: dobija se iz izabranog dela.
const izHasha = () => parUnos(location.hash);
const istiPar = (a, b) => a.sprava === b.sprava && a.rot === b.rot;

// Ekran Unos ocena: ucitava jednim pozivom, redovi se drze lokalno (POPIS 10.3).
export default function Unos() {
  const [d, postaviD] = useState(null);
  const [redovi, postaviRedove] = useState([]);
  const [trenutniId, postaviTrenutniId] = useState(null);
  const [greskaUcitavanja, postaviGresku] = useState(false);
  const [fokusBr, postaviFokusBr] = useState(0);
  const ziv = useRef(true);
  const dRef = useRef(null);
  const redoviRef = useRef([]);
  const trenutniRef = useRef(null);
  const parRef = useRef(izHasha());
  const brojac = useRef(0);
  const fokusRef = useRef(null);
  const dijalog = useRef(null);
  const akcijeRef = useRef(null);
  dRef.current = d;

  const postaviTrenutni = (id) => { trenutniRef.current = id; postaviTrenutniId(id); };
  const zatrazi = (z) => { fokusRef.current = z; postaviFokusBr((n) => n + 1); };

  // Pocetni fokus: zapamcena prijava ako je jos nacrt, inace prvi nacrt; u njemu prvo prazno polje.
  const pocetni = (novi, pamti, brojSudija) => {
    const i = pocetniFokus(novi, pamti);
    return i === null ? null : { id: novi[i].prijava_id, polje: prvoPraznoPolje(novi[i], polja(brojSudija)) };
  };

  // Ucitava ekran iznova; opc.drzi = {id, polje} zadrzava fokus na redu, opc.pamti = prijava za pocetni fokus.
  const ucitaj = useCallback(async (opc = {}) => {
    await akcijeRef.current.isprazniNacrte();
    const moj = ++brojac.current;
    const { sprava, rot } = parRef.current;
    try {
      const podaci = await gim.unos.podaci(sprava, rot);
      if (moj !== brojac.current || !ziv.current) return;
      const novi = izPodataka(podaci);
      redoviRef.current = novi;
      postaviRedove(novi);
      postaviD(podaci);
      postaviGresku(false);
      const ima = Boolean(podaci.sprava);
      parRef.current = { sprava: ima ? String(podaci.sprava.id) : undefined, rot: String(podaci.rot) };
      // Izabrane vrednosti u hash bez novog ucitavanja (replaceState ne okida hashchange).
      const hash = hashUnos(ima ? podaci.sprava.id : undefined, ima ? podaci.rot : undefined);
      if (location.hash.startsWith('#/unos') && location.hash !== hash) history.replaceState(null, '', hash);
      const z = opc.drzi ?? pocetni(novi, opc.pamti ?? null, podaci.brojSudija);
      if (z) { postaviTrenutni(z.id); zatrazi(z); }
      else if (!novi.some((r) => r.prijava_id === trenutniRef.current)) postaviTrenutni(null);
    } catch (e) {
      if (moj !== brojac.current || !ziv.current) return;
      if (!obradiNemaAktivnog(e)) {
        obavesti(e.message, 'greska');
        if (!dRef.current) postaviGresku(true);
      }
    }
  }, []);

  if (!akcijeRef.current) {
    akcijeRef.current = napraviAkcije({
      redovi: () => redoviRef.current,
      postaviRedove: (n) => { redoviRef.current = n; postaviRedove(n); },
      d: () => dRef.current,
      ziv: () => ziv.current,
      ucitaj: (opc) => ucitaj(opc),
      zatrazi,
      trenutni: () => trenutniRef.current,
      postaviTrenutni,
      dijalog: () => dijalog.current,
    });
  }
  const akcije = akcijeRef.current;

  useEffect(() => {
    ziv.current = true;
    ucitaj();
    const naHash = () => {
      akcije.izlazAktivnog(); // kucani unos se snima pre odlaska ili ponovnog ucitavanja
      if (!location.hash.startsWith('#/unos')) return;
      const n = izHasha();
      if (istiPar(n, parRef.current)) return;
      parRef.current = n;
      postaviTrenutni(null);
      ucitaj();
    };
    window.addEventListener('hashchange', naHash);
    document.addEventListener('keydown', akcije.globalniTaster);
    // Pre promene dela (MSG/ZSG) nacrti se salju dok je jos staro takmicenje aktivno.
    const prePol = (ev) => { akcije.izlazAktivnog(); ev.detail.cekaj.push(akcije.isprazniNacrte()); };
    document.addEventListener('app:pre-pol', prePol);
    return () => {
      document.removeEventListener('app:pre-pol', prePol);
      window.removeEventListener('hashchange', naHash);
      document.removeEventListener('keydown', akcije.globalniTaster);
      akcije.izlazAktivnog();
      akcije.isprazniNacrte(); // nacrt na cekanju se salje i pri odlasku sa ekrana
      ziv.current = false;
    };
  }, []);

  // Fokus se primenjuje tek posle rendera (polja mogu biti tek otkljucana ili ponovo ucitana).
  useEffect(() => {
    const z = fokusRef.current;
    if (!z) return;
    fokusRef.current = null;
    fokusiraj(z.id, z.polje);
  }, [fokusBr]);

  if (!d) {
    if (!greskaUcitavanja) return null;
    return (
      <div className="prazno-stanje" role="alert">
        <p>Unos ocena nije učitan.</p>
        <button type="button" className="dugme" data-fokus onClick={() => { postaviGresku(false); ucitaj(); }}>Pokušaj ponovo</button>
      </div>
    );
  }

  const { sprava, grupa, rot, pol, brojSudija } = d;
  const mreza = kolone(brojSudija);
  const odbaci = d.pravilo === 'odbaci_krajnje';
  let telo;
  if (!sprava) {
    telo = <div className="kartica"><div className="prazno-stanje"><h2>Nema sprava u ovom delu</h2><p>Dodajte sprave u Podešavanjima.</p></div></div>;
  } else if (!grupa) {
    telo = (
      <div className="kartica"><div className="prazno-stanje">
        <h2>{`Nijedna grupa nije na spravi ${sprava.naziv} u rotaciji ${rot}`}</h2>
        <p>Proverite početne sprave grupa na ekranu Rotacije.</p>
        <a href={url('rotacije', { rot })} className="dugme">Rotacije</a>
      </div></div>
    );
  } else {
    const pravilo = odbaci ? 'E = prosek srednjih ocena (odbacuju se najviša i najniža)' : 'E = prosek svih ocena';
    telo = (
      <>
        <section className="kartica raste unos-kartica" id="unos" data-sprava={sprava.id} data-sudija={brojSudija} data-pravilo={d.pravilo}
          data-zaokruzivanje={d.zaokruzivanje} data-pol={pol}>
          <div className="unos-naslov-red">
            <h2 className="unos-naslov">{sprava.ikona !== '' && <Ikona ime={sprava.ikona} velicina={24} />}<span>{`${sprava.naziv} · Rotacija ${rot} · ${grupa.naziv}`}</span></h2>
            <span className="sivo mali">{`Konačna = D + E − odbitak · ${pravilo}${d.bezGrupa ? ' · nema grupa, prikazani su svi prijavljeni' : ''}`}</span>
          </div>
          <div className="kartica-skrol" role="table" aria-label="Unos ocena">
            <div className="unos-zaglavlje" role="row" style={{ gridTemplateColumns: mreza }}>
              <span className="centar">#</span><span>St. br.</span><span>Takmičar</span><span className="centar">D</span>
              {polja(brojSudija).slice(1, -1).map((p) => <span className="centar" key={p}>{p.toUpperCase()}</span>)}
              <span className="centar">E</span><span className="centar">Odb.</span><span className="desno">Konačna</span><span className="desno">Status</span>
            </div>
            {redovi.length === 0 && <div className="prazno">Grupa je prazna.</div>}
            {redovi.map((r) => (
              <UnosRed key={r.prijava_id} red={r} brojSudija={brojSudija} trenutni={trenutniId === r.prijava_id} kolone={mreza} h={akcije.h} />
            ))}
          </div>
        </section>
        <UnosIzmene izmene={d.izmene} />
      </>
    );
  }
  return (
    <>
      <UnosTraka d={d} napredak={napredakIzRedova(redovi)} />
      {telo}
      <DijalogRazlog ref={dijalog} />
    </>
  );
}
