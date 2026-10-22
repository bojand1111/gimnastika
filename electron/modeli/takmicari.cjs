// Model Takmicari (SQLite). Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { poImenu, istiTekst } = require('./sortiranje.cjs');
const { datumParsiraj } = require('../racun/datum.mjs');

const POLJA = ['id_broj', 'ime', 'prezime', 'godina_rodjenja', 'pol', 'klub_id', 'drzavljanstvo',
  'lekarski_do', 'broj_licence', 'trener', 'kontakt_roditelja'];

const SELECT = `SELECT t.*, k.skracenica AS klub_skr, k.puno_ime AS klub_ime
  FROM takmicari t LEFT JOIN klubovi k ON k.id = t.klub_id`;

function napravi(baza) {
  const tekst = (v) => String(v ?? '').trim();

  // Ociscen unos iz forme: tekst trim, godina broj, klub broj ili null, datum gggg-mm-dd | null | false.
  function ocisti(p) {
    const godina = parseInt(tekst(p.godina_rodjenja), 10);
    const klub = tekst(p.klub_id);
    return {
      id_broj: tekst(p.id_broj),
      ime: tekst(p.ime),
      prezime: tekst(p.prezime),
      godina_rodjenja: Number.isNaN(godina) ? 0 : godina,
      pol: p.pol,
      klub_id: klub === '' ? null : Number(klub),
      drzavljanstvo: tekst(p.drzavljanstvo) || 'Srbija',
      lekarski_do: datumParsiraj(p.lekarski_do),
      broj_licence: tekst(p.broj_licence),
      trener: tekst(p.trener),
      kontakt_roditelja: tekst(p.kontakt_roditelja),
    };
  }

  function svi() {
    return poImenu(baza.svi(`${SELECT} ORDER BY t.id`), 'prezime', 'ime');
  }

  function nadji(id) {
    return baza.jedan(`${SELECT} WHERE t.id = ?`, [id]);
  }

  function proveri(p, id) {
    const o = ocisti(p);
    const g = [];
    if (o.id_broj === '') {
      g.push('ID broj je obavezan.');
    } else if (baza.svi('SELECT id, id_broj FROM takmicari').some(r => r.id !== (id ?? 0) && istiTekst(r.id_broj, o.id_broj))) {
      g.push(`ID broj ${o.id_broj} već postoji.`);
    }
    if (o.ime === '') g.push('Ime je obavezno.');
    if (o.prezime === '') g.push('Prezime je obavezno.');
    if (o.godina_rodjenja < 1900 || o.godina_rodjenja > new Date().getFullYear()) {
      g.push('Godina rođenja nije ispravna.');
    }
    if (o.pol !== 'M' && o.pol !== 'Z') g.push('Izaberite pol.');
    if (o.klub_id !== null && !baza.jedan('SELECT id FROM klubovi WHERE id = ?', [o.klub_id])) {
      g.push('Klub ne postoji.');
    }
    if (o.lekarski_do === false) g.push('Datum lekarskog nije ispravan (dd.mm.gggg).');
    return g;
  }

  function sacuvaj(p, id) {
    const greske = proveri(p, id);
    if (greske.length) throw new GreskaKorisnika(greske.join(' '), { greske });
    const o = ocisti(p);
    const red = {};
    for (const polje of POLJA) red[polje] = o[polje];
    const sad = Baza.sad();
    red.izmenjeno = sad;
    if (id === null || id === undefined) {
      red.kreirano = sad;
      return baza.ubaci('takmicari', red);
    }
    baza.izmeni('takmicari', red, 'id = ?', [id]);
    return id;
  }

  // Samo id brojevi od cifara; duzina najveceg (poslednjeg pri jednakosti), bez njih 5.
  function sledeciIdBroj() {
    let najveci = 0n;
    let duzina = 5;
    for (const r of baza.svi('SELECT id_broj FROM takmicari ORDER BY id')) {
      if (!/^\d+$/.test(r.id_broj)) continue;
      const n = BigInt(r.id_broj);
      if (n >= najveci) {
        najveci = n;
        duzina = r.id_broj.length;
      }
    }
    return String(najveci + 1n).padStart(duzina, '0');
  }

  function obrisi(id) {
    const n = Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicar_id = ?', [id]));
    if (n > 0) throw new GreskaKorisnika(`Takmičar ima ${n} prijava na takmičenjima i ne može se obrisati.`);
    baza.izvrsi('DELETE FROM takmicari WHERE id = ?', [id]);
  }

  return { POLJA, svi, nadji, proveri, sacuvaj, sledeciIdBroj, obrisi };
}

module.exports = { napravi };
