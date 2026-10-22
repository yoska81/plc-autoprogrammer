// Settings › Send from the web page: adds the ISA PLC Helper (electron/plcHelper.cjs) to the Claude desktop app's
// local MCP servers (claude_desktop_config.json, mcpServers.isa_plc_helper), or takes it out. Only on the user's
// press. Everything else in that file is kept as it is; a file the app cannot read is never overwritten; the first
// change keeps a copy of the file as it was (claude_desktop_config.json.isa-backup). Main process only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const NAME = 'isa_plc_helper';

/** The Claude desktop app's folder: %APPDATA%\Claude on Windows (~/Library/Application Support/Claude on a Mac). */
function claudeDir(env = process.env, platform = process.platform) {
  if (platform === 'win32') return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude');
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Claude');
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Claude');
}

/** The entry the Claude app starts the helper with: this app's exe, in Node mode, with the helper script. */
function helperEntry({ execPath, script }) {
  return { command: execPath, args: [script], env: { ELECTRON_RUN_AS_NODE: '1' } };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Reads the config; { config } or { error } when the file is there but is not JSON the app can change. */
function read(file) {
  if (!fs.existsSync(file)) return { config: {} };
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return { error: `The Claude app's settings could not be read (${e.message}).` }; }
  if (!text.trim()) return { config: {} };
  try {
    const config = JSON.parse(text);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
    if (config.mcpServers !== undefined && (typeof config.mcpServers !== 'object' || config.mcpServers === null || Array.isArray(config.mcpServers))) throw new Error('mcpServers is not an object');
    return { config };
  } catch {
    return { error: 'The Claude app\'s settings file is not in a form the app can change safely: nothing was changed. Fix or remove it in Claude (Settings › Developer), then try again.' };
  }
}

/**
 * Where things stand: the Claude app installed (its folder there), the helper in its settings, and whether that
 * entry is this installation's (else: an older or moved installation, Connect again).
 */
function status({ dir = claudeDir(), execPath, script }) {
  const file = path.join(dir, 'claude_desktop_config.json');
  const claude = fs.existsSync(dir);
  const r = read(file);
  if (r.error) return { claude, connected: false, current: false, file, error: r.error };
  const entry = r.config.mcpServers?.[NAME];
  return { claude, connected: Boolean(entry), current: Boolean(entry) && same(entry, helperEntry({ execPath, script })), file };
}

/** Connects (on) or disconnects (off); the new status. */
function set(on, { dir = claudeDir(), execPath, script }) {
  const file = path.join(dir, 'claude_desktop_config.json');
  if (!fs.existsSync(dir)) return { ...status({ dir, execPath, script }), error: 'The Claude desktop app is not installed on this PC: install it from claude.ai/download, then try again.' };
  const r = read(file);
  if (r.error) return { ...status({ dir, execPath, script }), error: r.error };
  const config = r.config;
  const servers = { ...(config.mcpServers ?? {}) };
  if (on) servers[NAME] = helperEntry({ execPath, script });
  else delete servers[NAME];
  const next = { ...config, mcpServers: servers };
  if (!same(next, config)) {
    const backup = `${file}.isa-backup`;
    if (fs.existsSync(file) && !fs.existsSync(backup)) fs.copyFileSync(file, backup);
    const tmp = `${file}.isa-tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
    fs.renameSync(tmp, file);
  }
  return status({ dir, execPath, script });
}

/** The helper's script in this installation (unpacked from app.asar), or in the repo during development. */
function helperScript(app, root) {
  return app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'plcHelper.cjs') : path.join(root, 'electron', 'plcHelper.cjs');
}

/** 'isa:claude-helper-status' and 'isa:claude-helper-set' (on: boolean); each change is written to plc-helper.log. */
function registerClaudeConfigIpc(ipcMain, app, root, log = (what) => {
  const file = path.join(app.getPath('logs'), 'plc-helper.log');
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, `${new Date().toISOString()} [app] ${what}\n`); } catch { /* no log */ }
}) {
  const where = () => ({ execPath: process.execPath, script: helperScript(app, root) });
  ipcMain.handle('isa:claude-helper-status', () => status(where()));
  ipcMain.handle('isa:claude-helper-set', (_e, on) => {
    const r = set(Boolean(on), where());
    log(`claude app settings: ${on ? 'connect' : 'disconnect'} the ISA PLC Helper → ${r.error ? `not changed: ${r.error}` : r.connected ? 'connected' : 'disconnected'}`);
    return r;
  });
}

module.exports = { claudeDir, helperEntry, status, set, registerClaudeConfigIpc, NAME };
