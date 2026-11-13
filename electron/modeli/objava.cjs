// Objava takmicenja: citanje redova jednog takmicenja za izvoz (format je u racun/objava-format.mjs).
// Uvoz i izvoz u fajl dodaju se u ovaj isti objekat.
const { GreskaKorisnika } = require('../greska.cjs');

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

  return { redoviTakmicenja };
}

module.exports = { napravi };
