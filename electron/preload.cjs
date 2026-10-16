// Preload of the app window: the small, typed bridge the app uses in the desktop version
// (types in src/desktop/bridge.ts). No Node access reaches the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('isaDesktop', {
  isDesktop: true,
  version: ipcRenderer.sendSync('isa:version'),
  print: (job) => ipcRenderer.invoke('isa:print', job),
  listPrinters: () => ipcRenderer.invoke('isa:list-printers'),
  saveFile: (name, bytes) => ipcRenderer.invoke('isa:save-file', name, bytes),
});
