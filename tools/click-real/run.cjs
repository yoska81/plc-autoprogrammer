// Send to CLICK in the real CLICK Programming Software (Windows build server, .github/workflows/click-real.yml): the
// bridge the installer ships (CLICK_BRIDGE_EXE), driven as the app drives it (electron/clickBridge.cjs): detect,
// start, the nickname file, the set-up plan, the rungs. The plans are the app's own (tools/click-real/plans.ts).
// Prints every progress line; exits 1 on a failure. The bridge's log is the run's record (printed by the workflow).
//   CLICK_BRIDGE_EXE=… node tools/click-real/run.cjs plans.json out-dir
const fs = require('node:fs');
const path = require('node:path');
const { createBridge } = require('../../electron/tiaBridge.cjs');

const [plansFile, outDir] = process.argv.slice(2);
const plans = JSON.parse(fs.readFileSync(plansFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

(async () => {
  const b = createBridge({
    exe: process.env.CLICK_BRIDGE_EXE, logFile: path.join(outDir, 'click-bridge.log'), label: 'CLICK bridge', what: 'CLICK Programming Software',
    onProgress: (_id, text) => console.log(`  ${at()} … ${text}`),
  });
  const step = async (name, fn) => {
    console.log(`${at()} ${name}`);
    try { const v = await fn(); console.log(`${at()} ${name}: ok ${JSON.stringify(v).slice(0, 300)}`); return v; }
    catch (err) { console.log(`${at()} ${name}: FAILED ${err.message}`); throw err; }
  };
  let failed = false;
  try {
    const d = await step('detect', () => b.call('detect'));
    if (!d.ready) throw new Error('CLICK Programming Software is not installed on the build server');
    await step('start', () => b.call('start'));
    const file = await step('writeFile', () => b.call('writeFile', { name: plans.csvName, text: plans.csvText }));
    const setup = JSON.parse(JSON.stringify(plans.setup).split(plans.csvPlaceholder).join(file.path.replace(/\\/g, '\\\\')));
    // A probe (tools/click-real/probe.json, while a step of CLICK is being learnt): after the new project, rounds of
    // steps, each followed by a record of every CLICK window (in the log) and seen in the screenshots.
    const probeFile = path.join(__dirname, 'probe.json');
    if (fs.existsSync(probeFile)) {
      const probe = JSON.parse(fs.readFileSync(probeFile, 'utf8'));
      const upTo = setup.findIndex((x) => x.what === 'the Address Picker');
      await step(`new project only (${upTo} steps), for the probe`, () => b.call('run', { steps: setup.slice(0, upTo) }));
      for (const [i, round] of probe.rounds.entries()) {
        await step(`probe round ${i + 1}: ${probe.why}`, () => b.call('run', { steps: round })).catch(() => undefined);
        await b.call('dump', { show: false }).catch(() => undefined);
      }
      throw new Error('probe done (remove tools/click-real/probe.json for the full run)');
    }
    await step(`set-up (${setup.length} steps: new project ${plans.cpu}, nicknames)`, () => b.call('run', { steps: setup }));
    await step(`rungs (${plans.rungs.length} steps, ${plans.entered} rungs; ${plans.leftForYou} left for the user)`, () => b.call('run', { steps: plans.rungs }));
    console.log(`${at()} ALL DONE: the example project is in CLICK`);
  } catch {
    failed = true;
    try { await b.call('dump', { show: false }); } catch { /* the windows are in the log already */ }
  } finally {
    b.stop();
  }
  setTimeout(() => process.exit(failed ? 1 : 0), 500);
})();
