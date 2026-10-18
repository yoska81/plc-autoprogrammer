/// <reference types="node" />
/**
 * Speed: per-task effort, the answer cache, the timing log, the cycle request renaming and the
 * rules' equipment choice.
 * Run with:  npx tsx src/lib/ai/speed.test.ts
 */
import assert from 'node:assert/strict';
import { effectiveEffort, effectiveModel, TASK_EFFORT } from './tasks';
import { cachedAnswer, cacheKey, clearAiCache, setAiCacheEnabled, setAiCacheSyncKeys } from './cache';
import { aiBusyMs, type AiCall } from './timing';
import { callClaude, setClaudeInterceptor } from './anthropic';
import { useSettingsStore } from '../../store/useSettingsStore';
import { renameActions } from '../../plc/ai/cycleAI';
import { needFromIo, rulesEquipment } from '../../spec/equipmentRules';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message}`); }
}
// node has no localStorage: the persisted settings store warns on every write.
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};

console.log('Speed');

await test('per-task effort: fast caps each task, thorough keeps the Settings effort', () => {
  assert.equal(effectiveEffort('max', 'hmi-names', 'fast'), 'low');
  assert.equal(effectiveEffort('max', 'io', 'fast'), 'medium');
  assert.equal(effectiveEffort('max', 'review', 'fast'), 'high');
  assert.equal(effectiveEffort('low', 'review', 'fast'), 'low', 'never deeper than the Settings effort');
  assert.equal(effectiveEffort('max', 'io', 'thorough'), 'max');
  assert.equal(effectiveEffort('max', undefined, 'fast'), 'max', 'untagged requests keep the Settings effort');
  assert.equal(TASK_EFFORT.equipment, 'low');
});

await test('small-task model only for small tasks, only when set', () => {
  assert.equal(effectiveModel('main', 'hmi-names', 'small'), 'small');
  assert.equal(effectiveModel('main', 'equipment', 'small'), 'small');
  assert.equal(effectiveModel('main', 'io', 'small'), 'main');
  assert.equal(effectiveModel('main', 'hmi-names', ''), 'main');
});

await test('cache: same request answered once; in-flight requests shared; fresh asks again; failures not stored', async () => {
  await clearAiCache();
  const parts = { model: 'm', effort: 'low', system: 's', messages: [{ role: 'user', content: 'x' }], schema: { type: 'object' } };
  let n = 0;
  // Deterministic: in-thread keys (no off-thread hashing), and the first request stays open until both
  // asks have looked it up — no timers involved.
  setAiCacheSyncKeys(true);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const fn = async () => { n++; await gate; return { text: `a${n}`, reasoning: null }; };
  const both = Promise.all([cachedAnswer(parts, fn), cachedAnswer(parts, fn)]);
  for (let i = 0; i < 10; i++) await Promise.resolve(); // both asks reach the lookup (microtasks only)
  release();
  const [a, b] = await both;
  assert.equal(n, 1, 'one request made for two identical asks');
  assert.equal(a.answer.text, 'a1');
  assert.equal(b.hit, 'shared', 'the second ask joined the first');
  assert.equal((await cachedAnswer(parts, fn)).hit, 'memory');
  assert.equal(n, 1);
  assert.equal((await cachedAnswer(parts, fn, { fresh: true })).answer.text, 'a2');
  assert.equal((await cachedAnswer(parts, fn)).answer.text, 'a2', 'a fresh answer replaces the stored one');
  assert.notEqual(await cacheKey(parts), await cacheKey({ ...parts, effort: 'high' }));
  await assert.rejects(cachedAnswer({ ...parts, system: 'fail' }, async () => { throw new Error('boom'); }));
  assert.equal((await cachedAnswer({ ...parts, system: 'fail' }, fn)).hit, null, 'a failure is not stored');
  setAiCacheSyncKeys(false);
});

await test('callClaude: Update (cache: true) answers a repeated request without asking; a page request asks again', async () => {
  await clearAiCache();
  setAiCacheEnabled(true);
  useSettingsStore.setState({ speed: 'fast', smallTaskModel: '' });
  const seen: string[] = [];
  setClaudeInterceptor(async (o) => { seen.push(`${o.task}:${o.effort}`); return { text: '{}', reasoning: null }; });
  const req = { apiKey: 'k', model: 'm', effort: 'max' as const, system: 'S', messages: [{ role: 'user' as const, content: 'u' }], task: 'hmi-names' as const };
  await callClaude({ ...req, cache: true });
  await callClaude({ ...req, cache: true });
  assert.deepEqual(seen, ['hmi-names:low'], 'second request from the cache, effort low in fast mode');
  await callClaude(req);
  assert.equal(seen.length, 2, 'without cache: true the request is made');
  setClaudeInterceptor(null);
});

await test('AI busy time counts overlapping requests once and skips cache hits', () => {
  const c = (startedAt: number, endedAt: number, cached: AiCall['cached'] = null): AiCall => ({ task: 't', model: 'm', effort: 'low', startedAt, endedAt, promptChars: 0, outChars: 0, cached, ok: true });
  assert.equal(aiBusyMs([c(0, 10), c(5, 20), c(30, 40), c(0, 100, 'memory')]), 30);
  assert.equal(aiBusyMs([c(0, 10)], 5, 8), 3);
});

await test('cycle request renamed to the program\'s actuators by output', () => {
  const seq = { steps: [{ name: 'Run', actions: [{ actuator: 'Conveyor Fwd', what: 'run' as const }, { actuator: 'Conveyor Rev', what: 'run' as const }], waitFor: [{ seconds: 1 }], timeoutSec: null }], questions: [], source: 'ai' as const };
  const asked = [{ actuator: 'Conveyor Fwd', what: 'run', output: 'Y001', bit: 'C1' }, { actuator: 'Conveyor Rev', what: 'run', output: 'Y002', bit: 'C2' }];
  const final = [{ actuator: 'Conveyor', what: 'run', output: 'Y001', bit: 'C5' }, { actuator: 'Conveyor', what: 'reverse', output: 'Y002', bit: 'C6' }];
  assert.deepEqual(renameActions(seq, asked, final).steps[0].actions, [{ actuator: 'Conveyor', what: 'run' }, { actuator: 'Conveyor', what: 'reverse' }]);
});

await test('rules equipment: keeps a CPU that fits, adds modules or picks a bigger CPU from the I/O counts', () => {
  const io = (i: number, o: number) => [...Array.from({ length: i }, () => ({ type: 'input' })), ...Array.from({ length: o }, () => ({ type: 'output' }))];
  assert.deepEqual(needFromIo(io(10, 5), true), { digitalInputs: 12, digitalOutputs: 6, analogInputs: 0, analogOutputs: 0, ethernetHmi: true, minHmiSizeIn: null });
  const small = rulesEquipment(io(4, 3), { plcId: 'click', cpuId: 'C0-11DD1E-D', modules: [], hmiPartNumber: null });
  assert.equal(small?.kept, true);
  assert.deepEqual(small?.modules, []);
  const big = rulesEquipment(io(15, 9), { plcId: 'click', cpuId: 'C0-11DD1E-D', modules: [], hmiPartNumber: 'EA3-T6CL' });
  assert.ok(big && big.modules.length >= 1, 'modules added for 15 inputs / 9 outputs');
  assert.equal(big?.cpuId, 'C0-11DD1E-D', 'the Ethernet CPU is kept');
});

console.log(failures.length ? `\n${failures.length} failed` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
