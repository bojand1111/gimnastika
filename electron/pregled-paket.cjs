// IPC moduli pocetna i takmicenje (Pregled): jedan poziv po ekranu (POPIS 1.1, 2.1, 6.8).
const { grupaNaSpravi, grupeTurnusa } = require('./racun/grupe.mjs');
const { datumPrikaz, danUNedelji } = require('./racun/datum.mjs');

// Precice sa Pocetne (POPIS 1.2): [tekst, [tasteri]].
const PRECICE = [
  ['Unos ocena', ['F2']],
  ['Rang liste', ['F4']],
  ['Sledeće polje', ['Tab', 'Enter']],
  ['Otkaži izmenu', ['Esc']],
  ['Novi zapis', ['Alt', 'N']],
  ['Prebaci na MSG', ['Alt', 'M']],
  ['Prebaci na ŽSG', ['Alt', 'Z']],
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
function napravi({ baza, p, pr, tk, g, o, s, aktivnoRed, kopijaLista = () => [], sinhroStanje = () => null }) {
  // Napredak i sledeci unos samo za pol takmicenja (POPIS 2.1); bez grupa su oba null.
  function napredakINastavi(takm) {
    const tid = Number(takm.id);
    const pomeraj = Number(takm.pomeraj_redosled) === 1;
    const pol = takm.pol;
    const grupe = g.lista(tid, pol);
    if (grupe.length === 0) return { napredak: null, nastavi: null };
    const sprave = s.sprave(pol);
    const napredak = { ...o.napredak(tid, pol, grupe, sprave, pomeraj), pol };
    let nastavi = null;
    // nastavak se trazi u turnusu napretka
    const uTurnusu = grupeTurnusa(grupe, napredak.turnus);
    for (const [i, sp] of sprave.entries()) {
      const gr = grupaNaSpravi(uTurnusu, i + 1, napredak.rotacija, Math.max(1, sprave.length), pomeraj);
      if (gr === null) continue;
      const ids = gr.clanovi.map((c) => Number(c.prijava_id));
      const oc = o.zaSpravu(Number(sp.id), ids);
      const uneto = ids.filter((pid) => (oc[pid]?.status ?? 'nacrt') !== 'nacrt').length;
      if (uneto < ids.length) {
        nastavi = { sprava: sp, rotacija: napredak.rotacija, turnus: napredak.turnus, broj_turnusa: napredak.broj_turnusa, uneto, ukupno: ids.length, pol };
        break;
      }
    }
    return { napredak, nastavi };
  }

  // Pol se ne nosi u linku: ekran Unos ocena uzima izabrani deo.
  // tu samo kad ima vise turnusa
  const urlUnos = (nastavi) => (nastavi
    ? `#/unos?sprava=${nastavi.sprava.id}&rot=${nastavi.rotacija}${nastavi.broj_turnusa > 1 ? `&tu=${nastavi.turnus}` : ''}`
    : '#/unos');

  // Uvezene objave koje korisnik jos nije video: samo aktivni pol ili bez pola (odbijen fajl).
  function izAzuriranja(pol) {
    return baza.svi(
      `SELECT u.takmicenje_id, u.naziv, u.stanje, u.poruka, t.datum
         FROM uvezene_objave u LEFT JOIN takmicenja t ON t.id = u.takmicenje_id
        WHERE u.prikazano = 0 AND u.stanje IN ('uvezeno', 'odbijeno') AND (u.pol = ? OR u.pol = '') ORDER BY u.vreme, u.uid`, [pol])
      .map((r) => ({ takmicenje_id: r.takmicenje_id, naziv: r.naziv, datumTekst: datumPrikaz(r.datum), stanje: r.stanje, poruka: r.poruka }));
  }

  return {
    pocetna: {
      // Kartica uvoza se prikazuje jednom: oznacavaju se redovi aktivnog dela i redovi bez pola (kao u kartici).
      potvrdiUvoz: () => {
        baza.izvrsi("UPDATE uvezene_objave SET prikazano = 1 WHERE prikazano = 0 AND (pol = ? OR pol = '')", [p.aktivniPol()]);
        return { ok: true };
      },
      // Radi i bez aktivnog takmicenja (takm i stanje su tada null).
      podaci: () => {
        const pol = p.aktivniPol();
        const takm = p.aktivno(pol);
        const aid = takm ? Number(takm.id) : null;
        return {
          pol,
          takm,
          stanje: aid === null ? null : pr.stanjePripreme(aid),
          ostala: tk.sva(pol).filter((r) => Number(r.id) !== aid).map((r) => ({ ...r, stanje: pr.stanjePripreme(Number(r.id)) })),
          // null: lekarski se ne prati, Pocetna ne prikazuje karticu
          lekarski: p.pratiLekarski(pol) ? pr.lekarskiUpozorenja(p.dajInt('lekarski_prag_dana', 30), pol) : null,
          poslednjaKopija: poslednja(kopijaLista()),
          iz_azuriranja: izAzuriranja(pol),
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
