// Sifarnici: kategorije, programi i sprave. Sve tri liste su posebne za MSG ('M') i ZSG ('Z'). Poruke su doslovno iz PHP verzije.
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { istiTekst } = require('./sortiranje.cjs');

// Imena tabela dolaze samo odavde, nikad iz unosa.
const VRSTE = {
  kategorije: { tabela: 'kategorije', naziv: 'Kategorije' },
  programi: { tabela: 'programi', naziv: 'Programi' },
  sprave: { tabela: 'sprave', naziv: 'Sprave' },
};

const IKONE = ['sprava-PA', 'sprava-KH', 'sprava-KA', 'sprava-PR', 'sprava-RA', 'sprava-VR', 'sprava-DR', 'sprava-GR'];

function napravi(baza) {
  function meta(vrsta) {
    if (!Object.prototype.hasOwnProperty.call(VRSTE, vrsta)) {
      throw new GreskaKorisnika('Nepoznata lista: ' + vrsta);
    }
    return VRSTE[vrsta];
  }

  function proveriPol(pol) {
    if (pol !== 'M' && pol !== 'Z') throw new GreskaKorisnika('Nepoznat pol.');
    return pol;
  }

  function lista(vrsta, pol) {
    const m = meta(vrsta);
    return baza.svi(`SELECT * FROM ${m.tabela} WHERE pol = ? ORDER BY redosled, id`, [proveriPol(pol)]);
  }

  function sprave(pol) {
    return baza.svi('SELECT * FROM sprave WHERE pol = ? ORDER BY redosled, id', [pol]);
  }

  function nadji(vrsta, id) {
    const m = meta(vrsta);
    return baza.jedan(`SELECT * FROM ${m.tabela} WHERE id = ?`, [id]);
  }

  // Stavka drugog pola se ponasa kao da ne postoji.
  function trazi(m, id, pol) {
    if (baza.jedan(`SELECT id FROM ${m.tabela} WHERE id = ? AND pol = ?`, [id, proveriPol(pol)]) === null) {
      throw new GreskaKorisnika('Stavka ne postoji.');
    }
  }

  // Vraca ociscene vrednosti ili baca prvu gresku.
  function proveri(m, p, id, pol) {
    const naziv = String(p.naziv ?? '').trim();
    if (naziv === '') throw new GreskaKorisnika('Naziv je obavezan.');
    const o = { naziv };
    if (m.tabela === 'sprave') {
      const skr = String(p.skracenica ?? '').trim().toUpperCase();
      if (!/^\p{L}{1,4}$/u.test(skr)) throw new GreskaKorisnika('Skraćenica sprave mora imati 1 do 4 slova.');
      const zauzeta = baza.svi('SELECT id, skracenica FROM sprave WHERE pol = ?', [pol])
        .some((r) => r.id !== id && istiTekst(r.skracenica, skr));
      if (zauzeta) throw new GreskaKorisnika(`Skraćenica ${skr} već postoji za taj pol.`);
      const ikona = String(p.ikona ?? '').trim();
      if (ikona !== '' && !IKONE.includes(ikona)) throw new GreskaKorisnika('Nepoznata ikona.');
      o.skracenica = skr;
      o.ikona = ikona;
    }
    return o;
  }

  function dodaj(vrsta, p, pol) {
    const m = meta(vrsta);
    proveriPol(pol);
    const o = proveri(m, p, null, pol);
    return baza.transakcija(() => {
      const sledeci = baza.vrednost(`SELECT COALESCE(MAX(redosled), 0) + 1 FROM ${m.tabela} WHERE pol = ?`, [pol]);
      const sad = Baza.sad();
      return baza.ubaci(m.tabela, { ...o, pol, redosled: Number(sledeci), kreirano: sad, izmenjeno: sad });
    });
  }

  function izmeni(vrsta, id, p, pol) {
    const m = meta(vrsta);
    trazi(m, id, pol);
    const o = proveri(m, p, id, pol);
    o.izmenjeno = Baza.sad();
    baza.izmeni(m.tabela, o, 'id = ?', [id]);
  }

  function obrisi(vrsta, id, pol) {
    const m = meta(vrsta);
    trazi(m, id, pol);
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

  // Id koji ne pripada toj vrsti ili polu se ignorise.
  function redosled(vrsta, ids, pol) {
    const m = meta(vrsta);
    proveriPol(pol);
    const sad = Baza.sad();
    baza.transakcija(() => {
      ids.forEach((id, i) => {
        baza.izvrsi(`UPDATE ${m.tabela} SET redosled = ?, izmenjeno = ? WHERE id = ? AND pol = ?`, [i + 1, sad, id, pol]);
      });
    });
  }

  return { meta, lista, sprave, nadji, dodaj, izmeni, obrisi, redosled };
}

module.exports = { VRSTE, IKONE, napravi };
