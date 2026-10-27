// Kartica "Prečice na tastaturi" (POPIS 1.2); precice: [[tekst, [tasteri]]].
export default function Precice({ precice }) {
  return (
    <section className="kartica">
      <div className="kartica-zaglavlje"><h2 className="kartica-naslov">Prečice na tastaturi</h2></div>
      <div style={{ padding: '6px 16px 14px', display: 'flex', flexDirection: 'column' }}>
        {precice.map(([tekst, tasteri]) => (
          <div key={tekst} style={{ height: 32, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{tekst}</span>
            <span className="precice">{tasteri.map((t) => <kbd key={t}>{t}</kbd>)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
