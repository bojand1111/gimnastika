// Most ka rendereru: window.gim se gradi iz spiska MODULI.
const { contextBridge, ipcRenderer } = require('electron');
const { MODULI } = require('./api.cjs');

const gim = {};
for (const [modul, radnje] of Object.entries(MODULI)) {
  gim[modul] = {};
  for (const radnja of radnje) {
    gim[modul][radnja] = (...args) => ipcRenderer.invoke(`gim:${modul}:${radnja}`, ...args);
  }
}

// Jedini kanal main -> renderer: stanje azuriranja (vraca funkciju za odjavu).
gim.azuriranje.naStanje = (cb) => {
  const slusalac = (_ev, stanje) => cb(stanje);
  ipcRenderer.on('gim:azuriranje:stanje', slusalac);
  return () => ipcRenderer.removeListener('gim:azuriranje:stanje', slusalac);
};

// Main -> renderer: podaci su vraceni iz kopije (renderer ponovo ucitava ekran).
gim.kopija.naVraceni = (cb) => {
  const slusalac = (_ev, podaci) => cb(podaci);
  ipcRenderer.on('gim:kopija:vraceni', slusalac);
  return () => ipcRenderer.removeListener('gim:kopija:vraceni', slusalac);
};

contextBridge.exposeInMainWorld('gim', gim);
