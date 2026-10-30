import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Sifarnik from '../komponente/Sifarnik.jsx';
import { obavesti } from '../okvir/Poruke.jsx';
import { deoNaziv } from './takmicariFilter.js';

const SIRINE = {
  kategorije: { flex: '1 1 0', minWidth: 0 },
  programi: { width: 216, flex: 'none' },
  sprave: { width: 308, flex: 'none' },
};

const IZBORI = [
  ['e_zaokruzivanje', 'Prosek E ocene na tri decimale', [['odseci', 'Odsecanje (8,233)'], ['zaokruzi', 'Zaokruživanje']]],
  ['plasman_isti_rezultat', 'Isti rezultat', [['deli', 'Dele mesto (1, 2, 2, 4)'], ['visa_e_pa_d', 'Viša E, pa viša D']]],
  ['viseboj_nepotpun', 'Ko ne radi sve sprave', [['ulazi', 'Ulazi u višeboj (zbir urađenih)'], ['ne_ulazi', 'Nema plasman u višeboju']]],
  ['lekarski_sprecava_prijavu', 'Lekarski koji ne važi', [['ne', 'Samo upozorenje'], ['da', 'Sprečava prijavu']]],
];

const GRBOVI = [['grb_levo', 'Grb levo (ako takmičenje nema svoj)'], ['grb_desno', 'Grb desno (ako takmičenje nema svoj)']];

// Polja pravila izabranog dela (kartica "Pravila") i opstih podesavanja racunara (kartica "Za ovaj racunar").
const PRAVILA = [...IZBORI.map(([ime]) => ime), 'organizator'];
const OPSTA = ['lekarski_prag_dana', 'sajt_url', 'sajt_token'];
const BEZ_GRBA = { grb_levo: { obrisi: false, putanja: '' }, grb_desno: { obrisi: false, putanja: '' } };

const izdvoj = (s, kljucevi) => Object.fromEntries(kljucevi.map((k) => [k, s[k]]));
const imeFajla = (p) => p.split(/[\\/]/).pop();

export default function Podesavanja() {
  const [meta, postaviMeta] = useState(null); // {vrste, ikone}
  const [sva, postaviSva] = useState(null);
  const [forma, postaviFormu] = useState({});
  const [grb, postaviGrb] = useState(BEZ_GRBA);
  const [prikaziToken, postaviPrikaziToken] = useState(false);
  const [zauzeto, postaviZauzeto] = useState(false); // proveri/posalji u toku (aria-disabled ne gubi fokus)
  const radi = useRef(false);

  // Posle upisa se ponovo cita samo ono sto je upisano, da nesacuvane izmene druge kartice ostanu.
  const ucitajSva = useCallback(async (kljucevi) => {
    try {
      const s = await gim.podesavanja.sva();
      postaviSva(s);
      postaviFormu((f) => ({ ...f, ...izdvoj(s, kljucevi) }));
      if (kljucevi.includes('organizator')) postaviGrb(BEZ_GRBA);
    } catch (e) { obavesti(e.message, 'greska'); }
  }, []);

  useEffect(() => {
    (async () => {
      try { postaviMeta(await gim.sifarnici.vrste()); } catch (e) { obavesti(e.message, 'greska'); }
    })();
    ucitajSva([...PRAVILA, ...OPSTA]);
  }, [ucitajSva]);

  const promeni = (polje) => (ev) => postaviFormu((f) => ({ ...f, [polje]: ev.target.value }));
  const promeniGrb = (kljuc, d) => postaviGrb((g) => ({ ...g, [kljuc]: { ...g[kljuc], ...d } }));

  async function izaberiSliku(kljuc) {
    try {
      const p = await gim.podesavanja.izaberiGrb();
      if (p) promeniGrb(kljuc, { putanja: p, obrisi: false });
    } catch (e) { obavesti(e.message, 'greska'); }
  }

  // Server upisuje pravila i grbove za izabrani deo; opsta polja ne salje.
  async function sacuvajPravila(ev) {
    ev.preventDefault();
    const p = izdvoj(forma, PRAVILA);
    for (const [k] of GRBOVI) {
      if (grb[k].obrisi) p[k] = { obrisi: true };
      else if (grb[k].putanja) p[k] = { putanja: grb[k].putanja };
    }
    try {
      await gim.podesavanja.sacuvajOpsta(p);
      obavesti(`Pravila za ${deoNaziv(sva.pol)} su sačuvana.`);
      await ucitajSva(PRAVILA);
    } catch (e) {
      obavesti(e.message, 'greska');
    }
  }

  async function sacuvajOpsta(ev) {
    ev.preventDefault();
    try {
      await gim.podesavanja.sacuvajOpsta(izdvoj(forma, OPSTA));
      obavesti('Podešavanja za ovaj računar su sačuvana.');
      await ucitajSva(OPSTA);
    } catch (e) {
      obavesti(e.message, 'greska');
    }
  }

  // Proveri vezu i Pošalji sada koriste sačuvane vrednosti, ne ono što je trenutno u poljima.
  async function pozovi(radnja) {
    if (radi.current) return;
    radi.current = true;
    postaviZauzeto(true);
    try {
      await radnja();
    } catch (e) {
      obavesti(e.message, 'greska');
    } finally {
      radi.current = false;
      postaviZauzeto(false);
    }
  }

  const proveriVezu = () => pozovi(async () => {
    const r = await gim.sinhro.ping();
    if (r.ok) obavesti(`Veza sa sajtom radi: ${r.sajt}.`);
    else obavesti(r.greska === 'Sajt nije dostupan.' ? r.greska : `Sajt nije dostupan: ${r.greska}`, 'greska');
  });

  const posaljiSada = () => pozovi(async () => {
    const r = await gim.sinhro.posalji();
    if (r.ok) obavesti(`Rang liste su poslate (${r.liste} lista).`);
    else obavesti(r.greska, 'greska');
  });

  const deo = sva ? deoNaziv(sva.pol) : '';

  return (
    <>
      <p style={{ fontSize: 14, color: 'var(--ink-2)' }}>
        {deo && <b>{deo}: </b>}
        Liste i pravila ispod važe samo za ovaj deo; drugi deo ima svoje. Liste se koriste u prijavama, unosu ocena i rang listama.
        Redosled se menja prevlačenjem ili tasterima Alt+↑ i Alt+↓, a redosled sprava je i redosled kolona u višeboju.
      </p>
      <div className="red" id="sifarnici">
        {meta && Object.entries(meta.vrste).map(([vrsta, m]) => (
          <Sifarnik key={vrsta} vrsta={vrsta} meta={m} ikone={meta.ikone} sprava={vrsta === 'sprave'} sirina={SIRINE[vrsta]} />
        ))}
      </div>

      {sva && (
        <section className="kartica" id="kartica-pravila">
          <div className="kartica-zaglavlje">
            <h2 className="kartica-naslov">Pravila · {deo}</h2>
            <span className="sivo mali">Otvorena pitanja iz specifikacije: potvrditi sa naručiocem pre takmičenja</span>
          </div>
          <form className="forma" id="pravila-forma" style={{ padding: 16 }} onSubmit={sacuvajPravila}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
              {IZBORI.map(([ime, oznaka, opcije]) => (
                <label className="polje" key={ime}><span className="oznaka">{oznaka}</span>
                  <select className="unos" name={ime} value={forma[ime] ?? ''} onChange={promeni(ime)}>
                    {opcije.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <label className="polje"><span className="oznaka">Organizator (za bilten)</span>
                <input type="text" className="unos" name="organizator" placeholder="npr. Gimnastički savez Vojvodine"
                  value={forma.organizator ?? ''} onChange={promeni('organizator')} />
              </label>
              {GRBOVI.map(([k, oznaka]) => (
                <div className="polje" key={k}><span className="oznaka">{oznaka}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {sva[`${k}_url`] && (
                      <>
                        <img src={sva[`${k}_url`]} alt="" style={{ height: 36, width: 'auto', maxWidth: 60 }} />
                        <label className="kucica mali"><input type="checkbox" checked={grb[k].obrisi}
                          onChange={(ev) => promeniGrb(k, { obrisi: ev.target.checked })} /><span>ukloni</span></label>
                      </>
                    )}
                    <button type="button" className="dugme dugme-malo" onClick={() => izaberiSliku(k)}>Izaberi sliku</button>
                    {grb[k].putanja && <span className="mali" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imeFajla(grb[k].putanja)}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="forma-akcije"><button type="submit" className="dugme dugme-glavno">Sačuvaj pravila</button></div>
          </form>
        </section>
      )}

      {sva && (
        <section className="kartica" id="kartica-racunar">
          <div className="kartica-zaglavlje">
            <h2 className="kartica-naslov">Za ovaj računar</h2>
            <span className="sivo mali">Isto u MSG i ŽSG</span>
          </div>
          <form className="forma" id="racunar-forma" style={{ padding: 16 }} onSubmit={sacuvajOpsta}>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 2fr 1fr', gap: 12, alignItems: 'end' }}>
              <label className="polje"><span className="oznaka">Prag upozorenja za lekarski (dana)</span>
                <input type="number" className="unos broj" name="lekarski_prag_dana" min={0} max={365}
                  value={forma.lekarski_prag_dana ?? ''} onChange={promeni('lekarski_prag_dana')} />
              </label>
              <label className="polje"><span className="oznaka">Adresa sajta za rezultate uživo</span>
                <input type="text" className="unos" name="sajt_url" placeholder="https://"
                  autoComplete="off" spellCheck={false} value={forma.sajt_url ?? ''} onChange={promeni('sajt_url')} />
              </label>
              <div className="polje"><label className="oznaka" htmlFor="sajt-token">Token</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="sajt-token" type={prikaziToken ? 'text' : 'password'} className="unos" name="sajt_token"
                    autoComplete="off" spellCheck={false} style={{ flex: '1 1 0', minWidth: 0 }}
                    value={forma.sajt_token ?? ''} onChange={promeni('sajt_token')} />
                  <button type="button" className="dugme" aria-pressed={prikaziToken} onClick={() => postaviPrikaziToken((v) => !v)}>
                    {prikaziToken ? 'Sakrij' : 'Prikaži'}
                  </button>
                </div>
              </div>
            </div>
            <p className="mali">
              Program šalje rang liste aktivnog takmičenja izabranog dela posle svake potvrđene ocene. Dok je adresa prazna, ništa se ne šalje. Adresa mora da počinje sa https:// (http:// samo za probni server na ovom računaru).
              „Proveri vezu“ i „Pošalji sada“ koriste već sačuvanu adresu i token, pa prvo sačuvajte podešavanja.
              Fascikla za rezervne kopije se bira na ekranu Rezervna kopija.
            </p>
            <div className="forma-akcije">
              <button type="button" className={`dugme${zauzeto ? ' iskljuceno' : ''}`} aria-disabled={zauzeto || undefined} onClick={proveriVezu}>Proveri vezu</button>
              <button type="button" className={`dugme${zauzeto ? ' iskljuceno' : ''}`} aria-disabled={zauzeto || undefined} onClick={posaljiSada}>Pošalji sada</button>
              <button type="submit" className="dugme dugme-glavno">Sačuvaj podešavanja</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
