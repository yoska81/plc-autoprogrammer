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
const { execFileSync } = require('node:child_process');
/** A screenshot of the whole screen now, into out/moments (named), for the moments that matter. */
const shot = (name) => {
  const file = path.join(outDir, 'moments', `${String(++shots).padStart(2, '0')}-${name}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ps = `Add-Type -AssemblyName System.Windows.Forms, System.Drawing; $b = [System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size); $bmp.Save('${file}', [System.Drawing.Imaging.ImageFormat]::Png)`;
  try { execFileSync('powershell', ['-NoProfile', '-Command', ps], { timeout: 30000 }); } catch (err) { console.log(`  (no screenshot: ${err.message.split('\n')[0]})`); }
};
let shots = 0;
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
      const upTo = probe.afterSetup ? setup.length : setup.findIndex((x) => x.what === 'the nickname import');
      await step(`set-up (${upTo} steps), for the probe`, () => b.call('run', { steps: setup.slice(0, upTo) }));
      for (const [i, round] of probe.rounds.entries()) {
        await step(`probe round ${i + 1}: ${probe.why}`, () => b.call('run', { steps: round })).catch(() => undefined);
        shot(`probe-${i + 1}`);
        await b.call('dump', { show: false }).catch(() => undefined);
      }
      throw new Error('probe done (remove tools/click-real/probe.json for the full run)');
    }
    await step(`set-up (${setup.length} steps: new project ${plans.cpu}, nicknames)`, () => b.call('run', { steps: setup }));
    // the rungs one by one (as one run in the app), a screenshot after each of the first ones (their cells)
    const rungs = [];
    for (const x of plans.rungs) {
      if (/^Rung \d+/.test(x.say ?? '') || !rungs.length) rungs.push([{ do: 'window', title: '^CLICK Programming Software' }]);
      rungs[rungs.length - 1].push(x);
    }
    console.log(`${at()} rungs: ${plans.rungs.length} steps in ${rungs.length} rungs (${plans.entered} entered by the app; ${plans.leftForYou} left for the user)`);
    // STEP_SHOTS=n: in the first n rungs a screenshot (the bridge's shot step, in the same run) after each step
    // ONLY_RUNGS=37,40: a probe, only those rungs (and the END rung), each step shot (CLICK's status bar: the cursor)
    const only = (process.env.ONLY_RUNGS || '').split(',').filter(Boolean).map(Number);
    if (only.length) {
      const keep = rungs.filter((r) => { const m = /^Rung (\d+)/.exec(r.find((x) => x.say)?.say ?? ''); return m && only.includes(Number(m[1])); });
      rungs.splice(0, rungs.length, ...keep);
      console.log(`${at()} PROBE: only rungs ${only.join(', ')} (not the proof)`);
    }
    const stepShots = only.length ? rungs.length : Number(process.env.STEP_SHOTS || 0);
    const shotName = (i, k, x) => `r${i}-s${String(k + 1).padStart(3, '0')}-${x.do}-${x.keys ?? x.find?.name ?? x.find?.id ?? ''}`.replace(/[^\w.-]+/g, '_').slice(0, 60);
    for (const [i, r] of rungs.slice(0, stepShots).entries()) {
      rungs[i] = r.flatMap((x, k) => (x.do === 'window' ? [x] : [x, { do: 'shot', text: shotName(i, k, x) }]));
    }

    for (const [i, r] of rungs.entries()) {
      await step(`rung ${i + 1}/${rungs.length} (${r.length} steps)`, () => b.call('run', { steps: r }));
      shot(`rung-${String(i + 1).padStart(2, "0")}`);
    }
    shot('all-rungs');
    // first CLICK's own judgement of the wiring: its Syntax Check (F8), its result window recorded and shot
    await step('Syntax Check (F8)', () => b.call('run', { steps: [{ do: 'window', title: '^CLICK Programming Software' }, { do: 'keys', keys: '{F8}' }, { do: 'wait', ms: 4000 }] }));
    await b.call('dump', { show: false }).catch(() => undefined);
    shot('syntax-check');
    await b.call('run', { steps: [{ do: 'window', title: '^CLICK Programming Software' }, { do: 'keys', keys: '{ESC}' }, { do: 'wait', ms: 500 }] }).catch(() => undefined);
    // then the proof: CLICK prints its ladder to a PDF (the app's own print plan; this script stands in for the user
    // pressing Save in Windows' dialog), checked against the project by tools/click-real/verify.ts
    const folder = path.dirname(file.path).replace(/\\/g, '\\\\');
    const print = JSON.parse(JSON.stringify(plans.print).split(plans.folderPlaceholder).join(folder));
    const { spawn } = require('node:child_process');
    const presser = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'press-save.ps1')], { stdio: 'inherit' });
    await step(`print the ladder to a PDF (${print.length} steps)`, () => b.call('run', { steps: print }));
    presser.kill();
    shot('printed');
    console.log(`${at()} ALL DONE: the example project is in CLICK`);
  } catch {
    failed = true;
    shot('failed');
    try { await b.call('dump', { show: false }); } catch { /* the windows are in the log already */ }
  } finally {
    b.stop();
  }
  setTimeout(() => process.exit(failed ? 1 : 0), 500);
})();
