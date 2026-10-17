import { bindProgress, finishProgress } from '../lib/ai/progress';
import { IS_PREVIEW } from '../preview/mode';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useSettingsStore } from '../store/useSettingsStore';
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
import { recommendEquipment, modulesInSlotOrder } from '../lib/ai/equipmentAI';
import { applyEquipment, recommendedChoice } from './equipment';
import { cpuFit, findCpu } from '../plc/core/fit';
import { generateRuleBasedDesign } from '../lib/ai/machineModelAI';
import { analogSetup } from '../plc/core/analog';
import { getPart } from '../electrical/catalog';
import { vendorPreference } from '../store/useProjectStore';
import { generateRuleBasedHmi } from '../lib/ai/hmiContentAI';
import { mergeRegenerated } from '../hmi/engine/regenerate';
import { reviseLadder } from '../plc/ai/ladderAI';
import { generateRuleBasedProgram } from '../plc/ai/cycleAI';
import { getHmi } from '../hmi/hmiCatalog';

export type UpdateStep = 'equipment' | 'io' | 'electrical' | 'hmi' | 'program';
export interface StepResult { step: UpdateStep; status: 'skipped' | 'done' | 'proposal' | 'failed'; message: string }

/**
 * Stages that can run at the same time: electrical and HMI both need only the I/O list; the PLC
 * program needs the electrical wiring and the HMI tags.
 */
export const UPDATE_GROUPS: UpdateStep[][] = [['equipment'], ['io'], ['electrical', 'hmi'], ['program']];

/**
 * Bring every out-of-date stage up to date from the current spec: equipment, then I/O, then
 * electrical and HMI together, then the PLC program. I/O, electrical and HMI are applied (previous
 * versions are kept by their stores where they support it); the PLC program change is left as a
 * proposal for the engineer to approve. A failed stage stops the stages after it.
 */
export async function runUpdateAll(steps: UpdateStep[], onStep: (r: StepResult) => void, opts: { signal?: AbortSignal; shouldStop?: () => boolean } = {}): Promise<void> {
  const { signal, shouldStop = () => false } = opts;
  for (const group of UPDATE_GROUPS) {
    const run = group.filter((s) => steps.includes(s));
    if (!run.length) continue;
    // "Stop after this stage": the stages not started yet are skipped
    if (shouldStop()) { for (const step of run) onStep({ step, status: 'skipped', message: 'Stopped before this stage.' }); continue; }
    // In the preview the viewer's Claude account answers one large request at a time more reliably.
    const ok: boolean[] = [];
    if (IS_PREVIEW) { for (const step of run) { ok.push(await runStep(step, onStep, signal)); if (!ok[ok.length - 1] || signal?.aborted) break; } }
    else ok.push(...(await Promise.all(run.map((step) => runStep(step, onStep, signal)))));
    if (ok.includes(false) || signal?.aborted) return; // later stages depend on these
  }
}

/** One stage; false when it failed. */
async function runStep(step: UpdateStep, onStep: (r: StepResult) => void, parent?: AbortSignal): Promise<boolean> {
  // Each stage gets its own signal (aborted with the whole update) so its progress shows on its own line.
  const ctrl = new AbortController();
  if (parent?.aborted) ctrl.abort(); else parent?.addEventListener('abort', () => ctrl.abort(), { once: true });
  bindProgress(ctrl.signal, step);
  let ok = false;
  try { ok = await runStepInner(step, onStep, ctrl.signal); } finally { finishProgress(step, ok); }
  return ok;
}

async function runStepInner(step: UpdateStep, onStep: (r: StepResult) => void, signal?: AbortSignal): Promise<boolean> {
  const settings = useSettingsStore.getState();
  const ai = { apiKey: settings.anthropicApiKey, model: settings.anthropicModel, effort: settings.effort, signal };
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

  {
    try {
      const { profile, cpu, slots } = plc();
      if (step === 'equipment') {
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
          applyEquipment(recommendedChoice(rec), rec);
          onStep({ step, status: 'done', message: `${rec.plc.cpuId}${cur.cpuId && cur.cpuId !== rec.plc.cpuId ? ` (was ${cur.cpuId}, no longer enough)` : ''}, ${modulesInSlotOrder(rec).length} module(s)${rec.hmi ? `, HMI ${rec.hmi.partNumber}` : ''}.` });
        }
        return true;
      }

      if (step === 'io') {
        const r = await generateIOFromSpec({ ...ai, spec, existing: ioNow(), profile, cpu });
        const plan = planIOMerge(ioNow(), r.points);
        useIOStore.getState().applyIOUpdate(
          plan.kept.map(({ point, next }) => keptUpdate(point, next)),
          plan.added.map(generatedToPoint),
          plan.removed.map((p) => p.id),
        );
        mark('io', { specFp, spec, ioFp: ioFingerprint(ioNow()) });
        onStep({ step, status: 'done', message: `${plan.added.length} added, ${plan.removed.length} removed, ${plan.kept.length} kept.` });
      }

      if (step === 'electrical') {
        const el = useElectricalStore.getState();
        const io = ioNow();
        // AI reads the machine model, the rule-based engine designs the panel (src/electrical/engine).
        const proj = useProjectStore.getState();
        const hmiState = useHmiStore.getState();
        const r = await generateRuleBasedDesign({
          ...ai, spec: specToText(spec), io, addresses: resolveAddresses(profile, cpu, io, slots), inputs: el.inputs, region: proj.info.region,
          pref: vendorPreference(), getPart, modules: proj.modules, analog: analogSetup(profile, cpu, slots, io),
          hmiPartNumber: hmiState.design?.hmiPartNumber || hmiState.hmiPartNumber || null, projectName: useProgramStore.getState().projectName,
          plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
        });
        el.setInputs(r.design.inputs);
        el.setDesign(r.design, 'generated', r.explanation);
        mark('electrical', { specFp, spec, ioFp: ioFingerprint(io) });
        onStep({ step, status: 'done', message: `${r.design.components.length} components${r.aiError ? ' (from the rules: the AI could not read the spec)' : ''}.` });
      }

      if (step === 'hmi') {
        const hmi = useHmiStore.getState();
        const model = getHmi(hmi.design?.hmiPartNumber ?? hmi.hmiPartNumber);
        if (!model) { onStep({ step, status: 'skipped', message: 'No HMI chosen.' }); return true; }
        const io = ioNow();
        // Rule-based screens from the I/O list; the AI only names things and adds the cycle steps (src/hmi/engine).
        const r = await generateRuleBasedHmi({
          ...ai, io, addresses: resolveAddresses(profile, cpu, io, slots), spec: specToText(spec), machineName: useProgramStore.getState().projectName,
          electrical: useElectricalStore.getState().design, panel: model, plcText: `${profile.vendor} ${cpu.label} · HMI ${model.partNumber}`,
          existingHmi: hmi.design, program: useProgramStore.getState().ladder,
        });
        // Keep the look the user picked (Siemens or dark console) across a regeneration.
        // Screens edited by hand are kept (re-bound to the new tags).
        const merged = mergeRegenerated(hmi.design, r.design).design;
        hmi.setDesign(hmi.design?.look ? { ...merged, look: hmi.design.look } : merged, r.explanation);
        mark('hmi', { specFp, spec, ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(merged) });
        onStep({ step, status: 'done', message: `${r.design.screens.length} screens, ${r.design.tags.length} tags.` });
      }

      if (step === 'program') {
        if (profile.language !== 'ladder') { onStep({ step, status: 'skipped', message: 'Update the Structured Text program from the Program page.' }); return true; }
        const prog = useProgramStore.getState();
        const io = ioNow();
        const addresses = resolveAddresses(profile, cpu, io, slots);
        const wiring = new Map((useElectricalStore.getState().design?.ioWiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }]));
        const hmi = useHmiStore.getState().design ?? undefined;
        const ctx = { profile, cpu, io, addresses, wiring, hmi };
        const aiCfg = { ...ai, provider: settings.provider };
        if (!prog.ladder.rungs.length) {
          // Standard blocks from the rules (every HMI tag implemented); the AI writes only the cycle block.
          const r = await generateRuleBasedProgram({ ai: aiCfg.apiKey ? aiCfg : undefined, ctx, spec: specToText(spec), electrical: useElectricalStore.getState().design, hmi: hmi ?? null });
          prog.setGeneratedLadder(r.program, r.explanation, r.reasoning);
          mark('program', { specFp, spec, ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(hmi ?? null) });
          onStep({ step, status: 'done', message: `${r.program.rungs.length} rungs written.` });
        } else {
          const changed = changedSections(useStageStore.getState().sources.program?.spec ?? null, spec);
          const request = `The machine specification, I/O list and/or HMI changed${changed.length ? ` (spec sections: ${changed.join(', ')})` : ''}. Update the program to match, keep everything that still applies, and list each change in the explanation.\n\nCurrent specification:\n${specToText(spec)}`;
          const ioSet = new Set([...addresses.values()].filter(Boolean));
          const r = await reviseLadder(aiCfg, ctx, prog.ladder, validateProgram(prog.ladder, profile, ioSet), [{ role: 'user', content: `Machine specification:\n${specToText(spec)}` }], request);
          prog.addChat({ role: 'user', text: 'Update the program for the latest spec, I/O and HMI changes.' });
          if (r.program) {
            prog.addChat({ role: 'assistant', text: r.explanation });
            prog.setProposal({ program: r.program, explanation: r.explanation, reasoning: r.reasoning, specUpdate: true });
            onStep({ step, status: 'proposal', message: 'Proposed changes are waiting for your approval on the PLC Program page.' });
          } else {
            prog.addChat({ role: 'assistant', text: r.explanation, outcome: 'no-change' });
            mark('program', { specFp, spec, ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(hmi ?? null) });
            onStep({ step, status: 'done', message: 'No program changes needed.' });
          }
        }
      }
    } catch (err) {
      onStep({ step, status: 'failed', message: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }
  return true;
}
