import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import { obavesti } from '../okvir/Poruke.jsx';
import { obradiNemaAktivnog } from './aktivno.js';
import { hashEkrana, hashRang, parRang, tekstPodnozja } from './rangStanje.js';
import RangTraka from './rang/RangTraka.jsx';
import TabSprava from './rang/TabSprava.jsx';
import TabViseboj from './rang/TabViseboj.jsx';
import TabEkipno from './rang/TabEkipno.jsx';

// Parametri iz hasha (POPIS 2.1); izbor i tab se normalizuju na serveru. Pola nema: ekran prikazuje izabrani deo.
const izHasha = () => parRang(location.hash);

// Ekran Rang liste (POPIS 2): jedan poziv daje izbor i sve rezultate; promene idu kroz hash.
export default function Rang() {
  const [par, postaviPar] = useState(izHasha);
  const [d, postaviD] = useState(null);
  const ziv = useRef(true);
  const brojac = useRef(0);
  const dRef = useRef(null);
  dRef.current = d;

  const ucitaj = useCallback(async () => {
    const moj = ++brojac.current;
    try {
      const podaci = await gim.rang.podaci(par.kat, par.prog, par.tab);
      if (moj !== brojac.current || !ziv.current) return;
      postaviD(podaci);
    } catch (e) {
      if (moj !== brojac.current || !ziv.current) return;
      if (!obradiNemaAktivnog(e)) obavesti(e.message, 'greska');
    }
  }, [par.kat, par.prog, par.tab]);

  useEffect(() => { ziv.current = true; return () => { ziv.current = false; }; }, []);
  useEffect(() => { ucitaj(); }, [ucitaj]);

  useEffect(() => {
    const naHash = () => {
      if (!location.hash.startsWith('#/rang')) return;
      const n = izHasha();
      postaviPar((p) => (p.kat === n.kat && p.prog === n.prog && p.tab === n.tab ? p : n));
    };
    // Ctrl+P (App salje app:stampa): pregled za stampu sa tekucim izborom (POPIS 2.2, 9.6).
    const naStampu = () => {
      const t = dRef.current;
      // Pre prvog odgovora IPC-a koristi parametre iz hasha, da Ctrl+P uvek otvori pregled
      location.hash = t
        ? hashEkrana('stampa', { kat: t.izbor.kat, prog: t.izbor.prog, tab: t.tab })
        : hashEkrana('stampa', izHasha());
    };
    window.addEventListener('hashchange', naHash);
    document.addEventListener('app:stampa', naStampu);
    return () => {
      window.removeEventListener('hashchange', naHash);
      document.removeEventListener('app:stampa', naStampu);
    };
  }, []);

  if (!d) return <section className="kartica raste rang-kartica" aria-busy="true" />;
  const { takm, izbor, rez, tab } = d;
  const sprava = rez && typeof tab === 'number' ? rez.sprave.find((s) => Number(s.id) === tab) : null;
  const ekipno = tab === 'ekipno';
  const tabNaziv = sprava ? sprava.naziv : (ekipno ? 'Ekipno' : 'Višeboj');

  // Promena kategorije vraca program na podrazumevani; select odmah menja hash.
  const naKategoriju = (v) => { location.hash = hashRang(v, null, tab); };
  const naProgram = (v) => { location.hash = hashRang(izbor.kat ?? 0, v, tab); };

  let telo;
  if (!rez) telo = <div className="prazno-stanje"><h2>Nema prijava u ovom takmičenju</h2><p>Prijavite takmičare na ekranu Prijave.</p></div>;
  else if (sprava) telo = <TabSprava rez={rez} izbor={izbor} sprava={sprava} />;
  else if (ekipno) telo = <TabEkipno rez={rez} izbor={izbor} />;
  else telo = <TabViseboj rez={rez} izbor={izbor} />;

  return (
    <section className="kartica raste rang-kartica">
      <RangTraka izbor={izbor} rez={rez} tab={tab} naKategoriju={naKategoriju} naProgram={naProgram} />
      <div className="kartica-skrol">{telo}</div>
      <div className="sivo rang-podnozje">
        <span>{tekstPodnozja({
          tabNaziv, pol: izbor.pol, katNaziv: izbor.kat_naziv, progNaziv: izbor.prog_naziv,
          brojPrijava: rez ? Object.keys(rez.prijave).length : null, ekipno, ekipnoBroji: takm.ekipno_broji,
        })}</span>
        <span>Klik na ime otvara sve rezultate {izbor.pol === 'Z' ? 'takmičarke' : 'takmičara'}</span>
      </div>
    </section>
  );
}
