// Čita tabele i tekst iz Word .docx fajla (zip sa word/document.xml).
// Spojene ćelije (gridSpan) se šire u više ćelija sa istim tekstom, da kolone ostanu poravnate.
const zip = require('./zip.cjs');
const xml = require('./xml.cjs');

const NAJVISE_CELIJA = 2_000_000; // ukupno u dokumentu, sa raširenim spojenim ćelijama (kao u xlsx)
const GRESKA_XML = 'Word dokument je oštećen (document.xml nije ispravan XML).';
const OMOTACI = new Set(['w:sdt', 'w:sdtContent', 'w:customXml', 'w:ins']);

// Tekst pasusa: svi w:t spojeni, w:tab, w:br i w:cr kao razmak, više razmaka u jedan.
// bezOkvira: sadržaj okvira za tekst (w:txbxContent) se preskače, čita se posebno (okviri).
function tekstPasusa(p, bezOkvira = false) {
  let s = '';
  for (const el of potomciBezOkvira(p, bezOkvira)) {
    const i = xml.ime(el);
    if (i === 'w:t') s += xml.tekstElementa(el);
    else if (i === 'w:tab' || i === 'w:br' || i === 'w:cr') s += ' ';
  }
  return s.replace(/\s+/g, ' ');
}

// Kao xml.potomci; sa bezOkvira ne ulazi u w:txbxContent.
function potomciBezOkvira(cvor, bezOkvira, izlaz = []) {
  for (const d of xml.deca(cvor)) {
    const i = xml.ime(d);
    if (i === null || (bezOkvira && i === 'w:txbxContent')) continue;
    izlaz.push(d);
    potomciBezOkvira(d, bezOkvira, izlaz);
  }
  return izlaz;
}

// Okviri za tekst (w:txbxContent) u pasusu, redom dokumenta. Iz mc:AlternateContent se čita samo
// mc:Choice kad postoji, jer je mc:Fallback isti okvir u starom obliku (VML).
function okviri(cvor, izlaz = []) {
  const deca = xml.deca(cvor);
  const imaIzbor = xml.ime(cvor) === 'mc:AlternateContent' && deca.some((d) => xml.ime(d) === 'mc:Choice');
  for (const d of deca) {
    const i = xml.ime(d);
    if (i === null || (imaIzbor && i === 'mc:Fallback')) continue;
    if (i === 'w:txbxContent') izlaz.push(d);
    else okviri(d, izlaz);
  }
  return izlaz;
}

// Elementi `naziv` neposredno ispod čvora, i kroz omotače (sdt, sdtContent, customXml, ins).
function nadjiDecu(cvor, naziv) {
  const izlaz = [];
  for (const d of xml.deca(cvor)) {
    const i = xml.ime(d);
    if (i === naziv) izlaz.push(d);
    else if (OMOTACI.has(i)) for (const x of nadjiDecu(d, naziv)) izlaz.push(x);
  }
  return izlaz;
}

// Ugnježdene tabele ulaze u `tabele` ispred roditeljske.
function tabela(tbl, tabele, brojac) {
  const redovi = [];
  for (const tr of nadjiDecu(tbl, 'w:tr')) {
    const red = [];
    for (const tc of nadjiDecu(tr, 'w:tc')) {
      let sirina = 1;
      const delovi = [];
      for (const u of xml.deca(tc)) {
        const i = xml.ime(u);
        if (i === 'w:tcPr') {
          const span = xml.deca(u).find((x) => xml.ime(x) === 'w:gridSpan');
          if (span) sirina = Math.min(63, Math.max(1, parseInt(xml.atribut(span, 'w:val'), 10) || 0));
        } else if (i === 'w:p') {
          const t = tekstPasusa(u).trim();
          if (t !== '') delovi.push(t);
        } else if (i === 'w:tbl') {
          tabele.push(tabela(u, tabele, brojac));
        }
      }
      brojac.n += sirina;
      if (brojac.n > NAJVISE_CELIJA) throw new Error(GRESKA_XML);
      const celija = delovi.join(' ');
      for (let k = 0; k < sirina; k++) red.push(celija);
    }
    redovi.push(red);
  }
  return redovi;
}

function prodji(cvor, tabele, tekst, brojac) {
  for (const d of xml.deca(cvor)) {
    const i = xml.ime(d);
    if (i === null) continue;
    if (i === 'w:tbl') {
      tabele.push(tabela(d, tabele, brojac));
    } else if (i === 'w:p') {
      const t = tekstPasusa(d, true).trim();
      if (t !== '') tekst.push(t);
      // tabele i pasusi iz okvira za tekst (npr. zaglavlje tabele u plutajućem okviru)
      for (const okvir of okviri(d)) prodji(okvir, tabele, tekst, brojac);
    } else {
      prodji(d, tabele, tekst, brojac);
    }
  }
}

// Vraća {tabele: string[][][], tekst}.
function procitaj(putanja) {
  const lista = zip.lista(putanja);
  if (!lista['word/document.xml']) throw new Error('Fajl nije Word dokument (.docx).');
  const stablo = xml.razberi(zip.procitaj(putanja, 'word/document.xml', lista));
  if (stablo === null) throw new Error(GRESKA_XML);
  const koren = stablo.find((n) => xml.ime(n) !== null && !xml.ime(n).startsWith('?'));
  const telo = koren ? xml.potomci(koren).find((n) => xml.ime(n) === 'w:body') : null;
  if (!telo) throw new Error('Word dokument nema sadržaj.');
  const tabele = [];
  const tekst = [];
  prodji(telo, tabele, tekst, { n: 0 });
  return { tabele, tekst: tekst.join('\n') };
}

module.exports = { procitaj };
