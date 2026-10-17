import { bindProgress, finishProgress } from '../lib/ai/progress';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { DEFAULT_STAGE_MODES, useSettingsStore, type ModeStage, type StageMode } from '../store/useSettingsStore';
import { useStageStore } from '../store/useStageStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { useProgramStore } from '../store/useProgramStore';
import { useProjectStore } from '../store/useProjectStore';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { validateProgram } from '../plc/core/validate';
import { fingerprint, specToText, changedSections } from './types';
import { ioFingerprint, hmiFingerprint } from './useStages';
import { generateIOFromSpec, generatedToPoint, keptUpdate, planIOMerge } from '../lib/ai/ioAI';
import { recommendEquipment } from '../lib/ai/equipmentAI';
import { applyEquipment, recommendedChoice } from './equipment';
import { cpuFit, findCpu, modulesToFit, type Need } from '../plc/core/fit';
import { generateRuleBasedDesign } from '../lib/ai/machineModelAI';
import { analogSetup } from '../plc/core/analog';
import { getPart } from '../electrical/catalog';
import { vendorPreference } from '../store/useProjectStore';
import { generateRuleBasedHmi } from '../lib/ai/hmiContentAI';
import { mergeRegenerated } from '../hmi/engine/regenerate';
import { reviseLadder } from '../plc/ai/ladderAI';
import { generateRuleBasedProgram } from '../plc/ai/cycleAI';
import { getHmi } from '../hmi/hmiCatalog';
import { rulesEquipment } from './equipmentRules';
import { stagesNow } from './useStages';
import { aiNow } from '../lib/ai/timing';
import type { AIConfig, PlcContext } from '../plc/ai/ladderAI';

export type UpdateStep = 'equipment' | 'io' | 'electrical' | 'hmi' | 'program';
export interface StepResult {
  step: UpdateStep;
  status: 'skipped' | 'done' | 'proposal' | 'failed';
  message: string;
  /** How long the stage took (ms). */
  ms?: number;
  /** A first result (the rules' version): the AI's version follows. */
  provisional?: boolean;
}

/**
 * Stages that run at the same time (the Update dialog's spinners): the I/O list does not depend on the
 * CPU, so it is asked while the equipment is chosen; electrical and HMI both need only the I/O list;
 * the PLC program needs the electrical wiring and the HMI tags.
 */
export const UPDATE_GROUPS: UpdateStep[][] = [['equipment', 'io'], ['electrical', 'hmi'], ['program']];
const ORDER: UpdateStep[] = ['equipment', 'io', 'electrical', 'hmi', 'program'];
/** What each stage waits for (when it is part of the run). The I/O step waits for the equipment only before it is applied. */
const DEPS: Record<UpdateStep, UpdateStep[]> = { equipment: [], io: [], electrical: ['equipment', 'io'], hmi: ['equipment', 'io'], program: ['equipment', 'io', 'electrical', 'hmi'] };

let pipelining = true;
/** Test hook (tools/bench-update.ts): the old way — the I/O list asked (in full) only after the equipment, no early cycle request. */
export function setLegacyUpdate(on: boolean) { pipelining = !on; }

export const stageMode = (step: ModeStage): StageMode => useSettingsStore.getState().stageModes?.[step] ?? DEFAULT_STAGE_MODES[step];

/** Shared by the stages of one run. */
interface RunCtx {
  steps: UpdateStep[];
  signal?: AbortSignal;
  /** Resolves when that stage of this run has finished (true when it is not part of the run). */
  after: (step: UpdateStep) => Promise<boolean>;
  /** Stages of this run that changed their result. */
  changed: Set<UpdateStep>;
}

/**
 * Bring every out-of-date stage up to date from the current spec. Each stage starts as soon as what it
 * needs is ready: equipment and the I/O list together (the I/O list is applied once the CPU is chosen),
 * then electrical and HMI together, then the PLC program — whose AI cycle request is started early
 * (as soon as the I/O list is in) and picked up when the stage runs. A stage set to "Quick" (Settings)
 * is built by the rules in milliseconds; "Quick, then AI" shows the rules' version at once and replaces
 * it with the AI's. A stage whose inputs did not change is skipped, and an AI request asked before is
 * answered from the cache. I/O, electrical and HMI are applied; a change to an existing PLC program is
 * left as a proposal. A failed stage stops the stages after it.
 */
export async function runUpdateAll(steps: UpdateStep[], onStep: (r: StepResult) => void, opts: { signal?: AbortSignal; shouldStop?: () => boolean } = {}): Promise<void> {
  const { signal, shouldStop = () => false } = opts;
  const running = new Map<UpdateStep, Promise<boolean>>();
  const ctx: RunCtx = { steps, signal, after: (s) => running.get(s) ?? Promise.resolve(true), changed: new Set() };
  const one = async (step: UpdateStep): Promise<boolean> => {
    const deps = await Promise.all([...DEPS[step], ...(!pipelining && step === 'io' && stageMode('equipment') !== 'quick' ? ['equipment' as const] : [])].filter((d) => steps.includes(d)).map((d) => ctx.after(d)));
    if (deps.includes(false) || signal?.aborted) return false; // later stages depend on these
    // "Stop after this stage": the stages not started yet are skipped
    if (shouldStop()) { onStep({ step, status: 'skipped', message: 'Stopped before this stage.' }); return true; }
    const why = upToDate(step, ctx);
    if (why) { onStep({ step, status: 'skipped', message: why, ms: 0 }); return true; }
    return runStep(step, onStep, ctx);
  };
  for (const step of ORDER) if (steps.includes(step)) running.set(step, one(step));
  await Promise.all(running.values());
}

/** A reason to skip the stage: it is up to date (its inputs' fingerprints match) and nothing it depends on changed in this run. */
function upToDate(step: UpdateStep, ctx: RunCtx): string | null {
  if (DEPS[step].some((s) => ctx.changed.has(s))) return null;
  if (step === 'program' && !useProgramStore.getState().ladder.rungs.length) return null;
  return stagesNow()[step].status === 'ready' ? 'Up to date: nothing it depends on changed.' : null;
}

/** One stage; false when it failed. */
async function runStep(step: UpdateStep, onStep: (r: StepResult) => void, ctx: RunCtx): Promise<boolean> {
  // Each stage gets its own signal (aborted with the whole update) so its progress shows on its own line.
  const ctrl = new AbortController();
  const parent = ctx.signal;
  if (parent?.aborted) ctrl.abort(); else parent?.addEventListener('abort', () => ctrl.abort(), { once: true });
  bindProgress(ctrl.signal, step);
  const t0 = aiNow();
  const timed = (r: StepResult) => onStep({ ...r, ms: r.ms ?? aiNow() - t0 });
  let ok = false;
  try { ok = await runStepInner(step, timed, { ...ctx, signal: ctrl.signal }, parent); } finally { finishProgress(step, ok); }
  return ok;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;

async function runStepInner(step: UpdateStep, onStep: (r: StepResult) => void, ctx: RunCtx, runSignal?: AbortSignal): Promise<boolean> {
  const { signal } = ctx;
  const settings = useSettingsStore.getState();
  // Update may answer from the answer cache: the same request as before gets the same answer at once.
  const ai = { apiKey: settings.anthropicApiKey, model: settings.anthropicModel, effort: settings.effort, signal, cache: true };
  const spec = useSpecStore.getState().sections;
  const specFp = fingerprint(spec);
  // PLC, CPU and modules can change in the equipment step; read them fresh each step.
  const plc = () => {
    const { plcId, cpuId, modules } = useProjectStore.getState();
    const profile = getProfile(plcId);
    return { profile, cpu: getCpu(profile, cpuId), slots: moduleSlots(modules) };
  };
  const mark = useStageStore.getState().markGenerated;
  const ioNow = () => useIOStore.getState().projectIO;
  const t0 = aiNow();
  const equipmentNow = () => { const p = useProjectStore.getState(); return fingerprint([p.plcId, p.cpuId, p.modules, useHmiStore.getState().hmiPartNumber]); };

  try {
    if (step === 'equipment') {
      const before = equipmentNow();
      if (stageMode('equipment') === 'quick') {
        // Rules from the I/O counts: needs the I/O list of this run.
        if (!(await ctx.after('io'))) return false;
        const cur = useProjectStore.getState();
        const curHmi = useHmiStore.getState().hmiPartNumber || null;
        const choice = rulesEquipment(ioNow(), { plcId: cur.plcId, cpuId: cur.cpuId, modules: cur.modules, hmiPartNumber: curHmi });
        if (!choice) { onStep({ step, status: 'failed', message: `No ${getProfile(cur.plcId).name} CPU covers the ${ioNow().length} I/O points even with modules: choose a bigger PLC on the Equipment page.` }); return false; }
        applyEquipment(choice, cur.recommendation ?? null);
        if (equipmentNow() !== before) ctx.changed.add('equipment');
        onStep({ step, status: 'done', message: `${choice.kept ? `Kept your ${choice.cpuId}` : choice.cpuId}${choice.modules.length ? ` + ${choice.modules.length} module(s)` : ''}: covers the I/O list with about 20 % spare (rules).` });
        return true;
      }
      const { rec } = await recommendEquipment({ ...ai, spec });
      const cur = useProjectStore.getState();
      const curHmi = useHmiStore.getState().hmiPartNumber || null;
      const curCpu = findCpu(cur.cpuId);
      const need = { ...rec.estimatedIO, ethernetHmi: Boolean(rec.hmi || curHmi), minHmiSizeIn: null };
      // Keep the engineer's own choice while it still covers the machine; otherwise take the recommendation.
      if (curCpu && cur.recommendation && cpuFit(curCpu, cur.modules, need).ok) {
        applyEquipment({ cpuId: cur.cpuId, modules: cur.modules, hmiPartNumber: curHmi }, rec);
        onStep({ step, status: 'done', message: `Kept your ${cur.cpuId}${cur.modules.length ? ` + ${cur.modules.length} module(s)` : ''}: it still covers the I/O.` });
      } else {
        const choice = recommendedChoice(rec);
        // The AI's CPU + modules must cover its own I/O estimate: add the modules it is short of, or stop.
        const mods = modulesToFit(choice.cpuId, choice.modules, need);
        if (!mods) { onStep({ step, status: 'failed', message: `${choice.cpuId} cannot cover ${need.digitalInputs} inputs / ${need.digitalOutputs} outputs even with modules: choose a bigger CPU on the Equipment page.` }); return false; }
        applyEquipment({ ...choice, modules: mods }, rec);
        const added = mods.length - choice.modules.length;
        onStep({ step, status: 'done', message: `${rec.plc.cpuId}${cur.cpuId && cur.cpuId !== rec.plc.cpuId ? ` (was ${cur.cpuId}, no longer enough)` : ''}, ${mods.length} module(s)${added ? ` (${added} added to cover the I/O)` : ''}${rec.hmi ? `, HMI ${rec.hmi.partNumber}` : ''}.` });
      }
      if (equipmentNow() !== before) ctx.changed.add('equipment');
      return true;
    }

    if (step === 'io') {
      const { profile, cpu } = plc();
      const r = await generateIOFromSpec({ ...ai, spec, existing: ioNow(), profile, cpu, lean: pipelining });
      // Applied once the equipment step (running alongside) has chosen the CPU and modules.
      if (stageMode('equipment') !== 'quick' && !(await ctx.after('equipment'))) return false;
      const before = ioFingerprint(ioNow());
      const plan = planIOMerge(ioNow(), r.points);
      useIOStore.getState().applyIOUpdate(
        plan.kept.map(({ point, next }) => keptUpdate(point, next)),
        plan.added.map(generatedToPoint),
        plan.removed.map((p) => p.id),
      );
      if (ioFingerprint(ioNow()) !== before) ctx.changed.add('io');
      mark('io', { specFp, spec, ioFp: ioFingerprint(ioNow()) });
      // The real I/O list may need more than the equipment step's estimate: add modules, or stop with a clear error.
      // (Quick equipment sizes the CPU from this list itself, right after.)
      const fitNote = stageMode('equipment') === 'quick' ? null : ensureIoFits(ioNow());
      if (fitNote?.error) { onStep({ step, status: 'failed', message: fitNote.error }); return false; }
      if (fitNote?.note) ctx.changed.add('equipment');
      onStep({ step, status: 'done', message: `${plan.added.length} added, ${plan.removed.length} removed, ${plan.kept.length} kept.${fitNote?.note ? ` ${fitNote.note}` : ''}` });
      // Start the PLC program's AI cycle request now (it is built from the I/O list and the spec only, src/plc/ai/cycleAI.ts);
      // the program stage makes the same request and gets this answer from the answer cache.
      prefetchCycle(ctx, runSignal);
      return true;
    }

    if (step === 'electrical') {
      const { profile, cpu, slots } = plc();
      const el = useElectricalStore.getState();
      const io = ioNow();
      // AI reads the machine model, the rule-based engine designs the panel (src/electrical/engine).
      // Both versions start from the same inputs (the rules' version must not become the AI's "designer's motor list").
      const proj = useProjectStore.getState();
      const hmiState = useHmiStore.getState();
      const input = {
        spec: specToText(spec), io, addresses: resolveAddresses(profile, cpu, io, slots), inputs: el.inputs, region: proj.info.region,
        pref: vendorPreference(), getPart, modules: proj.modules, analog: analogSetup(profile, cpu, slots, io),
        hmiPartNumber: hmiState.design?.hmiPartNumber || hmiState.hmiPartNumber || null, projectName: useProgramStore.getState().projectName,
        plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
      };
      const apply = (r: Awaited<ReturnType<typeof generateRuleBasedDesign>>) => {
        el.setInputs(r.design.inputs);
        el.setDesign(r.design, 'generated', r.explanation);
        mark('electrical', { specFp, spec, ioFp: ioFingerprint(io) });
      };
      const mode = stageMode('electrical');
      if (mode !== 'ai' || !ai.apiKey) {
        const q = await generateRuleBasedDesign({ ...input, signal });
        apply(q);
        ctx.changed.add('electrical');
        if (mode === 'quick' || !ai.apiKey) {
          onStep({ step, status: 'done', message: `${q.design.components.length} components (rules, ${secs(aiNow() - t0)}).` });
          return true;
        }
        onStep({ step, status: 'done', provisional: true, message: `Rules design ready (${q.design.components.length} components, ${secs(aiNow() - t0)}): the AI is reading the spec to refine it…` });
      }
      const r = await generateRuleBasedDesign({ ...ai, ...input });
      apply(r);
      ctx.changed.add('electrical');
      onStep({ step, status: 'done', message: `${r.design.components.length} components${r.aiError ? ' (from the rules: the AI could not read the spec)' : ''}.` });
      return true;
    }

    if (step === 'hmi') {
      const { profile, cpu, slots } = plc();
      const hmi = useHmiStore.getState();
      const existing = hmi.design;
      const model = getHmi(existing?.hmiPartNumber ?? hmi.hmiPartNumber);
      if (!model) { onStep({ step, status: 'skipped', message: 'No HMI chosen.' }); return true; }
      const io = ioNow();
      // Rule-based screens from the I/O list; the AI only names things and adds the cycle steps (src/hmi/engine).
      const input = {
        io, addresses: resolveAddresses(profile, cpu, io, slots), spec: specToText(spec), machineName: useProgramStore.getState().projectName,
        electrical: useElectricalStore.getState().design, panel: model, plcText: `${profile.vendor} ${cpu.label} · HMI ${model.partNumber}`,
        existingHmi: existing, program: useProgramStore.getState().ladder,
      };
      const before = hmiFingerprint(existing);
      const apply = (r: Awaited<ReturnType<typeof generateRuleBasedHmi>>) => {
        // Keep the look the user picked (Siemens or dark console) across a regeneration.
        // Screens edited by hand are kept (re-bound to the new tags).
        const merged = mergeRegenerated(existing, r.design).design;
        useHmiStore.getState().setDesign(existing?.look ? { ...merged, look: existing.look } : merged, r.explanation);
        mark('hmi', { specFp, spec, ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(merged) });
        if (hmiFingerprint(merged) !== before) ctx.changed.add('hmi');
      };
      const mode = stageMode('hmi');
      if (mode !== 'ai' || !ai.apiKey) {
        const q = await generateRuleBasedHmi({ ...input, signal });
        apply(q);
        if (mode === 'quick' || !ai.apiKey) { onStep({ step, status: 'done', message: `${q.design.screens.length} screens, ${q.design.tags.length} tags (rules, ${secs(aiNow() - t0)}).` }); return true; }
        onStep({ step, status: 'done', provisional: true, message: `Rules screens ready (${q.design.screens.length} screens, ${secs(aiNow() - t0)}): the AI is naming the machine and its steps…` });
      }
      const r = await generateRuleBasedHmi({ ...ai, ...input });
      apply(r);
      onStep({ step, status: 'done', message: `${r.design.screens.length} screens, ${r.design.tags.length} tags.` });
      return true;
    }

    if (step === 'program') {
      const { profile, cpu, slots } = plc();
      if (profile.language !== 'ladder') { onStep({ step, status: 'skipped', message: 'Update the Structured Text program from the Program page.' }); return true; }
      const prog = useProgramStore.getState();
      const io = ioNow();
      const addresses = resolveAddresses(profile, cpu, io, slots);
      const wiring = new Map((useElectricalStore.getState().design?.ioWiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }]));
      const hmi = useHmiStore.getState().design ?? undefined;
      const ctxP: PlcContext = { profile, cpu, io, addresses, wiring, hmi };
      const aiCfg: AIConfig = { ...ai, provider: settings.provider };
      const mode = stageMode('program');
      const rulesProgram = (withAi: boolean) => generateRuleBasedProgram({ ai: withAi && aiCfg.apiKey ? aiCfg : undefined, ctx: ctxP, spec: specToText(spec), electrical: useElectricalStore.getState().design, hmi: hmi ?? null });
      const markProgram = () => mark('program', { specFp, spec, ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(hmi ?? null) });
      if (!prog.ladder.rungs.length) {
        // Standard blocks from the rules (every HMI tag implemented); the AI writes only the cycle block.
        if (mode !== 'ai' || !aiCfg.apiKey) {
          const q = await rulesProgram(false);
          prog.setGeneratedLadder(q.program, q.explanation, q.reasoning);
          markProgram();
          if (mode === 'quick' || !aiCfg.apiKey) { onStep({ step, status: 'done', message: `${q.program.rungs.length} rungs written (rules, default cycle, ${secs(aiNow() - t0)}).` }); return true; }
          onStep({ step, status: 'done', provisional: true, message: `Rules program ready (${q.program.rungs.length} rungs, default cycle, ${secs(aiNow() - t0)}): the AI is writing the cycle steps…` });
        }
        const r = await rulesProgram(true);
        useProgramStore.getState().setGeneratedLadder(r.program, r.explanation, r.reasoning);
        markProgram();
        onStep({ step, status: 'done', message: `${r.program.rungs.length} rungs written.` });
        return true;
      }
      if (mode === 'quick') {
        // Quick on an existing program: the rules' program becomes a proposal (nothing written by hand is lost).
        const q = await rulesProgram(false);
        prog.setProposal({ program: q.program, explanation: q.explanation, reasoning: null, specUpdate: true });
        onStep({ step, status: 'proposal', message: `A rules program (${q.program.rungs.length} rungs, default cycle) is waiting for your approval on the PLC Program page.` });
        return true;
      }
      const changed = changedSections(useStageStore.getState().sources.program?.spec ?? null, spec);
      const request = `The machine specification, I/O list and/or HMI changed${changed.length ? ` (spec sections: ${changed.join(', ')})` : ''}. Update the program to match, keep everything that still applies, and list each change in the explanation.\n\nCurrent specification:\n${specToText(spec)}`;
      const ioSet = new Set([...addresses.values()].filter(Boolean));
      const r = await reviseLadder(aiCfg, ctxP, prog.ladder, validateProgram(prog.ladder, profile, ioSet), [{ role: 'user', content: `Machine specification:\n${specToText(spec)}` }], request);
      prog.addChat({ role: 'user', text: 'Update the program for the latest spec, I/O and HMI changes.' });
      if (r.program) {
        prog.addChat({ role: 'assistant', text: r.explanation });
        prog.setProposal({ program: r.program, explanation: r.explanation, reasoning: r.reasoning, specUpdate: true });
        onStep({ step, status: 'proposal', message: 'Proposed changes are waiting for your approval on the PLC Program page.' });
      } else {
        prog.addChat({ role: 'assistant', text: r.explanation, outcome: 'no-change' });
        markProgram();
        onStep({ step, status: 'done', message: 'No program changes needed.' });
      }
      return true;
    }
  } catch (err) {
    onStep({ step, status: 'failed', message: err instanceof Error ? err.message : String(err) });
    return false;
  }
  return true;
}

/**
 * Ask for the PLC program's cycle steps before the program stage runs: the request needs only the I/O
 * list, its addresses and the spec. The program stage makes the same request and gets this answer
 * (still running or done) from the answer cache.
 */
function prefetchCycle(ctx: RunCtx, signal?: AbortSignal): void {
  if (!pipelining || !ctx.steps.includes('program') || stageMode('program') === 'quick') return;
  const settings = useSettingsStore.getState();
  if (!settings.anthropicApiKey || settings.provider !== 'anthropic') return;
  if (useProgramStore.getState().ladder.rungs.length) return; // an existing program is revised, not rebuilt
  const { plcId, cpuId, modules } = useProjectStore.getState();
  const profile = getProfile(plcId);
  if (profile.language !== 'ladder') return;
  const cpu = getCpu(profile, cpuId);
  const io = useIOStore.getState().projectIO;
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(modules));
  const wiring = new Map((useElectricalStore.getState().design?.ioWiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }]));
  const ai: AIConfig = { apiKey: settings.anthropicApiKey, model: settings.anthropicModel, effort: settings.effort, provider: 'anthropic', signal, cache: true };
  void generateRuleBasedProgram({ ai, ctx: { profile, cpu, io, addresses, wiring }, spec: specToText(useSpecStore.getState().sections), electrical: useElectricalStore.getState().design, hmi: null }).catch(() => { /* the program stage asks again */ });
}

/** After the I/O step: the CPU + modules must hold every point; missing modules are added (and become required parts). */
function ensureIoFits(io: { type: string; signal?: string }[]): { note?: string; error?: string } | null {
  const { cpuId, modules, recommendation } = useProjectStore.getState();
  const cpu = findCpu(cpuId);
  if (!cpu) return null;
  const n = (type: string, analog: boolean) => io.filter((p) => p.type === type && (p.signal === 'analog') === analog).length;
  const need: Need = { digitalInputs: n('input', false), digitalOutputs: n('output', false), analogInputs: n('input', true), analogOutputs: n('output', true), ethernetHmi: Boolean(useHmiStore.getState().hmiPartNumber), minHmiSizeIn: null };
  if (cpuFit(cpu, modules, need).ok) return null;
  const mods = modulesToFit(cpuId, modules, need);
  if (!mods) return { error: `${cpuId} with ${modules.length} module(s) cannot hold the ${need.digitalInputs} inputs / ${need.digitalOutputs} outputs of the I/O list, even with more modules: choose a bigger CPU on the Equipment page.` };
  applyEquipment({ cpuId, modules: mods, hmiPartNumber: useHmiStore.getState().hmiPartNumber || null }, recommendation);
  return { note: `Added ${mods.slice(modules.length).join(', ')} so the I/O list fits ${cpuId}.` };
}

