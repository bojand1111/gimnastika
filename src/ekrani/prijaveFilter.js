// Cista logika ekrana Prijave (POPIS 6.4 i 6.6): filter leve liste, grupisanje, sirina, legenda, poruke.
import { normalizuj, odgovara } from '../pretraga.js';

export { normalizuj };

// Red baze je vidljiv ako odgovara pretrazi (prezime, ime, ID) i klubu ('' = svi, '0' = bez kluba).
export function vidljivTakmicar(red, { upit, klub }) {
  const tekst = `${red.prezime} ${red.ime} ${red.ime} ${red.prezime} ${red.id_broj}`;
  if (!odgovara(tekst, upit)) return false;
  return klub === '' || String(red.klub_id ?? 0) === String(klub);
}

// Prijave po klubu: redosled iz stanja.redosled_klubova bez 0, pa 0; unutar kluba ostaje redosled liste.
export function grupisiPoKlubu(prijave, stanje) {
  const po = new Map();
  for (const p of prijave) {
    const kid = Number(p.klub_id ?? 0);
    if (!po.has(kid)) po.set(kid, []);
    po.get(kid).push(p);
  }
  const redosled = [...(stanje.redosled_klubova || []).filter((k) => k !== 0), 0];
  return redosled.filter((k) => po.has(k)).map((k) => ({ klubId: k, prijave: po.get(k) }));
}

// Sirina kolone Sprave: dugme 30 px, razmak 3 px, padding 16 px.
export function sirinaSprava(n) {
  const b = Math.max(1, n);
  return b * 30 + (b - 1) * 3 + 16;
}

// Legenda sprava ("PA parter"): bez filtera Z pa M; ista skracenica se spaja, poslednja pobedjuje.
export function legenda(sprave, pol) {
  const lista = pol === '' ? [...sprave.Z, ...sprave.M] : sprave[pol];
  const m = new Map();
  for (const s of lista) m.set(s.skracenica, String(s.naziv).toLowerCase());
  return [...m].map(([skr, naziv]) => `${skr} ${naziv}`);
}

// Poruka za "Sledeće: Rotacije" (POPIS 6.2); null kad nema sta da se kaze.
export function porukaDalje(stanje) {
  if (stanje.prijava === 0) return 'Još nema prijava. Prvo prijavite takmičare.';
  const fali = [];
  if (stanje.nepotpune > 0) fali.push(`prijave bez kategorije, programa ili sprava: ${stanje.nepotpune}`);
  if (stanje.nepotvrdjeni_klubovi > 0) fali.push(`klubovi čiji spisak nije potvrđen: ${stanje.nepotvrdjeni_klubovi}`);
  return fali.length ? `U prijavama još nije dovršeno: ${fali.join('; ')}.` : null;
}

// Cip sa brojem prijava u prikazu; uz filter pola i ukupan broj.
export function cipPrijava(n, ukupno, pol) {
  return `${n} ${n === 1 ? 'prijava' : 'prijave'}${pol !== '' ? ` · ukupno ${ukupno}` : ''}`;
}
