// Cisto stanje ekrana Rotacije (POPIS 5.1, 6.1, 6.3): bez React-a i bez IPC-a.
import { razlozi } from '../ruter.js';
// Stanje: { nerasporedjeni: [clan], grupe: [{ id, redosled_rot: [clan], ... }] }; grupaId 0 = neraspoređeni.

// Kljuc kombinacije kategorija-program; null je 0 (kao PHP).
export const kp = (c) => `${Number(c.kategorija_id) || 0}-${Number(c.program_id) || 0}`;

// "Prezime P." sa prvim kodnim znakom imena (PHP mb_substr).
export const imeKartice = (c) => `${c.prezime} ${[...String(c.ime ?? '')][0] ?? ''}.`;

export const naslovKartice = (c) => `${c.prezime} ${c.ime} · ${c.kategorija ?? ''} · ${c.program ?? ''}`;

const kolone = (stanje) => [
  { id: 0, lista: stanje.nerasporedjeni },
  ...stanje.grupe.map((g) => ({ id: g.id, lista: g.redosled_rot })),
];

// Nova kopija: kartica ide na indeks `pozicija` ciljne kolone (pozicija preko kraja = na kraj).
export function premestiLokalno(stanje, prijavaId, grupaId, pozicija) {
  const id = Number(prijavaId);
  const cilj = Number(grupaId) || 0;
  const sve = kolone(stanje);
  const kartica = sve.flatMap((k) => k.lista).find((c) => Number(c.prijava_id) === id);
  const bez = (lista) => lista.filter((c) => Number(c.prijava_id) !== id);
  const ubaci = (lista) => {
    if (!kartica) return lista;
    const ostalo = bez(lista);
    const i = Math.max(0, Math.min(ostalo.length, Number(pozicija) || 0));
    return [...ostalo.slice(0, i), kartica, ...ostalo.slice(i)];
  };
  const obradi = (kolonaId, lista) => {
    if (!kartica) return lista;
    return kolonaId === cilj ? ubaci(lista) : bez(lista);
  };
  return {
    ...stanje,
    nerasporedjeni: obradi(0, stanje.nerasporedjeni),
    grupe: stanje.grupe.map((g) => ({ ...g, redosled_rot: obradi(g.id, g.redosled_rot) })),
  };
}

// Alt+strelica: kuda ide kartica; null kad nema mesta (ivica) ili taster nije strelica.
export function indeksZaAltStrelice(stanje, prijavaId, taster) {
  const id = Number(prijavaId);
  const sve = kolone(stanje);
  const ki = sve.findIndex((k) => k.lista.some((c) => Number(c.prijava_id) === id));
  if (ki < 0) return null;
  const { lista } = sve[ki];
  const i = lista.findIndex((c) => Number(c.prijava_id) === id);
  if (taster === 'ArrowUp') return i > 0 ? { grupaId: sve[ki].id, pozicija: i - 1 } : null;
  if (taster === 'ArrowDown') return i < lista.length - 1 ? { grupaId: sve[ki].id, pozicija: i + 1 } : null;
  if (taster === 'ArrowLeft') return ki > 0 ? { grupaId: sve[ki - 1].id, pozicija: sve[ki - 1].lista.length } : null;
  if (taster === 'ArrowRight') return ki < sve.length - 1 ? { grupaId: sve[ki + 1].id, pozicija: sve[ki + 1].lista.length } : null;
  return null;
}

// Oblik reči po broju (1 takmičar, 2 takmičara, 5 takmičara).
function oblik(n, jedan, dva, pet) {
  const d = n % 10;
  const s = n % 100;
  if (d === 1 && s !== 11) return jedan;
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return dva;
  return pet;
}

// Red pregleda automatskog rasporeda za jedan turnus.
export const tekstTurnusa = (t) =>
  `Turnus ${t.turnus}: ${t.kategorije.join(', ')} · ${t.broj} ${oblik(t.broj, 'takmičar', 'takmičara', 'takmičara')} · `
  + `${t.velicine.length === 1 ? 'grupa' : 'grupe'} ${t.velicine.join(', ')}`;

// Poruka posle automatskog rasporeda.
export const porukaRasporeda = (r) =>
  `Raspoređeno: ${r.grupa} ${oblik(r.grupa, 'grupa', 'grupe', 'grupa')} u ${r.turnusa} ${oblik(r.turnusa, 'turnusu', 'turnusa', 'turnusa')}.`;

// Hash bez pola: ekran uvek prikazuje izabrani deo. Turnus 1 se ne piše.
export const hashRotacija = (rot, filter = '', tu = 1) =>
  `#/rotacije?rot=${rot}${filter ? `&kp=${filter}` : ''}${Number(tu) > 1 ? `&tu=${tu}` : ''}`;

// Parametri iz hasha (rot, kp, tu); normalizuju se dalje na serveru i u prikazu. Stari pol= se zanemaruje.
export function parRotacije(hash) {
  const { rot, kp, tu } = razlozi(hash).parametri;
  const t = parseInt(tu, 10);
  return { rot: parseInt(rot, 10) || 1, kp: kp || '', tu: t >= 1 ? t : 1 };
}
