/// <reference types="node" />
/**
 * Update-all benchmark: description → complete design (organizeSpec + runUpdateAll, the app's own
 * pipeline) with recorded AI replies, so the time that is not AI can be tracked in CI, and the time
 * with the AI can be estimated from a latency model.
 *
 *   npx tsx tools/bench-update.ts                       # every machine with recordings, old vs new configuration
 *   npx tsx tools/bench-update.ts m1-case-erector       # one machine
 *   npx tsx tools/bench-update.ts --json out.json       # also write the numbers as JSON
 *   npx tsx tools/bench-update.ts --max-non-ai-ms=5000  # exit 1 when the pipeline itself (no AI) gets slower than this (CI)
 *
 * Replies come from tools/ai-quality/recordings/<machine>/ (real or E2E answers) and
 * tools/bench/recordings/<machine>/ (hand-written answers of realistic size; see its README).
 *
 * Each reply is held back for a MODELLED latency on a virtual clock (the run takes seconds):
 *   time to first token + thinking time for the request's effort + answer characters / output speed.
 * Virtual time moves only while every stage waits for an AI reply, so overlapping requests and the
 * pipeline's order count exactly as in the app. The thinking times are assumptions, anchored on the
 * app's own default estimate for a max-effort answer (90 s, src/lib/ai/progress.ts); measure with a
 * key to replace them. The non-AI time is measured for real (a second run with instant replies) and
 * added on top (as if none of it overlapped an AI request).
 *
 * Configurations:
 *   before — Speed thorough (every request at the Settings effort, max), no answer cache, every stage
 *            "With AI", the old order (I/O asked after the equipment, the cycle asked in the program stage).
 *   after  — the defaults: Speed fast (per-task effort), answer cache, Quick first then AI, pipelined.
 *   after (rebuild) — the same description built again (e.g. Start clean, another project): all from the cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import { setClaudeInterceptor, type ClaudeOptions } from '../src/lib/ai/anthropic';
import { clearAiCache, setAiCacheEnabled } from '../src/lib/ai/cache';
import { aiBusyMs, setAiClock, setAiTimingQuiet, useAiTimingStore } from '../src/lib/ai/timing';
import { organizeSpec } from '../src/lib/ai/specAI';
import { runUpdateAll, setUpdatePipelining, type StepResult, type UpdateStep } from '../src/spec/updateAll';
import { EMPTY_SECTIONS } from '../src/spec/types';
import { DEFAULT_STAGE_MODES, useSettingsStore, type StageMode } from '../src/store/useSettingsStore';
import { useSpecStore } from '../src/store/useSpecStore';
import { useIOStore } from '../src/store/useIOStore';
import { useProjectStore } from '../src/store/useProjectStore';
import { useProgramStore } from '../src/store/useProgramStore';
import { useElectricalStore } from '../src/store/useElectricalStore';
import { useHmiStore } from '../src/store/useHmiStore';
import { useStageStore } from '../src/store/useStageStore';
import { useReviewStore } from '../src/review/useReviewStore';
import type { SupplyVoltage } from '../src/electrical/types';
import { MACHINE_SETUP, stageOfPrompt, type Stage } from './ai-quality/config';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MACHINES = path.join(ROOT, 'tools/machines');
const REC_DIRS = [path.join(ROOT, 'tools/ai-quality/recordings'), path.join(ROOT, 'tools/bench/recordings')];

// node has no localStorage: the persisted stores warn on every write.
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

// ---- latency model (seconds)
const THINK_S: Record<string, number> = { low: 4, medium: 15, high: 40, xhigh: 65, max: 90 };
const FIRST_TOKEN_S = 1.5;
const OUT_CHARS_PER_S = 200; // ~60 tokens/s of JSON
export function modelledLatencyMs(effort: string, outChars: number): number {
  return (FIRST_TOKEN_S + (THINK_S[effort] ?? THINK_S.max) + outChars / OUT_CHARS_PER_S) * 1000;
}

const PROJECT_STORES = [useSpecStore, useIOStore, useProjectStore, useProgramStore, useElectricalStore, useHmiStore, useStageStore, useReviewStore];
function resetProject() {
  for (const s of PROJECT_STORES) (s.setState as (x: unknown, replace: true) => void)(s.getInitialState(), true);
}

function recordings(machine: string): Map<Stage, string[]> | null {
  const dir = REC_DIRS.map((d) => path.join(d, machine)).find((d) => fs.existsSync(d) && fs.readdirSync(d).some((f) => f.endsWith('.json')));
  if (!dir) return null;
  const q = new Map<Stage, string[]>();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { stage: Stage; text: string };
    q.set(r.stage, [...(q.get(r.stage) ?? []), r.text]);
  }
  return q;
}

// ---- virtual clock: pending AI replies complete in time order once the app has nothing else to do
let vnow = 0;
const pending: { at: number; resolve: () => void }[] = [];
let ticking = false;
function aiSleep(ms: number): Promise<void> {
  return new Promise((resolve) => { pending.push({ at: vnow + ms, resolve }); tick(); });
}
function tick() {
  if (ticking) return;
  ticking = true;
  // a few real ms: lets hashing (WebCrypto runs off the main thread) and the engines finish first
  setTimeout(() => {
    ticking = false;
    if (!pending.length) return;
    pending.sort((a, b) => a.at - b.at);
    const next = pending.shift()!;
    vnow = Math.max(vnow, next.at);
    next.resolve();
    if (pending.length) tick();
  }, 4);
}

/** Replay: each stage's recorded replies in order (the last one repeats), after the modelled latency (or at once). */
function replay(rec: Map<Stage, string[]>, instant: boolean) {
  const used = new Map<Stage, number>();
  setClaudeInterceptor(async (opts: ClaudeOptions) => {
    const stage = stageOfPrompt(opts.system);
    const list = rec.get(stage);
    if (!list?.length) throw new Error(`No recording for stage "${stage}"`);
    const n = used.get(stage) ?? 0;
    used.set(stage, n + 1);
    const text = list[Math.min(n, list.length - 1)];
    if (!instant) await aiSleep(modelledLatencyMs(opts.effort, text.length));
    return { text, reasoning: null };
  });
}

interface StageTime { step: UpdateStep; status: string; modelledMs: number; provisionalModelledMs?: number }
export interface BenchRun {
  machine: string; config: string; io: number;
  /** Description → complete design, with the modelled AI latency. */
  modelledMs: number;
  /** The same with the AI time left out: what the app itself spends (real). */
  nonAiMs: number;
  aiModelledMs: number;
  requests: number; cached: number;
  stages: StageTime[];
  calls: { task: string; effort: string; promptChars: number; outChars: number; modelledMs: number; cached: string | null }[];
}

type Config = 'before' | 'after' | 'after (rebuild)';

/** Description → design once; virtual (modelled AI latency) or instant (replies at once: measures the non-AI time). */
async function runOnce(machine: string, config: Config, rec: Map<Stage, string[]>, instant: boolean) {
  const desc = fs.readFileSync(path.join(MACHINES, `${machine}.md`), 'utf8');
  const setup = MACHINE_SETUP[machine] ?? {};
  const before = config === 'before';
  resetProject();
  useAiTimingStore.setState({ calls: [] });
  if (config !== 'after (rebuild)') await clearAiCache();
  setAiCacheEnabled(!before);
  vnow = 0;
  setAiClock(instant ? null : () => vnow);
  setUpdatePipelining(!before);
  const modes: Record<keyof typeof DEFAULT_STAGE_MODES, StageMode> = before ? { equipment: 'ai', electrical: 'ai', hmi: 'ai', program: 'ai' } : DEFAULT_STAGE_MODES;
  useSettingsStore.setState({ provider: 'anthropic', anthropicApiKey: 'bench', effort: 'max', speed: before ? 'thorough' : 'fast', smallTaskModel: '', stageModes: modes });
  if (setup.region) useProjectStore.getState().setInfo({ region: setup.region });
  if (setup.supply) useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, supply: setup.supply as SupplyVoltage });
  replay(rec, instant);

  const t0 = performance.now();
  const stepEvents: StepResult[] = [];
  const s = useSettingsStore.getState();
  const sp = await organizeSpec({ apiKey: s.anthropicApiKey, model: s.anthropicModel, effort: s.effort, current: EMPTY_SECTIONS, newText: desc, files: [] });
  useSpecStore.getState().setSections(sp.sections);
  await runUpdateAll(['equipment', 'io', 'electrical', 'hmi', 'program'], (r) => { stepEvents.push(r); });
  const realMs = performance.now() - t0;
  setClaudeInterceptor(null);
  setAiClock(null);
  const calls = useAiTimingStore.getState().calls;
  // stage times are on the AI clock (virtual): the modelled AI waits only
  const stages: StageTime[] = [];
  for (const r of stepEvents) {
    const prev = stages.find((x) => x.step === r.step);
    if (r.provisional) stages.push({ step: r.step, status: 'provisional', modelledMs: r.ms ?? 0, provisionalModelledMs: r.ms ?? 0 });
    else if (prev) Object.assign(prev, { status: r.status, modelledMs: r.ms ?? 0 });
    else stages.push({ step: r.step, status: r.status, modelledMs: r.ms ?? 0 });
  }
  return { realMs, virtualMs: vnow, calls, stages, io: useIOStore.getState().projectIO.length };
}

async function bench(machine: string, config: Config, rec: Map<Stage, string[]>): Promise<BenchRun> {
  // non-AI time first (instant replies), then the modelled run; the rebuild must find the cache filled by "after"
  const instant = config === 'after (rebuild)' ? null : await runOnce(machine, config, rec, true);
  const v = await runOnce(machine, config, rec, false);
  const nonAiMs = instant?.realMs ?? v.realMs;
  const calls = v.calls;
  return {
    machine, config, io: v.io,
    modelledMs: v.virtualMs + nonAiMs, nonAiMs, aiModelledMs: aiBusyMs(calls),
    requests: calls.filter((c) => !c.cached).length, cached: calls.filter((c) => c.cached).length, stages: v.stages,
    calls: calls.map((c) => ({ task: c.task, effort: c.effort, promptChars: c.promptChars, outChars: c.outChars, modelledMs: c.cached ? 0 : c.endedAt - c.startedAt, cached: c.cached })),
  };
}

const fmt = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${String(Math.round(ms / 1000) % 60).padStart(2, '0')} s`);

function report(runs: BenchRun[]): string {
  const L: string[] = ['# Update-all benchmark', '', `Latency model: ${FIRST_TOKEN_S} s to the first token + thinking (${Object.entries(THINK_S).map(([k, v]) => `${k} ${v} s`).join(', ')}) + answer at ${OUT_CHARS_PER_S} characters/s. Non-AI time is measured.`, ''];
  L.push('| Machine | I/O | Configuration | Description → design (modelled) | AI (modelled) | Non-AI (measured) | AI requests | From cache |', '|---|---:|---|---:|---:|---:|---:|---:|');
  for (const r of runs) L.push(`| ${r.machine} | ${r.io} | ${r.config} | **${fmt(r.modelledMs)}** | ${fmt(r.aiModelledMs)} | ${fmt(r.nonAiMs)} | ${r.requests} | ${r.cached} |`);
  for (const r of runs) {
    L.push('', `## ${r.machine} — ${r.config}`, '', '| Stage | Result | Time (AI waits, modelled) | First result (rules) |', '|---|---|---:|---:|');
    for (const st of r.stages) L.push(`| ${st.step} | ${st.status} | ${fmt(st.modelledMs)} | ${st.provisionalModelledMs !== undefined ? fmt(st.provisionalModelledMs) : '—'} |`);
    L.push('', '| AI request | Effort | Prompt (chars) | Answer (chars) | Latency (modelled) |', '|---|---|---:|---:|---:|');
    for (const c of r.calls) L.push(`| ${c.task} | ${c.effort} | ${c.promptChars} | ${c.outChars} | ${c.cached ? `cache (${c.cached})` : fmt(c.modelledMs)} |`);
  }
  return L.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : undefined;
  const maxNonAi = Number(args.find((a) => a.startsWith('--max-non-ai-ms='))?.split('=')[1] ?? 0);
  const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
  const all = fs.readdirSync(MACHINES).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
  const machines = (only.length ? all.filter((m) => only.includes(m)) : all).filter((m) => recordings(m));
  setAiTimingQuiet(true);
  const runs: BenchRun[] = [];
  for (const m of machines) {
    const rec = recordings(m)!;
    runs.push(await bench(m, 'before', rec));
    runs.push(await bench(m, 'after', rec));
    // the same description again with the cache filled by the run above (memory cache survives resetProject)
    runs.push(await bench(m, 'after (rebuild)', rec));
  }
  const text = report(runs);
  const outDir = path.join(ROOT, 'tools/bench/out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.md'), text);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(runs, null, 1));
  for (const r of runs) console.log(`${r.machine.padEnd(28)} ${String(r.io).padStart(3)} I/O  ${r.config.padEnd(16)} ${fmt(r.modelledMs).padStart(10)} (AI ${fmt(r.aiModelledMs)}, non-AI ${fmt(r.nonAiMs)}, ${r.requests} requests, ${r.cached} cached)`);
  console.log('\nReport: tools/bench/out/report.md');
  const slow = runs.filter((r) => maxNonAi && r.nonAiMs > maxNonAi);
  if (slow.length) { console.error(`Non-AI time over ${maxNonAi} ms: ${slow.map((r) => `${r.machine} ${r.config} ${fmt(r.nonAiMs)}`).join(', ')}`); process.exit(1); }
}

if (process.argv[1]?.endsWith('bench-update.ts')) main().catch((e) => { console.error(e); process.exit(1); });
