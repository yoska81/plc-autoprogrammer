import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useStageStore } from '../store/useStageStore';
import { useSpecStore } from '../store/useSpecStore';
import { getPart } from '../electrical/catalog';
import { fingerprint } from './types';
import { modulesInSlotOrder, type EquipmentRecommendation } from '../lib/ai/equipmentAI';

/**
 * Apply an equipment choice to the project: PLC + CPU, expansion modules in
 * slot order (drives addressing), HMI, and the PLC parts the electrical
 * design must use. `cpuId`/`hmiPartNumber` override the recommendation when
 * the user picked an alternative.
 */
export function applyEquipment(rec: EquipmentRecommendation, cpuId = rec.plc.cpuId, hmiPartNumber = rec.hmi?.partNumber ?? null) {
  const project = useProjectStore.getState();
  const modules = modulesInSlotOrder(rec);
  project.setPlc(rec.plc.profileId, cpuId);
  project.setModules(modules);
  project.setRecommendation(rec);
  useHmiStore.getState().setHmiPartNumber(hmiPartNumber ?? '');

  // Required parts for the electrical design: replace earlier PLC/module picks, keep the rest.
  const el = useElectricalStore.getState();
  const keep = el.inputs.requiredParts.filter((r) => {
    const c = getPart(r.partNumber)?.category;
    return c !== 'plc' && c !== 'plcModule';
  });
  const counts = new Map<string, number>();
  if (getPart(cpuId)) counts.set(cpuId, 1);
  for (const m of modules) counts.set(m, (counts.get(m) ?? 0) + 1);
  el.setInputs({ ...el.inputs, requiredParts: [...keep, ...[...counts].map(([partNumber, quantity]) => ({ partNumber, quantity }))] });

  const spec = useSpecStore.getState().sections;
  useStageStore.getState().markGenerated('equipment', { specFp: fingerprint(spec), spec });
}
