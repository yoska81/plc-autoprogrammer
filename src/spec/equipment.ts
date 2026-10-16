import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useStageStore } from '../store/useStageStore';
import { useSpecStore } from '../store/useSpecStore';
import { getPart } from '../electrical/catalog';
import { PLC_PROFILES } from '../plc/profiles';
import { fingerprint } from './types';
import { modulesInSlotOrder, type EquipmentRecommendation } from '../lib/ai/equipmentAI';

export interface EquipmentChoice {
  cpuId: string;
  /** Expansion modules in slot order. */
  modules: string[];
  hmiPartNumber: string | null;
}

export function recommendedChoice(rec: EquipmentRecommendation): EquipmentChoice {
  return { cpuId: rec.plc.cpuId, modules: modulesInSlotOrder(rec), hmiPartNumber: rec.hmi?.partNumber ?? null };
}

/**
 * Apply an equipment choice (the AI's or the engineer's own) to the project:
 * PLC + CPU, expansion modules in slot order (drives addressing), HMI, and
 * the PLC parts the electrical design must use.
 */
export function applyEquipment(choice: EquipmentChoice, rec: EquipmentRecommendation | null) {
  const project = useProjectStore.getState();
  const profile = PLC_PROFILES.find((p) => p.cpuModels.some((c) => c.id === choice.cpuId)) ?? PLC_PROFILES[0];
  project.setPlc(profile.id, choice.cpuId);
  project.setModules(choice.modules.slice(0, 8));
  if (rec) project.setRecommendation(rec);
  useHmiStore.getState().setHmiPartNumber(choice.hmiPartNumber ?? '');

  // Required parts for the electrical design: replace earlier PLC/module picks, keep the rest.
  const el = useElectricalStore.getState();
  const keep = el.inputs.requiredParts.filter((r) => {
    const c = getPart(r.partNumber)?.category;
    return c !== 'plc' && c !== 'plcModule';
  });
  const counts = new Map<string, number>();
  if (getPart(choice.cpuId)) counts.set(choice.cpuId, 1);
  for (const m of choice.modules) counts.set(m, (counts.get(m) ?? 0) + 1);
  el.setInputs({ ...el.inputs, requiredParts: [...keep, ...[...counts].map(([partNumber, quantity]) => ({ partNumber, quantity }))] });

  const spec = useSpecStore.getState().sections;
  useStageStore.getState().markGenerated('equipment', { specFp: fingerprint(spec), spec });
}
