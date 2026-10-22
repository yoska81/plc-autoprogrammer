// The ISA PLC Helper (electron/plcHelper.cjs), the local MCP server the Claude app starts for the web page, against
// the fake bridges: MCP (initialize, tools/list with read-only marks, tools/call), a bridge command as a job
// (progress, result, a bridge error in its words), Stop while a build runs, what the page may not send, the
// Open dialog for a project, the log (every call, no password), and the real thing over stdio.
//   node e2e/plcHelper.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHelper } = require('../electron/plcHelper.cjs');

let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plc-helper-'));
process.env.ISA_TIA_BRIDGE = path.join(__dirname, 'fake-tia-bridge.cjs');
process.env.ISA_CODESYS_BRIDGE = path.join(__dirname, 'fake-codesys-bridge.cjs');
process.env.ISA_STUDIO5000_BRIDGE = path.join(__dirname, 'fake-studio5000-bridge.cjs');
process.env.ISA_CLICK_BRIDGE = path.join(__dirname, 'fake-click-bridge.cjs');

(async () => {
  const picked = [];
  const shown = [];
  const helper = createHelper({ resourcesDir: dir, logsDir: dir, pickFile: async (spec) => { picked.push(spec); return 'C:\\Projects\\Line 1.ACD'; }, openFolder: (f) => shown.push(f) });
  let id = 1;
  const rpc = (method, params) => helper.handle({ jsonrpc: '2.0', id: id++, method, params });
  const call = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;
  const data = async (name, args) => { const r = await call(name, args); assert.ok(!r.isError, r.content?.[0]?.text); return r.structuredContent; };
  const until = async (job) => {
    const lines = [];
    for (let from = 0, t0 = Date.now(); Date.now() - t0 < 10000;) {
      const s = await data('status', { job, from });
      lines.push(...s.progress); from = s.next;
      if (s.state !== 'running') return { ...s, lines };
      await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error('job did not end');
  };

  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-desktop' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'isa_plc_helper');
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal(await helper.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.deepEqual((await rpc('ping')).result, {});
  assert.equal((await rpc('resources/list')).error.code, -32601);
  ok('MCP: initialize (the client\'s protocol version), notifications, ping, unknown methods');

  const tools = (await rpc('tools/list')).result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['about', 'start', 'status', 'stop', 'logPath', 'showLog']);
  const ro = Object.fromEntries(tools.map((t) => [t.name, t.annotations.readOnlyHint]));
  assert.deepEqual(ro, { about: true, start: false, status: true, stop: false, logPath: true, showLog: true });
  assert.deepEqual(tools.find((t) => t.name === 'start').inputSchema.properties.software.enum, ['tia', 'click', 'codesys', 'studio5000']);
  ok('tools/list: start and stop are not read-only (the Claude app may ask the user), the rest are');

  const about = await data('about');
  assert.deepEqual(about.software, ['tia', 'click', 'codesys', 'studio5000']);
  assert.equal(about.helper, 'ISA PLC Helper');
  ok('about: the helper, its version, what it sends to');

  let { job } = await data('start', { software: 'tia', cmd: 'detect' });
  let end = await until(job);
  assert.equal(end.state, 'done');
  assert.equal(end.result.ready, true);
  assert.deepEqual(end.lines, ['Looking for TIA Portal and TIA Openness…']);
  ok('a bridge command as a job: the id at once, its progress, then its result');

  ({ job } = await data('start', { software: 'tia', cmd: 'fails' }));
  end = await until(job);
  assert.equal(end.state, 'failed');
  assert.equal(end.error, 'Open TIA Portal first.');
  ok('a bridge error: the job fails with the bridge\'s own sentence');

  ({ job } = await data('start', { software: 'codesys', cmd: 'build', args: { objects: [{ name: 'Main', kind: 'pou' }] } }));
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await data('stop', { software: 'codesys' }), { stopping: true });
  end = await until(job);
  assert.equal(end.state, 'failed');
  assert.match(end.error, /^Stopped, as you asked/);
  assert.ok(end.lines.length > 0 && end.lines.length < 40, `${end.lines.length} lines`);
  assert.deepEqual(await data('stop', { software: 'studio5000' }), { stopping: false });
  ok('Stop while a build runs: the bridge stops at once, the job says so; Stop with nothing running: nothing');

  for (const [args, re] of [
    [{ software: 'tia', cmd: 'quit' }, /"quit" is not a command the page may send/],
    [{ software: 'tia', cmd: '' }, /is not a command/],
    [{ software: 'rslogix', cmd: 'detect' }, /does not know "rslogix": it sends to tia, click, codesys, studio5000/],
  ]) {
    const r = await call('start', args);
    assert.ok(r.isError && re.test(r.content[0].text), r.content[0].text);
  }
  const lost = await call('status', { job: 999 });
  assert.ok(lost.isError && /not known/.test(lost.content[0].text));
  assert.equal((await rpc('tools/call', { name: 'format', arguments: {} })).error.code, -32602);
  ok('refused: quitting a bridge, an empty command, unknown software, an unknown job, an unknown tool');

  ({ job } = await data('start', { software: 'studio5000', cmd: 'pickProject' }));
  end = await until(job);
  assert.equal(end.result, 'C:\\Projects\\Line 1.ACD');
  assert.deepEqual(picked, [{ title: 'Your Studio 5000 project', filter: 'Studio 5000 project (*.ACD)|*.ACD' }]);
  ({ job } = await data('start', { software: 'tia', cmd: 'pickProject' }));
  assert.match((await until(job)).error, /has no project to choose/);
  ok('pickProject: Windows\' Open dialog for the project (its path only), as the desktop app has it');

  assert.deepEqual(await data('logPath', { software: 'click' }), { path: path.join(dir, 'click-bridge.log') });
  await data('showLog', { software: 'codesys' });
  assert.deepEqual(shown, [path.join(dir, 'codesys-bridge.log')]);
  ({ job } = await data('start', { software: 'tia', cmd: 'download', args: { confirmed: true, password: 'hunter2' } }));
  await until(job);
  const text = fs.readFileSync(helper.logFile, 'utf8');
  assert.match(text, /started .* for claude-desktop \(protocol 2025-06-18\)/);
  assert.match(text, /→ start \{"software":"tia","cmd":"download","args":\{"confirmed":true,"password":"\*\*\*"\}\}/);
  assert.match(text, /job \d+ codesys build failed: Stopped, as you asked/);
  assert.ok(!text.includes('hunter2') && !/→ status/.test(text));
  ok('the log: every call and how each job ended, the password masked, status polls left out');
  helper.close();

  // The real thing: the helper as the Claude app starts it, MCP over stdin / stdout.
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'electron', 'plcHelper.cjs')], { env: { ...process.env, ISA_PLC_HELPER_LOGS: dir } });
  const answers = [];
  let buf = '';
  p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { answers.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = (m) => p.stdin.write(`${JSON.stringify(m)}\n`);
  const wait = async (n) => { for (let t0 = Date.now(); answers.length < n && Date.now() - t0 < 10000;) await new Promise((r) => setTimeout(r, 20)); };
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  p.stdin.write('not json\n');
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'start', arguments: { software: 'click', cmd: 'detect' } } });
  await wait(3);
  const byId = (i) => answers.find((x) => x.id === i);
  assert.equal(byId(1).result.serverInfo.name, 'isa_plc_helper');
  assert.equal(byId(null).error.code, -32700);
  const started = byId(2).result.structuredContent.job;
  let s;
  for (let k = 3, t0 = Date.now(); Date.now() - t0 < 10000; k++) {
    send({ jsonrpc: '2.0', id: k, method: 'tools/call', params: { name: 'status', arguments: { job: started } } });
    await wait(k + 1);
    s = byId(k).result.structuredContent;
    if (s.state !== 'running') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(s.state, 'done');
  p.stdin.end();
  const code = await new Promise((r) => p.on('exit', r));
  assert.equal(code, 0);
  ok('over stdio: one JSON-RPC message per line, a parse error answered, a CLICK job, it ends when the app closes it');

  console.log(`plcHelper.test: all passed (${passed})`);
})().catch((e) => { console.error(e); process.exit(1); });
