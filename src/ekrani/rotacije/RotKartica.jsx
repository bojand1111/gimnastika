import Ikona from '../../komponente/Ikona.jsx';
import { imeKartice, kp, naslovKartice } from '../rotacijeStanje.js';

// Kartica takmicara (POPIS 5.1). broj je null u Nerasporedjenima.
export default function RotKartica({ c, broj, filter, izabran, vuce, h }) {
  const klase = ['rot-kartica', filter !== '' && filter !== kp(c) && 'sakriveno', izabran && 'izabran', vuce && 'vuce-se']
    .filter(Boolean).join(' ');
  return (
    <li className={klase} draggable tabIndex={0} data-prijava={c.prijava_id} data-kp={kp(c)} title={naslovKartice(c)}
      onClick={() => h.izaberi(c.prijava_id)} onFocus={() => h.izaberi(c.prijava_id)}
      onDragStart={(ev) => h.pocniVucu(ev, c.prijava_id)} onDragEnd={h.krajVuce}>
      <span className="hvataljka"><Ikona ime="hvataljka" velicina={16} /></span>
      {broj !== null && <span className="rot-broj broj">{broj}</span>}
      <span className="rot-ime">{imeKartice(c)}{c.van_konkurencije ? <> <span className="status status-vk">VK</span></> : null}</span>
      <span className="rot-klub broj">{c.klub_skr ?? ''}</span>
    </li>
  );
}
