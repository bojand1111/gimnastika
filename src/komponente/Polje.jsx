// Oznaka + unos (label.polje > span.oznaka + input.unos); opciona poruka greske ispod.
export default function Polje({ oznaka, klasa = '', greska = '', stil, unosRef, ...unos }) {
  const klasaPolja = ['polje', unos.poljeKlasa].filter(Boolean).join(' ');
  delete unos.poljeKlasa;
  return (
    <label className={klasaPolja} style={stil}>
      <span className="oznaka">{oznaka}</span>
      <input type="text" {...unos} ref={unosRef} className={['unos', klasa, greska ? 'greska' : ''].filter(Boolean).join(' ')} />
      {greska && <span className="polje-poruka greska">{greska}</span>}
    </label>
  );
}
