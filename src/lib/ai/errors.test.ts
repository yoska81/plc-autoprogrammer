/// <reference types="node" />
/**
 * AI error classification and automatic retries.
 * Run with:  npx tsx src/lib/ai/errors.test.ts
 */
import assert from 'node:assert/strict';
import { AiRequestError, classifyAiError, withRetries, withWatchdog, WatchdogTimeout } from './errors';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message}`); }
}
const err = (p: Record<string, unknown>) => Object.assign(new Error(String(p.message ?? 'x')), p);

console.log('AI errors and retries');

await test('classification', () => {
  assert.equal(classifyAiError(err({ status: 529 })).kind, 'overloaded');
  assert.equal(classifyAiError(err({ status: 429, headers: { 'retry-after': '7' } })).retryAfterMs, 7000);
  assert.equal(classifyAiError(err({ status: 503 })).transient, true);
  assert.equal(classifyAiError(err({ status: 401 })).kind, 'auth');
  assert.equal(classifyAiError(err({ status: 400, message: 'Your credit balance is too low' })).kind, 'limit');
  assert.equal(classifyAiError(err({ name: 'APIConnectionError', message: 'Connection error.' })).kind, 'network');
  assert.equal(classifyAiError(err({ name: 'APIConnectionTimeoutError', message: 'Request timed out.' })).kind, 'timeout');
  assert.equal(classifyAiError(new TypeError('Failed to fetch')).kind, 'network');
  assert.equal(classifyAiError(err({ message: 'stream ended without producing a Message' })).kind, 'network');
  assert.equal(classifyAiError(err({ code: 'rate_limited' })).kind, 'overloaded', 'preview account path');
  assert.equal(classifyAiError(err({ name: 'APIUserAbortError' })).kind, 'cancelled');
  assert.equal(classifyAiError(err({ message: 'Claude declined this request.' })).transient, false);
});

await test('transient failures are retried, then succeed', async () => {
  let n = 0;
  const seen: number[] = [];
  const r = await withRetries(async () => { if (++n < 3) throw err({ status: 529 }); return 'ok'; }, { explain: () => 'x', onRetry: (x) => seen.push(x.attempt), delays: [1, 1, 1] });
  assert.equal(r, 'ok'); assert.equal(n, 3); assert.deepEqual(seen, [1, 2]);
});

await test('gives up after 3 retries with a plain message', async () => {
  let n = 0;
  await assert.rejects(withRetries(async () => { n++; throw err({ name: 'APIConnectionError', message: 'Connection error.' }); }, { explain: () => 'Could not reach the AI service.', delays: [1, 1, 1] }),
    (e: AiRequestError) => e.info.kind === 'network' && /Could not reach the AI service\. \(tried 4 times\)/.test(e.message));
  assert.equal(n, 4);
});

await test('permanent failures are not retried', async () => {
  let n = 0;
  await assert.rejects(withRetries(async () => { n++; throw err({ status: 401 }); }, { explain: () => 'bad key', delays: [1, 1, 1] }), /bad key/);
  assert.equal(n, 1);
});

await test('abort stops the wait between retries', async () => {
  const c = new AbortController();
  const p = withRetries(async () => { throw err({ status: 529 }); }, { explain: () => 'x', signal: c.signal, delays: [10_000] });
  setTimeout(() => c.abort(), 20);
  await assert.rejects(p, (e: AiRequestError) => e.info.kind === 'cancelled');
});

const never = () => new Promise<string>(() => { /* a call that hangs and ignores abort */ });

await test('watchdog: no progress → timeout, even when the call ignores the abort', async () => {
  await assert.rejects(withWatchdog(() => never(), { idleMs: 30, totalMs: 10_000, reportsProgress: true }), (e: Error) => e instanceof WatchdogTimeout && classifyAiError(e).kind === 'timeout');
});

await test('watchdog: steady progress keeps a long call alive; total cap still applies', async () => {
  const r = await withWatchdog((_s, progress) => new Promise<string>((res) => { const t = setInterval(progress, 10); setTimeout(() => { clearInterval(t); res('done'); }, 120); }), { idleMs: 40, totalMs: 10_000, reportsProgress: true });
  assert.equal(r, 'done');
  await assert.rejects(withWatchdog((_s, progress) => { const t = setInterval(progress, 5); return new Promise<string>(() => { setTimeout(() => clearInterval(t), 200); }); }, { idleMs: 1_000, totalMs: 60, reportsProgress: true }), /timed out after/);
});

await test('watchdog: without progress events only the total cap applies', async () => {
  const r = await withWatchdog(() => new Promise<string>((res) => setTimeout(() => res('ok'), 80)), { idleMs: 20, totalMs: 1_000, reportsProgress: false });
  assert.equal(r, 'ok');
});

await test('watchdog: user cancel aborts the call, not as a timeout', async () => {
  const c = new AbortController();
  const p = withWatchdog(() => never(), { signal: c.signal, idleMs: 10_000, totalMs: 10_000, reportsProgress: true });
  setTimeout(() => c.abort(), 10);
  await assert.rejects(p, (e: Error) => !(e instanceof WatchdogTimeout));
});

await test('a hung request is retried and then reported in plain words', async () => {
  let n = 0;
  await assert.rejects(withRetries(() => { n++; return withWatchdog(() => never(), { idleMs: 10, totalMs: 1_000, reportsProgress: true }); }, { explain: (e) => (e as Error).message, delays: [1, 1, 1] }),
    (e: AiRequestError) => e.info.kind === 'timeout' && /without progress.*\(tried 4 times\)/.test(e.message));
  assert.equal(n, 4);
});

console.log(failures.length ? `\n${failures.length} failed` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
