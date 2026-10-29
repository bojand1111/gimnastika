// Electron (Chromium) pravi PDF iz HTML-a: probne prijave kao prave tabele sa okvirima.
// Pravi tests/fajlovi/prijava-partizan.pdf i prijava-duga.pdf. Pokretanje iz korena repoa:
//   node_modules/.bin/electron alati/probni-fajlovi/pdf-iz-html.cjs tests/fajlovi
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const cilj = path.resolve(process.argv[process.argv.length - 1]);

const stil = `<style>body{font-family:Arial;font-size:11pt} table{border-collapse:collapse;margin:8pt 0}
td,th{border:1px solid #000;padding:2pt 5pt;vertical-align:top} th{font-weight:bold;text-align:center}</style>`;

const partizan = `<p>I KOLO PGL VOJVODINE MSG A, B i C</p><p><b>DEFINITIVNA I IMENIČNA PRIJAVA</b></p>
<table><tr><td>Klub</td><td>G.D.“PARTIZAN –ŽELJEZNIČAR“</td></tr><tr><td>Kontakt osoba</td><td>Robert M.</td></tr></table>
<table><tr><th>#</th><th>PREZIME</th><th>IME</th><th>KATEGORIJA</th><th>DATUM<br>ROĐENJA</th><th>FUNKCIJA-EKIPA</th></tr>
<tr><td>1.</td><td>Neorčić</td><td>Noah</td><td>I “B”</td><td>12.02.2017.</td><td>pojedinac</td></tr>
<tr><td>2.</td><td>Herceg</td><td>Aron</td><td>IV “A”</td><td>25.04.2012..</td><td>ekipa</td></tr>
<tr><td>3.</td><td>Laudis Nanaši</td><td>Dragan</td><td>IV “A”</td><td>14.11.2012.</td><td></td></tr>
<tr><td>4.</td><td></td><td></td><td></td><td></td><td></td></tr></table>
<p>Odgovorno lice: ______________</p>`;

// Header centriran vertikalno (DATUM ROĐENJA u dva reda, ostalo na sredini), prazna kategorija,
// i tabela koja prelazi na drugu stranu sa ponovljenim zaglavljem.
let redovi = '';
for (let i = 1; i <= 45; i++) {
  redovi += `<tr><td>${i}.</td><td>Prezimić${i}</td><td>Ime${i}</td><td>${i % 5 ? 'II “A”' : ''}</td><td>0${1 + (i % 9)}.03.2014.</td><td>${i % 2 ? 'ekipa' : 'pojedinac'}</td></tr>`;
}
const duga = `<p>Klub: GK Šabac</p><p>ŽSG prijava</p><table><thead><tr style="vertical-align:middle"><th style="vertical-align:middle">R.br.</th>
<th style="vertical-align:middle">PREZIME</th><th style="vertical-align:middle">IME</th><th style="vertical-align:middle">KATEGORIJA</th>
<th style="vertical-align:middle">DATUM<br>ROĐENJA</th><th style="vertical-align:middle">UČEŠĆE</th></tr></thead><tbody>${redovi}</tbody></table>`;

async function napravi(ime, telo) {
  const w = new BrowserWindow({ show: false });
  const html = path.join(cilj, ime + '.html');
  fs.writeFileSync(html, '<!doctype html><meta charset="utf-8">' + stil + telo);
  try {
    await w.loadFile(html);
  } finally {
    fs.unlinkSync(html);
  }
  const pdf = await w.webContents.printToPDF({ pageSize: 'A4' });
  fs.writeFileSync(path.join(cilj, ime), pdf);
  w.destroy();
}

app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  await napravi('prijava-partizan.pdf', partizan);
  await napravi('prijava-duga.pdf', duga);
  console.log('gotovo');
  app.quit();
}).catch((e) => {
  console.error(e);
  app.exit(1);
});
