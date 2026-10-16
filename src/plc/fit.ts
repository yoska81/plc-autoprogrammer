import { PLC_PROFILES } from './profiles';
import { moduleSlots, ioCapacity } from './modules';
import { getPart } from '../electrical/catalog';
import type { HmiModel } from '../hmi/hmiCatalog';
import type { CpuModel } from './profile';

export interface Need {
  digitalInputs: number;
  digitalOutputs: number;
  analogInputs: number;
  analogOutputs: number;
  /** A touch panel connected over Ethernet is planned. */
  ethernetHmi: boolean;
  /** Smallest screen size the AI found suitable, if any. */
  minHmiSizeIn: number | null;
}

export interface Fit { ok: boolean; reason: string | null; spareIn: number; spareOut: number }

export function findCpu(id: string): CpuModel | null {
  for (const p of PLC_PROFILES) {
    const c = p.cpuModels.find((x) => x.id === id);
    if (c) return c;
  }
  return null;
}

const hasEthernet = (cpu: CpuModel) => /ethernet/i.test(cpu.label) || /^C2-0[13]/.test(cpu.id);
const builtInAnalog = (cpu: CpuModel) => (/analog/i.test(cpu.label) ? 2 : 0);

/** Does CPU + modules cover what the machine needs? Weaker options get a reason. */
export function cpuFit(cpu: CpuModel, modules: string[], need: Need): Fit {
  const cap = ioCapacity(cpu, moduleSlots(modules));
  const aIn = builtInAnalog(cpu) + modules.reduce((n, m) => n + Number(getPart(m)?.ratings.analogInputs ?? 0), 0);
  const aOut = builtInAnalog(cpu) + modules.reduce((n, m) => n + Number(getPart(m)?.ratings.analogOutputs ?? 0), 0);
  const spareIn = cap.inputs - need.digitalInputs;
  const spareOut = cap.outputs - need.digitalOutputs;
  let reason: string | null = null;
  if (spareIn < 0) reason = `Only ${cap.inputs} inputs; ${need.digitalInputs} needed.`;
  else if (spareOut < 0) reason = `Only ${cap.outputs} outputs; ${need.digitalOutputs} needed.`;
  else if (need.analogInputs > aIn) reason = `No analog inputs for ${need.analogInputs} analog signals.`;
  else if (need.analogOutputs > aOut) reason = `No analog outputs for ${need.analogOutputs} analog signals.`;
  else if (need.ethernetHmi && !hasEthernet(cpu)) reason = 'No Ethernet port for the touch panel.';
  return { ok: !reason, reason, spareIn, spareOut };
}

export function hmiFit(hmi: HmiModel, need: Need): Fit {
  let reason: string | null = null;
  if (!hmi.supportsClickEthernet) reason = 'Cannot connect to CLICK over Ethernet.';
  else if (need.minHmiSizeIn && hmi.sizeIn < need.minHmiSizeIn) reason = `Smaller than the ${need.minHmiSizeIn}" the screens need.`;
  return { ok: !reason, reason, spareIn: 0, spareOut: 0 };
}
