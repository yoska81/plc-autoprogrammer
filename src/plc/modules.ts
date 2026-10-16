import { getPart } from '../electrical/catalog';
import type { CpuModel, ModuleSlot } from './profile';

/** Discrete point counts of the chosen expansion modules, from the catalog. */
export function moduleSlots(partNumbers: string[]): ModuleSlot[] {
  return partNumbers.map((pn) => {
    const r = getPart(pn)?.ratings ?? {};
    return { partNumber: pn, inputs: Number(r.inputs ?? 0), outputs: Number(r.outputs ?? 0) };
  });
}

/** Total discrete inputs/outputs of CPU + modules (null when no modules chosen: capacity unknown). */
export function ioCapacity(cpu: CpuModel, slots: ModuleSlot[]): { inputs: number; outputs: number } {
  return {
    inputs: cpu.builtInInputs + slots.reduce((n, s) => n + s.inputs, 0),
    outputs: cpu.builtInOutputs + slots.reduce((n, s) => n + s.outputs, 0),
  };
}
