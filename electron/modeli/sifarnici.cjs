// Sifarnici: kategorije, programi, sprave (muske i zenske). Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { istiTekst } = require('./sortiranje.cjs');

// Imena tabela dolaze samo odavde, nikad iz unosa.
const VRSTE = {
  kategorije: { tabela: 'kategorije', naziv: 'Kategorije', pol: null },
  programi: { tabela: 'programi', naziv: 'Programi', pol: null },
  sprave_m: { tabela: 'sprave', naziv: 'Sprave · muške', pol: 'M' },
  sprave_z: { tabela: 'sprave', naziv: 'Sprave · ženske', pol: 'Z' },
};

const IKONE = ['sprava-PA', 'sprava-KH', 'sprava-KA', 'sprava-PR', 'sprava-RA', 'sprava-VR', 'sprava-DR', 'sprava-GR'];

function napravi(baza) {
  function meta(vrsta) {
    if (!Object.prototype.hasOwnProperty.call(VRSTE, vrsta)) {
      throw new GreskaKorisnika('Nepoznata lista: ' + vrsta);
    }
    return VRSTE[vrsta];
  }

  function lista(vrsta) {
    const m = meta(vrsta);
    if (m.pol) return baza.svi(`SELECT * FROM ${m.tabela} WHERE pol = ? ORDER BY redosled, id`, [m.pol]);
    return baza.svi(`SELECT * FROM ${m.tabela} ORDER BY redosled, id`);
  }

  function sprave(pol) {
    return baza.svi('SELECT * FROM sprave WHERE pol = ? ORDER BY redosled, id', [pol]);
  }

  function nadji(vrsta, id) {
    const m = meta(vrsta);
    return baza.jedan(`SELECT * FROM ${m.tabela} WHERE id = ?`, [id]);
  }

  // Vraca ociscene vrednosti ili baca prvu gresku.
  function proveri(m, p, id) {
    const naziv = String(p.naziv ?? '').trim();
    if (naziv === '') throw new GreskaKorisnika('Naziv je obavezan.');
    const o = { naziv };
    if (m.tabela === 'sprave') {
      const skr = String(p.skracenica ?? '').trim().toUpperCase();
      if (!/^\p{L}{1,4}$/u.test(skr)) throw new GreskaKorisnika('Skraćenica sprave mora imati 1 do 4 slova.');
      const zauzeta = baza.svi('SELECT id, skracenica FROM sprave WHERE pol = ?', [m.pol])
        .some((r) => r.id !== id && istiTekst(r.skracenica, skr));
      if (zauzeta) throw new GreskaKorisnika(`Skraćenica ${skr} već postoji za taj pol.`);
      const ikona = String(p.ikona ?? '').trim();
      if (ikona !== '' && !IKONE.includes(ikona)) throw new GreskaKorisnika('Nepoznata ikona.');
      o.skracenica = skr;
      o.ikona = ikona;
    }
    return o;
  }

  function dodaj(vrsta, p) {
    const m = meta(vrsta);
    const o = proveri(m, p, null);
    return baza.transakcija(() => {
      const sledeci = m.pol
        ? baza.vrednost(`SELECT COALESCE(MAX(redosled), 0) + 1 FROM ${m.tabela} WHERE pol = ?`, [m.pol])
        : baza.vrednost(`SELECT COALESCE(MAX(redosled), 0) + 1 FROM ${m.tabela}`);
      const sad = Baza.sad();
      const red = { ...o, redosled: Number(sledeci), kreirano: sad, izmenjeno: sad };
      if (m.pol) red.pol = m.pol;
      return baza.ubaci(m.tabela, red);
    });
  }

  function izmeni(vrsta, id, p) {
    const m = meta(vrsta);
    const o = proveri(m, p, id);
    o.izmenjeno = Baza.sad();
    baza.izmeni(m.tabela, o, 'id = ?', [id]);
  }

  function obrisi(vrsta, id) {
    const m = meta(vrsta);
    let n;
    if (m.tabela === 'kategorije') {
      n = Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE kategorija_id = ?', [id]));
    } else if (m.tabela === 'programi') {
      n = Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE program_id = ?', [id]));
    } else {
      n = Number(baza.vrednost('SELECT COUNT(*) FROM prijava_sprave WHERE sprava_id = ?', [id]))
        + Number(baza.vrednost('SELECT COUNT(*) FROM ocene WHERE sprava_id = ?', [id]));
    }
    if (n > 0) throw new GreskaKorisnika(`Stavka se koristi u ${n} prijava ili ocena i ne može se obrisati.`);
    baza.izvrsi(`DELETE FROM ${m.tabela} WHERE id = ?`, [id]);
  }

  // Id koji ne pripada toj vrsti (ili polu) se ignorise.
  function redosled(vrsta, ids) {
    const m = meta(vrsta);
    const sad = Baza.sad();
    baza.transakcija(() => {
      ids.forEach((id, i) => {
        if (m.pol) {
          baza.izvrsi(`UPDATE ${m.tabela} SET redosled = ?, izmenjeno = ? WHERE id = ? AND pol = ?`, [i + 1, sad, id, m.pol]);
        } else {
          baza.izvrsi(`UPDATE ${m.tabela} SET redosled = ?, izmenjeno = ? WHERE id = ?`, [i + 1, sad, id]);
        }
      });
    });
  }

  return { meta, lista, sprave, nadji, dodaj, izmeni, obrisi, redosled };
}

module.exports = { VRSTE, IKONE, napravi };
