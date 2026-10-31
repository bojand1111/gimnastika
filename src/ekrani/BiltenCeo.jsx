import gim from '../gim.js';
import { gdeKada, imePdf, legendaBiltena } from './stampaStanje.js';
import useStampaPodaci from './stampa/koristiStampu.js';
import StampaAlat, { useStampanje } from './stampa/StampaAlat.jsx';
import BiltenZaglavlje from './stampa/BiltenZaglavlje.jsx';
import BiltenTabele from './stampa/BiltenTabele.jsx';
import ListDno from './stampa/ListDno.jsx';

// Ceo bilten: bilteni svih kategorija i programa aktivnog takmicenja jedan za drugim, strane brojane kroz ceo dokument.
export default function BiltenCeo() {
  const d = useStampaPodaci('ceo-bilten', () => gim.rang.bilteni());
  const polozeno = d ? d.polozeno : false;
  const nazad = '#/rang';
  const st = useStampanje({ polozeno, ime: d ? imePdf('ceo-bilten', d.takm.naziv, d.pol) : '', nazad, spremno: !!d });
  if (!d) return <div className="stampa-ekran" aria-busy="true" />;

  const ukupno = d.sekcije.reduce((n, s) => n + s.strane.length, 0);
  const gde = gdeKada(d.takm);
  const naslov = `Ceo bilten: ${d.pol === 'M' ? 'MSG' : 'ŽSG'} · ${d.takm.naziv}`;
  let strana = 0;
  return (
    <div className="stampa-ekran">
      {polozeno && <style>{'@page { size: A4 landscape; margin: 0; }'}</style>}
      <StampaAlat naslov={naslov} polozeno={polozeno} nazad={nazad} zauzeto={st.zauzeto} naStampaj={st.stampaj} naPdf={st.sacuvajPdf} />
      {d.sekcije.map((s) => s.strane.map((stavke, i) => {
        strana += 1;
        return (
          <div key={`${s.izbor.kat}-${s.izbor.prog}-${i}`} className={`list${polozeno ? ' polozeno' : ''}`}>
            <BiltenZaglavlje prva={i === 0} takm={s.takm} disciplina={s.disciplina} organizator={s.organizator}
              grbLevo={s.grbLevo} grbDesno={s.grbDesno} gde={gde} />
            <BiltenTabele stavke={stavke} rez={s.rez} pol={s.izbor.pol} />
            <ListDno
              legenda={i === s.strane.length - 1 ? [legendaBiltena(s.takm)] : null}
              levo={<span className="broj">{gde}</span>}
              desno={`Strana ${strana}/${ukupno}`}
            />
          </div>
        );
      }))}
    </div>
  );
}
