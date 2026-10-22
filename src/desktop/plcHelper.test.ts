/// <reference types="node" />
/**
 * The ISA PLC Helper from the web page: the bridges the Send dialogs use, on the helper's tools through the
 * artifact runtime's mcp (a fake one here): look or start, status polled until the end, progress passed on,
 * errors in plain words, Stop, the log, the project's Open dialog, connecting.
 * Run with:  npx tsx src/desktop/plcHelper.test.ts
 */
import assert from 'node:assert/strict';
import { connectHelper, helperBridges, helperError, HELPER_SERVER, NOT_CONNECTED, plcBridges, resetHelper, type McpLike } from './plcHelper';

interface Call { server: string; tool: string; input: Record<string, unknown>; cache: unknown }

/** A helper behind a fake mcp: each job answers `steps` status polls with one progress line each, then ends. */
function fakeMcp(end: (cmd: string, args: Record<string, unknown>) => { result?: unknown; error?: string }, steps = 2) {
  const calls: Call[] = [];
  const jobs = new Map<number, { cmd: string; args: Record<string, unknown>; polls: number; lines: string[] }>();
  let next = 1;
  const mcp: McpLike = {
    async callTool(server, tool, input = {}, options) {
      calls.push({ server, tool, input, cache: options?.cache });
      if (tool === 'start' || tool === 'look') { jobs.set(next, { cmd: String(input.cmd), args: input.args as Record<string, unknown>, polls: 0, lines: [] }); return { payload: { job: next++ } }; }
      if (tool === 'status') {
        const j = jobs.get(Number(input.job))!;
        j.polls++;
        if (j.polls <= steps) j.lines.push(`step ${j.polls}`);
        const from = Number(input.from);
        const base = { job: input.job, progress: j.lines.slice(from), next: j.lines.length };
        if (j.polls <= steps) return { payload: { ...base, state: 'running', result: null, error: null } };
        const e = end(j.cmd, j.args);
        return { payload: { ...base, state: e.error ? 'failed' : 'done', result: e.result ?? null, error: e.error ?? null } };
      }
      if (tool === 'stop') return { payload: { stopping: true } };
      if (tool === 'logPath') return { payload: { path: `C:\\logs\\${input.software}-bridge.log` } };
      if (tool === 'showLog') return { payload: { shown: true } };
      throw Object.assign(new Error('nope'), { code: 'bad_request' });
    },
  };
  return { mcp, calls };
}
const noWait = () => Promise.resolve();

(async () => {
  // detect: the read-only look, polled to its end, progress passed on in order
  let f = fakeMcp(() => ({ result: { ready: true } }));
  let b = helperBridges(f.mcp, noWait);
  const lines: string[] = [];
  const off = b.tia.onProgress((p) => lines.push(p.text));
  assert.deepEqual(await b.tia.call('detect'), { ready: true });
  off();
  assert.deepEqual(lines, ['step 1', 'step 2']);
  assert.deepEqual(f.calls[0], { server: HELPER_SERVER, tool: 'look', input: { software: 'tia', cmd: 'detect', args: {} }, cache: false });
  assert.ok(f.calls.slice(1).every((c) => c.tool === 'status' && c.cache === false), 'status never from the cache');
  assert.deepEqual(f.calls.slice(1).map((c) => c.input.from), [0, 1, 2], 'each poll asks from the last line it got');

  // a command that changes something: start, its arguments as they are
  f = fakeMcp((cmd, args) => ({ result: { cmd, args } }), 0);
  b = helperBridges(f.mcp, noWait);
  assert.deepEqual(await b.codesys.call('build', { objects: [1] }), { cmd: 'build', args: { objects: [1] } });
  assert.equal(f.calls[0].tool, 'start');
  await b.studio5000.call('info', { project: 'x' });
  assert.equal(f.calls.find((c) => c.input.cmd === 'info')!.tool, 'look');
  await b.click.call('run', { steps: [] });
  assert.equal(f.calls.find((c) => c.input.cmd === 'run')!.tool, 'start');

  // the bridge's own sentence when it fails
  f = fakeMcp(() => ({ error: 'Open TIA Portal first.' }), 0);
  b = helperBridges(f.mcp, noWait);
  await assert.rejects(b.tia.call('blocks', {}), /^Error: Open TIA Portal first\.$/);

  // Stop, the log, the Open dialog
  f = fakeMcp((cmd) => ({ result: cmd === 'pickProject' ? 'C:\\P\\Line.ACD' : null }), 0);
  b = helperBridges(f.mcp, noWait);
  assert.deepEqual(await b.click.call('stop'), { stopping: true });
  assert.deepEqual(f.calls[0].input, { software: 'click' });
  assert.equal(await b.codesys.logPath(), 'C:\\logs\\codesys-bridge.log');
  assert.equal(await b.studio5000.showLog(), true);
  assert.equal(await b.studio5000.pickProject(), 'C:\\P\\Line.ACD');
  assert.equal(f.calls.find((c) => c.input.cmd === 'pickProject')!.tool, 'start');

  // mcp rejections in plain words
  assert.equal(helperError({ code: 'server_not_connected', message: 'x' }).message, NOT_CONNECTED);
  assert.equal(NOT_CONNECTED, 'To send from this page, open it in the Claude desktop app, or install the ISA PLC Helper once.');
  assert.match(helperError({ code: 'cancelled' }).message, /You said no in the Claude app, so nothing was sent/);
  assert.match(helperError({ code: 'not_in_manifest' }).message, /Permissions menu/);
  assert.equal(helperError({ code: 'tool_error', message: 'That job is not known.' }).message, 'That job is not known.');
  const bad = helperBridges({ callTool: async () => { throw { code: 'server_not_connected', message: 'no host' }; } }, noWait);
  await assert.rejects(bad.tia.call('detect'), (e: Error) => e.message === NOT_CONNECTED);

  // connecting: no runtime or no mcp, or no helper → the sentence; the helper answers → the bridges, used by the dialogs
  resetHelper();
  assert.deepEqual(await connectHelper(null), { error: NOT_CONNECTED });
  assert.deepEqual(await connectHelper({ use: async () => null }), { error: NOT_CONNECTED });
  assert.deepEqual(await connectHelper({ use: async () => ({ callTool: async () => { throw { code: 'server_not_connected' }; } }) }), { error: NOT_CONNECTED });
  assert.equal(plcBridges(), null);
  const asked: string[] = [];
  const r = await connectHelper({ use: async (name: string) => { asked.push(name); return { callTool: async (_s: string, tool: string) => { asked.push(tool); return { payload: {} }; } }; } });
  assert.ok('bridges' in r);
  assert.deepEqual(asked, ['mcp', 'about']);
  assert.ok(plcBridges()?.tia && plcBridges()?.studio5000);
  resetHelper();

  console.log('plcHelper tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
