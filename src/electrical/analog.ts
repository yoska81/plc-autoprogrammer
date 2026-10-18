/**
 * Analog field wiring (4-20 mA / 0-10 V) derived from the PLC's analog setup.
 *
 * Practice (NFPA 79 / manufacturer instructions — AutomationDirect C0-04AD-1 / C0-04DA-1
 * wiring diagrams, CLICK analog CPU spec sheets):
 * - one shielded twisted pair per analog signal, never in the same cable as power or
 *   discrete 24 V signals; the shield (drain wire) is grounded at ONE end only — the panel
 *   end, on the ground terminal next to the signal terminals — and cut back and insulated
 *   at the field device;
 * - 4-20 mA inputs: 2-wire (loop-powered) transmitters get +24 VDC from the panel supply
 *   ("24+") on their + terminal and return the loop current on − to the input channel
 *   (C0-04AD-1 CHn; analog CPU ADnI); the module's 0V is the loop return;
 * - voltage inputs (0-5 / 0-10 V): signal + to the channel (ADnV / CHn), signal − to 0V,
 *   the device powered separately;
 * - 4-20 mA outputs (sourcing, C0-04DA-1 CHn / DAnI): channel → device +, device − → 0V,
 *   load ≤ 600 Ω at 24 VDC.
 * Every conductor goes through the analog terminal strip TBA; terminals per signal:
 * +, −, shield (ground).
 */
import type { AnalogSetupRow } from '../plc/core/analog';
import type { IOWiring } from './types';

export interface AnalogWire { wire: string; from: string; to: string; color: string; size: string; function: string }
export interface AnalogTerminal { strip: string; number: number; label: string; wire: string; internal: string; external: string; kind: 'feed' | 'ground' | 'spare'; group: string }
export interface AnalogCableCore { core: string; color: string; wire: string; from: string; to: string }
export interface AnalogCable {
  tag: string; kind: 'device'; zone: string; from: string; to: string; type: string; partNumber?: string;
  size: string; length: string; cores: AnalogCableCore[]; spareCores: number;
}

export interface AnalogCircuit {
  row: AnalogSetupRow;
  /** Field device tag (from the I/O wiring, else LT1 / TT1 / AI1 / AO1…). */
  deviceTag: string;
  /** PLC / module device tag the channel belongs to. */
  moduleTag: string;
  loop: 'two-wire' | 'voltage' | 'output' | 'thermocouple';
  zone: string;
  cable: string;
  /** TBA terminals for + / − / shield. */
  plus: string;
  minus: string;
  shield: string;
  /** Wire numbers along the loop. */
  wires: { plus: string; minus: string };
  /** Set when the signal goes to a device inside the panel (e.g. a VFD speed input): no TBA, no field cable. */
  internal?: { tag: string; plus: string; minus: string };
}

export interface AnalogWiring {
  circuits: AnalogCircuit[];
  wires: AnalogWire[];
  strip: { tag: string; title: string; terminals: AnalogTerminal[]; endPlates: number; endStops: number } | null;
  cables: AnalogCable[];
}

/** Device tag prefix from the measured variable (ISA-5.1 letters). */
function tagPrefix(row: AnalogSetupRow): string {
  const d = row.description.toLowerCase();
  if (row.kind === 'output') return /\b(speed|vfd|drive|hz)\b/.test(d) ? 'SC' : /\bvalve\b/.test(d) ? 'FV' : 'AO';
  if (/\blevel\b/.test(d)) return 'LT';
  if (/\b(temp|temperature|rtd)\b/.test(d)) return 'TT';
  if (/\bpressure\b/.test(d)) return 'PT';
  if (/\bflow\b/.test(d)) return 'FT';
  if (/\b(weight|load cell|scale)\b/.test(d)) return 'WT';
  return 'AI';
}

export interface AnalogOptions {
  /** Device tag of the PLC CPU and of the expansion module in each slot (1…). */
  plcTag: string;
  moduleTag: (slot: number, partNumber: string) => string;
  /** Ground bar / PE terminal the shields go to. */
  groundBar: string;
  /** Next cable number (W###) after the discrete cables. */
  firstCable: number;
  ioWiring: IOWiring[];
  /** Analog points wired to a device inside the panel (address → device tag and its +/− terminals). */
  internal?: Map<string, { tag: string; plus: string; minus: string }>;
}

const slotOf = (channel: string) => (/^Slot (\d+)/.exec(channel)?.[1] ? Number(/^Slot (\d+)/.exec(channel)![1]) : 0);

export function analogWiring(rows: AnalogSetupRow[], o: AnalogOptions): AnalogWiring {
  const assigned = rows.filter((r) => r.address);
  if (!assigned.length) return { circuits: [], wires: [], strip: null, cables: [] };
  const wiringBy = new Map(o.ioWiring.map((w) => [w.address.toUpperCase(), w]));
  const counts = new Map<string, number>();
  const terminals: AnalogTerminal[] = [];
  const wires: AnalogWire[] = [];
  const cables: AnalogCable[] = [];
  const circuits: AnalogCircuit[] = [];
  let tn = 0;
  let cable = o.firstCable;
  for (const row of assigned) {
    const inside = o.internal?.get(row.address);
    if (inside) {
      // Panel-internal loop (e.g. PLC analog output → VFD speed input): shielded pair inside the panel,
      // shield grounded at the PLC end only.
      const slot = slotOf(row.channel);
      const moduleTag = slot === 0 ? o.plcTag : o.moduleTag(slot, row.partNumber);
      const wp = `${row.address}+`, wm = `${row.address}-`;
      const fn = `${row.description} (${row.range}, ${row.scaleMin}…${row.scaleMax} ${row.units})`;
      wires.push({ wire: wp, from: `${moduleTag}:${row.terminal}`, to: `${inside.tag}:${inside.plus}`, color: 'WH', size: '18 AWG', function: `Speed reference + ${fn}` });
      wires.push({ wire: wm, from: `${moduleTag}:0V`, to: `${inside.tag}:${inside.minus}`, color: 'BK', size: '18 AWG', function: `Speed reference - ${fn}` });
      wires.push({ wire: `${row.address}SH`, from: `${moduleTag}:SHIELD`, to: o.groundBar, color: 'GN/YE', size: '18 AWG', function: `Shield, grounded at the PLC end only - ${row.description}` });
      circuits.push({ row, deviceTag: inside.tag, moduleTag, loop: 'output', zone: 'Cabinet', cable: '', plus: '', minus: '', shield: '', wires: { plus: wp, minus: wm }, internal: inside });
      continue;
    }
    const w = wiringBy.get(row.address.toUpperCase());
    const prefix = tagPrefix(row);
    const n = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, n);
    const deviceTag = w?.deviceTag || `${prefix}${n}`;
    const slot = slotOf(row.channel);
    const moduleTag = slot === 0 ? o.plcTag : o.moduleTag(slot, row.partNumber);
    const loop: AnalogCircuit['loop'] = row.kind === 'output' ? 'output' : row.range === 'thermocouple' ? 'thermocouple' : row.range.endsWith('mA') ? 'two-wire' : 'voltage';
    const zone = w?.location || 'Field';
    const cableTag = `W${String(cable++).padStart(3, '0')}`;
    const plus = `TBA-${++tn}`, minus = `TBA-${++tn}`, shield = `TBA-${++tn}`;
    const wp = `${row.address}+`, wm = `${row.address}-`;
    const ch = `${moduleTag}:${row.terminal}`;
    const zero = `${moduleTag}:0V`;
    const fn = `${row.description} (${row.range}, ${row.scaleMin}…${row.scaleMax} ${row.units})`;
    const t = (num: string, wire: string, internal: string, external: string, kind: AnalogTerminal['kind'] = 'feed'): AnalogTerminal =>
      ({ strip: 'TBA', number: Number(num.split('-')[1]), label: num, wire, internal, external, kind, group: row.address });
    if (loop === 'thermocouple') {
      // Thermocouple straight to the module's CHn+ / CHn− (no loop supply), in thermocouple extension wire of the
      // sensor's type; cold-junction compensation is in the module.
      const chMinus = `${moduleTag}:${row.terminal.replace(/\+$/, '-')}`;
      wires.push({ wire: wp, from: plus, to: ch, color: 'TC+', size: 'TC ext.', function: `Thermocouple + ${fn}` });
      wires.push({ wire: wm, from: minus, to: chMinus, color: 'TC-', size: 'TC ext.', function: `Thermocouple - ${fn}` });
      terminals.push(t(plus, wp, ch, `${deviceTag}:+`), t(minus, wm, chMinus, `${deviceTag}:-`));
    } else if (loop === 'two-wire') {
      // +24 V → transmitter + ; transmitter − → channel (loop current) ; 0V is the loop return inside the module
      wires.push({ wire: wp, from: '24+', to: plus, color: 'BU', size: '18 AWG', function: `Loop supply ${fn}` });
      wires.push({ wire: wm, from: minus, to: ch, color: 'WH/BU', size: '18 AWG', function: `Loop signal ${fn}` });
      terminals.push(t(plus, wp, '24+', `${deviceTag}:+`), t(minus, wm, ch, `${deviceTag}:-`));
    } else if (loop === 'voltage') {
      wires.push({ wire: wp, from: plus, to: ch, color: 'WH/BU', size: '18 AWG', function: `Signal + ${fn}` });
      wires.push({ wire: wm, from: minus, to: zero, color: 'WH/BU', size: '18 AWG', function: `Signal - ${fn}` });
      terminals.push(t(plus, wp, ch, `${deviceTag}:+`), t(minus, wm, zero, `${deviceTag}:-`));
    } else {
      wires.push({ wire: wp, from: ch, to: plus, color: 'WH/BU', size: '18 AWG', function: `Output + ${fn}` });
      wires.push({ wire: wm, from: minus, to: zero, color: 'WH/BU', size: '18 AWG', function: `Output - ${fn}` });
      terminals.push(t(plus, wp, ch, `${deviceTag}:+`), t(minus, wm, zero, `${deviceTag}:-`));
    }
    wires.push({ wire: `${row.address}SH`, from: shield, to: o.groundBar, color: 'GN/YE', size: '18 AWG', function: `Shield, grounded at the panel end only - ${row.description}` });
    terminals.push(t(shield, `${row.address}SH`, o.groundBar, `${cableTag} shield (cut back at ${deviceTag})`, 'ground'));
    cables.push({
      tag: cableTag, kind: 'device', zone, from: `${plus}..${shield.split('-')[1]}`, to: deviceTag,
      type: loop === 'thermocouple' ? 'Thermocouple extension wire, shielded (same type as the thermocouple, e.g. J)' : 'Shielded twisted pair with drain, 1 pair (instrumentation)', size: loop === 'thermocouple' ? '20 AWG' : '18 AWG', length: 'BY SITE', spareCores: 0,
      cores: [
        { core: '1', color: 'WH', wire: wp, from: plus, to: `${deviceTag}:+` },
        { core: '2', color: 'BK', wire: wm, from: minus, to: `${deviceTag}:-` },
        { core: 'DRAIN', color: 'BARE', wire: `${row.address}SH`, from: shield, to: 'cut back, insulated' },
      ],
    });
    circuits.push({ row, deviceTag, moduleTag, loop, zone, cable: cableTag, plus, minus, shield, wires: { plus: wp, minus: wm } });
  }
  return { circuits, wires, strip: terminals.length ? { tag: 'TBA', title: 'ANALOG SIGNALS (SHIELDED)', terminals, endPlates: 1, endStops: 2 } : null, cables };
}
