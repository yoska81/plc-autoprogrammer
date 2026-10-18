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
