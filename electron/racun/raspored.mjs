// Automatski raspored prijava u grupe i turnuse. Cele vrednosti, bez baze.

const KOLATOR = new Intl.Collator('hr', { sensitivity: 'base' });

// null ide na kraj; brojevi brojevno, tekst kolatorom.
function uporedi(a, b) {
  const na = a == null || a === '';
  const nb = b == null || b === '';
  if (na || nb) return na === nb ? 0 : na ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return KOLATOR.compare(String(a), String(b));
}

function kljucevi(opc) {
  const k = [];
  if (opc.poKategoriji) k.push('kat_redosled', 'kategorija_id', 'prog_redosled', 'program_id');
  // klub_id posle skracenice: dva kluba iste skracenice se ne mesaju
  if (opc.poKlubu) k.push('klub_skr', 'klub_id');
  k.push('prezime', 'ime', 'prijava_id');
  return k;
}

const katKljuc = (x) => (x.kategorija_id == null ? null : x.kategorija_id);
// Prijava bez kluba je sama svoj "klub": takmicari bez kluba nisu saigraci.
const klubKljuc = (x) => x.klub_id ?? x.klub_skr ?? `bez:${x.prijava_id}`;

// Deli niz duzine n na t uzastopnih delova, razlika najvise 1.
function ravnomerno(n, t) {
  const out = [];
  for (let i = 0; i < t; i++) out.push(Math.floor(n / t) + (i < n % t ? 1 : 0));
  return out;
}

// Velicine turnusa: blokovi se dele na T delova, najmanji najveci deo, pa najveci najmanji.
function podelaBlokova(blokovi, T, kap) {
  const B = blokovi.length;
  if (B < T) return null;
  const pref = [0];
  blokovi.forEach((b) => pref.push(pref.at(-1) + b));
  const deo = (i, j) => pref[j] - pref[i];
  const NEG = -1;
  // mx[t][j]: najmanji najveci deo za prvih j blokova u t delova.
  const mx = Array.from({ length: T + 1 }, () => new Array(B + 1).fill(Infinity));
  mx[0][0] = 0;
  for (let t = 1; t <= T; t++) {
    for (let j = t; j <= B; j++) {
      for (let i = t - 1; i < j; i++) {
        const v = Math.max(mx[t - 1][i], deo(i, j));
        if (v < mx[t][j]) mx[t][j] = v;
      }
    }
  }
  const M = mx[T][B];
  if (!(M <= kap)) return null;
  // mn[t][j]: najveci najmanji deo uz sve delove <= M.
  const mn = Array.from({ length: T + 1 }, () => new Array(B + 1).fill(NEG));
  const od = Array.from({ length: T + 1 }, () => new Array(B + 1).fill(-1));
  mn[0][0] = Infinity;
  for (let t = 1; t <= T; t++) {
    for (let j = t; j <= B; j++) {
      for (let i = t - 1; i < j; i++) {
        if (mn[t - 1][i] === NEG) continue;
        const d = deo(i, j);
        if (d > M) continue;
        const v = Math.min(mn[t - 1][i], d);
        if (v > mn[t][j]) {
          mn[t][j] = v;
          od[t][j] = i;
        }
      }
    }
  }
  const velicine = [];
  let j = B;
  for (let t = T; t >= 1; t--) {
    const i = od[t][j];
    velicine.unshift(deo(i, j));
    j = i;
  }
  return velicine;
}

// Uzastopni blokovi istog kljuca: vraca velicine.
function blokoviPo(niz, kljuc) {
  const out = [];
  niz.forEach((x, i) => {
    if (i > 0 && kljuc(x) === kljuc(niz[i - 1])) out[out.length - 1]++;
    else out.push(1);
  });
  return out;
}

function velicineTurnusa(niz, opc, kap) {
  const n = niz.length;
  if (opc.poKategoriji && opc.turnusPoKategoriji) {
    return blokoviPo(niz, katKljuc).flatMap((b) => ravnomerno(b, Math.ceil(b / kap)));
  }
  const T = Math.ceil(n / kap);
  const blokovi = opc.poKategoriji ? blokoviPo(niz, katKljuc) : new Array(n).fill(1);
  const pod = opc.poKategoriji ? podelaBlokova(blokovi, T, kap) : ravnomerno(n, T);
  if (pod) return pod;
  // Nijedna granica kategorija ne staje: prethodni turnus pun.
  const out = [];
  for (let ost = n; ost > 0; ost -= kap) out.push(Math.min(kap, ost));
  return out;
}

// Cena reza: podeljen klub je najskuplji, rez na granici kategorije je pozeljan, pa ujednacenost (zbir kvadrata velicina).
const CENA_KLUBA = 1e8;
const CENA_KATEGORIJE = 1e6;

// Grupe jednog turnusa: k uzastopnih grupa od 1 do maksimum, rezovi izabrani dinamickim programiranjem.
function grupeTurnusa(niz, opc) {
  const m = niz.length;
  const k = Math.min(opc.brojSprava, m);
  const max = opc.maksimum;
  const granicaKat = (i) => opc.poKategoriji && i > 0 && i < m && katKljuc(niz[i]) !== katKljuc(niz[i - 1]);
  const istiProg = (a, b) => !opc.poKategoriji || (a.program_id ?? null) === (b.program_id ?? null);
  const granicaKluba = (i) =>
    granicaKat(i) || (i > 0 && i < m && (klubKljuc(niz[i]) !== klubKljuc(niz[i - 1]) || !istiProg(niz[i], niz[i - 1])));
  const cenaReza = (i) => {
    if (i === m) return 0;
    let c = 0;
    if (opc.poKlubu && !granicaKluba(i)) c += CENA_KLUBA;
    if (granicaKat(i)) c -= CENA_KATEGORIJE;
    return c;
  };
  // dp[g][j]: najmanja cena za prvih j prijava u g grupa; od[g][j]: gde pocinje poslednja grupa.
  const dp = Array.from({ length: k + 1 }, () => new Array(m + 1).fill(Infinity));
  const od = Array.from({ length: k + 1 }, () => new Array(m + 1).fill(-1));
  dp[0][0] = 0;
  for (let g = 1; g <= k; g++) {
    for (let j = g; j <= m; j++) {
      const rez = cenaReza(j);
      // pri istoj ceni ostaje prvi nadjeni rez (deterministicki)
      for (let i = Math.max(g - 1, j - max); i < j; i++) {
        if (dp[g - 1][i] === Infinity) continue;
        const s = j - i;
        const v = dp[g - 1][i] + s * s + rez;
        if (v < dp[g][j]) {
          dp[g][j] = v;
          od[g][j] = i;
        }
      }
    }
  }
  const krajevi = [];
  for (let g = k, j = m; g >= 1; g--) {
    krajevi.unshift(j);
    j = od[g][j];
  }
  let poz = 0;
  return krajevi.map((kraj, g) => {
    const grupa = { pocetna_pozicija: g + 1, clanovi: niz.slice(poz, kraj).map((x) => x.prijava_id) };
    poz = kraj;
    return grupa;
  });
}

export function rasporedi(prijave, opcije) {
  const opc = {
    brojSprava: opcije.brojSprava,
    maksimum: opcije.maksimum,
    poKategoriji: opcije.poKategoriji !== false,
    poKlubu: opcije.poKlubu !== false,
    turnusPoKategoriji: opcije.turnusPoKategoriji === true,
  };
  if (!prijave.length || opc.brojSprava < 1 || opc.maksimum < 1) return { turnusi: [] };
  const polja = kljucevi(opc);
  const niz = [...prijave].sort((a, b) => {
    for (const p of polja) {
      const r = uporedi(a[p], b[p]);
      if (r !== 0) return r;
    }
    return 0;
  });
  const kap = opc.maksimum * opc.brojSprava;
  const turnusi = [];
  let poz = 0;
  velicineTurnusa(niz, opc, kap).forEach((v, i) => {
    turnusi.push({ turnus: i + 1, grupe: grupeTurnusa(niz.slice(poz, poz + v), opc) });
    poz += v;
  });
  return { turnusi };
}

export function sazetak(raspored, prijave) {
  const poId = new Map(prijave.map((x) => [x.prijava_id, x]));
  let ukupno = 0;
  const turnusi = raspored.turnusi.map((t) => {
    const kategorije = [];
    const velicine = t.grupe.map((g) => g.clanovi.length);
    t.grupe.forEach((g) =>
      g.clanovi.forEach((id) => {
        const x = poId.get(id);
        const naziv = x && x.kategorija ? x.kategorija : 'bez kategorije';
        if (!kategorije.includes(naziv)) kategorije.push(naziv);
      }),
    );
    const broj = velicine.reduce((a, b) => a + b, 0);
    ukupno += broj;
    return { turnus: t.turnus, broj, kategorije, velicine };
  });
  return { ukupno, turnusi };
}
