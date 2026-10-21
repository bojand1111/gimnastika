// Opsta podesavanja (kljuc/vrednost). Bez kesa: svaki poziv cita tabelu (mala je, a nema zastarelih vrednosti).
const fs = require('node:fs');
const path = require('node:path');
const { GreskaKorisnika } = require('../greska.cjs');

const PODRAZUMEVANO = {
  aktivno_takmicenje: '',
  kopije_fascikla: '',
  lekarski_prag_dana: '30',
  e_zaokruzivanje: 'odseci',
  plasman_isti_rezultat: 'deli',
  viseboj_nepotpun: 'ulazi',
  lekarski_sprecava_prijavu: 'ne',
  grb_levo: '',
  grb_desno: '',
  organizator: '',
};

const IZBORI = {
  e_zaokruzivanje: ['odseci', 'zaokruzi'],
  plasman_isti_rezultat: ['deli', 'visa_e_pa_d'],
  viseboj_nepotpun: ['ulazi', 'ne_ulazi'],
  lekarski_sprecava_prijavu: ['ne', 'da'],
};

const GRBOVI = ['grb_levo', 'grb_desno'];
const EKSTENZIJE = ['png', 'jpg', 'jpeg', 'svg', 'gif'];

function napravi(baza, fasciklaPodataka) {
  function sva() {
    const rez = { ...PODRAZUMEVANO };
    for (const r of baza.svi('SELECT kljuc, vrednost FROM podesavanja')) rez[r.kljuc] = r.vrednost ?? '';
    return rez;
  }

  function daj(kljuc, podrazumevano = '') {
    const s = sva();
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

  function aktivnoTakmicenjeId() {
    const id = parseInt(daj('aktivno_takmicenje'), 10);
    return id > 0 ? id : null;
  }

  // Red iz takmicenja ili null (i kad id pokazuje na obrisano takmicenje).
  function aktivno() {
    const id = aktivnoTakmicenjeId();
    return id === null ? null : baza.jedan('SELECT * FROM takmicenja WHERE id = ?', [id]);
  }

  // POPIS 4.3: sve se proverava pre prvog upisa, pa losa slika ne ostavlja pola sacuvano.
  function sacuvajOpsta(p) {
    const upis = {};
    for (const [kljuc, dozvoljeno] of Object.entries(IZBORI)) {
      if (dozvoljeno.includes(p[kljuc])) upis[kljuc] = p[kljuc];
    }
    if (p.lekarski_prag_dana !== undefined) {
      const n = parseInt(p.lekarski_prag_dana, 10) || 0;
      upis.lekarski_prag_dana = String(Math.max(0, Math.min(365, n)));
    }
    if (p.organizator !== undefined) upis.organizator = String(p.organizator ?? '').trim();

    const kopije = [];
    for (const kljuc of GRBOVI) {
      const g = p[kljuc];
      if (g === undefined || g === null) continue;
      if (g.obrisi) {
        upis[kljuc] = '';
      } else if (g.putanja) {
        const ext = path.extname(String(g.putanja)).slice(1).toLowerCase();
        if (!EKSTENZIJE.includes(ext)) throw new GreskaKorisnika('Grb mora biti PNG, JPG, GIF ili SVG slika.');
        const rel = `grb/${kljuc}.${ext}`;
        if (!fs.existsSync(g.putanja)) throw new GreskaKorisnika('Izabrana slika više ne postoji.');
        kopije.push({ izvor: g.putanja, cilj: path.join(fasciklaPodataka, 'grb', `${kljuc}.${ext}`) });
        upis[kljuc] = rel;
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

  return { sva, daj, dajInt, postavi, aktivnoTakmicenjeId, aktivno, sacuvajOpsta };
}

module.exports = { PODRAZUMEVANO, napravi };
