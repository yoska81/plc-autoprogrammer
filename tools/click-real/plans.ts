/**
 * The example project's Send to CLICK, as the app makes it (SendToClick.tsx): the nickname CSV, the set-up plan (a new
 * project with the CPU, the nicknames) and the rungs plan, as JSON for tools/click-real/run.cjs, which runs them in
 * the real CLICK Programming Software on the Windows build server (.github/workflows/click-real.yml).
 *   npx tsx tools/click-real/plans.ts > plans.json
 */
import { seedSampleProject } from '../../src/preview/sampleProject';
import { collectProject } from '../../src/deliverables/collect';
import { hmiExtraTags } from '../../src/deliverables/exportContext';
import { clickNicknameCsv } from '../../src/plc/core/clickExport';
import { setupPlan } from '../../src/plc/click/clickPlan';
import { rungsPlan } from '../../src/plc/click/clickRungs';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

seedSampleProject();
const p = collectProject();
const CSV = '__CSV_PATH__';
const rungs = rungsPlan(p.ladder, p.labels, undefined, 'list');
process.stdout.write(JSON.stringify({
  plc: p.profile.id,
  cpu: p.cpu.id,
  csvName: `${p.fileBase}_nicknames.csv`,
  csvText: clickNicknameCsv(p.ladder, p.io, p.addresses, hmiExtraTags(p)),
  csvPlaceholder: CSV,
  setup: setupPlan({ cpuId: p.cpu.id, nicknameCsvPath: CSV }),
  rungs: rungs.steps,
  entered: rungs.entered,
  leftForYou: rungs.leftForYou.length,
}));
