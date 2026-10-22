// Registracija IPC kanala: gim:<modul>:<radnja>. Odgovor je uvek {ok, podaci} ili {ok:false, greska}.
const { GreskaKorisnika, OPSTA_GRESKA } = require('./greska.cjs');
const { MODULI } = require('./api.cjs');

// spisak: ocekivani kanali (MODULI); nepoklapanje baca odmah pri startu.
function kanali(m) {
  return Object.entries(m).flatMap(([modul, r]) => (Array.isArray(r) ? r : Object.keys(r)).map((x) => `gim:${modul}:${x}`));
}

function proveri(moduli, spisak) {
  const ima = new Set(kanali(moduli)), treba = new Set(kanali(spisak));
  const fali = [...treba].filter((k) => !ima.has(k)), visak = [...ima].filter((k) => !treba.has(k));
  if (fali.length || visak.length) {
    throw new Error(`IPC: nepoklapanje sa MODULI. Bez handlera: ${fali.join(', ') || '-'}. Nije u MODULI: ${visak.join(', ') || '-'}.`);
  }
}

function registruj(ipcMain, moduli, dnevnik, spisak = MODULI) {
  proveri(moduli, spisak);
  for (const [modul, radnje] of Object.entries(moduli)) {
    for (const [radnja, fn] of Object.entries(radnje)) {
      const kanal = `gim:${modul}:${radnja}`;
      ipcMain.handle(kanal, async (ev, ...args) => {
        try {
          return { ok: true, podaci: await fn(...args) };
        } catch (err) {
          if (err instanceof GreskaKorisnika) {
            return err.greske ? { ok: false, greska: err.message, greske: err.greske } : { ok: false, greska: err.message };
          }
          dnevnik.greska(kanal, err);
          return { ok: false, greska: OPSTA_GRESKA };
        }
      });
    }
  }
}

module.exports = { registruj, OPSTA_GRESKA };
