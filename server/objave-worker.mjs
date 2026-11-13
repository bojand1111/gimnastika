// Cloudflare Worker za objave takmicenja. Samostalan fajl, bez paketa.
// Vezivanja: env.OBJAVE (KV namespace), env.KLJUC (tajna, samo za citanje i brisanje).
// POST /objave je otvoren (bez kljuca); GET i DELETE traze Authorization: Bearer <KLJUC>.

const MAKS_TELO = 2097152;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIKS = 'objava:';

function odgovor(telo, status = 200) {
  return new Response(typeof telo === 'string' ? telo : JSON.stringify(telo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const greska = (poruka, status) => odgovor({ ok: false, greska: poruka }, status);

// Poredjenje stalnog trajanja: SHA-256 oba teksta pa petlja bez ranog izlaza.
async function istiKljuc(dobijen, pravi) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(dobijen)),
    crypto.subtle.digest('SHA-256', enc.encode(pravi)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let razlika = 0;
  for (let i = 0; i < x.length; i++) razlika |= x[i] ^ y[i];
  return razlika === 0;
}

async function ovlascen(request, env) {
  if (typeof env.KLJUC !== 'string' || env.KLJUC === '') return false;
  const zaglavlje = request.headers.get('Authorization') || '';
  const m = /^Bearer (.*)$/.exec(zaglavlje);
  if (!m) return false;
  return istiKljuc(m[1], env.KLJUC);
}

const MAKS_META = 900;
const bajtova = (v) => new TextEncoder().encode(JSON.stringify(v)).length;

// Cita telo kao tok i staje cim predje ogranicenje. Vraca null ako je preveliko.
async function procitaj(request) {
  if (!request.body) return new Uint8Array(0);
  const citac = request.body.getReader();
  const delovi = [];
  let ukupno = 0;
  for (;;) {
    const { done, value } = await citac.read();
    if (done) break;
    ukupno += value.byteLength;
    if (ukupno > MAKS_TELO) {
      await citac.cancel();
      return null;
    }
    delovi.push(value);
  }
  const sve = new Uint8Array(ukupno);
  let od = 0;
  for (const d of delovi) { sve.set(d, od); od += d.byteLength; }
  return sve;
}

// Tekst ili null; sve drugo je neispravno (undefined znaci greska).
function tekstIliNull(v) {
  if (v === undefined || v === null) return null;
  return typeof v === 'string' ? v : undefined;
}

const nepun = (v) => typeof v === 'string' && v.trim() !== '';

async function primi(request, env) {
  const duzina = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(duzina) && duzina > MAKS_TELO) return greska('Objava je prevelika.', 413);
  const bajtovi = await procitaj(request);
  if (bajtovi === null) return greska('Objava je prevelika.', 413);
  const tekst = new TextDecoder().decode(bajtovi);

  let o;
  try { o = JSON.parse(tekst); } catch { return greska('Telo nije ispravan JSON.', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return greska('Telo mora biti objekat.', 400);
  if (o.verzija_formata !== 1) return greska('Nepodrzana verzija formata.', 400);
  if (typeof o.uid !== 'string' || !UUID.test(o.uid)) return greska('Neispravan uid.', 400);
  const t = o.takmicenje;
  if (!t || typeof t !== 'object') return greska('Nedostaje takmicenje.', 400);
  if (!nepun(t.naziv) || !nepun(t.datum)) return greska('Nedostaje naziv ili datum takmicenja.', 400);

  const pol = tekstIliNull(t.pol);
  const objavljeno = tekstIliNull(o.objavljeno);
  const verzija = tekstIliNull(o.program && typeof o.program === 'object' ? o.program.verzija : null);
  if (pol === undefined || objavljeno === undefined || verzija === undefined) {
    return greska('Polja pol, objavljeno i verzija moraju biti tekst.', 400);
  }
  const metadata = { naziv: t.naziv, datum: t.datum, pol, objavljeno, verzija };
  // Samo naziv u metapodacima se skracuje; telo ostaje celo.
  while (bajtova(metadata) > MAKS_META && metadata.naziv.length > 0) {
    metadata.naziv = metadata.naziv.slice(0, Math.max(0, metadata.naziv.length - Math.max(1, bajtova(metadata) - MAKS_META)));
  }
  if (bajtova(metadata) > MAKS_META) return greska('Polja objave su preduga.', 400);
  await env.OBJAVE.put(PREFIKS + o.uid.toLowerCase(), tekst, { metadata });
  return odgovor({ ok: true });
}

async function izlistaj(env) {
  const objave = [];
  let cursor;
  for (;;) {
    const strana = await env.OBJAVE.list({ prefix: PREFIKS, cursor });
    for (const k of strana.keys) {
      objave.push({ uid: k.name.slice(PREFIKS.length), ...(k.metadata || {}) });
    }
    if (strana.list_complete || !strana.cursor) break;
    cursor = strana.cursor;
  }
  return odgovor({ ok: true, objave });
}

export default {
  async fetch(request, env) {
    try {
      return await obradi(request, env);
    } catch (e) {
      console.error('Greska u obradi zahteva:', e);
      return greska('Greska servera.', 500);
    }
  },
};

async function obradi(request, env) {
  const putanja = new URL(request.url).pathname;
  const m = /^\/objave(?:\/([^/]+))?$/.exec(putanja);
  if (!m) return greska('Nepoznata putanja.', 404);
  const uid = m[1] ? m[1].toLowerCase() : m[1];
  const metoda = request.method;

  if (!uid) {
    if (metoda === 'POST') return primi(request, env);
    if (metoda !== 'GET') return greska('Metoda nije dozvoljena.', 405);
    if (!(await ovlascen(request, env))) return greska('Nije ovlasceno.', 401);
    return izlistaj(env);
  }

  if (metoda !== 'GET' && metoda !== 'DELETE') return greska('Metoda nije dozvoljena.', 405);
  if (!(await ovlascen(request, env))) return greska('Nije ovlasceno.', 401);
  if (!UUID.test(uid)) return greska('Nepoznata putanja.', 404);
  if (metoda === 'DELETE') {
    await env.OBJAVE.delete(PREFIKS + uid);
    return odgovor({ ok: true });
  }
  const telo = await env.OBJAVE.get(PREFIKS + uid);
  if (telo === null || telo === undefined) return greska('Objava ne postoji.', 404);
  return odgovor(telo);
}
