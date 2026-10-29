// Čita OpenDocument fajlove: tekst (.odt, LibreOffice Writer) i tabelu (.ods, LibreOffice Calc).
// Oba su zip sa content.xml. Odt vraća tabele i tekst kao docx, ods vraća listove kao xlsx.
const zip = require('./zip.cjs');
const xml = require('./xml.cjs');

const MIME_ODT = 'application/vnd.oasis.opendocument.text';
const MIME_ODS = 'application/vnd.oasis.opendocument.spreadsheet';
const NAJVISE_REDOVA = 1048576;
const NAJVISE_KOLONA = 16384;
const NAJVISE_CELIJA = 2_000_000; // ukupno, sa raširenim ponovljenim i spojenim ćelijama
const GRESKA_XML = 'OpenDocument fajl je oštećen (content.xml nije ispravan XML).';
const PRESKOCI = new Set(['text:note', 'office:annotation', 'text:tracked-changes', 'text:sequence-decls', 'office:forms']);
const KONTEJNERI_REDOVA = new Set(['table:table-header-rows', 'table:table-rows', 'table:table-row-group']);

// 'odt', 'ods' ili null, po stavci mimetype (ili po sadržaju content.xml ako nje nema).
function vrsta(putanja, lista) {
  if (!lista['content.xml']) return null;
  if (lista.mimetype) {
    const m = zip.procitaj(putanja, 'mimetype', lista).toString('utf8').trim();
    if (m === MIME_ODT) return 'odt';
    if (m === MIME_ODS) return 'ods';
    return null;
  }
  const s = zip.procitaj(putanja, 'content.xml', lista).toString('utf8');
  if (s.includes('<office:text')) return 'odt';
  if (s.includes('<office:spreadsheet')) return 'ods';
  return null;
}

function zasticen(putanja, lista) {
  if (!lista['META-INF/manifest.xml']) return false;
  return zip.procitaj(putanja, 'META-INF/manifest.xml', lista).toString('utf8').includes('encryption-data');
}

function broj(cvor, naziv, najvise) {
  const n = parseInt(xml.atribut(cvor, naziv) ?? '1', 10);
  return Math.min(najvise, Math.max(1, Number.isFinite(n) ? n : 1));
}

// Tekst pasusa: span, link i ostali omotači; text:s, tab i prelom kao razmak; fusnote se preskaču.
function tekstCvora(cvor) {
  let s = '';
  for (const d of xml.deca(cvor)) {
    if (d['#text'] !== undefined) { s += String(d['#text']); continue; }
    const i = xml.ime(d);
    if (i === null || PRESKOCI.has(i)) continue;
    if (i === 'text:s' || i === 'text:tab' || i === 'text:line-break') s += ' ';
    else s += tekstCvora(d);
  }
  return s;
}

const sredi = (s) => s.replace(/\s+/g, ' ').trim();

// Pasusi (text:p, text:h) ispod čvora, i kroz liste i sekcije; tabele idu u `tabele`.
function pasusi(cvor, izlaz, tabele, brojac) {
  for (const d of xml.deca(cvor)) {
    const i = xml.ime(d);
    if (i === null || PRESKOCI.has(i)) continue;
    if (i === 'text:p' || i === 'text:h') {
      const t = sredi(tekstCvora(d));
      if (t !== '') izlaz.push(t);
    } else if (i === 'table:table') {
      tabele.push(tabelaTeksta(d, tabele, brojac));
    } else {
      pasusi(d, izlaz, tabele, brojac);
    }
  }
}

// Redovi tabele, i kroz zaglavlje i grupe redova.
function redoviTabele(tbl, izlaz = []) {
  for (const d of xml.deca(tbl)) {
    const i = xml.ime(d);
    if (i === 'table:table-row') izlaz.push(d);
    else if (KONTEJNERI_REDOVA.has(i)) redoviTabele(d, izlaz);
  }
  return izlaz;
}

function proveriBroj(brojac, n) {
  brojac.n += n;
  if (brojac.n > NAJVISE_CELIJA) throw new Error(GRESKA_XML);
}

// Tabela u .odt. Spojena ćelija se ponavlja u pokrivenim ćelijama istog reda (kao gridSpan u docx);
// ugnježdene tabele ulaze u `tabele` ispred roditeljske.
function tabelaTeksta(tbl, tabele, brojac) {
  const redovi = [];
  for (const tr of redoviTabele(tbl)) {
    const red = [];
    let ponovi = 0;
    let tekstSpoja = '';
    for (const tc of xml.deca(tr)) {
      const i = xml.ime(tc);
      if (i !== 'table:table-cell' && i !== 'table:covered-table-cell') continue;
      const puta = broj(tc, 'table:number-columns-repeated', NAJVISE_KOLONA);
      proveriBroj(brojac, puta);
      if (i === 'table:covered-table-cell') {
        for (let k = 0; k < puta; k++) {
          red.push(ponovi > 0 ? tekstSpoja : '');
          if (ponovi > 0) ponovi--;
        }
        continue;
      }
      const delovi = [];
      pasusi(tc, delovi, tabele, brojac);
      const celija = delovi.join(' ');
      for (let k = 0; k < puta; k++) red.push(celija);
      ponovi = broj(tc, 'table:number-columns-spanned', NAJVISE_KOLONA) - 1;
      tekstSpoja = celija;
    }
    const putaRed = broj(tr, 'table:number-rows-repeated', NAJVISE_REDOVA);
    proveriBroj(brojac, red.length * (putaRed - 1));
    for (let k = 0; k < putaRed; k++) redovi.push([...red]);
  }
  return redovi;
}

// "2014-01-01" ili "2014-01-01T00:00:00" u dd.mm.gggg. Vrednost sa vremenskom zonom
// ("...T23:00:00Z", neki programi tako pišu ponoć po lokalnom vremenu) ide u lokalni datum.
function datum(v) {
  if (/T.*([zZ]|[+-]\d{2}:\d{2})$/.test(v ?? '')) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
    }
  }
  const m = /^(-?\d{4,})-(\d{2})-(\d{2})/.exec(v ?? '');
  return m ? `${m[3]}.${m[2]}.${m[1]}.` : null;
}

// Vrednost ćelije u .ods: brojevi kao u xlsx (String(broj)), datum dd.mm.gggg., logička da/ne.
function vrednostCelije(tc) {
  const tip = xml.atribut(tc, 'office:value-type') ?? '';
  if (tip === 'float' || tip === 'percentage' || tip === 'currency') {
    const v = Number(xml.atribut(tc, 'office:value'));
    if (Number.isFinite(v)) return String(v);
  } else if (tip === 'date') {
    const d = datum(xml.atribut(tc, 'office:date-value'));
    if (d !== null) return d;
  } else if (tip === 'boolean') {
    return xml.atribut(tc, 'office:boolean-value') === 'true' ? 'da' : 'ne';
  }
  const delovi = [];
  for (const d of xml.deca(tc)) {
    const i = xml.ime(d);
    if (i === 'text:p' || i === 'text:h') delovi.push(sredi(tekstCvora(d)));
  }
  return sredi(delovi.join(' '));
}

// Jedan list .ods. Prazne ćelije na kraju reda i prazni redovi na kraju lista se odbacuju
// (Calc ih zapisuje kao ponovljene do kraja lista); prazni redovi između ostaju kao [].
function list(tbl) {
  const redovi = [];
  let ukupno = 0;
  let praznih = 0;
  for (const tr of redoviTabele(tbl)) {
    const red = [];
    let duzina = 0; // do poslednje neprazne ćelije
    for (const tc of xml.deca(tr)) {
      const i = xml.ime(tc);
      if (i !== 'table:table-cell' && i !== 'table:covered-table-cell') continue;
      const puta = broj(tc, 'table:number-columns-repeated', NAJVISE_KOLONA);
      const v = i === 'table:table-cell' ? vrednostCelije(tc) : '';
      if (v === '') {
        if (red.length + puta > NAJVISE_KOLONA) break; // ostatak reda je prazan do kraja lista
        for (let k = 0; k < puta; k++) red.push('');
        continue;
      }
      if (red.length + puta > NAJVISE_KOLONA) throw new Error(GRESKA_XML);
      for (let k = 0; k < puta; k++) red.push(v);
      duzina = red.length;
    }
    red.length = duzina;
    const puta = broj(tr, 'table:number-rows-repeated', NAJVISE_REDOVA);
    if (duzina === 0) { praznih += puta; continue; }
    if (redovi.length + praznih + puta > NAJVISE_REDOVA) throw new Error(GRESKA_XML);
    for (; praznih > 0; praznih--) redovi.push([]);
    ukupno += duzina * puta;
    if (ukupno > NAJVISE_CELIJA) throw new Error(GRESKA_XML);
    for (let k = 0; k < puta; k++) redovi.push([...red]);
  }
  return redovi;
}

function telo(putanja, lista) {
  const stablo = xml.razberi(zip.procitaj(putanja, 'content.xml', lista));
  if (stablo === null) throw new Error(GRESKA_XML);
  const koren = stablo.find((n) => xml.ime(n) === 'office:document-content');
  const body = koren ? xml.deca(koren).find((n) => xml.ime(n) === 'office:body') : null;
  if (!body) throw new Error('OpenDocument fajl nema sadržaj.');
  return body;
}

// Vraća {tabele: string[][][], tekst, vrsta: 'odt'|'ods'}.
function procitaj(putanja) {
  const lista = zip.lista(putanja);
  const v = vrsta(putanja, lista);
  if (v === null) throw new Error('Fajl nije OpenDocument tekst (.odt) ni tabela (.ods).');
  if (zasticen(putanja, lista)) throw new Error('Dokument je zaštićen lozinkom. Sačuvajte ga bez lozinke pa ga uvezite ponovo.');
  const body = telo(putanja, lista);
  const tabele = [];
  if (v === 'ods') {
    const sp = xml.deca(body).find((n) => xml.ime(n) === 'office:spreadsheet');
    for (const t of sp ? xml.deca(sp) : []) if (xml.ime(t) === 'table:table') tabele.push(list(t));
    return { tabele, tekst: '', vrsta: v };
  }
  const tx = xml.deca(body).find((n) => xml.ime(n) === 'office:text');
  if (!tx) throw new Error('OpenDocument fajl nema sadržaj.');
  const tekst = [];
  pasusi(tx, tekst, tabele, { n: 0 });
  return { tabele, tekst: tekst.join('\n'), vrsta: v };
}

module.exports = { procitaj, vrsta };
