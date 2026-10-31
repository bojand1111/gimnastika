import { memo } from 'react';
import Ikona from '../../komponente/Ikona.jsx';
import { odustaoRec, otvoren, polja } from '../unosStanje.js';

const naziv = (ime) => (ime === 'd' ? 'D ocena' : ime === 'odbitak' ? 'Odbitak' : `${ime.toUpperCase()} ocena`);

// Ćelija statusa (POPIS 5.3 i 6): čip, a za trenutni red u unosu dugmad "Potvrdi" (isto kao Enter na odbitku)
// i "Odustala|Odustao" (F8). Prečice su u opisu dugmeta, da kolona ostane uska.
function Status({ red, trenutni, h }) {
  const id = red.prijava_id;
  if (red.status === 'ne_radi') return <span className="unos-status"><span className="status">–</span></span>;
  if (red.status === 'odustao') {
    return (
      <span className="unos-status">
        <span className="status status-crn"><Ikona ime="iks" velicina={13} />{odustaoRec(red.pol)}</span>
        <button type="button" className="dugme dugme-tekst dugme-malo vrati" onClick={() => h.vrati(id)}>Vrati</button>
      </span>
    );
  }
  if (red.greskaCuvanja) {
    return (
      <span className="unos-status">
        <button type="button" className="dugme dugme-malo dugme-opasno ponovo" tabIndex={-1} onClick={() => h.ponovo(id)}>Pokušaj ponovo</button>
      </span>
    );
  }
  if (trenutni && otvoren(red)) {
    return (
      <span className="unos-status">
        <button type="button" className="dugme dugme-malo dugme-glavno potvrdi-dugme" tabIndex={-1} title="Potvrdi (Enter na odbitku)"
          onClick={() => h.potvrdi(id)}>
          Potvrdi
        </button>
        <button type="button" className="dugme dugme-malo dugme-opasno odustao-dugme" tabIndex={-1} title={`${odustaoRec(red.pol)} (F8)`}
          onClick={() => h.odustao(id)}>
          {odustaoRec(red.pol)}
        </button>
      </span>
    );
  }
  const zakljucan = !otvoren(red);
  return (
    <span className="unos-status">
      {red.ispravlja && <span className="status status-warn">Ispravka</span>}
      {!red.ispravlja && red.status === 'uneto' && <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Uneto</span>}
      {!red.ispravlja && red.status === 'ispravljeno' && <span className="status status-warn"><Ikona ime="olovka" velicina={13} />Ispravljeno</span>}
      {red.status === 'nacrt' && <span className="status">Čeka</span>}
      {zakljucan && (
        <button type="button" className="dugme dugme-ikona ispravi" aria-label="Ispravi ocenu" title="Ispravi (F9)" onClick={() => h.ispravi(id)}>
          <Ikona ime="olovka" velicina={16} />
        </button>
      )}
    </span>
  );
}

// Jedan red unosa. Props: red, brojSudija, trenutni, kolone (CSS mreža), h (stabilni rukovaoci).
function UnosRed({ red, brojSudija, trenutni, kolone, h }) {
  const id = red.prijava_id;
  const zakljucan = !otvoren(red);
  const klase = ['unos-red', red.status === 'nacrt' ? 'ceka' : '', trenutni ? 'trenutni' : '', red.ispravlja ? 'ispravlja' : '',
    red.greskaCuvanja ? 'greska-cuvanja' : ''].filter(Boolean).join(' ');
  const polje = (ime) => (
    <input key={ime} type="text" data-polje={ime} aria-label={naziv(ime)} inputMode="decimal" autoComplete="off"
      className={`ocena${zakljucan ? ' zakljucano' : ''}${red.greske.has(ime) ? ' greska' : ''}`}
      value={red.vrednosti[ime] ?? ''} readOnly={zakljucan} tabIndex={zakljucan ? -1 : undefined}
      onChange={(ev) => h.promena(id, ime, ev.target.value)} onBlur={() => h.izlaz(id, ime)} onKeyDown={(ev) => h.taster(ev, id, ime)} />
  );
  const pruga = red.status === 'ne_radi' || red.status === 'odustao';
  return (
    <div className={klase} role="row" style={{ gridTemplateColumns: kolone }} data-prijava={id} data-status={red.status}
      data-pol={red.pol} data-ime={red.ime} tabIndex={-1} onFocus={() => h.fokus(id)}>
      <span className="unos-rb broj centar">{red.rb}</span>
      <span className="broj unos-startni">{red.startni_broj ?? ''}</span>
      <span className="unos-ime-kolona">
        <span className="unos-ime-red"><span className="unos-ime" title={red.ime}>{red.ime}</span>{red.vk && <span className="status status-vk">VK</span>}</span>
      </span>
      <span className="unos-klub" title={red.klub}>{red.klub}</span>
      <span className="unos-kat" title={red.kategorija}>{red.kategorija}</span>
      {red.status === 'ne_radi' && <span className="unos-pruga" style={{ gridColumn: `span ${brojSudija + 4}` }}><span>Ne radi ovu spravu</span></span>}
      {red.status === 'odustao' && (
        <span className="unos-pruga" style={{ gridColumn: `span ${brojSudija + 4}` }}>
          <span className="unos-pruga-rec">{odustaoRec(red.pol)}</span><span>bez ocene na ovoj spravi</span>
        </span>
      )}
      {!pruga && polje('d')}
      {!pruga && polja(brojSudija).slice(1, -1).map(polje)}
      {!pruga && <span className="unos-e broj centar">{red.e}</span>}
      {!pruga && polje('odbitak')}
      {!pruga && <span className={`konacna unos-konacna${red.konacna === '–' ? ' sivo' : ''}`}>{red.konacna}</span>}
      <Status red={red} trenutni={trenutni} h={h} />
    </div>
  );
}

export default memo(UnosRed);
