/** Vendor-neutral analog helpers: which channel each analog I/O point uses. */
import { isAnalog, type IOPoint } from '../../types/io';
import type { AnalogChannel, CpuModel, ModuleSlot, PlcProfile } from './profile';

/**
 * Analog points → channels, in list order: each takes the first free channel of its kind that
 * accepts its range (else the first free one of its kind; none left = unassigned).
 * A manual address override pins the point to the channel with that register.
 */
export function assignAnalog(io: IOPoint[], channels: AnalogChannel[]): Map<string, AnalogChannel> {
  const out = new Map<string, AnalogChannel>();
  const used = new Set<string>();
  for (const p of io.filter(isAnalog)) {
    const manual = p.plcAddress?.trim().toUpperCase();
    const ch = manual ? channels.find((c) => c.address === manual) : undefined;
    if (ch) { out.set(p.id, ch); used.add(ch.address); }
  }
  for (const p of io.filter(isAnalog)) {
    if (out.has(p.id)) continue;
    const free = channels.filter((c) => c.kind === p.type && !used.has(c.address));
    const ch = free.find((c) => !p.analog || c.ranges.includes(p.analog.range)) ?? free[0];
    if (ch) { out.set(p.id, ch); used.add(ch.address); }
  }
  return out;
}

/** Analog channels of the project's PLC and the channel each analog point uses. */
export function analogMap(profile: PlcProfile, cpu: CpuModel, modules: ModuleSlot[], io: IOPoint[]) {
  const channels = profile.analogChannels?.(cpu, modules) ?? [];
  return { channels, byPoint: assignAnalog(io, channels) };
}

/** Analog channel counts the I/O list needs vs. what the PLC has. */
export function analogNeed(io: IOPoint[], channels: AnalogChannel[]) {
  const need = { input: io.filter((p) => isAnalog(p) && p.type === 'input').length, output: io.filter((p) => isAnalog(p) && p.type === 'output').length };
  const have = { input: channels.filter((c) => c.kind === 'input').length, output: channels.filter((c) => c.kind === 'output').length };
  return { need, have };
}
