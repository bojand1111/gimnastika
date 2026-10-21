const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { verzija } = require('./sistem.cjs');
const { putanjaBaze } = require('./putanje.cjs');
const { otvori } = require('./baza/baza.cjs');
const dnevnik = require('./dnevnik.cjs');

let prozor = null;
let baza = null; // otvorena baza; modeli je dobijaju odavde

function log(tekst) {
  console.log(tekst);
  dnevnik.info(tekst);
}

// Debug: ispis teksta iz renderera (ceka da React iscrta naslov).
async function ispisiRenderer() {
  const tekst = await prozor.webContents.executeJavaScript(
    "new Promise(r => { let n = 0; const t = setInterval(() => { const x = document.body.innerText; if ((x.trim().length > 11 && x.trim() !== 'Gimnastika') || ++n > 30) { clearInterval(t); r(x); } }, 100); })");
  log(`Renderer: ${tekst}`);
}

function napraviProzor() {
  prozor = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1200,
    title: 'Gimnastika',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  prozor.setMenuBarVisibility(false);
  prozor.webContents.once('did-finish-load', () => {
    log(`Gimnastika ${verzija()}: prozor otvoren`);
    if (process.env.GIM_DEBUG === '1') ispisiRenderer();
  });
  if (process.env.VITE_DEV_URL) prozor.loadURL(process.env.VITE_DEV_URL);
  else prozor.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  prozor.on('closed', () => { prozor = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    log('Druga instanca: fokusiram postojeci prozor');
    if (!prozor) return;
    if (prozor.isMinimized()) prozor.restore();
    prozor.focus();
  });
  app.whenReady().then(() => {
    try {
      baza = otvori(putanjaBaze());
      const primenjene = baza.migriraj();
      log(`migracije: ${primenjene.length ? primenjene.join(', ') : 'nema novih'}`);
    } catch (err) {
      dnevnik.greska('baza i migracije', err);
      dialog.showErrorBox('Gimnastika', `Baza se ne moze otvoriti: ${err.message}`);
      app.exit(1);
      return;
    }
    ipcMain.handle('gim:sistem:verzija', () => verzija());
    napraviProzor();
  });
  app.on('window-all-closed', () => app.quit());
}
