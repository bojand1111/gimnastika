const { app, BrowserWindow, Menu, ipcMain, dialog, session, shell } = require('electron');
const path = require('node:path');
const { verzija } = require('./sistem.cjs');
const { putanjaBaze, fasciklaPodataka } = require('./putanje.cjs');
const { napraviModule, napraviKopijuModel } = require('./moduli.cjs');
const { kopijaPreMigracije } = require('./kopija-paket.cjs');
const { oporaviStaro } = require('./modeli/kopija.cjs');
const { otvori } = require('./baza/baza.cjs');
const { pocetniPodaci } = require('./baza/seme.cjs');
const { podeliPolove } = require('./baza/podela-polova.cjs');
const dnevnik = require('./dnevnik.cjs');
const { registruj } = require('./ipc.cjs');
const { createUpdater } = require('./updater.cjs');

let prozor = null;
let azuriranje = null;
let baza = null; // otvorena baza; modeli je dobijaju odavde
let kopija = null; // model rezervne kopije (pre azuriranja i za IPC)

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
    // Posle toga tiha provera na svakih 30 minuta dok je program otvoren.
    if (app.isPackaged) azuriranje.povremeno((err) => dnevnik.greska('povremena provera', err));
  });
  // GIM_EKRAN=sistem otvara #/sistem (za proveru ekrana).
  const hash = process.env.GIM_EKRAN ? '/' + process.env.GIM_EKRAN : '';
  if (process.env.VITE_DEV_URL) prozor.loadURL(process.env.VITE_DEV_URL + (hash ? '#' + hash : ''));
  else prozor.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), hash ? { hash } : undefined);
  prozor.on('closed', () => { prozor = null; });
}

function pokreni() {
  try {
    if (oporaviStaro(putanjaBaze())) log('Baza je vracena iz fajla .staro posle prekinutog vracanja kopije');
    baza = otvori(putanjaBaze());
    kopijaPreMigracije(baza, (b) => napraviKopijuModel(b, { fasciklaPodataka, dnevnik }), { info: log, greska: dnevnik.greska });
    const primenjene = baza.migriraj();
    log(`migracije: ${primenjene.length ? primenjene.join(', ') : 'nema novih'}`);
    const seme = pocetniPodaci(baza);
    if (seme.sprave || seme.podesavanja) log(`seme: sprave ${seme.sprave}, podesavanja ${seme.podesavanja}`);
    const podela = podeliPolove(baza);
    if (podela.takmicenja || podela.kategorije || podela.programi) {
      log(`podela polova: takmicenja ${podela.takmicenja} (podeljeno ${podela.podeljena}), kategorije ${podela.kategorije}, programi ${podela.programi}`);
    }
    kopija = napraviKopijuModel(baza, { fasciklaPodataka, dnevnik });
  } catch (err) {
    dnevnik.greska('baza i migracije', err);
    dialog.showErrorBox('Gimnastika', `Baza se ne može otvoriti: ${err.message}`);
    app.exit(1);
    return;
  }
  azuriranje = createUpdater({
    app,
    send: (stanje) => { if (prozor && !prozor.isDestroyed()) prozor.webContents.send('gim:azuriranje:stanje', stanje); },
    dnevnik,
    // Kopija pre_azuriranja; njena greska ne sme da zaustavi azuriranje.
    preInstalacije: () => {
      dnevnik.info(`Azuriranje: instalacija verzije ${azuriranje.status().verzija}`);
      try {
        const k = kopija.napravi('pre_azuriranja');
        log(`Kopija pre azuriranja: ${k.ime}`);
      } catch (err) {
        dnevnik.greska('kopija pre azuriranja', err);
      }
    },
  });
  let sinhro = null; // klijent sajta (rezultati uzivo), za proveru promena pri startu
  registruj(ipcMain, {
    ...napraviModule(baza, {
      dialog,
      shell,
      fasciklaPodataka,
      kopija,
      roditelj: () => BrowserWindow.getFocusedWindow() || prozor,
      dokumenti: app.getPath('documents'),
      sinhroSpreman: (s) => { sinhro = s; },
      // Posle vracanja renderer ponovo ucitava ekran i traku.
      obavesti: (podaci) => { if (prozor && !prozor.isDestroyed()) prozor.webContents.send('gim:kopija:vraceni', podaci); },
    }),
    sistem: { verzija },
    azuriranje: {
      stanje: () => azuriranje.status(),
      proveri: () => azuriranje.check(),
      preuzmi: () => azuriranje.download(),
      instaliraj: () => azuriranje.install(),
    },
  }, dnevnik);
  // Ako ima promena od poslednjeg slanja, posalji posle odlaganja (nista ako adresa ili token nisu uneti).
  try {
    if (sinhro && sinhro.imaPromena()) sinhro.zakazi();
  } catch (err) {
    dnevnik.greska('sinhro start', err);
  }
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
