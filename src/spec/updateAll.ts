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
import { generateElectricalDesign } from '../lib/ai/electricalAI';
import { generateHmiDesign } from '../lib/ai/hmiAI';
import { reviseLadder, generateLadder } from '../plc/ai/ladderAI';
import { getHmi, CLICK_HMI_COMMUNICATION, HMI_DESIGN_GUIDELINES } from '../hmi/hmiCatalog';

export type UpdateStep = 'equipment' | 'io' | 'electrical' | 'hmi' | 'program';
export interface StepResult { step: UpdateStep; status: 'skipped' | 'done' | 'proposal' | 'failed'; message: string }

/**
 * Bring every out-of-date stage up to date, in order, from the current spec.
 * I/O, electrical and HMI are applied (previous versions are kept by their
 * stores where they support it); the PLC program change is left as a
 * proposal for the engineer to approve.
 */
export async function runUpdateAll(steps: UpdateStep[], onStep: (r: StepResult) => void): Promise<void> {
  const settings = useSettingsStore.getState();
  const ai = { apiKey: settings.anthropicApiKey, model: settings.anthropicModel, effort: settings.effort };
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

  for (const step of steps) {
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
        continue;
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
        const r = await generateElectricalDesign({ ...ai, profile, cpu, io, addresses: resolveAddresses(profile, cpu, io, slots), machineDescription: specToText(spec), inputs: el.inputs, region: useProjectStore.getState().info.region });
        el.setInputs(r.design.inputs);
        el.setDesign(r.design, 'generated', r.explanation);
        mark('electrical', { specFp, spec, ioFp: ioFingerprint(io) });
        onStep({ step, status: 'done', message: `${r.design.components.length} components.` });
      }

      if (step === 'hmi') {
        const hmi = useHmiStore.getState();
        const model = getHmi(hmi.design?.hmiPartNumber ?? hmi.hmiPartNumber);
        if (!model) { onStep({ step, status: 'skipped', message: 'No HMI chosen.' }); continue; }
        const io = ioNow();
        const r = await generateHmiDesign({ ...ai, hmi: model, guidelines: HMI_DESIGN_GUIDELINES, comms: CLICK_HMI_COMMUNICATION, spec, io, addresses: resolveAddresses(profile, cpu, io, slots), profile, cpu });
        hmi.setDesign(r.design, r.explanation);
        mark('hmi', { specFp, spec, ioFp: ioFingerprint(io), hmiFp: hmiFingerprint(r.design) });
        onStep({ step, status: 'done', message: `${r.design.screens.length} screens, ${r.design.tags.length} tags.` });
      }

      if (step === 'program') {
        if (profile.language !== 'ladder') { onStep({ step, status: 'skipped', message: 'Update the Structured Text program from the Program page.' }); continue; }
        const prog = useProgramStore.getState();
        const io = ioNow();
        const addresses = resolveAddresses(profile, cpu, io, slots);
        const wiring = new Map((useElectricalStore.getState().design?.ioWiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }]));
        const hmi = useHmiStore.getState().design ?? undefined;
        const ctx = { profile, cpu, io, addresses, wiring, hmi };
        const aiCfg = { ...ai, provider: settings.provider };
        if (!prog.ladder.rungs.length) {
          const r = await generateLadder(aiCfg, ctx, specToText(spec));
          if (!r.program) throw new Error('No program returned.');
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
      return; // later stages depend on this one
    }
  }
}
