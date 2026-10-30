import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Koraci from '../komponente/Koraci.jsx';
import { najavi, obavesti } from '../okvir/Poruke.jsx';
import { obradiNemaAktivnog } from './aktivno.js';
import { indeksZaAltStrelice, parRotacije, premestiLokalno } from './rotacijeStanje.js';
import RotTraka from './rotacije/RotTraka.jsx';
import RotKolona from './rotacije/RotKolona.jsx';
import RotPodnozje from './rotacije/RotPodnozje.jsx';
import DijalogGrupa from './rotacije/DijalogGrupa.jsx';

// Parametri iz hasha: rot, kp (POPIS 4.2); pola nema, ekran prikazuje izabrani deo.
const izHasha = () => parRotacije(location.hash);

const bezVucene = (lista, vuceId) => lista.filter((c) => c.prijava_id !== vuceId);

// Ekran Rotacije (POPIS 6): učitava jednim pozivom, kartice se premeštaju odmah pa se šalje na server.
export default function Rotacije() {
  const [par, postaviPar] = useState(izHasha);
  const [d, postaviD] = useState(null);
  const [izabranId, postaviIzabran] = useState(null);
  const [vuceId, postaviVuceId] = useState(null);
  const [senka, postaviSenku] = useState(null); // {grupaId, pre, cilj}
  const [greskaUcitavanja, postaviGresku] = useState(false);
  const ziv = useRef(true);
  const dRef = useRef(null);
  const brojac = useRef(0);
  const parRef = useRef(par);
  const vuceRef = useRef(null);
  const senkaRef = useRef(null);
  const izabranRef = useRef(null);
  const fokusId = useRef(null);
  const radi = useRef(false);
  const uLetu = useRef(0); // premestanja ciji IPC jos traje
  const odlozeno = useRef(false); // ucitavanje preskoceno zbog premestanja u toku
  const dijalog = useRef(null);

  dRef.current = d;
  izabranRef.current = izabranId;
  parRef.current = par;

  // Sve podatke ekrana ucitava iznova; zastareo odgovor se odbacuje.
  const ucitaj = useCallback(async () => {
    const moj = ++brojac.current;
    const { rot } = parRef.current;
    try {
      const podaci = await gim.rotacije.podaci(rot);
      if (moj !== brojac.current || !ziv.current) return;
      if (uLetu.current > 0) { odlozeno.current = true; return; } // zastareo odgovor bi pregazio lokalno stanje
      postaviD(podaci);
      postaviGresku(false);
    } catch (e) {
      if (moj !== brojac.current || !ziv.current) return;
      if (!obradiNemaAktivnog(e)) {
        obavesti(e.message, 'greska');
        if (!dRef.current) postaviGresku(true);
      }
    }
  }, []);

  useEffect(() => { ziv.current = true; return () => { ziv.current = false; }; }, []);
  useEffect(() => {
    const naHash = () => {
      if (!location.hash.startsWith('#/rotacije')) return;
      const n = izHasha();
      postaviPar((p) => (p.rot === n.rot && p.kp === n.kp ? p : n));
    };
    window.addEventListener('hashchange', naHash);
    return () => window.removeEventListener('hashchange', naHash);
  }, []);
  // Promena rotacije ucitava iznova; filter kp je samo prikaz.
  useEffect(() => { postaviIzabran(null); ucitaj(); }, [par.rot, ucitaj]);

  // Posle premestanja kartica dobija fokus nazad (React je mozda premestio element).
  useEffect(() => {
    if (fokusId.current == null || !d) return;
    const li = document.querySelector(`#rot-kolone li.rot-kartica[data-prijava="${fokusId.current}"]`);
    fokusId.current = null;
    if (li) li.focus();
  }, [d]);

  // Sveze stanje pripreme za traku koraka.
  const osveziStanje = useCallback(async () => {
    try {
      const s = await gim.prijave.stanje();
      if (ziv.current) postaviD((x) => (x ? { ...x, stanje: s } : x));
    } catch (e) { obavesti(`Prikaz stanja nije osvežen: ${e.message}`, 'upozorenje'); }
  }, []);

  async function premesti(prijavaId, grupaId, pozicija, fokus) {
    const rot = dRef.current.rot;
    postaviD((x) => premestiLokalno(x, prijavaId, grupaId, pozicija));
    if (fokus) fokusId.current = prijavaId;
    uLetu.current += 1;
    let uspeh = true;
    try {
      await gim.rotacije.premesti(prijavaId, grupaId, pozicija, rot);
    } catch (e) {
      uspeh = false;
      obavesti(e.message, 'greska');
    } finally {
      uLetu.current -= 1;
      if (uLetu.current === 0 && odlozeno.current) { odlozeno.current = false; ucitaj(); }
    }
    if (uspeh && rot === 1) { await osveziStanje(); return; }
    if (uspeh) fokusId.current = prijavaId;
    await ucitaj();
  }

  // Alt+strelice za izabranu karticu; radi i kad je fokus u polju (kao PHP).
  useEffect(() => {
    function naTaster(ev) {
      const id = izabranRef.current;
      if (id == null || !ev.altKey || !dRef.current) return;
      if (document.querySelector('dialog[open]')) return;
      const cilj = indeksZaAltStrelice(dRef.current, id, ev.key);
      if (!cilj) return;
      ev.preventDefault();
      premesti(id, cilj.grupaId, cilj.pozicija, true);
    }
    document.addEventListener('keydown', naTaster);
    return () => document.removeEventListener('keydown', naTaster);
  }, []); // cita samo refove

  // Greska radnje je u toastu; ekran se ponovo ucitava da prikaz odgovara bazi.
  async function radnja(poziv, ponovo = true) {
    try { await poziv(); } catch (e) { obavesti(e.message, 'greska'); }
    if (ponovo) await ucitaj();
  }

  const postavi = (s) => { senkaRef.current = s; postaviSenku(s); };
  const krajVuce = () => { vuceRef.current = null; postaviVuceId(null); postavi(null); };

  const h = {
    izaberi: (id) => { if (izabranRef.current !== id) postaviIzabran(id); },
    pocniVucu(ev, id) {
      vuceRef.current = id;
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', String(id));
      setTimeout(() => { if (vuceRef.current === id) postaviVuceId(id); }, 0);
    },
    krajVuce,
    // Senka ide pre ili posle kartice pod misem (donja polovina = posle), ili na kraj liste.
    prelaz(ev, grupaId, lista) {
      const vuce = vuceRef.current;
      if (vuce == null) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      const li = ev.target.closest ? ev.target.closest('.rot-kartica') : null;
      const bez = bezVucene(lista, vuce);
      const stara = senkaRef.current;
      let { grupaId: g, pre } = stara || { grupaId: null, pre: null };
      if (li) {
        const id = Number(li.dataset.prijava);
        if (id !== vuce) {
          const r = li.getBoundingClientRect();
          g = grupaId;
          pre = bez.findIndex((c) => c.prijava_id === id) + (ev.clientY > r.top + r.height / 2 ? 1 : 0);
        }
      } else if (!stara || stara.grupaId !== grupaId) { g = grupaId; pre = bez.length; }
      if (stara && stara.grupaId === g && stara.pre === pre && stara.cilj === grupaId) return;
      postavi({ grupaId: g, pre, cilj: grupaId });
    },
    pusti(ev, grupaId, lista) {
      const vuce = vuceRef.current;
      if (vuce == null) return;
      ev.preventDefault();
      const s = senkaRef.current;
      const pre = s && s.grupaId === grupaId ? s.pre : bezVucene(lista, vuce).length;
      krajVuce();
      premesti(vuce, grupaId, pre, false);
    },
    izmeni: (g) => { if (!dijalog.current.otvoren()) dijalog.current.otvori(g); },
    obrisi: (g) => {
      if (!window.confirm(`Obrisati grupu „${g.naziv}“?`)) return;
      radnja(() => gim.rotacije.obrisi(g.id));
    },
    vrati: (g) => {
      const rot = dRef.current.rot;
      if (!window.confirm(`Preuzeti redosled iz rotacije 1 za grupu „${g.naziv}“ u rotaciji ${rot}? Sadašnji redosled te rotacije se briše.`)) return;
      radnja(() => gim.rotacije.vrati(g.id, rot));
    },
  };

  async function snimiGrupu(id, naziv, pocetna) {
    await gim.rotacije.izmeni(id, naziv, pocetna);
    if (!ziv.current) return;
    dijalog.current.zatvori();
    await ucitaj();
  }

  async function nova() {
    if (radi.current) return;
    radi.current = true;
    try { await radnja(() => gim.rotacije.dodaj()); } finally { radi.current = false; }
  }

  async function zavrsi() {
    try {
      const r = await gim.rotacije.zavrsi();
      if (r.poruka) najavi(r.poruka.tekst, r.poruka.vrsta);
      location.hash = `#/${r.ide}`;
    } catch (e) { if (!obradiNemaAktivnog(e)) obavesti(e.message, 'greska'); }
  }

  if (!d) {
    if (!greskaUcitavanja) return null;
    return (
      <div className="prazno-stanje" role="alert">
        <p>Rotacije nisu učitane.</p>
        <button type="button" className="dugme" data-fokus onClick={() => { postaviGresku(false); ucitaj(); }}>Pokušaj ponovo</button>
      </div>
    );
  }
  const kolona = (grupa, lista) => {
    const id = grupa ? grupa.id : 0;
    return (
      <RotKolona key={id} grupa={grupa} lista={lista} filter={par.kp} izabranId={izabranId} vuceId={vuceId}
        senkaPre={senka && senka.grupaId === id ? senka.pre : null} cilj={Boolean(senka) && senka.cilj === id} rot={d.rot} h={h} />
    );
  };
  return (
    <>
      <Koraci stanje={d.stanje} tekuci="rotacije" takmId={Number(d.takm.id)} />
      <RotTraka d={d} filter={par.kp} naPomeraj={(v) => radnja(() => gim.rotacije.pomeraj(v))} naNova={nova} />
      <div className="red raste" id="rot-kolone">
        {kolona(null, d.nerasporedjeni)}
        {d.grupe.map((g) => kolona(g, g.redosled_rot))}
      </div>
      <RotPodnozje rot={d.rot} naZavrsi={zavrsi} />
      <DijalogGrupa ref={dijalog} brojSprava={d.brojSprava} sprave={d.sprave} naSnimi={snimiGrupu} />
    </>
  );
}
