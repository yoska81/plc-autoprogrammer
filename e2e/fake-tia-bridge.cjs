// A stand-in for TiaBridge.exe (tools/tia-bridge) speaking the same protocol, for the bridge tests and the
// "Send to TIA Portal" e2e. Its PC is FAKE_TIA (JSON: { detect }) or a ready one with TIA Portal V19.
// Extra commands for the tests: slow (answers after args.ms), crash (exits), noisy (non-JSON on stdout first).
const readline = require('node:readline');
const fs = require('node:fs');

const log = (() => { const i = process.argv.indexOf('--log'); return i >= 0 ? process.argv[i + 1] : null; })();
const write = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
const note = (s) => { if (log) fs.appendFileSync(log, `${s}\n`); };
const state = process.env.FAKE_TIA ? JSON.parse(process.env.FAKE_TIA) : {};
const detect = state.detect ?? { ready: true, installed: ['V19'], openness: [{ version: 'V19', assemblyVersion: '19.0.0.0', dll: 'C:\\Program Files\\Siemens\\Automation\\Portal V19\\PublicAPI\\V19\\Siemens.Engineering.dll' }], inOpennessGroup: true, user: 'PC1\\tech', steps: [] };

const commands = {
  ping: () => ({ pong: true }),
  detect: (_a, progress) => { progress('Looking for TIA Portal and TIA Openness…'); return detect; },
  slow: (a) => new Promise((r) => setTimeout(() => r({ waited: a.ms }), a.ms)),
  fails: () => { throw new Error('Open TIA Portal first.'); },
  crash: () => { process.stderr.write('Unhandled exception: boom\n'); process.exit(3); },
};

write({ ready: true, protocol: 1, version: 'fake' });
note('fake bridge started');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let req;
  try { req = JSON.parse(line); } catch { write({ id: null, ok: false, error: 'The app sent a request the bridge could not read.' }); return; }
  note(`→ ${req.id} ${req.cmd}`);
  if (req.cmd === 'quit') { write({ id: req.id, ok: true, result: null }); process.exit(0); }
  if (req.cmd === 'noisy') process.stdout.write('some library printed this\n');
  const run = commands[req.cmd] ?? (req.cmd === 'noisy' ? () => ({ fine: true }) : null);
  if (!run) { write({ id: req.id, ok: false, error: `The bridge has no command "${req.cmd}" (update the app).` }); return; }
  try { write({ id: req.id, ok: true, result: await run(req.args ?? {}, (text) => write({ id: req.id, progress: text })) }); }
  catch (err) { write({ id: req.id, ok: false, error: err.message }); }
});
