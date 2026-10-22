// Model Takmicenja (SQLite). Poruke su doslovno iz PHP verzije.
const fs = require('node:fs');
const path = require('node:path');
const { Baza } = require('../baza/baza.cjs');
const { GreskaKorisnika } = require('../greska.cjs');
const { datumParsiraj } = require('../racun/datum.mjs');
const { PRAVILA } = require('../racun/ocena.mjs');

const POLJA = ['naziv', 'datum', 'mesto', 'broj_e_sudija', 'pravilo_e', 'ekipno_broji', 'pomeraj_redosled', 'zavrseno', 'zaglavlje_biltena', 'organizator', 'domacin'];
const GRBOVI = ['grb_levo', 'grb_desno'];
const EKSTENZIJE = ['png', 'jpg', 'jpeg', 'svg', 'gif'];

const broj = (v) => parseInt(v, 10) || 0;
const da = (v) => (v === '1' || v === 1 || v === true ? 1 : 0);
const tekst = (v) => String(v ?? '');

// Zig lokalnog vremena: gggg mm dd HH MM SS bez razmaka.
function zig() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// fasciklaPodataka: putanja ili funkcija koja je vraca.
function napravi(baza, fasciklaPodataka) {
  const podaci = () => (typeof fasciklaPodataka === 'function' ? fasciklaPodataka() : fasciklaPodataka);
  const OCENE_UNETE = `FROM ocene o JOIN prijave p ON p.id = o.prijava_id WHERE p.takmicenje_id = ? AND o.status <> 'nacrt'`;

  // Unos iz forme: tekst kao tekst, brojevi kroz parseInt, datum gggg-mm-dd | null | false.
  function ocisti(p) {
    return {
      naziv: tekst(p.naziv),
      datum: datumParsiraj(p.datum),
      mesto: tekst(p.mesto),
      broj_e_sudija: broj(p.broj_e_sudija),
      pravilo_e: tekst(p.pravilo_e),
      ekipno_broji: broj(p.ekipno_broji),
      pomeraj_redosled: da(p.pomeraj_redosled),
      zavrseno: da(p.zavrseno),
      zaglavlje_biltena: tekst(p.zaglavlje_biltena),
      organizator: tekst(p.organizator),
      domacin: tekst(p.domacin),
    };
  }

  function sva() {
    return baza.svi(
      `SELECT t.*,
              (SELECT COUNT(*) FROM prijave p WHERE p.takmicenje_id = t.id) AS broj_prijava,
              (SELECT COUNT(*) ${OCENE_UNETE.replace('?', 't.id')}) AS broj_ocena
       FROM takmicenja t ORDER BY t.datum DESC, t.id DESC`);
  }

  function nadji(id) {
    return baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [id]);
  }

  function imaOcena(id) {
    return Number(baza.vrednost(`SELECT COUNT(*) ${OCENE_UNETE}`, [id])) > 0;
  }

  function brojPrijava(id) {
    return Number(baza.vrednost('SELECT COUNT(*) FROM prijave WHERE takmicenje_id = ?', [id]));
  }

  function prazno() {
    return { naziv: '', datum: null, mesto: '', broj_e_sudija: 4, pravilo_e: 'odbaci_krajnje', ekipno_broji: 3,
      pomeraj_redosled: 0, zavrseno: 0, zaglavlje_biltena: '', organizator: '', domacin: '', grb_levo: '', grb_desno: '' };
  }

  function proveri(p, id) {
    const o = ocisti(p);
    const g = [];
    if (o.naziv === '') g.push('Naziv takmičenja je obavezan.');
    if (o.datum === null) g.push('Datum je obavezan.');
    else if (o.datum === false) g.push('Datum nije ispravan (dd.mm.gggg).');
    if (o.broj_e_sudija < 1 || o.broj_e_sudija > 6) {
      g.push('Broj E sudija mora biti između 1 i 6.');
    } else if (id !== null && id !== undefined) {
      const staro = nadji(id);
      if (staro && Number(staro.broj_e_sudija) !== o.broj_e_sudija && imaOcena(id)) {
        g.push('Broj E sudija se ne može menjati kad takmičenje već ima unete ocene.');
      }
    }
    if (!Object.prototype.hasOwnProperty.call(PRAVILA, o.pravilo_e)) g.push('Nepoznato pravilo za E ocenu.');
    if (o.ekipno_broji < 1 || o.ekipno_broji > 10) g.push('Broj ocena koje se broje za ekipu mora biti između 1 i 10.');
    return g;
  }

  function sacuvaj(p, id) {
    const greske = proveri(p, id);
    if (greske.length) throw new GreskaKorisnika(greske.join(' '), { greske });
    const o = ocisti(p);
    const red = {};
    for (const k of POLJA) red[k] = o[k];
    red.izmenjeno = Baza.sad();
    if (id === null || id === undefined) {
      red.kreirano = red.izmenjeno;
      return baza.ubaci('takmicenja', red);
    }
    baza.izmeni('takmicenja', red, 'id = ?', [id]);
    return id;
  }

  // '' uklanja grb iz takmicenja (fajl ostaje na disku, kao u PHP).
  function postaviGrb(id, polje, vrednost) {
    if (!GRBOVI.includes(polje)) throw new Error('Nepoznato polje grba: ' + polje);
    baza.izmeni('takmicenja', { [polje]: vrednost, izmenjeno: Baza.sad() }, 'id = ?', [id]);
  }

  // Kopira sliku u <podaci>/grb i upisuje relativnu putanju; vraca upisanu vrednost.
  function sacuvajGrb(id, polje, izvor) {
    if (!GRBOVI.includes(polje)) throw new Error('Nepoznato polje grba: ' + polje);
    if (!fs.existsSync(izvor)) throw new GreskaKorisnika('Izabrana slika više ne postoji.');
    const ext = path.extname(String(izvor)).slice(1).toLowerCase();
    if (!EKSTENZIJE.includes(ext)) throw new GreskaKorisnika('Grb mora biti PNG, JPG, GIF ili SVG slika.');
    const strana = polje === 'grb_levo' ? 'levo' : 'desno';
    const fascikla = path.join(podaci(), 'grb');
    fs.mkdirSync(fascikla, { recursive: true });
    const osnova = `takmicenje_${id}_${strana}_${zig()}`;
    let ime = `${osnova}.${ext}`;
    for (let n = 1; fs.existsSync(path.join(fascikla, ime)); n++) ime = `${osnova}_${n}.${ext}`;
    fs.copyFileSync(izvor, path.join(fascikla, ime));
    const vrednost = 'grb/' + ime;
    postaviGrb(id, polje, vrednost);
    return vrednost;
  }

  function obrisi(id) {
    const n = brojPrijava(id);
    if (n > 0) throw new GreskaKorisnika(`Takmičenje ima ${n} prijava i ne može se obrisati.`);
    baza.izvrsi('DELETE FROM takmicenja WHERE id = ?', [id]);
  }

  // Status za prikaz: aktivno ima prednost nad zavrsenim.
  function status(t, aktivnoId) {
    if (aktivnoId !== null && aktivnoId !== undefined && Number(t.id) === Number(aktivnoId)) return 'aktivno';
    return Number(t.zavrseno) === 1 ? 'zavrseno' : 'priprema';
  }

  return { POLJA, GRBOVI, sva, nadji, imaOcena, brojPrijava, prazno, proveri, sacuvaj, postaviGrb, sacuvajGrb, obrisi, status };
}

module.exports = { POLJA, GRBOVI, napravi };
