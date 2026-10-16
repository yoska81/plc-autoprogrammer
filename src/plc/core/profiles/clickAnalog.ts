/**
 * CLICK analog channels and their DF registers.
 *
 * AutomationDirect sources:
 * - Ethernet Analog / Analog CPUs (C0-12xxE-D, C0-02xx-D): 2 inputs AD1/AD2 (0-5 VDC on ADnV or
 *   4-20 mA sink on ADnI, one terminal per channel, type selected in the CPU built-in I/O setup) and
 *   2 outputs DA1/DA2 (DAnV / DAnI) — spec sheets c012dred.pdf, c002dd1d.pdf.
 * - C0-04AD-1: 4-channel current sinking input 0-20 mA, 13-bit, single ended, terminals CH1–CH4,
 *   0V (internally connected), external 24 VDC — spec sheet c004ad1.pdf.
 * - C0-04DA-1: 4-channel current sourcing output 4-20 mA, 12-bit, load 0–600 Ω at 24 VDC, terminals
 *   CH1–CH4, 0V, external 24 VDC — spec sheet c004da1.pdf.
 * - Every analog channel is given a DF register (floating point) in Setup > System Configuration,
 *   optionally as continuous addresses, and is scaled there from the input/output range to the
 *   engineering-unit "Scale Range" (with an optional range limiter); the program reads/writes the
 *   scaled value — CLICK help "C0-04DA-2 Settings" (Content/096.htm) and "CPU Built-in I/O Setup"
 *   (Content/209.htm). CLICK has no scaling instruction in ladder.
 *
 * Addressing used here (the engineer enters the same in System Configuration): channels in slot
 * order, CPU first, inputs before outputs within a module, DF1, DF2, … continuously.
 */
import { getPart } from '../../../electrical/catalog';
import type { AnalogRange } from '../../../types/io';
import type { AnalogChannel, CpuModel, ModuleSlot } from '../profile';

function rangesOf(signal: unknown, range: unknown, kind: 'input' | 'output'): AnalogRange[] {
  const r = String(range ?? '').replace(/\s/g, '');
  if (String(signal) === 'current') return kind === 'input' && r === '0-20mA' ? ['4-20mA', '0-20mA'] : ['4-20mA'];
  if (String(signal) === 'voltage') return r.includes('10') ? ['0-10V', '0-5V'] : ['0-5V'];
  return ['4-20mA'];
}

export function clickAnalogChannels(cpu: CpuModel, modules: ModuleSlot[]): AnalogChannel[] {
  const out: AnalogChannel[] = [];
  let df = 1;
  const r = getPart(cpu.id)?.ratings ?? {};
  const cpuIn = Number(r.analogInputs ?? (/analog/i.test(cpu.label) ? 2 : 0));
  const cpuOut = Number(r.analogOutputs ?? (/analog/i.test(cpu.label) ? 2 : 0));
  for (let c = 1; c <= cpuIn; c++) {
    out.push({ kind: 'input', slot: 0, channel: c, partNumber: cpu.id, label: `CPU AD${c}`, ranges: ['4-20mA', '0-5V'], terminals: [`AD${c}I`, `AD${c}V`], address: `DF${df++}` });
  }
  for (let c = 1; c <= cpuOut; c++) {
    out.push({ kind: 'output', slot: 0, channel: c, partNumber: cpu.id, label: `CPU DA${c}`, ranges: ['4-20mA', '0-5V'], terminals: [`DA${c}I`, `DA${c}V`], address: `DF${df++}` });
  }
  modules.forEach((m, i) => {
    const pr = getPart(m.partNumber)?.ratings ?? {};
    for (const kind of ['input', 'output'] as const) {
      const n = kind === 'input' ? m.analogInputs ?? 0 : m.analogOutputs ?? 0;
      for (let c = 1; c <= n; c++) {
        out.push({ kind, slot: i + 1, channel: c, partNumber: m.partNumber, label: `Slot ${i + 1} CH${c}`, ranges: rangesOf(pr.signal, pr.range, kind), terminals: [`CH${c}`, '0V'], address: `DF${df++}` });
      }
    }
  });
  return out;
}

/** Terminal a point with this range uses on the channel (CPU channels have separate V and I terminals). */
export function channelTerminal(ch: AnalogChannel, range: AnalogRange): string {
  if (ch.slot === 0) return ch.terminals.find((t) => (range.endsWith('mA') ? t.endsWith('I') : t.endsWith('V'))) ?? ch.terminals[0];
  return ch.terminals[0];
}
