import gim from '../gim.js';
import { gdeKada, imePdf } from './stampaStanje.js';
import { naslovZapisnika, straneZapisnika } from './zapisniciStanje.js';
import useStampaPodaci from './stampa/koristiStampu.js';
import StampaAlat, { useStampanje } from './stampa/StampaAlat.jsx';
import ListDno from './stampa/ListDno.jsx';

// Prazni zapisnici za sve sprave: list po spravi i rotaciji, takmicari istim redom kao na Unosu ocena, polja za ocene prazna.
export default function Zapisnici() {
  const d = useStampaPodaci('zapisnici', () => gim.unos.zapisnici());
  const nazad = '#/unos';
  const st = useStampanje({ polozeno: true, ime: d ? imePdf('zapisnici', d.takm.naziv, d.pol) : '', nazad, spremno: !!d && d.listovi.length > 0 });
  if (!d) return <div className="stampa-ekran" aria-busy="true" />;

  const deo = d.pol === 'M' ? 'MSG' : 'ŽSG';
  const z = d.pol === 'Z';
  const gde = gdeKada(d.takm);
  const strane = straneZapisnika(d.listovi);
  const sudije = Array.from({ length: d.brojSudija }, (_, i) => i + 1);
  // D, E sudije, odbitak i konacna
  const ocenaKolona = 3 + d.brojSudija;
  return (
    <div className="stampa-ekran">
      <style>{'@page { size: A4 landscape; margin: 0; }'}</style>
      <StampaAlat naslov={`Prazni zapisnici: ${deo} · ${d.takm.naziv}`} polozeno nazad={nazad} zauzeto={st.zauzeto} naStampaj={st.stampaj} naPdf={st.sacuvajPdf} />
      {strane.length === 0 && (
        <div className="list polozeno"><p>Nema takmičara za zapisnike. Prijavite takmičare i rasporedite ih u grupe.</p></div>
      )}
      {strane.map((s, i) => (
        <div key={i} className="list polozeno">
          <div className="zp-zaglavlje">
            <div className="zp-takm"><b>{d.takm.naziv}</b><span className="broj">{gde} · {deo}</span></div>
            <div className="zp-sprava">{s.list.sprava.naziv}</div>
            <div className="zp-rot">
              {s.list.rot !== null && <b>Rotacija {s.list.rot}</b>}
              <span>{s.list.grupa}{s.delova > 1 ? ` (${s.deo}/${s.delova})` : ''}</span>
            </div>
          </div>
          <table className="st-tab zp-tab">
            <thead><tr>
              <th style={{ width: 36 }}>Rb</th><th style={{ width: 44 }}>Br.</th>
              <th className="levo">{z ? 'Takmičarka' : 'Takmičar'}</th>
              <th className="levo" style={{ width: 210 }}>Klub · kategorija · program</th>
              <th style={{ width: 66 }}>D</th>
              {sudije.map((n) => <th key={n} style={{ width: 58 }}>E{n}</th>)}
              <th style={{ width: 66 }}>Odbitak</th><th style={{ width: 80 }}>Konačna</th>
            </tr></thead>
            <tbody>
              {s.redovi.map((r) => (
                <tr key={r.prijava_id}>
                  <td className="centar">{r.rb}</td>
                  <td className="centar">{r.startni_broj ?? ''}</td>
                  <td className="levo jako">{r.ime}{r.vk && <i className="zp-vk"> VK</i>}</td>
                  <td className="levo">{r.opis}</td>
                  {r.radi
                    ? Array.from({ length: ocenaKolona }, (_, k) => <td key={k} />)
                    : <td className="centar zp-ne-radi" colSpan={ocenaKolona}>ne radi ovu spravu</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <ListDno potpisi levo={naslovZapisnika(s)} desno={`Strana ${i + 1}/${strane.length}`} />
        </div>
      ))}
    </div>
  );
}
