// Prekidac dela aplikacije u bocnom meniju: MSG ili ZSG (pol 'M' ili 'Z').
// Props: pol ('M' | 'Z'), naPromenu(pol). Precice Alt+M i Alt+Z rade globalno (App.jsx).
const DELOVI = [
  { pol: 'M', tekst: 'MSG', precica: 'Alt+M' },
  { pol: 'Z', tekst: 'ŽSG', precica: 'Alt+Z' },
];

export default function IzborDela({ pol, naPromenu }) {
  return (
    <div className="izbor izbor-deo" role="group" aria-label="Deo aplikacije">
      {DELOVI.map((d) => (
        <button key={d.pol} type="button" aria-pressed={pol === d.pol ? 'true' : 'false'}
          title={`Prebaci na ${d.tekst} (${d.precica})`} onClick={() => naPromenu(d.pol)}>
          <span>{d.tekst}</span><kbd>{d.precica}</kbd>
        </button>
      ))}
    </div>
  );
}
