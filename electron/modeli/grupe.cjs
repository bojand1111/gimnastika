// Model Grupe (SQLite): grupe, sastav i redosled po rotaciji. Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { KOLATOR } = require('./sortiranje.cjs');
const { redosledURotaciji } = require('../racun/grupe.mjs');

const POLJA_CLANA = `p.id AS prijava_id, p.startni_broj, p.kategorija_id, p.program_id, p.van_konkurencije,
       t.ime, t.prezime, t.pol, k.skracenica AS klub_skr, kat.naziv AS kategorija, pr.naziv AS program`;
const SPOJEVI_CLANA = `JOIN takmicari t ON t.id = p.takmicar_id
       LEFT JOIN klubovi k ON k.id = p.klub_id
       LEFT JOIN kategorije kat ON kat.id = p.kategorija_id
       LEFT JOIN programi pr ON pr.id = p.program_id`;

// Poredi dva kljuca; null ide prvo (kao u MySQL-u), brojevi brojcano, tekst kolatorom.
function poredi(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return KOLATOR.compare(String(a), String(b));
}

const iste = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function napravi(baza) {
  function nadji(id) {
    return baza.jedan('SELECT * FROM grupe WHERE id = ?', [id]);
  }

  // Grupa mora postojati i pripadati takmicenju.
  function trazi(takmicenjeId, id) {
    const g = nadji(id);
    if (!g || Number(g.takmicenje_id) !== Number(takmicenjeId)) throw new GreskaKorisnika('Grupa ne postoji.');
    return g;
  }

  function brojSprava(pol) {
    return Math.max(1, Number(baza.vrednost('SELECT COUNT(*) FROM sprave WHERE pol = ?', [pol])));
  }

  function clanovi(grupaId) {
    return baza.svi(
      `SELECT gc.redosled, ${POLJA_CLANA}
       FROM grupa_clanovi gc JOIN prijave p ON p.id = gc.prijava_id ${SPOJEVI_CLANA}
       WHERE gc.grupa_id = ? ORDER BY gc.redosled, gc.prijava_id`, [grupaId]);
  }

  // { rotacija: [prijava_id, ...] } samo za rotacije sa rucnom izmenom.
  function rucniRedosledi(grupaId) {
    const rucni = {};
    const redovi = baza.svi(
      'SELECT rotacija, prijava_id FROM grupa_redosled WHERE grupa_id = ? ORDER BY rotacija, redosled, prijava_id', [grupaId]);
    for (const r of redovi) (rucni[r.rotacija] ??= []).push(Number(r.prijava_id));
    return rucni;
  }

  function lista(takmicenjeId, pol) {
    const grupe = baza.svi('SELECT * FROM grupe WHERE takmicenje_id = ? AND pol = ? ORDER BY redosled, id', [takmicenjeId, pol]);
    return grupe.map((g) => ({ ...g, clanovi: clanovi(g.id), rucni: rucniRedosledi(g.id) }));
  }

  function nerasporedjeni(takmicenjeId, pol) {
    const redovi = baza.svi(
      `SELECT ${POLJA_CLANA}, kat.redosled AS kat_redosled, pr.redosled AS prog_redosled
       FROM prijave p ${SPOJEVI_CLANA}
       WHERE p.takmicenje_id = ? AND t.pol = ? AND p.id NOT IN (SELECT prijava_id FROM grupa_clanovi)`, [takmicenjeId, pol]);
    redovi.sort((x, y) => poredi(x.kat_redosled, y.kat_redosled) || poredi(x.prog_redosled, y.prog_redosled)
      || poredi(x.klub_skr, y.klub_skr) || poredi(x.prezime, y.prezime) || poredi(x.ime, y.ime));
    return redovi.map(({ kat_redosled, prog_redosled, ...ostalo }) => ostalo);
  }

  function dodaj(takmicenjeId, pol) {
    if (pol !== 'M' && pol !== 'Z') throw new GreskaKorisnika('Nepoznat pol.');
    const postojece = baza.svi('SELECT naziv FROM grupe WHERE takmicenje_id = ? AND pol = ? ORDER BY redosled', [takmicenjeId, pol])
      .map((r) => r.naziv);
    const n = postojece.length;
    const slovo = String.fromCharCode(65 + (n % 26));
    let naziv = 'Grupa ' + slovo;
    for (let i = 2; postojece.includes(naziv); i++) naziv = 'Grupa ' + slovo + i;
    const sad = Baza.sad();
    return baza.ubaci('grupe', {
      takmicenje_id: takmicenjeId, pol, naziv, redosled: n + 1,
      pocetna_pozicija: (n % brojSprava(pol)) + 1, kreirano: sad, izmenjeno: sad,
    });
  }

  function izmeni(takmicenjeId, id, naziv, pocetnaPozicija) {
    const g = trazi(takmicenjeId, id);
    const ime = String(naziv ?? '').trim();
    if (ime === '') throw new GreskaKorisnika('Naziv grupe je obavezan.');
    const n = brojSprava(g.pol);
    const poz = Number(pocetnaPozicija);
    if (!(poz >= 1 && poz <= n)) throw new GreskaKorisnika(`Početna sprava mora biti između 1 i ${n}.`);
    baza.izmeni('grupe', { naziv: ime, pocetna_pozicija: poz, izmenjeno: Baza.sad() }, 'id = ?', [id]);
  }

  function obrisi(takmicenjeId, id) {
    trazi(takmicenjeId, id);
    const n = Number(baza.vrednost('SELECT COUNT(*) FROM grupa_clanovi WHERE grupa_id = ?', [id]));
    if (n > 0) throw new GreskaKorisnika(`Grupa ima ${n} takmičara. Prvo je ispraznite.`);
    baza.izvrsi('DELETE FROM grupe WHERE id = ?', [id]);
  }

  // Osnovni redosled (rotacija 1): id-jevi prijava.
  function osnovni(grupaId) {
    return baza.svi('SELECT prijava_id FROM grupa_clanovi WHERE grupa_id = ? ORDER BY redosled, prijava_id', [grupaId])
      .map((r) => Number(r.prijava_id));
  }

  function prenumerisi(grupaId) {
    osnovni(grupaId).forEach((pid, i) => {
      baza.izvrsi('UPDATE grupa_clanovi SET redosled = ? WHERE grupa_id = ? AND prijava_id = ?', [i + 1, grupaId, pid]);
    });
  }

  function upisiRucni(grupaId, rotacija, spisak) {
    spisak.forEach((pid, i) => baza.ubaci('grupa_redosled', { grupa_id: grupaId, rotacija, prijava_id: pid, redosled: i + 1 }));
  }

  // pozicija = mesto u prikazu izabrane rotacije (0 = prvo); grupaId null = neraspodeljeni.
  function premesti(takmicenjeId, prijavaId, grupaId, pozicija, rotacija = 1) {
    prijavaId = Number(prijavaId);
    rotacija = Number(rotacija);
    const prijava = baza.jedan(
      'SELECT p.*, t.pol FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.id = ? AND p.takmicenje_id = ?',
      [prijavaId, takmicenjeId]);
    if (!prijava) throw new GreskaKorisnika('Prijava ne postoji.');
    let sprava = 1;
    if (grupaId !== null && grupaId !== undefined) {
      grupaId = Number(grupaId);
      const g = nadji(grupaId);
      if (!g || Number(g.takmicenje_id) !== Number(takmicenjeId) || g.pol !== prijava.pol) {
        throw new GreskaKorisnika('Grupa ne postoji ili nije za taj pol.');
      }
      sprava = brojSprava(g.pol);
      if (!(rotacija >= 1 && rotacija <= sprava)) throw new GreskaKorisnika(`Rotacija mora biti između 1 i ${sprava}.`);
    } else {
      grupaId = null;
    }
    const pomeraj = Number(baza.vrednost('SELECT pomeraj_redosled FROM takmicenja WHERE id = ?', [takmicenjeId])) === 1;
    const mesto = (n) => Math.max(0, Math.min(n, Number(pozicija) || 0));
    const sadrzi = (spisak) => spisak.map((id) => ({ prijava_id: id }));

    baza.transakcija(() => {
      const stara = baza.jedan('SELECT grupa_id FROM grupa_clanovi WHERE prijava_id = ?', [prijavaId]);
      const istaGrupa = stara !== null && grupaId !== null && Number(stara.grupa_id) === grupaId;

      if (!istaGrupa) {
        baza.izvrsi('DELETE FROM grupa_clanovi WHERE prijava_id = ?', [prijavaId]);
        baza.izvrsi('DELETE FROM grupa_redosled WHERE prijava_id = ?', [prijavaId]);
        if (stara) prenumerisi(Number(stara.grupa_id));
        if (grupaId === null) return;
      }

      if (rotacija === 1) {
        const stari = osnovni(grupaId);
        const ids = stari.filter((id) => id !== prijavaId);
        ids.splice(mesto(ids.length), 0, prijavaId);
        if (istaGrupa && !iste(ids, stari)) {
          // zamrzavanje: rotacije bez svog redosleda zadrzavaju dosadasnji
          for (let r = 2; r <= sprava; r++) {
            const ima = Number(baza.vrednost('SELECT COUNT(*) FROM grupa_redosled WHERE grupa_id = ? AND rotacija = ?', [grupaId, r])) > 0;
            if (!ima) upisiRucni(grupaId, r, redosledURotaciji(sadrzi(stari), r, pomeraj).map((c) => c.prijava_id));
          }
        }
        baza.izvrsi('DELETE FROM grupa_clanovi WHERE grupa_id = ?', [grupaId]);
        ids.forEach((id, i) => baza.ubaci('grupa_clanovi', { grupa_id: grupaId, prijava_id: id, redosled: i + 1 }));
        return;
      }

      if (!istaGrupa) {
        baza.ubaci('grupa_clanovi', { grupa_id: grupaId, prijava_id: prijavaId, redosled: osnovni(grupaId).length + 1 });
      }
      const clanoviGrupe = sadrzi(osnovni(grupaId));
      const rucni = baza.svi('SELECT prijava_id FROM grupa_redosled WHERE grupa_id = ? AND rotacija = ? ORDER BY redosled, prijava_id',
        [grupaId, rotacija]).map((r) => Number(r.prijava_id));
      const bezRucnog = redosledURotaciji(clanoviGrupe, rotacija, pomeraj).map((c) => c.prijava_id);
      const ids = redosledURotaciji(clanoviGrupe, rotacija, pomeraj, rucni).map((c) => c.prijava_id).filter((id) => id !== prijavaId);
      ids.splice(mesto(ids.length), 0, prijavaId);
      baza.izvrsi('DELETE FROM grupa_redosled WHERE grupa_id = ? AND rotacija = ?', [grupaId, rotacija]);
      if (iste(ids, bezRucnog)) return; // isto kao bez rucnog: ne pamti se
      upisiRucni(grupaId, rotacija, ids);
    });
  }

  function vratiRedosled(takmicenjeId, grupaId, rotacija) {
    trazi(takmicenjeId, grupaId);
    baza.izvrsi('DELETE FROM grupa_redosled WHERE grupa_id = ? AND rotacija = ?', [grupaId, Number(rotacija)]);
  }

  return { nadji, lista, rucniRedosledi, clanovi, nerasporedjeni, brojSprava, dodaj, izmeni, obrisi, premesti, vratiRedosled };
}

module.exports = { napravi };
