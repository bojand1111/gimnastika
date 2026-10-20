// Most ka rendereru. Zadatak 3 ovo generalizuje.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gim', {
  sistem: { verzija: () => ipcRenderer.invoke('gim:sistem:verzija') },
});
