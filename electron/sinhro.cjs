// Klijent sajta za rezultate uzivo (SPEC8): gradi snimak rang lista aktivnog takmicenja i salje ga na sajt.
// Slanje nikad ne blokira unos: greska se samo pamti i belezi. Nema reda cekanja ni ponovnih pokusaja po tajmeru.
const { listaIzRezultata, snimak } = require('./racun/sinhro-paket.mjs');
const { Baza } = require('./baza/baza.cjs');

const KLJUC = 'sajt_poslednja_sinhronizacija';
const BEZ_TOKENA = 'Unesite token sajta.';
const BEZ_ADRESE = 'Adresa sajta nije podešena.';
const BEZ_TAKMICENJA = 'Nema aktivnog takmičenja. Izaberite ga na ekranu Takmičenja.';
const NEDOSTUPAN = 'Sajt nije dostupan.';
const LOS_ODGOVOR = 'Odgovor sajta nije ispravan.';

function napravi({
  podesavanja, rezultati, takmicenja, sifarnici, baza, dnevnik, verzija, fetch: fetchFn = globalThis.fetch,
  sad = () => Baza.sad(), odlaganjeMs = 3000, istekMs = 15000, setTimeout: postaviTajmer = setTimeout, clearTimeout: ukloniTajmer = clearTimeout,
}) {
  let poslednjaGreska = '';
  let tekuce = null; // promise slanja koje je u toku
  let tajmer = null;
  let sledece = null; // naknadno slanje u redu iza tekuceg

  const url = () => String(podesavanja.daj('sajt_url', '')).trim().replace(/\/+$/, '');
  const token = () => String(podesavanja.daj('sajt_token', '')).trim();
  const ukljuceno = () => url() !== '' && token() !== '';

  // Jedan HTTP zahtev; vraca { json } ili { greska } (tekst za korisnika).
  async function zahtev(metoda, putanja, telo) {
    const ctl = new AbortController();
    const rok = postaviTajmer(() => ctl.abort(), istekMs);
    if (typeof rok?.unref === 'function') rok.unref();
    try {
      const odg = await fetchFn(`${url()}${putanja}`, {
        method: metoda,
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json; charset=utf-8',
          'X-Gimnastika-Verzija': String(verzija),
        },
        body: telo,
        signal: ctl.signal,
      });
      if (odg.status === 401 || odg.status === 403) return { greska: 'Sajt nije prihvatio token.' };
      if (odg.status === 413) return { greska: 'Snimak je prevelik za sajt.' };
      if (odg.status < 200 || odg.status >= 300) return { greska: `Sajt je javio grešku ${odg.status}.` };
      let json;
      try {
        json = JSON.parse(await odg.text());
      } catch {
        return { greska: LOS_ODGOVOR };
      }
      if (!json || json.ok !== true) return { greska: LOS_ODGOVOR };
      return { json };
    } catch (err) {
      // Uzrok ide u dnevnik samo kao ime i kod (nikad adresa ni token)
      dnevnik.info(`Sinhro greska: ${NEDOSTUPAN} (${err?.name ?? 'Greska'}: ${err?.cause?.code ?? 'nepoznato'})`);
      return { greska: NEDOSTUPAN }; // mrezna greska, prekid ili istek
    } finally {
      ukloniTajmer(rok);
    }
  }

  function napraviSnimak(takm, vreme) {
    const liste = rezultati.kombinacije(Number(takm.id)).map((k) => listaIzRezultata(k, rezultati.izracunaj(takm, k.pol, k.kategorija_id ?? null, k.program_id ?? null)));
    return snimak({ takm, sprave: { Z: sifarnici.sprave('Z'), M: sifarnici.sprave('M') }, liste, verzija, sad: vreme });
  }

  function neuspeh(greska) {
    poslednjaGreska = greska;
    dnevnik.info(`Sinhro greska: ${greska}`);
    return { ok: false, liste: 0, greska };
  }

  async function posaljiJednom() {
    if (url() === '') return { ok: false, liste: 0, greska: BEZ_ADRESE };
    if (token() === '') return { ok: false, liste: 0, greska: BEZ_TOKENA };
    const takm = podesavanja.aktivno();
    if (!takm) return neuspeh(BEZ_TAKMICENJA);
    const vreme = sad(); // pre gradnje snimka, da izmena tokom slanja ne bude izgubljena
    let telo;
    let n;
    try {
      const s = napraviSnimak(takm, vreme);
      n = s.liste.length;
      telo = JSON.stringify(s);
    } catch (err) {
      dnevnik.greska('Sinhro: snimak nije napravljen', err);
      return neuspeh('Snimak nije mogao da se napravi.');
    }
    const r = await zahtev('PUT', `/api/gimnastika/takmicenja/${Number(takm.id)}`, telo);
    if (r.greska) return neuspeh(r.greska);
    podesavanja.postavi(KLJUC, vreme);
    poslednjaGreska = '';
    dnevnik.info(`Sinhro: poslato takmicenje ${Number(takm.id)} (${n} lista, ${Buffer.byteLength(telo)} B)`);
    return { ok: true, liste: n, greska: '' };
  }

  // Jedno slanje se pokrece odmah; pracenje ne sme da proizvede neuhvaceno odbijanje.
  function pokreni() {
    const p = posaljiJednom();
    const t = p.then(() => {}, () => {}).finally(() => { if (tekuce === t) tekuce = null; });
    tekuce = t;
    return p;
  }

  // Nikad dva zahteva istovremeno: svi pozivi tokom slanja dele jedno naknadno slanje.
  function posalji() {
    if (!ukljuceno()) ocisti();
    if (tekuce === null) return pokreni();
    if (sledece === null) {
      sledece = tekuce.then(() => {
        sledece = null;
        return pokreni();
      });
    }
    return sledece;
  }

  // Bez adrese ili tokena nema ni greske ni slanja na cekanju.
  function ocisti() {
    poslednjaGreska = '';
    if (tajmer !== null) {
      ukloniTajmer(tajmer);
      tajmer = null;
    }
  }

  // Slanje posle odlaganja; vise poziva u prozoru je jedno slanje.
  function zakazi() {
    if (!ukljuceno()) {
      ocisti();
      return;
    }
    if (tajmer !== null) ukloniTajmer(tajmer);
    tajmer = postaviTajmer(() => {
      tajmer = null;
      posalji().catch((err) => dnevnik.greska('Sinhro: neocekivana greska', err));
    }, odlaganjeMs);
    if (typeof tajmer?.unref === 'function') tajmer.unref();
  }

  async function ping() {
    if (!ukljuceno()) ocisti();
    if (url() === '') return { ok: false, greska: BEZ_ADRESE };
    if (token() === '') return { ok: false, greska: BEZ_TOKENA };
    const r = await zahtev('GET', '/api/gimnastika/ping');
    if (r.greska) return { ok: false, greska: r.greska };
    return { ok: true, sajt: String(r.json.sajt ?? '') };
  }

  // MAX(izmenjeno) aktivnog takmicenja (ocene, prijave, takmicenje, grupe) veci od poslednje sinhronizacije.
  function imaPromena() {
    const takm = podesavanja.aktivno();
    if (!takm) return false;
    const poslednja = String(podesavanja.daj(KLJUC, ''));
    if (poslednja === '') return true;
    const id = Number(takm.id);
    const najnovije = baza.vrednost(
      `SELECT MAX(v) FROM (
         SELECT MAX(o.izmenjeno) AS v FROM ocene o JOIN prijave p ON p.id = o.prijava_id WHERE p.takmicenje_id = ?
         UNION ALL SELECT MAX(izmenjeno) FROM prijave WHERE takmicenje_id = ?
         UNION ALL SELECT izmenjeno FROM takmicenja WHERE id = ?
         UNION ALL SELECT MAX(izmenjeno) FROM grupe WHERE takmicenje_id = ?)`, [id, id, id, id]);
    return najnovije !== null && najnovije !== undefined && String(najnovije) > poslednja;
  }

  function stanje() {
    return {
      ukljuceno: ukljuceno(),
      poslednje: String(podesavanja.daj(KLJUC, '')),
      cekaSlanje: tajmer !== null,
      uToku: tekuce !== null,
      greska: poslednjaGreska,
    };
  }

  function snimakAktivnog() {
    const takm = podesavanja.aktivno();
    return takm ? napraviSnimak(takm, sad()) : null;
  }

  return { stanje, zakazi, posalji, ping, imaPromena, snimakAktivnog };
}

module.exports = { napravi };
