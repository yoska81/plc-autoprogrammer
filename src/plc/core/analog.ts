/** Vendor-neutral analog helpers: which channel each analog I/O point uses. */
import { isAnalog, type AnalogRange, type IOPoint } from '../../types/io';
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

/** One analog channel the engineer sets up in the PLC software (CLICK: Setup > System Configuration). */
export interface AnalogSetupRow {
  pointId: string;
  description: string;
  kind: 'input' | 'output';
  channel: string;
  partNumber: string;
  terminal: string;
  address: string;
  range: string;
  scaleMin: number;
  scaleMax: number;
  units: string;
}

/** Analog setup table: every analog point with its channel, terminal, register, signal range and scale. */
/** Terminal a point with this range uses (channels with separate current / voltage terminals: …I / …V). */
export function channelTerminal(ch: AnalogChannel, range: AnalogRange): string {
  if (ch.terminals.some((t) => /[IV]$/.test(t))) return ch.terminals.find((t) => (range.endsWith('mA') ? t.endsWith('I') : t.endsWith('V'))) ?? ch.terminals[0];
  return ch.terminals[0];
}

export function analogSetup(profile: PlcProfile, cpu: CpuModel, modules: ModuleSlot[], io: IOPoint[]): AnalogSetupRow[] {
  const { byPoint } = analogMap(profile, cpu, modules, io);
  return io.filter(isAnalog).map((p) => {
    const ch = byPoint.get(p.id);
    const range: AnalogRange = p.analog?.range ?? '4-20mA';
    return {
      pointId: p.id, description: p.description, kind: p.type,
      channel: ch?.label ?? '(no free channel)', partNumber: ch?.partNumber ?? '', terminal: ch ? channelTerminal(ch, range) : '',
      address: ch?.address ?? '', range, scaleMin: p.analog?.min ?? 0, scaleMax: p.analog?.max ?? 100, units: p.analog?.units ?? '',
    };
  });
}

const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;

export function analogSetupCsv(rows: AnalogSetupRow[]): string {
  return ['Point,Description,Direction,Channel,Part number,Terminal,Data register,Signal range,Scale min,Scale max,Units',
    ...rows.map((r) => [r.pointId, r.description, r.kind, r.channel, r.partNumber, r.terminal, r.address, r.range, r.scaleMin, r.scaleMax, r.units].map(q).join(','))].join('\r\n');
}

/** Plain-text section for the rung listing / printout. */
export function analogSetupText(rows: AnalogSetupRow[]): string {
  if (!rows.length) return '';
  const lines = rows.map((r) => `  ${r.address.padEnd(6)} ${r.channel.padEnd(12)} ${r.terminal.padEnd(5)} ${r.range.padEnd(7)} → ${r.scaleMin}…${r.scaleMax} ${r.units}   ${r.description}`);
  return `ANALOG SETUP — enter in Setup > System Configuration (each channel: Data Register = the DF below, Input/Output Range = the signal range, Scale Range = the engineering range, Enable Range Limiter on):\n${lines.join('\n')}\n`;
}
