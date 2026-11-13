// Format objave takmicenja (verzija_formata 1): cista gradnja i provera fajla, bez baze.
// Pravila su u docs/superpowers/specs/2026-11-13-objava-takmicenja-design.md, odeljak 5.1.
export const VERZIJA_FORMATA = 1;
export const NAJVECA_VELICINA = 2097152;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIZOVI = ['klubovi', 'takmicari', 'kategorije', 'programi', 'sprave', 'prijave', 'grupe', 'ocene'];

// Kopira samo navedena polja (redosled polja je redosled u fajlu).
function izdvoji(red, polja) {
  const izlaz = {};
  for (const p of polja) izlaz[p] = red[p] ?? null;
  return izlaz;
}

const grupisi = (redovi, kljuc) => {
  const mapa = new Map();
  for (const r of redovi ?? []) {
    if (!mapa.has(r[kljuc])) mapa.set(r[kljuc], []);
    mapa.get(r[kljuc]).push(r);
  }
  return mapa;
};

export function napraviObjavu(redovi, { uid, verzija, sad }) {
  const spravePoPrijavi = grupisi(redovi.prijavaSprave, 'prijava_id');
  const clanoviPoGrupi = grupisi(redovi.clanovi, 'grupa_id');
  const redosledPoGrupi = grupisi(redovi.redosledi, 'grupa_id');
  const sudijePoOceni = grupisi(redovi.oceneE, 'ocena_id');

  return {
    verzija_formata: VERZIJA_FORMATA,
    uid,
    program: { naziv: 'Gimnastika desktop', verzija },
    objavljeno: sad,
    takmicenje: izdvoji(redovi.takmicenje, ['naziv', 'datum', 'mesto', 'pol', 'broj_e_sudija', 'pravilo_e',
      'ekipno_broji', 'pomeraj_redosled', 'zaglavlje_biltena', 'organizator', 'domacin']),
    klubovi: redovi.klubovi.map((r) => izdvoji(r, ['id', 'puno_ime', 'skracenica', 'grad'])),
    takmicari: redovi.takmicari.map((r) => izdvoji(r, ['id', 'ime', 'prezime', 'godina_rodjenja', 'pol', 'klub_id', 'drzavljanstvo'])),
    kategorije: redovi.kategorije.map((r) => izdvoji(r, ['id', 'naziv', 'pol', 'redosled'])),
    programi: redovi.programi.map((r) => izdvoji(r, ['id', 'naziv', 'pol', 'redosled'])),
    sprave: redovi.sprave.map((r) => izdvoji(r, ['id', 'pol', 'skracenica', 'naziv'])),
    prijave: redovi.prijave.map((r) => ({
      ...izdvoji(r, ['id', 'takmicar_id', 'klub_id', 'kategorija_id', 'program_id', 'clan_ekipe', 'van_konkurencije', 'startni_broj']),
      sprave: (spravePoPrijavi.get(r.id) ?? []).map((x) => x.sprava_id),
    })),
    grupe: redovi.grupe.map((r) => ({
      ...izdvoji(r, ['id', 'pol', 'naziv', 'redosled', 'pocetna_pozicija', 'turnus']),
      clanovi: (clanoviPoGrupi.get(r.id) ?? []).map((x) => izdvoji(x, ['prijava_id', 'redosled'])),
      redosled_po_rotaciji: (redosledPoGrupi.get(r.id) ?? []).map((x) => izdvoji(x, ['rotacija', 'prijava_id', 'redosled'])),
    })),
    ocene: redovi.ocene.map((r) => ({
      ...izdvoji(r, ['prijava_id', 'sprava_id', 'd', 'e', 'bonus', 'odbitak', 'konacna', 'status', 'broj_ispravki', 'uneto_u']),
      e_sudije: (sudijePoOceni.get(r.id) ?? []).map((x) => izdvoji(x, ['sudija', 'vrednost'])),
    })),
  };
}

const tekst = (v) => typeof v === 'string' && v.trim() !== '';
const cel = (v) => Number.isInteger(v);
const celiliNull = (v) => v === null || v === undefined || Number.isInteger(v);

// Sve sto bi uvoz odbio zbog NOT NULL kolona, tipova i jedinstvenosti (migracije 001 do 009).
function stroga(o, greske) {
  const red = (niz) => niz.filter((r) => r !== null && typeof r === 'object');
  const trazi = (opis, r, polja, proveri, sta) => {
    for (const p of polja) if (!proveri(r[p])) greske.push(opis + ': ' + p + ' ' + sta + '.');
  };
  const tekstovi = (opis, r, polja) => trazi(opis, r, polja, tekst, 'mora biti tekst');
  const celi = (opis, r, polja) => trazi(opis, r, polja, cel, 'mora biti ceo broj');

  for (const r of red(o.klubovi)) tekstovi('Klub ' + r.id, r, ['puno_ime', 'skracenica']);
  for (const r of red(o.takmicari)) {
    tekstovi('Takmičar ' + r.id, r, ['ime', 'prezime', 'pol']);
    celi('Takmičar ' + r.id, r, ['godina_rodjenja']);
  }
  for (const r of red(o.kategorije)) tekstovi('Kategorija ' + r.id, r, ['naziv']);
  for (const r of red(o.programi)) tekstovi('Program ' + r.id, r, ['naziv']);
  for (const r of red(o.sprave)) tekstovi('Sprava ' + r.id, r, ['skracenica']);
  for (const r of red(o.prijave)) celi('Prijava ' + r.id, r, ['clan_ekipe', 'van_konkurencije']);
  for (const g of red(o.grupe)) {
    const oznaka = 'Grupa ' + g.id;
    tekstovi(oznaka, g, ['naziv']);
    celi(oznaka, g, ['redosled', 'pocetna_pozicija', 'turnus']);
    const vidjeno = new Set();
    for (const c of red(Array.isArray(g.clanovi) ? g.clanovi : [])) celi(oznaka + ', član', c, ['redosled']);
    for (const r of red(Array.isArray(g.redosled_po_rotaciji) ? g.redosled_po_rotaciji : [])) {
      celi(oznaka + ', redosled po rotaciji', r, ['redosled', 'rotacija']);
      const k = r.rotacija + '/' + r.prijava_id;
      if (vidjeno.has(k)) greske.push(oznaka + ': ponovljen redosled za prijavu ' + r.prijava_id + ' u rotaciji ' + r.rotacija + '.');
      vidjeno.add(k);
    }
  }
  for (const c of red(o.ocene)) {
    const oznaka = 'Ocena prijave ' + c.prijava_id + ' na spravi ' + c.sprava_id;
    trazi(oznaka, c, ['d', 'e', 'bonus', 'odbitak', 'konacna'], celiliNull, 'mora biti ceo broj ili prazno');
    const sudije = new Set();
    for (const e of red(Array.isArray(c.e_sudije) ? c.e_sudije : [])) {
      celi(oznaka + ', E sudija', e, ['sudija']);
      trazi(oznaka + ', E sudija', e, ['vrednost'], celiliNull, 'mora biti ceo broj ili prazno');
      if (sudije.has(e.sudija)) greske.push(oznaka + ': ponovljen E sudija ' + e.sudija + '.');
      sudije.add(e.sudija);
    }
  }

  // Jedinstvene oznake u svakom spisku.
  for (const k of ['klubovi', 'takmicari', 'kategorije', 'programi', 'sprave', 'prijave', 'grupe']) {
    const vidjeno = new Set();
    for (const r of red(o[k])) {
      if (vidjeno.has(r.id)) greske.push('Spisak ' + k + ': ponovljena oznaka ' + r.id + '.');
      vidjeno.add(r.id);
    }
  }
  const parovi = new Set();
  for (const c of red(o.ocene)) {
    const k = c.prijava_id + '/' + c.sprava_id;
    if (parovi.has(k)) greske.push('Ocena prijave ' + c.prijava_id + ' na spravi ' + c.sprava_id + ' je ponovljena.');
    parovi.add(k);
  }
  const uGrupi = new Set();
  for (const g of red(o.grupe)) {
    for (const c of red(Array.isArray(g.clanovi) ? g.clanovi : [])) {
      if (uGrupi.has(c.prijava_id)) greske.push('Prijava ' + c.prijava_id + ' je u više od jedne grupe.');
      uGrupi.add(c.prijava_id);
    }
  }
  const takmicariPrijava = new Set();
  for (const p of red(o.prijave)) {
    if (takmicariPrijava.has(p.takmicar_id)) greske.push('Takmičar ' + p.takmicar_id + ' ima više od jedne prijave.');
    takmicariPrijava.add(p.takmicar_id);
  }
}

// Vraca listu poruka; prazna lista znaci da je objava ispravna.
export function proveriObjavu(o) {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return ['Fajl nije objava takmičenja.'];
  const greske = [];
  if (o.verzija_formata !== VERZIJA_FORMATA) greske.push('Nepoznata verzija formata fajla.');
  if (typeof o.uid !== 'string' || !UUID.test(o.uid)) greske.push('Oznaka objave (uid) nije ispravna.');

  const t = o.takmicenje;
  if (t === null || typeof t !== 'object' || Array.isArray(t)) {
    greske.push('Nedostaju podaci o takmičenju.');
  } else {
    if (!tekst(t.naziv)) greske.push('Takmičenje nema naziv.');
    if (!tekst(t.datum)) greske.push('Takmičenje nema datum.');
    if (t.pol !== 'M' && t.pol !== 'Z') greske.push('Deo takmičenja (pol) nije ispravan.');
  }

  const nedostaje = NIZOVI.filter((k) => !Array.isArray(o[k]));
  for (const k of nedostaje) greske.push('Nedostaje spisak: ' + k + '.');
  if (nedostaje.length) return greske;

  stroga(o, greske);

  const ids = (niz) => new Set(niz.map((r) => r?.id));
  const klubovi = ids(o.klubovi);
  const takmicari = ids(o.takmicari);
  const kategorije = ids(o.kategorije);
  const programi = ids(o.programi);
  const sprave = ids(o.sprave);
  const prijave = ids(o.prijave);

  // Nedostajuca veza se prijavljuje jednom po redu i polju.
  const veza = (skup, v, opis, dozvoliNull) => {
    if (dozvoliNull && v === null) return;
    if (!skup.has(v)) greske.push(opis);
  };

  for (const t of o.takmicari) {
    veza(klubovi, t?.klub_id, 'Takmičar ' + t?.id + ': klub ne postoji u fajlu.', true);
  }
  for (const p of o.prijave) {
    const oznaka = 'Prijava ' + p?.id;
    veza(takmicari, p?.takmicar_id, oznaka + ': takmičar ne postoji u fajlu.', false);
    veza(klubovi, p?.klub_id, oznaka + ': klub ne postoji u fajlu.', true);
    veza(kategorije, p?.kategorija_id, oznaka + ': kategorija ne postoji u fajlu.', true);
    veza(programi, p?.program_id, oznaka + ': program ne postoji u fajlu.', true);
    if (!Array.isArray(p?.sprave)) {
      greske.push(oznaka + ': nedostaje spisak sprava.');
    } else {
      for (const s of p.sprave) veza(sprave, s, oznaka + ': sprava ne postoji u fajlu.', false);
    }
  }
  for (const g of o.grupe) {
    const oznaka = 'Grupa ' + g?.id;
    for (const c of Array.isArray(g?.clanovi) ? g.clanovi : []) veza(prijave, c?.prijava_id, oznaka + ': član ne postoji u fajlu.', false);
    for (const r of Array.isArray(g?.redosled_po_rotaciji) ? g.redosled_po_rotaciji : []) {
      veza(prijave, r?.prijava_id, oznaka + ': redosled upućuje na prijavu koje nema u fajlu.', false);
    }
  }
  for (const c of o.ocene) {
    veza(prijave, c?.prijava_id, 'Ocena: prijava ne postoji u fajlu.', false);
    veza(sprave, c?.sprava_id, 'Ocena: sprava ne postoji u fajlu.', false);
  }
  return greske;
}
