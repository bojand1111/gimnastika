import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import { odgovara } from '../pretraga.js';
import Ikona from '../komponente/Ikona.jsx';
import Polje from '../komponente/Polje.jsx';
import Tabela from '../komponente/Tabela.jsx';
import { Greske, obavesti } from '../okvir/Poruke.jsx';

const PRAZNA = { puno_ime: '', skracenica: '', grad: '' };

export default function Klubovi() {
  const [klubovi, postaviKlubove] = useState([]);
  const [izabranId, postaviIzabran] = useState(null);
  const [forma, postaviFormu] = useState(PRAZNA);
  const [greske, postaviGreske] = useState([]);
  const [upit, postaviUpit] = useState('');
  const formaRef = useRef(null);
  const punoRef = useRef(null);

  // Lista se uvek cita ponovo iz baze.
  const ucitaj = useCallback(async () => {
    try { postaviKlubove(await gim.klubovi.svi()); } catch (e) { obavesti(e.message, 'greska'); }
  }, []);
  useEffect(() => { ucitaj(); }, [ucitaj]);

  const fokusPuno = () => { if (punoRef.current) punoRef.current.focus(); };

  const izaberi = useCallback((k) => {
    postaviIzabran(k.id);
    postaviFormu({ puno_ime: k.puno_ime, skracenica: k.skracenica, grad: k.grad });
    postaviGreske([]);
  }, []);

  const novi = useCallback(() => {
    postaviIzabran(null);
    postaviFormu(PRAZNA);
    postaviGreske([]);
    if (punoRef.current) punoRef.current.focus();
  }, []);

  useEffect(() => {
    fokusPuno(); // novi klub: fokus na Puno ime pri otvaranju
    const naNovi = () => novi();
    const naOtkazi = () => {
      const a = document.activeElement;
      if (a && formaRef.current && formaRef.current.contains(a)) novi();
    };
    document.addEventListener('app:novi', naNovi);
    document.addEventListener('app:otkazi', naOtkazi);
    return () => {
      document.removeEventListener('app:novi', naNovi);
      document.removeEventListener('app:otkazi', naOtkazi);
    };
  }, [novi]);

  const vidljivi = klubovi.filter((k) => odgovara(`${k.puno_ime} ${k.skracenica} ${k.grad}`, upit));

  const promeni = (polje) => (ev) => postaviFormu((f) => ({ ...f, [polje]: ev.target.value }));

  async function sacuvaj(ev) {
    ev.preventDefault();
    try {
      const { id } = await gim.klubovi.sacuvaj({ ...forma }, izabranId);
      await ucitaj();
      postaviIzabran(id);
      postaviGreske([]);
      obavesti(`Klub „${forma.puno_ime}“ je sačuvan.`);
    } catch (e) {
      postaviGreske([e.message]);
    }
  }

  async function obrisi() {
    const k = klubovi.find((x) => x.id === izabranId);
    if (!k) return;
    if (k.broj_takmicara > 0) {
      obavesti(`Klub ima ${k.broj_takmicara} takmičara u bazi i ne može se obrisati.`, 'greska');
      return;
    }
    if (!window.confirm(`Obrisati klub „${k.puno_ime}“?`)) return;
    try {
      await gim.klubovi.obrisi(k.id);
      obavesti('Klub je obrisan.');
      await ucitaj();
      novi();
    } catch (e) {
      obavesti(e.message, 'greska');
    }
  }

  // ArrowDown iz pretrage: izaberi i fokusiraj prvi vidljivi red.
  function izPretrage(ev) {
    if (ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    if (!vidljivi.length) return;
    izaberi(vidljivi[0]);
    const tr = document.querySelector(`#tabela tr[data-id="${vidljivi[0].id}"]`);
    if (tr) tr.focus();
  }

  const kolone = [
    { naslov: 'Puno ime', celija: (k) => k.puno_ime },
    { naslov: 'Skraćenica', sirina: 130, celija: (k) => <span className="skr">{k.skracenica}</span> },
    { naslov: 'Grad', sirina: 170, celija: (k) => k.grad },
    {
      naslov: '', sirina: 64, klasa: 'desno',
      celija: (k) => (
        <button type="button" className="dugme dugme-ikona izmeni" aria-label="Izmeni klub"
          onClick={() => { izaberi(k); fokusPuno(); }}><Ikona ime="olovka" velicina={16} /></button>
      ),
    },
  ];

  return (
    <div className="red red-rastegni raste" style={{ minHeight: 0 }}>
      <section className="kartica raste" style={{ overflow: 'hidden' }}>
        <div className="kartica-zaglavlje">
          <h2 className="kartica-naslov">Klubovi u bazi</h2>
          <button type="button" className="dugme dugme-glavno" id="novi" onClick={novi}>
            <Ikona ime="plus" velicina={16} /><span>Novi klub</span><kbd>Alt+N</kbd>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px' }}>
          <label className="pretraga" style={{ width: 340 }}>
            <span className="ikona-pretraga" style={{ display: 'flex' }}><Ikona ime="pretraga" velicina={16} /></span>
            <input type="text" className="unos" id="pretraga" value={upit}
              onChange={(ev) => postaviUpit(ev.target.value)} onKeyDown={izPretrage}
              placeholder="Pretraga po imenu, skraćenici ili gradu" aria-label="Pretraga" autoComplete="off" />
          </label>
          <span className="sivo" style={{ fontSize: 13 }} id="brojac">{vidljivi.length} klubova</span>
        </div>
        <div className="kartica-skrol">
          <Tabela id="tabela" kolone={kolone} redovi={vidljivi} izabranId={izabranId}
            naIzbor={izaberi} naOtvori={fokusPuno}
            prazno={klubovi.length === 0 ? 'Još nema klubova. Dodajte prvi klub u formi desno.' : null} />
        </div>
      </section>

      <section className="kartica" style={{ width: 400, flexShrink: 0 }}>
        <div className="kartica-zaglavlje">
          <h2 className="kartica-naslov" id="naslov-forme">{izabranId ? 'Izmena kluba' : 'Novi klub'}</h2>
        </div>
        <form className="forma" id="forma" ref={formaRef} onSubmit={sacuvaj} style={{ padding: 16, gap: 12 }}>
          <Greske greske={greske} />
          <Polje oznaka="Puno ime" id="f-puno" unosRef={punoRef} value={forma.puno_ime} onChange={promeni('puno_ime')} required />
          <div style={{ display: 'flex', gap: 12 }}>
            <Polje oznaka="Skraćenica" id="f-skr" klasa="broj" stil={{ width: 110, flex: 'none' }}
              value={forma.skracenica} onChange={promeni('skracenica')} maxLength={4} required
              style={{ textTransform: 'uppercase' }} />
            <Polje oznaka="Grad" id="f-grad" poljeKlasa="raste" value={forma.grad} onChange={promeni('grad')} />
          </div>
          <span className="sivo mali">Skraćenica (2 do 4 slova) se prikazuje u unosu ocena i rang listama.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <button type="submit" className="dugme dugme-glavno"><span>Sačuvaj</span><kbd>Enter</kbd></button>
            <button type="button" className="dugme" id="otkazi" onClick={novi}><span>Otkaži</span><kbd>Esc</kbd></button>
            <span style={{ flexGrow: 1 }}></span>
            <button type="button" className={`dugme dugme-opasno ${izabranId ? '' : 'sakriveno'}`} id="obrisi" onClick={obrisi}>
              <Ikona ime="kanta" velicina={16} /><span>Obriši</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
