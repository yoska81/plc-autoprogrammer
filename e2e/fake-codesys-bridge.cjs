// A stand-in for CodesysBridge.exe (tools/codesys-bridge) speaking the same protocol, for the bridge client test:
// a PC with CODESYS 3.5.19.20; build takes 40 × 25 ms (progress each) and stops at once on the urgent "stop".
const readline = require('node:readline');
const write = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
let stopped = false;

const commands = {
  ping: () => ({ pong: true }),
  detect: (_a, progress) => { progress('Looking for CODESYS…'); return { ready: true, installs: [{ name: 'CODESYS V3.5 SP19 Patch 2', version: '3.5.19.20', exe: 'C:\\Program Files\\CODESYS 3.5.19.20\\CODESYS\\Common\\CODESYS.exe', profile: 'CODESYS V3.5 SP19 Patch 2' }], projectsDir: 'C:\\Users\\tech\\Documents\\ISA Auto Programmer\\CODESYS', steps: [] }; },
  build: async (a, progress) => {
    if (!Array.isArray(a.objects)) throw new Error('The app sent no program (generate it first).');
    stopped = false;
    for (let i = 0; i < 40; i++) {
      if (stopped) throw new Error('Stopped, as you asked: CODESYS was closed. Your own project was not changed.');
      progress(`Writing ${i + 1}`);
      await new Promise((r) => setTimeout(r, 25));
    }
    return { project: 'C:\\x\\Line_ISA.project', objects: a.objects.map((o) => ({ name: o.name, kind: o.kind, action: 'created' })), errors: 0, warnings: 0, messages: [], notes: [] };
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
