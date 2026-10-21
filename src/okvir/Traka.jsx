import { url } from '../ruter.js';

// Gornja traka: naslov ekrana i aktivno takmicenje (modul podesavanja jos ne postoji).
export default function Traka({ naslov }) {
  return (
    <header className="traka">
      <h1>{naslov}</h1>
      <div className="traka-desno">
        <div className="traka-aktivno">
          <span className="mali">Nema aktivnog takmičenja</span>
          <a href={url('takmicenja')} className="dugme dugme-malo">Izaberi</a>
        </div>
      </div>
    </header>
  );
}
