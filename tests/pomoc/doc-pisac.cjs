// Pisac minimalnog Word 97 .doc fajla samo za testove čitača: FIB, tekst u jednom ili dva dela
// (piece table u CLX), svojstva pasusa u FKP stranama (u tabeli, kraj reda, granice ćelija).
const cfb = require('./cfb-pisac.cjs');

const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const i16 = (n) => { const b = Buffer.alloc(2); b.writeInt16LE(n); return b; };
const sprm = (op, operand) => Buffer.concat([u16(op), operand]);

function tDefTable(granice) {
  const itc = granice.length - 1;
  const ostatak = Buffer.concat([Buffer.from([itc]), ...granice.map(i16), Buffer.alloc(20 * itc)]);
  return sprm(0xd608, Buffer.concat([u16(ostatak.length + 1), ostatak]));
}

const U_TABELI = Buffer.concat([sprm(0x2416, Buffer.from([1])), sprm(0x6649, u32(1))]);

// elementi: {p: 'tekst'} ili {tabela: [[ćelija, ...], ...], granice: [[x0, x1, ...], ...]?}
// Ćelija je tekst ili niz pasusa. opcije: {komprimovano, delovi: 1|2, sifrovano, nFib,
// ponoviStrane: n (svaka FKP strana navedena n puta), cpObrnuto (granice delova van redosleda)}
function napravi(putanja, elementi, opcije = {}) {
  const pasusi = []; // {tekst (sa znakom kraja), sprm}
  for (const e of elementi) {
    if (e.p !== undefined) { pasusi.push({ tekst: e.p + '\r', sprm: Buffer.alloc(0) }); continue; }
    e.tabela.forEach((red, ri) => {
      for (const c of red) {
        const delovi = Array.isArray(c) ? c : [c];
        delovi.forEach((d, i) => pasusi.push({ tekst: d + (i === delovi.length - 1 ? '\x07' : '\r'), sprm: U_TABELI }));
      }
      const g = e.granice?.[ri] ?? red.map((_, i) => i * 1000).concat([red.length * 1000]);
      pasusi.push({ tekst: '\x07', sprm: Buffer.concat([U_TABELI, sprm(0x2417, Buffer.from([1])), tDefTable(g)]) });
    });
  }
  pasusi.push({ tekst: '\r', sprm: Buffer.alloc(0) });
  const tekst = pasusi.map((p) => p.tekst).join('');
  const kodiraj = (s) => (opcije.komprimovano ? Buffer.from(s, 'latin1') : Buffer.from(s, 'utf16le'));
  const sirina = opcije.komprimovano ? 1 : 2;

  // Tekst počinje na 1024; sa dva dela drugi deo ide ispred prvog u fajlu (redosled u fajlu nije bitan).
  const delovi = [];
  if (opcije.delovi === 2) {
    const k = Math.floor(tekst.length / 2);
    const b2 = kodiraj(tekst.slice(k));
    delovi.push({ cp: 0, s: tekst.slice(0, k), fc: 1024 + b2.length }, { cp: k, s: tekst.slice(k), fc: 1024 });
  } else {
    delovi.push({ cp: 0, s: tekst, fc: 1024 });
  }
  const sadrzaj = Buffer.alloc(1024 + tekst.length * sirina);
  for (const d of delovi) kodiraj(d.s).copy(sadrzaj, d.fc);
  // FC znaka na poziciji cp
  const fcZnaka = (cp) => {
    const d = delovi.findLast((x) => x.cp <= cp);
    return d.fc + (cp - d.cp) * sirina;
  };

  // Svaki pasus je jedan run u FKP; delovi teksta mogu da preseku pasus, pa se pasus deli po delovima.
  const runovi = [];
  let cp = 0;
  for (const p of pasusi) {
    let pocetak = cp;
    const kraj = cp + p.tekst.length;
    for (const d of delovi) {
      const granica = d.cp + d.s.length;
      if (d.cp > pocetak || granica <= pocetak) continue;
      const doKraja = Math.min(kraj, granica);
      runovi.push({ fc: fcZnaka(pocetak), fcKraj: fcZnaka(doKraja - 1) + sirina, sprm: p.sprm });
      pocetak = doKraja;
    }
    if (pocetak < kraj) {
      runovi.push({ fc: fcZnaka(pocetak), fcKraj: fcZnaka(kraj - 1) + sirina, sprm: p.sprm });
    }
    cp = kraj;
  }
  runovi.sort((a, b) => a.fc - b.fc);

  // FKP strane: runova koliko stane u 512 bajtova.
  const pocetakFkp = Math.ceil(sadrzaj.length / 512) * 512;
  const strane = [];
  const velicina = (x) => ((x.sprm.length + 2 + 2) + 1) & ~1;
  const grupe = [];
  for (const x of runovi) {
    const g = grupe.at(-1);
    const zauzeto = g ? (g.length + 2) * 4 + (g.length + 1) * 13 + g.reduce((a, y) => a + velicina(y), 0) + velicina(x) : Infinity;
    if (zauzeto <= 510) g.push(x); else grupe.push([x]);
  }
  for (const r of grupe) {
    const s = Buffer.alloc(512);
    const crun = r.length;
    r.forEach((x, k) => s.writeUInt32LE(x.fc, k * 4));
    s.writeUInt32LE(r[crun - 1].fcKraj, crun * 4);
    let kraj = 511;
    r.forEach((x, k) => {
      const grp = Buffer.concat([u16(0), x.sprm]); // istd 0 + sprm-ovi
      const zapis = grp.length % 2 === 1
        ? Buffer.concat([Buffer.from([(grp.length + 1) / 2]), grp])
        : Buffer.concat([Buffer.from([0, grp.length / 2]), grp]);
      kraj = (kraj - zapis.length) & ~1;
      zapis.copy(s, kraj);
      s[(crun + 1) * 4 + k * 13] = kraj / 2;
    });
    s[511] = crun;
    strane.push({ s, fc: r[0].fc, kraj: r[crun - 1].fcKraj });
  }
  const word = Buffer.concat([sadrzaj, Buffer.alloc(pocetakFkp - sadrzaj.length), ...strane.map((x) => x.s)]);

  // Tabela: CLX pa PlcfBtePapx.
  const pcd = (d) => Buffer.concat([u16(0), u32(opcije.komprimovano ? (d.fc * 2) | 0x40000000 : d.fc), u16(0)]);
  const sortirani = [...delovi].sort((a, b) => a.cp - b.cp);
  const cpovi = sortirani.map((d) => d.cp).concat([tekst.length]);
  if (opcije.cpObrnuto) cpovi[0] = cpovi[1] + 1;
  const plc = Buffer.concat([...cpovi.map(u32), ...sortirani.map(pcd)]);
  const clx = Buffer.concat([Buffer.from([1]), i16(2), Buffer.from([0, 0]), Buffer.from([2]), u32(plc.length), plc]);
  const puta = opcije.ponoviStrane ?? 1;
  const sveStrane = strane.flatMap((x, i) => Array(puta).fill({ ...x, pn: pocetakFkp / 512 + i }));
  const bte = Buffer.concat([...sveStrane.map((x) => u32(x.fc)), u32(strane.at(-1).kraj), ...sveStrane.map((x) => u32(x.pn))]);
  const tabela = Buffer.concat([clx, bte]);

  // FIB (Word 97: csw 14, cslw 22, cbRgFcLcb 93).
  const fib = Buffer.alloc(900);
  fib.writeUInt16LE(0xa5ec, 0);
  fib.writeUInt16LE(opcije.nFib ?? 0xc1, 2);
  fib.writeUInt16LE(0x0200 | (opcije.sifrovano ? 0x0100 : 0), 0x0a);
  fib.writeUInt16LE(14, 32);
  fib.writeUInt16LE(22, 62);
  fib.writeUInt32LE(tekst.length, 64 + 12);
  fib.writeUInt16LE(93, 152);
  const fcLcb = 154;
  fib.writeUInt32LE(clx.length, fcLcb + 13 * 8); // fcPlcfBtePapx
  fib.writeUInt32LE(bte.length, fcLcb + 13 * 8 + 4);
  fib.writeUInt32LE(0, fcLcb + 33 * 8); // fcClx
  fib.writeUInt32LE(clx.length, fcLcb + 33 * 8 + 4);
  fib.copy(word, 0);

  cfb.napravi(putanja, [['WordDocument', word], ['1Table', tabela]]);
  return putanja;
}

// Isti sadržaj kao docxPrimer (polje DATE, nelomljiva crtica u zaglavlju, spojena ćelija).
function docPrimer(putanja, opcije = {}) {
  const g6 = [0, 500, 2500, 4000, 5500, 7000, 9000];
  return napravi(putanja, [
    { p: 'I KOLO PGL VOJVODINE MSG A, B i C' },
    { p: 'DEFINITIVNA I IMENIČNA PRIJAVA' },
    { p: 'Datum: \x13 DATE \\@ "dd.MM.yyyy" \x1429.10.2026\x15' },
    { tabela: [['Klub', 'G.D.“PARTIZAN –ŽELJEZNIČAR“'], ['Kontakt osoba', 'Robert M.']] },
    { p: '' },
    {
      tabela: [
        ['#', 'PREZIME', 'IME', 'KATEGORIJA', ['DATUM', 'ROĐENJA'], 'FUNKCIJA\x1eEKIPA'],
        ['1.', 'Neorčić', 'Noah', 'I “B”', '12.02.2017.', 'pojedinac'],
        ['2.', 'Herceg', 'Aron', 'IV “A”', '25.04.2012..', 'ekipa'],
        ['3.', 'Laudis Nanaši', 'Dragan', 'IV “A”', '14.11.2012.', ''],
        ['4.', '', '', '', '', ''],
        ['napomena preko dve kolone', '', '', '', ''],
      ],
      granice: [g6, g6, g6, g6, g6, [0, 2500, 4000, 5500, 7000, 9000]],
    },
  ], opcije);
}

module.exports = { napravi, docPrimer };
