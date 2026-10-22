// Model Uvoz (SQLite): uvoz prijava iz fajlova klubova (docx, xlsx). Priprema za pregled ne upisuje nista;
// upis posle potvrde ide u jednoj transakciji. Poruke su doslovno iz PHP verzije.
const { GreskaKorisnika } = require('../greska.cjs');
const dnevnikModul = require('../dnevnik.cjs');
const { procitaj } = require('../uvoz/citac.cjs');
const { protumaci, normalizuj } = require('../uvoz/tumac-prijave.cjs');
const U = require('../uvoz/uparivanje.cjs');
const { napravi: napraviTakmicare } = require('./takmicari.cjs');
const { napravi: napraviKlubove } = require('./klubovi.cjs');
const { napravi: napraviSifarnike } = require('./sifarnici.cjs');
const { napravi: napraviPrijave } = require('./prijave.cjs');

// "00120" => "00121" (ista duzina), "A12" => "A13", bez cifara na kraju dodaje "1".
function sledeci(idBroj) {
  const m = /^([\s\S]*?)(\d+)$/.exec(idBroj);
  if (m === null) return idBroj + '1';
  return m[1] + (BigInt(m[2]) + 1n).toString().padStart(m[2].length, '0');
}

// PHP empty() za vrednosti iz forme.
const prazno = (v) => v === undefined || v === null || v === '' || v === '0' || v === 0 || v === false;

function napravi(baza, podesavanja, dnevnik = dnevnikModul) {
  const takmicari = napraviTakmicare(baza);
  const klubovi = napraviKlubove(baza);
  const sifarnici = napraviSifarnike(baza);
  const prijave = napraviPrijave(baza, podesavanja);

  // Cita fajl, tumaci tabelu i uparuje redove sa bazom. Nista ne upisuje.
  function pripremiFajl(putanja, imeFajla, takmicenjeId) {
    const dok = procitaj(putanja);
    const p = protumaci(dok);
    const svi = takmicari.svi();
    const prijavljeni = prijave.prijavljeniTakmicari(takmicenjeId);
    const kategorije = baza.svi('SELECT id, naziv FROM kategorije ORDER BY redosled, id');
    const programi = baza.svi('SELECT id, naziv FROM programi ORDER BY redosled, id');
    const pol = p.pol;

    const oznake = [];
    const indeksOznake = new Map();
    const redovi = [];
    const videni = new Map();
    for (const r of p.redovi) {
      let o = U.oceni(r, svi, prijavljeni, r.pol ?? pol);
      const kljuc = U.kljuc(r.prezime, r.ime);
      if (o.status !== U.GRESKA) {
        if (videni.has(kljuc)) {
          o = { status: U.GRESKA, takmicar_id: null, postupak: 'nista', napomena: 'isti takmičar je već u redu ' + videni.get(kljuc) };
        } else {
          videni.set(kljuc, r.rb);
        }
      }
      let oi = null;
      if (r.oznaka !== '') {
        if (!indeksOznake.has(r.oznaka)) {
          indeksOznake.set(r.oznaka, oznake.length);
          oznake.push({
            oznaka: r.oznaka,
            kategorija: r.kategorija,
            program: r.program,
            kategorija_id: U.nadjiStavku(r.kategorija, kategorije),
            program_id: U.nadjiStavku(r.program, programi),
          });
        }
        oi = indeksOznake.get(r.oznaka);
      }
      redovi.push({ ...r, ...o, oznaka_i: oi });
    }
    return {
      ime: imeFajla,
      vrsta: dok.vrsta,
      klub_tekst: p.klub,
      klub_id: U.nadjiKlub(p.klub, klubovi.svi()),
      pol,
      oznake,
      redovi,
      greske: p.greske,
    };
  }

  // Izbor iz forme za kategoriju ili program: '' => null, 'novo' => {novo: naziv}, broj => {id}.
  function razresiStavku(vrsta, izbor, naziv) {
    const iz = String(izbor).trim();
    if (iz === '' || iz === '0') return null;
    if (iz === 'novo') {
      const n = String(naziv ?? '').trim();
      return n === '' ? null : { novo: n };
    }
    const tabela = sifarnici.meta(vrsta).tabela;
    if (!/^[0-9]+$/.test(iz) || baza.vrednost(`SELECT id FROM ${tabela} WHERE id = ?`, [Number(iz)]) === null) {
      throw new GreskaKorisnika(`Izabrana stavka ne postoji (${vrsta}).`);
    }
    return { id: Number(iz) };
  }

  // Id stavke iz razresenog izbora; novu pravi jednom po nazivu.
  function stavkaId(vrsta, izbor, napravljene) {
    if (izbor === null) return null;
    if (izbor.id !== undefined) return izbor.id;
    const kljuc = vrsta + '|' + normalizuj(izbor.novo);
    if (!napravljene.has(kljuc)) {
      const postojeca = U.nadjiStavku(izbor.novo, baza.svi(`SELECT id, naziv FROM ${sifarnici.meta(vrsta).tabela}`));
      napravljene.set(kljuc, postojeca ?? sifarnici.dodaj(vrsta, { naziv: izbor.novo }));
    }
    return napravljene.get(kljuc);
  }

  // Faza 1: provera i razresavanje izbora, bez upisa.
  function planiraj(fajlovi, izbor) {
    const plan = [];
    fajlovi.forEach((f, fi) => {
      const iz = izbor[String(fi)] ?? {};
      const pol = String(iz.pol ?? f.pol ?? '');
      const klubId = Object.hasOwn(iz, 'klub_id') ? (parseInt(iz.klub_id, 10) || 0) : Number(f.klub_id ?? 0);
      if (klubId !== 0 && baza.vrednost('SELECT id FROM klubovi WHERE id = ?', [klubId]) === null) {
        throw new GreskaKorisnika(`Klub za fajl ${f.ime} ne postoji.`);
      }
      const oznake = f.oznake.map((o, oi) => {
        const zo = iz.oznake?.[oi] ?? {};
        return {
          kategorija: razresiStavku('kategorije', zo.kategorija ?? o.kategorija_id ?? '', o.kategorija ?? o.oznaka),
          program: razresiStavku('programi', zo.program ?? o.program_id ?? '', o.program),
        };
      });
      const redovi = [];
      f.redovi.forEach((r, ri) => {
        const zr = iz.redovi?.[ri] ?? {};
        if (prazno(zr.uvezi) || r.status === U.GRESKA || r.status === U.PRIJAVLJEN) return;
        let postupak = String(zr.postupak ?? r.postupak);
        if (postupak === 'postojeci' && (r.takmicar_id === null || r.takmicar_id === undefined)) postupak = 'novi';
        if (postupak === 'novi' && !['M', 'Z'].includes(r.pol ?? pol)) {
          throw new GreskaKorisnika(`Izaberite pol (M ili Ž) za fajl ${f.ime}: potreban je za nove takmičare.`);
        }
        if (postupak !== 'postojeci' && postupak !== 'novi') return;
        redovi.push({ ...r, postupak_izabran: postupak });
      });
      plan.push({ fajl: f, pol, klub_id: klubId || null, oznake, redovi });
    });
    return plan;
  }

  // Upisuje potvrdjeni uvoz. fajlovi su iz pripremiFajl, izbor je po indeksu fajla (kljucevi se citaju kao tekst).
  function upisi(takmicenjeId, fajlovi, izbor) {
    const iz = Object.fromEntries(Object.entries(izbor ?? {}).map(([k, v]) => [String(k), v]));
    const plan = planiraj(fajlovi, iz);

    const rez = { prijavljeno: 0, novih: 0, postojecih: 0, vec: 0, preskoceno: [], upozorenja: [] };
    baza.transakcija(() => {
      const napravljene = new Map(); // 'vrsta|naziv' => id, da ista nova stavka iz dva fajla bude jedna
      const noviUpisani = new Map(); // kljuc imena => id novog takmicara iz ovog uvoza
      let idBroj = null;
      for (const p of plan) {
        const katProg = p.oznake.map((o) => [
          stavkaId('kategorije', o.kategorija, napravljene),
          stavkaId('programi', o.program, napravljene),
        ]);
        for (const r of p.redovi) {
          const ime = `${r.prezime} ${r.ime}`;
          let tid;
          let nov;
          if (r.postupak_izabran === 'postojeci') {
            tid = Number(r.takmicar_id);
            nov = false;
          } else {
            const kljuc = U.kljuc(r.prezime, r.ime);
            if (noviUpisani.has(kljuc)) {
              tid = noviUpisani.get(kljuc);
              nov = false;
            } else {
              if (r.godina === null || r.godina === undefined) {
                rez.preskoceno.push(`${ime} (nema godine rođenja)`);
                continue;
              }
              idBroj = idBroj === null ? takmicari.sledeciIdBroj() : sledeci(idBroj);
              while (baza.vrednost('SELECT id FROM takmicari WHERE id_broj = ?', [idBroj]) !== null) idBroj = sledeci(idBroj);
              const novi = {
                id_broj: idBroj,
                ime: r.ime,
                prezime: r.prezime,
                godina_rodjenja: Number(r.godina),
                pol: r.pol ?? p.pol,
                klub_id: p.klub_id,
                drzavljanstvo: 'Srbija',
                lekarski_do: null,
              };
              const greske = takmicari.proveri(novi, null);
              if (greske.length > 0) {
                rez.preskoceno.push(`${ime} (${greske.join(' ')})`);
                continue;
              }
              tid = takmicari.sacuvaj(novi, null);
              noviUpisani.set(kljuc, tid);
              nov = true;
            }
          }
          const [kat, prog] = r.oznaka_i !== null && r.oznaka_i !== undefined ? katProg[r.oznaka_i] : [null, null];
          const d = prijave.dodajJednu(takmicenjeId, tid, kat, prog, String(r.ucesce ?? ''));
          if (d.stanje === 'dodato') {
            rez.prijavljeno++;
            if (nov) rez.novih++;
            else rez.postojecih++;
            if (d.lekarski_ne_vazi && !nov) rez.upozorenja.push(d.ime);
          } else if (d.stanje === 'vec') {
            rez.vec++;
          } else {
            if (nov) rez.novih++;
            rez.preskoceno.push(d.poruka);
          }
        }
      }
    });
    dnevnik.info(`Uvoz prijava (takmičenje ${takmicenjeId}): prijavljeno ${rez.prijavljeno}, novih takmičara ${rez.novih}, preskočeno ${rez.preskoceno.length}`);
    return rez;
  }

  return { pripremiFajl, upisi };
}

module.exports = { napravi };
