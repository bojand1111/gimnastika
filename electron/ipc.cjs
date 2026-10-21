// Registracija IPC kanala: gim:<modul>:<radnja>. Odgovor je uvek {ok, podaci} ili {ok:false, greska}.
const { GreskaKorisnika } = require('./greska.cjs');

const OPSTA_GRESKA = 'Greška u programu. Pogledajte dnevnik.log.';

function registruj(ipcMain, moduli, dnevnik) {
  for (const [modul, radnje] of Object.entries(moduli)) {
    for (const [radnja, fn] of Object.entries(radnje)) {
      const kanal = `gim:${modul}:${radnja}`;
      ipcMain.handle(kanal, async (ev, ...args) => {
        try {
          return { ok: true, podaci: await fn(...args) };
        } catch (err) {
          if (err instanceof GreskaKorisnika) return { ok: false, greska: err.message };
          dnevnik.greska(kanal, err);
          return { ok: false, greska: OPSTA_GRESKA };
        }
      });
    }
  }
}

module.exports = { registruj, OPSTA_GRESKA };
