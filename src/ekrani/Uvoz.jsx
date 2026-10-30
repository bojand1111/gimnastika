import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Ikona from '../komponente/Ikona.jsx';
import Koraci from '../komponente/Koraci.jsx';
import FajlKartica from './uvoz/FajlKartica.jsx';
import { najavi, obavesti } from '../okvir/Poruke.jsx';
import { obradiNemaAktivnog } from './aktivno.js';
import { pocetniIzbor, prebroj, zaUpis, zbir } from './uvozBrojac.js';
import * as uvozStanje from '../uvozStanje.js';

const PRAZAN = 'Na ekranu Prijave kliknite „Uvezi iz fajla“ i izaberite prijavu kluba (Word, Excel, OpenDocument ili PDF).';
const OTKAZAN = 'Uvoz je otkazan, ništa nije upisano.';

// Izbori zapisnicara zive u stanju ekrana pod kljucem fajla (identitet objekta), pa prezive dodavanje i uklanjanje (POPIS 10.11).
const kljucevi = new WeakMap();
let sledeciKljuc = 0;
const kljuc = (f) => {
  if (!kljucevi.has(f)) kljucevi.set(f, ++sledeciKljuc);
  return kljucevi.get(f);
};
const pocetni = (fajlovi) => Object.fromEntries(fajlovi.map((f) => [kljuc(f), pocetniIzbor(f)]));
const nazad = () => { location.hash = '#/prijave'; };

// Ekran Uvoz prijava iz fajla (POPIS 7): pregled pre upisa, nista se ne upisuje dok se ne potvrdi.
export default function Uvoz() {
  const [fajlovi, postaviFajlove] = useState(() => (uvozStanje.uzmi() || { fajlovi: [] }).fajlovi);
  const [izbori, postaviIzbore] = useState(() => pocetni(fajlovi));
  const [d, postaviD] = useState(null);
  const [radi, postaviRadi] = useState(false);
  const potvrdaRef = useRef(null);
  const radiRef = useRef(false); // upis u toku, postavlja se pre prvog await
  const radnje = useRef({});

  // Bez fajlova nema sta da se pregleda: nazad na Prijave sa uputstvom.
  useEffect(() => {
    if (fajlovi.length === 0) { najavi(PRAZAN, 'info'); nazad(); }
  }, [fajlovi.length]);

  // Ucitava stanje pripreme i aktivno takmicenje; fajlovi drugog takmicenja se odbacuju (POPIS 7.1).
  useEffect(() => {
    const st = uvozStanje.uzmi();
    if (st === null || st.fajlovi.length === 0) return undefined;
    let ziv = true;
    (async () => {
      try {
        const akt = await gim.podesavanja.aktivno();
        if (!ziv) return;
        if (!akt) { obradiNemaAktivnog(new Error('Nema aktivnog takmičenja.')); return; }
        if (Number(akt.id) !== st.takmId) { uvozStanje.ocisti(); najavi(PRAZAN, 'info'); nazad(); return; }
        const [stanje, klubovi, kategorije, programi, podesavanja] = await Promise.all([
          gim.prijave.stanje(), gim.klubovi.svi(), gim.sifarnici.lista('kategorije'),
          gim.sifarnici.lista('programi'), gim.podesavanja.sva(),
        ]);
        if (!ziv) return;
        postaviD({ stanje, takmId: Number(akt.id), klubovi, kategorije, programi,
          lekarski: podesavanja.lekarski_sprecava_prijavu === 'da' });
      } catch (e) {
        if (!ziv) return;
        if (!obradiNemaAktivnog(e)) obavesti(e.message, 'greska');
      }
    })();
    return () => { ziv = false; };
  }, []);

  const poIndeksu = Object.fromEntries(fajlovi.map((f, i) => [i, izbori[kljuc(f)] ?? pocetniIzbor(f)]));
  const brojevi = prebroj(fajlovi, poIndeksu);

  const izmeni = (f, fn) => postaviIzbore((x) => ({ ...x, [kljuc(f)]: fn(x[kljuc(f)] ?? pocetniIzbor(f)) }));
  const naPolje = (f, polje, v) => izmeni(f, (z) => ({ ...z, [polje]: v }));
  const naOznaku = (f, oi, polje, v) => izmeni(f, (z) => ({ ...z, oznake: { ...z.oznake, [oi]: { ...z.oznake[oi], [polje]: v } } }));
  const naRed = (f, ri, deo) => izmeni(f, (z) => ({ ...z, redovi: { ...z.redovi, [ri]: { ...z.redovi[ri], ...deo } } }));
  const naSve = (f, v) => izmeni(f, (z) => ({
    ...z,
    redovi: Object.fromEntries(Object.entries(z.redovi).map(([ri, r]) => [ri, f.redovi[ri].postupak === 'nista' ? r : { ...r, uvezi: v }])),
  }));

  function odustani() {
    if (radiRef.current) return;
    uvozStanje.ocisti();
    najavi(OTKAZAN, 'info');
    nazad();
  }

  function ukloni(i) {
    if (radiRef.current) return;
    uvozStanje.ukloni(i);
    const ostalo = uvozStanje.uzmi().fajlovi;
    if (ostalo.length === 0) { odustani(); return; }
    postaviFajlove(ostalo);
  }

  async function dodajFajlove() {
    if (radiRef.current) return;
    try {
      const putanje = await gim.uvoz.izaberiFajlove();
      if (!putanje.length) return;
      const r = await gim.uvoz.pripremi(putanje);
      r.greske.forEach((g) => obavesti(g, 'greska'));
      if (!r.fajlovi.length) return;
      uvozStanje.dodaj(r.fajlovi);
      postaviIzbore((x) => ({ ...pocetni(r.fajlovi), ...x }));
      postaviFajlove(uvozStanje.uzmi().fajlovi);
    } catch (e) { obavesti(e.message, 'greska'); }
  }

  async function uvezi() {
    if (radiRef.current || brojevi.ukupno === 0) return;
    radiRef.current = true;
    postaviRadi(true);
    try {
      const r = await gim.uvoz.upisi(fajlovi, zaUpis(poIndeksu));
      najavi(`Uvoz završen: prijavljeno ${r.prijavljeno} (novih takmičara ${r.novih}, postojećih ${r.postojecih}).${r.vec > 0 ? ` Već prijavljenih: ${r.vec}.` : ''}`,
        r.prijavljeno > 0 ? 'ok' : 'upozorenje');
      if (r.preskoceno.length) najavi(`Preskočeno: ${r.preskoceno.join('; ')}.`, 'upozorenje');
      if (r.upozorenja.length) najavi(`Lekarski ne važi na dan takmičenja: ${r.upozorenja.join(', ')}.`, 'upozorenje');
      uvozStanje.ocisti();
      nazad();
    } catch (e) {
      obavesti(e.message, 'greska');
      radiRef.current = false;
      postaviRadi(false);
    }
  }

  // Najnovije radnje za slusaoce na documentu (Esc, Ctrl+Enter), da ne vide stare vrednosti.
  radnje.current = {
    otkazi() { if (radiRef.current) return; if (window.confirm('Otkazati uvoz? Ništa neće biti upisano.')) odustani(); },
    potvrdi() { uvezi(); },
  };
  const naOtkazi = useCallback(() => radnje.current.otkazi(), []);
  useEffect(() => {
    const naTaster = (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault();
        if (potvrdaRef.current && !potvrdaRef.current.disabled) potvrdaRef.current.click();
      }
    };
    document.addEventListener('keydown', naTaster);
    document.addEventListener('app:otkazi', naOtkazi);
    return () => {
      document.removeEventListener('keydown', naTaster);
      document.removeEventListener('app:otkazi', naOtkazi);
    };
  }, [naOtkazi]);

  if (fajlovi.length === 0 || !d) return null;
  return (
    <>
      <Koraci stanje={d.stanje} tekuci="prijave" takmId={d.takmId} />
      <div id="uvoz" className="uvoz">
        <p className="sek" style={{ margin: 0 }}>
          Pregled pre upisa: ništa još nije upisano. Zeleno su novi takmičari, žuto oni za koje program misli da već postoje u bazi (izaberite da li je to isti takmičar ili novi), plavo već prijavljeni, crveno redovi koji ne mogu da se uvezu.
          {d.lekarski ? ' Podešavanje „lekarski sprečava prijavu“ je uključeno: novi takmičari nemaju lekarski pregled, pa će biti upisani u bazu, ali ne i prijavljeni.' : ''}
        </p>
        {fajlovi.map((f, i) => (
          <FajlKartica key={kljuc(f)} f={f} i={i} izbor={poIndeksu[i]} b={brojevi.poFajlu[i]} d={d}
            naPolje={(p, v) => naPolje(f, p, v)} naOznaku={(oi, p, v) => naOznaku(f, oi, p, v)}
            naRed={(ri, deo) => naRed(f, ri, deo)} naSve={(v) => naSve(f, v)} naUkloni={() => ukloni(i)} zauzet={radi} />
        ))}
        <div className="kartica uvoz-dno">
          <span className="sek" id="uvoz-zbir">{zbir(brojevi)}</span>
          <span className="raste" />
          <button type="button" className="dugme" disabled={radi} onClick={dodajFajlove}><Ikona ime="fascikla" velicina={16} /><span>Dodaj još fajlova</span></button>
          <button type="button" className="dugme" id="uvoz-otkazi" disabled={radi} onClick={() => radnje.current.otkazi()}><span>Otkaži</span><kbd>Esc</kbd></button>
          <button type="button" className="dugme dugme-glavno dugme-veliko" id="uvoz-potvrdi" ref={potvrdaRef}
            disabled={brojevi.ukupno === 0 || radi} onClick={uvezi}><span>Uvezi prijave</span><kbd>Ctrl+Enter</kbd></button>
        </div>
      </div>
    </>
  );
}
