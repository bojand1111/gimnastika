// Model Prijave (SQLite): prijave takmicara na takmicenje. Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { KOLATOR } = require('./sortiranje.cjs');
const Priprema = require('../racun/priprema.mjs');
const { lekarski } = require('../racun/lekarski.mjs');

const tekst = (v) => String(v ?? '');
const celo = (v) => (v === null || v === undefined ? null : Number(v));

// Poredi dva kljuca; null ide prvo (kao u MySQL-u), brojevi brojcano, tekst kolatorom.
function poredi(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return KOLATOR.compare(String(a), String(b));
}

function poKljucevima(redovi, kljuc) {
  return [...redovi].sort((x, y) => {
    const a = kljuc(x);
    const b = kljuc(y);
    for (let i = 0; i < a.length; i++) {
      const r = poredi(a[i], b[i]);
      if (r !== 0) return r;
    }
    return 0;
  });
}

// Prvo Z pa M.
const polRang = (pol) => (pol === 'Z' ? 0 : 1);

function napravi(baza, podesavanja) {
  // Sprave po prijavi, po redosledu sprave.
  function spraveZa(ids) {
    const po = new Map();
    if (!ids.length) return po;
    const redovi = baza.svi(
      `SELECT ps.prijava_id, ps.sprava_id FROM prijava_sprave ps JOIN sprave s ON s.id = ps.sprava_id
       WHERE ps.prijava_id IN (${ids.map(() => '?').join(', ')}) ORDER BY s.redosled, s.id`, ids);
    for (const r of redovi) {
      if (!po.has(r.prijava_id)) po.set(r.prijava_id, []);
      po.get(r.prijava_id).push(Number(r.sprava_id));
    }
    return po;
  }

  function lista(takmicenjeId, pol = null) {
    const params = [takmicenjeId];
    let polSql = '';
    if (pol !== null) {
      polSql = ' AND t.pol = ?';
      params.push(pol);
    }
    const redovi = baza.svi(
      `SELECT p.*, t.id_broj, t.ime, t.prezime, t.godina_rodjenja, t.pol, t.lekarski_do,
              k.skracenica AS klub_skr, k.puno_ime AS klub_ime
       FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id LEFT JOIN klubovi k ON k.id = p.klub_id
       WHERE p.takmicenje_id = ?${polSql}`, params);
    const sprave = spraveZa(redovi.map((r) => r.id));
    for (const r of redovi) r.sprave = sprave.get(r.id) ?? [];
    return poKljucevima(redovi, (r) => [polRang(r.pol), r.prezime, r.ime, r.id]);
  }

  function nadji(id) {
    const r = baza.jedan(
      'SELECT p.*, t.pol, t.ime, t.prezime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id WHERE p.id = ?', [id]);
    if (r !== null) r.sprave = spraveZa([r.id]).get(r.id) ?? [];
    return r;
  }

  function prijavljeniTakmicari(takmicenjeId) {
    return baza.svi('SELECT takmicar_id FROM prijave WHERE takmicenje_id = ?', [takmicenjeId]).map((r) => Number(r.takmicar_id));
  }

  function potvrdjeniKlubovi(takmicenjeId) {
    return baza.svi('SELECT klub_id FROM potvrde_klubova WHERE takmicenje_id = ?', [takmicenjeId]).map((r) => Number(r.klub_id));
  }

  // Prijava mora postojati i pripadati takmicenju.
  function trazi(takmicenjeId, prijavaId) {
    const p = nadji(prijavaId);
    if (p === null || Number(p.takmicenje_id) !== Number(takmicenjeId)) throw new GreskaKorisnika('Prijava ne postoji.');
    return p;
  }

  function polja(ucesce) {
    try {
      return Priprema.poljaUcesca(ucesce);
    } catch (e) {
      throw new GreskaKorisnika(e.message);
    }
  }

  function dodajVise(takmicenjeId, takmicarIds) {
    // prva kategorija i program su iz liste pola takmicenja
    const polTakm = baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [takmicenjeId]);
    const prvaKat = baza.vrednost('SELECT id FROM kategorije WHERE pol = ? ORDER BY redosled, id LIMIT 1', [polTakm]);
    const prviProg = baza.vrednost('SELECT id FROM programi WHERE pol = ? ORDER BY redosled, id LIMIT 1', [polTakm]);
    let dodato = 0;
    const preskoceno = [];
    const upozorenja = [];
    for (const tid of new Set(takmicarIds)) {
      const r = dodajJednu(takmicenjeId, Number(tid), celo(prvaKat), celo(prviProg), Priprema.POJEDINAC);
      if (r.stanje === 'dodato') {
        dodato++;
        if (r.lekarski_ne_vazi) upozorenja.push(r.ime);
      } else if (r.stanje === 'preskoceno') {
        preskoceno.push(r.poruka);
      }
    }
    return { dodato, preskoceno, upozorenja };
  }

  // Id prijave takmicara na takmicenju, ili null.
  function idZa(takmicenjeId, takmicarId) {
    const id = baza.vrednost('SELECT id FROM prijave WHERE takmicenje_id = ? AND takmicar_id = ?', [takmicenjeId, takmicarId]);
    return id === null ? null : Number(id);
  }

  function dodajJednu(takmicenjeId, takmicarId, kategorijaId, programId, ucesce) {
    const takm = baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [takmicenjeId]);
    if (takm === null) throw new GreskaKorisnika('Takmičenje ne postoji.');
    const t = baza.jedan('SELECT * FROM takmicari WHERE id = ?', [takmicarId]);
    if (t === null) {
      return { stanje: 'nema', ime: '', poruka: 'Takmičar ne postoji.', lekarski_ne_vazi: false, prijava_id: null };
    }
    const ime = `${t.prezime} ${t.ime}`;
    if (t.pol !== takm.pol) {
      return { stanje: 'preskoceno', ime, poruka: `${ime}: nije istog pola kao takmičenje.`, lekarski_ne_vazi: false, prijava_id: null };
    }
    if (prijavljeniTakmicari(takmicenjeId).includes(takmicarId)) {
      return { stanje: 'vec', ime, poruka: `${ime} je već prijavljen.`, lekarski_ne_vazi: false, prijava_id: null };
    }
    const prag = podesavanja.dajInt('lekarski_prag_dana', 30);
    const lek = lekarski(t.lekarski_do, prag, String(takm.datum));
    const neVazi = lek.stanje === 'nema' || lek.stanje === 'istekao';
    if (neVazi && podesavanja.dajPol('lekarski_sprecava_prijavu', takm.pol, 'ne') === 'da') {
      return { stanje: 'preskoceno', ime, poruka: `${ime} (lekarski ne važi na dan takmičenja)`, lekarski_ne_vazi: true, prijava_id: null };
    }
    const poljaUcesca = polja(ucesce);
    const pid = baza.transakcija((b) => {
      const sad = Baza.sad();
      const id = b.ubaci('prijave', {
        takmicenje_id: takmicenjeId,
        takmicar_id: Number(t.id),
        klub_id: celo(t.klub_id),
        kategorija_id: kategorijaId,
        program_id: programId,
        startni_broj: null,
        kreirano: sad,
        izmenjeno: sad,
        ...poljaUcesca,
      });
      for (const s of b.svi('SELECT id FROM sprave WHERE pol = ? ORDER BY redosled, id', [t.pol])) {
        b.ubaci('prijava_sprave', { prijava_id: id, sprava_id: Number(s.id) });
      }
      return id;
    });
    // spisak kluba se promenio: potvrda vise ne vazi
    if (t.klub_id !== null) potvrdiKlub(takmicenjeId, Number(t.klub_id), false);
    return { stanje: 'dodato', ime, poruka: '', lekarski_ne_vazi: neVazi, prijava_id: pid };
  }

  function izmeniPolje(takmicenjeId, prijavaId, polje, vrednost) {
    trazi(takmicenjeId, prijavaId);
    let v = null;
    switch (polje) {
      case 'kategorija_id':
      case 'program_id': {
        const tabela = polje === 'kategorija_id' ? 'kategorije' : 'programi';
        const n = vrednost === null || vrednost === undefined ? 0 : (parseInt(vrednost, 10) || 0);
        v = n === 0 ? null : n;
        if (v !== null) {
          const stavka = baza.jedan(`SELECT pol FROM ${tabela} WHERE id = ?`, [v]);
          if (stavka === null) throw new GreskaKorisnika('Stavka ne postoji.');
          if (stavka.pol !== baza.vrednost('SELECT pol FROM takmicenja WHERE id = ?', [takmicenjeId])) {
            throw new GreskaKorisnika('Kategorija ili program ne pripada ovom polu.');
          }
        }
        break;
      }
      case 'clan_ekipe':
      case 'van_konkurencije':
        // PHP istinitost: '0', '', 0, false, null su 0
        v = vrednost && vrednost !== '0' ? 1 : 0;
        break;
      case 'startni_broj': {
        const s = tekst(vrednost).trim();
        if (s === '') {
          v = null;
        } else if (!/^[0-9]+$/.test(s) || parseInt(s, 10) < 1) {
          throw new GreskaKorisnika('Startni broj mora biti pozitivan ceo broj.');
        } else {
          v = parseInt(s, 10);
          const zauzet = baza.jedan(
            `SELECT t.prezime, t.ime FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id
             WHERE p.takmicenje_id = ? AND p.startni_broj = ? AND p.id <> ?`, [takmicenjeId, v, prijavaId]);
          if (zauzet !== null) throw new GreskaKorisnika(`Startni broj ${v} već ima ${zauzet.prezime} ${zauzet.ime}.`);
        }
        break;
      }
      default:
        throw new GreskaKorisnika('Nepoznato polje: ' + polje);
    }
    baza.izmeni('prijave', { [polje]: v, izmenjeno: Baza.sad() }, 'id = ?', [prijavaId]);
  }

  function postaviSpravu(takmicenjeId, prijavaId, spravaId, radi) {
    const p = trazi(takmicenjeId, prijavaId);
    const s = baza.jedan('SELECT * FROM sprave WHERE id = ?', [spravaId]);
    if (s === null || s.pol !== p.pol) throw new GreskaKorisnika('Sprava ne odgovara polu takmičara.');
    if (radi) {
      baza.izvrsi('INSERT OR IGNORE INTO prijava_sprave (prijava_id, sprava_id) VALUES (?, ?)', [prijavaId, spravaId]);
    } else {
      const ima = Number(baza.vrednost(
        "SELECT COUNT(*) FROM ocene WHERE prijava_id = ? AND sprava_id = ? AND status <> 'nacrt'", [prijavaId, spravaId]));
      if (ima > 0) throw new GreskaKorisnika('Na toj spravi već postoji uneta ocena. Prvo je obrišite u unosu ocena.');
      baza.transakcija((b) => {
        b.izvrsi('DELETE FROM prijava_sprave WHERE prijava_id = ? AND sprava_id = ?', [prijavaId, spravaId]);
        b.izvrsi("DELETE FROM ocene WHERE prijava_id = ? AND sprava_id = ? AND status = 'nacrt'", [prijavaId, spravaId]);
      });
    }
    baza.izmeni('prijave', { izmenjeno: Baza.sad() }, 'id = ?', [prijavaId]);
  }

  function obrisi(takmicenjeId, prijavaId) {
    const p = trazi(takmicenjeId, prijavaId);
    const n = Number(baza.vrednost("SELECT COUNT(*) FROM ocene WHERE prijava_id = ? AND status <> 'nacrt'", [prijavaId]));
    if (n > 0) throw new GreskaKorisnika(`${p.prezime} ${p.ime} ima ${n} unetih ocena. Prijava se ne može obrisati.`);
    baza.izvrsi('DELETE FROM prijave WHERE id = ?', [prijavaId]);
    if (p.klub_id !== null) potvrdiKlub(takmicenjeId, Number(p.klub_id), false);
  }

  function postaviUcesce(takmicenjeId, prijavaId, ucesce) {
    trazi(takmicenjeId, prijavaId);
    baza.izmeni('prijave', { ...polja(ucesce), izmenjeno: Baza.sad() }, 'id = ?', [prijavaId]);
  }

  function potvrdiKlub(takmicenjeId, klubId, potvrdjeno) {
    if (!potvrdjeno) {
      baza.izvrsi('DELETE FROM potvrde_klubova WHERE takmicenje_id = ? AND klub_id = ?', [takmicenjeId, klubId]);
      return;
    }
    const n = Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicenje_id = ? AND klub_id = ?', [takmicenjeId, klubId]));
    if (n === 0) throw new GreskaKorisnika('Klub nema prijava na ovom takmičenju.');
    baza.izvrsi(
      `INSERT INTO potvrde_klubova (takmicenje_id, klub_id, potvrdjeno) VALUES (?, ?, ?)
       ON CONFLICT(takmicenje_id, klub_id) DO UPDATE SET potvrdjeno = excluded.potvrdjeno`,
      [takmicenjeId, klubId, Baza.sad()]);
  }

  // Priprema.stanje + skracenica/puno_ime po klubu. Kljucevi klubova su celi brojevi pa JS objekat
  // ne cuva redosled; zato `redosled_klubova` (id-ovi po skracenici kolatorom, 0 = bez kluba na kraju).
  function stanjePripreme(takmicenjeId) {
    const redovi = baza.svi(
      `SELECT p.klub_id, p.kategorija_id, p.program_id, k.skracenica, k.puno_ime,
              (SELECT COUNT(*) FROM prijava_sprave ps WHERE ps.prijava_id = p.id) AS broj_sprava,
              (SELECT COUNT(*) FROM grupa_clanovi gc WHERE gc.prijava_id = p.id) AS u_grupi
       FROM prijave p LEFT JOIN klubovi k ON k.id = p.klub_id WHERE p.takmicenje_id = ?`, [takmicenjeId]);
    const imena = {};
    const ulaz = [];
    for (const r of redovi) {
      const kid = celo(r.klub_id);
      imena[kid ?? 0] = { skracenica: tekst(r.skracenica), puno_ime: tekst(r.puno_ime) };
      ulaz.push({
        klub_id: kid,
        kategorija_id: celo(r.kategorija_id),
        program_id: celo(r.program_id),
        broj_sprava: Number(r.broj_sprava),
        u_grupi: Number(r.u_grupi) > 0,
      });
    }
    const s = Priprema.stanje(ulaz, potvrdjeniKlubovi(takmicenjeId));
    for (const kid of Object.keys(s.klubovi)) Object.assign(s.klubovi[kid], imena[kid]);
    s.redosled_klubova = Object.keys(s.klubovi).map(Number).sort((a, b) => {
      if (a === 0 || b === 0) return (a === 0) - (b === 0);
      return KOLATOR.compare(imena[a].skracenica, imena[b].skracenica) || a - b;
    });
    return s;
  }

  function dodeliStartneBrojeve(takmicenjeId) {
    return baza.transakcija((b) => {
      let sledeci = Number(b.vrednost('SELECT COALESCE(MAX(startni_broj), 0) + 1 FROM prijave WHERE takmicenje_id = ?', [takmicenjeId]) ?? 1);
      const bez = b.svi(
        `SELECT p.id, t.pol, t.prezime, t.ime, kat.redosled AS kat_redosled, k.skracenica
         FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id
         LEFT JOIN kategorije kat ON kat.id = p.kategorija_id LEFT JOIN klubovi k ON k.id = p.klub_id
         WHERE p.takmicenje_id = ? AND p.startni_broj IS NULL`, [takmicenjeId]);
      const sortirano = poKljucevima(bez, (r) => [polRang(r.pol), celo(r.kat_redosled), r.skracenica, r.prezime, r.ime, r.id]);
      for (const r of sortirano) {
        b.izmeni('prijave', { startni_broj: sledeci++, izmenjeno: Baza.sad() }, 'id = ?', [r.id]);
      }
      return sortirano.length;
    });
  }

  // Samo takmicenja tog pola.
  function lekarskiUpozorenja(pragDana, pol) {
    const redovi = baza.svi(
      `SELECT t.id AS takmicar_id, t.ime, t.prezime, t.lekarski_do, k.skracenica AS klub_skr,
              tk.id AS takmicenje_id, tk.naziv AS takmicenje, tk.datum
       FROM prijave p JOIN takmicari t ON t.id = p.takmicar_id JOIN takmicenja tk ON tk.id = p.takmicenje_id
       LEFT JOIN klubovi k ON k.id = p.klub_id
       WHERE tk.zavrseno = 0 AND tk.pol = ?`, [pol]);
    const izlaz = [];
    for (const r of poKljucevima(redovi, (x) => [x.datum, x.takmicenje_id, x.prezime, x.ime, x.takmicar_id])) {
      const lek = lekarski(r.lekarski_do, pragDana, String(r.datum));
      if (lek.stanje !== 'vazi') izlaz.push({ ...r, lek });
    }
    return izlaz;
  }

  function brojevi(takmicenjeId) {
    return {
      prijava: Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicenje_id = ?', [takmicenjeId])),
      klubova: Number(baza.vrednost(
        'SELECT COUNT(DISTINCT klub_id) FROM prijave WHERE takmicenje_id = ? AND klub_id IS NOT NULL', [takmicenjeId])),
    };
  }

  return {
    lista, nadji, idZa, prijavljeniTakmicari, potvrdjeniKlubovi, brojevi, lekarskiUpozorenja, stanjePripreme,
    dodajVise, dodajJednu, izmeniPolje, postaviSpravu, postaviUcesce, obrisi, potvrdiKlub, dodeliStartneBrojeve,
  };
}

module.exports = { napravi };
