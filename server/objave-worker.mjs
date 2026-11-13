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

const nepun = (v) => typeof v === 'string' && v.trim() !== '';

async function primi(request, env) {
  const duzina = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(duzina) && duzina > MAKS_TELO) return greska('Objava je prevelika.', 413);
  const bajtovi = new Uint8Array(await request.arrayBuffer());
  if (bajtovi.byteLength > MAKS_TELO) return greska('Objava je prevelika.', 413);
  const tekst = new TextDecoder().decode(bajtovi);

  let o;
  try { o = JSON.parse(tekst); } catch { return greska('Telo nije ispravan JSON.', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return greska('Telo mora biti objekat.', 400);
  if (o.verzija_formata !== 1) return greska('Nepodrzana verzija formata.', 400);
  if (typeof o.uid !== 'string' || !UUID.test(o.uid)) return greska('Neispravan uid.', 400);
  const t = o.takmicenje;
  if (!t || typeof t !== 'object') return greska('Nedostaje takmicenje.', 400);
  if (!nepun(t.naziv) || !nepun(t.datum)) return greska('Nedostaje naziv ili datum takmicenja.', 400);

  const metadata = {
    naziv: t.naziv,
    datum: t.datum,
    pol: t.pol ?? null,
    objavljeno: o.objavljeno ?? null,
    verzija: o.program && o.program.verzija != null ? o.program.verzija : null,
  };
  await env.OBJAVE.put(PREFIKS + o.uid, tekst, { metadata });
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
    const putanja = new URL(request.url).pathname;
    const m = /^\/objave(?:\/([^/]+))?$/.exec(putanja);
    if (!m) return greska('Nepoznata putanja.', 404);
    const uid = m[1];
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
  },
};
