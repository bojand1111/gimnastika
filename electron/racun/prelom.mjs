// Prelamanje rang liste na strane za stampu i bilten (POPIS 4.1 i 5.1). Ciste funkcije, bez baze.
// Prazan ulaz uvek daje jednu praznu stranu: [[]].

const praznoJeJedna = (strane) => (strane.length === 0 ? [[]] : strane);

// Isecanje niza na delove od `n` stavki.
function iseci(niz, n) {
  if (!(n > 0)) throw new Error('Broj redova po strani mora biti veci od nule.');
  const strane = [];
  for (let i = 0; i < niz.length; i += n) strane.push(niz.slice(i, i + n));
  return praznoJeJedna(strane);
}

export function straneSprava(redovi, poStrani = 30) {
  return iseci(redovi, poStrani);
}

// Ekipa zauzima 1 + clanovi.length redova i ne deli se; sama ekipa veca od strane ide na svoju stranu.
export function straneEkipno(ekipe, poStrani = 30) {
  const strane = [];
  let tekuca = [];
  let visina = 0;
  for (const ek of ekipe) {
    const v = 1 + ek.clanovi.length;
    if (tekuca.length > 0 && visina + v > poStrani) {
      strane.push(tekuca);
      tekuca = [];
      visina = 0;
    }
    tekuca.push(ek);
    visina += v;
  }
  if (tekuca.length > 0) strane.push(tekuca);
  return praznoJeJedna(strane);
}

// Viseboj: 11 redova po strani uspravno, 6 polozeno.
export function straneViseboj(redovi, polozeno) {
  return iseci(redovi, polozeno ? 6 : 11);
}

// Stavke biltena: svaka ekipa pa njeni clanovi, zatim redovi viseboja. `v` je visina u px.
export function stavkeBiltena(rez) {
  const stavke = [];
  for (const ek of rez.ekipno) {
    stavke.push({ tip: 'ekipa', sekcija: 'ekipno', v: 24, podaci: ek });
    for (const c of ek.clanovi) stavke.push({ tip: 'clan', sekcija: 'ekipno', v: 23, podaci: c });
  }
  for (const r of rez.viseboj) stavke.push({ tip: 'red', sekcija: 'viseboj', v: 37, podaci: r });
  return stavke;
}

// Visina zaglavlja sekcije (naslov + zaglavlje tabele) u px.
const ZAGLAVLJE_SEKCIJE = { ekipno: 64, viseboj: 86 };

// Bilten prelama po stavkama (ekipa moze da se podeli); sekcija se na novoj strani ponavlja sa zaglavljem.
// organizator, zaglavlje, domacin: tekstovi (prazan tekst = red ne postoji).
export function straneBilten(stavke, { polozeno, organizator, zaglavlje, domacin }) {
  const visinaLista = (polozeno ? 794 : 1123) - 96;
  const visinaZaglavlja = 96 + (organizator ? 18 : 0) + (zaglavlje ? 16 : 0) + (domacin ? 16 : 0);
  const kapacitetPrva = visinaLista - visinaZaglavlja - 80;
  const kapacitetOstale = visinaLista - 30 - 80;

  const strane = [];
  let tekuca = [];
  let zauzeto = 0;
  let sekcijaNaStrani = null;
  let kapacitet = kapacitetPrva;
  for (const s of stavke) {
    let dodatno = sekcijaNaStrani !== s.sekcija ? ZAGLAVLJE_SEKCIJE[s.sekcija] : 0;
    if (tekuca.length > 0 && zauzeto + dodatno + s.v > kapacitet) {
      strane.push(tekuca);
      tekuca = [];
      zauzeto = 0;
      sekcijaNaStrani = null;
      kapacitet = kapacitetOstale;
      dodatno = ZAGLAVLJE_SEKCIJE[s.sekcija];
    }
    tekuca.push(s);
    zauzeto += dodatno + s.v;
    sekcijaNaStrani = s.sekcija;
  }
  if (tekuca.length > 0) strane.push(tekuca);
  return praznoJeJedna(strane);
}
