import Ikona from '../../komponente/Ikona.jsx';
import { hashEkrana, mestoPodaci, odustaoRec } from '../rangStanje.js';

// Celija mesta: VK cip, "–", plocica za prva tri ili obican broj. `plain`: "–" bez broj klase (Rezultati).
export default function Mesto({ podaci, plain = false }) {
  const { vrsta, tekst } = podaci;
  if (vrsta === 'vk') return <span className="status status-vk">VK</span>;
  if (vrsta === 'prazno') return plain ? <span className="sivo">{tekst}</span> : <span className="broj sivo mesto-prazno">{tekst}</span>;
  return <span className={vrsta === 'plocica' ? 'mesto-plocica' : 'mesto-obicno'}>{tekst}</span>;
}

export const mestoCelija = (mesto, oznaka) => <Mesto podaci={mestoPodaci(mesto, oznaka)} />;

// Ime takmicara kao link na Rezultate (zadrzava filtere).
export function ImeLink({ p, izbor, sivo = false }) {
  const h = hashEkrana('rezultati', { t: p.takmicar_id, kat: izbor.kat, prog: izbor.prog });
  return <a href={h} className={`rang-ime${sivo ? ' sivo' : ''}`}>{`${p.prezime} ${p.ime}`}</a>;
}

// Ime sa oznakama "van konkurencije" i "odustao" (spravne liste i viseboj).
export function ImeSaOznakama({ p, izbor, vk, odustao }) {
  return (
    <span className="rang-ime-red">
      <ImeLink p={p} izbor={izbor} sivo={odustao} />
      {vk && <span className="mali sek">van konkurencije</span>}
      {odustao && <span className="status status-crn"><Ikona ime="iks" velicina={13} />{odustaoRec(izbor.pol)}</span>}
    </span>
  );
}
