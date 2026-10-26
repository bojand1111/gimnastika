// Zaglavlje biltena (POPIS 5.2): veliko na prvoj strani, malo na ostalim.
export default function BiltenZaglavlje({ prva, takm, disciplina, organizator, grbLevo, grbDesno, gde }) {
  if (!prva) {
    return <div className="bi-mala-glava"><span>BILTEN · {takm.naziv}</span><span>{disciplina}</span></div>;
  }
  return (
    <div className="bi-zaglavlje">
      <div className="st-grb">{grbLevo !== '' && <img src={grbLevo} alt="" />}</div>
      <div className="bi-sredina">
        {takm.zaglavlje_biltena !== '' && <span className="mali">{takm.zaglavlje_biltena}</span>}
        {organizator !== '' && <span className="org">{organizator}</span>}
        <span className="bilten">BILTEN</span>
        <span className="naziv">{takm.naziv}</span>
        <span className="disc">{disciplina}</span>
        <span className="gde broj">{gde}</span>
        {takm.domacin !== '' && <span className="gde">Domaćin: {takm.domacin}</span>}
      </div>
      <div className="st-grb">{grbDesno !== '' && <img src={grbDesno} alt="" />}</div>
    </div>
  );
}
