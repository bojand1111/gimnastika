import { useCallback, useEffect, useRef, useState } from 'react';
import gim from '../gim.js';
import Sifarnik from '../komponente/Sifarnik.jsx';
import { obavesti } from '../okvir/Poruke.jsx';

const SIRINE = {
  kategorije: { flex: '1 1 0', minWidth: 0 },
  programi: { width: 216, flex: 'none' },
  sprave_m: { width: 308, flex: 'none' },
  sprave_z: { width: 308, flex: 'none' },
};

const IZBORI = [
  ['e_zaokruzivanje', 'Prosek E ocene na tri decimale', [['odseci', 'Odsecanje (8,233)'], ['zaokruzi', 'Zaokruživanje']]],
  ['plasman_isti_rezultat', 'Isti rezultat', [['deli', 'Dele mesto (1, 2, 2, 4)'], ['visa_e_pa_d', 'Viša E, pa viša D']]],
  ['viseboj_nepotpun', 'Ko ne radi sve sprave', [['ulazi', 'Ulazi u višeboj (zbir urađenih)'], ['ne_ulazi', 'Nema plasman u višeboju']]],
  ['lekarski_sprecava_prijavu', 'Lekarski koji ne važi', [['ne', 'Samo upozorenje'], ['da', 'Sprečava prijavu']]],
];

const GRBOVI = [['grb_levo', 'Grb levo (ako takmičenje nema svoj)'], ['grb_desno', 'Grb desno (ako takmičenje nema svoj)']];

const imeFajla = (p) => p.split(/[\\/]/).pop();

export default function Podesavanja() {
  const [meta, postaviMeta] = useState(null); // {vrste, ikone}
  const [sva, postaviSva] = useState(null);
  const [forma, postaviFormu] = useState({});
  const [grb, postaviGrb] = useState({ grb_levo: { obrisi: false, putanja: '' }, grb_desno: { obrisi: false, putanja: '' } });
  const [prikaziToken, postaviPrikaziToken] = useState(false);
  const [zauzeto, postaviZauzeto] = useState(false); // proveri/posalji u toku (aria-disabled ne gubi fokus)
  const radi = useRef(false);

  const ucitajSva = useCallback(async () => {
    try {
      const s = await gim.podesavanja.sva();
      postaviSva(s);
      postaviFormu({
        e_zaokruzivanje: s.e_zaokruzivanje, plasman_isti_rezultat: s.plasman_isti_rezultat,
        viseboj_nepotpun: s.viseboj_nepotpun, lekarski_sprecava_prijavu: s.lekarski_sprecava_prijavu,
        lekarski_prag_dana: s.lekarski_prag_dana, organizator: s.organizator,
        sajt_url: s.sajt_url, sajt_token: s.sajt_token,
      });
      postaviGrb({ grb_levo: { obrisi: false, putanja: '' }, grb_desno: { obrisi: false, putanja: '' } });
    } catch (e) { obavesti(e.message, 'greska'); }
  }, []);

  useEffect(() => {
    (async () => {
      try { postaviMeta(await gim.sifarnici.vrste()); } catch (e) { obavesti(e.message, 'greska'); }
    })();
    ucitajSva();
  }, [ucitajSva]);

  const promeni = (polje) => (ev) => postaviFormu((f) => ({ ...f, [polje]: ev.target.value }));
  const promeniGrb = (kljuc, d) => postaviGrb((g) => ({ ...g, [kljuc]: { ...g[kljuc], ...d } }));

  async function izaberiSliku(kljuc) {
    try {
      const p = await gim.podesavanja.izaberiGrb();
      if (p) promeniGrb(kljuc, { putanja: p, obrisi: false });
    } catch (e) { obavesti(e.message, 'greska'); }
  }

  async function sacuvaj(ev) {
    ev.preventDefault();
    const p = { ...forma };
    for (const [k] of GRBOVI) {
      if (grb[k].obrisi) p[k] = { obrisi: true };
      else if (grb[k].putanja) p[k] = { putanja: grb[k].putanja };
    }
    try {
      await gim.podesavanja.sacuvajOpsta(p);
      obavesti('Podešavanja su sačuvana.');
      await ucitajSva();
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
    else obavesti(`Sajt nije dostupan: ${r.greska}`, 'greska');
  });

  const posaljiSada = () => pozovi(async () => {
    const r = await gim.sinhro.posalji();
    if (r.ok) obavesti(`Rang liste su poslate (${r.liste} lista).`);
    else obavesti(r.greska, 'greska');
  });

  return (
    <>
      <p style={{ fontSize: 14, color: 'var(--ink-2)' }}>
        Liste koje se koriste u prijavama, unosu ocena i rang listama. Redosled se menja prevlačenjem ili tasterima Alt+↑ i Alt+↓,
        a redosled sprava je i redosled kolona u višeboju.
      </p>
      <div className="red" id="sifarnici">
        {meta && Object.entries(meta.vrste).map(([vrsta, m]) => (
          <Sifarnik key={vrsta} vrsta={vrsta} meta={m} ikone={meta.ikone} sprava={m.pol !== null} sirina={SIRINE[vrsta]} />
        ))}
      </div>

      <section className="kartica">
        <div className="kartica-zaglavlje">
          <h2 className="kartica-naslov">Pravila računanja i ostalo</h2>
          <span className="sivo mali">Otvorena pitanja iz specifikacije: potvrditi sa naručiocem pre takmičenja</span>
        </div>
        {sva && (
          <form className="forma" id="podesavanja-forma" style={{ padding: 16 }} onSubmit={sacuvaj}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
              {IZBORI.map(([ime, oznaka, opcije]) => (
                <label className="polje" key={ime}><span className="oznaka">{oznaka}</span>
                  <select className="unos" name={ime} value={forma[ime]} onChange={promeni(ime)}>
                    {opcije.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <label className="polje"><span className="oznaka">Prag upozorenja za lekarski (dana)</span>
                <input type="number" className="unos broj" name="lekarski_prag_dana" min={0} max={365}
                  value={forma.lekarski_prag_dana} onChange={promeni('lekarski_prag_dana')} />
              </label>
              <label className="polje"><span className="oznaka">Organizator (za bilten)</span>
                <input type="text" className="unos" name="organizator" placeholder="npr. Gimnastički savez Vojvodine"
                  value={forma.organizator} onChange={promeni('organizator')} />
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
            <div className="forma-akcije"><button type="submit" className="dugme dugme-glavno">Sačuvaj podešavanja</button></div>
          </form>
        )}
      </section>

      {sva && (
        <section className="kartica">
          <div className="kartica-zaglavlje">
            <h2 className="kartica-naslov">Rezultati uživo na sajtu</h2>
          </div>
          <div className="forma" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'end' }}>
              <label className="polje"><span className="oznaka">Adresa sajta</span>
                <input type="text" className="unos" name="sajt_url" form="podesavanja-forma" placeholder="https://"
                  autoComplete="off" spellCheck={false} value={forma.sajt_url ?? ''} onChange={promeni('sajt_url')} />
              </label>
              <div className="polje"><label className="oznaka" htmlFor="sajt-token">Token</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="sajt-token" type={prikaziToken ? 'text' : 'password'} className="unos" name="sajt_token" form="podesavanja-forma"
                    autoComplete="off" spellCheck={false} style={{ flex: '1 1 0', minWidth: 0 }}
                    value={forma.sajt_token ?? ''} onChange={promeni('sajt_token')} />
                  <button type="button" className="dugme" aria-pressed={prikaziToken} onClick={() => postaviPrikaziToken((v) => !v)}>
                    {prikaziToken ? 'Sakrij' : 'Prikaži'}
                  </button>
                </div>
              </div>
            </div>
            <p className="mali">
              Program šalje rang liste aktivnog takmičenja posle svake potvrđene ocene. Dok je adresa prazna, ništa se ne šalje.
              „Proveri vezu“ i „Pošalji sada“ koriste već sačuvanu adresu i token, pa prvo sačuvajte podešavanja.
            </p>
            <div className="forma-akcije">
              <button type="button" className={`dugme${zauzeto ? ' iskljuceno' : ''}`} aria-disabled={zauzeto || undefined} onClick={proveriVezu}>Proveri vezu</button>
              <button type="button" className={`dugme${zauzeto ? ' iskljuceno' : ''}`} aria-disabled={zauzeto || undefined} onClick={posaljiSada}>Pošalji sada</button>
              <button type="submit" form="podesavanja-forma" className="dugme dugme-glavno">Sačuvaj podešavanja</button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
