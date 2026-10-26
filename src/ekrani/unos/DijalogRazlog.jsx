import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Razlog ispravke (POPIS 10.1) umesto window.prompt. pitaj() vraća obećanje: razlog (bez razmaka na krajevima)
// ili null kad se dijalog otkaže (Esc ili "Otkaži"). Prazan razlog ostaje u dijalogu sa porukom.
const DijalogRazlog = forwardRef(function DijalogRazlog(_, ref) {
  const dijalog = useRef(null);
  const polje = useRef(null);
  const odgovor = useRef(null); // resolve funkcija obecanja koje je u toku
  const sesija = useRef(0); // brojac pitaj() poziva; kasni "close" iz stare sesije se ignorise
  const [tekst, postaviTekst] = useState('');
  const [greska, postaviGresku] = useState('');
  const [otvorenoBr, postaviOtvoreno] = useState(0);

  useEffect(() => {
    if (otvorenoBr > 0 && polje.current) { polje.current.focus(); polje.current.select(); }
  }, [otvorenoBr]);

  useImperativeHandle(ref, () => ({
    otvoren: () => Boolean(dijalog.current && dijalog.current.open),
    pitaj() {
      return new Promise((resolve) => {
        sesija.current += 1;
        odgovor.current = resolve;
        postaviTekst('');
        postaviGresku('');
        dijalog.current.showModal();
        postaviOtvoreno((n) => n + 1);
      });
    },
  }));

  // Razresava samo ako sesija odgovara tekucoj i obecanje jos nije razreseno (nikad dvaput).
  const zavrsi = (vrednost, s = sesija.current) => {
    if (s !== sesija.current || !odgovor.current) return;
    const r = odgovor.current;
    odgovor.current = null;
    if (dijalog.current.open) dijalog.current.close();
    r(vrednost);
  };

  function posalji(ev) {
    ev.preventDefault();
    const t = tekst.trim();
    if (t === '') { postaviGresku('Razlog je obavezan.'); polje.current.focus(); return; }
    zavrsi(t);
  }

  // Esc se razresava odmah u "cancel" (sinhrono); "close" stize kasno u redu zadataka pa se stari ignorise.
  return (
    <dialog ref={dijalog} id="dijalog-razlog" className="dijalog" aria-labelledby="dijalog-razlog-naslov"
      onCancel={(ev) => { ev.preventDefault(); zavrsi(null); }}
      onClose={() => { if (!dijalog.current.open) zavrsi(null); }}>
      <form className="forma" onSubmit={posalji}>
        <h2 className="kartica-naslov" id="dijalog-razlog-naslov">Razlog ispravke (obavezno):</h2>
        <input ref={polje} type="text" className="unos" name="razlog" aria-label="Razlog ispravke" autoComplete="off"
          value={tekst} onChange={(ev) => { postaviTekst(ev.target.value); postaviGresku(''); }} />
        {greska && <div className="poruka poruka-greska unos-razlog-greska" role="alert">{greska}</div>}
        <div className="forma-akcije">
          <button type="submit" className="dugme dugme-glavno" id="dijalog-razlog-potvrdi"><span>Potvrdi</span><kbd>Enter</kbd></button>
          <button type="button" className="dugme" id="dijalog-razlog-otkazi" onClick={() => zavrsi(null)}><span>Otkaži</span><kbd>Esc</kbd></button>
        </div>
      </form>
    </dialog>
  );
});

export default DijalogRazlog;
