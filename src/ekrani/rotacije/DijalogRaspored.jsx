import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import gim from '../../gim.js';
import Polje from '../../komponente/Polje.jsx';
import { tekstTurnusa } from '../rotacijeStanje.js';

const POCETNO = { maksimum: '6', poKategoriji: true, poKlubu: true, turnusPoKategoriji: true };

// Parametri za server; treća kućica važi samo uz kategorije.
const parametri = (f) => ({
  maksimum: Number(f.maksimum),
  poKategoriji: f.poKategoriji,
  poKlubu: f.poKlubu,
  turnusPoKategoriji: f.poKategoriji && f.turnusPoKategoriji,
});

// Dijalog "Rasporedi automatski": parametri, pregled pre potvrde, pa naRasporedi(parametri).
const DijalogRaspored = forwardRef(function DijalogRaspored({ naRasporedi }, ref) {
  const dijalog = useRef(null);
  const maksRef = useRef(null);
  const brojac = useRef(0);
  const [f, postaviF] = useState(POCETNO);
  const [otvoren, postaviOtvoren] = useState(0);
  const [predlog, postaviPredlog] = useState(null); // { za: kljuc parametara, ...odgovor }
  const [greska, postaviGresku] = useState('');
  const [radi, postaviRadi] = useState(false);

  useImperativeHandle(ref, () => ({
    otvoren: () => Boolean(dijalog.current && dijalog.current.open),
    zatvori: () => dijalog.current.close(),
    otvori() {
      postaviGresku('');
      postaviRadi(false);
      postaviPredlog(null);
      dijalog.current.showModal();
      postaviOtvoren((n) => n + 1);
    },
  }));

  useEffect(() => {
    if (otvoren > 0 && maksRef.current) { maksRef.current.focus(); maksRef.current.select(); }
  }, [otvoren]);

  // Pregled se računa na svaku promenu; zastareo odgovor se odbacuje.
  useEffect(() => {
    if (otvoren === 0) return;
    const moj = ++brojac.current;
    const za = JSON.stringify(parametri(f));
    gim.rotacije.predlog(parametri(f)).then(
      (p) => { if (moj === brojac.current) { postaviPredlog({ ...p, za }); postaviGresku(''); } },
      (e) => { if (moj === brojac.current) { postaviPredlog(null); postaviGresku(e.message); } },
    );
  }, [f, otvoren]);

  async function posalji(ev) {
    ev.preventDefault();
    if (!svez || predlog.imaOcena || radi) return;
    if (predlog.imaGrupa && !window.confirm('Obrisati postojeće grupe i napraviti nov raspored?')) return;
    postaviRadi(true);
    try {
      await naRasporedi(parametri(f));
    } catch (e) {
      postaviGresku(e.message);
      postaviRadi(false);
    }
  }

  const kucica = (kljuc, tekst, onemoguceno = false) => (
    <label className="kucica">
      <input type="checkbox" name={kljuc} checked={f[kljuc] && !onemoguceno} disabled={onemoguceno}
        onChange={(ev) => postaviF((x) => ({ ...x, [kljuc]: ev.target.checked }))} />
      <span>{tekst}</span>
    </label>
  );

  // pregled mora biti za upisane vrednosti, inace bi se potvrdilo nesto drugo od prikazanog
  const svez = Boolean(predlog) && predlog.za === JSON.stringify(parametri(f));
  const moze = svez && !predlog.imaOcena && predlog.ukupno > 0 && !radi;
  return (
    <dialog ref={dijalog} id="dijalog-raspored" className="dijalog" aria-labelledby="dijalog-raspored-naslov">
      <form className="forma" onSubmit={posalji}>
        <h2 className="kartica-naslov" id="dijalog-raspored-naslov">Rasporedi automatski</h2>
        {greska && <div className="poruka poruka-greska" role="alert">{greska}</div>}
        <Polje oznaka="Najviše takmičara po grupi" name="maksimum" type="number" min="1" max="30" unosRef={maksRef}
          value={f.maksimum} onChange={(ev) => postaviF((x) => ({ ...x, maksimum: ev.target.value }))} />
        {kucica('poKategoriji', 'Ista kategorija zajedno')}
        {kucica('poKlubu', 'Isti klub zajedno')}
        {kucica('turnusPoKategoriji', 'Svaka kategorija u svom turnusu', !f.poKategoriji)}
        {predlog && predlog.imaOcena && (
          <div className="poruka poruka-upozorenje">Ocene su već unete. Automatski raspored nije moguć; grupe menjajte ručno.</div>
        )}
        {predlog && !predlog.imaOcena && predlog.imaGrupa && (
          <div className="poruka poruka-upozorenje">Postojeći raspored grupa biće obrisan i napravljen nov. Prijave i ocene ostaju.</div>
        )}
        {!svez && !greska && <p className="sivo" role="status">Računam pregled…</p>}
        {predlog && predlog.ukupno === 0 && <p className="sivo">Nema prijava za raspored.</p>}
        {predlog && predlog.ukupno > 0 && (
          <ul className="raspored-pregled" aria-label="Pregled rasporeda" aria-live="polite">
            {predlog.turnusi.map((t) => <li key={t.turnus}>{tekstTurnusa(t)}</li>)}
          </ul>
        )}
        <div className="forma-akcije">
          <button type="submit" className="dugme dugme-glavno" id="raspored-potvrdi" disabled={!moze}><span>Rasporedi</span></button>
          <button type="button" className="dugme" onClick={() => dijalog.current.close()}><span>Otkaži</span></button>
        </div>
      </form>
    </dialog>
  );
});

export default DijalogRaspored;
