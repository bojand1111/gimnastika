// Opsta podesavanja (kljuc/vrednost). Bez kesa: svaki poziv cita tabelu (mala je, a nema zastarelih vrednosti).
const fs = require('node:fs');
const path = require('node:path');
const { GreskaKorisnika } = require('../greska.cjs');

const PODRAZUMEVANO = {
  aktivni_pol: 'M',
  aktivno_takmicenje_M: '',
  aktivno_takmicenje_Z: '',
  kopije_fascikla: '',
  lekarski_prag_dana: '30',
  e_zaokruzivanje: 'odseci',
  plasman_isti_rezultat: 'deli',
  viseboj_nepotpun: 'ulazi',
  lekarski_sprecava_prijavu: 'ne',
  grb_levo: '',
  grb_desno: '',
  organizator: '',
  sajt_url: '',
  sajt_token: '',
};

const IZBORI = {
  e_zaokruzivanje: ['odseci', 'zaokruzi'],
  plasman_isti_rezultat: ['deli', 'visa_e_pa_d'],
  viseboj_nepotpun: ['ulazi', 'ne_ulazi'],
  lekarski_sprecava_prijavu: ['ne', 'da'],
};

// Podesavanja koja vaze posebno za MSG ('M') i ZSG ('Z'); cuvaju se kao <kljuc>_<pol>, a stari kljuc bez nastavka se nasledjuje.
const POLNI_KLJUCEVI = ['e_zaokruzivanje', 'plasman_isti_rezultat', 'viseboj_nepotpun', 'lekarski_sprecava_prijavu', 'organizator', 'grb_levo', 'grb_desno'];
const POLOVI = ['M', 'Z'];
const GRBOVI = ['grb_levo', 'grb_desno'];
const EKSTENZIJE = ['png', 'jpg', 'jpeg', 'svg', 'gif'];

const LOKALNI = ['localhost', '127.0.0.1', '[::1]'];

// https je obavezan (token putuje u zaglavlju); http samo za probni server na istom racunaru.
function proveriAdresuSajta(adresa) {
  let u;
  try {
    u = new URL(adresa);
  } catch {
    throw new GreskaKorisnika('Adresa sajta mora da počinje sa https:// (http:// samo za localhost).');
  }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOKALNI.includes(u.hostname))) {
    throw new GreskaKorisnika('Adresa sajta mora da počinje sa https:// (http:// samo za localhost).');
  }
  if (u.username !== '' || u.password !== '' || u.search !== '' || u.hash !== '' || adresa.includes('?') || adresa.includes('#')) {
    throw new GreskaKorisnika('Adresa sajta ne sme da sadrži korisničko ime, lozinku ni upit.');
  }
}

function napravi(baza, fasciklaPodataka) {
  function sirova() {
    const rez = { ...PODRAZUMEVANO };
    for (const r of baza.svi('SELECT kljuc, vrednost FROM podesavanja')) rez[r.kljuc] = r.vrednost ?? '';
    return rez;
  }

  // Nepoznat ili prazan pol je 'M' (kljuc aktivni_pol postoji tek kad je nesto podeljeno ili izabrano).
  function aktivniPol() {
    const v = sirova().aktivni_pol;
    return POLOVI.includes(v) ? v : 'M';
  }

  function postaviPol(pol) {
    if (!POLOVI.includes(pol)) throw new GreskaKorisnika('Nepoznat pol.');
    postavi('aktivni_pol', pol);
  }

  // Vrednost za pol: <kljuc>_<pol>, pa stari <kljuc>, pa PODRAZUMEVANO, pa podrazumevano.
  function dajPol(kljuc, pol, podrazumevano = '') {
    const s = sirova();
    const polni = `${kljuc}_${pol}`;
    if (Object.prototype.hasOwnProperty.call(s, polni)) return s[polni];
    return Object.prototype.hasOwnProperty.call(s, kljuc) ? s[kljuc] : podrazumevano;
  }

  // Polna podesavanja dolaze pod obicnim imenom za trazeni pol, uz polje pol.
  function sva(pol = aktivniPol()) {
    const rez = sirova();
    for (const k of POLNI_KLJUCEVI) rez[k] = dajPol(k, pol);
    rez.pol = pol;
    return rez;
  }

  function daj(kljuc, podrazumevano = '') {
    const s = sirova();
    return Object.prototype.hasOwnProperty.call(s, kljuc) ? s[kljuc] : podrazumevano;
  }

  function dajInt(kljuc, podrazumevano = 0) {
    const v = daj(kljuc, '');
    return v === '' ? podrazumevano : (parseInt(v, 10) || 0);
  }

  function postavi(kljuc, vrednost) {
    baza.izvrsi(
      'INSERT INTO podesavanja (kljuc, vrednost) VALUES (?, ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost',
      [kljuc, String(vrednost)]);
  }

  function aktivnoTakmicenjeId(pol = aktivniPol()) {
    const id = parseInt(daj(`aktivno_takmicenje_${pol}`), 10);
    return id > 0 ? id : null;
  }

  // Red iz takmicenja ili null (i kad id pokazuje na obrisano takmicenje ili takmicenje drugog pola).
  function aktivno(pol = aktivniPol()) {
    const id = aktivnoTakmicenjeId(pol);
    if (id === null) return null;
    const red = baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [id]);
    return red !== null && red.pol === pol ? red : null;
  }

  // id = null brise aktivno takmicenje tog pola.
  function postaviAktivno(id, pol) {
    if (!POLOVI.includes(pol)) throw new GreskaKorisnika('Nepoznat pol.');
    postavi(`aktivno_takmicenje_${pol}`, id === null ? '' : String(id));
  }

  // POPIS 4.3: sve se proverava pre prvog upisa, pa losa slika ne ostavlja pola sacuvano.
  function sacuvajOpsta(p, pol = aktivniPol()) {
    if (!POLOVI.includes(pol)) throw new GreskaKorisnika('Nepoznat pol.');
    const upis = {};
    for (const [kljuc, dozvoljeno] of Object.entries(IZBORI)) {
      if (dozvoljeno.includes(p[kljuc])) upis[`${kljuc}_${pol}`] = p[kljuc];
    }
    if (p.lekarski_prag_dana !== undefined) {
      const n = parseInt(p.lekarski_prag_dana, 10) || 0;
      upis.lekarski_prag_dana = String(Math.max(0, Math.min(365, n)));
    }
    if (p.organizator !== undefined) upis[`organizator_${pol}`] = String(p.organizator ?? '').trim();
    // Rezultati uzivo (SPEC8 5): prazna adresa gasi slanje; inace mora biti http(s); zavrsna kosa crta se skida.
    if (p.sajt_url !== undefined) {
      const adresa = String(p.sajt_url ?? '').trim();
      if (adresa !== '') proveriAdresuSajta(adresa);
      upis.sajt_url = adresa.replace(/\/+$/, '');
    }
    if (p.sajt_token !== undefined) upis.sajt_token = String(p.sajt_token ?? '').trim();

    const kopije = [];
    for (const kljuc of GRBOVI) {
      const g = p[kljuc];
      if (g === undefined || g === null) continue;
      if (g.obrisi) {
        upis[`${kljuc}_${pol}`] = '';
      } else if (g.putanja) {
        const ext = path.extname(String(g.putanja)).slice(1).toLowerCase();
        if (!EKSTENZIJE.includes(ext)) throw new GreskaKorisnika('Grb mora biti PNG, JPG, GIF ili SVG slika.');
        const rel = `grb/${kljuc}_${pol}.${ext}`;
        if (!fs.existsSync(g.putanja)) throw new GreskaKorisnika('Izabrana slika više ne postoji.');
        kopije.push({ izvor: g.putanja, cilj: path.join(fasciklaPodataka, 'grb', `${kljuc}_${pol}.${ext}`) });
        upis[`${kljuc}_${pol}`] = rel;
      }
    }

    for (const k of kopije) {
      if (path.resolve(k.izvor) === path.resolve(k.cilj)) continue; // vec je to sacuvani fajl
      fs.mkdirSync(path.dirname(k.cilj), { recursive: true });
      fs.copyFileSync(k.izvor, k.cilj);
    }
    baza.transakcija(() => {
      for (const [kljuc, vrednost] of Object.entries(upis)) postavi(kljuc, vrednost);
    });
  }

  return {
    POLNI_KLJUCEVI, sva, daj, dajPol, dajInt, postavi, aktivniPol, postaviPol,
    aktivnoTakmicenjeId, aktivno, postaviAktivno, sacuvajOpsta,
  };
}

module.exports = { PODRAZUMEVANO, POLNI_KLJUCEVI, napravi };
