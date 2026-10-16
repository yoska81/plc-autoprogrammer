/**
 * Sheet planning: decides which sheets exist, their order/numbering, the line
 * (rung) every element sits on, and resolves cross-references. Pure data — the
 * sheet components only draw what is planned here.
 */
import {
  billOfMaterials, buildModel, designWarnings, panelLayout,
  type AuxBranch, type BomLine, type DrawingContext, type ElectricalModel, type IoGroup, type IoPoint,
  type MotorModel, type PanelLayout, type PsBranch, type Terminal, type TerminalStrip,
} from '../derive';
import { lineNo } from './geometry';

export type RungEnd = { kind: 'rail' } | { kind: 'node'; label: string } | { kind: 'xref'; label: string };
export type RungEl =
  | { t: 'contact'; nc: boolean; tag: string; term: string; dev: 'pb' | 'estop' | 'relay' | 'ol' | 'sr' }
  | { t: 'coil'; tag: string }
  | { t: 'lamp'; tag: string; color: string }
  | { t: 'box'; tag: string; left: string; right: string };
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

export type PowerBranchPlan = { type: 'ps'; b: PsBranch; idx: number } | { type: 'aux'; b: AuxBranch; idx: number };
export type TermRow = { kind: 'header'; strip: TerminalStrip; cont?: boolean } | { kind: 'row'; t: Terminal };
export type BomRow = { kind: 'group'; title: string } | { kind: 'line'; line: BomLine };

export type SheetSpec =
  | { kind: 'cover' }
  | { kind: 'notes'; notes: string[]; warnings: string[] }
  | { kind: 'power'; branches: PowerBranchPlan[]; contIdx: number; groundIdx: number }
  | { kind: 'motors'; items: { m: MotorModel; idx: number }[]; busEnd: number; continues: boolean; first: boolean }
  | { kind: 'control'; rungs: Rung[] }
  | { kind: 'io'; group: IoGroup; points: IoPoint[]; first: boolean; last: boolean }
  | { kind: 'panel' }
  | { kind: 'door' }
  | { kind: 'terminals'; columns: TermRow[][] }
  | { kind: 'bom'; rows: BomRow[]; first: boolean };

export interface PlannedSheet { n: number; title: string; drawingNo: string; spec: SheetSpec }

export interface DrawingPlan {
  ctx: DrawingContext;
  model: ElectricalModel;
  layout: PanelLayout;
  sheets: PlannedSheet[];
  xref: Map<string, string>;
  date: string;
  docPrefix: string;
}

export const POWER_PITCH = 7.5;
export const MOTOR_PITCH = 7.5;
export const CONTROL_PITCH = 10;
export const IO_PITCH = 12;
export const MOTOR_LINES = 27;
export const CONTROL_RUNGS = 21;
export const IO_PER_SHEET = 16;
export const TERM_ROWS = 40;
export const BOM_ROWS = 31;

const letter = (i: number) => (i === 0 ? '' : String.fromCharCode(64 + i));

function docPrefix(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return 'PRJ';
  if (words.length === 1) return words[0].slice(0, 6);
  return words.slice(0, 4).map((w) => w[0]).join('');
}

function controlRungs(model: ElectricalModel): Omit<Rung, 'idx'>[] {
  const out: Omit<Rung, 'idx'>[] = [];
  const s = model.safety;
  const rail: RungEnd = { kind: 'rail' };
  if (s.relay) {
    const sr = s.relay.tag;
    out.push({ start: rail, end: rail, els: [{ t: 'box', tag: sr, left: 'A1', right: 'A2' }], wires: ['24+', '0V'], desc: [`SAFETY RELAY ${sr} SUPPLY`, `CONTACTS: {c:${sr}}`], key: `coil:${sr}` });
    const es = s.estops.length ? s.estops : ['ES?'];
    for (const [a, b, term, ch] of [['S11', 'S12', '11-12', 1], ['S21', 'S22', '21-22', 2]] as const) {
      out.push({
        start: { kind: 'node', label: `${sr} ${a}` }, end: { kind: 'node', label: `${sr} ${b}` },
        els: es.map((tag) => ({ t: 'contact', nc: true, tag, term, dev: 'estop' })),
        wires: [a, ...es.slice(1).map((_, k) => `${a}${letter(k + 1)}`), b],
        desc: [`E-STOP CHANNEL ${ch} (${es.join(', ')})`, ch === 1 ? 'DUAL CHANNEL, CROSS-MONITORED' : ''],
      });
    }
    const rs = s.reset ?? 'PB?';
    out.push({
      start: { kind: 'node', label: `${sr} S33` }, end: { kind: 'node', label: `${sr} S34` },
      els: [{ t: 'contact', nc: false, tag: rs, term: '13-14', dev: 'pb' }, ...s.edm.map((tag) => ({ t: 'contact' as const, nc: true, tag, term: '21-22', dev: 'relay' as const }))],
      wires: ['S33', ...s.edm.map((_, k) => `S33${letter(k + 1)}`), 'S34'],
      desc: ['SAFETY RESET (MONITORED, MANUAL)', s.edm.length ? `FEEDBACK (EDM): ${s.edm.join(', ')}` : ''],
    });
    if (s.mcr) {
      out.push({ start: rail, end: rail, els: [{ t: 'contact', nc: false, tag: sr, term: '13-14', dev: 'sr' }, { t: 'coil', tag: s.mcr.tag }], wires: ['24+', 'SR14', '0V'], desc: [`MASTER CONTROL RELAY ${s.mcr.tag}`, `CONTACTS: {c:${s.mcr.tag}}`], key: `coil:${s.mcr.tag}` });
      out.push({ start: rail, end: { kind: 'xref', label: '24+S TO PLC OUTPUTS' }, els: [{ t: 'contact', nc: false, tag: s.mcr.tag, term: '13-14', dev: 'relay' }], wires: ['24+', '24+S'], desc: ['SAFETY-SWITCHED +24V (24+S)', 'FEEDS OUTPUT SUPPLY {s:out}'], key: 'rung:24+S' });
    } else {
      out.push({ start: rail, end: { kind: 'xref', label: '24+S TO PLC OUTPUTS' }, els: [{ t: 'contact', nc: false, tag: sr, term: '13-14', dev: 'sr' }], wires: ['24+', '24+S'], desc: ['SAFETY-SWITCHED +24V (24+S)', 'FEEDS OUTPUT SUPPLY {s:out}'], key: 'rung:24+S' });
    }
  } else if (s.estops.length) {
    const es = s.estops;
    const els: RungEl[] = es.map((tag) => ({ t: 'contact', nc: true, tag, term: '11-12', dev: 'estop' }));
    if (s.mcr) els.push({ t: 'coil', tag: s.mcr.tag });
    out.push({
      start: rail, end: s.mcr ? rail : { kind: 'xref', label: '24+S TO PLC OUTPUTS' }, els,
      wires: ['24+', ...es.slice(1).map((_, k) => `ES${k + 1}`), '24+S', ...(s.mcr ? ['0V'] : [])],
      desc: ['E-STOP CHAIN (HARDWIRED, NO SAFETY RELAY)', 'REVIEW REQUIRED — SEE NOTES'], key: s.mcr ? `coil:${s.mcr.tag}` : 'rung:24+S',
    });
  }
  // pilot lights not driven by the PLC, e.g. "control power on"
  const ioTags = new Set(model.io.map((p) => p.deviceTag));
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
    out.push({
      start: { kind: 'xref', label: `${p.address} {io:${p.address}}` }, end: rail,
      els: [...ch.devices.map((d) => ({ t: 'contact' as const, nc: d.nc, tag: d.tag, term: d.terminals, dev: d.kind === 'ol' ? 'ol' as const : 'relay' as const })), { t: 'coil', tag: p.deviceTag || '?' }],
      wires: [...ch.wires, '0V'],
      desc: [p.description.toUpperCase(), `${p.deviceTag} CONTACTS: {c:${p.deviceTag}}`], key: `coil:${p.deviceTag}`,
    });
  }
  return out;
}

export function planDrawings(ctx: DrawingContext): DrawingPlan {
  const model = buildModel(ctx);
  const layout = panelLayout(ctx);
  const specs: { title: string; spec: SheetSpec }[] = [];

  specs.push({ title: 'COVER SHEET, DRAWING INDEX & GENERAL NOTES', spec: { kind: 'cover' } });
  const warnings = designWarnings(ctx);
  if (ctx.design.notes.length || warnings.length) specs.push({ title: 'DESIGN NOTES & ENGINEERING REVIEW ITEMS', spec: { kind: 'notes', notes: ctx.design.notes, warnings } });

  // power distribution
  const branches: PowerBranchPlan[] = [];
  let idx = 7;
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

  // IO
  for (const type of ['input', 'output'] as const) {
    for (const g of model.groups.filter((x) => x.type === type)) {
      for (let i = 0; i < g.points.length; i += IO_PER_SHEET) {
        const pts = g.points.slice(i, i + IO_PER_SHEET);
        specs.push({
          title: `PLC ${type === 'input' ? 'INPUTS' : 'OUTPUTS'} — ${g.label} (${pts.length > 1 ? `${pts[0].address}–${pts[pts.length - 1].address}` : pts[0].address})`,
          spec: { kind: 'io', group: g, points: pts, first: i === 0, last: i + IO_PER_SHEET >= g.points.length },
        });
      }
    }
  }

  specs.push({ title: 'PANEL LAYOUT — BACKPLATE', spec: { kind: 'panel' } });
  if (layout.door.items.length) specs.push({ title: 'DOOR LAYOUT — OPERATOR DEVICES', spec: { kind: 'door' } });

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

  // BOM
  const bomRows: BomRow[] = [];
  for (const g of billOfMaterials(ctx)) { bomRows.push({ kind: 'group', title: g.title }); for (const l of g.lines) bomRows.push({ kind: 'line', line: l }); }
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

  const prefix = docPrefix(ctx.projectName);
  const sheets: PlannedSheet[] = specs.map((s, i) => ({ n: i + 1, title: s.title, drawingNo: `${prefix}-E${String(i + 1).padStart(2, '0')}`, spec: s.spec }));

  // ---- cross references
  const xref = new Map<string, string>();
  const contacts = new Map<string, string[]>();
  const addContact = (tag: string, text: string) => { const l = contacts.get(tag) ?? []; if (!l.includes(text)) l.push(text); contacts.set(tag, l); };
  const outSheets: number[] = [];
  for (const sh of sheets) {
    const sp = sh.spec;
    xref.set(`sheet:${sp.kind}`, xref.get(`sheet:${sp.kind}`) ?? String(sh.n));
    if (sp.kind === 'power') {
      for (const b of sp.branches) if (b.type === 'ps') xref.set(`ps:${b.b.ps.tag}`, String(lineNo(sh.n, b.idx)));
      xref.set('power:cont', String(lineNo(sh.n, sp.contIdx + 1)));
      xref.set('power:ground', String(lineNo(sh.n, sp.groundIdx)));
    } else if (sp.kind === 'motors') {
      if (sp.first) xref.set('motors', String(lineNo(sh.n, 0)));
      for (const it of sp.items) {
        const m = it.m;
        const rev = m.motor.reversing && m.contactors.length >= 2 && !m.vfd;
        m.contactors.forEach((c, k) => {
          const l = lineNo(sh.n, it.idx + 1 + (k === 1 && rev ? 4 : 0));
          xref.set(`contacts:${c.tag}`, String(l));
          addContact(c.tag, `MAIN ${l}`);
        });
        if (m.overload) addContact(m.overload.tag, `HEATERS ${lineNo(sh.n, it.idx + 1)}`);
        xref.set(`motor:${m.motor.tag}`, String(lineNo(sh.n, it.idx)));
      }
    } else if (sp.kind === 'control') {
      for (const r of sp.rungs) {
        const l = lineNo(sh.n, r.idx);
        if (r.key) xref.set(r.key, String(l));
        for (const e of r.els) if (e.t === 'contact') addContact(e.tag, `${e.term}${e.nc ? ' NC' : ''} ${l}`);
      }
    } else if (sp.kind === 'io') {
      sp.points.forEach((p, i) => {
        const l = lineNo(sh.n, i + 1);
        xref.set(`io:${p.address}`, String(l));
        if (p.deviceType === 'safety-relay-output') addContact(p.deviceTag || model.safety.relay?.tag || '', `23-24 ${l}`);
        if (p.deviceType === 'estop-contact') addContact(p.deviceTag, `13-14 ${l}`);
      });
      if (sp.group.type === 'output' && sp.first) outSheets.push(lineNo(sh.n, 0));
    }
  }
  for (const [tag, list] of contacts) xref.set(`c:${tag}`, list.join(', '));
  xref.set('s:out', outSheets.map((l) => `/${l}`).join(', '));

  const date = (ctx.design.generatedAt || '').slice(0, 10) || '—';
  return { ctx, model, layout, sheets, xref, date, docPrefix: prefix };
}

/** Replaces `{key}` placeholders with cross-reference values ("?" when unknown). */
export function resolveRefs(text: string, xref: Map<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (_, k: string) => {
    const v = xref.get(k);
    if (k.startsWith('io:') || k.startsWith('coil:') || k.startsWith('ps:') || k.startsWith('contacts:') || k.startsWith('rung:')) return v ? `/${v}` : '';
    return v ?? '—';
  }).replace(/\s+$/, '');
}
