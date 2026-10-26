import { gdeKada } from '../stampaStanje.js';

// Zaglavlje lista za stampu (POPIS 4.3): grb, naziv takmicenja, mesto i datum, naziv liste, ZVANICNO.
export default function ListZaglavlje({ takm, naziv, grb, vreme }) {
  return (
    <>
      <div className="st-zaglavlje">
        <div className="st-grb">{grb !== '' && <img src={grb} alt="" />}</div>
        <div className="st-sredina">
          <h1>{takm.naziv}</h1>
          <span className="broj" style={{ fontWeight: 700 }}>{gdeKada(takm)}</span>
          <span style={{ marginTop: 10, fontWeight: 700 }}>{naziv}</span>
        </div>
        <div className="st-zvanicno"><b>ZVANIČNO</b><span className="broj">{vreme.kratko}</span></div>
      </div>
      <h2 className="st-h2">Rezultati</h2>
    </>
  );
}
