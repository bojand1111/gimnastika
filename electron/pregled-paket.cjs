// IPC moduli pocetna i takmicenje (Pregled): jedan poziv po ekranu (POPIS 1.1, 2.1, 6.8).
const { grupaNaSpravi } = require('./racun/grupe.mjs');
const { datumPrikaz, danUNedelji } = require('./racun/datum.mjs');

// Precice sa Pocetne (POPIS 1.2): [tekst, [tasteri]].
const PRECICE = [
  ['Unos ocena', ['F2']],
  ['Rang liste', ['F4']],
  ['Sledeće polje', ['Tab', 'Enter']],
  ['Otkaži izmenu', ['Esc']],
  ['Novi zapis', ['Alt', 'N']],
];

const p2 = (n) => String(n).padStart(2, '0');
const datumLokalno = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Najnovija kopija iz liste (Task 1 oblik: ime, vreme u ms); danas i tekst su po lokalnom vremenu.
function poslednja(lista) {
  const k = lista[0];
  if (!k) return null;
  const d = new Date(Number(k.vreme));
  return {
    ime: k.ime,
    vreme: Number(k.vreme),
    danas: datumLokalno(d) === datumLokalno(new Date()),
    tekst: `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}. ${p2(d.getHours())}:${p2(d.getMinutes())}`,
  };
}

// p: podesavanja; pr: prijave; tk: takmicenja; g: grupe; o: ocene; s: sifarnici.
// sinhroStanje: () => stanje klijenta sajta (SPEC8) ili null. aktivnoRed baca GreskaKorisnika bez aktivnog takmicenja; kopijaLista: () => [{ime, vreme, ...}] najnovija prva.
function napravi({ p, pr, tk, g, o, s, aktivnoRed, kopijaLista = () => [], sinhroStanje = () => null }) {
  // Prvi pol koji nije gotov (Z pa M); ako su oba gotova, ostaje poslednji sa grupama (POPIS 2.1).
  function napredakINastavi(takm) {
    const tid = Number(takm.id);
    const pomeraj = Number(takm.pomeraj_redosled) === 1;
    let napredak = null;
    let nastavi = null;
    for (const pol of ['Z', 'M']) {
      const grupe = g.lista(tid, pol);
      if (grupe.length === 0) continue;
      const sprave = s.sprave(pol);
      const n = { ...o.napredak(tid, pol, grupe, sprave, pomeraj), pol };
      if (napredak === null || !n.gotovo) {
        napredak = n;
        nastavi = null;
        for (const [i, sp] of sprave.entries()) {
          const gr = grupaNaSpravi(grupe, i + 1, n.rotacija, Math.max(1, sprave.length), pomeraj);
          if (gr === null) continue;
          const ids = gr.clanovi.map((c) => Number(c.prijava_id));
          const oc = o.zaSpravu(Number(sp.id), ids);
          const uneto = ids.filter((pid) => (oc[pid]?.status ?? 'nacrt') !== 'nacrt').length;
          if (uneto < ids.length) {
            nastavi = { sprava: sp, rotacija: n.rotacija, uneto, ukupno: ids.length, pol };
            break;
          }
        }
        if (!n.gotovo) break;
      }
    }
    return { napredak, nastavi };
  }

  const urlUnos = (nastavi) => (nastavi
    ? `#/unos?pol=${nastavi.pol}&sprava=${nastavi.sprava.id}&rot=${nastavi.rotacija}`
    : '#/unos');

  return {
    pocetna: {
      // Radi i bez aktivnog takmicenja (takm i stanje su tada null).
      podaci: () => {
        const takm = p.aktivno();
        const aid = takm ? Number(takm.id) : null;
        return {
          takm,
          stanje: aid === null ? null : pr.stanjePripreme(aid),
          ostala: tk.sva().filter((r) => Number(r.id) !== aid).map((r) => ({ ...r, stanje: pr.stanjePripreme(Number(r.id)) })),
          lekarski: pr.lekarskiUpozorenja(p.dajInt('lekarski_prag_dana', 30)),
          poslednjaKopija: poslednja(kopijaLista()),
          precice: PRECICE.map(([tekst, tasteri]) => [tekst, [...tasteri]]),
        };
      },
    },
    takmicenje: {
      podaci: () => {
        const takm = aktivnoRed();
        const tid = Number(takm.id);
        const { napredak, nastavi } = napredakINastavi(takm);
        return {
          takm,
          brojevi: pr.brojevi(tid),
          stanje: pr.stanjePripreme(tid),
          napredak,
          nastavi,
          danUNedelji: danUNedelji(String(takm.datum ?? '')),
          datumTekst: datumPrikaz(takm.datum),
          unosHash: urlUnos(nastavi),
          sinhro: sinhroStanje(),
        };
      },
    },
  };
}

module.exports = { napravi, PRECICE };
