const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveFile: (payload) => ipcRenderer.invoke('save-file', payload),
  printDocument: (options) => ipcRenderer.invoke('print-document', options),
});
