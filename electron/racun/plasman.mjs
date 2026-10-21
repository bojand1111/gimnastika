// Plasmani: po spravi, viseboj, ekipno. Ciste funkcije, bez baze.
// Stavka za rangiranje: { kljuc, vrednost: ceo|null, vk?: bool, tie?: ceo[] }.
// Rezultat: kljuc => { mesto: ceo|null, oznaka: '1'|'VK'|'', vrednost, redosled }.
// Mesto null i oznaka '' znaci bez plasmana (odustao, nema ocenu).

export const ISTI_DELI = 'deli';
export const ISTI_VISA_E_PA_D = 'visa_e_pa_d';

const istiNiz = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export function mesta(stavke, istiRezultat = ISTI_DELI) {
  const sa = stavke.filter((s) => s.vrednost !== null);
  const bez = stavke.filter((s) => s.vrednost === null);
  // stabilno sortiranje (kao usort u PHP 8): opadajuce po vrednosti, pa po tie
  sa.sort((a, b) => {
    const c = b.vrednost - a.vrednost;
    if (c !== 0) return c;
    if (istiRezultat === ISTI_VISA_E_PA_D) {
      const ta = a.tie ?? [];
      const tb = b.tie ?? [];
      for (let i = 0; i < ta.length; i++) {
        const d = (tb[i] ?? 0) - ta[i];
        if (d !== 0) return d;
      }
    }
    return 0;
  });

  const rezultat = {};
  let redosled = 0;
  let mesto = 0; // sledece slobodno mesto (bez VK)
  let prethodna = null; // vrednost (i tie) prethodnog rangiranog
  let prethodnoMesto = 0;
  for (const s of sa) {
    redosled++;
    if (s.vk) {
      rezultat[s.kljuc] = { mesto: null, oznaka: 'VK', vrednost: s.vrednost, redosled };
      continue;
    }
    mesto++;
    const potpis = { v: s.vrednost, tie: istiRezultat === ISTI_VISA_E_PA_D ? (s.tie ?? []) : [] };
    const dodeljeno = prethodna !== null && prethodna.v === potpis.v && istiNiz(prethodna.tie, potpis.tie)
      ? prethodnoMesto
      : mesto;
    prethodna = potpis;
    prethodnoMesto = dodeljeno;
    rezultat[s.kljuc] = { mesto: dodeljeno, oznaka: String(dodeljeno), vrednost: s.vrednost, redosled };
  }
  for (const s of bez) {
    redosled++;
    rezultat[s.kljuc] = { mesto: null, oznaka: '', vrednost: null, redosled };
  }
  return rezultat;
}

// Viseboj: zbir konacnih ocena po spravama. Odustajanje na bilo kojoj spravi = bez zbira.
// takmicari: { prijava: { ocene: { sprava: konacna|null }, vk? } }; null = odustao, nedostajuca sprava = ne radi.
// nepotpun: 'ulazi' (zbir onoga sto je radio) ili 'ne_ulazi' (moraju sve sprave).
export function viseboj(takmicari, sprave, nepotpun = 'ulazi', istiRezultat = ISTI_DELI) {
  const stavke = [];
  for (const [kljuc, t] of Object.entries(takmicari)) {
    let zbir = 0;
    let odustao = false;
    let radio = 0;
    for (const sid of sprave) {
      if (!Object.hasOwn(t.ocene, sid)) continue;
      if (t.ocene[sid] === null) {
        odustao = true;
        break;
      }
      zbir += t.ocene[sid];
      radio++;
    }
    let vrednost = zbir;
    if (odustao || radio === 0 || t.iskljucen || (nepotpun === 'ne_ulazi' && radio < sprave.length)) {
      vrednost = null;
    }
    stavke.push({ kljuc, vrednost, vk: Boolean(t.vk), tie: t.tie ?? [] });
  }
  const out = {};
  for (const [kljuc, r] of Object.entries(mesta(stavke, istiRezultat))) {
    out[kljuc] = { zbir: r.vrednost, mesto: r.mesto, oznaka: r.oznaka, redosled: r.redosled };
  }
  return out;
}

// Ekipno: clanovi istog kluba (vec filtrirani: clan ekipe, nisu VK, ista kategorija/program/pol).
// Po spravi se sabira `broji` najboljih ocena. Zbir ekipe je zbir po spravama.
// Vraca niz ekipa poredan po redosledu (rangu).
export function ekipno(clanovi, sprave, broji, istiRezultat = ISTI_DELI) {
  const ekipe = new Map();
  for (const c of clanovi) {
    if (!ekipe.has(c.klub)) ekipe.set(c.klub, { klub: c.klub, clanovi: [], kandidati: {} });
    const ek = ekipe.get(c.klub);
    ek.clanovi.push(c.prijava);
    for (const sid of sprave) {
      const v = c.ocene[sid] ?? null;
      if (v !== null) (ek.kandidati[sid] ??= []).push({ prijava: c.prijava, v });
    }
  }
  const stavke = [];
  for (const [klub, ek] of ekipe) {
    ek.po_spravi = {};
    ek.brojane = {};
    let ukupno = 0;
    for (const sid of sprave) {
      const k = [...(ek.kandidati[sid] ?? [])].sort((a, b) => b.v - a.v).slice(0, Math.max(1, broji));
      ek.po_spravi[sid] = k.reduce((z, x) => z + x.v, 0);
      ek.brojane[sid] = k.map((x) => x.prijava);
      ukupno += ek.po_spravi[sid];
    }
    ek.ukupno = ukupno;
    delete ek.kandidati;
    stavke.push({ kljuc: klub, vrednost: ukupno });
  }
  // kljuc u rezultatu mesta je string; mapa ekipa cuva izvorni tip kluba
  const poKljucu = new Map([...ekipe].map(([k, ek]) => [String(k), ek]));
  for (const [klub, r] of Object.entries(mesta(stavke, istiRezultat))) {
    const ek = poKljucu.get(klub);
    ek.mesto = r.mesto;
    ek.oznaka = r.oznaka;
    ek.redosled = r.redosled;
  }
  return [...ekipe.values()].sort((a, b) => a.redosled - b.redosled);
}
