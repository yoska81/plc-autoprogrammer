/// <reference types="node" />
/**
 * Update all, AI equipment step: a panel the AI picks that cannot talk to its CPU is swapped for one that can, or,
 * when no listed panel can, kept (never none: no panel would add the door pushbuttons and lamps to the I/O list).
 * Run with:  npx tsx src/spec/updateAll.panel.test.ts
 */
import assert from 'node:assert/strict';
import { setClaudeInterceptor } from '../lib/ai/anthropic';
import { clearAiCache } from '../lib/ai/cache';
import { panelForCpu, runUpdateAll, type StepResult } from './updateAll';
import { EMPTY_SECTIONS } from './types';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';
import type { EquipmentRecommendation } from '../lib/ai/equipmentAI';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};

const IO = [
  { type: 'input', description: 'E-Stop OK (safety relay)', category: 'Safety' },
  { type: 'input', description: 'Part present photo-eye', category: 'Sensors' },
  { type: 'output', description: 'Conveyor motor run', category: 'Motor' },
];

async function run(cpuId: string, hmi: string): Promise<StepResult[]> {
  await clearAiCache();
  useSpecStore.setState({ sections: { ...EMPTY_SECTIONS, overview: `Conveyor with a photo-eye, an E-stop and a 7 inch touch screen for start / stop (${cpuId}).` }, questions: [] });
  useIOStore.getState().importPoints(IO as never, true);
  useProjectStore.setState({ recommendation: null });
  useSettingsStore.setState({ anthropicApiKey: 'k', stageModes: { ...useSettingsStore.getState().stageModes, equipment: 'ai' } });
  const rec: EquipmentRecommendation = {
    summary: 'Logix for the conveyor.', estimatedIO: { digitalInputs: 2, digitalOutputs: 1, analogInputs: 0, analogOutputs: 0, motionAxes: 0 },
    plc: { profileId: 'logix', cpuId, why: 'Allen-Bradley.' }, modules: [], hmi: { partNumber: hmi, why: '7 inch' }, alternatives: [], cautions: [],
  };
  setClaudeInterceptor(async () => ({ text: JSON.stringify(rec), reasoning: null }));
  const rs: StepResult[] = [];
  await runUpdateAll(['equipment'], (r) => rs.push(r));
  return rs;
}

// No listed panel talks to the CPU: a panel is kept and said, never none (no door pushbuttons or lamps added).
{
  const need = { digitalInputs: 2, digitalOutputs: 1, analogInputs: 0, analogOutputs: 0, ethernetHmi: true, minHmiSizeIn: null };
  const none = () => null;
  const kept = panelForCpu('CM5-T7W', null, '5069-L306ER', need, none);
  assert.equal(kept.panel, 'CM5-T7W', 'a panel is kept, never none');
  assert.match(kept.say, /CM5-T7W panel cannot talk to the 5069-L306ER and no listed panel can: it is kept for now \(no door pushbuttons added\)/);
  assert.deepEqual(panelForCpu('6AV2123-2GB03-0AX0', null, '6ES7214-1AG40-0XB0', need, none), { panel: '6AV2123-2GB03-0AX0', say: '' }, 'a panel that talks is kept silently');
}

// 1769-L33ER (CompactLogix 5370) on the AI path: the AI's CM5-T7W is swapped for a panel that talks to it; the
// I/O list is untouched and a brand change is not "no longer enough".
{
  const rs = await run('1769-L33ER', 'CM5-T7W');
  const done = rs.filter((r) => r.step === 'equipment' && r.status === 'done').at(-1);
  assert.ok(done, JSON.stringify(rs));
  assert.equal(useProjectStore.getState().cpuId, '1769-L33ER');
  const now = useHmiStore.getState().hmiPartNumber;
  assert.ok(now && now !== 'CM5-T7W', `swapped: ${now}`);
  assert.equal(useIOStore.getState().projectIO.length, IO.length, `no door I/O added: ${useIOStore.getState().projectIO.map((p) => p.description).join(', ')}`);
  assert.doesNotMatch(done.message ?? '', /no longer enough/, 'a brand change is not "no longer enough"');
}

// 5069-L306ER: the AI's CM5-T7W is swapped for the closest panel that talks to it; the stored recommendation names it.
{
  const rs = await run('5069-L306ER', 'CM5-T7W');
  const done = rs.filter((r) => r.step === 'equipment' && r.status === 'done').at(-1)!;
  const now = useHmiStore.getState().hmiPartNumber;
  assert.ok(now && now !== 'CM5-T7W', `swapped: ${now}`);
  assert.match(done.message ?? '', new RegExp(`CM5-T7W panel cannot talk to the 5069-L306ER: ${now}`));
  assert.equal(useProjectStore.getState().recommendation?.hmi?.partNumber, now, 'the stored recommendation is not stale');
}

setClaudeInterceptor(null);
console.log('update all panel tests passed');
