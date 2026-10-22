// Cista logika forme takmicenja: stanje forme <-> unos za model (POPIS 2, 4.3).
import { datumPrikaz } from '../../electron/racun/datum.mjs';

const tekst = (v) => String(v ?? '').trim();
const ceo = (v) => parseInt(tekst(v), 10) || 0;

// Stanje forme -> p za gim.takmicenja.sacuvaj: brojevi, 0/1; datum ostaje sirov (model ga proverava).
export function izForme(f) {
  return {
    naziv: tekst(f.naziv),
    datum: tekst(f.datum),
    mesto: tekst(f.mesto),
    broj_e_sudija: ceo(f.broj_e_sudija),
    pravilo_e: tekst(f.pravilo_e),
    ekipno_broji: ceo(f.ekipno_broji),
    pomeraj_redosled: f.pomeraj_redosled ? 1 : 0,
    zavrseno: f.zavrseno ? 1 : 0,
    zaglavlje_biltena: tekst(f.zaglavlje_biltena),
    organizator: tekst(f.organizator),
    domacin: tekst(f.domacin),
  };
}

// Red iz modela (prazno() ili nadji()) -> stanje forme; datum kao dd.mm.gggg.
export function uFormu(r) {
  return {
    naziv: r.naziv ?? '',
    datum: datumPrikaz(r.datum),
    mesto: r.mesto ?? '',
    broj_e_sudija: Number(r.broj_e_sudija) || 4,
    pravilo_e: r.pravilo_e || 'odbaci_krajnje',
    ekipno_broji: String(r.ekipno_broji ?? 3),
    pomeraj_redosled: Number(r.pomeraj_redosled) === 1,
    zavrseno: Number(r.zavrseno) === 1,
    zaglavlje_biltena: r.zaglavlje_biltena ?? '',
    organizator: r.organizator ?? '',
    domacin: r.domacin ?? '',
  };
}

// Model vraca sve greske spojene u jednu nisku (razmak iza tacke); ovde ih vracamo u listu.
export function razdvojiGreske(poruka) {
  return String(poruka ?? '').split(/(?<=\.|\))\s+(?=[A-ZŠĐČĆŽ])/).filter(Boolean);
}

// Id polja koje treba fokusirati za poruku modela, ili null.
export function poljeGreske(poruka) {
  if (poruka.startsWith('Naziv')) return 'naziv';
  if (poruka.startsWith('Datum')) return 'datum';
  if (poruka.startsWith('Broj E sudija')) return 'izbor-sudije';
  if (poruka.startsWith('Broj ocena')) return 'ekipno_broji';
  return null;
}
