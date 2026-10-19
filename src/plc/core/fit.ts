import { PLC_PROFILES } from './profiles';
import { moduleSlots, ioCapacity } from './modules';
import { getPart } from '../../electrical/catalog';
import type { HmiModel } from '../../hmi/hmiCatalog';
import type { CatalogPart } from '../../electrical/types';
import type { AnalogChannel, CpuModel } from './profile';
import type { AnalogRange } from '../../types/io';
import { acceptsRange } from './analog';
import { driversOf, hmiCompatible, platformById, platformFit, plcModuleFor, suggestModules, type Platform } from './platforms';
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
  /** Signal range of every analog point (I/O list), when known: a current point needs a channel that takes current,
   * a thermocouple a thermocouple input (analogShortfall). Absent = counts only. */
  analogRanges?: { input: AnalogRange[]; output: AnalogRange[] };
}

/** Analog ranges of an I/O list, for Need.analogRanges. */
export function analogRangesOf(io: { type: string; signal?: string; analog?: { range: AnalogRange } }[]): NonNullable<Need['analogRanges']> {
  const of = (t: string) => io.filter((p) => p.type === t && p.signal === 'analog').map((p) => p.analog?.range ?? '4-20mA');
  return { input: of('input'), output: of('output') };
}

const FAMILY: Record<string, string> = { thermocouple: 'thermocouple', mA: 'current (mA)', V: 'voltage' };
const familyOf = (r: AnalogRange) => (r === 'thermocouple' ? 'thermocouple' : r.endsWith('mA') ? 'mA' : 'V');

/**
 * Analog points the CPU + modules cannot take by signal family (acceptsRange), matched like the address
 * assignment: thermocouples first, then current, then voltage, each on the free channel that takes the fewest
 * families. null when every point has a channel (or the profile publishes no channels).
 */
export function analogShortfall(cpu: CpuModel, modules: string[], need: Need): { kind: 'input' | 'output'; family: string; count: number; total: number } | null {
  if (!need.analogRanges) return null;
  const profile = PLC_PROFILES.find((p) => p.cpuModels.some((c) => c.id === cpu.id));
  const channels = profile?.analogChannels?.(cpu, moduleSlots(modules));
  if (!channels) return null;
  const breadth = (c: AnalogChannel) => (['thermocouple', '4-20mA', '0-10V'] as AnalogRange[]).filter((r) => acceptsRange(c, r)).length;
  let first: { kind: 'input' | 'output'; family: string; count: number } | null = null;
  let total = 0;
  for (const kind of ['input', 'output'] as const) {
    const free = channels.filter((c) => c.kind === kind).sort((a, b) => breadth(a) - breadth(b));
    const order = { thermocouple: 0, mA: 1, V: 2 } as Record<string, number>;
    const pts = [...need.analogRanges[kind]].sort((a, b) => order[familyOf(a)] - order[familyOf(b)]);
    const missing = new Map<string, number>();
    for (const r of pts) {
      const i = free.findIndex((c) => acceptsRange(c, r));
      if (i >= 0) free.splice(i, 1);
      else missing.set(familyOf(r), (missing.get(familyOf(r)) ?? 0) + 1);
    }
    const [fam, count] = [...missing.entries()][0] ?? [];
    if (fam && !first) first = { kind, family: FAMILY[fam], count: count! };
    for (const n of missing.values()) total += n;
  }
  return first ? { ...first, total } : null;
}

const shortfallText = (s: { kind: string; family: string; count: number }) => `No ${s.family} analog ${s.kind} for ${s.count} ${s.family} signal${s.count === 1 ? '' : 's'}.`;

export interface Fit {
  ok: boolean; reason: string | null; spareIn: number; spareOut: number;
  /** What else the pairing needs, for the buyer and the engineer ("PLC needs: CM 1243-5 DP master …"). */
  note?: string | null;
}

/**
 * What a catalog touch panel needs from this PLC beyond its driver: the interface module it reaches the PLC
 * through (plcModuleFor, src/plc/core/platforms.ts) and the Logix firmware it needs. A CP2E-E / CP2E-S has
 * only RS-232, so the GT21 panels that are RS-422/485 only cannot reach it at all (reason); a CP2E-N takes the
 * CP1W-CIF11 board; on the panels that also speak RS-232 the CP2E-E / S needs nothing.
 */
export function panelPlcNeeds(part: CatalogPart, platform: Platform, cpuId: string): { reason: string | null; note: string | null } {
  const notes: string[] = [];
  let text = plcModuleFor(part, platform.id);
  if (text && platform.id === 'omron-cp2e') {
    if (/^CP2E-[ES]/i.test(cpuId)) {
      if (/not with this panel/i.test(text)) return { reason: 'CP2E-E/S have RS-232 only; this panel is RS-422/485.', note: null };
      text = /E\/S: built-in RS-232/i.test(text) ? null : text;
    } else text = text.replace(/\s*\(.*\)\s*$/, '').replace(/\s+on a CP2E-N$/i, '');
  }
  if (text) notes.push(`PLC needs: ${text}`);
  const fw = Number(part.ratings.logixFirmwareMin ?? 0);
  if (fw && platform.vendor === 'allen-bradley') notes.push(`Needs Logix controller firmware V${fw} or later`);
  return { reason: null, note: notes.length ? notes.join(' · ') : null };
}

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
  if (platform) {
    const f = platformFit(platform, cpu.id, modules, need);
    const sf = f.ok ? analogShortfall(cpu, modules, need) : null;
    return sf ? { ...f, ok: false, reason: shortfallText(sf) } : f;
  }
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
  if (!reason) { const sf = analogShortfall(cpu, modules, need); if (sf) reason = shortfallText(sf); }
  return { ok: !reason, reason, spareIn, spareOut };
}

/**
 * Can this touch panel be used with the chosen CPU? C-more panels: CLICK over Ethernet only.
 * Panels of other makers (parts catalog): the maker's PLC driver list / shared protocol
 * (hmiCompatible); with a CLICK CPU the maker's driver list must name CLICK.
 */
export function hmiFit(hmi: HmiModel, need: Need, cpuId?: string): Fit {
  let reason: string | null = null;
  let note: string | null = null;
  const platform = cpuId ? platformOf(cpuId) : undefined;
  // A controller kept read only (a program read from a PLC the app cannot program yet): no panel is checked
  // against it, and none against CLICK in its place; the panel is picked once the PLC to move to is chosen.
  if (cpuId && !platform && PLC_PROFILES.some((p) => p.readOnly && p.cpuModels.some((c) => c.id === cpuId))) {
    return { ok: false, reason: `Choose the PLC first: the ${cpuId} is the machine's own controller, kept read only, and a panel is picked for the PLC it will talk to.`, spareIn: 0, spareOut: 0, note: null };
  }
  if (hmi.catalog) {
    const raw = getPart(hmi.partNumber);
    const part = raw ? panelPart(raw) : undefined;
    if (!part) reason = 'Not in the parts catalog.';
    // The screen of an all-in-one PLC comes only with that PLC.
    else if (hasBuiltInPanel(part)) reason = cpuId === part.partNumber ? null : `Built into the ${part.partNumber} PLC: choose it as the CPU.`;
    else if (platform) {
      reason = hmiCompatible(platform, part).reason;
      if (!reason) ({ reason, note } = panelPlcNeeds(part, platform, cpuId!));
    }
    else if (!driversOf(part).includes('click')) reason = `CLICK is not in ${part.manufacturer}'s PLC driver list${part.ratings.plcDrivers === undefined ? ' (no driver list in the catalog yet)' : ''}.`;
  } else if (platform) reason = `C-more panels are set up for CLICK only; not checked with the ${platform.name}.`;
  else if (!hmi.supportsClickEthernet) reason = 'Cannot connect to CLICK over Ethernet.';
  if (!reason && need.minHmiSizeIn && hmi.sizeIn < need.minHmiSizeIn) reason = `Smaller than the ${need.minHmiSizeIn}" the screens need.`;
  return { ok: !reason, reason, spareIn: 0, spareOut: 0, note: reason ? null : note };
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
    // Modules already chosen (an upgraded machine's own rack) stay: the suggestion and the signal modules are added
    // after them, then every added module the I/O does not need is dropped again.
    if (modules.length) {
      const grown = addForSignals(cpu, [...modules, ...suggestModules(platform, cpuId, need)], need, platform.modules, 32);
      if (grown && cpuFit(cpu, grown, need).ok) {
        let mods: string[] = grown;
        for (let i = mods.length - 1; i >= modules.length; i--) {
          const fewer: string[] = mods.filter((_, k) => k !== i);
          if (cpuFit(cpu, fewer, need).ok) mods = fewer;
        }
        return mods;
      }
    }
    const mods = addForSignals(cpu, suggestModules(platform, cpuId, need), need, platform.modules, 32);
    return mods && cpuFit(cpu, mods, need).ok ? mods : null;
  }
  const clickAll = ALL_PARTS.filter((p) => p.category === 'plcModule' && /^C0-/.test(p.partNumber));
  const click = clickAll.filter((p) => !/THM|RTD/i.test(p.partNumber));
  const mods = [...modules];
  for (let k = 0; k < 8 && mods.length < 8; k++) {
    const f = cpuFit(cpu, mods, need);
    if (f.ok) return mods;
    // a signal family no channel takes: the module that takes the most of the missing signals (C0-04AD-1, C0-04THM…)
    if (analogShortfall(cpu, mods, need) && f.spareIn >= 0 && f.spareOut >= 0) {
      const next = addForSignals(cpu, mods, need, clickAll.map((p) => p.partNumber), 8);
      if (!next) return null;
      mods.splice(0, mods.length, ...next);
      continue;
    }
    const key = f.spareIn < 0 ? 'inputs' : f.spareOut < 0 ? 'outputs' : /analog inputs/.test(f.reason ?? '') ? 'analogInputs' : /analog outputs/.test(f.reason ?? '') ? 'analogOutputs' : '';
    if (!key) return null;
    const best = click.map((p) => ({ p, n: Number(p.ratings[key] ?? 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
    if (!best) return null;
    mods.push(best.p.partNumber);
  }
  return cpuFit(cpu, mods, need).ok ? mods : null;
}

/** Modules added (from `pool`, one at a time) until no analog signal family is short; null when none helps. */
function addForSignals(cpu: CpuModel, modules: string[], need: Need, pool: string[], max: number): string[] | null {
  const mods = [...modules];
  const left = (m: string[]) => analogShortfall(cpu, m, need)?.total ?? 0;
  while (left(mods) && mods.length < max) {
    const before = left(mods);
    const best = pool
      .map((m) => ({ m, gain: before - left([...mods, m]) }))
      .filter((x) => x.gain > 0)
      .sort((a, b) => b.gain - a.gain)[0];
    if (!best) return null;
    mods.push(best.m);
  }
  return mods;
}
