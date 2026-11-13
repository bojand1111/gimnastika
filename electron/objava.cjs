// Klijent objave takmicenja: upisuje fajl na disk, pa ga salje na server; bez interneta ostaje na cekanju.
// Slanje nikad ne ide bez fajla na disku. Nema Authorization zaglavlja (server je javan za upis).
const fs = require('node:fs');
const path = require('node:path');
const { NAJVECA_VELICINA } = require('./racun/objava-format.mjs');
const { Baza } = require('./baza/baza.cjs');
const { GreskaKorisnika } = require('./greska.cjs');

const ISTEK_MS = 15000;
const BEZ_ADRESE = 'Adresa za objavu nije podešena.';
const UVEZENO = 'Takmičenje je dodato iz ažuriranja i ne objavljuje se ponovo.';
const CEKA_PORUKA = 'Biće poslato kad bude interneta.';
const PREVELIKO = 'Takmičenje je preveliko za objavu.';

function napravi({
  baza, model, adresa, fasciklaPodataka, dnevnik, verzija, fetch: fetchFn = globalThis.fetch,
  sad = () => Baza.sad(), istekMs = ISTEK_MS, setTimeout: postaviTajmer = setTimeout, clearTimeout: ukloniTajmer = clearTimeout,
}) {
  const osnova = () => String(adresa ?? '').trim().replace(/\/+$/, '');
  const objaveUToku = new Map(); // tid -> promise objave koja je u toku
  const pokusajiUToku = new Map(); // tid -> promise ponovnog pokusaja koji je u toku

  // Jedan POST; vraca { ok: true } ili { poruka } (tekst za korisnika).
  async function zahtev(telo) {
    const ctl = new AbortController();
    const rok = postaviTajmer(() => ctl.abort(), istekMs);
    if (typeof rok?.unref === 'function') rok.unref();
    try {
      const odg = await fetchFn(`${osnova()}/objave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Gimnastika-Verzija': String(verzija) },
        body: telo,
        signal: ctl.signal,
      });
      if (odg.status === 200) {
        let json = null;
        try { json = JSON.parse(await odg.text()); } catch { /* odgovor nije JSON */ }
        if (json && json.ok === true) return { ok: true };
        return { poruka: 'Server je javio grešku 200.' };
      }
      return { poruka: `Server je javio grešku ${odg.status}.` };
    } catch (err) {
      // Samo ime i kod; poruka greske moze da sadrzi adresu pa se ne upisuje
      const kod = err?.cause?.code ?? err?.cause?.errors?.[0]?.code ?? err?.code ?? 'nepoznato';
      dnevnik.info(`Objava: nema veze (${err?.name ?? 'Greska'}: ${kod})`);
      return { poruka: CEKA_PORUKA };
    } finally {
      ukloniTajmer(rok);
    }
  }

  // Posalje telo i upise ishod u red objave.
  async function posalji(tid, telo) {
    const r = await zahtev(telo);
    const vreme = sad();
    if (r.ok) baza.izmeni('objave', { stanje: 'poslato', poslato: vreme, poslednji_pokusaj: vreme, poruka: '' }, 'takmicenje_id = ?', [tid]);
    else baza.izmeni('objave', { stanje: 'ceka', poslednji_pokusaj: vreme, poruka: r.poruka }, 'takmicenje_id = ?', [tid]);
    return r;
  }

  // Jedan promise po takmicenju u datoj mapi; drugi poziv dobija isti promise.
  function jednom(mapa, tid, rad) {
    if (mapa.has(tid)) return mapa.get(tid);
    const p = Promise.resolve().then(rad).finally(() => { if (mapa.get(tid) === p) mapa.delete(tid); });
    mapa.set(tid, p);
    return p;
  }

  function stanje(tid) {
    const red = baza.jedan('SELECT stanje, poslato, poruka FROM objave WHERE takmicenje_id = ?', [tid]);
    const stanjeObjave = red?.stanje === 'poslato' || red?.stanje === 'ceka' ? red.stanje : 'nije';
    const osnovno = { stanje: stanjeObjave, poslato: red?.poslato ?? null, poruka: red?.poruka ?? '' };
    if (osnova() === '') return { moze: false, razlog: BEZ_ADRESE, ...osnovno };
    const uvezeno = baza.jedan("SELECT 1 FROM uvezene_objave WHERE takmicenje_id = ? AND stanje = 'uvezeno'", [tid]);
    if (uvezeno) return { moze: false, razlog: UVEZENO, ...osnovno };
    return { moze: true, razlog: '', ...osnovno };
  }

  function objavi(tid) {
    return jednom(objaveUToku, tid, async () => {
      // ponovni pokusaj u toku se ceka (ishod se ignorise), pa objava pravi svoj svez izvoz
      await pokusajiUToku.get(tid)?.catch(() => {});
      const s = stanje(tid);
      if (!s.moze) throw new GreskaKorisnika(s.razlog);
      const vreme = sad();
      const objava = model.izvezi(tid, { verzija: String(verzija), sad: vreme });
      const telo = JSON.stringify(objava);
      if (Buffer.byteLength(telo) > NAJVECA_VELICINA) throw new GreskaKorisnika(PREVELIKO);
      const dir = path.join(fasciklaPodataka(), 'objave');
      fs.mkdirSync(dir, { recursive: true });
      const putanja = path.join(dir, `${objava.uid}.json`);
      fs.writeFileSync(`${putanja}.tmp`, telo, 'utf8');
      fs.renameSync(`${putanja}.tmp`, putanja);
      baza.izvrsi(
        `INSERT INTO objave (takmicenje_id, uid, fajl, stanje, poruka) VALUES (?, ?, ?, 'ceka', '')
         ON CONFLICT(takmicenje_id) DO UPDATE SET uid = excluded.uid, fajl = excluded.fajl, stanje = 'ceka', poruka = ''`,
        [tid, objava.uid, putanja]);
      await posalji(tid, telo);
      return stanje(tid);
    });
  }

  // Ponovo salje postojece fajlove za redove na cekanju; greske idu samo u dnevnik.
  async function posaljiNaCekanju() {
    if (osnova() === '') return;
    const redovi = baza.svi("SELECT takmicenje_id, fajl FROM objave WHERE stanje = 'ceka' ORDER BY takmicenje_id");
    for (const red of redovi) {
      const tid = red.takmicenje_id;
      if (objaveUToku.has(tid)) continue; // objava u toku salje svezu verziju
      try {
        await jednom(pokusajiUToku, tid, async () => {
          if (!stanje(tid).moze) return;
          let telo;
          try {
            telo = fs.readFileSync(red.fajl, 'utf8');
          } catch (err) {
            dnevnik.greska(`Objava: fajl za takmicenje ${tid} nije dostupan`, err);
            return;
          }
          await posalji(tid, telo);
        });
      } catch (err) {
        dnevnik.greska(`Objava: slanje takmicenja ${tid} nije uspelo`, err);
      }
    }
  }

  return { stanje, objavi, posaljiNaCekanju };
}

module.exports = { napravi, ISTEK_MS };
