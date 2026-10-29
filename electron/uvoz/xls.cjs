// Čita listove iz starog Excel .xls fajla (Excel 97-2003, BIFF8 zapisi u toku Workbook).
// Izlaz je isti kao kod xlsx: svaki radni list je jedna tabela, datumi kao dd.mm.gggg.
const cfb = require('./cfb.cjs');
const { DATUMSKI_UGRADJENI, datumIzBroja } = require('./xlsx.cjs');

const NAJVISE_CELIJA = 2_000_000;
const OSTECEN = 'Excel fajl je oštećen.';

const BOF = 0x0809;
const EOF = 0x000a;
const CONTINUE = 0x003c;
const FILEPASS = 0x002f;
const DATEMODE = 0x0022;
const FORMAT = 0x041e;
const XF = 0x00e0;
const BOUNDSHEET = 0x0085;
const SST = 0x00fc;
const LABELSST = 0x00fd;
const LABEL = 0x0204;
const RSTRING = 0x00d6;
const NUMBER = 0x0203;
const RK = 0x027e;
const MULRK = 0x00bd;
const FORMULA = 0x0006;
const STRING = 0x0207;
const BOOLERR = 0x0205;

// Zapisi od datog mesta: {tip, podaci}. CONTINUE zapisi su posebni, spaja ih onaj kome trebaju.
function* zapisi(tok, od = 0) {
  let o = od;
  while (o + 4 <= tok.length) {
    const tip = tok.readUInt16LE(o);
    const duz = tok.readUInt16LE(o + 2);
    if (o + 4 + duz > tok.length) throw new Error(OSTECEN);
    yield { tip, podaci: tok.subarray(o + 4, o + 4 + duz) };
    o += 4 + duz;
  }
}

// Čitanje preko granica CONTINUE zapisa. Kad se znakovi niza nastave u sledećem zapisu,
// on počinje novim bajtom zastavica (0 = jedan bajt po znaku, 1 = UTF-16).
class Delovi {
  constructor(delovi) { this.d = delovi; this.i = 0; this.o = 0; }
  kraj() { return this.i >= this.d.length || (this.i === this.d.length - 1 && this.o >= this.d[this.i].length); }
  pomeri() {
    while (this.i < this.d.length && this.o >= this.d[this.i].length) { this.i++; this.o = 0; }
    if (this.i >= this.d.length) throw new Error(OSTECEN);
  }
  u8() { this.pomeri(); return this.d[this.i][this.o++]; }
  u16() { return this.u8() | (this.u8() << 8); }
  u32() { return (this.u16() | (this.u16() << 16)) >>> 0; }
  preskoci(n) {
    while (n > 0) {
      this.pomeri();
      const k = Math.min(n, this.d[this.i].length - this.o);
      this.o += k;
      n -= k;
    }
  }
  znakovi(broj, siroki) {
    let s = '';
    while (broj > 0) {
      if (this.o >= this.d[this.i].length) {
        this.pomeri();
        siroki = (this.d[this.i][this.o++] & 1) === 1;
        continue;
      }
      const b = this.d[this.i];
      const ima = Math.floor((b.length - this.o) / (siroki ? 2 : 1));
      if (ima === 0) throw new Error(OSTECEN);
      const k = Math.min(broj, ima);
      s += b.toString(siroki ? 'utf16le' : 'latin1', this.o, this.o + k * (siroki ? 2 : 1));
      this.o += k * (siroki ? 2 : 1);
      broj -= k;
    }
    return s;
  }
  // XLUnicodeRichExtendedString (SST) ili XLUnicodeString (duzina16 = true, bez obogaćenja).
  niz(duzina16 = true) {
    const broj = duzina16 ? this.u16() : this.u8();
    const zast = this.u8();
    const runova = zast & 0x08 ? this.u16() : 0;
    const ext = zast & 0x04 ? this.u32() : 0;
    const s = this.znakovi(broj, (zast & 1) === 1);
    this.preskoci(runova * 4 + ext);
    return s;
  }
}

const niz = (bafer, duzina16 = true) => new Delovi([bafer]).niz(duzina16);

// RK broj: 30 bitova celog broja ili gornji deo double-a, opciono podeljen sa 100.
function rk(v) {
  let n;
  if (v & 2) {
    n = v >> 2;
  } else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE((v & 0xfffffffc) >>> 0, 4);
    n = b.readDoubleLE(0);
  }
  return v & 1 ? n / 100 : n;
}

function sredi(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function globalno(tok) {
  const g = { sst: [], formati: new Map(), xf: [], listovi: [], datum1904: false };
  let prvi = true;
  let sst = null;
  for (const z of zapisi(tok)) {
    if (prvi) {
      if (z.tip !== BOF || z.podaci.length < 4) throw new Error(OSTECEN);
      if (z.podaci.readUInt16LE(0) !== 0x0600) {
        throw new Error('Excel fajl je u prestarom formatu (Excel 95 ili stariji). Sačuvajte ga kao .xlsx pa ga uvezite ponovo.');
      }
      prvi = false;
      continue;
    }
    if (sst !== null && z.tip !== CONTINUE) {
      g.sst = citajSst(sst);
      sst = null;
    }
    if (z.tip === EOF) break;
    const p = z.podaci;
    if (z.tip === FILEPASS) throw new Error('Excel fajl je zaštićen lozinkom. Sačuvajte ga bez lozinke pa ga uvezite ponovo.');
    else if (z.tip === DATEMODE && p.length >= 2) g.datum1904 = p.readUInt16LE(0) === 1;
    else if (z.tip === FORMAT && p.length >= 5) g.formati.set(p.readUInt16LE(0), niz(p.subarray(2)));
    else if (z.tip === XF && p.length >= 4) g.xf.push(p.readUInt16LE(2));
    else if (z.tip === BOUNDSHEET && p.length >= 8) g.listovi.push({ ofset: p.readUInt32LE(0), vrsta: p[5] });
    else if (z.tip === SST) sst = [p];
    else if (z.tip === CONTINUE && sst !== null) sst.push(p);
  }
  if (sst !== null) g.sst = citajSst(sst);
  return g;
}

function citajSst(delovi) {
  const d = new Delovi(delovi);
  d.preskoci(4);
  const broj = d.u32();
  const izlaz = [];
  for (let i = 0; i < broj && !d.kraj(); i++) izlaz.push(sredi(d.niz()));
  return izlaz;
}

// Skup indeksa XF zapisa sa formatom datuma (ugrađeni ili sopstveni format sa d/m/y bez # i 0).
function datumskiXf(g) {
  const datumski = new Set(DATUMSKI_UGRADJENI);
  for (const [id, kod] of g.formati) {
    const k = kod.replace(/\[[^\]]*\]|"[^"]*"/g, '');
    if (/[dmy]/i.test(k) && !/[#0]/.test(k)) datumski.add(id);
  }
  const izlaz = new Set();
  g.xf.forEach((f, i) => { if (datumski.has(f)) izlaz.add(i); });
  return izlaz;
}

// budzet: zajedničko ograničenje za celu radnu svesku, {celija, zapisa, najviseZapisa}
function list(tok, ofset, g, datumski, budzet) {
  const celije = new Map(); // red -> Map(kolona -> vrednost)
  const upisi = (red, kol, v) => {
    if (!celije.has(red)) celije.set(red, new Map());
    const r = celije.get(red);
    if (!r.has(kol) && ++budzet.celija > NAJVISE_CELIJA) throw new Error(OSTECEN);
    r.set(kol, v);
  };
  const broj = (n, xf) => {
    if (!Number.isFinite(n)) return '';
    if (datumski.has(xf)) return datumIzBroja(g.datum1904 ? n + 1462 : n);
    return String(n);
  };
  let dubina = 0;
  let cekaNiz = null; // formula sa tekstom: vrednost je u sledećem STRING zapisu
  for (const z of zapisi(tok, ofset)) {
    if (++budzet.zapisa > budzet.najviseZapisa) throw new Error(OSTECEN);
    const p = z.podaci;
    if (z.tip === BOF) { dubina++; continue; }
    if (z.tip === EOF) { if (--dubina <= 0) break; continue; }
    if (dubina !== 1) continue; // ugrađeni grafikon u listu
    if (cekaNiz !== null && z.tip === STRING) {
      upisi(cekaNiz.red, cekaNiz.kol, sredi(niz(p)));
      cekaNiz = null;
      continue;
    }
    cekaNiz = null;
    if (p.length < 6) continue;
    const red = p.readUInt16LE(0);
    const kol = p.readUInt16LE(2);
    const xf = p.readUInt16LE(4);
    if (z.tip === LABELSST && p.length >= 10) upisi(red, kol, g.sst[p.readUInt32LE(6)] ?? '');
    else if ((z.tip === LABEL || z.tip === RSTRING) && p.length >= 9) upisi(red, kol, sredi(niz(p.subarray(6))));
    else if (z.tip === NUMBER && p.length >= 14) upisi(red, kol, broj(p.readDoubleLE(6), xf));
    else if (z.tip === RK && p.length >= 10) upisi(red, kol, broj(rk(p.readUInt32LE(6)), xf));
    else if (z.tip === MULRK) {
      const n = Math.floor((p.length - 6) / 6);
      for (let i = 0; i < n; i++) {
        const x = p.readUInt16LE(4 + i * 6);
        upisi(red, kol + i, broj(rk(p.readUInt32LE(6 + i * 6)), x));
      }
    } else if (z.tip === FORMULA && p.length >= 14) {
      if (p.readUInt16LE(12) === 0xffff) {
        if (p[6] === 0) cekaNiz = { red, kol };
        else if (p[6] === 1) upisi(red, kol, p[8] ? 'da' : 'ne');
      } else {
        upisi(red, kol, broj(p.readDoubleLE(6), xf));
      }
    } else if (z.tip === BOOLERR && p.length >= 8 && p[7] === 0) {
      upisi(red, kol, p[6] ? 'da' : 'ne');
    }
  }
  // prazne ćelije kojima se red dopunjava do poslednje kolone ulaze u isto ograničenje (kao u xlsx)
  const najveci = (kljucevi) => { let n = -1; for (const k of kljucevi) if (k > n) n = k; return n; };
  const redovi = [];
  const poslednji = najveci(celije.keys());
  for (let r = 0; r <= poslednji; r++) {
    const m = celije.get(r);
    if (!m) { redovi.push([]); continue; }
    const duzina = najveci(m.keys()) + 1;
    budzet.celija += duzina - m.size;
    if (budzet.celija > NAJVISE_CELIJA) throw new Error(OSTECEN);
    const red = new Array(duzina).fill('');
    for (const [k, v] of m) red[k] = v;
    redovi.push(red);
  }
  return redovi;
}

// Vraća {tabele: string[][][], tekst: ''}.
function procitaj(putanja) {
  const c = cfb.otvori(putanja);
  const tok = c.tok('Workbook');
  if (tok === null) {
    if (c.ima('Book')) throw new Error('Excel fajl je u prestarom formatu (Excel 95 ili stariji). Sačuvajte ga kao .xlsx pa ga uvezite ponovo.');
    throw new Error('Fajl nije Excel radna sveska (.xls).');
  }
  const g = globalno(tok);
  const datumski = datumskiXf(g);
  const tabele = [];
  // svaki zapis toka se u ispravnom fajlu čita najviše jednom; listovi koji se preklapaju ili
  // ponavljaju isti ofset bi isti posao radili iznova
  const budzet = { celija: 0, zapisa: 0, najviseZapisa: Math.ceil(tok.length / 4) };
  const videni = new Set();
  for (const l of g.listovi) {
    if (l.vrsta !== 0) continue; // samo radni listovi, bez grafikona i makroa
    if (l.ofset >= tok.length) throw new Error(OSTECEN);
    if (videni.has(l.ofset)) continue;
    videni.add(l.ofset);
    tabele.push(list(tok, l.ofset, g, datumski, budzet));
  }
  return { tabele, tekst: '' };
}

module.exports = { procitaj, rk };
