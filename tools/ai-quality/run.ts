/// <reference types="node" />
/**
 * AI quality harness: runs the app's real generation pipeline on realistic
 * machine descriptions (tools/machines/*.md) and scores every stage with the
 * deterministic design review checks.
 *
 *   ANTHROPIC_API_KEY=sk-... npx tsx tools/ai-quality/run.ts            # real AI, records every reply
 *   npx tsx tools/ai-quality/run.ts                                     # replays recordings; machines without one are skipped
 *   npx tsx tools/ai-quality/run.ts m5-mixing-tank --record             # one machine, re-record
 *
 * The key is read from the environment only and never written anywhere.
 * Output: tools/ai-quality/out/report.md, scores.json and one project.json per machine.
 * Recordings: tools/ai-quality/recordings/<machine>/<n>-<stage>.json (commit them).
 */
import fs from 'node:fs';
import path from 'node:path';
import { setClaudeInterceptor, type ClaudeOptions, type ClaudeResult } from '../../src/lib/ai/anthropic';
import { setAiTimingQuiet } from '../../src/lib/ai/timing';
import { organizeSpec } from '../../src/lib/ai/specAI';
import { runUpdateAll, type StepResult } from '../../src/spec/updateAll';
import { EMPTY_SECTIONS } from '../../src/spec/types';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { useSpecStore } from '../../src/store/useSpecStore';
import { useIOStore } from '../../src/store/useIOStore';
import { useProjectStore } from '../../src/store/useProjectStore';
import { useProgramStore } from '../../src/store/useProgramStore';
import { useElectricalStore } from '../../src/store/useElectricalStore';
import { useHmiStore } from '../../src/store/useHmiStore';
import { useStageStore } from '../../src/store/useStageStore';
import { useReviewStore } from '../../src/review/useReviewStore';
import { collectProject } from '../../src/deliverables/collect';
import { checksFor } from '../../src/review/actions';
import type { Finding, ReviewArea } from '../../src/review/types';
import type { SupplyVoltage } from '../../src/electrical/types';
import { MACHINE_SETUP, STAGES, type Stage, stageOfPrompt } from './config';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const MACHINES = path.join(ROOT, 'tools/machines');
const REC = path.join(ROOT, 'tools/ai-quality/recordings');
const OUT = path.join(ROOT, 'tools/ai-quality/out');

// node has no localStorage: the persisted stores warn on every write.
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const PROJECT_STORES = [useSpecStore, useIOStore, useProjectStore, useProgramStore, useElectricalStore, useHmiStore, useStageStore, useReviewStore];
function resetProject() {
  for (const s of PROJECT_STORES) (s.setState as (x: unknown, replace: true) => void)(s.getInitialState(), true);
}

type Mode = 'live' | 'replay';

/** Interceptor: live = call the API and record; replay = answer from the recordings, in order per stage. */
function intercept(machine: string, mode: Mode) {
  const dir = path.join(REC, machine);
  let n = 0;
  const queue = new Map<Stage, string[]>();
  if (mode === 'replay') {
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { stage: Stage; text: string };
      queue.set(r.stage, [...(queue.get(r.stage) ?? []), r.text]);
    }
  } else fs.rmSync(dir, { recursive: true, force: true });
  setClaudeInterceptor(async (opts: ClaudeOptions, real: (o: ClaudeOptions) => Promise<ClaudeResult>) => {
    const stage = stageOfPrompt(opts.system);
    if (mode === 'replay') {
      const text = queue.get(stage)?.shift();
      if (text === undefined) throw new Error(`No recording for stage "${stage}" of ${machine}`);
      return { text, reasoning: null };
    }
    const r = await real(opts);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${String(++n).padStart(2, '0')}-${stage}.json`), JSON.stringify({ stage, model: opts.model, text: r.text }, null, 1));
    return r;
  });
}

export interface StageScore { stage: Stage; status: 'ok' | 'failed' | 'skipped' | 'missing'; score: number; critical: number; major: number; minor: number; note: string }
export interface MachineResult { machine: string; mode: Mode; stages: StageScore[]; total: number; metrics: Record<string, number | string>; findings: Finding[]; error?: string }

const AREA_STAGE: Record<ReviewArea, Stage> = { spec: 'spec', equipment: 'equipment', io: 'io', electrical: 'electrical', safety: 'electrical', hmi: 'hmi', program: 'program', project: 'spec' };

/** 100 per stage, minus 30 per critical, 12 per major, 3 per minor finding attributed to it; 0 when the stage failed. */
export function scoreStages(findings: Finding[], status: Partial<Record<Stage, StageScore['status']>>, notes: Partial<Record<Stage, string>> = {}): StageScore[] {
  return STAGES.map((stage) => {
    const st = status[stage] ?? 'missing';
    // safety findings about the program count against the program, not the panel
    const mine = findings.filter((f) => f.id !== 'doc:checked' && f.id !== 'doc:approved' && (f.area === 'safety' ? (f.page === 'program' ? 'program' : 'electrical') : AREA_STAGE[f.area]) === stage);
    const c = mine.filter((f) => f.severity === 'critical').length;
    const M = mine.filter((f) => f.severity === 'major').length;
    const m = mine.filter((f) => f.severity === 'minor').length;
    const score = st === 'ok' ? Math.max(0, 100 - 30 * c - 12 * M - 3 * m) : 0;
    return { stage, status: st, score, critical: c, major: M, minor: m, note: notes[stage] ?? '' };
  });
}

async function runMachine(machine: string, mode: Mode): Promise<MachineResult> {
  const desc = fs.readFileSync(path.join(MACHINES, `${machine}.md`), 'utf8');
  const setup = MACHINE_SETUP[machine] ?? {};
  resetProject();
  intercept(machine, mode);
  const key = process.env.ANTHROPIC_API_KEY ?? 'replay';
  useSettingsStore.setState({
    provider: 'anthropic', anthropicApiKey: key, ...(process.env.AI_MODEL ? { anthropicModel: process.env.AI_MODEL } : {}), effort: (process.env.AI_EFFORT as never) ?? useSettingsStore.getState().effort,
    // Speed and the small-task model (Settings): compare e.g. AI_SMALL_MODEL=claude-haiku-5-5 against the main model
    speed: process.env.AI_SPEED === 'thorough' ? 'thorough' : 'fast', smallTaskModel: process.env.AI_SMALL_MODEL ?? '',
  });
  if (setup.region) useProjectStore.getState().setInfo({ region: setup.region });
  if (setup.supply) useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, supply: setup.supply as SupplyVoltage });

  const status: Partial<Record<Stage, StageScore['status']>> = {};
  const notes: Partial<Record<Stage, string>> = {};
  const s = useSettingsStore.getState();
  try {
    const r = await organizeSpec({ apiKey: s.anthropicApiKey, model: s.anthropicModel, effort: s.effort, current: EMPTY_SECTIONS, newText: desc, files: [] });
    useSpecStore.getState().setSections(r.sections);
    status.spec = 'ok';
    notes.spec = `${Object.values(r.sections).filter((t) => t.trim()).length} sections, ${r.questions.length} questions`;
    await runUpdateAll(['equipment', 'io', 'electrical', 'hmi', 'program'], (x: StepResult) => {
      status[x.step] = x.status === 'done' || x.status === 'proposal' ? 'ok' : x.status === 'skipped' ? 'skipped' : 'failed';
      notes[x.step] = x.message;
    });
  } catch (e) {
    status.spec ??= 'failed';
    notes.spec ??= e instanceof Error ? e.message : String(e);
  } finally {
    setClaudeInterceptor(null);
  }

  const p = collectProject();
  const findings = checksFor(p);
  const stages = scoreStages(findings, status, notes);
  const total = Math.round(stages.reduce((a, b) => a + b.score, 0) / stages.length);
  const metrics = {
    io: p.io.length, inputs: p.io.filter((x) => x.type === 'input').length, outputs: p.io.filter((x) => x.type === 'output').length,
    cpu: p.cpu.id, modules: useProjectStore.getState().modules.join(' ') || '—', hmi: p.hmi?.hmiPartNumber ?? '—',
    components: p.electrical?.components.length ?? 0, screens: p.hmi?.screens.length ?? 0, hmiTags: p.hmi?.tags.length ?? 0,
    rungs: p.ladder.rungs.length, blocks: p.ladder.blocks?.length ?? 0,
    checkerErrors: p.issues.filter((i) => i.severity === 'error').length, checkerWarnings: p.issues.filter((i) => i.severity === 'warning').length,
  };
  const dir = path.join(OUT, machine);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({
    spec: useSpecStore.getState().sections, io: p.io, project: useProjectStore.getState(), electrical: p.electrical, hmi: p.hmi, ladder: p.ladder,
  }, null, 1));
  return { machine, mode, stages, total, metrics, findings };
}

function report(results: MachineResult[], skipped: string[]): string {
  const L: string[] = ['# AI quality report', '', `Run ${new Date().toISOString()} · model ${useSettingsStore.getState().anthropicModel}`, ''];
  L.push(`| Machine | Mode | ${STAGES.join(' | ')} | Total |`, `|---|---|${STAGES.map(() => '---:').join('|')}|---:|`);
  for (const r of results) L.push(`| ${r.machine} | ${r.mode} | ${r.stages.map((s) => (s.status === 'ok' ? String(s.score) : s.status)).join(' | ')} | **${r.total}** |`);
  if (skipped.length) L.push('', `Skipped (no API key and no recording): ${skipped.join(', ')}`);
  for (const r of results) {
    L.push('', `## ${r.machine}`, '', Object.entries(r.metrics).map(([k, v]) => `${k} ${v}`).join(' · '), '');
    for (const s of r.stages) L.push(`- **${s.stage}** ${s.status} ${s.status === 'ok' ? `${s.score} (${s.critical} critical, ${s.major} major, ${s.minor} minor)` : ''} — ${s.note}`);
    const bad = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'major');
    if (bad.length) { L.push('', 'Critical / major findings:'); for (const f of bad) L.push(`- [${f.severity}] ${f.title}`); }
  }
  return L.join('\n') + '\n';
}

async function main() {
  setAiTimingQuiet(true);
  const args = process.argv.slice(2);
  const forceRecord = args.includes('--record');
  const only = args.filter((a) => !a.startsWith('--'));
  const all = fs.readdirSync(MACHINES).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
  const machines = only.length ? all.filter((m) => only.includes(m)) : all;
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  const results: MachineResult[] = [];
  const skipped: string[] = [];
  for (const m of machines) {
    const hasRec = fs.existsSync(path.join(REC, m)) && fs.readdirSync(path.join(REC, m)).length > 0;
    const mode: Mode | null = live && (forceRecord || !hasRec) ? 'live' : hasRec ? 'replay' : null;
    if (!mode) { skipped.push(m); console.log(`- ${m}: skipped (no ANTHROPIC_API_KEY and no recording)`); continue; }
    console.log(`- ${m}: ${mode}…`);
    const r = await runMachine(m, mode);
    results.push(r);
    console.log(`  ${r.stages.map((s) => `${s.stage} ${s.status === 'ok' ? s.score : s.status}`).join(' · ')} → ${r.total}`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'scores.json'), JSON.stringify(results.map(({ findings: _f, ...r }) => { void _f; return r; }), null, 1));
  fs.writeFileSync(path.join(OUT, 'report.md'), report(results, skipped));
  console.log(`\nReport: tools/ai-quality/out/report.md (${results.length} run, ${skipped.length} skipped)`);
}

if (process.argv[1]?.endsWith('run.ts')) main().catch((e) => { console.error(e); process.exit(1); });
