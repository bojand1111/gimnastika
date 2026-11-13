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
