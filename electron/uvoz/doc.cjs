// Čita tabele i tekst iz starog Word .doc fajla (Word 97-2003). Tekst se sklapa iz tabele delova
// (CLX), a granice ćelija i redova tabele se čitaju iz svojstava pasusa (FKP): kraj ćelije je znak 7
// u pasusu "u tabeli", kraj reda je znak 7 sa oznakom TTP. Izlaz je isti kao kod docx.
const cfb = require('./cfb.cjs');

const NAJVISE_ZNAKOVA = 20_000_000;
const NAJVISE_CELIJA = 2_000_000;
const NAJVISE_RUNOVA = 1_000_000; // svojstava pasusa, ukupno u svim FKP stranama
const NAJVISE_POLJA = 64; // dubina ugnježđenih polja
const OSTECEN = 'Word dokument je oštećen.';
const PRESTAR = 'Word dokument je u prestarom formatu (Word 95 ili stariji). Sačuvajte ga kao .docx pa ga uvezite ponovo.';
const ZASTICEN = 'Word dokument je zaštićen lozinkom. Sačuvajte ga bez lozinke pa ga uvezite ponovo.';
const cp1252 = new TextDecoder('windows-1252');

function fib(w) {
  if (w.length < 0x200) throw new Error(OSTECEN);
  const ident = w.readUInt16LE(0);
  if (ident === 0xa5dc) throw new Error(PRESTAR);
  if (ident !== 0xa5ec) throw new Error('Fajl nije Word dokument (.doc).');
  if (w.readUInt16LE(2) < 0xc1) throw new Error(PRESTAR);
  const zastavice = w.readUInt16LE(0x0a);
  if (zastavice & 0x0100 || zastavice & 0x8000) throw new Error(ZASTICEN);
  const csw = w.readUInt16LE(32);
  const lw = 34 + csw * 2 + 2;
  const cslw = w.readUInt16LE(34 + csw * 2);
  const fcLcb = lw + cslw * 4 + 2;
  if (cslw < 4 || fcLcb > w.length) throw new Error(OSTECEN);
  const broj = w.readUInt16LE(lw + cslw * 4);
  if (broj <= 33 || fcLcb + broj * 8 > w.length) throw new Error(OSTECEN);
  const par = (i) => ({ fc: w.readUInt32LE(fcLcb + i * 8), lcb: w.readUInt32LE(fcLcb + i * 8 + 4) });
  return {
    tabela: zastavice & 0x0200 ? '1Table' : '0Table',
    ccpText: w.readUInt32LE(lw + 12),
    papx: par(13),
    clx: par(33),
  };
}

function deo(tok, { fc, lcb }) {
  if (fc + lcb > tok.length) throw new Error(OSTECEN);
  return tok.subarray(fc, fc + lcb);
}

// Delovi teksta: {cp, cpKraj, fc (bajt u WordDocument), sirina (1 = cp1252, 2 = UTF-16)}.
function deloviTeksta(clx) {
  let o = 0;
  while (o < clx.length && clx[o] === 0x01) {
    if (o + 3 > clx.length) throw new Error(OSTECEN);
    o += 3 + clx.readInt16LE(o + 1);
  }
  if (o + 5 > clx.length || clx[o] !== 0x02) throw new Error(OSTECEN);
  const lcb = clx.readUInt32LE(o + 1);
  const plc = clx.subarray(o + 5, o + 5 + lcb);
  if (plc.length !== lcb || (lcb - 4) % 12 !== 0) throw new Error(OSTECEN);
  const n = (lcb - 4) / 12;
  const delovi = [];
  for (let i = 0; i < n; i++) {
    // granice delova idu redom, pa se svaki znak čita najviše jednom
    if (plc.readUInt32LE(i * 4) > plc.readUInt32LE((i + 1) * 4)) throw new Error(OSTECEN);
    const p = 4 * (n + 1) + i * 8;
    const fc = plc.readUInt32LE(p + 2);
    const komp = (fc & 0x40000000) !== 0;
    delovi.push({
      cp: plc.readUInt32LE(i * 4),
      cpKraj: plc.readUInt32LE((i + 1) * 4),
      fc: komp ? (fc & 0x3fffffff) / 2 : fc,
      sirina: komp ? 1 : 2,
    });
  }
  return delovi;
}

// Sprm-ovi iz grpprl: [{op, v: operand}].
function sprmovi(b) {
  const izlaz = [];
  let o = 0;
  while (o + 2 <= b.length) {
    const op = b.readUInt16LE(o);
    const spra = op >> 13;
    let duz = [1, 1, 2, 4, 2, 2, 0, 3][spra];
    if (spra === 6) {
      if (o + 3 > b.length) break;
      if (op === 0xd608 || op === 0xd605) {
        if (o + 4 > b.length) break;
        duz = b.readUInt16LE(o + 2) + 1;
      } else if (op === 0xc615 && b[o + 2] === 255) {
        const brisanih = b[o + 3] ?? 0;
        const dodatih = b[o + 4 + brisanih * 4] ?? 0;
        duz = 1 + 1 + brisanih * 4 + 1 + dodatih * 3;
      } else {
        duz = 1 + b[o + 2];
      }
    }
    if (o + 2 + duz > b.length) break;
    izlaz.push({ op, v: b.subarray(o + 2, o + 2 + duz) });
    o += 2 + duz;
  }
  return izlaz;
}

// Runovi svojstava pasusa iz FKP strana: [{fc, fcKraj, sp, dodatni}], po fc. Svaka strana se čita
// jednom; veliki PAPX iz toka Data (sprmPHugePapx) se razbira jednom po ofsetu i deli između runova.
function runoviPasusa(w, tabela, f, podaci) {
  const plc = deo(tabela, f.papx);
  if (plc.length < 4 || (plc.length - 4) % 8 !== 0) return [];
  const n = (plc.length - 4) / 8;
  const runovi = [];
  const strane = new Set();
  const velikiPapx = new Map();
  for (let i = 0; i < n; i++) {
    const pn = plc.readUInt32LE((n + 1) * 4 + i * 4) & 0x3fffff;
    if (strane.has(pn)) continue;
    strane.add(pn);
    const s = w.subarray(pn * 512, pn * 512 + 512);
    if (s.length < 512) throw new Error(OSTECEN);
    const crun = s[511];
    if (runovi.length + crun > NAJVISE_RUNOVA) throw new Error(OSTECEN);
    for (let k = 0; k < crun; k++) {
      const fc = s.readUInt32LE(k * 4);
      const fcKraj = s.readUInt32LE((k + 1) * 4);
      const b = s[(crun + 1) * 4 + k * 13] * 2;
      let grp = Buffer.alloc(0);
      if (b !== 0) {
        const cb = s[b];
        grp = cb === 0 ? s.subarray(b + 2, b + 2 + 2 * s[b + 1]) : s.subarray(b + 1, b + 2 * cb);
      }
      const sp = sprmovi(grp.subarray(2)); // bez istd
      const veliki = sp.find((x) => x.op === 0x6646 && x.v.length === 4);
      let dodatni = null;
      if (veliki && podaci) {
        const o = veliki.v.readUInt32LE(0);
        if (!velikiPapx.has(o)) {
          velikiPapx.set(o, o + 2 <= podaci.length ? sprmovi(podaci.subarray(o + 2, o + 2 + podaci.readUInt16LE(o))) : []);
        }
        dodatni = velikiPapx.get(o);
      }
      runovi.push({ fc, fcKraj, sp, dodatni });
    }
  }
  return runovi.sort((a, b) => a.fc - b.fc);
}

// Svojstva pasusa čiji je znak kraja na `fc`.
function svojstva(runovi, fc) {
  let lo = 0;
  let hi = runovi.length - 1;
  let r = null;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (runovi[m].fc <= fc) { r = runovi[m]; lo = m + 1; } else { hi = m - 1; }
  }
  const s = { uTabeli: false, ttp: false, granice: null };
  if (r === null || fc >= r.fcKraj) return s;
  for (const { op, v } of r.dodatni ? r.sp.concat(r.dodatni) : r.sp) {
    if (op === 0x2416) s.uTabeli = v[0] !== 0;
    else if (op === 0x6649 && v.length === 4) s.uTabeli = s.uTabeli || v.readInt32LE(0) >= 1;
    else if (op === 0x2417) s.ttp = v[0] !== 0;
    else if (op === 0xd608 && v.length >= 3) {
      const itc = v[2];
      if (v.length >= 3 + (itc + 1) * 2) {
        s.granice = [];
        for (let i = 0; i <= itc; i++) s.granice.push(v.readInt16LE(3 + i * 2));
      }
    }
  }
  return s;
}

// Pasusi glavnog teksta: [{tekst, kraj ('\r' | '\x07' | '\f'), fc znaka kraja}]. Kod polja (između
// znakova 0x13 i 0x14) se preskače, rezultat polja (do 0x15) ostaje.
function pasusiTeksta(w, delovi, ccp) {
  if (ccp > NAJVISE_ZNAKOVA) throw new Error('Fajl je prevelik.');
  const pasusi = [];
  let s = '';
  const polja = []; // po otvorenom polju: true dok traje kod polja
  let uKodu = 0; // koliko otvorenih polja je još u kodu
  for (const d of delovi) {
    const od = Math.max(0, d.cp);
    const doo = Math.min(ccp, d.cpKraj);
    if (doo <= od) continue;
    const pocetak = d.fc + (od - d.cp) * d.sirina;
    const bajtovi = w.subarray(pocetak, pocetak + (doo - od) * d.sirina);
    if (bajtovi.length !== (doo - od) * d.sirina) throw new Error(OSTECEN);
    const t = d.sirina === 2 ? bajtovi.toString('utf16le') : cp1252.decode(bajtovi);
    for (let i = 0; i < t.length; i++) {
      const z = t.charCodeAt(i);
      if (z === 0x13) {
        if (polja.length >= NAJVISE_POLJA) throw new Error(OSTECEN);
        polja.push(true);
        uKodu++;
        continue;
      }
      if (z === 0x14) {
        if (polja.length && polja[polja.length - 1]) { polja[polja.length - 1] = false; uKodu--; }
        continue;
      }
      if (z === 0x15) {
        if (polja.length && polja.pop()) uKodu--;
        continue;
      }
      if (z === 0x0d || z === 0x07 || z === 0x0c) {
        pasusi.push({ tekst: s, kraj: t[i], fc: pocetak + i * d.sirina });
        s = '';
        continue;
      }
      if (uKodu > 0) continue;
      if (z === 0x09 || z === 0x0b || z === 0xa0) s += ' ';
      else if (z === 0x1e) s += '-';
      else if (z >= 0x20) s += t[i];
    }
  }
  if (s !== '') pasusi.push({ tekst: s, kraj: '\r', fc: -1 });
  return pasusi.map((p) => ({ ...p, tekst: p.tekst.replace(/\s+/g, ' ').trim() }));
}

// Granice kolona bliže od 30 twipova (oko pola milimetra) su ista granica.
function mreza(redovi) {
  const sve = [...new Set(redovi.flatMap((r) => r.granice ?? []))].sort((a, b) => a - b);
  const izlaz = [];
  for (const x of sve) if (izlaz.length === 0 || x - izlaz.at(-1) > 30) izlaz.push(x);
  return izlaz;
}

// Spojena ćelija (šira od kolona drugih redova) se ponavlja kao gridSpan u docx; ako svi redovi
// imaju isti broj ćelija ili granice ne odgovaraju broju ćelija, ćelije ostaju kakve jesu.
function sklopi(redovi) {
  const isti = redovi.every((r) => r.celije.length === redovi[0].celije.length);
  const m = isti ? [] : mreza(redovi);
  return redovi.map((r) => {
    if (isti || !r.granice || r.granice.length !== r.celije.length + 1) return r.celije;
    const red = [];
    r.celije.forEach((c, i) => {
      const a = r.granice[i];
      const b = r.granice[i + 1];
      const sirina = Math.max(1, m.filter((x) => x > a + 30 && x <= b + 30).length);
      for (let k = 0; k < sirina; k++) red.push(c);
    });
    return red;
  });
}

// Vraća {tabele: string[][][], tekst}.
function procitaj(putanja) {
  const c = cfb.otvori(putanja);
  const w = c.tok('WordDocument');
  if (w === null) throw new Error('Fajl nije Word dokument (.doc).');
  const f = fib(w);
  const tabela = c.tok(f.tabela);
  if (tabela === null) throw new Error(OSTECEN);
  const delovi = deloviTeksta(deo(tabela, f.clx));
  const runovi = runoviPasusa(w, tabela, f, c.tok('Data'));
  const tabele = [];
  const tekst = [];
  let tab = null; // {redovi: [{celije, granice}], red: [], celija: []}
  let ukupno = 0;
  const zatvori = () => {
    if (tab === null) return;
    if (tab.celija.length) tab.red.push(tab.celija.join(' '));
    if (tab.red.length) tab.redovi.push({ celije: tab.red, granice: null });
    tabele.push(sklopi(tab.redovi));
    tab = null;
  };
  for (const p of pasusiTeksta(w, delovi, f.ccpText)) {
    const s = p.kraj === '\f' ? { uTabeli: false } : svojstva(runovi, p.fc);
    if (!s.uTabeli) {
      zatvori();
      if (p.tekst !== '') tekst.push(p.tekst);
      continue;
    }
    tab ??= { redovi: [], red: [], celija: [] };
    if (s.ttp) {
      if (tab.celija.length) { tab.red.push(tab.celija.join(' ')); tab.celija = []; }
      tab.redovi.push({ celije: tab.red, granice: s.granice });
      tab.red = [];
    } else {
      if (p.tekst !== '') tab.celija.push(p.tekst);
      if (p.kraj === '\x07') {
        if (++ukupno > NAJVISE_CELIJA) throw new Error(OSTECEN);
        tab.red.push(tab.celija.join(' '));
        tab.celija = [];
      }
    }
  }
  zatvori();
  return { tabele, tekst: tekst.join('\n') };
}

module.exports = { procitaj };
