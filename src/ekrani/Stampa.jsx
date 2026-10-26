import { useMemo } from 'react';
import gim from '../gim.js';
import { hashRang } from './rangStanje.js';
import { imePdf, legendaStampe, vremeStampe } from './stampaStanje.js';
import useStampaPodaci from './stampa/koristiStampu.js';
import StampaAlat, { useStampanje } from './stampa/StampaAlat.jsx';
import ListZaglavlje from './stampa/ListZaglavlje.jsx';
import ListSprava from './stampa/ListSprava.jsx';
import ListEkipno from './stampa/ListEkipno.jsx';
import ListViseboj from './stampa/ListViseboj.jsx';
import ListDno from './stampa/ListDno.jsx';

// Ekran Stampa rang liste (POPIS 4): cela strana bez menija, listovi A4 spremni za stampu.
export default function Stampa() {
  const d = useStampaPodaci('stampa', (p) => gim.rang.stampa(p.pol, p.kat, p.prog, p.tab));
  // Vreme se uzima jednom, pri prikazu podataka (POPIS 9.3)
  const vreme = useMemo(() => vremeStampe(new Date()), [d]);
  const polozeno = d ? d.polozeno : false;
  const nazad = d ? hashRang(d.izbor.pol, d.izbor.kat, d.izbor.prog, d.tab) : '#/rang';
  const vrsta = d ? (d.sprava ? d.sprava.naziv : (d.tab === 'ekipno' ? 'Ekipno' : 'Višeboj')) : '';
  const st = useStampanje({ polozeno, ime: d ? imePdf(vrsta, d.takm.naziv, d.izbor.pol) : '', nazad });
  if (!d) return <div className="stampa-ekran" aria-busy="true" />;

  const { takm, izbor, rez, tab, strane, naziv, grb } = d;
  const legenda = legendaStampe(takm, tab, izbor.pol);
  return (
    <div className="stampa-ekran">
      {polozeno && <style>{'@page { size: A4 landscape; margin: 0; }'}</style>}
      <StampaAlat naslov={`Štampa: ${naziv}`} polozeno={polozeno} nazad={nazad} zauzeto={st.zauzeto} naStampaj={st.stampaj} naPdf={st.sacuvajPdf} />
      {strane.map((redovi, i) => (
        <div key={i} className={`list${polozeno ? ' polozeno' : ''}`}>
          <ListZaglavlje takm={takm} naziv={naziv} grb={grb} vreme={vreme} />
          {d.sprava ? <ListSprava redovi={redovi} rez={rez} pol={izbor.pol} />
            : tab === 'ekipno' ? <ListEkipno redovi={redovi} rez={rez} />
              : <ListViseboj redovi={redovi} rez={rez} pol={izbor.pol} polozeno={polozeno} />}
          <ListDno
            legenda={i === strane.length - 1 ? legenda : null}
            potpisi={i === strane.length - 1}
            levo={<>Odštampano <span className="broj">{vreme.puno}</span></>}
            desno={`Strana ${i + 1} od ${strane.length}`}
          />
        </div>
      ))}
    </div>
  );
}
