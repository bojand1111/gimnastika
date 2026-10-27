// Snimak rang lista za sajt (SPEC8 odeljak 1). Cista funkcija: bez baze i bez Node modula.
import { prikaz } from './broj.mjs';

const VERZIJA_FORMATA = 1;

// Ocena kao tekst sa zarezom i ceo broj hiljaditih delova.
const tekst = (v) => (v === null || v === undefined ? '' : prikaz(v));

// Samo 'VK' ostaje kao oznaka; plasman je u polju mesto.
const oznaka = (o) => (o === 'VK' ? 'VK' : '');

// "GGGG-MM-DD HH:MM:SS" (UTC, kao Baza.sad) ili Date u ISO tekst.
function iso(sad) {
  if (sad instanceof Date) return sad.toISOString();
  const t = String(sad);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t) ? `${t.replace(' ', 'T')}.000Z` : t;
}

// Izlaz modela izracunaj => jedna lista snimka.
export function listaIzRezultata(kombinacija, rez) {
  const p = rez.prijave;
  const po_spravi = {};
  for (const [sid, redovi] of Object.entries(rez.po_spravi)) {
    po_spravi[sid] = redovi.map((r) => {
      const pr = p[r.prijava];
      const odustao = r.status === 'odustao';
      const red = {
        mesto: r.mesto ?? null, oznaka: oznaka(r.oznaka), prijava_id: Number(r.prijava), startni_broj: pr.startni_broj ?? null,
        ime: pr.ime, prezime: pr.prezime, klub: pr.klub_skr ?? '', klub_ime: pr.klub_ime ?? '',
      };
      if (!odustao) {
        Object.assign(red, {
          d: tekst(r.d), e: tekst(r.e), odbitak: tekst(r.odbitak), konacna: tekst(r.konacna), konacna_h: r.konacna,
        });
      }
      red.odustao = odustao;
      return red;
    });
  }

  const viseboj = rez.viseboj.map((r) => {
    const pr = p[r.prijava];
    const sprave = {};
    for (const [sid, v] of Object.entries(r.ocene)) {
      if (v !== null && v !== undefined) sprave[sid] = { konacna: tekst(v), konacna_h: v };
    }
    const red = {
      mesto: r.mesto ?? null, oznaka: oznaka(r.oznaka), prijava_id: Number(r.prijava), ime: pr.ime, prezime: pr.prezime,
      klub: pr.klub_skr ?? '', po_spravi: sprave, odustao: Boolean(r.odustao),
    };
    // Zbir se izostavlja kad nema nijedne ocene
    if (r.zbir !== null && r.zbir !== undefined) Object.assign(red, { zbir: tekst(r.zbir), zbir_h: r.zbir });
    return red;
  });

  const ekipno = rez.ekipno.map((e) => {
    const sprave = {};
    for (const [sid, v] of Object.entries(e.po_spravi)) sprave[sid] = { zbir: tekst(v), zbir_h: v };
    return {
      mesto: e.mesto ?? null, oznaka: oznaka(e.oznaka), klub: e.klub?.skracenica ?? '', klub_ime: e.klub?.puno_ime ?? '',
      po_spravi: sprave, ukupno: tekst(e.ukupno), ukupno_h: e.ukupno,
      clanovi: e.clanovi.map((c) => ({ prijava_id: Number(c.prijava), ime: p[c.prijava]?.ime ?? '', prezime: p[c.prijava]?.prezime ?? '' })),
    };
  });

  return {
    pol: kombinacija.pol,
    kategorija: { id: kombinacija.kategorija_id ?? null, naziv: kombinacija.kategorija ?? '' },
    program: { id: kombinacija.program_id ?? null, naziv: kombinacija.program ?? '' },
    po_spravi, viseboj, ekipno,
  };
}

// sprave: redovi tabele sprave po polu ({Z: [...], M: [...]}); liste: izlaz listaIzRezultata.
export function snimak({ takm, sprave, liste, verzija, sad }) {
  const spr = {};
  for (const pol of ['Z', 'M']) {
    spr[pol] = (sprave?.[pol] ?? []).map((s) => ({ id: Number(s.id), naziv: s.naziv, skracenica: s.skracenica }));
  }
  return {
    verzija_formata: VERZIJA_FORMATA,
    program: { naziv: 'Gimnastika desktop', verzija },
    poslato: iso(sad),
    takmicenje: {
      id: Number(takm.id), naziv: takm.naziv, datum: takm.datum ?? '', mesto: takm.mesto ?? '', organizator: takm.organizator ?? '',
      domacin: takm.domacin ?? '', zavrseno: Number(takm.zavrseno) || 0, izmenjeno: takm.izmenjeno ?? '',
    },
    sprave: spr,
    liste,
  };
}
