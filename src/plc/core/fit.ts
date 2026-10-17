import { PLC_PROFILES } from './profiles';
import { moduleSlots, ioCapacity } from './modules';
import { getPart } from '../../electrical/catalog';
import type { HmiModel } from '../../hmi/hmiCatalog';
import type { CpuModel } from './profile';
import { driversOf, hmiCompatible, platformById, platformFit, suggestModules, type Platform } from './platforms';
import { ALL_PARTS } from '../../electrical/catalogs';
import { hasBuiltInPanel, panelPart } from '../../hmi/panels';

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
    // The screen of an all-in-one PLC comes only with that PLC.
    else if (hasBuiltInPanel(part)) reason = cpuId === part.partNumber ? null : `Built into the ${part.partNumber} PLC: choose it as the CPU.`;
    else if (platform) reason = hmiCompatible(platform, part).reason;
    else if (!driversOf(part).includes('click')) reason = `CLICK is not in ${part.manufacturer}'s PLC driver list${part.ratings.plcDrivers === undefined ? ' (no driver list in the catalog yet)' : ''}.`;
  } else if (platform) reason = `C-more panels are set up for CLICK only; not checked with the ${platform.name}.`;
  else if (!hmi.supportsClickEthernet) reason = 'Cannot connect to CLICK over Ethernet.';
  if (!reason && need.minHmiSizeIn && hmi.sizeIn < need.minHmiSizeIn) reason = `Smaller than the ${need.minHmiSizeIn}" the screens need.`;
  return { ok: !reason, reason, spareIn: 0, spareOut: 0 };
}

/**
 * Modules that make `cpuId` cover `need`: the platform's own suggestion (multi-vendor), or for CLICK the
 * current modules plus the largest CLICK module for each shortfall (inputs, outputs, analog), at most 8.
 * null when no module set covers it (a bigger CPU is needed).
 */
export function modulesToFit(cpuId: string, modules: string[], need: Need): string[] | null {
  const cpu = findCpu(cpuId);
  if (!cpu) return null;
  if (cpuFit(cpu, modules, need).ok) return modules;
  const platform = platformOf(cpuId);
  if (platform) {
    const mods = suggestModules(platform, cpuId, need);
    return cpuFit(cpu, mods, need).ok ? mods : null;
  }
  const click = ALL_PARTS.filter((p) => p.category === 'plcModule' && /^C0-/.test(p.partNumber) && !/THM|RTD/i.test(p.partNumber));
  const mods = [...modules];
  for (let k = 0; k < 8 && mods.length < 8; k++) {
    const f = cpuFit(cpu, mods, need);
    if (f.ok) return mods;
    const key = f.spareIn < 0 ? 'inputs' : f.spareOut < 0 ? 'outputs' : /analog inputs/.test(f.reason ?? '') ? 'analogInputs' : /analog outputs/.test(f.reason ?? '') ? 'analogOutputs' : '';
    if (!key) return null;
    const best = click.map((p) => ({ p, n: Number(p.ratings[key] ?? 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
    if (!best) return null;
    mods.push(best.p.partNumber);
  }
  return cpuFit(cpu, mods, need).ok ? mods : null;
}

