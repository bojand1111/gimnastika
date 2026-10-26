import { prikaz, prikazD } from '../../../electron/racun/broj.mjs';
import { ekipaRec, grupisiSekcije, mestoTekst, odustalaRec } from '../stampaStanje.js';
import { mnozina } from '../rangStanje.js';

// Zaglavlje ekipne tabele (POPIS 5.2).
function GlavaEkipno({ sprave }) {
  return (
    <thead><tr>
      <th style={{ width: 46 }}>Mesto</th><th className="levo">Ekipa, članovi</th>
      {sprave.map((s) => <th key={s.id} style={{ width: sprave.length > 4 ? 100 : 96 }}>{s.naziv}</th>)}
      <th style={{ width: 90 }}>Ukupno</th>
    </tr></thead>
  );
}

// Zaglavlje visebojne tabele: colgroup i dva reda zaglavlja (D, E, Uk. po spravi).
function GlavaViseboj({ sprave }) {
  return (
    <>
      <colgroup>
        <col style={{ width: 36 }} /><col />
        {sprave.map((s) => [<col key={`d${s.id}`} style={{ width: 28 }} />, <col key={`e${s.id}`} style={{ width: 44 }} />, <col key={`u${s.id}`} style={{ width: 46 }} />])}
        <col style={{ width: 54 }} />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2}>Mesto</th><th rowSpan={2} className="levo">Ime, klub</th>
          {sprave.map((s) => <th key={s.id} colSpan={3}>{s.naziv}</th>)}
          <th rowSpan={2}>Ukupno</th>
        </tr>
        <tr>{sprave.map((s) => [<th key={`d${s.id}`}>D</th>, <th key={`e${s.id}`}>E</th>, <th key={`u${s.id}`}>Uk.</th>])}</tr>
      </thead>
    </>
  );
}

function Ocene({ sprave, ocene, broji }) {
  return sprave.map((s) => {
    const v = ocene[s.id] ?? null;
    return <td key={s.id}>{v === null ? '–' : (broji[s.id] ? prikaz(v) : `(${prikaz(v)})`)}</td>;
  });
}

function RedEkipa({ p, sprave }) {
  return (
    <tr className="ekipa">
      <td className="centar">{mestoTekst(p.mesto, p.oznaka)}</td>
      <td className="levo">{p.klub.puno_ime ?? ''}{(p.klub.grad ?? '') !== '' ? ` ${p.klub.grad}` : ''}</td>
      {sprave.map((s) => <td key={s.id}>{prikaz(p.po_spravi[s.id] ?? 0)}</td>)}
      <td>{prikaz(p.ukupno)}</td>
    </tr>
  );
}

function RedClan({ p, rez }) {
  const pr = rez.prijave[p.prijava];
  return (
    <tr>
      <td></td><td className="levo" style={{ paddingLeft: 14 }}>{`${pr.prezime} ${pr.ime}`}</td>
      <Ocene sprave={rez.sprave} ocene={p.ocene} broji={p.broji} />
      <td></td>
    </tr>
  );
}

function RedViseboj({ p, rez, pol }) {
  const pr = rez.prijave[p.prijava];
  return (
    <tr>
      <td className="centar jako">{mestoTekst(p.mesto, p.oznaka)}</td>
      <td className="levo">
        <b>{`${pr.prezime} ${pr.ime}`}</b>
        {/* Oznaka odustajanja ide u red kluba kao na slici 09d: u redu sa imenom bi je kolona isekla */}
        <span className="klub">{pr.klub_ime ?? ''}{p.odustao && <>{(pr.klub_ime ?? '') !== '' && ' · '}<i>{odustalaRec(pol)}</i></>}</span>
      </td>
      {rez.sprave.map((s) => {
        const d = p.detalji[s.id] ?? null;
        if (d === null || d.status === 'odustao') {
          return [<td key={`d${s.id}`} className="centar">–</td>, <td key={`e${s.id}`} className="centar">–</td>, <td key={`u${s.id}`} className="centar">–</td>];
        }
        return [<td key={`d${s.id}`}>{prikazD(d.d)}</td>, <td key={`e${s.id}`}>{prikaz(d.e)}</td>, <td key={`u${s.id}`} className="jako">{prikaz(d.konacna)}</td>];
      })}
      <td className="jako" style={{ fontSize: 13 }}>{p.zbir !== null ? prikaz(p.zbir) : '–'}</td>
    </tr>
  );
}

// Sekcije jedne strane biltena (POPIS 5.2); brojevi u naslovu su ukupni i ponavljaju se na nastavku.
export default function BiltenTabele({ stavke, rez, pol }) {
  if (stavke.length === 0) return <p className="sivo" style={{ marginTop: 24, textAlign: 'center' }}>Još nema unetih ocena.</p>;
  return grupisiSekcije(stavke).map((g) => {
    if (g.sekcija === 'ekipno') {
      const n = rez.ekipno.length;
      return (
        <div key="ekipno">
          <div className="st-sekcija"><b>Rezultati ekipno</b><span>{n} {ekipaRec(n)}</span></div>
          <table className="st-tab">
            <GlavaEkipno sprave={rez.sprave} />
            <tbody>
              {g.stavke.map((s, i) => (s.tip === 'ekipa'
                ? <RedEkipa key={`e${s.podaci.klub.id}`} p={s.podaci} sprave={rez.sprave} />
                : <RedClan key={`c${s.podaci.prijava}-${i}`} p={s.podaci} rez={rez} />))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div key="viseboj">
        <div className="st-sekcija"><b>Višeboj</b><span>{rez.viseboj.length} {mnozina(pol)}</span></div>
        <table className="st-tab uska">
          <GlavaViseboj sprave={rez.sprave} />
          <tbody>{g.stavke.map((s) => <RedViseboj key={`r${s.podaci.prijava}`} p={s.podaci} rez={rez} pol={pol} />)}</tbody>
        </table>
      </div>
    );
  });
}
