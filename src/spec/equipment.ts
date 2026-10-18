import { create } from 'zustand';
import { useProjectStore } from '../store/useProjectStore';
import { setProjectPanel } from '../hmi/retarget';
import { useElectricalStore } from '../store/useElectricalStore';
import { useStageStore } from '../store/useStageStore';
import { useSpecStore } from '../store/useSpecStore';
import { getPart } from '../electrical/catalog';
import { hasBuiltInPanel } from '../hmi/panels';
import { PLC_PROFILES } from '../plc/core/profiles';
import { fingerprint } from './types';
import { cpuFit, findCpu, modulesToFit } from '../plc/core/fit';
import { needFromIo } from './equipmentRules';
import { useIOStore } from '../store/useIOStore';
import { missingOperatorIo } from './operatorIo';
import { generatedToPoint } from '../lib/ai/ioAI';
import { modulesInSlotOrder, type EquipmentRecommendation } from '../lib/ai/equipmentAI';
import { withIoRemap } from '../plc/core/ioChange';
import { notify } from '../store/useNoticeStore';

export interface EquipmentChoice {
  cpuId: string;
  /** Expansion modules in slot order. */
  modules: string[];
  hmiPartNumber: string | null;
}

export function recommendedChoice(rec: EquipmentRecommendation): EquipmentChoice {
  // An all-in-one PLC (Unitronics) is its own touch screen.
  const own = hasBuiltInPanel(getPart(rec.plc.cpuId)) ? rec.plc.cpuId : null;
  return { cpuId: rec.plc.cpuId, modules: modulesInSlotOrder(rec), hmiPartNumber: own ?? rec.hmi?.partNumber ?? null };
}

/**
 * Apply an equipment choice (the AI's or the engineer's own) to the project:
 * PLC + CPU, expansion modules in slot order (drives addressing), HMI, and
 * the PLC parts the electrical design must use.
 */
/** Returns a warning when the door devices "No touch panel" adds do not fit the CPU even with more modules. */
export function applyEquipment(choice: EquipmentChoice, rec: EquipmentRecommendation | null): string | null {
  let warning: string | null = null;
  const project = useProjectStore.getState();
  const profile = PLC_PROFILES.find((p) => p.cpuModels.some((c) => c.id === choice.cpuId)) ?? PLC_PROFILES[0];
  // No touch panel: the I/O list gets the door pushbuttons, selector and lamps it still lacks — first, so the
  // modules are fitted to the list with them (spare capacity kept; more modules when the CPU runs short).
  const io = useIOStore.getState();
  const missing = choice.hmiPartNumber || !io.projectIO.length ? [] : missingOperatorIo(io.projectIO);
  let modules = choice.modules;
  if (missing.length) {
    const next = [...io.projectIO, ...missing.map(generatedToPoint)];
    const cpu = findCpu(choice.cpuId);
    // Keep the 20% spare when the choice had it; never fewer points than the list.
    const spare = cpu && cpuFit(cpu, modules, needFromIo(io.projectIO, false)).ok ? 0.2 : 0;
    const need = needFromIo(next, false, spare);
    if (cpu && !cpuFit(cpu, modules, need).ok) {
      const fitted = modulesToFit(choice.cpuId, modules, need) ?? modulesToFit(choice.cpuId, modules, needFromIo(next, false, 0));
      if (fitted) modules = fitted;
      else warning = `${choice.cpuId} cannot hold the I/O list with the ${missing.length} door devices for "No touch panel", even with more modules: choose a bigger CPU (the devices were added to the I/O list).`;
    }
  }
  // The new PLC / modules (and door devices) renumber the I/O: the program and the HMI follow (one remap).
  const remapped = withIoRemap(() => {
    if (missing.length) io.applyIOUpdate([], missing.map(generatedToPoint), []);
    project.setPlc(profile.id, choice.cpuId);
    project.setModules(modules.slice(0, 8));
  });
  if (remapped.length) notify(`The new PLC renumbered the I/O; the program and the HMI followed. ${remapped.join(' ')}`);
  if (rec) project.setRecommendation(rec);
  // A designed HMI follows a new panel (scaled to its resolution).
  setProjectPanel(choice.hmiPartNumber ?? '');

  // Required parts for the electrical design: replace earlier PLC/module picks, keep the rest.
  const el = useElectricalStore.getState();
  const keep = el.inputs.requiredParts.filter((r) => {
    const c = getPart(r.partNumber)?.category;
    return c !== 'plc' && c !== 'plcModule';
  });
  const counts = new Map<string, number>();
  if (getPart(choice.cpuId)) counts.set(choice.cpuId, 1);
  for (const m of modules) counts.set(m, (counts.get(m) ?? 0) + 1);
  el.setInputs({ ...el.inputs, requiredParts: [...keep, ...[...counts].map(([partNumber, quantity]) => ({ partNumber, quantity }))] });

  const spec = useSpecStore.getState().sections;
  useStageStore.getState().markGenerated('equipment', { specFp: fingerprint(spec), spec });
  return warning;
}

/**
 * A selection shown on the Equipment panel but not applied to the project yet: `apply` applies it
 * (null when there is none, or it does not fit). The New project wizard applies it on Next.
 */
export const usePendingEquipment = create<{ apply: (() => void) | null; label: string | null }>(() => ({ apply: null, label: null }));
