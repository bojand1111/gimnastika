import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import { razlozi } from '../ruter.js';
import Ikona from '../komponente/Ikona.jsx';
import Koraci from '../komponente/Koraci.jsx';
import Polje from '../komponente/Polje.jsx';
import DatumPolje from '../komponente/DatumPolje.jsx';
import IzborBroja from '../komponente/IzborBroja.jsx';
import { Greske, najavi, obavesti } from '../okvir/Poruke.jsx';
import { izForme, uFormu, listaGresaka, poljeGreske } from './takmicenjeForma.js';

const GRBOVI = [['grb_levo', 'Grb levo'], ['grb_desno', 'Grb desno']];
const LISTA = '#/takmicenja';
const bezGrba = () => ({ grb_levo: { obrisi: false, putanja: '' }, grb_desno: { obrisi: false, putanja: '' } });
const imeFajla = (p) => p.split(/[\\/]/).pop();

// Omotac: cita id iz hasha i remontira formu pri promeni (novo <-> izmena).
export default function TakmicenjeForma() {
  const [hash, postaviHash] = useState(location.hash);
  useEffect(() => {
    const naPromeni = () => postaviHash(location.hash);
    window.addEventListener('hashchange', naPromeni);
    return () => window.removeEventListener('hashchange', naPromeni);
  }, []);
  const { parametri } = razlozi(hash);
  const id = parametri.id ? Number(parametri.id) : null;
  if (!/^#\/takmicenja\/(novo|izmeni)(\?|$)/.test(hash)) return null; // posle odlaska sa ekrana nema remonta
  return <Forma key={id ?? 'novo'} id={id} />;
}

function Forma({ id }) {
  const [forma, postaviFormu] = useState(null);
  const [red, postaviRed] = useState(null); // red iz modela (url-ovi grbova)
  const [grb, postaviGrb] = useState(bezGrba());
  const [greske, postaviGreske] = useState([]);
  const [klubovi, postaviKlubove] = useState([]);
  const [imaOcena, postaviImaOcena] = useState(false);
  const [stanje, postaviStanje] = useState(null);
  const [jeAktivno, postaviJeAktivno] = useState(false);
  const [radi, postaviRadi] = useState(false);
  const blokGresaka = useRef(null);
  const formaRef = useRef(null);
  const fokusiran = useRef(false);

  // jeZiv: ucitavanje se odbacuje ako je ekran u medjuvremenu napusten.
  const ucitaj = useCallback(async (jeZiv = () => true) => {
    try {
      const r = id === null ? await gim.takmicenja.prazno() : await gim.takmicenja.nadji(id);
      if (!jeZiv()) return;
      if (r === null) {
        najavi('Takmičenje ne postoji.', 'greska');
        location.hash = LISTA;
        return;
      }
      let st = null;
      let akt = null;
      if (id !== null) [st, akt] = await Promise.all([gim.takmicenja.stanje(id), gim.podesavanja.aktivno()]);
      if (!jeZiv()) return;
      // sve tek posle ucitavanja, da imaOcena nikad nije privremeno false
      postaviRed(r);
      postaviImaOcena(Number(r.ima_ocena) === 1);
      postaviStanje(st);
      postaviJeAktivno(Boolean(akt) && Number(akt.id) === id);
      postaviGrb(bezGrba());
      postaviFormu(uFormu(r));
    } catch (e) { if (jeZiv()) obavesti(e.message, 'greska'); }
  }, [id]);

  useEffect(() => {
    let ziv = true;
    ucitaj(() => ziv);
    return () => { ziv = false; };
  }, [ucitaj]);
  useEffect(() => {
    gim.klubovi.svi().then(postaviKlubove).catch((e) => obavesti(e.message, 'greska'));
  }, []);

  // Fokus na prvo polje sa greskom ako poruka stoji uz polje, inace na blok gresaka.
  useEffect(() => {
    if (!greske.length) return;
    const polje = greske.map(poljeGreske).find(Boolean);
    const el = polje === 'izbor-sudije'
      ? document.querySelector('#izbor-sudije button:not([disabled])')
      : polje && document.querySelector(`#forma [name="${polje}"]`);
    (el || blokGresaka.current)?.focus();
  }, [greske]);

  // Esc samo iz polja forme vodi na listu; bez pitanja (POPIS 4.11).
  useEffect(() => {
    const naOtkazi = () => {
      const a = document.activeElement;
      if (a && a.closest('#forma') && a.matches('input, select, textarea')) location.hash = LISTA;
    };
    document.addEventListener('app:otkazi', naOtkazi);
    return () => document.removeEventListener('app:otkazi', naOtkazi);
  }, []);

  // Autofokus na Naziv (data-fokus) kad se forma prvi put prikaze.
  useEffect(() => {
    if (forma && !fokusiran.current) {
      fokusiran.current = true;
      const n = formaRef.current && formaRef.current.querySelector('[name="naziv"]');
      if (n) n.focus();
    }
  }, [forma]);

  const promeni = (polje) => (ev) => postaviFormu((f) => ({ ...f, [polje]: ev.target.value }));
  const promeniKucicu = (polje) => (ev) => postaviFormu((f) => ({ ...f, [polje]: ev.target.checked }));
  const promeniGrb = (k, d) => postaviGrb((g) => ({ ...g, [k]: { ...g[k], ...d } }));

  async function izaberiSliku(k) {
    try {
      const p = await gim.takmicenja.izaberiGrb();
      if (p) promeniGrb(k, { putanja: p, obrisi: false });
    } catch (e) { obavesti(e.message, 'greska'); }
  }

  async function sacuvaj(ev) {
    ev.preventDefault();
    if (radi) return;
    postaviRadi(true);
    try {
      let r;
      try {
        r = await gim.takmicenja.sacuvaj(izForme(forma), id);
      } catch (e) {
        postaviGreske(listaGresaka(e));
        return;
      }
      postaviGreske([]);
      // Grbovi posle glavnog cuvanja; greska grba je samo poruka, ostalo je sacuvano (POPIS 4.4).
      for (const [k] of GRBOVI) {
        try {
          if (grb[k].obrisi) await gim.takmicenja.ukloniGrb(r.id, k);
          else if (grb[k].putanja) await gim.takmicenja.sacuvajGrb(r.id, k, grb[k].putanja);
        } catch (e) { obavesti(e.message, 'greska'); }
      }
      const naziv = izForme(forma).naziv;
      document.dispatchEvent(new Event('app:aktivno'));
      if (r.novo) {
        najavi(`Takmičenje „${naziv}“ je napravljeno i postavljeno kao aktivno. Prijavite takmičare.`, 'ok');
        location.hash = '#/prijave';
      } else {
        obavesti(`Takmičenje „${naziv}“ je sačuvano.`, 'ok');
        await ucitaj();
      }
    } finally {
      postaviRadi(false);
    }
  }

  async function obrisi() {
    if (!window.confirm('Obrisati ovo takmičenje? Moguće je samo ako nema prijava.')) return;
    try {
      await gim.takmicenja.obrisi(id);
      najavi('Takmičenje je obrisano.', 'ok');
    } catch (e) {
      najavi(e.message, 'greska');
    }
    document.dispatchEvent(new Event('app:aktivno'));
    location.hash = LISTA;
  }

  if (!forma || !red) return null;
  return (
    <>
      {(id === null || jeAktivno) && <Koraci stanje={stanje} tekuci="podaci" takmId={id} />}
      <form id="forma" className="kolona forma-takm" ref={formaRef} onSubmit={sacuvaj}>
        {greske.length > 0 && (
          <div role="alert" tabIndex={-1} ref={blokGresaka} className="blok-gresaka">
            <Greske greske={greske} />
          </div>
        )}
        <div className="red red-rastegni">
          <section className="kartica raste">
            <div className="kartica-zaglavlje">
              <h2 className="kartica-naslov">Takmičenje</h2>
              {id !== null && <span className="sivo mali">ID {id}</span>}
            </div>
            <div className="kartica-telo">
              <Polje oznaka="Naziv" name="naziv" value={forma.naziv} onChange={promeni('naziv')}
                placeholder="npr. Prvenstvo Srbije 2026" required />
              <div className="red-polja">
                <DatumPolje oznaka="Datum" poljeKlasa="polje-datum" name="datum" value={forma.datum}
                  naPromenu={(v) => postaviFormu((f) => ({ ...f, datum: v }))} placeholder="dd.mm.gggg." required />
                <Polje oznaka="Mesto" poljeKlasa="raste" name="mesto" value={forma.mesto} onChange={promeni('mesto')} placeholder="Grad" />
              </div>
              <div className="polje"><span className="oznaka">Broj E sudija</span>
                <div className="red-uz-tekst">
                  <IzborBroja id="izbor-sudije" oznaka="Broj E sudija" vrednost={forma.broj_e_sudija} disabled={imaOcena}
                    naPromenu={(n) => postaviFormu((f) => ({ ...f, broj_e_sudija: n }))} />
                  <span className="sivo mali">
                    {imaOcena ? 'Ne može se menjati: takmičenje već ima unete ocene.' : 'Toliko polja za E ocene ima svaki red pri unosu.'}
                  </span>
                </div>
              </div>
              <fieldset className="pravila">
                <legend className="oznaka">Pravila</legend>
                <span className="pravila-naslov">Obračun E ocene</span>
                <label className="radio-red">
                  <input type="radio" name="pravilo_e" value="odbaci_krajnje" checked={forma.pravilo_e === 'odbaci_krajnje'} onChange={promeni('pravilo_e')} />
                  <span><span>Odbacuju se najviša i najniža</span>
                    <span className="sivo mali">Konačna E ocena je prosek preostalih (sa dve sudije prosek obe, sa jednom njena ocena)</span></span>
                </label>
                <label className="radio-red">
                  <input type="radio" name="pravilo_e" value="prosek_svih" checked={forma.pravilo_e === 'prosek_svih'} onChange={promeni('pravilo_e')} />
                  <span>Prosek svih E ocena</span>
                </label>
                <div className="ekipno-red">
                  <span className="pravila-naslov">Ekipno:</span><span>broje se</span>
                  <input type="text" className="unos broj ekipno" name="ekipno_broji" value={forma.ekipno_broji}
                    onChange={promeni('ekipno_broji')} aria-label="Broj ocena koje se broje za ekipu" inputMode="numeric" />
                  <span>najbolje ocene po spravi</span>
                </div>
                <label className="kucica"><input type="checkbox" name="pomeraj_redosled" checked={forma.pomeraj_redosled}
                  onChange={promeniKucicu('pomeraj_redosled')} /><span>Pomeraj redosled u grupi u svakoj rotaciji</span></label>
              </fieldset>
            </div>
          </section>
          <section className="kartica raste">
            <div className="kartica-zaglavlje"><h2 className="kartica-naslov">Zvanični podaci (za bilten i štampu)</h2></div>
            <div className="kartica-telo">
              <Polje oznaka="Zaglavlje biltena (prvi red, može biti prazno)" name="zaglavlje_biltena" value={forma.zaglavlje_biltena}
                onChange={promeni('zaglavlje_biltena')} placeholder="npr. Gimnastički savez Srbije" />
              <Polje oznaka="Organizator" name="organizator" value={forma.organizator} onChange={promeni('organizator')} />
              <Polje oznaka="Domaćin (izaberite klub ili upišite)" name="domacin" value={forma.domacin} onChange={promeni('domacin')}
                list="klubovi-lista" autoComplete="off" />
              <datalist id="klubovi-lista">{klubovi.map((k) => <option key={k.id} value={k.puno_ime} />)}</datalist>
              <div className="red-polja">
                {GRBOVI.map(([k, oznaka]) => (
                  <div className="polje raste grb-blok" key={k}><span className="oznaka">{oznaka}</span>
                    {red[`${k}_url`] && (
                      <div className="grb-red">
                        <img src={red[`${k}_url`]} alt="" />
                        <label className="kucica mali"><input type="checkbox" checked={grb[k].obrisi}
                          onChange={(ev) => promeniGrb(k, { obrisi: ev.target.checked })} /><span>ukloni</span></label>
                      </div>
                    )}
                    <div className="grb-red">
                      <button type="button" className="dugme dugme-malo" onClick={() => izaberiSliku(k)}>Izaberi sliku</button>
                      {grb[k].putanja && <span className="mali grb-ime">{imeFajla(grb[k].putanja)}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <span className="sivo mali">Bez grba takmičenja koristi se grb iz Podešavanja.</span>
              {id !== null && (
                <label className="kucica"><input type="checkbox" name="zavrseno" checked={forma.zavrseno}
                  onChange={promeniKucicu('zavrseno')} /><span>Takmičenje je završeno (arhivirano)</span></label>
              )}
            </div>
          </section>
        </div>
        <div className="dno-forme">
          <button type="submit" className="dugme dugme-glavno" disabled={radi}>
            <span>{id !== null ? 'Sačuvaj' : 'Sačuvaj i pređi na prijave'}</span><kbd>Enter</kbd>
          </button>
          <a href={LISTA} className="dugme" id="otkazi"><span>Otkaži</span><kbd>Esc</kbd></a>
          <span className="razmak" />
          {id !== null && (
            <button type="button" className="dugme dugme-opasno" id="obrisi" onClick={obrisi}>
              <Ikona ime="kanta" velicina={16} /><span>Obriši</span>
            </button>
          )}
        </div>
      </form>
    </>
  );
}
