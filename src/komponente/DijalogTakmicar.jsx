import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Polje from './Polje.jsx';
import DatumPolje from './DatumPolje.jsx';
import IzborPola from './IzborPola.jsx';

const POLOVI = [{ vrednost: 'Z', tekst: 'Ž' }, { vrednost: 'M', tekst: 'M' }];

// Dijalog "Novi takmicar" (POPIS 6.4). otvori({klub, pol, idBroj}) ga prikazuje; naSnimi(unos) vraca
// obecanje, a greska servera ostaje u dijalogu. Esc zatvara (showModal).
const DijalogTakmicar = forwardRef(function DijalogTakmicar({ klubovi, naSnimi }, ref) {
  const dijalog = useRef(null);
  const prezimeRef = useRef(null);
  const prazno = { prezime: '', ime: '', id_broj: '', godina_rodjenja: '', pol: 'Z', klub_id: '', lekarski_do: '' };
  const [f, postaviF] = useState(prazno);
  const [greska, postaviGresku] = useState('');
  const [radi, postaviRadi] = useState(false);

  useImperativeHandle(ref, () => ({
    otvoren: () => Boolean(dijalog.current && dijalog.current.open),
    zatvori: () => dijalog.current.close(),
    otvori({ klub, pol, idBroj }) {
      postaviF({ ...prazno, id_broj: idBroj, klub_id: klub, pol: pol === 'M' ? 'M' : 'Z' });
      postaviGresku('');
      postaviRadi(false);
      dijalog.current.showModal();
      if (prezimeRef.current) prezimeRef.current.focus();
    },
  }));

  const promeni = (polje) => (ev) => postaviF((x) => ({ ...x, [polje]: ev.target.value }));

  async function posalji(ev) {
    ev.preventDefault();
    postaviRadi(true);
    try {
      await naSnimi({ ...f });
    } catch (e) {
      postaviGresku(e.message);
      postaviRadi(false);
    }
  }

  return (
    <dialog ref={dijalog} id="dijalog-takmicar" className="dijalog" aria-labelledby="dijalog-naslov">
      <form id="forma-takmicar" className="forma" style={{ gap: 12 }} onSubmit={posalji}>
        <h2 className="kartica-naslov" id="dijalog-naslov">Novi takmičar</h2>
        <p className="sivo mali">Upisuje se u bazu takmičara i odmah prijavljuje na ovo takmičenje.</p>
        {greska && <div className="poruka poruka-greska" id="dijalog-greska" role="alert">{greska}</div>}
        <div className="forma-red">
          <Polje oznaka="Prezime" name="prezime" unosRef={prezimeRef} value={f.prezime} onChange={promeni('prezime')} required />
          <Polje oznaka="Ime" name="ime" value={f.ime} onChange={promeni('ime')} required />
        </div>
        <div className="forma-red">
          <Polje oznaka="ID broj" name="id_broj" klasa="broj" stil={{ flex: '0 0 110px' }}
            value={f.id_broj} onChange={promeni('id_broj')} required />
          <Polje oznaka="Godina rođenja" name="godina_rodjenja" klasa="broj" stil={{ flex: '0 0 110px' }}
            value={f.godina_rodjenja} onChange={promeni('godina_rodjenja')} inputMode="numeric" maxLength={4} required />
          <div className="polje"><span className="oznaka">Pol</span>
            <div style={{ alignSelf: 'flex-start' }}>
              <IzborPola id="dijalog-pol" oznaka="Pol" opcije={POLOVI} vrednost={f.pol}
                naPromenu={(pol) => postaviF((x) => ({ ...x, pol }))} />
            </div>
          </div>
        </div>
        <div className="forma-red">
          <label className="polje"><span className="oznaka">Klub</span>
            <select className="unos" name="klub_id" value={f.klub_id} onChange={promeni('klub_id')}>
              <option value="">bez kluba</option>
              {klubovi.map((k) => <option key={k.id} value={String(k.id)}>{k.skracenica} · {k.puno_ime}</option>)}
            </select>
          </label>
          <DatumPolje oznaka="Lekarski važi do" name="lekarski_do" stil={{ flex: '0 0 150px' }} placeholder="dd.mm.gggg."
            value={f.lekarski_do} naPromenu={(v) => postaviF((x) => ({ ...x, lekarski_do: v }))} />
        </div>
        <div className="forma-akcije">
          <button type="submit" className="dugme dugme-glavno" id="dijalog-sacuvaj" disabled={radi}>
            <span>Sačuvaj i prijavi</span><kbd>Enter</kbd></button>
          <button type="button" className="dugme" id="dijalog-otkazi" onClick={() => dijalog.current.close()}>
            <span>Otkaži</span><kbd>Esc</kbd></button>
        </div>
      </form>
    </dialog>
  );
});

export default DijalogTakmicar;
