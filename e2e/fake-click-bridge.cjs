// A stand-in for ClickBridge.exe (tools/click-bridge) speaking the same protocol, for the bridge tests: a PC with
// CLICK 3.71 installed (FAKE_CLICK={"installed":false} for none); run takes args.steps.length × 50 ms and stops
// at once on the urgent "stop".
const readline = require('node:readline');
const write = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
const state = process.env.FAKE_CLICK ? JSON.parse(process.env.FAKE_CLICK) : {};
const installed = state.installed !== false;
let stopped = false;
let started = false;

const commands = {
  ping: () => ({ pong: true }),
  detect: (_a, progress) => { progress('Looking for CLICK Programming Software…'); return installed ? { ready: true, installs: [{ name: 'CLICK Programming Software Ver. 3.71', version: '3.71', exe: 'C:\\AD\\CLICK.exe' }], running: false, steps: [] } : { ready: false, installs: [], running: false, steps: ['Install CLICK Programming Software from AutomationDirect (free download), then Check again.'] }; },
  start: () => { if (!installed) throw new Error('CLICK Programming Software is not installed on this PC.'); started = true; return { version: '3.71', processId: 4242, windows: ['CLICK Programming Software - [Untitled]'], attached: false }; },
  run: async (a, progress) => {
    if (!started) throw new Error('Open CLICK first.');
    stopped = false;
    for (let i = 0; i < a.steps.length; i++) {
      if (stopped) throw new Error(`Stopped at step ${i + 1}, as you asked. Nothing was saved.`);
      progress(`${i + 1}/${a.steps.length} ${a.steps[i].say ?? a.steps[i].do}`);
      await new Promise((r) => setTimeout(r, 50));
    }
    return { steps: a.steps.length };
  },
};

write({ ready: true, protocol: 1, version: 'fake' });
readline.createInterface({ input: process.stdin }).on('line', async (line) => {
  const req = JSON.parse(line);
  if (req.cmd === 'quit') { write({ id: req.id, ok: true, result: null }); process.exit(0); }
  if (req.cmd === 'stop') { stopped = true; write({ id: req.id, ok: true, result: { stopping: true } }); return; }
  const run = commands[req.cmd];
  if (!run) { write({ id: req.id, ok: false, error: `The bridge has no command "${req.cmd}" (update the app).` }); return; }
  try { write({ id: req.id, ok: true, result: await run(req.args ?? {}, (text) => write({ id: req.id, progress: text })) }); }
  catch (err) { write({ id: req.id, ok: false, error: err.message }); }
});
