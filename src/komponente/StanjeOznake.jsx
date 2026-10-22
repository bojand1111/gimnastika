import Ikona from './Ikona.jsx';

// Oznake pripreme jednog takmicenja (POPIS 4.9).
export default function StanjeOznake({ stanje }) {
  if (stanje.prijava === 0) {
    return (
      <span className="oznake-stanja">
        <span className="status status-warn"><Ikona ime="upozorenje" velicina={13} />Nema prijava</span>
      </span>
    );
  }
  return (
    <span className="oznake-stanja">
      <span className="status">Prijava: {stanje.prijava}</span>
      {stanje.nepotpune > 0 && <span className="status status-bad"><Ikona ime="upozorenje" velicina={13} />Nepotpune: {stanje.nepotpune}</span>}
      {stanje.nepotvrdjeni_klubovi > 0 && <span className="status status-warn">Nepotvrđeni klubovi: {stanje.nepotvrdjeni_klubovi}</span>}
      {stanje.nerasporedjeni > 0 && <span className="status status-warn">Neraspoređeni: {stanje.nerasporedjeni}</span>}
      {stanje.korak === 'spremno' && stanje.nepotvrdjeni_klubovi === 0 && <span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Spremno</span>}
    </span>
  );
}
