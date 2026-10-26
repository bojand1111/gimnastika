// Dno lista (stampa i bilten): legenda i potpisi samo na poslednjoj strani, podnozje na svakoj.
export default function ListDno({ legenda = null, potpisi = false, levo, desno }) {
  return (
    <div className="st-dno">
      {legenda && (
        <div className="st-legenda">
          {legenda.map((red, i) => (i === 0 ? red : [<br key={i} />, red]))}
        </div>
      )}
      {potpisi && <div className="st-potpisi"><div>Glavni sudija</div><div>Zapisničar</div></div>}
      <div className="st-podnozje"><span>{levo}</span><span>{desno}</span></div>
    </div>
  );
}
