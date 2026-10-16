/**
 * Analog part of the plant model: analog inputs (transmitters) with a simple
 * process behind them, and analog outputs read back from the PLC.
 *
 * Processes, chosen from the input's description (deterministic, plain data):
 * - level (tank / level): rises while a fill output is on (inlet / water / fill / feed /
 *   ingredient / supply valves and pumps), falls while a drain output is on
 *   (drain / transfer / outlet / discharge / empty). Full span in ~60 s fill / ~40 s drain.
 * - temperature (temp / temperature / heat): heats while a heat output is on (heat / steam /
 *   heater / burner; an analog output scales the rate by its % of span), cools toward ambient
 *   (20 % of span) otherwise.
 * - manual: stays where the slider puts it.
 * The slider always moves the value; a process continues from there.
 */
import { normAddress } from './engine';

export interface AnalogPoint {
  address: string;
  description: string;
  type: 'input' | 'output';
  min: number;
  max: number;
  units: string;
}

export type AnalogProcess = 'level' | 'temperature' | 'manual';

/** Same optional fields as the discrete devices (analog devices are never bypassed). */
interface AnalogBase { id: string; label: string; tag?: string; bypass?: { on: boolean; value: boolean } }

export interface AnalogInDevice extends AnalogBase {
  kind: 'analogIn';
  input: string;
  min: number;
  max: number;
  units: string;
  process: AnalogProcess;
  /** Discrete outputs / analog outputs that raise or lower the value. */
  raise: string[];
  lower: string[];
  state: { value: number };
}

export interface AnalogOutDevice extends AnalogBase {
  kind: 'analogOut';
  output: string;
  min: number;
  max: number;
  units: string;
}

const FILL_RE = /\b(fill|inlet|water|feed|ingredient|supply|charge|add)\b/i;
const DRAIN_RE = /\b(drain|transfer|outlet|discharge|empty|dump)\b/i;
const HEAT_RE = /\b(heat|heater|heating|steam|burner|jacket)\b/i;

export function processOf(description: string): AnalogProcess {
  if (/\b(level|tank)\b/i.test(description) && !/\btemp/i.test(description)) return 'level';
  if (/\b(temp|temperature|thermo|rtd)\b/i.test(description)) return 'temperature';
  return 'manual';
}

/** Analog devices for the analog points; `outputs` are all PLC outputs (discrete + analog) with descriptions. */
export function buildAnalogDevices(points: AnalogPoint[], outputs: { address: string; description: string }[]): (AnalogInDevice | AnalogOutDevice)[] {
  const out: (AnalogInDevice | AnalogOutDevice)[] = [];
  let n = 0;
  for (const p of points) {
    const address = normAddress(p.address);
    if (p.type === 'output') {
      out.push({ id: `aout${++n}`, kind: 'analogOut', label: p.description || address, output: address, min: p.min, max: p.max, units: p.units });
      continue;
    }
    const process = processOf(p.description);
    const pick = (re: RegExp) => outputs.filter((o) => re.test(o.description)).map((o) => normAddress(o.address));
    const raise = process === 'level' ? pick(FILL_RE).filter((a) => !pick(DRAIN_RE).includes(a)) : process === 'temperature' ? pick(HEAT_RE) : [];
    const lower = process === 'level' ? pick(DRAIN_RE) : [];
    const start = process === 'temperature' ? p.min + (p.max - p.min) * 0.2 : p.min;
    out.push({ id: `ain${++n}`, kind: 'analogIn', label: p.description || address, input: address, min: p.min, max: p.max, units: p.units, process, raise, lower, state: { value: start } });
  }
  return out;
}

/** Advance the processes; `bit` reads discrete outputs, `word` analog outputs (DF). */
export function stepAnalog(devices: (AnalogInDevice | AnalogOutDevice)[], bit: (a: string) => boolean, word: (a: string) => number, dtMs: number, analogOutputs: Map<string, AnalogOutDevice>) {
  const s = dtMs / 1000;
  for (const d of devices) {
    if (d.kind !== 'analogIn' || d.process === 'manual') continue;
    const span = d.max - d.min || 1;
    // an analog output drives in proportion to its value over its own span; a bit is 0 or 1
    const drive = (a: string) => {
      const ao = analogOutputs.get(a);
      if (ao) return Math.max(0, Math.min(1, (word(a) - ao.min) / (ao.max - ao.min || 1)));
      return bit(a) ? 1 : 0;
    };
    const up = d.raise.reduce((t, a) => t + drive(a), 0);
    const down = d.lower.reduce((t, a) => t + drive(a), 0);
    let v = d.state.value;
    if (d.process === 'level') v += span * (up / 60 - down / 40) * s;
    else {
      const ambient = d.min + span * 0.2;
      v += up > 0 ? span * 0.01 * up * s : (ambient - v) * Math.min(1, 0.02 * s);
    }
    d.state.value = Math.max(d.min, Math.min(d.max, v));
  }
}
