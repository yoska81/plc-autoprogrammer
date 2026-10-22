// A stand-in for Studio5000Bridge.exe (tools/studio5000-bridge) speaking the same protocol, for the bridge client
// test: a PC with Logix Designer 36 and the SDK; import takes 40 × 25 ms (progress each) and stops at once on "stop".
const readline = require('node:readline');
const write = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
let stopped = false;

const commands = {
  ping: () => ({ pong: true }),
  detect: (_a, progress) => { progress('Looking for Studio 5000 and the Logix Designer SDK…'); return { ready: true, logix: [{ name: 'Studio 5000 Logix Designer v36', version: '36.00.02' }], sdk: 'C:\\Users\\Public\\Documents\\Studio 5000\\Logix Designer SDK', python: "the SDK's virtual environment", projectsDir: 'C:\\Users\\tech\\Documents\\ISA Auto Programmer\\Studio 5000', steps: [] }; },
  writeL5x: (a) => ({ path: `C:\\Users\\tech\\Documents\\ISA Auto Programmer\\Studio 5000\\${a.name}.L5X` }),
  import: async (a, progress) => {
    if (!a.acd) throw new Error('Choose your Studio 5000 project (.ACD) first.');
    stopped = false;
    for (let i = 0; i < 40; i++) {
      if (stopped) throw new Error('Stopped, as you asked. Your own Studio 5000 project was not changed.');
      progress(`Importing ${i + 1}`);
      await new Promise((r) => setTimeout(r, 25));
    }
    return { project: a.acd.replace(/\.ACD$/i, '_ISA.ACD'), imported: a.xpaths };
  },
};

write({ ready: true, protocol: 1, version: 'fake' });
readline.createInterface({ input: process.stdin }).on('line', async (line) => {
  const req = JSON.parse(line);
  if (req.cmd === 'quit') { write({ id: req.id, ok: true, result: null }); process.exit(0); }
  if (req.cmd === 'stop') { const was = !stopped; stopped = true; write({ id: req.id, ok: true, result: { stopping: was } }); return; }
  const run = commands[req.cmd];
  if (!run) { write({ id: req.id, ok: false, error: `The bridge has no command "${req.cmd}" (update the app).` }); return; }
  try { write({ id: req.id, ok: true, result: await run(req.args ?? {}, (text) => write({ id: req.id, progress: text })) }); }
  catch (err) { write({ id: req.id, ok: false, error: err.message }); }
});
