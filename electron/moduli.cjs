// Gradi IPC module iz modela. Ids iz renderera stizu kao tekst, pa se ovde pretvaraju u brojeve.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const klubovi = require('./modeli/klubovi.cjs');
const takmicari = require('./modeli/takmicari.cjs');
const sifarnici = require('./modeli/sifarnici.cjs');
const podesavanja = require('./modeli/podesavanja.cjs');

const broj = (id) => (id === null || id === undefined || id === '' ? null : Number(id));
const prazno = (v) => v === null || v === undefined || v === '';

function napraviModule(baza, { dialog, fasciklaPodataka, roditelj = () => null }) {
  const k = klubovi.napravi(baza);
  const t = takmicari.napravi(baza);
  const s = sifarnici.napravi(baza);
  const p = podesavanja.napravi(baza, fasciklaPodataka());

  // klub_id iz forme je tekst; prazan ostaje prazan (bez kluba).
  const takmicarUnos = (u) => (u && !prazno(u.klub_id) ? { ...u, klub_id: Number(u.klub_id) } : u);

  function grbUrl(vrednost) {
    if (!vrednost) return '';
    const fajl = path.join(fasciklaPodataka(), vrednost);
    // ?v= (vreme izmene) da Chromium ne prikazuje staru sliku posle zamene grba
    return fs.existsSync(fajl) ? `${pathToFileURL(fajl).href}?v=${Math.round(fs.statSync(fajl).mtimeMs)}` : '';
  }

  return {
    klubovi: {
      svi: () => k.svi(),
      nadji: (id) => k.nadji(broj(id)),
      sacuvaj: (u, id) => ({ id: k.sacuvaj(u, broj(id)) }),
      obrisi: (id) => k.obrisi(broj(id)),
    },
    takmicari: {
      svi: () => t.svi(),
      nadji: (id) => t.nadji(broj(id)),
      sacuvaj: (u, id) => ({ id: t.sacuvaj(takmicarUnos(u), broj(id)) }),
      obrisi: (id) => t.obrisi(broj(id)),
      sledeciIdBroj: () => t.sledeciIdBroj(),
    },
    sifarnici: {
      vrste: () => ({ vrste: sifarnici.VRSTE, ikone: sifarnici.IKONE }),
      lista: (vrsta) => s.lista(vrsta),
      dodaj: (vrsta, u) => {
        const id = s.dodaj(vrsta, u);
        return { id, stavka: s.nadji(vrsta, id) };
      },
      izmeni: (vrsta, id, u) => s.izmeni(vrsta, broj(id), u),
      obrisi: (vrsta, id) => s.obrisi(vrsta, broj(id)),
      redosled: (vrsta, ids) => s.redosled(vrsta, (ids || []).map(Number)),
    },
    podesavanja: {
      sva: () => {
        const sva = p.sva();
        return { ...sva, grb_levo_url: grbUrl(sva.grb_levo), grb_desno_url: grbUrl(sva.grb_desno) };
      },
      sacuvajOpsta: (u) => p.sacuvajOpsta(u),
      izaberiGrb: async () => {
        const opcije = {
          properties: ['openFile'],
          filters: [{ name: 'Slike', extensions: ['png', 'jpg', 'jpeg', 'svg', 'gif'] }],
        };
        const prozor = roditelj();
        const r = prozor ? await dialog.showOpenDialog(prozor, opcije) : await dialog.showOpenDialog(opcije);
        return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
      },
      aktivno: () => p.aktivno(),
    },
  };
}

module.exports = { napraviModule };
