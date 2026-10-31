import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Potvrda opasne radnje (POPIS 6.4) umesto window.confirm. potvrdi(tekst, {potvrdaTekst}) vraca obecanje:
// true za potvrdu, false za "Odustani" ili Esc. Fokus je na "Odustani".
const DijalogPotvrda = forwardRef(function DijalogPotvrda(_, ref) {
  const dijalog = useRef(null);
  const odustani = useRef(null);
  const odgovor = useRef(null); // resolve funkcija obecanja koje je u toku
  const sesija = useRef(0); // kasni "close" iz stare sesije se ignorise
  const [tekst, postaviTekst] = useState('');
  const [dugme, postaviDugme] = useState('Vrati');
  const [otvorenoBr, postaviOtvoreno] = useState(0);

  useEffect(() => {
    if (otvorenoBr > 0 && odustani.current) odustani.current.focus();
  }, [otvorenoBr]);

  useImperativeHandle(ref, () => ({
    otvoren: () => Boolean(dijalog.current && dijalog.current.open),
    potvrdi(t, opcije = {}) {
      return new Promise((resolve) => {
        // Drugi poziv dok je dijalog otvoren odbija prethodni obecanje (nikad ne ostaje bez odgovora)
        if (odgovor.current) { const stari = odgovor.current; odgovor.current = null; stari(false); }
        sesija.current += 1;
        odgovor.current = resolve;
        postaviTekst(t);
        postaviDugme(opcije.potvrdaTekst || 'Vrati');
        if (!dijalog.current.open) dijalog.current.showModal();
        postaviOtvoreno((n) => n + 1);
      });
    },
  }));

  const zavrsi = (vrednost, s = sesija.current) => {
    if (s !== sesija.current || !odgovor.current) return;
    const r = odgovor.current;
    odgovor.current = null;
    if (dijalog.current.open) dijalog.current.close();
    r(vrednost);
  };

  return (
    <dialog ref={dijalog} id="dijalog-potvrda" className="dijalog" aria-labelledby="dijalog-potvrda-tekst"
      onCancel={(ev) => { ev.preventDefault(); zavrsi(false); }}
      onClose={() => { if (!dijalog.current.open) zavrsi(false); }}>
      <div className="forma">
        <h2 className="kartica-naslov" id="dijalog-potvrda-tekst" style={{ lineHeight: '22px' }}>{tekst}</h2>
        <div className="forma-akcije">
          <button type="button" className="dugme dugme-opasno" id="dijalog-potvrda-da" onClick={() => zavrsi(true)}><span>{dugme}</span></button>
          <button type="button" className="dugme" id="dijalog-potvrda-ne" ref={odustani} onClick={() => zavrsi(false)}><span>Odustani</span></button>
        </div>
      </div>
    </dialog>
  );
});

export default DijalogPotvrda;
