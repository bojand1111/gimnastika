// Cista logika ekrana Uvoz (POPIS 7.8). izbor je po indeksu fajla:
// { klub_id, oznake: {oi: {kategorija, program}}, redovi: {ri: {uvezi, postupak}} }. Pola nema: novi takmicari dobijaju pol dela.

// Pocetni izbor fajla: sve kao u PHP pregledu (kucice ukljucene gde je moguce, nova stavka unapred izabrana).
export function pocetniIzbor(f) {
  const stavka = (id, tekst) => (id != null ? String(id) : (tekst || '') !== '' ? 'novo' : '');
  const oznake = {};
  f.oznake.forEach((o, oi) => {
    oznake[oi] = { kategorija: stavka(o.kategorija_id, o.kategorija), program: stavka(o.program_id, o.program) };
  });
  const redovi = {};
  f.redovi.forEach((r, ri) => { redovi[ri] = { uvezi: r.postupak !== 'nista', postupak: r.postupak }; });
  return { klub_id: f.klub_id != null ? String(f.klub_id) : '', oznake, redovi };
}

// Izabran red je "novi" kad nema izbora postupka (status novi) ili je postupak 'novi'.
function jeNovi(r, izborReda) {
  return r.status === 'novi' || (izborReda && izborReda.postupak) === 'novi';
}

function izabran(r, izborReda) {
  if (r.status === 'prijavljen' || r.status === 'greska') return false;
  return Boolean(izborReda && izborReda.uvezi);
}

export function prebroj(fajlovi, izbor) {
  const poFajlu = fajlovi.map((f, i) => {
    const b = { n: 0, prijavljeni: 0, greske: 0, novih: 0, postojecih: 0 };
    const redovi = (izbor[i] && izbor[i].redovi) || {};
    f.redovi.forEach((r, ri) => {
      if (r.status === 'prijavljen') { b.prijavljeni++; return; }
      if (r.status === 'greska') { b.greske++; return; }
      if (!izabran(r, redovi[ri])) return;
      b.n++;
      if (jeNovi(r, redovi[ri])) b.novih++; else b.postojecih++;
    });
    return b;
  });
  const zbirPo = (k) => poFajlu.reduce((s, b) => s + b[k], 0);
  return { poFajlu, ukupno: zbirPo('n'), novih: zbirPo('novih'), postojecih: zbirPo('postojecih') };
}

export function cipFajla(b) {
  return `za uvoz: ${b.n}${b.prijavljeni ? ` · već prijavljeni: ${b.prijavljeni}` : ''}${b.greske ? ` · ne mogu: ${b.greske}` : ''}`;
}

export function zbir(b) {
  if (b.ukupno === 0) return 'Nijedan red nije izabran za uvoz.';
  return `Za uvoz: ${b.ukupno} (novih takmičara ${b.novih}, postojećih ${b.postojecih})`;
}

// Oblik za gim.uvoz.upisi: kucica postaje '1' ili '' (POPIS 8.8).
export function zaUpis(izbor) {
  const izlaz = {};
  for (const [i, f] of Object.entries(izbor)) {
    const redovi = {};
    for (const [ri, r] of Object.entries(f.redovi)) redovi[ri] = { uvezi: r.uvezi ? '1' : '', postupak: r.postupak };
    izlaz[i] = { klub_id: f.klub_id, oznake: f.oznake, redovi };
  }
  return izlaz;
}
