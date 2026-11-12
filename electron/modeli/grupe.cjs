// Model Grupe (SQLite): grupe, sastav i redosled po rotaciji. Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { KOLATOR } = require('./sortiranje.cjs');
const { redosledURotaciji } = require('../racun/grupe.mjs');
const { rasporedi, sazetak } = require('../racun/raspored.mjs');

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
    const grupe = baza.svi('SELECT * FROM grupe WHERE takmicenje_id = ? AND pol = ? ORDER BY turnus, redosled, id', [takmicenjeId, pol]);
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

  // Kategorija/program parovi iz prijava tog pola; null prvi kao u MySQL-u.
  function kombinacije(takmicenjeId, pol) {
    return baza.svi(
      `SELECT DISTINCT kat.id AS kid, kat.naziv AS kat, pr.id AS pid, pr.naziv AS prog,
              kat.redosled AS kat_red, pr.redosled AS prog_red
       FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id
       LEFT JOIN kategorije kat ON kat.id = p.kategorija_id
       LEFT JOIN programi pr ON pr.id = p.program_id
       WHERE p.takmicenje_id = ? AND t.pol = ?`, [takmicenjeId, pol])
      .sort((x, y) => poredi(x.kat_red, y.kat_red) || poredi(x.prog_red, y.prog_red)
        || poredi(x.kat, y.kat) || poredi(x.prog, y.prog))
      .map(({ kid, kat, pid, prog }) => ({ kid, kat, pid, prog }));
  }

  function proveriPol(takmicenjeId, pol) {
    if (pol !== 'M' && pol !== 'Z') throw new GreskaKorisnika('Nepoznat pol.');
    const polTakm = baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [takmicenjeId]);
    if (polTakm === null) throw new GreskaKorisnika('Takmičenje ne postoji.');
    if (polTakm !== pol) throw new GreskaKorisnika('Grupa mora biti istog pola kao takmičenje.');
  }

  // Turnusi postojecih grupa, rastuce.
  function turnusi(takmicenjeId, pol) {
    return baza.svi('SELECT DISTINCT turnus FROM grupe WHERE takmicenje_id = ? AND pol = ? ORDER BY turnus', [takmicenjeId, pol])
      .map((r) => Number(r.turnus));
  }

  // Turnus mora biti ceo broj od 1 do (najveci postojeci + 1).
  function proveriTurnus(takmicenjeId, pol, turnus) {
    const n = Math.max(0, ...turnusi(takmicenjeId, pol)) + 1;
    const t = Number(turnus);
    if (!(Number.isInteger(t) && t >= 1 && t <= n)) throw new GreskaKorisnika(`Turnus mora biti između 1 i ${n}.`);
    return t;
  }

  function dodaj(takmicenjeId, pol, turnus = 1) {
    proveriPol(takmicenjeId, pol);
    const tu = proveriTurnus(takmicenjeId, pol, turnus);
    const uTurnusu = Number(baza.vrednost('SELECT COUNT(*) FROM grupe WHERE takmicenje_id = ? AND pol = ? AND turnus = ?', [takmicenjeId, pol, tu]));
    const postojece = baza.svi('SELECT naziv FROM grupe WHERE takmicenje_id = ? AND pol = ? ORDER BY redosled', [takmicenjeId, pol])
      .map((r) => r.naziv);
    const n = postojece.length;
    const slovo = String.fromCharCode(65 + (n % 26));
    let naziv = 'Grupa ' + slovo;
    for (let i = 2; postojece.includes(naziv); i++) naziv = 'Grupa ' + slovo + i;
    const sad = Baza.sad();
    return baza.ubaci('grupe', {
      takmicenje_id: takmicenjeId, pol, naziv, redosled: n + 1, turnus: tu,
      pocetna_pozicija: (uTurnusu % brojSprava(pol)) + 1, kreirano: sad, izmenjeno: sad,
    });
  }

  function izmeni(takmicenjeId, id, naziv, pocetnaPozicija, turnus) {
    const g = trazi(takmicenjeId, id);
    const ime = String(naziv ?? '').trim();
    if (ime === '') throw new GreskaKorisnika('Naziv grupe je obavezan.');
    const n = brojSprava(g.pol);
    const poz = Number(pocetnaPozicija);
    if (!(Number.isInteger(poz) && poz >= 1 && poz <= n)) throw new GreskaKorisnika(`Početna sprava mora biti između 1 i ${n}.`);
    const polja = { naziv: ime, pocetna_pozicija: poz, izmenjeno: Baza.sad() };
    if (turnus !== undefined && turnus !== null) polja.turnus = proveriTurnus(takmicenjeId, g.pol, turnus);
    baza.transakcija(() => {
      baza.izmeni('grupe', polja, 'id = ?', [id]);
      sabijTurnuse(takmicenjeId, g.pol);
    });
    // turnus grupe posle sabijanja (ekran ide za grupom)
    return Number(nadji(id).turnus);
  }

  // Turnusi bez rupa: 1, 3 postaje 1, 2 (redosled turnusa ostaje).
  function sabijTurnuse(takmicenjeId, pol) {
    turnusi(takmicenjeId, pol).forEach((t, i) => {
      if (t !== i + 1) baza.izvrsi('UPDATE grupe SET turnus = ? WHERE takmicenje_id = ? AND pol = ? AND turnus = ?', [i + 1, takmicenjeId, pol, t]);
    });
  }

  function obrisi(takmicenjeId, id) {
    const g = trazi(takmicenjeId, id);
    const n = Number(baza.vrednost('SELECT COUNT(*) FROM grupa_clanovi WHERE grupa_id = ?', [id]));
    if (n > 0) throw new GreskaKorisnika(`Grupa ima ${n} takmičara. Prvo je ispraznite.`);
    baza.transakcija(() => {
      baza.izvrsi('DELETE FROM grupe WHERE id = ?', [id]);
      sabijTurnuse(takmicenjeId, g.pol);
    });
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
      if (!(Number.isInteger(rotacija) && rotacija >= 1 && rotacija <= sprava)) throw new GreskaKorisnika(`Rotacija mora biti između 1 i ${sprava}.`);
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

  // Sve prijave pola u obliku ulaza za racun rasporeda.
  function zaRaspored(takmicenjeId, pol) {
    return baza.svi(
      `SELECT p.id AS prijava_id, p.kategorija_id, kat.redosled AS kat_redosled, kat.naziv AS kategorija,
              p.program_id, pr.redosled AS prog_redosled, p.klub_id, k.skracenica AS klub_skr, t.prezime, t.ime
       FROM prijave p ${SPOJEVI_CLANA}
       WHERE p.takmicenje_id = ? AND t.pol = ? ORDER BY p.id`, [takmicenjeId, pol]);
  }

  function opcijeRasporeda(pol, parametri = {}) {
    const m = Number(parametri.maksimum);
    if (!(Number.isInteger(m) && m >= 1 && m <= 30)) throw new GreskaKorisnika('Najviše takmičara po grupi mora biti između 1 i 30.');
    return {
      brojSprava: brojSprava(pol), maksimum: m,
      poKategoriji: parametri.poKategoriji !== false, poKlubu: parametri.poKlubu !== false,
      turnusPoKategoriji: parametri.turnusPoKategoriji === true,
    };
  }

  function imaOcena(takmicenjeId, pol) {
    return Number(baza.vrednost(
      `SELECT COUNT(*) FROM ocene o JOIN prijave p ON p.id = o.prijava_id JOIN takmicari t ON t.id = p.takmicar_id
       WHERE p.takmicenje_id = ? AND t.pol = ? AND o.status <> 'nacrt'`, [takmicenjeId, pol])) > 0;
  }

  // Pregled pre potvrde: ne menja bazu.
  function predlogRasporeda(takmicenjeId, pol, parametri) {
    proveriPol(takmicenjeId, pol);
    const opc = opcijeRasporeda(pol, parametri);
    const prijave = zaRaspored(takmicenjeId, pol);
    // upozorava se samo kad postoje grupe sa takmicarima (prazne se brisu bez gubitka)
    const imaGrupa = Number(baza.vrednost(
      `SELECT COUNT(*) FROM grupa_clanovi gc JOIN grupe g ON g.id = gc.grupa_id
       WHERE g.takmicenje_id = ? AND g.pol = ?`, [takmicenjeId, pol])) > 0;
    return { ...sazetak(rasporedi(prijave, opc), prijave), imaGrupa, imaOcena: imaOcena(takmicenjeId, pol) };
  }

  // Brise grupe tog dela i pravi nove iz racuna; prijave i ocene se ne diraju.
  function primeniRaspored(takmicenjeId, pol, parametri) {
    proveriPol(takmicenjeId, pol);
    const opc = opcijeRasporeda(pol, parametri);
    if (imaOcena(takmicenjeId, pol)) {
      throw new GreskaKorisnika('Ocene su već unete. Automatski raspored nije moguć; grupe menjajte ručno.');
    }
    const r = rasporedi(zaRaspored(takmicenjeId, pol), opc);
    let grupa = 0;
    baza.transakcija(() => {
      const stare = 'SELECT id FROM grupe WHERE takmicenje_id = ? AND pol = ?';
      baza.izvrsi(`DELETE FROM grupa_redosled WHERE grupa_id IN (${stare})`, [takmicenjeId, pol]);
      baza.izvrsi(`DELETE FROM grupa_clanovi WHERE grupa_id IN (${stare})`, [takmicenjeId, pol]);
      baza.izvrsi('DELETE FROM grupe WHERE takmicenje_id = ? AND pol = ?', [takmicenjeId, pol]);
      const sad = Baza.sad();
      for (const t of r.turnusi) {
        for (const gr of t.grupe) {
          // posle Z ide A2, B2... kao kod rucnog dodavanja
          const naziv = 'Grupa ' + String.fromCharCode(65 + (grupa % 26)) + (grupa >= 26 ? Math.floor(grupa / 26) + 1 : '');
          grupa++;
          const id = baza.ubaci('grupe', {
            takmicenje_id: takmicenjeId, pol, naziv, redosled: grupa, turnus: t.turnus,
            pocetna_pozicija: gr.pocetna_pozicija, kreirano: sad, izmenjeno: sad,
          });
          gr.clanovi.forEach((pid, i) => baza.ubaci('grupa_clanovi', { grupa_id: id, prijava_id: pid, redosled: i + 1 }));
        }
      }
    });
    return { grupa, turnusa: r.turnusi.length };
  }

  return {
    nadji, lista, rucniRedosledi, clanovi, nerasporedjeni, kombinacije, brojSprava, dodaj, izmeni, obrisi, premesti, vratiRedosled,
    turnusi, zaRaspored, predlogRasporeda, primeniRaspored,
  };
}

module.exports = { napravi };
