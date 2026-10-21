const { app, BrowserWindow, Menu, ipcMain, dialog, session } = require('electron');
const path = require('node:path');
const { verzija } = require('./sistem.cjs');
const { putanjaBaze } = require('./putanje.cjs');
const { otvori } = require('./baza/baza.cjs');
const dnevnik = require('./dnevnik.cjs');
const { registruj } = require('./ipc.cjs');
const { createUpdater } = require('./updater.cjs');

let prozor = null;
let azuriranje = null;
let baza = null; // otvorena baza; modeli je dobijaju odavde

function log(tekst) {
  console.log(tekst);
  dnevnik.info(tekst);
}

// Profil Chromiuma ide u LocalAppData, da fascikla podataka ostane cista.
const lokalno = process.env.LOCALAPPDATA || path.join(app.getPath('appData'), '..', 'Local');
app.setPath('userData', path.join(lokalno, 'Gimnastika', 'profil'));

// Debug: ispis teksta iz renderera (ceka da React iscrta naslov).
async function ispisiRenderer() {
  const tekst = await prozor.webContents.executeJavaScript(
    "new Promise(r => { let n = 0; const t = setInterval(() => { const x = document.body.innerText; if ((x.trim().length > 11 && x.trim() !== 'Gimnastika') || ++n > 30) { clearInterval(t); r(x); } }, 100); })");
  console.log(`Renderer: ${tekst}`); // samo na stdout: vise redova
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
  // Bez menija nema ni podrazumevanih precica (Ctrl+W, Ctrl+R, F11...).
  Menu.setApplicationMenu(null);
  const wc = prozor.webContents;
  const adresa = process.env.VITE_DEV_URL || require('node:url').pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e, url) => { if (!url.startsWith(adresa.split('#')[0])) e.preventDefault(); });
  session.defaultSession.setPermissionRequestHandler((_wc, _dozvola, cb) => cb(false));
  if (process.env.GIM_DEBUG === '1') {
    wc.on('before-input-event', (e, ulaz) => {
      if (ulaz.type === 'keyDown' && ulaz.control && ulaz.shift && ulaz.key.toLowerCase() === 'i') wc.toggleDevTools();
    });
  }
  prozor.webContents.once('did-finish-load', () => {
    log(`Gimnastika ${verzija()}: prozor otvoren`);
    if (process.env.GIM_DEBUG === '1') ispisiRenderer();
    // Tiha provera 5 s posle ucitavanja, samo u instaliranom programu.
    if (app.isPackaged) setTimeout(() => azuriranje.check().catch((err) => dnevnik.greska('tiha provera', err)), 5000);
  });
  // GIM_EKRAN=sistem otvara #/sistem (za proveru ekrana).
  const hash = process.env.GIM_EKRAN ? '/' + process.env.GIM_EKRAN : '';
  if (process.env.VITE_DEV_URL) prozor.loadURL(process.env.VITE_DEV_URL + (hash ? '#' + hash : ''));
  else prozor.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), hash ? { hash } : undefined);
  prozor.on('closed', () => { prozor = null; });
}

function pokreni() {
  try {
    baza = otvori(putanjaBaze());
    const primenjene = baza.migriraj();
    log(`migracije: ${primenjene.length ? primenjene.join(', ') : 'nema novih'}`);
  } catch (err) {
    dnevnik.greska('baza i migracije', err);
    dialog.showErrorBox('Gimnastika', `Baza se ne može otvoriti: ${err.message}`);
    app.exit(1);
    return;
  }
  // Dokaz da require(esm) radi u Electronu: racunanje se ucitava iz main procesa.
  const { konacnaE } = require('./racun/ocena.mjs');
  log(`racun: konacnaE([8300,8100,8400,8200]) = ${konacnaE([8300, 8100, 8400, 8200], 'odbaci_krajnje')}`);
  azuriranje = createUpdater({
    app,
    send: (stanje) => { if (prozor && !prozor.isDestroyed()) prozor.webContents.send('gim:azuriranje:stanje', stanje); },
    dnevnik,
    // Faza 7: ovde kopija baze vrste pre_azuriranja.
    preInstalacije: () => dnevnik.info(`Azuriranje: instalacija verzije ${azuriranje.status().verzija}`),
  });
  registruj(ipcMain, {
    sistem: { verzija },
    azuriranje: {
      stanje: () => azuriranje.status(),
      proveri: () => azuriranje.check(),
      preuzmi: () => azuriranje.download(),
      instaliraj: () => azuriranje.install(),
    },
  }, dnevnik);
  napraviProzor();
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
      pokreni();
    } catch (err) {
      dnevnik.greska('pokretanje', err);
      dialog.showErrorBox('Gimnastika', `Program se ne može pokrenuti: ${err.message}`);
      app.exit(1);
    }
  });
  // Baza se zatvara pre izlaza (i pre quitAndInstall), da WAL ne ostane na disku.
  app.on('will-quit', () => {
    try { if (baza) baza.zatvori(); } catch (err) { dnevnik.greska('zatvaranje baze', err); }
    baza = null;
  });
  app.on('window-all-closed', () => app.quit());
}
