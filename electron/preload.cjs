// Preload of the app window: the small, typed bridge the app uses in the desktop version
// (types in src/desktop/bridge.ts). No Node access reaches the page.
const { contextBridge, ipcRenderer } = require('electron');

// Modbus calls come back as { ok, value | error }; turn failures into plain Errors for the page.
const mb = async (op, ...args) => {
  const r = await ipcRenderer.invoke('isa:modbus', op, args);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

contextBridge.exposeInMainWorld('isaDesktop', {
  isDesktop: true,
  version: ipcRenderer.sendSync('isa:version'),
  print: (job) => ipcRenderer.invoke('isa:print', job),
  listPrinters: () => ipcRenderer.invoke('isa:list-printers'),
  saveFile: (name, bytes) => ipcRenderer.invoke('isa:save-file', name, bytes),
  writeFile: (filePath, bytes) => ipcRenderer.invoke('isa:write-file', filePath, bytes),
  // Microphone permission for voice input: 'always' | 'session' | 'ask'; reset forgets "Always allow".
  micPermission: {
    get: () => ipcRenderer.invoke('isa:mic-permission'),
    reset: () => ipcRenderer.invoke('isa:mic-permission-reset'),
  },
  // Returns an unsubscribe: a page that registers again (re-render) must not open one file twice.
  onOpenFile: (cb) => {
    const h = (_e, name, bytes, filePath) => cb(name, bytes, filePath);
    ipcRenderer.on('isa:open-file', h);
    return () => { ipcRenderer.removeListener('isa:open-file', h); };
  },
  // Closing the window waits for the page's last writes to IndexedDB (main.cjs, 'close').
  onFlushStorage: (flush) => {
    ipcRenderer.on('isa:flush-storage', async () => {
      try { await flush(); } finally { ipcRenderer.send('isa:storage-flushed'); }
    });
    ipcRenderer.send('isa:flush-ready');
  },
  // DWG import: GNU LibreDWG's dwg2dxf shipped with the installer, or another reader (electron/dwgReader.cjs)
  dwg: {
    status: () => ipcRenderer.invoke('isa:dwg-status'),
    configure: () => ipcRenderer.invoke('isa:dwg-configure'),
    clear: () => ipcRenderer.invoke('isa:dwg-clear'),
    read: (files) => ipcRenderer.invoke('isa:dwg-read', files),
  },
  // Send to TIA Portal (electron/tiaBridge.cjs): a bridge command → its result; failures as plain Errors.
  tia: {
    call: async (cmd, args) => { const r = await ipcRenderer.invoke('isa:tia', cmd, args); if (!r.ok) throw new Error(r.error); return r.value; },
    logPath: () => ipcRenderer.invoke('isa:tia-log'),
    onProgress: (cb) => {
      const h = (_e, p) => cb(p);
      ipcRenderer.on('isa:tia-progress', h);
      return () => ipcRenderer.removeListener('isa:tia-progress', h);
    },
  },
  // Send to CLICK (electron/clickBridge.cjs): the same shape as tia.
  click: {
    call: async (cmd, args) => { const r = await ipcRenderer.invoke('isa:click', cmd, args); if (!r.ok) throw new Error(r.error); return r.value; },
    logPath: () => ipcRenderer.invoke('isa:click-log'),
    showLog: () => ipcRenderer.invoke('isa:click-show-log'),
    onProgress: (cb) => {
      const h = (_e, p) => cb(p);
      ipcRenderer.on('isa:click-progress', h);
      return () => ipcRenderer.removeListener('isa:click-progress', h);
    },
  },
  // Send to CODESYS (electron/codesysBridge.cjs): the same shape, and the Open dialog for the user's project.
  codesys: {
    call: async (cmd, args) => { const r = await ipcRenderer.invoke('isa:codesys', cmd, args); if (!r.ok) throw new Error(r.error); return r.value; },
    logPath: () => ipcRenderer.invoke('isa:codesys-log'),
    showLog: () => ipcRenderer.invoke('isa:codesys-show-log'),
    pickProject: () => ipcRenderer.invoke('isa:codesys-pick'),
    onProgress: (cb) => {
      const h = (_e, p) => cb(p);
      ipcRenderer.on('isa:codesys-progress', h);
      return () => ipcRenderer.removeListener('isa:codesys-progress', h);
    },
  },
  // Send to Studio 5000 (electron/studio5000Bridge.cjs): the same shape as codesys.
  studio5000: {
    call: async (cmd, args) => { const r = await ipcRenderer.invoke('isa:studio5000', cmd, args); if (!r.ok) throw new Error(r.error); return r.value; },
    logPath: () => ipcRenderer.invoke('isa:studio5000-log'),
    showLog: () => ipcRenderer.invoke('isa:studio5000-show-log'),
    pickProject: () => ipcRenderer.invoke('isa:studio5000-pick'),
    onProgress: (cb) => {
      const h = (_e, p) => cb(p);
      ipcRenderer.on('isa:studio5000-progress', h);
      return () => ipcRenderer.removeListener('isa:studio5000-progress', h);
    },
  },
  modbus: {
    connect: async (o) => { const r = await ipcRenderer.invoke('isa:modbus', 'connect', [o]); return r.ok ? r.value : { ok: false, error: r.error }; },
    disconnect: () => mb('disconnect'),
    readCoils: (address, count) => mb('readCoils', address, count),
    readDiscreteInputs: (address, count) => mb('readDiscreteInputs', address, count),
    readHoldingRegisters: (address, count) => mb('readHoldingRegisters', address, count),
    readInputRegisters: (address, count) => mb('readInputRegisters', address, count),
    writeCoil: (address, value) => mb('writeCoil', address, value),
    writeRegister: (address, value) => mb('writeRegister', address, value),
    onStatus: (cb) => {
      const h = (_e, s) => cb(s);
      ipcRenderer.on('isa:modbus-status', h);
      return () => ipcRenderer.removeListener('isa:modbus-status', h);
    },
  },
});
