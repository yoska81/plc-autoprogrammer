// The ISA PLC Helper: "Send to PLC software" for the web page (the claude.ai artifact), where a page cannot start
// programs or reach this PC. It is a local MCP server (stdio, one JSON-RPC message per line) that the Claude desktop
// app starts; the page calls its tools as `host:isa_plc_helper` through the app (the artifact runtime's mcp
// capability). No port is opened: only the Claude app talks to it, and the app asks the user before the page may.
// It hosts the same four bridges as the desktop app, through the same client (tiaBridge.cjs), so the same rules
// hold: the bridges never save the user's files, Stop and the Pause key work, a download needs confirmed: true
// from the app's confirm screen.
//
// Run by the app's own exe in Node mode (one installer, updated with the app):
//   "ISA Auto Programmer.exe" <resources>\app.asar.unpacked\electron\plcHelper.cjs   with ELECTRON_RUN_AS_NODE=1
// ISA_PLC_HELPER_RESOURCES: the bridges' folder (default: the app's resources folder); ISA_PLC_HELPER_LOGS: the logs
// folder (default: the app's, %APPDATA%\ISA Auto Programmer\logs); ISA_<TOOL>_BRIDGE: another bridge (the tests).
//
// A bridge command can take minutes and the app waits on one tool call at a time, so the page runs one as a job:
// start → a job id at once; status (every second) → its progress lines, then the result or the error; stop asks
// the bridge to stop. Every tool call is logged (passwords masked) in plc-helper.log.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { createBridge, TIMEOUT_MS: TIA_TIMEOUTS } = require('./tiaBridge.cjs');
const { TIMEOUT_MS: CLICK_TIMEOUTS } = require('./clickBridge.cjs');
const { TIMEOUT_MS: CODESYS_TIMEOUTS } = require('./codesysBridge.cjs');
const { TIMEOUT_MS: STUDIO5000_TIMEOUTS } = require('./studio5000Bridge.cjs');

/** The app's version: package.json beside electron/ (development) or in app.asar (installed; this file is unpacked). */
const VERSION = (() => {
  for (const p of ['../package.json', '../../app.asar/package.json']) { try { return require(p).version; } catch { /* next */ } }
  return '0';
})();

/** The four bridges: where each exe is, its log, its words for the user, how long a command may take. */
const SOFTWARE = {
  tia: { dir: 'tia-bridge', exe: 'TiaBridge.exe', env: 'ISA_TIA_BRIDGE', log: 'tia-bridge.log', label: 'TIA Portal bridge', what: 'TIA Portal', timeouts: TIA_TIMEOUTS },
  click: { dir: 'click-bridge', exe: 'ClickBridge.exe', env: 'ISA_CLICK_BRIDGE', log: 'click-bridge.log', label: 'CLICK bridge', what: 'CLICK Programming Software', timeouts: CLICK_TIMEOUTS },
  codesys: { dir: 'codesys-bridge', exe: 'CodesysBridge.exe', env: 'ISA_CODESYS_BRIDGE', log: 'codesys-bridge.log', label: 'CODESYS bridge', what: 'CODESYS', timeouts: CODESYS_TIMEOUTS, pick: { title: 'Your CODESYS project', filter: 'CODESYS project (*.project)|*.project' } },
  studio5000: { dir: 'studio5000-bridge', exe: 'Studio5000Bridge.exe', env: 'ISA_STUDIO5000_BRIDGE', log: 'studio5000-bridge.log', label: 'Studio 5000 bridge', what: 'the Logix Designer SDK', timeouts: STUDIO5000_TIMEOUTS, pick: { title: 'Your Studio 5000 project', filter: 'Studio 5000 project (*.ACD)|*.ACD' } },
};
const NAMES = Object.keys(SOFTWARE);
/** Finished jobs are kept this long for the page's last status call. */
const KEEP_MS = 10 * 60000;

/** The helper. `io`: { input, output } streams (stdin / stdout); `pickFile(spec)` the Windows Open dialog (the tests' stand-in). */
function createHelper({ resourcesDir, logsDir, pickFile = windowsPick, openFolder = showInExplorer, now = Date.now } = {}) {
  const logFile = path.join(logsDir, 'plc-helper.log');
  const log = (what) => {
    const t = new Date(now());
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    const stamp = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}.${pad(t.getMilliseconds(), 3)}`;
    try { fs.mkdirSync(logsDir, { recursive: true }); fs.appendFileSync(logFile, `${stamp} ${what}\n`); } catch { /* no log */ }
  };
  const bridges = new Map();
  const jobs = new Map();
  let nextJob = 1;

  const exeOf = (s) => process.env[SOFTWARE[s].env] || (process.platform === 'win32' ? path.join(resourcesDir, SOFTWARE[s].dir, SOFTWARE[s].exe) : null);
  function bridgeOf(s) {
    if (!bridges.has(s)) {
      const d = SOFTWARE[s];
      bridges.set(s, createBridge({
        exe: exeOf(s), label: d.label, what: d.what, timeouts: d.timeouts, logFile: path.join(logsDir, d.log),
        onProgress: (_id, text) => { for (const j of jobs.values()) if (j.software === s && j.state === 'running' && j.bridged) j.progress.push(text); },
      }));
    }
    return bridges.get(s);
  }

  const software = (a) => {
    const s = String(a?.software ?? '');
    if (!NAMES.includes(s)) throw new Error(`The helper does not know "${s}": it sends to ${NAMES.join(', ')}.`);
    return s;
  };
  const forLog = (args) => JSON.stringify(args ?? {}, (k, v) => (/password/i.test(k) && v ? '***' : v));

  function forget() { for (const [id, j] of jobs) if (j.state !== 'running' && now() - j.ended > KEEP_MS) jobs.delete(id); }

  /** A bridge command as a job; pickProject is the helper's own (the Windows Open dialog). */
  function start(a) {
    const s = software(a);
    const cmd = String(a?.cmd ?? '');
    if (!cmd || cmd === 'quit') throw new Error(`"${cmd}" is not a command the page may send.`);
    if (!exeOf(s)) throw new Error(`Sending to ${SOFTWARE[s].what} needs Windows.`);
    forget();
    const id = nextJob++;
    const job = { id, software: s, cmd, state: 'running', progress: [], result: null, error: null, ended: 0, bridged: cmd !== 'pickProject' };
    jobs.set(id, job);
    const run = cmd === 'pickProject'
      ? (SOFTWARE[s].pick ? pickFile(SOFTWARE[s].pick) : Promise.reject(new Error(`${SOFTWARE[s].what} has no project to choose.`)))
      : bridgeOf(s).call(cmd, a?.args && typeof a.args === 'object' ? a.args : {});
    Promise.resolve(run).then(
      (r) => { job.state = 'done'; job.result = r ?? null; job.ended = now(); log(`job ${id} ${s} ${cmd} done`); },
      (e) => { job.state = 'failed'; job.error = e instanceof Error ? e.message : String(e); job.ended = now(); log(`job ${id} ${s} ${cmd} failed: ${job.error}`); },
    );
    return { job: id };
  }

  /** The job's progress since `from` (the page keeps its count), then its end. */
  function status(a) {
    const job = jobs.get(Number(a?.job));
    if (!job) throw new Error('That job is not known (the helper was restarted?): run it again.');
    const from = Math.max(0, Number(a?.from) || 0);
    return { job: job.id, state: job.state, progress: job.progress.slice(from), next: job.progress.length, result: job.result, error: job.error };
  }

  /** Stop: the bridge's own stop (it answers at once while a command runs). */
  async function stop(a) {
    const s = software(a);
    if (!bridges.has(s)) return { stopping: false };
    return bridgeOf(s).call('stop', {});
  }

  const TOOLS = [
    { name: 'about', description: 'The helper: its version and the PLC software it sends to.', readOnly: true, schema: { type: 'object', properties: {} }, run: () => ({ helper: 'ISA PLC Helper', version: VERSION, software: NAMES, windows: process.platform === 'win32', log: logFile }) },
    { name: 'start', description: 'Runs one command of a PLC software bridge (tia, click, codesys, studio5000) as a job, or pickProject (the Windows Open dialog). Returns the job id at once; read it with status.', readOnly: false,
      schema: { type: 'object', properties: { software: { type: 'string', enum: NAMES }, cmd: { type: 'string' }, args: { type: 'object' } }, required: ['software', 'cmd'] }, run: start },
    { name: 'status', description: 'A job\'s progress lines from `from` on, its state (running, done, failed), then its result or error.', readOnly: true,
      schema: { type: 'object', properties: { job: { type: 'number' }, from: { type: 'number' } }, required: ['job'] }, run: status },
    { name: 'stop', description: 'Stops what the bridge of that software is doing (nothing is saved).', readOnly: false,
      schema: { type: 'object', properties: { software: { type: 'string', enum: NAMES } }, required: ['software'] }, run: stop },
    { name: 'logPath', description: 'Where that software\'s bridge log is (to send it to support).', readOnly: true,
      schema: { type: 'object', properties: { software: { type: 'string', enum: NAMES } }, required: ['software'] }, run: (a) => ({ path: path.join(logsDir, SOFTWARE[software(a)].log) }) },
    { name: 'showLog', description: 'Shows that software\'s bridge log in Explorer.', readOnly: true,
      schema: { type: 'object', properties: { software: { type: 'string', enum: NAMES } }, required: ['software'] }, run: (a) => { openFolder(path.join(logsDir, SOFTWARE[software(a)].log)); return { shown: true }; } },
  ];

  /** One JSON-RPC message → its answer (null for a notification). */
  async function handle(m) {
    if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0') return null;
    const answer = (result) => (m.id === undefined ? null : { jsonrpc: '2.0', id: m.id, result });
    const fail = (code, message) => (m.id === undefined ? null : { jsonrpc: '2.0', id: m.id, error: { code, message } });
    switch (m.method) {
      case 'initialize':
        log(`started ${VERSION} for ${m.params?.clientInfo?.name ?? 'a client'} (protocol ${m.params?.protocolVersion ?? '?'})`);
        return answer({ protocolVersion: m.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'isa_plc_helper', title: 'ISA PLC Helper', version: VERSION } });
      case 'ping': return answer({});
      case 'tools/list':
        return answer({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.schema, annotations: { readOnlyHint: t.readOnly, destructiveHint: false, openWorldHint: false } })) });
      case 'tools/call': {
        const name = m.params?.name;
        const args = m.params?.arguments ?? {};
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) return fail(-32602, `Unknown tool: ${name}`);
        if (name !== 'status') log(`→ ${name} ${forLog(args)}`);
        try {
          const r = await tool.run(args);
          if (name !== 'status') log(`← ${name} ok`);
          return answer({ content: [{ type: 'text', text: JSON.stringify(r) }], structuredContent: r });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          log(`← ${name} failed: ${msg}`);
          return answer({ content: [{ type: 'text', text: msg }], isError: true });
        }
      }
      default:
        if (typeof m.method === 'string' && m.method.startsWith('notifications/')) return null;
        return fail(-32601, `Method not found: ${m.method}`);
    }
  }

  /** Serves MCP on these streams until the input ends; then the bridges stop. */
  function serve(input, output) {
    const rl = readline.createInterface({ input });
    rl.on('line', async (line) => {
      if (!line.trim()) return;
      let m;
      try { m = JSON.parse(line); } catch { output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`); return; }
      const r = await handle(m);
      if (r) output.write(`${JSON.stringify(r)}\n`);
    });
    rl.on('close', () => { log('the Claude app closed the helper'); close(); });
  }

  function close() { for (const b of bridges.values()) b.stop(); bridges.clear(); }

  return { handle, serve, close, logFile };
}

/** Windows' Open dialog through PowerShell (no window of ours); the chosen path, or null. */
function windowsPick({ title, filter }) {
  const q = (s) => s.replace(/'/g, "''");
  const script = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = '${q(title)}'; $d.Filter = '${q(filter)}'; if ($d.ShowDialog($f) -eq 'OK') { [Console]::Out.Write($d.FileName) }`;
  return new Promise((resolve, reject) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', () => reject(new Error('Windows could not show the Open dialog.')));
    p.on('exit', () => resolve(out.trim() || null));
  });
}

function showInExplorer(file) {
  const target = fs.existsSync(file) ? ['/select,', file] : [path.dirname(file)];
  spawn('explorer.exe', target, { detached: true, stdio: 'ignore' }).unref();
}

/** The app's folders, as the desktop app has them (app.getPath('logs') on Windows: %APPDATA%\<name>\logs). */
function defaultFolders() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  // <resources>\app.asar.unpacked\electron\plcHelper.cjs → <resources>
  const resources = path.resolve(__dirname, '..', '..');
  return {
    resourcesDir: process.env.ISA_PLC_HELPER_RESOURCES || resources,
    logsDir: process.env.ISA_PLC_HELPER_LOGS || path.join(appData, 'ISA Auto Programmer', 'logs'),
  };
}

if (require.main === module) {
  const helper = createHelper(defaultFolders());
  helper.serve(process.stdin, process.stdout);
}

module.exports = { createHelper, SOFTWARE };
