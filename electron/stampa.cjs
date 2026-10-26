// Stampa i PDF aktivnog prozora (POPIS 7). Zavisnosti su ubrizgane radi testa.
const path = require('node:path');
const { GreskaKorisnika } = require('./greska.cjs');

// Ime fajla bez znakova koji nisu dozvoljeni u Windows-u; uvek zavrsava na .pdf.
function cistoIme(ime) {
  let s = String(ime ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (s.toLowerCase().endsWith('.pdf')) s = s.slice(0, -4).replace(/[. ]+$/, '');
  return `${s || 'Stampa'}.pdf`;
}

function napravi({ prozor, dialog, fs, dokumenti }) {
  const opcijeStrane = (polozeno) => ({ landscape: !!polozeno, pageSize: 'A4', margins: { marginType: 'none' } });
  const sadrzaj = () => {
    const w = prozor();
    if (!w || !w.webContents) throw new GreskaKorisnika('Prozor nije dostupan.');
    return w.webContents;
  };

  return {
    // Sistemski dijalog za stampu; otkazan dijalog nije greska ({ok: false, otkazano: true}).
    async stampaj(ulaz) {
      const wc = sadrzaj();
      const polozeno = !!ulaz?.polozeno;
      return new Promise((resolve, reject) => {
        try {
          wc.print({ silent: false, printBackground: true, ...opcijeStrane(polozeno) }, (uspeh, razlog) => {
            if (uspeh) resolve({ ok: true });
            else if (/cancel/i.test(String(razlog))) resolve({ ok: false, otkazano: true });
            else reject(new GreskaKorisnika(`Štampa nije uspela: ${razlog}`));
          });
        } catch (err) {
          reject(new GreskaKorisnika(`Štampa nije uspela: ${err.message}`));
        }
      });
    },
    // PDF: dijalog za cuvanje (otkazan -> null), pa printToPDF i upis fajla.
    async pdf(ulaz) {
      const w = prozor();
      const wc = sadrzaj();
      const polozeno = !!ulaz?.polozeno;
      let izbor;
      try {
        izbor = await dialog.showSaveDialog(w, {
          defaultPath: path.join(dokumenti, cistoIme(ulaz?.ime)),
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
      } catch (err) {
        throw new GreskaKorisnika(`PDF nije sačuvan: ${err.message}`);
      }
      if (izbor.canceled || !izbor.filePath) return null;
      try {
        const podaci = await wc.printToPDF({ ...opcijeStrane(polozeno), printBackground: true });
        fs.writeFileSync(izbor.filePath, podaci);
      } catch (err) {
        throw new GreskaKorisnika(`PDF nije sačuvan: ${err.message}`);
      }
      return { putanja: izbor.filePath };
    },
  };
}

module.exports = { napravi, cistoIme };
