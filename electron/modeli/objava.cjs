// Objava takmicenja: citanje redova jednog takmicenja za izvoz (format je u racun/objava-format.mjs).
// Uvoz (spec 5.6) nikad ne menja ni ne brise postojeci red, samo dodaje. Izvoz u fajl dodaje se u ovaj isti objekat.
const crypto = require('node:crypto');
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { napraviObjavu, proveriObjavu } = require('../racun/objava-format.mjs');
const { nadjiKlubDetaljno, kljuc } = require('../uvoz/uparivanje.cjs');
const { normalizuj } = require('../uvoz/tumac-prijave.cjs');

const mesta = (niz) => niz.map(() => '?').join(', ');

function napravi(baza) {
  // Redovi iz tabele ciji je kljuc u listi (prazna lista daje prazan niz).
  const poId = (tabela, kolona, lista, poredak) => (lista.length
    ? baza.svi(`SELECT * FROM ${tabela} WHERE ${kolona} IN (${mesta(lista)}) ORDER BY ${poredak}`, lista)
    : []);
  const jedinstveno = (lista) => [...new Set(lista.filter((v) => v !== null && v !== undefined))];

  // Sirovi redovi jednog takmicenja: samo klubovi, takmicari, kategorije, programi i sprave koje koristi.
  function redoviTakmicenja(tid) {
    const takmicenje = baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [tid]);
    if (!takmicenje) throw new GreskaKorisnika('Takmičenje ne postoji.');

    const prijave = baza.svi('SELECT * FROM prijave WHERE takmicenje_id = ? ORDER BY id', [tid]);
    const pids = prijave.map((p) => p.id);
    const prijavaSprave = poId('prijava_sprave', 'prijava_id', pids, 'prijava_id, sprava_id');
    const ocene = poId('ocene', 'prijava_id', pids, 'id');
    const oceneE = poId('ocene_e', 'ocena_id', ocene.map((o) => o.id), 'ocena_id, sudija');
    const grupe = baza.svi('SELECT * FROM grupe WHERE takmicenje_id = ? ORDER BY id', [tid]);
    const gids = grupe.map((g) => g.id);
    const clanovi = poId('grupa_clanovi', 'grupa_id', gids, 'grupa_id, redosled, prijava_id');
    const redosledi = poId('grupa_redosled', 'grupa_id', gids, 'grupa_id, rotacija, redosled, prijava_id');

    const takmicari = poId('takmicari', 'id', jedinstveno(prijave.map((p) => p.takmicar_id)), 'id');
    const klubovi = poId('klubovi', 'id',
      jedinstveno([...prijave.map((p) => p.klub_id), ...takmicari.map((t) => t.klub_id)]), 'id');
    const kategorije = poId('kategorije', 'id', jedinstveno(prijave.map((p) => p.kategorija_id)), 'id');
    const programi = poId('programi', 'id', jedinstveno(prijave.map((p) => p.program_id)), 'id');
    const sprave = poId('sprave', 'id',
      jedinstveno([...prijavaSprave.map((x) => x.sprava_id), ...ocene.map((o) => o.sprava_id)]), 'id');

    return { takmicenje, klubovi, takmicari, kategorije, programi, sprave, prijave, prijavaSprave, grupe, clanovi,
      redosledi, ocene, oceneE };
  }

  // Greske formata, pa sprave koje ne postoje lokalno (pol i skracenica); bez upisa.
  function proveri(o) {
    const greske = proveriObjavu(o);
    if (greske.length) return greske;
    for (const s of o.sprave) {
      const ima = baza.jedan('SELECT id FROM sprave WHERE pol = ? AND skracenica = ?', [s?.pol, s?.skracenica]);
      if (!ima) greske.push('Sprava ' + s?.skracenica + ' (' + s?.pol + ') ne postoji u programu.');
    }
    return greske;
  }

  // Uid je vec uvezen, odbijen ili je takmicenje sa tim uid-om lokalno (Task 4 ga koristi za preskocene fajlove).
  function vecObradjen(uid) {
    if (typeof uid !== 'string' || uid === '') return false;
    return baza.jedan('SELECT 1 FROM uvezene_objave WHERE uid = ?', [uid]) !== null
      || baza.jedan('SELECT 1 FROM takmicenja WHERE uid = ?', [uid]) !== null;
  }

  // Klubovi: po skracenici, pa po punom imenu; prihvata se samo potpuno poklapanje.
  function upariKlubove(o, sa) {
    const lokalni = baza.svi('SELECT id, puno_ime, skracenica FROM klubovi');
    const mapa = new Map();
    for (const k of o.klubovi) {
      let r = nadjiKlubDetaljno(String(k.skracenica ?? ''), lokalni);
      if (r.id === null || r.delimicno) r = nadjiKlubDetaljno(String(k.puno_ime ?? ''), lokalni);
      let id = r.id !== null && !r.delimicno ? r.id : null;
      if (id === null) {
        id = baza.ubaci('klubovi', sa({ puno_ime: k.puno_ime ?? '', skracenica: k.skracenica ?? '', grad: k.grad ?? '' }));
        lokalni.push({ id, puno_ime: k.puno_ime ?? '', skracenica: k.skracenica ?? '' });
      }
      mapa.set(k.id, id);
    }
    return mapa;
  }

  // Takmicari: isti pol, godina i ime (i zamenjen redosled); lokalni red se koristi najvise jednom.
  function uparITakmicare(o, klub, sa) {
    const koriscen = new Set();
    const mapa = new Map();
    let n = 0;
    for (const f of o.takmicari) {
      const k1 = kljuc(f.prezime ?? '', f.ime ?? '');
      const k2 = kljuc(f.ime ?? '', f.prezime ?? '');
      const lokalni = baza.svi('SELECT id, ime, prezime FROM takmicari WHERE pol = ? AND godina_rodjenja = ?', [f.pol, f.godina_rodjenja])
        .find((r) => !koriscen.has(r.id) && [k1, k2].includes(kljuc(r.prezime, r.ime)));
      let id;
      if (lokalni) {
        id = lokalni.id;
      } else {
        n += 1;
        id = baza.ubaci('takmicari', sa({ id_broj: 'U' + o.uid.slice(0, 8) + '-' + n, ime: f.ime ?? '', prezime: f.prezime ?? '',
          godina_rodjenja: f.godina_rodjenja, pol: f.pol, klub_id: klub(f.klub_id), drzavljanstvo: f.drzavljanstvo ?? 'Srbija' }));
      }
      koriscen.add(id);
      mapa.set(f.id, id);
    }
    return mapa;
  }

  // Kategorije i programi: isti pol i naziv; nova ide na kraj redosleda tog pola.
  function uparStavke(tabela, lista, polTakmicenja, sa) {
    const mapa = new Map();
    for (const f of lista) {
      const pol = f.pol ?? polTakmicenja;
      let id = baza.svi(`SELECT id, naziv FROM ${tabela} WHERE pol = ?`, [pol]).find((r) => normalizuj(r.naziv) === normalizuj(f.naziv))?.id;
      if (id === undefined) {
        const redosled = Number(baza.vrednost(`SELECT COALESCE(MAX(redosled), 0) FROM ${tabela} WHERE pol = ?`, [pol])) + 1;
        id = baza.ubaci(tabela, sa({ naziv: f.naziv, pol, redosled }));
      }
      mapa.set(f.id, id);
    }
    return mapa;
  }

  // Jedna transakcija: ili se upise sve (i red u uvezene_objave) ili nista (izuzetak ide pozivaocu).
  function uvezi(o, { sad } = {}) {
    return baza.transakcija(() => {
      const uid = o?.uid;
      if (vecObradjen(uid)) return { stanje: 'preskoceno', takmicenje_id: null, poruka: 'Objava je već obrađena.' };
      const vreme = sad ?? Baza.sad();
      const zapis = (stanje, tid, poruka) => {
        // bez ispravnog uid-a nema pod cime da se zapamti
        if (typeof uid === 'string' && uid !== '') {
          baza.ubaci('uvezene_objave', { uid, takmicenje_id: tid, stanje, poruka, vreme, izvor_verzija: String(o?.program?.verzija ?? ''),
            naziv: String(o?.takmicenje?.naziv ?? ''), pol: String(o?.takmicenje?.pol ?? '') });
        }
        return { stanje, takmicenje_id: tid, poruka };
      };

      const greske = proveri(o);
      if (greske.length) return zapis('odbijeno', null, greske.join('; '));

      const t = o.takmicenje;
      const ista = baza.svi('SELECT id, naziv FROM takmicenja WHERE pol = ? AND datum = ?', [t.pol, t.datum])
        .find((r) => normalizuj(r.naziv) === normalizuj(t.naziv));
      if (ista) return zapis('postoji', ista.id, 'Takmičenje već postoji.');

      const sa = (red) => ({ ...red, kreirano: vreme, izmenjeno: vreme });
      const klubovi = upariKlubove(o, sa);
      const klub = (id) => (id === null || id === undefined ? null : klubovi.get(id));
      const takmicari = uparITakmicare(o, klub, sa);
      const kategorije = uparStavke('kategorije', o.kategorije, t.pol, sa);
      const programi = uparStavke('programi', o.programi, t.pol, sa);
      const opcion = (mapa, id) => (id === null || id === undefined ? null : mapa.get(id));
      const sprave = new Map();
      for (const s of o.sprave) {
        sprave.set(s.id, baza.vrednost('SELECT id FROM sprave WHERE pol = ? AND skracenica = ?', [s.pol, s.skracenica]));
      }

      const tid = baza.ubaci('takmicenja', sa({
        naziv: t.naziv, datum: t.datum, mesto: t.mesto ?? '', pol: t.pol, broj_e_sudija: t.broj_e_sudija ?? 4,
        pravilo_e: t.pravilo_e ?? 'odbaci_krajnje', ekipno_broji: t.ekipno_broji ?? 3, pomeraj_redosled: t.pomeraj_redosled ?? 0,
        zavrseno: 1, zaglavlje_biltena: t.zaglavlje_biltena ?? '', organizator: t.organizator ?? '', domacin: t.domacin ?? '',
        grb_levo: '', grb_desno: '', uid,
      }));

      const prijave = new Map();
      for (const p of o.prijave) {
        const pid = baza.ubaci('prijave', sa({ takmicenje_id: tid, takmicar_id: takmicari.get(p.takmicar_id), klub_id: klub(p.klub_id),
          kategorija_id: opcion(kategorije, p.kategorija_id), program_id: opcion(programi, p.program_id),
          clan_ekipe: p.clan_ekipe ?? 0, van_konkurencije: p.van_konkurencije ?? 0, startni_broj: p.startni_broj ?? null }));
        prijave.set(p.id, pid);
        for (const sid of new Set(p.sprave)) baza.ubaci('prijava_sprave', { prijava_id: pid, sprava_id: sprave.get(sid) });
      }

      for (const g of o.grupe) {
        const gid = baza.ubaci('grupe', sa({ takmicenje_id: tid, pol: g.pol ?? t.pol, naziv: g.naziv ?? '', redosled: g.redosled ?? 0,
          pocetna_pozicija: g.pocetna_pozicija ?? 1, turnus: g.turnus ?? 1 }));
        for (const c of g.clanovi ?? []) {
          baza.ubaci('grupa_clanovi', { grupa_id: gid, prijava_id: prijave.get(c.prijava_id), redosled: c.redosled ?? 0 });
        }
        for (const r of g.redosled_po_rotaciji ?? []) {
          baza.ubaci('grupa_redosled', { grupa_id: gid, rotacija: r.rotacija, prijava_id: prijave.get(r.prijava_id), redosled: r.redosled ?? 0 });
        }
      }

      // Ocene su celi brojevi; null ostaje null.
      for (const c of o.ocene) {
        const oid = baza.ubaci('ocene', sa({ prijava_id: prijave.get(c.prijava_id), sprava_id: sprave.get(c.sprava_id), d: c.d ?? null,
          e: c.e ?? null, bonus: c.bonus ?? null, odbitak: c.odbitak ?? null, konacna: c.konacna ?? null, status: c.status ?? 'nacrt',
          broj_ispravki: c.broj_ispravki ?? 0, uneto_u: c.uneto_u ?? null }));
        for (const e of c.e_sudije ?? []) baza.ubaci('ocene_e', { ocena_id: oid, sudija: e.sudija, vrednost: e.vrednost ?? null });
      }

      return zapis('uvezeno', tid, 'Takmičenje je uvezeno.');
    });
  }

  // Objekat objave za fajl; prvi put dodeljuje takmicenju uid (kasnije ostaje isti).
  function izvezi(tid, { verzija, sad }) {
    const redovi = redoviTakmicenja(tid);
    let uid = redovi.takmicenje.uid;
    if (!uid) {
      uid = crypto.randomUUID();
      baza.izmeni('takmicenja', { uid }, "id = ? AND uid = ''", [tid]);
      uid = baza.vrednost('SELECT uid FROM takmicenja WHERE id = ?', [tid]);
    }
    return napraviObjavu(redovi, { uid, verzija, sad });
  }

  return { redoviTakmicenja, izvezi, uvezi, proveri, vecObradjen };
}

module.exports = { napravi };
