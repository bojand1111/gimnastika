import { vremeIzmene } from './redovi.js';

// Dve kartice ispod unosa (POPIS 5.3): precice i poslednje izmene na spravi.
export default function UnosIzmene({ izmene }) {
  return (
    <div className="unos-dole">
      <section className="kartica raste unos-precice">
        <span className="oznaka unos-oznaka">Prečice</span>
        <div className="sek unos-precice-lista">
          <span className="unos-precica"><kbd>Tab</kbd><kbd>Enter</kbd><span>sledeće polje</span></span>
          <span className="unos-precica"><kbd>Enter</kbd><span>na odbitku: potvrdi i pređi na sledećeg</span></span>
          <span className="unos-precica"><kbd>↑</kbd><kbd>↓</kbd><span>drugi takmičar</span></span>
          <span className="unos-precica"><kbd>F8</kbd><span>odustao/la</span></span>
          <span className="unos-precica"><kbd>F9</kbd><span>ispravi unetu ocenu</span></span>
        </div>
      </section>
      <section className="kartica unos-izmene" id="izmene">
        <span className="oznaka unos-oznaka">Izmene na ovoj spravi</span>
        {izmene.length === 0 && <span className="sivo mali">Još nema ispravki.</span>}
        {izmene.map((iz) => (
          <div className="unos-izmena" key={iz.id}>
            <span className="broj sivo">{vremeIzmene(iz.vreme)}</span>
            <span className="unos-izmena-tekst">
              <span><span className="unos-izmena-ime">{`${iz.prezime} ${iz.ime}`}</span>{' · '}<span className="broj">{iz.opis}</span></span>
              <span className="mali sivo">Razlog: {iz.razlog}</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
