import { getProfile, PLC_PROFILES } from '../plc/core/profiles';
import { analogRangesOf, cpuFit, findCpu, modulesToFit, type Need } from '../plc/core/fit';
import type { AnalogRange } from '../types/io';
import type { EquipmentChoice } from './equipment';

/**
 * Equipment from the I/O list, no AI (Update's "Quick" equipment): the I/O counts plus about 20 %
 * spare decide the CPU and modules. The engineer's CPU is kept while it covers them (modules are
 * added when short); otherwise the CPU of the same PLC family that needs the fewest modules, the
 * smallest first. The HMI stays as chosen.
 */
export function needFromIo(io: { type: string; signal?: string; analog?: { range: AnalogRange } }[], ethernetHmi: boolean, spare = 0.2): Need {
  const n = (type: string, analog: boolean) => io.filter((p) => p.type === type && (p.signal === 'analog') === analog).length;
  const up = (x: number) => (x ? Math.ceil(x * (1 + spare)) : 0);
  return { digitalInputs: up(n('input', false)), digitalOutputs: up(n('output', false)), analogInputs: n('input', true), analogOutputs: n('output', true), ethernetHmi, minHmiSizeIn: null, analogRanges: analogRangesOf(io) };
}

export function rulesEquipment(io: { type: string; signal?: string; analog?: { range: AnalogRange } }[], cur: { plcId: string; cpuId: string; modules: string[]; hmiPartNumber: string | null }): (EquipmentChoice & { kept: boolean }) | null {
  const need = needFromIo(io, Boolean(cur.hmiPartNumber));
  const curCpu = findCpu(cur.cpuId);
  if (curCpu) {
    if (cpuFit(curCpu, cur.modules, need).ok) return { cpuId: cur.cpuId, modules: cur.modules, hmiPartNumber: cur.hmiPartNumber, kept: true };
  }
  const profile = PLC_PROFILES.find((p) => p.cpuModels.some((c) => c.id === cur.cpuId)) ?? getProfile(cur.plcId);
  const options = profile.cpuModels
    .map((c) => ({ cpu: c, mods: modulesToFit(c.id, [], need) }))
    .filter((x): x is { cpu: typeof x.cpu; mods: string[] } => Boolean(x.mods))
    .sort((a, b) => a.mods.length - b.mods.length || (a.cpu.builtInInputs + a.cpu.builtInOutputs) - (b.cpu.builtInInputs + b.cpu.builtInOutputs));
  // The current CPU with modules added beats a CPU change when it needs no more modules than the best other one.
  const withMods = curCpu ? modulesToFit(cur.cpuId, cur.modules, need) : null;
  if (withMods && (!options.length || withMods.length <= options[0].mods.length)) return { cpuId: cur.cpuId, modules: withMods, hmiPartNumber: cur.hmiPartNumber, kept: true };
  const best = options[0];
  return best ? { cpuId: best.cpu.id, modules: best.mods, hmiPartNumber: cur.hmiPartNumber, kept: false } : null;
}
