// The ISA PLC Helper as the installed app has it, started the way the Claude desktop app starts it: the app's exe in
// Node mode with the unpacked helper script (CI on Windows, after electron-builder; no PLC software on the build
// server). It answers MCP, knows its version, finds the shipped bridges, and a TIA Portal detect job says what
// this PC lacks.
//   APP_DIR=release/win-unpacked node e2e/plcHelper.packaged.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const appDir = process.env.APP_DIR;
if (!appDir) { console.log('plcHelper.packaged: APP_DIR not set, skipped'); process.exit(0); }
const exe = path.join(appDir, 'ISA Auto Programmer.exe');
const script = path.join(appDir, 'resources', 'app.asar.unpacked', 'electron', 'plcHelper.cjs');
assert.ok(fs.existsSync(exe), exe);
assert.ok(fs.existsSync(script), `${script}: the helper is unpacked from app.asar`);
const logs = fs.mkdtempSync(path.join(os.tmpdir(), 'plc-helper-logs-'));
const version = require('../package.json').version;

(async () => {
  const p = spawn(exe, [script], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ISA_PLC_HELPER_LOGS: logs }, windowsHide: true });
  const answers = [];
  let buf = '';
  p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { answers.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  p.stderr.on('data', (d) => process.stderr.write(d));
  let id = 0;
  const ask = async (method, params) => {
    const me = ++id;
    p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: me, method, params })}\n`);
    for (const t0 = Date.now(); Date.now() - t0 < 30000;) {
      const a = answers.find((x) => x.id === me);
      if (a) return a;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`no answer to ${method}`);
  };
  const tool = async (name, args) => (await ask('tools/call', { name, arguments: args })).result.structuredContent;

  const init = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ci' } });
  assert.equal(init.result.serverInfo.version, version);
  const about = await tool('about', {});
  assert.equal(about.windows, true);
  const { job } = await tool('start', { software: 'tia', cmd: 'detect' });
  let s;
  for (const t0 = Date.now(); Date.now() - t0 < 60000;) {
    s = await tool('status', { job });
    if (s.state !== 'running') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(s.state, 'done', JSON.stringify(s));
  assert.equal(s.result.ready, false);
  p.stdin.end();
  await new Promise((r) => p.on('exit', r));
  assert.match(fs.readFileSync(path.join(logs, 'plc-helper.log'), 'utf8'), /started .* for ci/);
  console.log(`plcHelper.packaged: the installed helper ${version} answers, runs the shipped TIA bridge (no TIA Portal here: ${s.result.steps.length} steps), logs`);
})().catch((e) => { console.error(e); process.exit(1); });
