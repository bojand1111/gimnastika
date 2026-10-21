import Polje from './Polje.jsx';

// ddmmgggg ili d.m.gggg[.] postaje dd.mm.gggg.; ostalo ostaje kako je kucano (bez kalendarske provere).
export function normalizujDatum(t) {
  const s = String(t ?? '').trim();
  const m = /^(\d{2})(\d{2})(\d{4})$/.exec(s) || /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(s);
  return m ? `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[3]}.` : t;
}

// Polje za datum: na blur normalizuje unos. Props kao Polje; naPromenu(tekst) dobija vrednost.
export default function DatumPolje({ value, naPromenu, klasa = '', ...ostalo }) {
  return (
    <Polje {...ostalo} klasa={['broj datum', klasa].filter(Boolean).join(' ')} value={value}
      onChange={(ev) => naPromenu(ev.target.value)}
      onBlur={() => { const n = normalizujDatum(value); if (n !== value) naPromenu(n); }} />
  );
}
