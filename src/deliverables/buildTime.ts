import type { ProjectSnapshot } from './collect';
import { backPanelDrilling, buildModel, doorDrilling, isFuseCartridge, panelLayout, type DrillingPlan } from '../electrical/derive';
import { enclosureFaceDrilling } from '../electrical/enclosureFaces';
import { buildLabels } from '../electrical/labels';
import { safetyFunctions } from './docs/safety';
import { makeTable, type DocRow, type DocTable } from './docs/table';
import { money } from './purchasing';

/**
 * Shop build-time estimate: hours to build and test the panel, from quantities counted in the design
 * times per-unit rates the shop can change. Every line shows its quantity and rate, so the estimate
 * can be checked by hand.
 */

export type BuildTask = 'Panel layout and drilling' | 'DIN rail and wire duct' | 'Device mounting' | 'Wiring' | 'Labelling' | 'Door devices' | 'Field wiring' | 'Test and FAT';

export interface RateDef {
  key: string;
  task: BuildTask;
  /** What is counted ("Drilled / tapped hole"). */
  item: string;
  /** Unit of the rate ("min per hole"). */
  unit: string;
  /** Default rate; minutes per unit unless `hours`. */
  value: number;
  /** Rate is in hours (fixed allowances), not minutes. */
  inHours?: boolean;
}

/** Wire size groups for the per-termination wiring rate. */
const GAUGES: { key: string; item: string; value: number; maxMm2: number }[] = [
  { key: 'term18', item: 'Wire end 22–18 AWG (up to 1 mm²)', value: 3, maxMm2: 1 },
  { key: 'term14', item: 'Wire end 16–14 AWG (1.5–2.5 mm²)', value: 4, maxMm2: 2.5 },
  { key: 'term10', item: 'Wire end 12–10 AWG (4–6 mm²)', value: 6, maxMm2: 6 },
  { key: 'term6', item: 'Wire end 8–6 AWG (10–16 mm²)', value: 10, maxMm2: 16 },
  { key: 'term4', item: 'Wire end 4 AWG and larger (25 mm² and up)', value: 15, maxMm2: Infinity },
];

/** Typical shop rates. They are starting values: every shop should put in its own. */
export const RATE_DEFS: RateDef[] = [
  { key: 'layoutSetup', task: 'Panel layout and drilling', item: 'Lay out and mark the back panel and door', unit: 'h per panel', value: 1, inHours: true },
  { key: 'hole', task: 'Panel layout and drilling', item: 'Drilled / tapped hole', unit: 'min per hole', value: 3 },
  { key: 'cutout', task: 'Panel layout and drilling', item: 'Cutout (operator, HMI, gland, fan)', unit: 'min per cutout', value: 15 },
  { key: 'rail', task: 'DIN rail and wire duct', item: 'DIN rail cut and mounted', unit: 'min per m', value: 10 },
  { key: 'duct', task: 'DIN rail and wire duct', item: 'Wire duct cut and mounted (with cover)', unit: 'min per m', value: 15 },
  { key: 'deviceSmall', task: 'Device mounting', item: 'DIN-rail device (breaker, relay, PLC module…)', unit: 'min each', value: 5 },
  { key: 'deviceLarge', task: 'Device mounting', item: 'Panel-mounted device (drive, PLC rack, transformer, fan)', unit: 'min each', value: 15 },
  { key: 'terminal', task: 'Device mounting', item: 'Terminal block (with end plates and stops)', unit: 'min each', value: 1 },
  ...GAUGES.map((g) => ({ key: g.key, task: 'Wiring' as const, item: g.item, unit: 'min per end', value: g.value })),
  { key: 'patch', task: 'Wiring', item: 'Network / patch cable inside the panel', unit: 'min per cable', value: 5 },
  { key: 'label', task: 'Labelling', item: 'Label printed and fitted', unit: 'min per label', value: 0.5 },
  { key: 'door', task: 'Door devices', item: 'Door device (pushbutton, light, switch, handle)', unit: 'min each', value: 10 },
  { key: 'hmi', task: 'Door devices', item: 'HMI fitted and connected', unit: 'min each', value: 30 },
  { key: 'cable', task: 'Field wiring', item: 'Field cable (gland, strip, terminate both ends)', unit: 'min per cable', value: 30 },
  { key: 'fatBase', task: 'Test and FAT', item: 'Inspection, insulation and continuity tests, paperwork', unit: 'h per panel', value: 2, inHours: true },
  { key: 'fatIo', task: 'Test and FAT', item: 'I/O point checked', unit: 'min per point', value: 3 },
  { key: 'fatMotor', task: 'Test and FAT', item: 'Motor / drive run test', unit: 'min per motor', value: 20 },
  { key: 'fatSafety', task: 'Test and FAT', item: 'Safety function tested', unit: 'min per function', value: 20 },
];

export const TASKS: BuildTask[] = ['Panel layout and drilling', 'DIN rail and wire duct', 'Device mounting', 'Wiring', 'Labelling', 'Door devices', 'Field wiring', 'Test and FAT'];

export type ShopRates = Record<string, number>;

export function defaultRates(): ShopRates {
  return Object.fromEntries(RATE_DEFS.map((r) => [r.key, r.value]));
}

export interface BuildLine extends RateDef {
  qty: number;
  /** Rate used (the shop's, or the default). */
  rate: number;
  hours: number;
  /** Where the quantity comes from. */
  basis: string;
}

export interface BuildEstimate {
  lines: BuildLine[];
  byTask: { task: BuildTask; hours: number }[];
  totalHours: number;
  /** Labour cost at the shop rate (0 when no rate is set). */
  cost: number;
  hourlyRate: number;
  /** Quantities that could not be counted (the estimate is low by those). */
  notes: string[];
}

/** Copper area of a wire size ("14 AWG", "2.5 mm²"); null for network cable and unknown sizes. */
export function sizeMm2(size: string): number | null {
  const mm = /([\d.]+)\s*mm/i.exec(size);
  if (mm) return parseFloat(mm[1]);
  const awg = /(\d+)(\/0)?\s*AWG/i.exec(size);
  if (!awg) return null;
  // AWG n: d = 0.127 * 92^((36 - n) / 39) mm; 1/0 = 0, 2/0 = -1 …
  const n = awg[2] ? 1 - parseInt(awg[1], 10) : parseInt(awg[1], 10);
  const d = 0.127 * Math.pow(92, (36 - n) / 39);
  return Math.round(((Math.PI * d * d) / 4) * 100) / 100;
}

/** Rate key for a wire end of this size. */
export function gaugeKey(size: string): string | null {
  const a = sizeMm2(size);
  if (a === null) return null;
  // Small tolerance: 14 AWG is 2.08 mm², 12 AWG 3.31 mm².
  return GAUGES.find((g) => a <= g.maxMm2 * 1.05)?.key ?? 'term4';
}

const LARGE = new Set(['vfd', 'plc', 'fan']);
const NOT_MOUNTED = new Set(['enclosure', 'dinRail', 'wireDuct', 'terminal', 'terminalAccessory']);

/** Hours to build and test the panel. `rates` overrides the defaults key by key. */
export function buildEstimate(p: ProjectSnapshot, rates: ShopRates = {}, hourlyRate = 0): BuildEstimate | null {
  if (!p.drawingCtx) return null;
  const ctx = p.drawingCtx;
  const m = buildModel(ctx);
  const qty = new Map<string, { n: number; basis: string }>();
  const set = (key: string, n: number, basis: string) => qty.set(key, { n, basis });
  const notes: string[] = [];

  // Panel layout and drilling: holes and cutouts from the machining drawings.
  const plans: DrillingPlan[] = [];
  for (const f of [backPanelDrilling, doorDrilling]) {
    try { plans.push(f(ctx)); } catch { notes.push('A machining drawing could not be made: its holes are not counted.'); }
  }
  try { plans.push(...enclosureFaceDrilling(ctx)); } catch { notes.push('Enclosure wall cutouts could not be counted.'); }
  set('layoutSetup', 1, 'one panel');
  set('hole', plans.reduce((s, x) => s + x.holes.length, 0), 'machining drawings (back panel, door, walls)');
  set('cutout', plans.reduce((s, x) => s + x.cutouts.length, 0), 'machining drawings (door, walls)');

  // Rail and duct lengths from the panel layout.
  const L = panelLayout(ctx);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  set('rail', r2(L.rails.reduce((s, r) => s + r.w, 0) / 1000), 'panel layout');
  set('duct', r2(L.ducts.reduce((s, d) => s + Math.max(d.w, d.h), 0) / 1000), 'panel layout');

  // Devices on the back panel.
  let small = 0, large = 0;
  for (const c of m.rc) {
    if (c.mount !== 'backplate' || NOT_MOUNTED.has(c.category) || isFuseCartridge(c)) continue;
    const n = Math.max(1, c.comp.quantity);
    if (LARGE.has(c.category) || c === m.transformer) large += n; else small += n;
  }
  set('deviceSmall', small, 'back-panel parts in the design');
  set('deviceLarge', large, 'drives, PLC, transformer, fans in the design');
  set('terminal', m.strips.reduce((s, st) => s + st.terminals.length, 0), 'terminal plan');

  // Wiring inside the panel: two ends per conductor. Conductors that leave the panel are field wiring.
  const field = new Set<string>(['SUPPLY']);
  for (const c of m.rc) if (c.mount === 'field') field.add(c.tag);
  for (const mm of m.motors) field.add(mm.motor.tag);
  for (const c of m.machine.cables) { field.add(c.to); if (!/^TB/i.test(c.from)) field.add(c.from); }
  const tagOf = (end: string) => end.trim().split(/[:\s(]/)[0];
  const ends = new Map<string, number>();
  let patch = 0, unknownSize = 0;
  for (const w of m.wires) {
    if (field.has(tagOf(w.from)) || field.has(tagOf(w.to))) continue;
    const k = gaugeKey(w.size);
    if (k) ends.set(k, (ends.get(k) ?? 0) + 2);
    else if (/cat\s?\d|ethernet|patch/i.test(`${w.size} ${w.color}`)) patch++;
    else unknownSize++;
  }
  for (const g of GAUGES) set(g.key, ends.get(g.key) ?? 0, 'wire list (conductors inside the panel)');
  set('patch', patch, 'wire list');
  if (unknownSize) notes.push(`${unknownSize} conductor${unknownSize === 1 ? '' : 's'} without a size in the wire list: not counted.`);

  set('label', buildLabels(ctx).reduce((s, l) => s + l.copies, 0), 'label list (wire, terminal, device, cable, door)');

  const door = m.rc.filter((c) => c.mount === 'door' && c.category !== 'other' && c.category !== 'hmi').reduce((s, c) => s + Math.max(1, c.comp.quantity), 0);
  set('door', door, 'door parts in the design');
  set('hmi', p.hmi || m.hmi ? 1 : 0, 'HMI');

  // The incoming supply cable is terminated in the panel too.
  set('cable', m.machine.cables.length + 1, `cable schedule (${m.machine.cables.length}) + incoming supply`);

  set('fatBase', 1, 'one panel');
  set('fatIo', m.io.length, 'I/O list');
  set('fatMotor', m.motors.length, 'motors in the design');
  set('fatSafety', safetyFunctions(p).length, 'safety functions');

  const lines: BuildLine[] = RATE_DEFS.map((d) => {
    const q = qty.get(d.key) ?? { n: 0, basis: '' };
    const rate = Number.isFinite(rates[d.key]) && rates[d.key] >= 0 ? rates[d.key] : d.value;
    return { ...d, qty: q.n, basis: q.basis, rate, hours: d.inHours ? q.n * rate : (q.n * rate) / 60 };
  });
  const byTask = TASKS.map((task) => ({ task, hours: lines.filter((l) => l.task === task).reduce((s, l) => s + l.hours, 0) }));
  const totalHours = byTask.reduce((s, t) => s + t.hours, 0);
  const hr = Number.isFinite(hourlyRate) && hourlyRate > 0 ? hourlyRate : 0;
  return { lines, byTask, totalHours, cost: totalHours * hr, hourlyRate: hr, notes };
}

export const hoursText = (h: number) => `${(Math.round(h * 10) / 10).toFixed(1)} h`;
const rateText = (n: number) => String(Math.round(n * 100) / 100);

/** One table for the PDF / Excel exports: task groups, every counted item with quantity, rate and hours. */
export function buildTimeTable(e: BuildEstimate): DocTable {
  const rows: DocRow[] = [];
  for (const t of e.byTask) {
    rows.push({ group: `${t.task} — ${hoursText(t.hours)}` });
    for (const l of e.lines.filter((x) => x.task === t.task && x.qty > 0)) rows.push([l.item, rateText(l.qty), `${rateText(l.rate)} ${l.unit}`, hoursText(l.hours), l.basis]);
  }
  return makeTable([['Item', 46], ['Qty', 9, 'right'], ['Rate', 18], ['Hours', 10, 'right'], ['Counted from', 34]], rows);
}

/** One line for summaries: "Shop build time: 31.5 h (layout 3.2 h, …)". */
export function buildTimeSummary(e: BuildEstimate): string {
  const parts = e.byTask.filter((t) => t.hours > 0).map((t) => `${t.task} ${hoursText(t.hours)}`);
  return `Shop build time: ${hoursText(e.totalHours)}${e.cost ? ` (labour ${money(e.cost)} at $${e.hourlyRate}/h)` : ''} — ${parts.join(', ')}.`;
}
