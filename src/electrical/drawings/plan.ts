/**
 * Sheet planning: decides which sheets exist, their order/numbering, the line
 * (rung) every element sits on, and resolves cross-references. Pure data — the
 * sheet components only draw what is planned here.
 *
 * Line references use the "sheet.line" notation ("5.04" = sheet 5, line 4).
 */
import {
  billOfMaterials, buildModel, designWarnings, drawingPrefix, naturalCompare, panelLayout, plcRack, revisionState,
  backPanelDrilling, doorDrilling, dualDim, dualSize, type DrillingPlan, type PlcRackSlot, type RevisionState,
  type AuxBranch, type Cable, type CableCore, type JbTerminal, type JunctionBoxPlan, type MachineDevice, type BomLine, type DrawingContext, type ElectricalModel, type IoGroup, type IoPoint,
  type MotorModel, type PanelLayout, type XfmrBranch, type PsBranch, type Terminal, type TerminalStrip,
} from '../derive';
import { enclosureFaceDrilling } from '../enclosureFaces';
import { getHmi, hmiMaker } from '../../hmi/hmiCatalog';
import { lineNo } from './geometry';
import { powerText } from '../../standards/regions';
import { stripTag } from '../../standards/designations';

export type RungEnd = { kind: 'rail' } | { kind: 'node'; label: string } | { kind: 'xref'; label: string };
export type RungEl =
  | { t: 'contact'; nc: boolean; tag: string; term: string; dev: 'pb' | 'estop' | 'relay' | 'ol' | 'sr' | 'guard' }
  | { t: 'coil'; tag: string }
  | { t: 'lamp'; tag: string; color: string }
  | { t: 'box'; tag: string; left: string; right: string; label?: string }
  | { t: 'fuse'; tag: string; rating: string };
export interface Rung {
  idx: number;
  start: RungEnd;
  end: RungEnd;
  els: RungEl[];
  /** One wire number per segment: before each element and after the last. */
  wires: string[];
  /** Description lines; `{key}` placeholders are resolved via the cross-reference table. */
  desc: string[];
  key?: string;
}

export type PowerBranchPlan = { type: 'ps'; b: PsBranch; idx: number } | { type: 'aux'; b: AuxBranch; idx: number } | { type: 'xfmr'; b: XfmrBranch; idx: number };
export type TermRow = { kind: 'header'; strip: TerminalStrip; cont?: boolean } | { kind: 'row'; t: Terminal };
export type BomRow = { kind: 'group'; title: string } | { kind: 'line'; line: BomLine };
/** One PLC terminal on an I/O sheet: a used point or a spare. */
export interface IoRow { address: string; point?: IoPoint }
/** One line of the device list. */
export interface DeviceRow { tag: string; fn: string; partNumber: string; manufacturer: string; description: string; qty: number; location: string; refs: string }

export type SheetSpec =
  | { kind: 'cover' }
  | { kind: 'legend' }
  | { kind: 'notes'; notes: string[]; warnings: string[] }
  | { kind: 'power'; branches: PowerBranchPlan[]; contIdx: number; groundIdx: number }
  | { kind: 'motors'; items: { m: MotorModel; idx: number }[]; busEnd: number; continues: boolean; first: boolean }
  | { kind: 'control'; rungs: Rung[] }
  | { kind: 'io'; group: IoGroup; rows: IoRow[]; points: IoPoint[]; first: boolean; last: boolean; rack?: PlcRackSlot; page: number; pages: number }
  | { kind: 'panel' }
  | { kind: 'door' }
  | { kind: 'terminals'; columns: TermRow[][] }
  | { kind: 'devices'; rows: DeviceRow[]; page: number; pages: number }
  | { kind: 'bom'; rows: BomRow[]; first: boolean }
  | { kind: 'labels' }
  | { kind: 'machine'; zones: ZonePlan[] }
  | { kind: 'layout' }
  | { kind: 'cables'; columns: CableRow[][] }
  | { kind: 'jb'; jb: JunctionBoxPlan; terminals: JbTerminal[]; trunk?: Cable; page: number; pages: number }
  | { kind: 'drill'; drill: DrillingPlan; rows: DrillRow[]; drawing: boolean; page: number; pages: number }
  | { kind: 'analog'; from: number; page: number; pages: number }
  | { kind: 'drive'; index: number };

export type DrillRow = { id: string; tag: string; x: number; y: number; size: string; verified: boolean };
export const DRILL_ROWS_FIRST = 44;
export const DRILL_ROWS_CONT = 52;

export type SheetSection = 'cover' | 'cabinet' | 'machine';
export interface PlannedSheet {
  n: number;
  title: string;
  drawingNo: string;
  spec: SheetSpec;
  section: SheetSection;
  /** Revision of this sheet (the set is issued as a whole: the current revision). */
  rev: string;
}

/** Machine overview: one row = a junction box (or the cabinet cable tray) with up to OV_PER_ROW devices hanging from it. */
export interface ZoneRow { jb?: JunctionBoxPlan; trunk?: Cable; firstOfJb: boolean; devices: MachineDevice[] }
export interface ZonePlan { zone: string; rows: ZoneRow[]; height: number }
export type CableRow = { kind: 'head'; cable: Cable; cont?: boolean } | { kind: 'head2'; cable: Cable } | { kind: 'core'; cable: Cable; core: CableCore };

export const OV_ROW_H = 29;
export const OV_ZONE_HEAD = 10;
export const OV_PER_ROW = 8;
export const CABLE_ROWS = 40;
export const JB_ROWS = 28;

export function sectionOf(kind: SheetSpec['kind']): SheetSection {
  if (kind === 'cover' || kind === 'notes' || kind === 'legend') return 'cover';
  if (kind === 'machine' || kind === 'layout' || kind === 'cables' || kind === 'jb') return 'machine';
  return 'cabinet';
}

/** A contact of a coil-operated (or overload) device, for the contact mirror under its coil. */
export interface ContactRef { tag: string; term: string; nc: boolean; line: string; main?: boolean }

/** Document control resolved for the title blocks (blanks stay blank). */
export interface DocState {
  company: string;
  customer: string;
  site: string;
  projectNumber: string;
  prefix: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  /** Date the set was drawn: first revision date, else the design date. */
  drawnDate: string;
  rs: RevisionState;
}

export interface DrawingPlan {
  ctx: DrawingContext;
  model: ElectricalModel;
  layout: PanelLayout;
  sheets: PlannedSheet[];
  xref: Map<string, string>;
  /** Contacts per device tag (coil contact mirrors). */
  contacts: Map<string, ContactRef[]>;
  /** Sheets each device tag is drawn on. */
  where: Map<string, number[]>;
  /** BOM item number per device tag (layout callout balloons). */
  bomItem: Map<string, number>;
  date: string;
  docPrefix: string;
  doc: DocState;
}

export const POWER_PITCH = 7.5;
export const MOTOR_PITCH = 7.5;
export const CONTROL_PITCH = 15;
export const IO_PITCH = 12;
export const MOTOR_LINES = 27;
export const CONTROL_RUNGS = 14;
export const IO_PER_SHEET = 16;
export const TERM_ROWS = 40;
export const BOM_ROWS = 31;
export const DEVICE_ROWS = 38;

const letter = (i: number) => (i === 0 ? '' : String.fromCharCode(64 + i));
const pad2 = (n: number) => String(n).padStart(2, '0');

function controlRungs(model: ElectricalModel): Omit<Rung, 'idx'>[] {
  const out: Omit<Rung, 'idx'>[] = [];
  const s = model.safety;
  const rail: RungEnd = { kind: 'rail' };
  const toOutputs: RungEnd = { kind: 'xref', label: '24+S TO {=s:out}' };
  // sourcing outputs take their supply from 24+S; sinking outputs switch loads that are fed from 24+S
  const outGroups = model.groups.filter((g) => g.type === 'output');
  const feeds = outGroups.length && outGroups.every((g) => g.outputStyle === 'sinking') ? 'FEEDS THE OUTPUT LOADS (SINKING OUTPUTS)'
    : outGroups.some((g) => g.outputStyle === 'sinking') ? 'FEEDS OUTPUT SUPPLY AND SINKING LOADS' : 'FEEDS PLC OUTPUT SUPPLY';
  if (s.relay) {
    const sr = s.relay.tag;
    out.push({ start: rail, end: rail, els: [{ t: 'box', tag: sr, left: 'A1', right: 'A2' }], wires: ['24+', '0V'], desc: [`SAFETY RELAY ${sr} SUPPLY`, `CONTACTS: {c:${sr}}`], key: `coil:${sr}` });
    // E-stops, then the guard-door interlocks (their N.C. safety contacts), in series in both channels
    const es = [...(s.estops.length ? s.estops : ['ES?']), ...s.guards];
    for (const [a, b, term, ch] of [['S11', 'S12', '11-12', 1], ['S21', 'S22', '21-22', 2]] as const) {
      out.push({
        start: { kind: 'node', label: `${sr} ${a}` }, end: { kind: 'node', label: `${sr} ${b}` },
        els: es.map((tag) => ({ t: 'contact', nc: true, tag, term, dev: s.guards.includes(tag) ? 'guard' : 'estop' })),
        wires: [a, ...es.slice(1).map((_, k) => `${a}${letter(k + 1)}`), b],
        desc: [`${s.guards.length ? 'E-STOP / GUARD' : 'E-STOP'} CHANNEL ${ch} (${es.join(', ')})`, ch === 1 ? 'DUAL CHANNEL, CROSS-MONITORED' : ''],
      });
    }
    const rs = s.reset ?? 'PB?';
    out.push({
      start: { kind: 'node', label: `${sr} S33` }, end: { kind: 'node', label: `${sr} S34` },
      els: [{ t: 'contact', nc: false, tag: rs, term: '13-14', dev: 'pb' }, ...s.edm.map((tag, k) => ({ t: 'contact' as const, nc: true, tag, term: s.edmTerms?.[k] ?? '21-22', dev: 'relay' as const }))],
      wires: ['S33', ...s.edm.map((_, k) => `S33${letter(k + 1)}`), 'S34'],
      desc: ['SAFETY RESET (MONITORED, MANUAL)', s.edm.length ? `FEEDBACK (EDM): ${s.edm.join(', ')}` : ''],
    });
    if (s.mcr) {
      out.push({ start: rail, end: rail, els: [{ t: 'contact', nc: false, tag: sr, term: '13-14', dev: 'sr' }, { t: 'coil', tag: s.mcr.tag }], wires: ['24+', 'SR14', '0V'], desc: [`MASTER CONTROL RELAY ${s.mcr.tag}`, `CONTACTS: {c:${s.mcr.tag}}`], key: `coil:${s.mcr.tag}` });
      out.push({ start: rail, end: toOutputs, els: [{ t: 'contact', nc: false, tag: s.mcr.tag, term: '13-14', dev: 'relay' }], wires: ['24+', '24+S'], desc: ['SAFETY-SWITCHED +24V (24+S)', `${feeds} {=s:out}`], key: 'rung:24+S' });
    } else {
      // A light-curtain relay's safety output is in series: a broken beam drops 24+S like an E-stop.
      const lc = (s.extraRelays ?? []).filter((x) => x.kind === 'light-curtain').map((x) => x.relay.tag);
      out.push({ start: rail, end: toOutputs, els: [sr, ...lc].map((tag) => ({ t: 'contact' as const, nc: false, tag, term: '13-14', dev: 'sr' as const })),
        wires: ['24+', ...lc.map((_, k) => (k === 0 ? 'SR14' : `SR14${letter(k)}`)), '24+S'], desc: [lc.length ? `SAFETY-SWITCHED +24V (24+S) — E-STOP AND ${lc.join(', ')}` : 'SAFETY-SWITCHED +24V (24+S)', `${feeds} {=s:out}`], key: 'rung:24+S' });
    }
    // Two-hand and light-curtain relays: supply and input circuit (their outputs: 24+S above, the closing stroke below).
    for (const x of s.extraRelays ?? []) {
      const t = x.relay.tag;
      out.push({ start: rail, end: rail, els: [{ t: 'box', tag: t, left: 'A1', right: 'A2' }], wires: ['24+', '0V'],
        desc: [x.kind === 'two-hand' ? `TWO-HAND SAFETY RELAY ${t} SUPPLY` : `LIGHT-CURTAIN SAFETY RELAY ${t} SUPPLY`, `CONTACTS: {c:${t}}`], key: `coil:${t}` });
      for (const d of x.inputs.length ? x.inputs : ['?']) {
        out.push(x.kind === 'two-hand'
          // The relay terminals are named at the start (the right rail may run past the rung's end).
          ? { start: { kind: 'node', label: `${t} IN1/IN2` }, end: { kind: 'node', label: '' }, els: [{ t: 'box', tag: d, left: 'BTN1', right: 'BTN2', label: '' }], wires: [`${t}-1`, `${t}-2`],
            desc: [`TWO-HAND STATION ${d}: BOTH BUTTONS (N.O. + N.C. EACH)`, `WIRES ${t}-1 / ${t}-2, 0.5 S, ISO 13851 TYPE IIIC`] }
          : { start: { kind: 'node', label: `${t} S12/S22` }, end: { kind: 'node', label: '' }, els: [{ t: 'box', tag: d, left: 'OSSD1', right: 'OSSD2', label: '' }], wires: ['OSSD1', 'OSSD2'],
            desc: [`LIGHT CURTAIN ${d}: OSSD1 / OSSD2`, 'TYPE 4, SELF-TESTING (IEC 61496)'] });
      }
    }
  } else if (s.estops.length) {
    const es = s.estops;
    const els: RungEl[] = es.map((tag) => ({ t: 'contact', nc: true, tag, term: '11-12', dev: 'estop' }));
    if (s.mcr) els.push({ t: 'coil', tag: s.mcr.tag });
    out.push({
      start: rail, end: s.mcr ? rail : toOutputs, els,
      wires: ['24+', ...es.slice(1).map((_, k) => `ES${k + 1}`), '24+S', ...(s.mcr ? ['0V'] : [])],
      desc: ['E-STOP CHAIN (HARDWIRED, NO SAFETY RELAY)', 'REVIEW REQUIRED — SEE NOTES'], key: s.mcr ? `coil:${s.mcr.tag}` : 'rung:24+S',
    });
  }
  // door HMI: unswitched 24+ through its fused terminal (it keeps running through an E-stop)
  if (model.hmi) {
    const h = model.hmi;
    if (out.length) out.push({ start: { kind: 'node', label: '' }, end: { kind: 'node', label: '' }, els: [], wires: [], desc: [] });
    out.push({ start: rail, end: rail, els: [{ t: 'fuse', tag: h.fuseTerminal, rating: h.fuse }, { t: 'box', tag: h.tag, left: '+24V', right: '0V', label: 'HMI' }], wires: ['24+', '24+H', '0V'],
      desc: [`OPERATOR PANEL ${h.tag} SUPPLY (${h.partNumber})`, h.link === 'ethernet' ? `ETHERNET ENET1 TO ${model.plcTag} (SHIELDED CAT6, DIRECT)` : `RS-232 COM2 TO ${model.plcTag} PORT 2`], key: `ps:${h.tag}` });
  }
  // VFD line contactors held by the safety-switched supply (safety stop by contactor, not by a PLC output)
  const ioTags = new Set(model.io.map((p) => p.deviceTag));
  for (const mm of model.motors) {
    const k = mm.vfd ? mm.contactors[0] : undefined;
    if (!k || ioTags.has(k.tag)) continue;
    out.push({ start: { kind: 'node', label: s.outputSupply }, end: rail, els: [{ t: 'coil', tag: k.tag }], wires: [s.outputSupply, '0V'],
      desc: [`${k.tag} LINE CONTACTOR FOR ${mm.vfd!.tag} (${mm.motor.tag})`, s.outputSupply === '24+S' ? 'SAFETY STOP: DROPS WITH 24+S' : 'NO SAFETY RELAY — REVIEW'], key: `coil:${k.tag}` });
  }
  // heater safety contactors held by 24+S through the over-temperature limit's latched relay (not a PLC output)
  const limit = model.rc.find((c) => c.part?.ratings.kind === 'limitAlarm');
  for (const k of model.rc.filter((c) => c.category === 'contactor' && !c.comp.motorTag && !ioTags.has(c.tag) && /safety contactor/i.test(c.comp.function))) {
    out.push({ start: { kind: 'node', label: s.outputSupply }, end: rail,
      els: [...(limit ? [{ t: 'contact' as const, nc: false, tag: limit.tag, term: 'R1', dev: 'relay' as const }] : []), { t: 'coil', tag: k.tag }],
      wires: [s.outputSupply, ...(limit ? [`${k.tag}A1`] : []), '0V'],
      desc: [`${k.tag} ${k.comp.function.split(' — ')[0].toUpperCase()}`, limit ? `OVER-TEMPERATURE LIMIT ${limit.tag} (LATCHED) AND 24+S DROP IT` : 'DROPS WITH 24+S'], key: `coil:${k.tag}` });
  }
  // pilot lights not driven by the PLC, e.g. "control power on"
  const lamps = model.rc.filter((c) => c.category === 'pilotLight' && !ioTags.has(c.tag));
  if (lamps.length && out.length) out.push({ start: { kind: 'node', label: '' }, end: { kind: 'node', label: '' }, els: [], wires: [], desc: [] });
  for (const l of lamps) {
    const color = (String(l.part?.ratings.color ?? l.part?.description.match(/red|green|amber|yellow|blue|white/i)?.[0] ?? '')).toUpperCase();
    out.push({ start: rail, end: rail, els: [{ t: 'lamp', tag: l.tag, color }], wires: ['24+', '0V'], desc: [`${l.comp.function.toUpperCase()} (${l.tag})`, color ? `${color} PILOT LIGHT` : ''] });
  }
  const coils = model.io.filter((p) => p.coilChain);
  if (coils.length && out.length) out.push({ start: { kind: 'node', label: '' }, end: { kind: 'node', label: '' }, els: [], wires: [], desc: [] });
  for (const p of coils) {
    const ch = p.coilChain!;
    // sourcing output: output → chain → coil → 0V; sinking output: output supply → chain → coil → output
    out.push({
      start: ch.sink ? { kind: 'node', label: s.outputSupply } : { kind: 'xref', label: `${p.address} FROM {=io:${p.address}}` },
      end: ch.sink ? { kind: 'xref', label: `${p.address} TO {=io:${p.address}}` } : rail,
      els: [...ch.devices.map((d) => ({ t: 'contact' as const, nc: d.nc, tag: d.tag, term: d.terminals, dev: d.kind === 'ol' ? 'ol' as const : 'relay' as const })), { t: 'coil', tag: p.deviceTag || '?' }],
      wires: [...ch.wires, ch.sink ? p.address : '0V'],
      desc: [p.description.toUpperCase(), `${p.deviceTag} CONTACTS: {c:${p.deviceTag}}`], key: `coil:${p.deviceTag}`,
    });
  }
  return out;
}

/** I/O sheets: one block per CPU / module and type, every point of the module (spares included). */
function ioBlocks(ctx: DrawingContext, model: ElectricalModel): { group: IoGroup; rows: IoRow[]; rack?: PlcRackSlot }[] {
  const rack = plcRack(ctx);
  const byKey = new Map(model.groups.map((g) => [g.key, g] as const));
  const used = new Set<string>();
  const out: { group: IoGroup; rows: IoRow[]; rack?: PlcRackSlot }[] = [];
  for (const slot of rack) {
    for (const type of ['input', 'output'] as const) {
      const key = `${type}:${slot.slot}`;
      const g = byKey.get(key);
      const cap = type === 'input' ? slot.inputs : slot.outputs;
      if (!g && !cap) continue;
      used.add(key);
      const L = type === 'input' ? 'X' : 'Y';
      const pts = g?.points ?? [];
      const addrs = Array.from({ length: Math.min(cap, 16) }, (_, k) => `${L}${slot.slot}${pad2(k + 1)}`);
      for (const p of pts) if (!addrs.includes(p.address.toUpperCase())) addrs.push(p.address.toUpperCase());
      addrs.sort(naturalCompare);
      const group: IoGroup = g ?? {
        key, type, label: slot.slot === 0 ? `CPU ${slot.partNumber}` : `SLOT ${slot.slot} ${slot.partNumber}`, devTag: slot.tag, partNumber: slot.partNumber,
        outputStyle: slot.outputStyle, commonTo: '0V', points: [],
      };
      out.push({ group, rows: addrs.map((a) => ({ address: a, point: pts.find((p) => p.address.toUpperCase() === a) })), rack: slot });
    }
  }
  // groups outside the CLICK slot scheme (generic addresses): used points only
  for (const g of model.groups) if (!used.has(g.key)) out.push({ group: g, rows: g.points.map((p) => ({ address: p.address, point: p })) });
  return out;
}

export function planDrawings(ctx: DrawingContext): DrawingPlan {
  const model = buildModel(ctx);
  const layout = panelLayout(ctx);
  const specs: { title: string; spec: SheetSpec }[] = [];

  specs.push({ title: 'COVER SHEET, DRAWING INDEX & GENERAL NOTES', spec: { kind: 'cover' } });
  specs.push({ title: 'SYMBOLS, ABBREVIATIONS & DEVICE TAGS', spec: { kind: 'legend' } });
  const warnings = designWarnings(ctx);
  if (ctx.design.notes.length || warnings.length) specs.push({ title: 'DESIGN NOTES & ENGINEERING REVIEW ITEMS', spec: { kind: 'notes', notes: ctx.design.notes, warnings } });

  // power distribution
  const branches: PowerBranchPlan[] = [];
  let idx = 7;
  if (model.xfmrBranch) { branches.push({ type: 'xfmr', b: model.xfmrBranch, idx }); idx += 4; }
  for (const b of model.psBranches) { branches.push({ type: 'ps', b, idx }); idx += 4; }
  for (const b of model.auxBranches) { branches.push({ type: 'aux', b, idx }); idx += 4; }
  const contIdx = model.motors.length ? idx : idx - 1;
  specs.push({ title: 'POWER DISTRIBUTION', spec: { kind: 'power', branches, contIdx, groundIdx: Math.max(contIdx + 3, 20) } });

  // motors
  if (model.motors.length) {
    let cur: { m: MotorModel; idx: number }[] = [];
    let line = 2;
    const pages: { m: MotorModel; idx: number }[][] = [];
    for (const m of model.motors) {
      const need = (m.motor.reversing && m.contactors.length >= 2 && !m.vfd ? 10 : 6);
      if (cur.length && line + need > MOTOR_LINES) { pages.push(cur); cur = []; line = 2; }
      cur.push({ m, idx: line });
      line += need;
    }
    if (cur.length) pages.push(cur);
    pages.forEach((items, i) => {
      const last = items[items.length - 1];
      specs.push({
        title: `MOTOR CIRCUITS${pages.length > 1 ? ` (${i + 1} OF ${pages.length})` : ''} — ${items.map((x) => x.m.motor.tag).join(', ')}`,
        spec: { kind: 'motors', items, busEnd: last.idx + 3, continues: i < pages.length - 1, first: i === 0 },
      });
    });
  }

  // control
  const raw = controlRungs(model);
  if (raw.length) {
    for (let i = 0; i < raw.length; i += CONTROL_RUNGS) {
      const chunk = raw.slice(i, i + CONTROL_RUNGS).map((r, k) => ({ ...r, idx: k + 1 }));
      const pages = Math.ceil(raw.length / CONTROL_RUNGS);
      specs.push({ title: `CONTROL & SAFETY CIRCUIT 24VDC${pages > 1 ? ` (${i / CONTROL_RUNGS + 1} OF ${pages})` : ''}`, spec: { kind: 'control', rungs: chunk } });
    }
  }

  // IO: one block per CPU / module, inputs then outputs, spares included
  for (const blk of ioBlocks(ctx, model)) {
    const g = blk.group;
    const pages = Math.max(1, Math.ceil(blk.rows.length / IO_PER_SHEET));
    for (let i = 0; i < Math.max(1, blk.rows.length); i += IO_PER_SHEET) {
      const rows = blk.rows.slice(i, i + IO_PER_SHEET);
      const range = rows.length > 1 ? `${rows[0].address}–${rows[rows.length - 1].address}` : rows[0]?.address ?? '';
      specs.push({
        title: `PLC ${g.type === 'input' ? 'INPUTS' : 'OUTPUTS'} — ${g.devTag} ${g.label} (${range})`,
        spec: { kind: 'io', group: g, rows, points: rows.flatMap((r) => (r.point ? [r.point] : [])), first: i === 0, last: i + IO_PER_SHEET >= blk.rows.length, rack: blk.rack, page: i / IO_PER_SHEET + 1, pages },
      });
    }
  }

  // Analog loops (electrical/analog.ts): six per sheet.
  const nAnalog = model.analog.circuits.length;
  for (let i = 0, pages = Math.ceil(nAnalog / 6); i < nAnalog; i += 6) {
    specs.push({ title: `ANALOG I/O — 4–20 mA / 0–10 V LOOPS${pages > 1 ? ` (${i / 6 + 1} OF ${pages})` : ''}`, spec: { kind: 'analog', from: i, page: i / 6 + 1, pages } });
  }

  // VFD control wiring + parameters (electrical/vfd.ts): one sheet per drive.
  model.drives.forEach((c, i) => specs.push({ title: `${c.drive.tag} — DRIVE CONTROL & PARAMETERS`, spec: { kind: 'drive', index: i } }));

  specs.push({ title: 'PANEL LAYOUT — BACKPLATE', spec: { kind: 'panel' } });
  if (layout.door.items.length) specs.push({ title: 'DOOR LAYOUT — OPERATOR DEVICES', spec: { kind: 'door' } });

  // machining drawings (back panel drilling, door cutouts, enclosure walls)
  for (const d of [backPanelDrilling(ctx), doorDrilling(ctx), ...enclosureFaceDrilling(ctx)]) {
    const rows: DrillRow[] = [
      ...d.holes.map((h) => ({ id: h.id, tag: h.tag, x: h.x, y: h.y, size: h.code, verified: h.verified })),
      ...d.cutouts.map((c) => ({ id: c.id, tag: c.tag, x: c.x, y: c.y, size: c.kind === 'rect' ? `${c.code} ${dualSize(c.w, c.h)}` : `${c.code} Ø${dualDim(c.w)}`, verified: c.verified })),
    ];
    if (!rows.length) continue;
    const chunks: DrillRow[][] = [rows.slice(0, DRILL_ROWS_FIRST)];
    for (let i = DRILL_ROWS_FIRST; i < rows.length; i += DRILL_ROWS_CONT * 2) chunks.push(rows.slice(i, i + DRILL_ROWS_CONT * 2));
    chunks.forEach((r, i) => specs.push({ title: `${d.title}${chunks.length > 1 ? ` (${i + 1} OF ${chunks.length})` : ''} — ${d.part}`, spec: { kind: 'drill', drill: d, rows: r, drawing: i === 0, page: i + 1, pages: chunks.length } }));
  }

  // terminal plan
  if (model.strips.length) {
    const rows: TermRow[] = [];
    for (const s of model.strips) { rows.push({ kind: 'header', strip: s }); for (const t of s.terminals) rows.push({ kind: 'row', t }); }
    const cols: TermRow[][] = [];
    let col: TermRow[] = [];
    for (const r of rows) {
      if (col.length >= TERM_ROWS || (r.kind === 'header' && col.length >= TERM_ROWS - 3)) { cols.push(col); col = []; }
      if (r.kind === 'row' && col.length === 0) { const s = model.strips.find((x) => x.tag === r.t.strip)!; col.push({ kind: 'header', strip: s, cont: true }); }
      col.push(r);
    }
    if (col.length) cols.push(col);
    const pages = Math.ceil(cols.length / 2);
    for (let i = 0; i < cols.length; i += 2) specs.push({ title: `TERMINAL PLAN${pages > 1 ? ` (${i / 2 + 1} OF ${pages})` : ''}`, spec: { kind: 'terminals', columns: cols.slice(i, i + 2) } });
  }

  // device list (rows filled after numbering, when sheet references are known)
  const devRowsCount = deviceTags(ctx, model).length;
  const devPages = Math.max(1, Math.ceil(devRowsCount / DEVICE_ROWS));
  for (let i = 0; i < devPages; i++) specs.push({ title: `DEVICE LIST${devPages > 1 ? ` (${i + 1} OF ${devPages})` : ''}`, spec: { kind: 'devices', rows: [], page: i + 1, pages: devPages } });

  // BOM
  const bom = billOfMaterials(ctx);
  const bomRows: BomRow[] = [];
  for (const g of bom) { bomRows.push({ kind: 'group', title: g.title }); for (const l of g.lines) bomRows.push({ kind: 'line', line: l }); }
  if (bomRows.length) {
    const pages: BomRow[][] = [];
    let cur: BomRow[] = [];
    for (const r of bomRows) {
      if (cur.length >= BOM_ROWS || (r.kind === 'group' && cur.length >= BOM_ROWS - 1)) { pages.push(cur); cur = []; }
      cur.push(r);
    }
    if (cur.length) pages.push(cur);
    pages.forEach((rows, i) => specs.push({ title: `BILL OF MATERIALS${pages.length > 1 ? ` (${i + 1} OF ${pages.length})` : ''}`, spec: { kind: 'bom', rows, first: i === 0 } }));
  }

  specs.push({ title: 'NAMEPLATE, LEGEND PLATE & LABEL SCHEDULE', spec: { kind: 'labels' } });

  // ---- machine (field) wiring section
  const mc = model.machine;
  const fieldDevices = mc.devices;
  if (fieldDevices.length) {
    const zones: ZonePlan[] = [];
    for (const zone of mc.wiring.zones) {
      const ds = fieldDevices.filter((d) => d.zone === zone);
      if (!ds.length) continue;
      const rows: ZoneRow[] = [];
      for (const jb of mc.jbs.filter((j) => j.zone === zone && j.devices.length)) {
        const jd = ds.filter((d) => d.jb === jb.tag);
        const trunk = mc.cables.find((c) => c.tag === jb.trunk);
        for (let i = 0; i < jd.length; i += OV_PER_ROW) rows.push({ jb, trunk, firstOfJb: i === 0, devices: jd.slice(i, i + OV_PER_ROW) });
      }
      const home = ds.filter((d) => !d.jb);
      for (let i = 0; i < home.length; i += OV_PER_ROW) rows.push({ firstOfJb: false, devices: home.slice(i, i + OV_PER_ROW) });
      zones.push({ zone, rows, height: OV_ZONE_HEAD + rows.length * OV_ROW_H + 3 });
    }
    const pages: ZonePlan[][] = [];
    let cur: ZonePlan[] = [];
    let h = 0;
    for (const z of zones) {
      if (cur.length && h + z.height + 5 > 196) { pages.push(cur); cur = []; h = 0; }
      cur.push(z); h += z.height + 5;
    }
    if (cur.length) pages.push(cur);
    pages.forEach((zs, i) => specs.push({ title: `MACHINE WIRING OVERVIEW — ZONES & CABLES${pages.length > 1 ? ` (${i + 1} OF ${pages.length})` : ''}`, spec: { kind: 'machine', zones: zs } }));
    if (ctx.machineLayout) specs.push({ title: 'MACHINE LAYOUT — CABLE ROUTES & LENGTHS', spec: { kind: 'layout' } });

    const rowsC: CableRow[] = [];
    for (const c of mc.cables) { rowsC.push({ kind: 'head', cable: c }, { kind: 'head2', cable: c }); for (const k of c.cores) rowsC.push({ kind: 'core', cable: c, core: k }); }
    const cols: CableRow[][] = [];
    let col: CableRow[] = [];
    for (const r of rowsC) {
      if (col.length >= CABLE_ROWS || (r.kind === 'head' && col.length >= CABLE_ROWS - 3)) { cols.push(col); col = []; }
      if (r.kind === 'core' && col.length === 0) col.push({ kind: 'head', cable: r.cable, cont: true });
      if (r.kind === 'head2' && col.length === 0) col.push({ kind: 'head', cable: r.cable, cont: true });
      col.push(r);
    }
    if (col.length) cols.push(col);
    const cp = Math.ceil(cols.length / 2);
    for (let i = 0; i < cols.length; i += 2) specs.push({ title: `CABLE SCHEDULE${cp > 1 ? ` (${i / 2 + 1} OF ${cp})` : ''}`, spec: { kind: 'cables', columns: cols.slice(i, i + 2) } });

    for (const jb of mc.jbs.filter((j) => j.terminals.length)) {
      const pagesJ = Math.ceil(jb.terminals.length / JB_ROWS);
      for (let i = 0; i < jb.terminals.length; i += JB_ROWS) {
        specs.push({
          title: `JUNCTION BOX ${jb.tag} — ${jb.zone.toUpperCase()}${pagesJ > 1 ? ` (${i / JB_ROWS + 1} OF ${pagesJ})` : ''}`,
          spec: { kind: 'jb', jb, terminals: jb.terminals.slice(i, i + JB_ROWS), trunk: mc.cables.find((c) => c.tag === jb.trunk), page: i / JB_ROWS + 1, pages: pagesJ },
        });
      }
    }
  }

  const prefix = drawingPrefix(ctx.doc);
  const rs = revisionState(ctx.doc);
  const sheets: PlannedSheet[] = specs.map((s, i) => ({ n: i + 1, title: s.title, drawingNo: `${prefix}-E-${pad2(i + 1)}`, spec: s.spec, section: sectionOf(s.spec.kind), rev: rs.rev }));

  // ---- cross references
  const xref = new Map<string, string>();
  const contacts = new Map<string, ContactRef[]>();
  const addContact = (c: ContactRef) => {
    if (!c.tag) return;
    const l = contacts.get(c.tag) ?? [];
    if (!l.some((x) => x.term === c.term && x.line === c.line)) l.push(c);
    contacts.set(c.tag, l);
  };
  const outLines: string[] = [];
  for (const sh of sheets) {
    const sp = sh.spec;
    if (!xref.has(`sheet:${sp.kind}`)) xref.set(`sheet:${sp.kind}`, String(sh.n));
    if (sp.kind === 'jb' && !xref.has(`jb:${sp.jb.tag}`)) xref.set(`jb:${sp.jb.tag}`, String(sh.n));
    if (sp.kind === 'power') {
      for (const b of sp.branches) {
        if (b.type === 'ps') { xref.set(`ps:${b.b.ps.tag}`, lineNo(sh.n, b.idx)); xref.set(`ps0:${b.b.ps.tag}`, lineNo(sh.n, b.idx + 1)); }
        if (b.type === 'xfmr') xref.set('xfmr', lineNo(sh.n, b.idx));
      }
      xref.set('power:cont', lineNo(sh.n, sp.contIdx + 1));
      xref.set('power:ground', lineNo(sh.n, sp.groundIdx));
    } else if (sp.kind === 'motors') {
      if (sp.first) xref.set('motors', lineNo(sh.n, 0));
      for (const it of sp.items) {
        const m = it.m;
        const rev = m.motor.reversing && m.contactors.length >= 2 && !m.vfd;
        m.contactors.forEach((c, k) => {
          const l = lineNo(sh.n, it.idx + 1 + (k === 1 && rev ? 4 : 0));
          xref.set(`contacts:${c.tag}`, l);
          addContact({ tag: c.tag, term: '1-2/3-4/5-6', nc: false, line: l, main: true });
        });
        if (m.overload) xref.set(`heater:${m.overload.tag}`, lineNo(sh.n, it.idx + 1));
        xref.set(`motor:${m.motor.tag}`, lineNo(sh.n, it.idx));
      }
    } else if (sp.kind === 'control') {
      if (!xref.has('ctl:first')) xref.set('ctl:first', lineNo(sh.n, 1));
      for (const r of sp.rungs) {
        const l = lineNo(sh.n, r.idx);
        if (r.key) xref.set(r.key, l);
        for (const e of r.els) if (e.t === 'contact' && e.dev !== 'pb' && e.dev !== 'estop' && e.dev !== 'guard') addContact({ tag: e.tag, term: e.term, nc: e.nc, line: l });
      }
    } else if (sp.kind === 'io') {
      sp.rows.forEach((r, i) => {
        const l = lineNo(sh.n, i + 1);
        const p = r.point;
        if (!p) return;
        xref.set(`io:${p.address}`, l);
        if (p.deviceType === 'safety-relay-output') addContact({ tag: p.deviceTag || model.safety.relay?.tag || '', term: '23-24', nc: false, line: l });
      });
      // sourcing: the output supply row at the end of the module; sinking: the loads on the module's sheet
      if (sp.group.type === 'output' && sp.last) outLines.push(lineNo(sh.n, sp.group.outputStyle === 'sinking' ? 1 : sp.rows.length + 1));
    }
  }
  for (const [tag, list] of contacts) xref.set(`c:${tag}`, list.map((c) => `${c.main ? 'MAIN' : c.term}${c.nc ? ' NC' : ''} ${c.line}`).join(', '));
  xref.set('s:out', outLines.join(', ') || 'OUTPUT SHEETS');

  // ---- where each tag is drawn
  const whereSets = new Map<string, Set<number>>();
  const mark = (tag: string | undefined, n: number) => { if (!tag) return; const s = whereSets.get(tag) ?? new Set<number>(); s.add(n); whereSets.set(tag, s); };
  for (const sh of sheets) {
    const sp = sh.spec, n = sh.n;
    switch (sp.kind) {
      case 'power':
        mark(model.disconnect?.tag, n); mark(model.mainBreaker?.tag, n); mark(model.groundBar?.tag, n);
        for (const b of sp.branches) { mark(b.b.protection?.tag, n); if (b.type === 'ps') mark(b.b.ps.tag, n); if (b.type === 'xfmr') mark(b.b.xfmr.tag, n); }
        break;
      case 'motors':
        for (const it of sp.items) { const m = it.m; [m.protection, m.overload, m.vfd, ...m.contactors].forEach((c) => mark(c?.tag, n)); mark(m.motor.tag, n); }
        mark(stripTag(ctx.designations, 1), n);
        break;
      case 'control':
        for (const r of sp.rungs) for (const e of r.els) mark(e.tag, n);
        break;
      case 'io':
        mark(sp.group.devTag, n);
        for (const p of sp.points) { mark(p.deviceTag, n); for (const t of [p.signalTerminal, p.supplyTerminal, p.returnTerminal]) mark(t?.split('-')[0], n); }
        break;
      case 'panel':
        for (const it of layout.items) for (const t of it.label.split('/')) mark(t.replace(/\s*\(.*$/, '').replace(/\.\d+$/, ''), n);
        mark(layout.enclosure.tag, n); mark(layout.backplate.tag, n);
        break;
      case 'door':
        for (const d of layout.door.items) mark(d.tag, n);
        mark(layout.door.handle?.tag, n);
        break;
      case 'terminals':
        for (const c of sp.columns) for (const r of c) if (r.kind === 'header') mark(r.strip.tag, n);
        break;
      case 'machine':
        for (const z of sp.zones) for (const r of z.rows) { mark(r.jb?.tag, n); for (const d of r.devices) mark(d.tag, n); }
        break;
      case 'jb':
        mark(sp.jb.tag, n);
        for (const t of sp.terminals) mark(t.device, n);
        break;
      default:
        break;
    }
  }
  const where = new Map<string, number[]>([...whereSets].map(([k, v]) => [k, [...v].sort((a, b) => a - b)] as const));

  const bomItem = new Map<string, number>();
  for (const g of bom) for (const l of g.lines) {
    for (const t of l.tags) if (!bomItem.has(t)) bomItem.set(t, l.item);
    if (l.partNumber && !bomItem.has(`pn:${l.partNumber}`)) bomItem.set(`pn:${l.partNumber}`, l.item);
  }

  const date = (ctx.design.generatedAt || '').slice(0, 10) || '—';
  const d = ctx.doc;
  const doc: DocState = {
    company: d?.company?.trim() ?? '', customer: d?.customer?.trim() ?? '', site: d?.site?.trim() ?? '', projectNumber: d?.projectNumber?.trim() ?? '',
    prefix, preparedBy: d?.preparedBy?.trim() ?? '', checkedBy: d?.checkedBy?.trim() ?? '', approvedBy: d?.approvedBy?.trim() ?? '',
    drawnDate: rs.revisions[0]?.date?.trim() || date, rs,
  };
  const plan: DrawingPlan = { ctx, model, layout, sheets, xref, contacts, where, bomItem, date, docPrefix: prefix, doc };

  // device list rows (need `where`)
  const devRows = deviceRows(plan);
  for (const sh of sheets) {
    if (sh.spec.kind !== 'devices') continue;
    const i = sh.spec.page - 1;
    sh.spec = { ...sh.spec, rows: devRows.slice(i * DEVICE_ROWS, (i + 1) * DEVICE_ROWS) };
  }
  return plan;
}

/** All device tags listed on the device list (components, field devices without a part, motors, junction boxes). */
function deviceTags(ctx: DrawingContext, model: ElectricalModel): string[] {
  const tags = new Set<string>(model.rc.map((c) => c.tag));
  for (const p of model.io) if (p.deviceTag) tags.add(p.deviceTag);
  for (const m of ctx.design.inputs.motors) tags.add(m.tag);
  for (const j of model.machine.jbs) tags.add(j.tag);
  if (model.hmi) tags.add(model.hmi.tag);
  return [...tags].sort(naturalCompare);
}

function deviceRows(plan: DrawingPlan): DeviceRow[] {
  const { ctx, model } = plan;
  const rcBy = new Map(model.rc.map((c) => [c.tag, c] as const));
  const devBy = new Map(model.machine.devices.map((d) => [d.tag, d] as const));
  const coilRef = (tag: string) => plan.xref.get(`coil:${tag}`) ?? plan.xref.get(`ps:${tag}`) ?? plan.xref.get(`motor:${tag}`) ?? plan.xref.get(`heater:${tag}`) ?? plan.xref.get(`contacts:${tag}`);
  return deviceTags(ctx, model).map((tag) => {
    const c = rcBy.get(tag);
    const md = devBy.get(tag);
    const io = model.io.find((p) => p.deviceTag === tag);
    const motor = ctx.design.inputs.motors.find((m) => m.tag === tag);
    const jb = model.machine.jbs.find((j) => j.tag === tag);
    const hmi = !c && model.hmi?.tag === tag ? model.hmi : undefined;
    const hmiModel = hmi ? getHmi(hmi.partNumber) : undefined;
    let location: string;
    if (c?.category === 'enclosure') location = 'ENCLOSURE';
    // operator accessories (legend plates, contact blocks, lamp modules) sit with their operator on the door
    else if (c?.mount === 'door' || io?.location === 'door' || tag === model.hmi?.tag
      || (c && /\b(legend plate|contact block|lamp module)\b/i.test(`${c.comp.function} ${c.part?.description ?? ''}`))) location = 'DOOR';
    else if (md || motor || jb) location = `FIELD — ${(md?.zone ?? jb?.zone ?? model.machine.wiring.motorLocations[tag] ?? 'MACHINE').toUpperCase()}`;
    else if (c?.mount === 'field' || io?.location === 'field') location = 'FIELD';
    else if (c?.category === 'fan') location = 'ENCLOSURE (SIDE/DOOR)';
    else location = 'BACK PANEL';
    const sheetsOf = plan.where.get(tag) ?? [];
    const ref = coilRef(tag);
    const refs = [...(ref ? [`/${ref}`] : []), ...sheetsOf.filter((n) => !ref || String(n) !== ref.split('.')[0]).map(String)].join(', ');
    return {
      tag,
      fn: (c?.comp.function || motor?.description || io?.description || (jb ? `Junction box, ${jb.zone}` : '') || (hmi ? 'Operator touch panel' : '')).toUpperCase(),
      partNumber: c?.partNumber || md?.partNumber || (jb?.partNumber ?? '') || (hmi?.partNumber ?? ''),
      manufacturer: c?.part?.manufacturer ?? (hmiModel ? hmiMaker(hmiModel) : ''),
      description: c?.part?.description ?? (hmi ? hmiModel?.description ?? 'OPERATOR TOUCH PANEL' : motor ? `${powerText(motor.hp, ctx.region).toUpperCase()} ${motor.voltage.replace('-', ' ')} MOTOR (BY OTHERS)` : jb ? 'ENCLOSURE TO BE SELECTED' : c ? 'PART NOT IN CATALOG — VERIFY' : io && io.location !== 'field' ? 'NOT IN COMPONENT LIST / BOM — VERIFY' : 'NO PART SELECTED'),
      qty: c?.comp.quantity ?? 1,
      location,
      refs: refs || '—',
    };
  });
}

/**
 * Replaces `{key}` placeholders with cross-reference values. `{=key}` inserts the bare value
 * ("?" when unknown); line keys (io:, coil:, ps:, contacts:, rung:) get a "/" pointer prefix.
 */
export function resolveRefs(text: string, xref: Map<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (_, k: string) => {
    if (k.startsWith('=')) return xref.get(k.slice(1)) ?? '?';
    const v = xref.get(k);
    if (k.startsWith('io:') || k.startsWith('coil:') || k.startsWith('ps:') || k.startsWith('contacts:') || k.startsWith('rung:')) return v ? `/${v}` : '';
    return v ?? '—';
  }).replace(/\s+$/, '');
}
