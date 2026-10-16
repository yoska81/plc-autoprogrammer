// Preload of the hidden print window: receives the PDF from the main process, reports back when drawn.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printBridge', {
  onPdf: (cb) => ipcRenderer.on('isa:print-pdf', (_e, job) => cb({ ...job, bytes: new Uint8Array(job.bytes) })),
  done: (result) => ipcRenderer.send('isa:print-rendered', result),
});
