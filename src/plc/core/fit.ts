import { PLC_PROFILES } from './profiles';
import { moduleSlots, ioCapacity } from './modules';
import { getPart } from '../../electrical/catalog';
import type { HmiModel } from '../../hmi/hmiCatalog';
import type { CpuModel } from './profile';
import { driversOf, hmiCompatible, platformById, platformFit, type Platform } from './platforms';
import { panelPart } from '../../hmi/panels';

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

/**
 * Hardware platform of a CPU when its PLC profile names one (multi-vendor profiles set
 * `platformId`, see ./platforms.ts); CLICK CPUs have none and use the fit below.
 */
export function platformOf(cpuId: string): Platform | undefined {
  const profile = PLC_PROFILES.find((p) => p.cpuModels.some((c) => c.id === cpuId));
  // A CPU model may name its own platform (e.g. Micro820 vs Micro850 in one profile); else the profile's.
  const cpu = profile?.cpuModels.find((c) => c.id === cpuId) as { platformId?: string } | undefined;
  const id = cpu?.platformId ?? (profile as { platformId?: string } | undefined)?.platformId;
  return id ? platformById(id) : undefined;
}

const hasEthernet = (cpu: CpuModel) => /ethernet/i.test(cpu.label) || /^C2-0[13]/.test(cpu.id);
const builtInAnalog = (cpu: CpuModel) => (/analog/i.test(cpu.label) ? 2 : 0);

/** Does CPU + modules cover what the machine needs? Weaker options get a reason. */
export function cpuFit(cpu: CpuModel, modules: string[], need: Need): Fit {
  const platform = platformOf(cpu.id);
  if (platform) return platformFit(platform, cpu.id, modules, need);
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

/**
 * Can this touch panel be used with the chosen CPU? C-more panels: CLICK over Ethernet only.
 * Panels of other makers (parts catalog): the maker's PLC driver list / shared protocol
 * (hmiCompatible); with a CLICK CPU the maker's driver list must name CLICK.
 */
export function hmiFit(hmi: HmiModel, need: Need, cpuId?: string): Fit {
  let reason: string | null = null;
  const platform = cpuId ? platformOf(cpuId) : undefined;
  if (hmi.catalog) {
    const raw = getPart(hmi.partNumber);
    const part = raw ? panelPart(raw) : undefined;
    if (!part) reason = 'Not in the parts catalog.';
    else if (platform) reason = hmiCompatible(platform, part).reason;
    else if (!driversOf(part).includes('click')) reason = `CLICK is not in ${part.manufacturer}'s PLC driver list${part.ratings.plcDrivers === undefined ? ' (no driver list in the catalog yet)' : ''}.`;
  } else if (platform) reason = `C-more panels are set up for CLICK only; not checked with the ${platform.name}.`;
  else if (!hmi.supportsClickEthernet) reason = 'Cannot connect to CLICK over Ethernet.';
  if (!reason && need.minHmiSizeIn && hmi.sizeIn < need.minHmiSizeIn) reason = `Smaller than the ${need.minHmiSizeIn}" the screens need.`;
  return { ok: !reason, reason, spareIn: 0, spareOut: 0 };
}
