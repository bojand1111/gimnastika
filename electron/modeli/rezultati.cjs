// Model Rezultati (SQLite): cita prijave i ocene i predaje ih cistim funkcijama iz racun/. Oblici su iz POPIS 1.
// Sve liste su nizovi u redosledu ranga (JS objekti sa celobrojnim kljucevima ne cuvaju redosled ubacivanja).
const { napravi: napraviOcene } = require('./ocene.cjs');
const { KOLATOR } = require('./sortiranje.cjs');
const { izBaze } = require('../racun/broj.mjs');
const { odbaceniIndeksi } = require('../racun/ocena.mjs');
const { mesta, viseboj, ekipno, ISTI_DELI } = require('../racun/plasman.mjs');

// Poredi dva kljuca; null ide prvo (kao u MySQL-u), brojevi brojcano, tekst kolatorom.
function poredi(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return KOLATOR.compare(String(a), String(b));
}

// Par (id, naziv) u nizu; isti id zadrzava prvu poziciju, a naziv se prepisuje (kao PHP niz sa kljucem).
function dodajPar(niz, id, naziv) {
  const postojeci = niz.find((p) => p.id === id);
  if (postojeci) postojeci.naziv = naziv;
  else niz.push({ id, naziv });
}

// (int) iz URL vrednosti kao u PHP-u: neispravan tekst je 0.
const celo = (v) => parseInt(String(v), 10) || 0;

// Mesta po kljucu pretvorena u niz [pid, red] sortiran po redosledu ranga.
const poRedosledu = (m) => Object.entries(m).map(([k, r]) => [Number(k), r]).sort((a, b) => a[1].redosled - b[1].redosled);

function napravi(baza, podesavanja) {
  const ocene = napraviOcene(baza, podesavanja);

  // Kombinacije (pol, kategorija, program) koje imaju prijave: Z pre M, pa redosled kategorije i programa (null prvi).
  function kombinacije(takmicenjeId, pol = null) {
    const params = [takmicenjeId];
    let polSql = '';
    if (pol !== null) {
      polSql = ' AND t.pol = ?';
      params.push(pol);
    }
    const redovi = baza.svi(
      `SELECT t.pol, kat.id AS kategorija_id, kat.naziv AS kategorija, kat.redosled AS kat_redosled,
              pr.id AS program_id, pr.naziv AS program, pr.redosled AS prog_redosled, COUNT(*) AS broj
       FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id
       LEFT JOIN kategorije kat ON kat.id = p.kategorija_id LEFT JOIN programi pr ON pr.id = p.program_id
       WHERE p.takmicenje_id = ?${polSql}
       GROUP BY t.pol, kat.id, pr.id`, params);
    redovi.sort((a, b) => poredi(b.pol, a.pol) || poredi(a.kat_redosled, b.kat_redosled) || poredi(a.kategorija_id, b.kategorija_id)
      || poredi(a.prog_redosled, b.prog_redosled) || poredi(a.program_id, b.program_id));
    return redovi.map((r) => ({
      pol: r.pol, kategorija_id: r.kategorija_id, kategorija: r.kategorija, program_id: r.program_id, program: r.program, broj: Number(r.broj),
    }));
  }

  // Izbor pola, kategorije i programa iz URL vrednosti (stringovi ili undefined), sa podrazumevanim iz prijava.
  function izbor(takm, pol, kat, prog) {
    const sve = kombinacije(takm);
    if (pol !== 'M' && pol !== 'Z') pol = sve.length > 0 ? sve[0].pol : 'Z';
    const komb = sve.filter((k) => k.pol === pol);
    let katId = kat === undefined || kat === null || kat === '' ? null : celo(kat);
    let progId = prog === undefined || prog === null || prog === '' ? null : celo(prog);

    const kategorije = [];
    for (const k of komb) dodajPar(kategorije, Number(k.kategorija_id ?? 0), k.kategorija ?? '–');
    if (katId === null || !kategorije.some((p) => p.id === katId)) {
      katId = komb.length > 0 ? Number(komb[0].kategorija_id ?? 0) : null;
    }
    const programi = [];
    for (const k of komb) {
      if (Number(k.kategorija_id ?? 0) === (katId ?? 0)) dodajPar(programi, Number(k.program_id ?? 0), k.program ?? '–');
    }
    if (progId === null || !programi.some((p) => p.id === progId)) progId = programi.length > 0 ? programi[0].id : null;

    return {
      ima: komb.length > 0,
      pol,
      kat: katId || null,
      prog: progId || null,
      kategorije,
      programi,
      kat_naziv: kategorije.find((p) => p.id === katId)?.naziv ?? '',
      prog_naziv: programi.find((p) => p.id === progId)?.naziv ?? '',
    };
  }

  // Svi rezultati jedne grupe (pol, kategorija, program).
  function izracunaj(takm, pol, kategorijaId, programId) {
    const tid = Number(takm.id);
    const sprave = baza.svi('SELECT * FROM sprave WHERE pol = ? ORDER BY redosled, id', [pol]);
    const sids = sprave.map((s) => Number(s.id));
    const isti = podesavanja.daj('plasman_isti_rezultat', ISTI_DELI);
    const nepotpun = podesavanja.daj('viseboj_nepotpun', 'ulazi');

    const redovi = baza.svi(
      `SELECT p.*, t.id_broj, t.ime, t.prezime, t.godina_rodjenja, t.pol, k.skracenica AS klub_skr, k.puno_ime AS klub_ime,
              (SELECT GROUP_CONCAT(ps.sprava_id) FROM prijava_sprave ps WHERE ps.prijava_id = p.id) AS sprave_ids
       FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id LEFT JOIN klubovi k ON k.id = p.klub_id
       WHERE p.takmicenje_id = ? AND t.pol = ? AND p.kategorija_id IS ? AND p.program_id IS ?`,
      [tid, pol, kategorijaId ?? null, programId ?? null]);
    redovi.sort((a, b) => KOLATOR.compare(a.prezime, b.prezime) || KOLATOR.compare(a.ime, b.ime) || a.id - b.id);
    const prijaveRedom = redovi.map((r) => ({
      ...r, sprave: r.sprave_ids ? String(r.sprave_ids).split(',').map(Number) : [],
    }));
    const prijave = {};
    for (const p of prijaveRedom) prijave[Number(p.id)] = p;

    const sveOcene = ocene.zaTakmicenje(tid);

    // Ocene po prijavi: sid => hiljaditi | null (odustao); kljuc nedostaje = ne radi ili jos nije uneto
    const oc = {};
    const detalji = {};
    for (const p of prijaveRedom) {
      const pid = Number(p.id);
      oc[pid] = {};
      detalji[pid] = {};
      for (const sid of p.sprave) {
        const o = sveOcene[pid]?.[sid] ?? null;
        if (o === null) continue;
        if (o.status === 'odustao') {
          oc[pid][sid] = null;
          detalji[pid][sid] = { status: 'odustao' };
        } else if (o.status === 'uneto' || o.status === 'ispravljeno') {
          oc[pid][sid] = izBaze(o.konacna);
          detalji[pid][sid] = {
            status: o.status,
            d: izBaze(o.d),
            e: izBaze(o.e),
            odbitak: izBaze(o.odbitak),
            konacna: izBaze(o.konacna),
            e_sudije: o.e_sudije,
            odbacene: odbaceniIndeksi(Object.values(o.e_sudije), String(takm.pravilo_e)),
          };
        }
      }
    }

    // Po spravi
    const poSpravi = {};
    const mestoNaSpravi = {};
    for (const sid of sids) {
      const stavke = [];
      for (const p of prijaveRedom) {
        const pid = Number(p.id);
        if (!p.sprave.includes(sid) || !Object.hasOwn(oc[pid], sid)) continue;
        const d = detalji[pid][sid];
        stavke.push({ kljuc: pid, vrednost: oc[pid][sid], vk: Number(p.van_konkurencije) === 1, tie: [d.e ?? 0, d.d ?? 0] });
      }
      poSpravi[sid] = [];
      for (const [pid, r] of poRedosledu(mesta(stavke, isti))) {
        (mestoNaSpravi[pid] ??= {})[sid] = r.oznaka;
        poSpravi[sid].push({ prijava: pid, mesto: r.mesto, oznaka: r.oznaka, ...detalji[pid][sid] });
      }
    }

    // Viseboj: Map cuva redosled prijava kao ulaz (jednaki zbirovi ostaju u tom redosledu)
    const ulaz = new Map();
    for (const p of prijaveRedom) {
      const pid = Number(p.id);
      let sumE = 0;
      let sumD = 0;
      for (const d of Object.values(detalji[pid])) {
        sumE += d.e ?? 0;
        sumD += d.d ?? 0;
      }
      ulaz.set(pid, {
        ocene: oc[pid],
        vk: Number(p.van_konkurencije) === 1,
        iskljucen: nepotpun === 'ne_ulazi' && p.sprave.length < sids.length,
        tie: [sumE, sumD],
      });
    }
    const visebojRedovi = [];
    for (const [pid, r] of poRedosledu(viseboj(ulaz, sids, 'ulazi', isti))) {
      const odustao = Object.values(oc[pid]).includes(null);
      if (Object.keys(oc[pid]).length === 0 && !odustao) continue; // jos nema nijednu ocenu
      visebojRedovi.push({
        prijava: pid, zbir: r.zbir, mesto: r.mesto, oznaka: r.oznaka, odustao,
        ocene: oc[pid], detalji: detalji[pid], mesta: mestoNaSpravi[pid] ?? {},
      });
    }

    // Ekipno: clanovi ekipe koji nisu VK, sa klubom
    const clanovi = [];
    for (const p of prijaveRedom) {
      if (Number(p.clan_ekipe) === 1 && Number(p.van_konkurencije) === 0 && p.klub_id !== null) {
        clanovi.push({ prijava: Number(p.id), klub: Number(p.klub_id), ocene: oc[Number(p.id)] });
      }
    }
    const ekipe = [];
    for (const ek of ekipno(clanovi, sids, Number(takm.ekipno_broji), isti)) {
      const klub = baza.jedan('SELECT * FROM klubovi WHERE id = ?', [Number(ek.klub)]);
      const cl = ek.clanovi.map((pid) => {
        let zbir = 0;
        let ima = false;
        for (const val of Object.values(oc[pid])) {
          if (val !== null) {
            zbir += val;
            ima = true;
          }
        }
        const broji = {};
        for (const [sid, ids] of Object.entries(ek.brojane)) broji[sid] = ids.includes(pid);
        return { prijava: pid, ocene: oc[pid], zbir: ima ? zbir : null, broji };
      });
      cl.sort((a, b) => (b.zbir ?? -1) - (a.zbir ?? -1));
      ekipe.push({ klub, po_spravi: ek.po_spravi, ukupno: ek.ukupno, mesto: ek.mesto, oznaka: ek.oznaka, clanovi: cl });
    }

    return { sprave, prijave, prijave_redom: prijaveRedom, po_spravi: poSpravi, viseboj: visebojRedovi, ekipno: ekipe };
  }

  return { kombinacije, izbor, izracunaj };
}

module.exports = { napravi };
