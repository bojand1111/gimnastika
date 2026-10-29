// Čita tabelu prijava iz PDF-a sa tekstom (pdfjs-dist daje komade teksta sa položajem na strani).
// PDF nema tabele kao strukturu, pa se one sklapaju po položaju: komadi istog reda teksta čine red,
// red čije ćelije tumač prepozna kao zaglavlje (PREZIME, IME...) određuje kolone, a sledeći redovi
// se dele po kolonama. Ostali redovi idu u tekst i u "slobodnu" tabelu (ćelije po razmacima).
// Skeniran PDF nema tekst i ne može da se uveze.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { kolone } = require('./tumac-prijave.cjs');

const NAJVECI_FAJL = 200 * 1024 * 1024;
const NAJVISE_STRANA = 500;
const NAJVISE_STAVKI = 2_000_000;

let pdfjs = null;
async function ucitajPdfjs() {
  if (pdfjs === null) {
    let p = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
    // u instaliranoj aplikaciji paket je raspakovan pored app.asar (asarUnpack)
    const raspakovano = p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    if (raspakovano !== p && fs.existsSync(raspakovano)) p = raspakovano;
    pdfjs = await import(pathToFileURL(p).href);
  }
  return pdfjs;
}

// Komadi teksta jedne strane: {s, x0, x1, y, v (veličina slova)}; prazni i rotirani se preskaču.
function stavke(sadrzaj) {
  const izlaz = [];
  for (const it of sadrzaj.items) {
    if (typeof it.str !== 'string' || it.str.trim() === '') continue;
    const [a, b, c, d, e, f] = it.transform;
    if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01 || a <= 0) continue;
    const v = Math.abs(d) || it.height || 10;
    izlaz.push({ s: it.str, x0: e, x1: e + Math.max(0, it.width), y: f, v });
  }
  return izlaz;
}

// Redovi teksta odozgo nadole; u redu komadi sleva nadesno.
function redoviTeksta(st) {
  const sort = [...st].sort((p, q) => q.y - p.y || p.x0 - q.x0);
  const redovi = [];
  for (const it of sort) {
    const r = redovi.at(-1);
    if (r && Math.abs(r.y - it.y) <= 0.5 * Math.min(r.v, it.v)) {
      r.st.push(it);
      r.v = Math.max(r.v, it.v);
    } else {
      redovi.push({ y: it.y, v: it.v, st: [it] });
    }
  }
  for (const r of redovi) r.st.sort((p, q) => p.x0 - q.x0);
  return redovi;
}

// Spaja komade u tekst; razmak ide gde je praznina veća od petine slova.
function spoji(st) {
  let s = '';
  let kraj = null;
  for (const it of st) {
    if (kraj !== null && it.x0 - kraj > 0.2 * it.v && !s.endsWith(' ') && !it.s.startsWith(' ')) s += ' ';
    s += it.s;
    kraj = it.x1;
  }
  return s.replace(/\s+/g, ' ').trim();
}

// Ćelije reda po prazninama većim od 0,8 visine slova: [{x0, x1, s}].
function celije(r) {
  const grupe = [];
  for (const it of r.st) {
    const g = grupe.at(-1);
    if (g && it.x0 - g.x1 <= 0.8 * r.v) { g.st.push(it); g.x1 = Math.max(g.x1, it.x1); } else grupe.push({ x0: it.x0, x1: it.x1, st: [it] });
  }
  return grupe.map((g) => ({ x0: g.x0, x1: g.x1, s: spoji(g.st) }));
}

const preklapa = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0;

// Zaglavlje u dva ili tri reda teksta ("DATUM / ROĐENJA", ili ostale ćelije vertikalno centrirane):
// susedni red sa malo ćelija (manje od trećine) se dodaje zaglavlju.
function prosiriZaglavlje(zag, sused) {
  const c = celije(sused);
  if (c.length * 3 >= zag.length) return false;
  for (const x of c) {
    const k = zag.find((z) => preklapa(z, x));
    if (k) { k.s = (k.s + ' ' + x.s).trim(); k.x0 = Math.min(k.x0, x.x0); k.x1 = Math.max(k.x1, x.x1); } else zag.push({ ...x });
  }
  zag.sort((a, b) => a.x0 - b.x0);
  return true;
}

// Granice između kolona: sredina praznine između susednih ćelija zaglavlja.
const granice = (zag) => zag.slice(1).map((z, i) => (zag[i].x1 + z.x0) / 2);

// Komad koji jasno prelazi granicu kolone nije deo tabele (npr. "Odgovorno lice: ____" ispod nje).
function prelazi(r, g) {
  return r.st.some((it) => g.some((b) => {
    const pr = Math.max(2, 0.15 * (it.x1 - it.x0));
    return it.x0 < b - pr && it.x1 > b + pr;
  }));
}

function redTabele(r, g) {
  const delovi = g.map(() => []).concat([[]]);
  for (const it of r.st) {
    const sredina = (it.x0 + it.x1) / 2;
    delovi[g.filter((b) => b < sredina).length].push(it);
  }
  return delovi.map(spoji);
}

// Sklapa {tabele, tekst} iz redova teksta svih strana: [{strana, y, v, st}].
function sklopi(redovi) {
  const slobodno = [];
  const tekst = [];
  const tabele = [];
  let tab = null; // {redovi, g, strana, y, razmaci: []}
  let poslednja = null; // tabela koja se može nastaviti na sledećoj strani
  for (let i = 0; i < redovi.length; i++) {
    const r = redovi[i];
    const c = celije(r);
    if (kolone(c.map((x) => x.s)) !== null) {
      const zag = c.map((x) => ({ ...x }));
      const iznad = redovi[i - 1];
      const ispod = redovi[i + 1];
      const blizu = (x) => x && x.strana === r.strana && Math.abs(x.y - r.y) <= 1.2 * Math.max(r.v, x.v);
      if (blizu(iznad) && tab === null && prosiriZaglavlje(zag, iznad)) {
        // red iznad je deo zaglavlja: skloni ga iz teksta
        slobodno.pop();
        tekst.pop();
      }
      if (blizu(ispod) && kolone(celije(ispod).map((x) => x.s)) === null && prosiriZaglavlje(zag, ispod)) i++;
      tab = { redovi: [zag.map((z) => z.s)], g: granice(zag), strana: r.strana, y: redovi[i].y, razmaci: [] };
      tabele.push(tab.redovi);
      poslednja = tab;
      continue;
    }
    if (tab !== null) {
      const razmak = tab.y - r.y;
      const prosek = tab.razmaci.length ? tab.razmaci.reduce((a, b) => a + b, 0) / tab.razmaci.length : 2 * r.v;
      if (r.strana !== tab.strana || razmak > 2.5 * prosek || prelazi(r, tab.g)) tab = null;
    }
    if (tab === null && poslednja !== null && r.strana > poslednja.strana && r.st.length >= 2 && !prelazi(r, poslednja.g)) {
      // tabela se nastavlja na novoj strani bez ponovljenog zaglavlja
      tab = poslednja;
      tab.strana = r.strana;
      tab.y = r.y + 2 * r.v;
      tab.razmaci = [];
    }
    if (tab !== null) {
      tab.razmaci.push(tab.y - r.y);
      tab.y = r.y;
      tab.redovi.push(redTabele(r, tab.g));
      continue;
    }
    slobodno.push(c.map((x) => x.s));
    tekst.push(spoji(r.st));
  }
  return { tabele: slobodno.length ? [slobodno, ...tabele] : tabele, tekst: tekst.filter((t) => t !== '').join('\n') };
}

// Vraća Promise<{tabele: string[][][], tekst}>.
async function procitaj(putanja) {
  let podaci;
  try {
    if (fs.statSync(putanja).size > NAJVECI_FAJL) throw new Error('Fajl je prevelik.');
    podaci = new Uint8Array(fs.readFileSync(putanja));
  } catch (e) {
    if (e.message === 'Fajl je prevelik.') throw e;
    throw new Error('Ne mogu da otvorim ' + path.basename(putanja));
  }
  const lib = await ucitajPdfjs();
  const zadatak = lib.getDocument({ data: podaci, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  let dok;
  try {
    dok = await zadatak.promise;
  } catch (e) {
    await zadatak.destroy();
    if (e && e.name === 'PasswordException') throw new Error('PDF je zaštićen lozinkom. Sačuvajte ga bez lozinke pa ga uvezite ponovo.', { cause: e });
    if (e && (e.name === 'InvalidPDFException' || e.name === 'FormatError' || e.name === 'UnknownErrorException')) {
      throw new Error('PDF fajl je oštećen ili nije PDF.', { cause: e });
    }
    throw e;
  }
  try {
    if (dok.numPages > NAJVISE_STRANA) throw new Error('PDF ima previše strana.');
    const redovi = [];
    let ukupno = 0;
    for (let n = 1; n <= dok.numPages; n++) {
      const strana = await dok.getPage(n);
      const st = stavke(await strana.getTextContent());
      ukupno += st.length;
      if (ukupno > NAJVISE_STAVKI) throw new Error('PDF ima previše teksta.');
      for (const r of redoviTeksta(st)) redovi.push({ ...r, strana: n });
      strana.cleanup();
    }
    if (ukupno === 0) {
      throw new Error('PDF nema teksta (verovatno je skeniran). Skeniran PDF ne može da se uveze; tražite od kluba Word ili Excel fajl.');
    }
    return sklopi(redovi);
  } finally {
    await zadatak.destroy();
  }
}

module.exports = { procitaj, sklopi, redoviTeksta };
