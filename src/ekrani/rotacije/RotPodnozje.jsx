import Ikona from '../../komponente/Ikona.jsx';

// Legenda i "Završi pripremu" (POPIS 5.2, tačka 4).
export default function RotPodnozje({ rot, naZavrsi }) {
  return (
    <div className="rot-podnozje">
      <div className="sek rot-legenda">
        <span className="rot-stavka"><Ikona ime="hvataljka" velicina={16} /><span>Prevucite karticu mišem, ili je izaberite pa:</span></span>
        <span className="rot-stavka"><kbd>Alt</kbd><kbd>↑</kbd><kbd>↓</kbd><span>mesto u redosledu</span></span>
        <span className="rot-stavka"><kbd>Alt</kbd><kbd>←</kbd><kbd>→</kbd><span>druga grupa</span></span>
        <span>Plava oznaka pokazuje spravu grupe u izabranoj rotaciji.</span>
        <span>Promena redosleda ovde važi samo za rotaciju {rot}. Sastav grupe je isti u svim rotacijama.</span>
      </div>
      <button type="button" className="dugme dugme-glavno" id="zavrsi" onClick={naZavrsi}>
        <span>Završi pripremu</span><Ikona ime="strelica-desno" velicina={16} /></button>
    </div>
  );
}
