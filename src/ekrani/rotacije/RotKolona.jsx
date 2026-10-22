import Ikona from '../../komponente/Ikona.jsx';
import RotKartica from './RotKartica.jsx';

// Kolona: Neraspoređeni (grupa === null) ili grupa (POPIS 5.2). senkaPre = mesto senke među karticama bez vučene.
export default function RotKolona({ grupa, lista, filter, izabranId, vuceId, senkaPre, cilj, rot, h }) {
  const id = grupa ? grupa.id : 0;
  const stavke = [];
  let pre = 0;
  lista.forEach((c, i) => {
    const vucena = c.prijava_id === vuceId;
    if (!vucena && senkaPre === pre) stavke.push(<li key="senka" className="rot-senka" />);
    stavke.push(<RotKartica key={c.prijava_id} c={c} broj={grupa ? i + 1 : null} filter={filter}
      izabran={c.prijava_id === izabranId} vuce={vucena} h={h} />);
    if (!vucena) pre += 1;
  });
  if (senkaPre !== null && senkaPre >= pre) stavke.push(<li key="senka" className="rot-senka" />);

  return (
    <section className={`kartica raste rot-grupa${cilj ? ' rot-cilj' : ''}`} data-grupa={id}
      onDragOver={(ev) => h.prelaz(ev, id, lista)} onDrop={(ev) => h.pusti(ev, id, lista)}>
      <div className="rot-zaglavlje">
        {grupa ? (
          <>
            <div className="rot-red">
              <h2 className="kartica-naslov rot-naziv" title="Dupli klik za izmenu" onDoubleClick={() => h.izmeni(grupa)}>{grupa.naziv}</h2>
              <span className="rot-desno">
                <span className="broj sivo rot-brojac">{lista.length}</span>
                <button type="button" className="dugme dugme-ikona rot-izmeni" aria-label="Izmeni grupu" onClick={() => h.izmeni(grupa)}>
                  <Ikona ime="olovka" velicina={14} /></button>
                <button type="button" className={`dugme dugme-ikona rot-obrisi${lista.length ? ' sakriveno' : ''}`}
                  aria-label="Obriši praznu grupu" onClick={() => h.obrisi(grupa)}><Ikona ime="kanta" velicina={14} /></button>
              </span>
            </div>
            <div className="rot-podred">
              <span className="status status-info">{grupa.sprava ? grupa.sprava.naziv : '–'}</span>
              {grupa.rucni_rot && (
                <button type="button" className="dugme dugme-ikona rot-vrati" aria-label="Preuzmi redosled iz rotacije 1"
                  title="Preuzmi redosled iz rotacije 1" onClick={() => h.vrati(grupa)}><Ikona ime="vracanje" velicina={14} /></button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rot-red"><h2 className="kartica-naslov">Neraspoređeni</h2><span className="broj sivo rot-brojac">{lista.length}</span></div>
            <div className="rot-podred"><span className="mali sivo">Prevucite u grupu</span></div>
          </>
        )}
      </div>
      <ul className="rot-lista kartica-skrol">{stavke}</ul>
    </section>
  );
}
