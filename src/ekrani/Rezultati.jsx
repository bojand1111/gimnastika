import { useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Ikona from '../komponente/Ikona.jsx';
import { razlozi } from '../ruter.js';
import { najavi, obavesti } from '../okvir/Poruke.jsx';
import { prikaz } from '../../electron/racun/broj.mjs';
import { datumPrikaz } from '../../electron/racun/datum.mjs';
import { hashEkrana, mestoIzOznake, mestoPodaci, odustaoRec, sirinaKolone } from './rangStanje.js';
import Mesto from './rang/Mesto.jsx';

const izHasha = () => {
  const { t = '', tk = '', pol = '', kat = '', prog = '' } = razlozi(location.hash).parametri;
  return { t, tk, pol, kat, prog };
};

// Ocene jedne sprave: precrtane E ocene su odbacene (POZICIONI indeksi nad E sudijama, kao PHP).
function RedSprave({ s, det, n, pol, mesta }) {
  const ime = (
    <td><span className="rez-sprava">{s.ikona !== '' && <Ikona ime={s.ikona} velicina={20} />}<span>{s.naziv}</span></span></td>
  );
  if (!det) return <tr>{ime}<td colSpan={n + 5} className="sivo">nema ocene</td></tr>;
  if (det.status === 'odustao') {
    return <tr>{ime}<td colSpan={n + 5}><span className="status status-crn"><Ikona ime="iks" velicina={13} />{odustaoRec(pol)}</span></td></tr>;
  }
  const es = [];
  for (let i = 1; i <= n; i += 1) {
    const v = det.e_sudije[i] ?? null;
    const odb = det.odbacene.includes(i - 1);
    es.push(<td key={i} className="desno"><span className={`broj rez-e ${odb ? 'precrtano' : ''}`}>{v !== null ? prikaz(v) : '–'}</span></td>);
  }
  return (
    <tr>
      {ime}
      <td className="desno"><span className="broj rez-d">{prikaz(det.d)}</span></td>
      {es}
      <td className="desno"><span className="broj sek rez-d">{prikaz(det.e)}</span></td>
      <td className="desno"><span className="broj sivo">{prikaz(det.odbitak)}</span></td>
      <td className="desno"><span className="broj rez-konacna">{prikaz(det.konacna)}</span></td>
      <td className="desno"><Mesto podaci={mestoIzOznake(mesta[s.id])} plain /></td>
    </tr>
  );
}

function KarticaTakmicenja({ izabrano, pol }) {
  const { takm: t, red, sprave } = izabrano;
  const n = Number(t.broj_e_sudija);
  const mesta = red ? red.mesta : {};
  return (
    <section className="kartica rez-kartica">
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">{t.naziv}</h2>
        <span className="sivo rez-opis">{`${t.mesto} · ${datumPrikaz(t.datum)} · ${n} ${n === 1 ? 'E sudija' : 'E sudije'} · precrtane E ocene su odbačene`}</span>
      </div>
      <table className="tabela rang-tabela">
        <thead><tr>
          <th>Sprava</th><th className="desno" style={{ width: 84 }}>D</th>
          {Array.from({ length: n }, (_, i) => <th key={i} className="desno" style={{ width: 78 }}>{`E${i + 1}`}</th>)}
          <th className="desno" style={{ width: 88 }}>E</th><th className="desno" style={{ width: 84 }}>Odb.</th>
          <th className="desno" style={{ width: 116 }}>Konačna</th><th className="desno" style={{ width: 84 }}>Mesto</th>
        </tr></thead>
        <tbody>
          {sprave.map((s) => <RedSprave key={s.id} s={s} det={red?.detalji?.[s.id] ?? null} n={n} pol={pol} mesta={mesta} />)}
          <tr className="rez-viseboj">
            <td><span className="rez-viseboj-naziv">Višeboj</span></td><td colSpan={n + 3}></td>
            <td className="desno"><span className="broj rez-konacna">{red && red.zbir !== null ? prikaz(red.zbir) : '–'}</span></td>
            <td className="desno">{red ? <Mesto podaci={mestoPodaci(red.mesto, red.oznaka)} plain /> : <span className="sivo">–</span>}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function SvaTakmicenja({ sva, izabranoId, tid, par }) {
  const sprave = sva[0].sprave;
  const n = sprave.length;
  return (
    <section className="kartica ne-stampaj rez-kartica">
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">Sva takmičenja</h2>
        <span className="sivo rez-opis">Klik na takmičenje prikazuje ocene po spravama iznad</span>
      </div>
      <table className="tabela rang-tabela">
        <thead><tr>
          <th>Takmičenje</th><th style={{ width: 120 }}>Datum</th><th style={{ width: 150 }}>Kategorija</th>
          {sprave.map((s) => (
            <th key={s.id} className="desno" style={{ width: sirinaKolone(n, 'sva') }}>
              <span className="rang-zag-ikona">{s.ikona !== '' && <Ikona ime={s.ikona} velicina={18} />}<span>{s.skracenica}</span></span>
            </th>
          ))}
          <th className="desno" style={{ width: 110 }}>Višeboj</th><th className="desno" style={{ width: 84 }}>Mesto</th>
        </tr></thead>
        <tbody>
          {sva.map((st) => {
            const aktivan = Number(st.takm.id) === izabranoId;
            const r = st.red;
            return (
              <tr key={st.prijava.id} className={aktivan ? 'izabran' : ''}>
                <td><a href={hashEkrana('rezultati', { t: tid, tk: st.takm.id, pol: par.pol, kat: par.kat, prog: par.prog })} className={`rang-ime ${aktivan ? 'rez-aktivan' : ''}`}>{st.takm.naziv}</a></td>
                <td><span className="broj">{datumPrikaz(st.takm.datum)}</span></td>
                <td>{`${st.prijava.kategorija ?? '–'} · ${st.prijava.program ?? '–'}`}</td>
                {sprave.map((s) => {
                  const v = r?.ocene?.[s.id] ?? null;
                  return <td key={s.id} className="desno"><span className="broj rez-d">{v !== null ? prikaz(v) : '–'}</span></td>;
                })}
                <td className="desno"><span className="broj rez-konacna">{r && r.zbir !== null ? prikaz(r.zbir) : '–'}</span></td>
                <td className="desno">{r ? <Mesto podaci={mestoPodaci(r.mesto, r.oznaka)} plain /> : <span className="sivo">–</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// Ekran Rezultati takmicara (POPIS 3): radi i bez aktivnog takmicenja.
export default function Rezultati() {
  const [par, postaviPar] = useState(izHasha);
  const [d, postaviD] = useState(null);
  const brojac = useRef(0);
  const ziv = useRef(true);
  const dRef = useRef(null);
  dRef.current = d;

  useEffect(() => {
    ziv.current = true;
    const naHash = () => {
      if (!location.hash.startsWith('#/rezultati')) return;
      const n = izHasha();
      postaviPar((p) => (Object.keys(n).every((k) => p[k] === n[k]) ? p : n));
    };
    window.addEventListener('hashchange', naHash);
    return () => { ziv.current = false; window.removeEventListener('hashchange', naHash); };
  }, []);

  useEffect(() => {
    const moj = ++brojac.current;
    (async () => {
      try {
        const podaci = await gim.rang.rezultati(par.t, par.tk);
        if (moj === brojac.current && ziv.current) postaviD(podaci);
      } catch (e) {
        if (moj !== brojac.current || !ziv.current) return;
        if (!dRef.current) { najavi(e.message, 'greska'); location.hash = hashEkrana('rang', {}); } else obavesti(e.message, 'greska');
      }
    })();
  }, [par.t, par.tk]);

  if (!d) return <section className="kartica rez-glava" aria-busy="true" />;
  const { takmicar, sva, izabranoId } = d;
  const izabrano = sva.find((s) => Number(s.takm.id) === izabranoId) ?? null;
  const nazad = hashEkrana('rang', { pol: par.pol, kat: par.kat, prog: par.prog });

  return (
    <>
      <section className="kartica rez-glava">
        <a href={nazad} className="dugme ne-stampaj"><Ikona ime="strelica-levo" velicina={16} /><span>Rang liste</span></a>
        <div className="rez-ime">
          <h2>{`${takmicar.prezime} ${takmicar.ime}`}</h2>
          <div className="sek rez-meta">
            <span className="broj rez-id">{`ID ${takmicar.id_broj}`}</span>
            <span>{`${takmicar.godina_rodjenja} · ${takmicar.pol === 'Z' ? 'Ž' : 'M'}`}</span>
            <span>{takmicar.klub_ime ?? 'bez kluba'}</span>
            {izabrano && <span className="status">{`${izabrano.prijava.kategorija ?? '–'} · ${izabrano.prijava.program ?? '–'}`}</span>}
          </div>
        </div>
        <a href={hashEkrana('takmicari', { id: takmicar.id })} className="dugme ne-stampaj"><Ikona ime="meni-takmicari" velicina={16} /><span>Otvori karton</span></a>
        <button type="button" className="dugme ne-stampaj" onClick={() => window.print()}>
          <Ikona ime="stampac" velicina={16} /><span>Štampaj</span><kbd>Ctrl+P</kbd>
        </button>
      </section>
      {!izabrano
        ? <div className="kartica"><div className="prazno-stanje"><h2>Nema prijava</h2><p>Ovaj takmičar još nije prijavljen ni na jedno takmičenje.</p></div></div>
        : <KarticaTakmicenja izabrano={izabrano} pol={takmicar.pol} />}
      {sva.length > 0 && <SvaTakmicenja sva={sva} izabranoId={izabranoId} tid={takmicar.id} par={par} />}
    </>
  );
}
