import Ikona from '../komponente/Ikona.jsx';
import { url } from '../ruter.js';
import IzborDela from './IzborDela.jsx';

// [grupa, [[ruta, tekst, ikona, precica]]] kao u okvir.php
const GRUPE = [
  ['', [['pocetna', 'Početna', 'meni-pocetna', '']]],
  ['Baza', [['klubovi', 'Klubovi', 'meni-klubovi', ''], ['takmicari', 'Takmičari', 'meni-takmicari', ''], ['podesavanja', 'Podešavanja', 'meni-podesavanja', '']]],
  ['Takmičenje', [['takmicenja', 'Takmičenja', 'meni-takmicenja', ''], ['takmicenje', 'Pregled', 'trenutni', ''], ['prijave', 'Prijave', 'meni-prijave', ''], ['rotacije', 'Rotacije', 'meni-rotacije', ''], ['unos', 'Unos ocena', 'meni-unos-ocena', 'F2'], ['rang', 'Rang liste', 'meni-rang-liste', 'F4']]],
  ['Sistem', [['kopija', 'Rezervna kopija', 'meni-rezervna-kopija', '']]],
];

// Aktivna stavka po prvom delu puta; rezultati/stampa/bilten svetle Rang liste, sistem nijednu.
function aktivnaStavka(ekran) {
  const prvi = ekran.split('/')[0];
  if (['rezultati', 'stampa', 'bilten'].includes(prvi)) return 'rang';
  if (prvi === 'sistem') return '';
  return prvi;
}

export default function Meni({ ekran, verzija, pol, naPromenuPola }) {
  const aktivan = aktivnaStavka(ekran);
  return (
    <aside className="meni">
      <div className="meni-vrh">
        <span className="meni-znak"><Ikona ime="znak-aplikacije" velicina={22} /></span>
        <div className="meni-naziv"><b>Gimnastika</b><span>Vođenje takmičenja</span></div>
      </div>
      <div className="meni-deo"><IzborDela pol={pol} naPromenu={naPromenuPola} /></div>
      <nav aria-label="Glavni meni">
        {GRUPE.map(([grupa, stavke]) => (
          <div key={grupa} style={{ display: 'contents' }}>
            {grupa !== '' && <div className="meni-grupa">{grupa}</div>}
            {stavke.map(([ruta, tekst, ik, precica]) => (
              <a key={ruta} href={url(ruta)} className={`meni-stavka ${aktivan === ruta ? 'aktivna' : ''}`} aria-current={aktivan === ruta ? 'page' : undefined}>
                <Ikona ime={ik} velicina={18} /><span>{tekst}</span>{precica !== '' && <kbd>{precica}</kbd>}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="meni-dno"><span>Verzija</span><span className="broj">{verzija}</span></div>
    </aside>
  );
}

// Naslov ekrana: tekst stavke menija ili poseban naslov; nepoznat ekran daje svoje ime.
export function naslovEkrana(ekran) {
  if (ekran === 'takmicenja/novo') return 'Novo takmičenje';
  if (ekran === 'takmicenja/izmeni') return 'Takmičenje: podaci';
  if (ekran === 'takmicenje') return 'Pregled takmičenja';
  const prvi = ekran.split('/')[0];
  if (prvi === 'sistem') return 'Vizuelni sistem';
  if (prvi === 'uvoz') return 'Uvoz prijava';
  if (prvi === 'rezultati') return 'Rezultati takmičara';
  for (const [, stavke] of GRUPE) {
    for (const [ruta, tekst] of stavke) if (ruta === prvi) return tekst;
  }
  return prvi;
}
