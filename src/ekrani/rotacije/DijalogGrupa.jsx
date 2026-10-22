import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Polje from '../../komponente/Polje.jsx';

// Dijalog "Grupa" (POPIS 10.1) umesto window.prompt. otvori({id, naziv, pocetna_pozicija});
// naSnimi(id, naziv, pozicija) vraća obećanje, a greška modela ostaje u dijalogu.
const DijalogGrupa = forwardRef(function DijalogGrupa({ brojSprava, sprave, naSnimi }, ref) {
  const dijalog = useRef(null);
  const nazivRef = useRef(null);
  const [f, postaviF] = useState({ id: 0, naziv: '', pocetna: '1' });
  const [greska, postaviGresku] = useState('');
  const [radi, postaviRadi] = useState(false);
  const [otvorenoBr, postaviOtvoreno] = useState(0);

  // Fokus i selekcija tek posle rendera sa novim nazivom.
  useEffect(() => {
    if (otvorenoBr > 0 && nazivRef.current) { nazivRef.current.focus(); nazivRef.current.select(); }
  }, [otvorenoBr]);

  useImperativeHandle(ref, () => ({
    otvoren: () => Boolean(dijalog.current && dijalog.current.open),
    zatvori: () => dijalog.current.close(),
    otvori({ id, naziv, pocetna_pozicija: pocetna }) {
      postaviF({ id, naziv, pocetna: String(pocetna) });
      postaviGresku('');
      postaviRadi(false);
      dijalog.current.showModal();
      postaviOtvoreno((n) => n + 1);
    },
  }));

  async function posalji(ev) {
    ev.preventDefault();
    postaviRadi(true);
    try {
      await naSnimi(f.id, f.naziv, Number(f.pocetna));
    } catch (e) {
      postaviGresku(e.message);
      postaviRadi(false);
    }
  }

  const pozicije = Array.from({ length: brojSprava }, (_, i) => i + 1);
  return (
    <dialog ref={dijalog} id="dijalog-grupa" className="dijalog" aria-labelledby="dijalog-grupa-naslov">
      <form className="forma" onSubmit={posalji}>
        <h2 className="kartica-naslov" id="dijalog-grupa-naslov">Grupa</h2>
        {greska && <div className="poruka poruka-greska" id="dijalog-greska" role="alert">{greska}</div>}
        <Polje oznaka="Naziv grupe" name="naziv" unosRef={nazivRef} value={f.naziv}
          onChange={(ev) => postaviF((x) => ({ ...x, naziv: ev.target.value }))} />
        <label className="polje"><span className="oznaka">Početna sprava u rotaciji 1</span>
          <select className="unos" name="pocetna" value={f.pocetna} onChange={(ev) => postaviF((x) => ({ ...x, pocetna: ev.target.value }))}>
            {pozicije.map((r) => <option key={r} value={String(r)}>{sprave[r - 1] ? `${r} · ${sprave[r - 1].naziv}` : String(r)}</option>)}
          </select>
        </label>
        <div className="forma-akcije">
          <button type="submit" className="dugme dugme-glavno" id="dijalog-sacuvaj" disabled={radi}>
            <span>Sačuvaj</span><kbd>Enter</kbd></button>
          <button type="button" className="dugme" id="dijalog-otkazi" onClick={() => dijalog.current.close()}>
            <span>Otkaži</span><kbd>Esc</kbd></button>
        </div>
      </form>
    </dialog>
  );
});

export default DijalogGrupa;
