// Model Ocene (SQLite): nacrt, uneto, ispravljeno, odustao; E sudije; zapis ispravki. Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { izUnosa, izBaze, prikaz } = require('../racun/broj.mjs');
const { konacnaE, konacna: konacnaOcena } = require('../racun/ocena.mjs');
const { snimak, opisIzmene } = require('../racun/izmene.mjs');
const Napredak = require('../racun/napredak.mjs');

const UNETE = ['uneto', 'ispravljeno'];

// Tekst iz polja u hiljadite delove; prazno je null, neispravno baca.
function parsiraj(tekst, naziv) {
  const t = String(tekst ?? '').trim();
  if (t === '') return null;
  const v = izUnosa(t);
  if (v === null) throw new GreskaKorisnika(`${naziv}: neispravna vrednost „${t}“ (0 do 20, najviše tri decimale).`);
  return v;
}

function dekodiraj(json) {
  try {
    const v = JSON.parse(String(json ?? ''));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function napravi(baza, podesavanja) {
  function takmicenje(id) {
    const t = baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [id]);
    if (!t) throw new GreskaKorisnika('Takmičenje ne postoji.');
    return t;
  }

  function eSudije(ocenaId) {
    const e = {};
    for (const r of baza.svi('SELECT sudija, vrednost FROM ocene_e WHERE ocena_id = ? ORDER BY sudija', [ocenaId])) {
      e[Number(r.sudija)] = izBaze(r.vrednost);
    }
    return e;
  }

  // Ocena sa E sudijama ({sudija: vrednost}) ili null.
  function nadji(prijavaId, spravaId) {
    const o = baza.jedan('SELECT * FROM ocene WHERE prijava_id = ? AND sprava_id = ?', [prijavaId, spravaId]);
    return o ? { ...o, e_sudije: eSudije(o.id) } : null;
  }

  // Dodaje e_sudije redovima ocena (jedan upit za sve).
  function saESudijama(redovi) {
    const poId = new Map();
    for (const o of redovi) poId.set(Number(o.id), { ...o, e_sudije: {} });
    if (poId.size > 0) {
      const ids = [...poId.keys()];
      const upit = `SELECT ocena_id, sudija, vrednost FROM ocene_e WHERE ocena_id IN (${ids.map(() => '?').join(',')}) ORDER BY sudija`;
      for (const r of baza.svi(upit, ids)) poId.get(Number(r.ocena_id)).e_sudije[Number(r.sudija)] = izBaze(r.vrednost);
    }
    return [...poId.values()];
  }

  // Ocene liste prijava na jednoj spravi: {prijava_id: ocena}.
  function zaSpravu(spravaId, prijavaIds) {
    if (prijavaIds.length === 0) return {};
    const redovi = baza.svi(
      `SELECT * FROM ocene WHERE sprava_id = ? AND prijava_id IN (${prijavaIds.map(() => '?').join(',')})`, [spravaId, ...prijavaIds]);
    const out = {};
    for (const o of saESudijama(redovi)) out[Number(o.prijava_id)] = o;
    return out;
  }

  // Sve ocene takmicenja: {prijava_id: {sprava_id: ocena}}.
  function zaTakmicenje(takmicenjeId) {
    const redovi = baza.svi('SELECT o.* FROM ocene o JOIN prijave p ON p.id = o.prijava_id WHERE p.takmicenje_id = ?', [takmicenjeId]);
    const out = {};
    for (const o of saESudijama(redovi)) (out[Number(o.prijava_id)] ??= {})[Number(o.sprava_id)] = o;
    return out;
  }

  function radiSpravu(prijavaId, spravaId) {
    return baza.vrednost('SELECT 1 FROM prijava_sprave WHERE prijava_id = ? AND sprava_id = ?', [prijavaId, spravaId]) !== null;
  }

  // Prijava mora pripadati takmicenju i raditi spravu.
  function proveriPar(takmicenjeId, prijavaId, spravaId) {
    const p = baza.jedan(
      'SELECT p.*, t.pol, t.ime, t.prezime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.id = ?', [prijavaId]);
    if (!p || Number(p.takmicenje_id) !== Number(takmicenjeId)) throw new GreskaKorisnika('Prijava ne postoji na ovom takmičenju.');
    if (!radiSpravu(prijavaId, spravaId)) throw new GreskaKorisnika(`${p.prezime} ${p.ime} nije prijavljen/a na ovu spravu.`);
    return p;
  }

  function odgovor(o, takm) {
    const eS = [];
    for (let i = 1; i <= Number(takm.broj_e_sudija); i++) eS.push(o.e_sudije[i] === undefined ? '' : prikaz(o.e_sudije[i]));
    return {
      ocena: o,
      prikaz: {
        d: prikaz(izBaze(o.d)),
        e: prikaz(izBaze(o.e)),
        odbitak: prikaz(izBaze(o.odbitak)),
        konacna: prikaz(izBaze(o.konacna)),
        e_sudije: eS,
        status: o.status,
        broj_ispravki: Number(o.broj_ispravki),
      },
    };
  }

  // Nacrt ili potvrda. Potvrda unete ocene je ispravka i trazi razlog.
  function sacuvaj(takmicenjeId, prijavaId, spravaId, ulaz, potvrdi, razlog = '') {
    const takm = takmicenje(takmicenjeId);
    proveriPar(takmicenjeId, prijavaId, spravaId);
    const brojSudija = Number(takm.broj_e_sudija);
    const postojeca = nadji(prijavaId, spravaId);
    const bilaUneta = postojeca !== null && UNETE.includes(postojeca.status);

    // Nacrt preko unete ocene ne menja nista.
    if (!potvrdi && bilaUneta) return odgovor(postojeca, takm);

    const d = parsiraj(ulaz.d, 'D');
    const e = [];
    for (let i = 1; i <= brojSudija; i++) e.push(parsiraj((ulaz.e ?? [])[i - 1], `E${i}`));
    const odbitakTekst = String(ulaz.odbitak ?? '').trim();
    const odbitak = odbitakTekst === '' ? (potvrdi ? 0 : null) : parsiraj(odbitakTekst, 'Odbitak');

    const svaE = e.every((v) => v !== null);
    const E = svaE ? konacnaE(e, takm.pravilo_e, podesavanja.dajPol('e_zaokruzivanje', takm.pol, 'odseci')) : null;
    const konacna = d !== null && E !== null ? konacnaOcena(d, E, odbitak ?? 0) : null;

    if (potvrdi) {
      if (d === null) throw new GreskaKorisnika('Unesite D ocenu.');
      if (!svaE) throw new GreskaKorisnika(`Unesite sve E ocene (${brojSudija}).`);
      if (bilaUneta && String(razlog ?? '').trim() === '') throw new GreskaKorisnika('Za ispravku unete ocene obavezan je razlog.');
    }

    const sad = Baza.sad();
    const red = { d, e: E, odbitak, konacna, izmenjeno: sad };
    if (potvrdi) {
      red.status = bilaUneta ? 'ispravljeno' : 'uneto';
      red.uneto_u = sad;
    } else if (postojeca === null || postojeca.status !== 'odustao') {
      red.status = 'nacrt';
    }
    const eObjekat = {};
    e.forEach((v, i) => {
      if (v !== null) eObjekat[i + 1] = v;
    });

    baza.transakcija((b) => {
      let ocenaId;
      if (postojeca === null) {
        ocenaId = b.ubaci('ocene', { ...red, prijava_id: prijavaId, sprava_id: spravaId, kreirano: sad });
      } else {
        ocenaId = Number(postojeca.id);
        if (potvrdi && bilaUneta) {
          red.broj_ispravki = Number(postojeca.broj_ispravki) + 1;
          b.ubaci('izmene_ocena', {
            ocena_id: ocenaId,
            vreme: sad,
            razlog: String(razlog).trim(),
            staro: JSON.stringify(snimak(postojeca)),
            novo: JSON.stringify(snimak({ ...red, e_sudije: eObjekat })),
          });
        }
        b.izmeni('ocene', red, 'id = ?', [ocenaId]);
      }
      b.izvrsi('DELETE FROM ocene_e WHERE ocena_id = ?', [ocenaId]);
      for (const [i, v] of Object.entries(eObjekat)) b.ubaci('ocene_e', { ocena_id: ocenaId, sudija: Number(i), vrednost: v });
    });
    return odgovor(nadji(prijavaId, spravaId), takm);
  }

  // Oznacava odustajanje na spravi; nad unetom ocenom pravi zapis izmene.
  function odustao(takmicenjeId, prijavaId, spravaId) {
    const takm = takmicenje(takmicenjeId);
    proveriPar(takmicenjeId, prijavaId, spravaId);
    const postojeca = nadji(prijavaId, spravaId);
    const sad = Baza.sad();
    baza.transakcija((b) => {
      const red = { d: null, e: null, odbitak: null, konacna: null, status: 'odustao', uneto_u: sad, izmenjeno: sad };
      if (postojeca === null) {
        b.ubaci('ocene', { ...red, prijava_id: prijavaId, sprava_id: spravaId, kreirano: sad });
        return;
      }
      if (UNETE.includes(postojeca.status)) {
        red.broj_ispravki = Number(postojeca.broj_ispravki) + 1;
        b.ubaci('izmene_ocena', {
          ocena_id: Number(postojeca.id),
          vreme: sad,
          razlog: 'Označeno odustajanje',
          staro: JSON.stringify(snimak(postojeca)),
          novo: JSON.stringify(snimak(red)),
        });
      }
      b.izmeni('ocene', red, 'id = ?', [Number(postojeca.id)]);
      b.izvrsi('DELETE FROM ocene_e WHERE ocena_id = ?', [Number(postojeca.id)]);
    });
    return odgovor(nadji(prijavaId, spravaId), takm);
  }

  // Ponistava odustajanje: red ponovo ceka unos.
  function vrati(takmicenjeId, prijavaId, spravaId) {
    const takm = takmicenje(takmicenjeId);
    proveriPar(takmicenjeId, prijavaId, spravaId);
    const o = nadji(prijavaId, spravaId);
    if (!o) throw new GreskaKorisnika('Nema šta da se vrati.');
    baza.izmeni('ocene', { status: 'nacrt', uneto_u: null, izmenjeno: Baza.sad() }, 'id = ?', [Number(o.id)]);
    return odgovor(nadji(prijavaId, spravaId), takm);
  }

  // Poslednje izmene na spravi (kartica ispod tabele), najnovije prvo.
  function izmeneNaSpravi(takmicenjeId, spravaId, limit = 5) {
    const redovi = baza.svi(
      `SELECT i.*, t.ime, t.prezime FROM izmene_ocena i
       JOIN ocene o ON o.id = i.ocena_id JOIN prijave p ON p.id = o.prijava_id JOIN takmicari t ON t.id = p.takmicar_id
       WHERE p.takmicenje_id = ? AND o.sprava_id = ? ORDER BY i.vreme DESC, i.id DESC LIMIT ?`,
      [takmicenjeId, spravaId, Math.trunc(Number(limit))]);
    return redovi.map((r) => {
      const staro = dekodiraj(r.staro);
      const novo = dekodiraj(r.novo);
      return { ...r, staro, novo, opis: opisIzmene(staro, novo) };
    });
  }

  // Napredak po rotacijama; pol se ne koristi (brojanje ne zavisi od pola ni od redosleda clanova).
  function napredak(takmicenjeId, pol, grupe, sprave) {
    return Napredak.napredak(zaTakmicenje(takmicenjeId), grupe, sprave, radiSpravu);
  }

  return { nadji, zaSpravu, zaTakmicenje, izmeneNaSpravi, napredak, sacuvaj, odustao, vrati, radiSpravu };
}

module.exports = { napravi };
