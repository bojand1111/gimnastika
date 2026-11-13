// Uvoz objavljenih takmicenja iz fascikle takmicenja/ pri startu (spec objave 5.5).
// Uvoz samo dodaje; bez kopije (pre_uvoza) nema uvoza. Greska jednog fajla ne prekida ostale.
const fs = require('node:fs');
const path = require('node:path');
const { napravi: napraviObjavu } = require('./modeli/objava.cjs');

// Datum 'dd.mm.gggg.' ili 'gggg-mm-dd' kao kljuc za redosled; sve ostalo ide na kraj po tekstu.
function kljucDatuma(d) {
  const s = String(d ?? '').trim();
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
}

// model: za testove (zamena objave); inace pravi model nad bazom.
function uveziIzFascikle({ baza, fascikla, kopija, dnevnik, verzija, sad, model }) {
  const rezultat = { uvezena: [], odbijena: [] };
  if (!fs.existsSync(fascikla)) return rezultat;
  const imena = fs.readdirSync(fascikla).filter((i) => i.toLowerCase().endsWith('.json'));
  if (imena.length === 0) return rezultat;

  const objava = model ?? napraviObjavu(baza);
  const fajlovi = [];
  for (const ime of imena) {
    try {
      const o = JSON.parse(fs.readFileSync(path.join(fascikla, ime), 'utf8'));
      if (o === null || typeof o !== 'object' || typeof o.uid !== 'string' || o.uid === '') throw new Error('Fajl nema oznaku objave (uid).');
      fajlovi.push({ ime, o });
    } catch (err) {
      dnevnik.greska(`uvoz objave ${ime}`, err);
      rezultat.odbijena.push({ fajl: ime, poruka: err.message });
    }
  }
  fajlovi.sort((a, b) => {
    const x = kljucDatuma(a.o.takmicenje?.datum);
    const y = kljucDatuma(b.o.takmicenje?.datum);
    return x < y ? -1 : x > y ? 1 : a.ime.localeCompare(b.ime);
  });

  const nove = fajlovi.filter((f) => !objava.vecObradjen(f.o.uid));
  if (nove.length === 0) return rezultat;

  // Kopija samo ako bar jedan fajl prolazi proveru; fajlovi koji ne prolaze dobijaju odbijeno zapis u uvezi.
  if (nove.some((f) => objava.proveri(f.o).length === 0)) {
    try {
      kopija.napravi('pre_uvoza');
    } catch (err) {
      dnevnik.greska('kopija pre uvoza', err);
      return rezultat;
    }
  }

  // Bez spoljne transakcije: uvezi ima svoju, a ugnjezdena ne bi vratila delimican upis.
  for (const { ime, o } of nove) {
    try {
      const r = objava.uvezi(o, { verzija, sad });
      if (r.stanje === 'uvezeno') {
        rezultat.uvezena.push({ uid: o.uid, naziv: o.takmicenje?.naziv ?? '', takmicenje_id: r.takmicenje_id });
        dnevnik.info(`Uvezeno takmicenje iz ${ime}: ${o.takmicenje?.naziv ?? ''}`);
      } else if (r.stanje === 'odbijeno') {
        rezultat.odbijena.push({ uid: o.uid, poruka: r.poruka });
        dnevnik.info(`Objava ${ime} odbijena: ${r.poruka}`);
      }
    } catch (err) {
      dnevnik.greska(`uvoz objave ${ime}`, err);
      rezultat.odbijena.push({ uid: o.uid, poruka: err.message });
    }
  }
  return rezultat;
}

module.exports = { uveziIzFascikle };
