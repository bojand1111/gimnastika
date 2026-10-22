import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import { url } from '../ruter.js';
import { datumPrikaz } from '../../electron/racun/datum.mjs';
import Ikona from '../komponente/Ikona.jsx';
import StanjeOznake from '../komponente/StanjeOznake.jsx';
import Tabela from '../komponente/Tabela.jsx';
import { najavi, obavesti } from '../okvir/Poruke.jsx';
import { porukaOtvaranja } from './takmicenjaPoruke.js';

const NOVO = '#/takmicenja/novo';
const IDE = { prijave: '#/prijave', rotacije: '#/rotacije', spremno: '#/takmicenje' };

export default function Takmicenja() {
  const [takmicenja, postaviTakmicenja] = useState([]);
  const [izabranId, postaviIzabran] = useState(null);
  const [greska, postaviGresku] = useState(false);
  const noviRef = useRef(null);
  const otvaranje = useRef(false); // dvostruki Enter salje jedan poziv

  useEffect(() => {
    let ziv = true;
    gim.takmicenja.sva()
      .then((r) => { if (ziv) postaviTakmicenja(r); })
      .catch((e) => { if (ziv) postaviGresku(true); obavesti(e.message, 'greska'); });
    return () => { ziv = false; };
  }, []);

  // Autofokus na dugmetu "Novo takmicenje" (data-fokus) i Alt+N.
  useEffect(() => {
    if (noviRef.current) noviRef.current.focus();
    const naNovi = () => { location.hash = NOVO; };
    document.addEventListener('app:novi', naNovi);
    return () => document.removeEventListener('app:novi', naNovi);
  }, []);

  const otvori = useCallback(async (id) => {
    if (otvaranje.current) return;
    otvaranje.current = true;
    try {
      const r = await gim.takmicenja.otvori(id);
      const poruka = porukaOtvaranja(r);
      if (poruka) najavi(poruka, 'upozorenje');
      document.dispatchEvent(new Event('app:aktivno'));
      location.hash = IDE[r.korak];
    } catch (e) {
      obavesti(e.message, 'greska');
    } finally {
      otvaranje.current = false;
    }
  }, []);

  // Enter na dugmetu ili linku radi to dugme, ne otvaranje izabranog reda (POPIS 4.11).
  function uhvatiEnter(ev) {
    if (ev.key === 'Enter' && ev.target.closest('button, a')) ev.stopPropagation();
  }

  // Strelica dole sa dugmeta "Novo takmicenje" bira prvi red.
  function izDugmeta(ev) {
    if (ev.key !== 'ArrowDown' || !takmicenja.length) return;
    ev.preventDefault();
    postaviIzabran(takmicenja[0].id);
    const tr = document.querySelector(`#tabela-takmicenja tr[data-id="${takmicenja[0].id}"]`);
    if (tr) tr.focus();
  }

  const kolone = [
    {
      naslov: 'Naziv i mesto',
      celija: (t) => (
        <span className="dva-reda">
          <span className={`odseci ${t.status === 'aktivno' ? 'naziv-aktivno' : 'naziv'}`}>{t.naziv}</span>
          <span className="mali sivo odseci">{t.mesto}</span>
        </span>
      ),
    },
    { naslov: 'Datum', sirina: 110, celija: (t) => <span className="broj">{datumPrikaz(t.datum)}</span> },
    { naslov: 'E sudija', sirina: 78, celija: (t) => <span className="broj">{t.broj_e_sudija}</span> },
    {
      naslov: 'Status', sirina: 112,
      celija: (t) => {
        if (t.status === 'aktivno') return <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Aktivno</span>;
        if (t.status === 'zavrseno') return <span className="status">Završeno</span>;
        return <span className="status status-info">U pripremi</span>;
      },
    },
    { naslov: 'Priprema', sirina: 330, celija: (t) => <StanjeOznake stanje={t.stanje} /> },
    {
      naslov: '', sirina: 150, klasa: 'desno',
      celija: (t) => (
        <>
          <a href={url('takmicenja/izmeni', { id: t.id })} className="dugme dugme-malo dugme-tekst">Izmeni</a>
          <button type="button" className="dugme dugme-malo" onClick={() => otvori(t.id)}>Otvori</button>
        </>
      ),
    },
  ];

  return (
    <section className="kartica raste kartica-lista">
      <div className="kartica-zaglavlje">
        <h2 className="kartica-naslov">Sva takmičenja</h2>
        <a href={NOVO} className="dugme dugme-glavno" id="novi" data-fokus ref={noviRef} onKeyDown={izDugmeta}>
          <Ikona ime="plus" velicina={16} /><span>Novo takmičenje</span><kbd>Alt+N</kbd>
        </a>
      </div>
      <div className="kartica-skrol" onKeyDownCapture={uhvatiEnter}>
        <Tabela id="tabela-takmicenja" kolone={kolone} redovi={takmicenja} izabranId={izabranId}
          naIzbor={(t) => postaviIzabran(t.id)} naOtvori={(t) => otvori(t.id)}
          prazno={greska ? 'Lista takmičenja nije učitana.' : (takmicenja.length === 0 ? 'Još nema takmičenja. Kliknite „Novo takmičenje“.' : null)} />
      </div>
      <p className="sivo napomena-dole">
        Klik na takmičenje ili „Otvori“ postavlja ga kao aktivno i vodi na prvi nezavršen korak pripreme (prijave, rotacije), a kad je sve spremno na pregled takmičenja. Aktivno može biti samo jedno.
      </p>
    </section>
  );
}
