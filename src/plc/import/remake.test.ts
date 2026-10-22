/**
 * The remake coverage (remake.ts) on the synthetic MPE720 demo project: per target PLC it is what the real
 * "Move it to another PLC" gives (choosePlcBrand, then the checker), and working it out changes nothing.
 * Run with:  npx tsx src/plc/import/remake.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readYmw7 } from './mpe720';
import { convertForeign } from './convert';
import { applyUpgrade } from './ui/applyUpgrade';
import { remakeCoverage, remakeCoverageAll } from './remake';
import { choosePlcBrand } from '../core/choosePlc';
import { collectProject } from '../../deliverables/collect';
import { useProjectStore } from '../../store/useProjectStore';
import { useIOStore } from '../../store/useIOStore';
import { useProgramStore } from '../../store/useProgramStore';
import { useHmiStore } from '../../store/useHmiStore';
import '../../hmi/ioParticipant';

const bytes = new Uint8Array(readFileSync(new URL('./__fixtures__/demo_mp.YMW7', import.meta.url)));
const load = () => applyUpgrade(convertForeign(readYmw7(bytes, 'demo_mp.YMW7'), 'demo_mp.YMW7'));
const project = () => {
  const { plcId, cpuId, modules } = useProjectStore.getState();
  return { io: useIOStore.getState().projectIO, plcId, cpuId, modules, program: useProgramStore.getState().ladder, hmi: useHmiStore.getState().design };
};

load();
assert.equal(useProjectStore.getState().plcId, 'yaskawa-mp');
const before = JSON.stringify(project());
const all = remakeCoverageAll(project());
assert.equal(JSON.stringify(project()), before, 'working out the coverage changes nothing');
assert.ok(!all.some((c) => c.plcId === 'yaskawa-mp'), 'not the program\'s own read-only PLC');
assert.ok(all.some((c) => c.plcId === 'siemens-s7') && all.some((c) => c.plcId === 'click') && all.some((c) => c.plcId === 'generic-st'));

for (const c of all) {
  // The real move, on a fresh copy of the import.
  load();
  choosePlcBrand(c.plcId);
  const s = collectProject();
  assert.equal(s.profile.id, c.plcId);
  assert.equal(s.cpu.id, c.cpuId, `${c.plcId}: the same CPU as the move`);
  assert.equal(s.ladder.rungs.length, c.rungs);
  const bad = new Set(s.issues.filter((i) => i.severity === 'error' && i.rungId && !/cannot run on|not run, rewrite by hand|not converted/i.test(i.message)).map((i) => i.rungId));
  const raw = s.ladder.rungs.filter((r) => [...r.branches.flat(), ...r.outputs].some((x) => x.type === 'RAW'));
  assert.equal(c.converted, s.ladder.rungs.filter((r) => !raw.includes(r) && !bad.has(r.id)).length, `${c.plcId}: as many rungs convert as after the move`);
  // The demo: 11 rungs, one with the drawing call (SEE) and an instruction the reader does not know.
  assert.deepEqual([c.rungs, c.converted, c.percent], [11, 10, 90], `${c.plcId}: ${JSON.stringify(c)}`);
  assert.deepEqual(c.kept.map((k) => k.what).sort(), ['SEE', 'unknown instruction']);
  assert.deepEqual(c.errors, [], `${c.plcId}: no checker errors (generic ST reads the program's timers as timers)`);
}
load();
assert.equal(remakeCoverage(project(), 'generic-st').errors.length, 0);

console.log('remake coverage tests passed');
