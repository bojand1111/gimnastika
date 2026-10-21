import Ikona from '../komponente/Ikona.jsx';
import { AzuriranjeKartica } from '../okvir/Azuriranje.jsx';
import { konacnaE } from '../../electron/racun/ocena.mjs';
import { prikaz } from '../../electron/racun/broj.mjs';

// Interni ekran sa svim komponentama (sistem.php), za poredjenje sa dizajn/slike/00-vizuelni-sistem.png.
const BOJE = ['primary', 'primary-dark', 'primary-soft', 'ink', 'ink-2', 'muted', 'line-2', 'line', 'ground', 'surface', 'sel', 'sub', 'link', 'info-soft', 'ok', 'ok-soft', 'warn', 'warn-soft', 'bad', 'bad-soft'];
const SPRAVE = [['PR', 'Preskok'], ['DR', 'Dvovisinski razboj'], ['GR', 'Greda'], ['PA', 'Parter'], ['KH', 'Konj sa hvataljkama'], ['KA', 'Karike'], ['RA', 'Razboj'], ['VR', 'Vratilo']];
const tanko = { fontWeight: 500 };
const kolone = '96px minmax(0,1fr) 64px 64px 90px 120px';
const desno = { display: 'flex', justifyContent: 'flex-end' };

function Kartica({ naslov, raste, children }) {
  return (
    <div className={`kartica${raste ? ' raste' : ''}`}>
      <div className="kartica-zaglavlje"><h2 className="kartica-naslov">{naslov}</h2></div>
      {children}
    </div>
  );
}

export default function Sistem() {
  return (
    <>
      <AzuriranjeKartica />

      <Kartica naslov="Računanje">
        <div className="kartica-telo">
          <div>E ocena iz 8,300 8,100 8,400 8,200 (odbaci krajnje): <span className="broj">{prikaz(konacnaE([8300, 8100, 8400, 8200], 'odbaci_krajnje'))}</span></div>
        </div>
      </Kartica>

      <Kartica naslov="Boje">
        <div className="kartica-telo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,minmax(0,1fr))', gap: 12 }}>
            {BOJE.map((b) => (
              <div className="polje" key={b}>
                <span style={{ height: 44, borderRadius: 8, border: '1px solid var(--line-2)', background: `var(--${b})` }} />
                <span className="mali broj" style={{ fontWeight: 600 }}>--{b}</span>
              </div>
            ))}
          </div>
        </div>
      </Kartica>

      <div className="red">
        <Kartica naslov="Tipografija" raste>
          <div className="kartica-telo">
            <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>Unos ocena <span className="sivo mali" style={tanko}>naslov ekrana 22/800</span></div>
            <div className="kartica-naslov">Karton takmičara <span className="sivo mali" style={tanko}>naslov kartice 15/800</span></div>
            <div>SD „Vojvodina“, Novi Sad <span className="sivo mali">tekst 14/500</span></div>
            <div className="oznaka">Lekarski važi do <span className="sivo" style={tanko}>oznaka polja 12/600</span></div>
            <div className="broj" style={{ fontSize: 16, fontWeight: 600 }}>8,300 &nbsp; 17.10.2026. &nbsp; 00203 <span className="sivo mali" style={tanko}>brojevi, tabular-nums</span></div>
            <div className="konacna" style={{ textAlign: 'left' }}>13,050 <span className="sivo mali" style={tanko}>konačna 22/800</span></div>
          </div>
        </Kartica>
        <Kartica naslov="Dugmad i prečice" raste>
          <div className="kartica-telo">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button className="dugme dugme-glavno">Sačuvaj <kbd>Enter</kbd></button>
              <button className="dugme">Otkaži <kbd>Esc</kbd></button>
              <button className="dugme dugme-opasno"><Ikona ime="kanta" velicina={16} />Obriši</button>
              <button className="dugme dugme-tekst">Otvori</button>
              <button className="dugme" disabled>Nedostupno</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button className="dugme dugme-glavno dugme-veliko"><Ikona ime="kopija" velicina={16} />Napravi rezervnu kopiju</button>
              <button className="dugme dugme-malo">U tabeli</button>
              <button className="dugme dugme-ikona" aria-label="Izmeni"><Ikona ime="olovka" velicina={16} /></button>
              <button className="dugme dugme-ikona" aria-label="Obriši"><Ikona ime="kanta" velicina={16} /></button>
              <span className="precice"><kbd>F2</kbd><kbd>Tab</kbd><kbd>Enter</kbd></span>
            </div>
          </div>
        </Kartica>
      </div>

      <Kartica naslov="Polja forme">
        <div className="kartica-telo">
          <div className="forma-red">
            <label className="polje"><span className="oznaka">Obično</span><input className="unos" defaultValue="Nikolić" /></label>
            <label className="polje"><span className="oznaka">Upozorenje</span><input className="unos upozorenje broj" defaultValue="25.10.2026." /><span className="polje-poruka upozorenje">Ističe za 8 dana</span></label>
            <label className="polje"><span className="oznaka">Greška</span><input className="unos greska broj" defaultValue="02.10.2026." /><span className="polje-poruka greska">Lekarski je istekao</span></label>
            <label className="polje"><span className="oznaka">Isključeno</span><input className="unos broj" defaultValue="00203" disabled /></label>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <label className="polje" style={{ width: 230 }}><span className="oznaka">Padajuća lista</span><select className="unos"><option>GK „Beograd“</option></select></label>
            <div className="polje"><span className="oznaka">Izbor</span><div className="izbor" role="group"><button type="button" aria-pressed="true">ŽSG</button><button type="button" aria-pressed="false">MSG</button></div></div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, gap: 16 }}>
              <label className="kucica"><input type="checkbox" defaultChecked /><span>Član ekipe</span></label>
              <label className="kucica"><input type="checkbox" /><span>Van konkurencije</span></label>
            </div>
          </div>
        </div>
      </Kartica>

      <div className="red">
        <Kartica naslov="Statusi" raste>
          <div className="kartica-telo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
            <div><span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Uneto</span> <span className="mali sek">Ocena potvrđena</span></div>
            <div><span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Aktivno</span> <span className="mali sek">Aktivno takmičenje</span></div>
            <div><span className="status status-warn"><Ikona ime="olovka" velicina={13} />Ispravljeno</span> <span className="mali sek">Ocena menjana</span></div>
            <div><span className="status status-warn"><Ikona ime="upozorenje" velicina={13} />Ističe za 8 dana</span> <span className="mali sek">Lekarski ističe</span></div>
            <div><span className="status status-bad"><Ikona ime="upozorenje" velicina={13} />Istekao</span> <span className="mali sek">Lekarski ne važi</span></div>
            <div><span className="status status-info">U pripremi</span> <span className="mali sek">Takmičenje još nije počelo</span></div>
            <div><span className="status">Čeka</span> <span className="mali sek">Još nije nastupio/la</span></div>
            <div><span className="status">Završeno</span> <span className="mali sek">Arhivirano</span></div>
            <div><span className="status status-crn"><Ikona ime="iks" velicina={13} />Odustala</span> <span className="mali sek">Bez ocene i plasmana</span></div>
            <div><span className="status status-vk">VK</span> <span className="mali sek">Van konkurencije</span></div>
          </div>
        </Kartica>
        <Kartica naslov="Ikone sprava" raste>
          <div className="kartica-telo" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '12px 6px' }}>
            {SPRAVE.map(([s, n]) => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 70, textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, border: '1px solid var(--line)', borderRadius: 12 }}><Ikona ime={`sprava-${s}`} velicina={32} /></span>
                <span className="mali sek">{n}</span>
              </div>
            ))}
          </div>
        </Kartica>
      </div>

      <div className="red">
        <Kartica naslov="Tabela" raste>
          <table className="tabela">
            <thead><tr><th style={{ width: 80 }}>ID</th><th>Prezime i ime</th><th style={{ width: 70 }}>Klub</th><th className="desno" style={{ width: 90 }}>Ocena</th></tr></thead>
            <tbody>
              <tr><td><span className="sifra">00142</span></td><td>Petrović Ana</td><td><span className="skr">VOJ</span></td><td className="desno"><span className="ocena-tekst">13,050</span></td></tr>
              <tr className="izabran"><td><span className="sifra">00203</span></td><td>Nikolić Teodora</td><td><span className="skr">BGD</span></td><td className="desno"><span className="ocena-tekst">12,650</span></td></tr>
              <tr><td><span className="sifra">00087</span></td><td>Jovanović Milica</td><td><span className="skr">NIŠ</span></td><td className="desno"><span className="ocena-tekst">12,350</span></td></tr>
            </tbody>
          </table>
        </Kartica>
        <Kartica naslov="Red za unos ocena" raste>
          <div style={{ '--kolone': kolone }}>
            <div className="unos-red" style={{ gridTemplateColumns: 'var(--kolone)' }}><span className="oznaka">Uneto</span><b>Prezime Ime</b><input className="ocena zakljucano" defaultValue="4,800" disabled /><input className="ocena zakljucano" defaultValue="8,300" disabled /><span className="konacna">13,050</span><span style={desno}><span className="status status-ok"><Ikona ime="kvacica" velicina={13} />Uneto</span></span></div>
            <div className="unos-red trenutni" style={{ gridTemplateColumns: 'var(--kolone)' }}><span className="oznaka">Trenutni</span><b>Prezime Ime</b><input className="ocena" defaultValue="4,700" /><input className="ocena" /><span className="konacna">–</span><span style={desno}><button className="dugme dugme-malo dugme-opasno">Odustala <kbd>F8</kbd></button></span></div>
            <div className="unos-red ceka" style={{ gridTemplateColumns: 'var(--kolone)' }}><span className="oznaka">Čeka</span><b>Prezime Ime</b><input className="ocena" /><input className="ocena" /><span className="konacna">–</span><span style={desno}><span className="status">Čeka</span></span></div>
            <div className="unos-red" style={{ gridTemplateColumns: 'var(--kolone)' }}><span className="oznaka">Odustao/la</span><b>Prezime Ime</b><span></span><span></span><span className="konacna">–</span><span style={desno}><span className="status status-crn"><Ikona ime="iks" velicina={13} />Odustala</span></span></div>
          </div>
        </Kartica>
      </div>
    </>
  );
}
