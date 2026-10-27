// IPC modul kopija: rezervna kopija, vracanje, fascikla (POPIS 3.2, 3.3, 6.4 do 6.6).
// Zavisnosti su ubrizgane radi testa: dialog, shell, roditelj (prozor), obavesti (posle vracanja).
const path = require('node:path');
const fs = require('node:fs');
const { GreskaKorisnika } = require('./greska.cjs');
const { velicinaPrikaz } = require('./racun/velicina.mjs');

const p2 = (n) => String(n).padStart(2, '0');
const datumLokalno = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const satMinut = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const vremeTekst = (d) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}. ${satMinut(d)}`;

// 'Y-m-d H:i:s' iz opisa kopije u 'd.m.Y. H:i'; neprepoznat oblik ostaje kakav jeste.
function opisVreme(v) {
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(String(v ?? ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}. ${m[4]}:${m[5]}` : String(v ?? '');
}

// kopija: model (modeli/kopija.cjs); verzija: tekst; bazaVerzija: () => tekst.
function napravi({ kopija, verzija, bazaVerzija, dialog, shell, roditelj = () => null, dnevnik, posleVracanja = () => {} }) {
  const VRSTE = kopija.VRSTE;

  async function dijalog(opcije) {
    const prozor = roditelj();
    const r = prozor ? await dialog.showOpenDialog(prozor, opcije) : await dialog.showOpenDialog(opcije);
    return r.canceled || !r.filePaths || r.filePaths.length === 0 ? null : r.filePaths[0];
  }

  function poslednjaTekst(lista) {
    if (lista.length === 0) return 'Još nema nijedne kopije.';
    const d = new Date(Number(lista[0].vreme));
    const kad = datumLokalno(d) === datumLokalno(new Date()) ? `danas u ${satMinut(d)}` : vremeTekst(d);
    return `Poslednja kopija: ${kad}.`;
  }

  // Putanje koje je izabrao korisnik u dijalogu; renderer ne moze da podmetne proizvoljnu putanju.
  let izabrane = new Set();

  // sta: ime iz liste ili {putanja} koju je vratio izaberiFajl.
  function putanjaIzvora(sta) {
    if (sta && typeof sta === 'object') {
      const putanja = typeof sta.putanja === 'string' ? sta.putanja : '';
      if (putanja === '') throw new GreskaKorisnika('Nevažeća putanja.');
      if (!izabrane.has(putanja)) throw new GreskaKorisnika('Nevažeće ime fajla.');
      const ext = path.extname(putanja).toLowerCase();
      let jeFajl = false;
      try { jeFajl = fs.statSync(putanja).isFile(); } catch { /* ne postoji */ }
      if (!jeFajl || (ext !== '.sqlite' && ext !== '.zip')) {
        throw new GreskaKorisnika(`Fajl ne postoji: ${path.basename(putanja)}`);
      }
      return putanja;
    }
    return kopija.putanja(String(sta ?? ''));
  }

  return {
    podaci() {
      const lista = kopija.lista();
      return {
        kopije: lista.map((k) => ({
          ime: k.ime,
          velicina: k.velicina,
          velicinaTekst: velicinaPrikaz(k.velicina),
          vreme: k.vreme,
          vremeTekst: vremeTekst(new Date(Number(k.vreme))),
          opis: k.opis,
          vrstaTekst: k.opis ? (VRSTE[k.opis.vrsta] ?? k.opis.vrsta ?? '') : '',
          format: k.opis ? k.opis.format : (k.ime.toLowerCase().endsWith('.zip') ? 'zip' : 'sqlite'),
        })),
        fascikla: kopija.fasciklaStanje(),
        verzija,
        bazaVerzija: bazaVerzija(),
        VRSTE: { ...VRSTE },
        poslednjaTekst: poslednjaTekst(lista),
      };
    },

    napravi() {
      const k = kopija.napravi('rucna');
      dnevnik.info(`Rucna kopija: ${k.ime}`);
      return { ime: k.ime, velicinaTekst: velicinaPrikaz(k.velicina) };
    },

    async izaberiFajl() {
      const f = await dijalog({
        properties: ['openFile'],
        filters: [{ name: 'Rezervne kopije', extensions: ['sqlite', 'zip'] }],
      });
      izabrane = new Set(f === null ? [] : [f]);
      return f;
    },

    async vrati(sta) {
      try {
        const putanja = putanjaIzvora(sta);
        const r = kopija.vrati(putanja);
        const redovi = r.redovi ? Object.values(r.redovi).reduce((a, b) => a + Number(b), 0) : null;
        dnevnik.info(`Vracena kopija ${r.ime}${redovi === null ? '' : ` (uvoz, ${redovi} redova)`}, stanje pre vracanja: ${r.sigurnosna}`);
        const izlaz = {
          ime: r.ime,
          verzija: r.opis.verzija,
          vreme: r.opis.vreme,
          sigurnosna: r.sigurnosna,
          uvoz: Boolean(r.uvoz),
          poruka: `Podaci su vraćeni iz ${r.ime} (verzija ${r.opis.verzija}, ${opisVreme(r.opis.vreme)}). Stanje pre vraćanja je sačuvano kao ${r.sigurnosna}.`,
        };
        // Greska u obavestavanju prozora ne sme da pretvori uspelo vracanje u gresku.
        try { posleVracanja(izlaz); } catch (e) { dnevnik.greska('obavestenje posle vracanja', e); }
        return izlaz;
      } catch (err) {
        if (err instanceof GreskaKorisnika) {
          dnevnik.greska('vracanje kopije', err);
          throw new GreskaKorisnika(`Vraćanje nije uspelo: ${err.message}`, { cause: err });
        }
        throw err;
      }
    },

    async izaberiFasciklu() {
      const f = await dijalog({ properties: ['openDirectory', 'createDirectory'] });
      return f === null ? null : { poruka: kopija.postaviFasciklu(f) };
    },

    podrazumevanaFascikla: () => ({ poruka: kopija.postaviFasciklu('') }),

    prikazi(ime) {
      shell.showItemInFolder(kopija.putanja(String(ime ?? '')));
      return { ok: true };
    },
  };
}

// Kopija pre migracija (POPIS 6.7): samo kad ima migracija na cekanju i baza vec ima tabele.
// napraviModel(baza) pravi model kopije. Vraca ime kopije ili null; greska se loguje i guta.
function kopijaPreMigracije(baza, napraviModel, dnevnik) {
  // tabele() mora pre naCekanju(): ono pravi tabelu migracije, pa prva instalacija ne bi bila prazna.
  const imaTabela = baza.tabele().length > 0;
  const naCekanju = baza.naCekanju().length;
  if (!imaTabela || naCekanju === 0) return null;
  try {
    if (!baza.tabele().includes('podesavanja')) {
      dnevnik.info('Kopija pre migracije preskocena: baza nema tabelu podesavanja');
      return null;
    }
    const k = napraviModel(baza).napravi('pre_migracije');
    dnevnik.info(`Kopija pre migracije: ${k.ime}`);
    return k.ime;
  } catch (err) {
    dnevnik.greska('kopija pre migracije', err);
    return null;
  }
}

module.exports = { napravi, kopijaPreMigracije };
