// Settings › Send from the web page (electron/claudeConfig.cjs): the ISA PLC Helper in the Claude desktop app's
// claude_desktop_config.json, in a temp folder: connect adds only our entry (the app's exe, Node mode, the helper
// script) and keeps everything else; a copy of the file as it was; disconnect takes only ours out; a file that is
// not JSON is never overwritten; no Claude app: said; another installation's entry: not current.
//   node e2e/claudeConfig.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { claudeDir, status, set } = require('../electron/claudeConfig.cjs');

let passed = 0;
const ok = (what) => { passed++; console.log('  ok ', what); };
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-cfg-'));
const dir = path.join(root, 'Claude');
const file = path.join(dir, 'claude_desktop_config.json');
const here = { dir, execPath: 'C:\\Programs\\ISA Auto Programmer\\ISA Auto Programmer.exe', script: 'C:\\Programs\\ISA Auto Programmer\\resources\\app.asar.unpacked\\electron\\plcHelper.cjs' };
const readJson = () => JSON.parse(fs.readFileSync(file, 'utf8'));

assert.equal(claudeDir({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32'), path.join('C:\\Users\\me\\AppData\\Roaming', 'Claude'));
ok('the Claude app\'s folder on Windows: %APPDATA%\\Claude');

let r = set(true, here);
assert.match(r.error, /The Claude desktop app is not installed on this PC/);
assert.equal(fs.existsSync(dir), false);
ok('no Claude app: said, nothing written');

fs.mkdirSync(dir);
assert.deepEqual(status(here), { claude: true, connected: false, current: false, file });
r = set(true, here);
assert.deepEqual([r.connected, r.current, r.error], [true, true, undefined]);
assert.deepEqual(readJson(), { mcpServers: { isa_plc_helper: { command: here.execPath, args: [here.script], env: { ELECTRON_RUN_AS_NODE: '1' } } } });
assert.equal(fs.existsSync(`${file}.isa-backup`), false);
ok('Claude app without settings yet: connect writes our entry (the app\'s exe in Node mode, the helper script)');

const theirs = { mcpServers: { filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:\\work'] } }, globalShortcut: 'Ctrl+Space' };
fs.writeFileSync(file, JSON.stringify(theirs, null, 2));
r = set(true, here);
assert.ok(r.connected && r.current);
assert.deepEqual(readJson().mcpServers.filesystem, theirs.mcpServers.filesystem);
assert.equal(readJson().globalShortcut, 'Ctrl+Space');
assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.isa-backup`, 'utf8')), theirs);
set(true, here);
assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.isa-backup`, 'utf8')), theirs, 'the first copy is kept');
assert.equal(fs.existsSync(`${file}.isa-tmp`), false);
ok('the user\'s own servers and settings are kept; a copy of the file as it was, once');

r = status({ ...here, execPath: 'D:\\Moved\\ISA Auto Programmer.exe' });
assert.deepEqual([r.connected, r.current], [true, false]);
ok('an entry from another installation: connected, not current (connect again)');

r = set(false, here);
assert.deepEqual([r.connected, r.current], [false, false]);
assert.deepEqual(readJson(), { ...theirs, mcpServers: { filesystem: theirs.mcpServers.filesystem } });
ok('disconnect takes out only our entry');

fs.writeFileSync(file, '{ "mcpServers": { oops');
r = set(true, here);
assert.match(r.error, /not in a form the app can change safely: nothing was changed/);
assert.equal(fs.readFileSync(file, 'utf8'), '{ "mcpServers": { oops');
fs.writeFileSync(file, '{ "mcpServers": [] }');
assert.match(set(true, here).error, /nothing was changed/);
assert.match(status(here).error, /nothing was changed/);
ok('a settings file that is not JSON (or mcpServers not an object) is never overwritten');

console.log(`claudeConfig.test: all passed (${passed})`);
