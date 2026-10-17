/// <reference types="node" />
/**
 * Rule-based-first electrical design: the AI failing never stops a design; a recorded AI machine
 * model is merged under the designer's motor list; prompt size of the old all-AI design vs the
 * machine-model prompt. Run with:  npx tsx src/lib/ai/machineModelAI.test.ts
 */
import assert from 'node:assert/strict';
import { setClaudeInterceptor, type ClaudeOptions } from './anthropic';
import { generateRuleBasedDesign } from './machineModelAI';
import { generateElectricalDesign } from './electricalAI';
import { getPart } from '../../electrical/catalog';
import { designWarnings, type DrawingContext } from '../../electrical/derive';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import { SPEC } from '../../preview/sampleProject';
import { specToText } from '../../spec/types';
import type { IOPoint } from '../../types/io';
import type { DesignInputs } from '../../electrical/types';

const io = [
  ['E-Stop OK (safety relay)', 'input'], ['Start Button', 'input'], ['Stop Button', 'input'], ['Part at end photo-eye', 'input'],
  ['Pusher extended', 'input'], ['Pusher retracted', 'input'], ['Conveyor motor contactor', 'output'], ['Pusher solenoid', 'output'], ['Main air dump valve', 'output'],
].map(([description, type], i) => ({ id: `p${i}`, description, type, category: 'Operator/HMI' })) as IOPoint[];
const profile = getProfile('click');
const cpu = getCpu(profile, 'C0-10DD1E-D');
const addresses = resolveAddresses(profile, cpu, io, moduleSlots([]));
const plc = { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label };
const inputs: DesignInputs = { supply: '480VAC-3PH', enclosureRating: 'NEMA 12', notes: '', motors: [{ tag: 'M1', description: 'Conveyor motor', hp: 1, voltage: '480VAC-3PH', starter: 'contactor-overload', reversing: false }], requiredParts: [] };
const spec = specToText(SPEC);
const base = { spec, io, addresses, inputs, plc, modules: [], region: 'US' as const, getPart, hmiPartNumber: 'CM5-T7W', now: '2026-01-01T00:00:00.000Z' };
const ai = { apiKey: 'test-key', model: 'test-model', effort: 'low' as const };
const ctxOf = (design: DrawingContext['design']): DrawingContext => ({ projectName: 't', design, getPart, plc, io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })), region: 'US', hmiPartNumber: 'CM5-T7W' });

// 1. The AI fails (service down): the rules still design the panel, and say so.
setClaudeInterceptor(async () => { throw new Error('Anthropic API is overloaded'); });
const failed = await generateRuleBasedDesign({ ...base, ...ai });
assert.equal(failed.source, 'rules');
assert.match(failed.aiError ?? '', /overloaded/);
assert.match(failed.design.notes[0], /AI could not read the specification/);
assert.ok(failed.design.askUser?.[0].includes('AI could not read'));
assert.ok(failed.layoutOk);
assert.deepEqual(designWarnings(ctxOf(failed.design)).filter((w) => /no (main disconnect|enclosure|24VDC|branch|contactor|overload|safety relay)|not found in the catalog/i.test(w)), []);
// No key at all: rules only, no AI call.
let calls = 0;
setClaudeInterceptor(async () => { calls++; throw new Error('should not be called'); });
const noKey = await generateRuleBasedDesign(base);
assert.equal(calls, 0);
assert.equal(noKey.source, 'rules');
assert.equal(noKey.aiError, undefined);
// Same design as the AI failure, apart from the AI note.
assert.deepEqual(noKey.design.components, failed.design.components);

// 2. A recorded machine model: the designer's M1 stays as given; the AI adds a 0.75 kW pump on a VFD and a guard door.
let modelPrompt = 0;
setClaudeInterceptor(async (o: ClaudeOptions) => {
  modelPrompt = o.system.length + o.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('').length + JSON.stringify(o.schema).length;
  return {
    reasoning: null,
    text: JSON.stringify({
      motors: [
        { tag: 'M1', description: 'Conveyor motor', power: 5, unit: 'hp', powerGiven: true, start: 'vfd', vertical: false, zone: 'Conveyor' },
        { tag: 'M2', description: 'Coolant pump', power: 0.75, unit: 'kW', powerGiven: false, start: 'vfd', vertical: false, zone: 'Pusher station' },
      ],
      estops: 1, guardDoors: [{ zone: 'Pusher station' }], lightCurtains: [], zones: ['Conveyor', 'Pusher station'], interfaces: [],
      questions: ['Confirm the plant air pressure switch is not needed.'],
    }),
  };
});
const t0 = performance.now();
const good = await generateRuleBasedDesign({ ...base, ...ai });
const engineMs = performance.now() - t0;
assert.equal(good.source, 'ai');
const m1 = good.design.inputs.motors.find((m) => m.tag === 'M1')!;
assert.equal(m1.hp, 1, 'designer power kept');
assert.equal(m1.starter, 'contactor-overload', 'designer starter kept');
const m2 = good.design.inputs.motors.find((m) => m.tag === 'M2')!;
assert.equal(m2.starter, 'vfd');
assert.ok(Math.abs(m2.hp - 1.006) < 0.01, 'kW converted');
assert.ok(good.design.components.some((c) => c.motorTag === 'M2' && /^GS23-4/.test(c.partNumber)), 'pump drive from the catalog');
assert.ok(good.design.components.some((c) => /^GS\d$/.test(c.tag) && /Guard door interlock, Pusher station/.test(c.function)), 'guard door interlock from the model');
assert.ok(good.design.askUser?.some((n) => /power not given/.test(n)));
assert.deepEqual(good.design.machine?.zones, ['Conveyor', 'Pusher station']);

// 3. Prompt size of the old all-AI design (the full catalog goes into the prompt).
let fullPrompt = 0;
setClaudeInterceptor(async (o: ClaudeOptions) => {
  fullPrompt = o.system.length + o.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('').length + JSON.stringify(o.schema).length;
  throw new Error('measured');
});
await generateElectricalDesign({ ...ai, profile, cpu, io, addresses, machineDescription: spec, inputs, region: 'US' }).catch(() => undefined);
setClaudeInterceptor(null);
assert.ok(modelPrompt > 0 && fullPrompt > modelPrompt * 5, `machine-model prompt ${modelPrompt} chars vs full design ${fullPrompt}`);
console.log(`prompt: full AI design ${fullPrompt} chars (~${Math.round(fullPrompt / 4)} tokens) -> machine model ${modelPrompt} chars (~${Math.round(modelPrompt / 4)} tokens); rule engine ${engineMs.toFixed(0)} ms`);
console.log('machine model AI tests passed');
