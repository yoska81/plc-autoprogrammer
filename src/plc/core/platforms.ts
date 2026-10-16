import { getPart } from '../../electrical/catalog';
import type { CatalogPart, VendorId } from '../../electrical/types';
import type { Fit, Need } from './fit';

/**
 * PLC hardware platforms of the multi-vendor catalogs, as data: which CPUs and
 * expansion modules belong together, their module limit (only where the
 * source states it), the Ethernet protocols, and HMI ↔ PLC compatibility.
 * Part numbers are those in src/electrical/catalogs; PLC profiles (one per
 * vendor family, docs/architecture/multi-vendor.md) point at a platform id.
 * CLICK keeps its own fit (./fit.ts).
 */

export type Protocol = 'EtherNet/IP' | 'PROFINET' | 'Modbus TCP';

export interface Platform {
  id: string;
  vendor: VendorId;
  name: string;
  /** CPU part numbers. */
  cpus: string[];
  /** Expansion I/O modules that fit these CPUs (accessories such as end caps are in `notes`). */
  modules: string[];
  /** Expansion modules per CPU when published and not in the CPU's own ratings (maxExpansionModules). */
  maxModules?: number;
  /** Modules that go in the CPU's plug-in slots (counted against its plugInSlots rating) instead of the expansion bus. */
  plugIns?: string[];
  /** Ethernet protocols the CPUs speak (for HMIs, drives and remote I/O). */
  protocols: Protocol[];
  /** What else to order or check, in plain words. */
  notes: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'ab-micro820', vendor: 'allen-bradley', name: 'Allen-Bradley Micro820',
    cpus: ['2080-L20E-20QBB', '2080-L20E-20QWB'],
    modules: ['2080-IF4', '2080-OF2', '2080-OB4'],
    plugIns: ['2080-IF4', '2080-OF2', '2080-OB4'],
    protocols: ['EtherNet/IP'],
    notes: 'Takes 2080 plug-in modules only (2 slots); 2085 expansion I/O does not fit the Micro820.',
  },
  {
    id: 'ab-micro850', vendor: 'allen-bradley', name: 'Allen-Bradley Micro850',
    cpus: ['2080-L50E-24QBB', '2080-L50E-24QWB', '2080-L50E-48QBB'],
    modules: ['2085-IQ16', '2085-OB16', '2085-OW16', '2085-IF4', '2085-OF4', '2080-IF4', '2080-OF2', '2080-OB4'],
    plugIns: ['2080-IF4', '2080-OF2', '2080-OB4'],
    protocols: ['EtherNet/IP'],
    notes: 'Up to 4 expansion modules (2085) and 3 plug-in modules (24-point) or 5 (48-point). The 2085 expansion bus needs a 2085-ECR end cap.',
  },
  {
    id: 'ab-compactlogix-5380', vendor: 'allen-bradley', name: 'Allen-Bradley CompactLogix 5380',
    cpus: ['5069-L306ER', '5069-L310ER', '5069-L320ER'],
    modules: ['5069-IB16', '5069-OB16', '5069-IF8', '5069-OF4', '5069-OF8'],
    protocols: ['EtherNet/IP'],
    notes: 'Every 5069 I/O module needs a 5069-RTB18-SCREW terminal block; the controller and the 5069-FPD field potential distributor need 5069-RTB64-SCREW.',
  },
  {
    id: 'siemens-s7-1200', vendor: 'siemens', name: 'Siemens S7-1200',
    cpus: ['6ES7212-1AE40-0XB0', '6ES7214-1AG40-0XB0', '6ES7215-1AG40-0XB0'],
    modules: ['6ES7221-1BH32-0XB0', '6ES7222-1BH32-0XB0', '6ES7223-1BL32-0XB0', '6ES7231-4HD32-0XB0', '6ES7232-4HB32-0XB0'],
    protocols: ['PROFINET'],
    notes: 'Signal modules plug in on the right of the CPU: 2 on the 1212C, 8 on the 1214C / 1215C.',
  },
  {
    id: 'siemens-s7-1200-g2', vendor: 'siemens', name: 'Siemens S7-1200 G2',
    cpus: ['6ES7214-1AH50-0XB0', '6ES7212-1AG50-0XB0'],
    modules: [],
    protocols: ['PROFINET'],
    notes: 'Built-in I/O only here: G2 expansion modules are not in the catalog yet (the S7-1200 G1 signal modules are not confirmed for G2).',
  },
  {
    id: 'siemens-s7-1500', vendor: 'siemens', name: 'Siemens S7-1500 + ET 200SP',
    cpus: ['6ES7511-1AL03-0AB0', '6ES7513-1AM03-0AB0'],
    modules: ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0', '6ES7134-6GD01-0BA1', '6ES7135-6HD00-0BA1'],
    protocols: ['PROFINET'],
    notes: 'The CPU has no I/O of its own: the I/O is an ET 200SP station (IM 155-6 PN ST 6ES7155-6AU01-0BN0 with BusAdapter 6ES7193-6AR00-0AA0, one BaseUnit per module, server module 6ES7193-6PA00-0AA0). The CPU needs a SIMATIC Memory Card (6ES7954-8LE03-0AA0).',
  },
  {
    id: 'schneider-m221', vendor: 'schneider', name: 'Schneider Modicon M221',
    cpus: ['TM221CE24T', 'TM221CE40T', 'TM221ME16T'],
    modules: ['TM3DI16', 'TM3DQ16T', 'TM3DQ16R', 'TM3AI4', 'TM3AQ2', 'TM3AM6'],
    protocols: ['EtherNet/IP', 'Modbus TCP'],
    notes: 'Up to 7 local TM3 modules (more through a TM3BCEIP coupler). The M221 is an EtherNet/IP adapter only (it cannot scan EtherNet/IP devices).',
  },
  {
    id: 'schneider-m241', vendor: 'schneider', name: 'Schneider Modicon M241',
    cpus: ['TM241CE24T', 'TM241CEC24T', 'TM241CE40T'],
    modules: ['TM3DI16', 'TM3DQ16T', 'TM3DQ16R', 'TM3AI4', 'TM3AQ2', 'TM3AM6'],
    protocols: ['EtherNet/IP', 'Modbus TCP'],
    notes: 'Up to 7 local TM3 modules (more through a TM3BCEIP coupler). EtherNet/IP scanner and Modbus TCP client built in.',
  },
];

export const platformById = (id: string) => PLATFORMS.find((p) => p.id === id);
export const platformOfCpu = (cpu: string) => PLATFORMS.find((p) => p.cpus.includes(cpu));
export const platformsOf = (vendors: VendorId[]) => PLATFORMS.filter((p) => vendors.includes(p.vendor));

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** I/O a CPU plus modules provide, from the catalog ratings. */
export function platformCapacity(cpu: CatalogPart, modules: string[]) {
  const parts = modules.map((m) => getPart(m)).filter((p): p is CatalogPart => Boolean(p));
  const sum = (k: string) => parts.reduce((n, p) => n + num(p.ratings[k]), 0);
  return {
    inputs: num(cpu.ratings.discreteInputs) + sum('inputs'),
    outputs: num(cpu.ratings.discreteOutputs) + sum('outputs'),
    analogInputs: num(cpu.ratings.analogInputs) + sum('analogInputs'),
    analogOutputs: num(cpu.ratings.analogOutputs) + sum('analogOutputs'),
  };
}

/** Module limits of a CPU: its own ratings, else the platform's; undefined = not published (no check). */
export function moduleLimits(platform: Platform, cpu: CatalogPart): { expansion?: number; plugIn?: number } {
  const r = cpu.ratings;
  return {
    expansion: typeof r.maxExpansionModules === 'number' ? r.maxExpansionModules : platform.maxModules,
    plugIn: typeof r.plugInSlots === 'number' ? r.plugInSlots : undefined,
  };
}

const isPlugIn = (platform: Platform, m: string) => Boolean(platform.plugIns?.includes(m));

/** Does this CPU + modules cover the machine? Same reasons as the CLICK fit. */
export function platformFit(platform: Platform, cpuPn: string, modules: string[], need: Need): Fit {
  const cpu = getPart(cpuPn);
  if (!cpu || !platform.cpus.includes(cpuPn)) return { ok: false, reason: `${cpuPn} is not a ${platform.name} CPU.`, spareIn: 0, spareOut: 0 };
  const cap = platformCapacity(cpu, modules);
  const spareIn = cap.inputs - need.digitalInputs;
  const spareOut = cap.outputs - need.digitalOutputs;
  const limits = moduleLimits(platform, cpu);
  const plugs = modules.filter((m) => isPlugIn(platform, m)).length;
  const exps = modules.length - plugs;
  const foreign = modules.find((m) => !platform.modules.includes(m));
  let reason: string | null = null;
  if (foreign) reason = `${foreign} does not fit the ${platform.name}.`;
  else if (limits.plugIn !== undefined && plugs > limits.plugIn) reason = `Has ${limits.plugIn} plug-in slots; ${plugs} plug-in modules chosen.`;
  else if (limits.expansion !== undefined && exps > limits.expansion) reason = limits.expansion ? `Takes at most ${limits.expansion} expansion modules; ${exps} chosen.` : 'Takes no expansion modules.';
  else if (spareIn < 0) reason = `Only ${cap.inputs} inputs; ${need.digitalInputs} needed.`;
  else if (spareOut < 0) reason = `Only ${cap.outputs} outputs; ${need.digitalOutputs} needed.`;
  else if (need.analogInputs > cap.analogInputs) reason = `No analog inputs for ${need.analogInputs} analog signals.`;
  else if (need.analogOutputs > cap.analogOutputs) reason = `No analog outputs for ${need.analogOutputs} analog signals.`;
  else if (need.ethernetHmi && !platform.protocols.length) reason = 'No Ethernet port for the touch panel.';
  return { ok: !reason, reason, spareIn, spareOut };
}

/** Ethernet protocols named in a part's ratings. */
export function protocolsOf(p: CatalogPart): Protocol[] {
  const t = String(p.ratings.protocols ?? '');
  const out: Protocol[] = [];
  if (/ethernet\/ip/i.test(t)) out.push('EtherNet/IP');
  if (/profinet/i.test(t)) out.push('PROFINET');
  if (/modbus\s*tcp/i.test(t)) out.push('Modbus TCP');
  return out;
}

/**
 * Can this touch panel talk to the platform? Same brand: yes unless its
 * protocols are stated and don't match. Another brand: only when a shared
 * Ethernet protocol is stated for the panel.
 */
export function hmiCompatible(platform: Platform, hmi: CatalogPart): { ok: boolean; reason: string | null } {
  const hp = protocolsOf(hmi);
  const shared = hp.filter((x) => platform.protocols.includes(x));
  if (hmi.vendor === platform.vendor) {
    if (hp.length && !shared.length) return { ok: false, reason: `Speaks ${hp.join(' / ')}; the ${platform.name} speaks ${platform.protocols.join(' / ')}.` };
    return { ok: true, reason: null };
  }
  if (shared.length) return { ok: true, reason: null };
  return { ok: false, reason: hp.length ? `Speaks ${hp.join(' / ')}; the ${platform.name} speaks ${platform.protocols.join(' / ')}.` : `Not confirmed to talk to the ${platform.name}.` };
}

/**
 * Smallest set of expansion modules (greedy, in the platform's module order)
 * that covers the machine's I/O on this CPU; stops at the module limit.
 */
export function suggestModules(platform: Platform, cpuPn: string, need: Need): string[] {
  const cpu = getPart(cpuPn);
  if (!cpu) return [];
  const limits = moduleLimits(platform, cpu);
  const mods: string[] = [];
  const room = (m: string) => {
    const plug = isPlugIn(platform, m);
    const used = mods.filter((x) => isPlugIn(platform, x) === plug).length;
    const max = plug ? limits.plugIn : limits.expansion;
    return max === undefined || used < max;
  };
  const best = (key: string) => platform.modules
    .filter(room)
    .map((m) => ({ m, n: num(getPart(m)?.ratings[key]) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0]?.m;
  const short = () => {
    const cap = platformCapacity(cpu, mods);
    return [
      ['inputs', need.digitalInputs - cap.inputs], ['outputs', need.digitalOutputs - cap.outputs],
      ['analogInputs', need.analogInputs - cap.analogInputs], ['analogOutputs', need.analogOutputs - cap.analogOutputs],
    ].find(([, n]) => Number(n) > 0)?.[0] as string | undefined;
  };
  for (let k = short(); k && mods.length < 32; k = short()) {
    const m = best(k);
    if (!m) break;
    mods.push(m);
  }
  return mods;
}
