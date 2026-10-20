const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { verzija } = require('./sistem.cjs');

let prozor = null;

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
    console.log(`Gimnastika ${verzija()}: prozor otvoren`);
  });
  if (process.env.VITE_DEV_URL) prozor.loadURL(process.env.VITE_DEV_URL);
  else prozor.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  prozor.on('closed', () => { prozor = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    console.log('Druga instanca: fokusiram postojeci prozor');
    if (!prozor) return;
    if (prozor.isMinimized()) prozor.restore();
    prozor.focus();
  });
  app.whenReady().then(() => {
    ipcMain.handle('gim:sistem:verzija', () => verzija());
    napraviProzor();
  });
  app.on('window-all-closed', () => app.quit());
}
