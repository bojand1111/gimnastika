import gim from '../gim.js';
import { hashRang } from './rangStanje.js';
import { gdeKada, imePdf, legendaBiltena } from './stampaStanje.js';
import useStampaPodaci, { izHasha } from './stampa/koristiStampu.js';
import StampaAlat, { useStampanje } from './stampa/StampaAlat.jsx';
import BiltenZaglavlje from './stampa/BiltenZaglavlje.jsx';
import BiltenTabele from './stampa/BiltenTabele.jsx';
import ListDno from './stampa/ListDno.jsx';

// Ekran Bilten (POPIS 5): veliko zaglavlje na prvoj strani, sekcije ekipno i viseboj sa ponovljenim zaglavljem.
export default function Bilten() {
  const d = useStampaPodaci('bilten', (p) => gim.rang.bilten(p.pol, p.kat, p.prog));
  const polozeno = d ? d.polozeno : false;
  // Nazad bez taba (kao PHP)
  const nazad = d ? hashRang(d.izbor.pol, d.izbor.kat, d.izbor.prog) : hashRang(izHasha().pol, izHasha().kat, izHasha().prog);
  const st = useStampanje({ polozeno, ime: d ? imePdf('bilten', d.takm.naziv, d.izbor.pol) : '', nazad, spremno: !!d });
  if (!d) return <div className="stampa-ekran" aria-busy="true" />;

  const { takm, izbor, rez, strane, disciplina, organizator, grbLevo, grbDesno } = d;
  const gde = gdeKada(takm);
  const naslov = `Bilten: ${izbor.pol === 'M' ? 'MSG' : 'ŽSG'} · ${izbor.kat_naziv} · ${izbor.prog_naziv}`;
  return (
    <div className="stampa-ekran">
      {polozeno && <style>{'@page { size: A4 landscape; margin: 0; }'}</style>}
      <StampaAlat naslov={naslov} polozeno={polozeno} nazad={nazad} zauzeto={st.zauzeto} naStampaj={st.stampaj} naPdf={st.sacuvajPdf} />
      {strane.map((stavke, i) => (
        <div key={i} className={`list${polozeno ? ' polozeno' : ''}`}>
          <BiltenZaglavlje prva={i === 0} takm={takm} disciplina={disciplina} organizator={organizator} grbLevo={grbLevo} grbDesno={grbDesno} gde={gde} />
          <BiltenTabele stavke={stavke} rez={rez} pol={izbor.pol} />
          <ListDno
            legenda={i === strane.length - 1 ? [legendaBiltena(takm)] : null}
            levo={<span className="broj">{gde}</span>}
            desno={`Strana ${i + 1}/${strane.length}`}
          />
        </div>
      ))}
    </div>
  );
}
