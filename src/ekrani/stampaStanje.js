// Cista logika ekrana Stampa i Bilten (POPIS 4.2, 4.3, 5.2, 7). Tekstovi su doslovni iz PHP verzije.
import { datumPrikaz } from '../../electron/racun/datum.mjs';
import { odustaoRec } from './rangStanje.js';

// Kolone grida visebojne liste: mesto, broj, ime, po spravi, ukupno (POPIS 4.3).
export function kolone(brojSprava, polozeno) {
  return `50px 32px minmax(0,1fr) ${(polozeno ? '112px ' : '104px ').repeat(brojSprava)}70px`;
}

// VK, bez mesta ("–") ili broj sa tackom.
export function mestoTekst(mesto, oznaka) {
  if (oznaka === 'VK') return 'VK';
  if (mesto === null || mesto === undefined) return '–';
  return `${mesto}.`;
}

// "{mesto}, {datum}"; bez mesta samo datum. Prazan datum ostavlja zarez posle mesta (kao PHP).
export function gdeKada(takm) {
  const mesto = takm.mesto ?? '';
  return (mesto !== '' ? `${mesto}, ` : '') + datumPrikaz(takm.datum);
}

// Vreme stampe: puno "dd.mm.gggg. HH:mm" (podnozje) i kratko "dd.mm. HH:mm" (ZVANICNO).
export function vremeStampe(d) {
  const p = (n) => String(n).padStart(2, '0');
  const kratko = `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`;
  return { puno: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}. ${p(d.getHours())}:${p(d.getMinutes())}`, kratko };
}

// Podrazumevano ime PDF-a (POPIS 7). vrsta: 'bilten' ili naziv liste (Višeboj, Ekipno, naziv sprave).
export function imePdf(vrsta, naziv, pol) {
  const cisto = (t) => String(t ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
  const polTekst = pol === 'M' ? 'MSG' : 'ŽSG';
  const delovi = vrsta === 'bilten' ? ['Bilten'] : ['Rang-lista'];
  if (cisto(naziv) !== '') delovi.push(cisto(naziv));
  if (vrsta !== 'bilten' && cisto(vrsta) !== '') delovi.push(cisto(vrsta));
  delovi.push(polTekst);
  return `${delovi.join('-')}.pdf`;
}

// Legenda liste za stampu: dva reda; tab je 'ekipno', 'viseboj' ili id sprave.
export function legendaStampe(takm, tab, pol) {
  const e = takm.pravilo_e === 'odbaci_krajnje' ? 'prosek srednjih ocena E sudija' : 'prosek ocena E sudija';
  const clan = pol === 'Z' ? 'takmičarka' : 'takmičar';
  let drugi = `Ocena na spravi = D + E − odbitak. VK = van konkurencije: ocene se prikazuju, ${clan} ne zauzima mesto.`;
  if (String(tab) === 'ekipno') drugi += ` Ekipno: po spravi se broje ${Number(takm.ekipno_broji)} najbolje ocene, ocene u zagradi se ne broje.`;
  return [`D = težina vežbe · E = izvođenje (${e}) · Odb. = odbitak · (n) = mesto na spravi · Br. = startni broj`, drugi];
}

export function legendaBiltena(takm) {
  return `D = težina vežbe, E = izvođenje, Uk. = ocena na spravi (D + E − odbitak). Ekipno: po spravi se broje ${Number(takm.ekipno_broji)} najbolje ocene, ocene u zagradi se ne broje. VK = van konkurencije.`;
}

export const ekipaRec = (n) => (n === 1 ? 'ekipa' : 'ekipe');

// Stavke biltena grupisane po uzastopnim sekcijama (ekipno, viseboj): svaka grupa dobija naslov i tabelu.
export function grupisiSekcije(stavke) {
  const grupe = [];
  for (const s of stavke) {
    const z = grupe[grupe.length - 1];
    if (z && z.sekcija === s.sekcija) z.stavke.push(s);
    else grupe.push({ sekcija: s.sekcija, stavke: [s] });
  }
  return grupe;
}

// "odustala" | "odustao" (mala slova, u listama za stampu).
export const odustalaRec = (pol) => odustaoRec(pol).toLowerCase();
