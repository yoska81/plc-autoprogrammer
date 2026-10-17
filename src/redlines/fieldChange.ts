import type { DesignInputs, ElectricalDesign, StarterType } from '../electrical/types';
import type { IOPoint } from '../types/io';

/**
 * Redlines and field changes: a change marked on a drawing sheet (or entered as a field change)
 * is turned into design edits where the app can make them, the rest is kept as a manual change.
 * Every change, applied or not, goes into the change list of the next revision.
 */

export interface Redline {
  id: string;
  /** Where it was marked: a drawing sheet (position as a fraction of the sheet) or the field change form. */
  at: { kind: 'sheet'; sheet: number; drawingNo: string; title: string; x: number; y: number } | { kind: 'form' };
  /** The change in the user's words ("M1 is 3 HP", "Replace K1 with LC1D18BD"). */
  note: string;
  by: string;
  /** YYYY-MM-DD HH:MM */
  date: string;
  /** open = not in a revision yet; applied = design edited and in revision `rev`; manual = recorded in revision `rev`, edit by hand. */
  status: 'open' | 'applied' | 'manual';
  rev?: string;
  /** What was done (one line per edit), filled when applied. */
  done?: string[];
}

export type DesignEdit =
  | { kind: 'motor-hp'; tag: string; hp: number }
  | { kind: 'motor-starter'; tag: string; starter: StarterType }
  | { kind: 'io-description'; address: string; description: string }
  | { kind: 'device-location'; tag: string; location: string }
  | { kind: 'part'; tag: string; partNumber: string };

/** What the parser may refer to: the design's tags, the I/O addresses, the catalog. */
export interface ChangeContext {
  design: ElectricalDesign | null;
  inputs: DesignInputs;
  io: IOPoint[];
  addresses: Map<string, string>;
  /** Part exists in the catalog. */
  hasPart: (partNumber: string) => boolean;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tagRe = (tags: string[]) => (tags.length ? new RegExp(`\\b(${tags.map(esc).sort((a, b) => b.length - a.length).join('|')})\\b`, 'i') : null);
const canonical = (tags: string[], found: string) => tags.find((t) => t.toUpperCase() === found.toUpperCase()) ?? found;

/** The design edits a change note asks for (empty when the app cannot make it itself). */
export function parseChange(note: string, c: ChangeContext): DesignEdit[] {
  const out: DesignEdit[] = [];
  const text = note.trim();
  const motors = [...new Set([...c.inputs.motors.map((m) => m.tag), ...(c.design?.inputs.motors.map((m) => m.tag) ?? [])])];
  // Each sentence on its own ("M1 is 3 HP. Move PE1 to the infeed.").
  for (const s of text.split(/(?<=[.;])\s+|\n+/).map((x) => x.trim()).filter(Boolean)) {
    const mt = tagRe(motors)?.exec(s);
    if (mt) {
      const tag = canonical(motors, mt[1]);
      const p = /(\d+(?:\.\d+)?)\s*(hp|kw)\b/i.exec(s);
      if (p) out.push({ kind: 'motor-hp', tag, hp: Math.round((p[2].toLowerCase() === 'kw' ? Number(p[1]) / 0.7457 : Number(p[1])) * 100) / 100 });
      if (/\b(vfd|variable[- ]speed|drive|inverter)\b/i.test(s) && !/\bno (vfd|drive)\b|\bwithout (a )?(vfd|drive)\b/i.test(s)) out.push({ kind: 'motor-starter', tag, starter: 'vfd' });
      else if (/\b(dol|across[- ]the[- ]line|direct[- ]on[- ]line|contactor (and|\+) overload)\b/i.test(s)) out.push({ kind: 'motor-starter', tag, starter: 'contactor-overload' });
      else if (/\bmotor protector\b/i.test(s)) out.push({ kind: 'motor-starter', tag, starter: 'motor-protector' });
      if (out.some((e) => 'tag' in e && e.tag === tag)) continue;
    }
    // "X003 description: Guard door closed" / "Change the description of Y002 to …"
    const addrs = c.io.map((p) => c.addresses.get(p.id) ?? '').filter(Boolean);
    const at = tagRe(addrs)?.exec(s);
    const desc = at && /\b(description|label|text|name)\b\s*(?:to|:|=|is now|should be)\s*["“']?(.+?)["”']?\s*\.?$/i.exec(s);
    if (at && desc) { out.push({ kind: 'io-description', address: canonical(addrs, at[1]), description: desc[2].trim() }); continue; }
    const devices = [...new Set([...(c.design?.ioWiring.map((w) => w.deviceTag) ?? []), ...(c.design?.components.map((x) => x.tag) ?? [])])];
    const dt = tagRe(devices)?.exec(s);
    if (!dt) continue;
    const tag = canonical(devices, dt[1]);
    // "Move PE1 to the infeed conveyor" / "PE1 relocated to …"
    const loc = /\b(?:moved?|relocated?|mounted|installed|located)\b.*?\s(?:to|at|on|in)\s+(?:the\s+)?(.+?)\s*\.?$/i.exec(s);
    if (loc && c.design?.ioWiring.some((w) => w.deviceTag === tag)) { out.push({ kind: 'device-location', tag, location: loc[1].charAt(0).toUpperCase() + loc[1].slice(1) }); continue; }
    // "Replace K1 with LC1D18BD" / "K1 changed to 3RT2016-1BB41"
    const part = /\b(?:replace[sd]?|swap(?:ped)?|change[sd]?|substitute[sd]?|use)\b.*?\b(?:with|to|by|for)\s+([A-Za-z0-9][A-Za-z0-9\-./]{3,})\s*\.?$/i.exec(s);
    if (part && c.design?.components.some((x) => x.tag === tag) && c.hasPart(part[1])) out.push({ kind: 'part', tag, partNumber: part[1] });
  }
  return out;
}

export function describeEdit(e: DesignEdit): string {
  switch (e.kind) {
    case 'motor-hp': return `${e.tag} power set to ${e.hp} HP (run Update design to resize its protection and wiring)`;
    case 'motor-starter': return `${e.tag} starter set to ${e.starter === 'vfd' ? 'VFD' : e.starter === 'motor-protector' ? 'motor protector + contactor' : 'contactor + overload'} (run Update design to redraw its circuit)`;
    case 'io-description': return `${e.address} description set to "${e.description}"`;
    case 'device-location': return `${e.tag} location set to "${e.location}"`;
    case 'part': return `${e.tag} part changed to ${e.partNumber}`;
  }
}

/** The design, the inputs and the I/O list with the edits made (pure). */
export function applyEdits(edits: DesignEdit[], s: { design: ElectricalDesign | null; inputs: DesignInputs; io: IOPoint[]; addresses: Map<string, string> }) {
  let { design, inputs, io } = s;
  const motor = (list: DesignInputs['motors'], tag: string, patch: Partial<DesignInputs['motors'][number]>) => list.map((m) => (m.tag === tag ? { ...m, ...patch } : m));
  for (const e of edits) {
    if (e.kind === 'motor-hp' || e.kind === 'motor-starter') {
      const patch = e.kind === 'motor-hp' ? { hp: e.hp } : { starter: e.starter };
      inputs = { ...inputs, motors: motor(inputs.motors, e.tag, patch) };
      if (design) design = { ...design, inputs: { ...design.inputs, motors: motor(design.inputs.motors, e.tag, patch) } };
    } else if (e.kind === 'io-description') {
      io = io.map((p) => (s.addresses.get(p.id)?.toUpperCase() === e.address.toUpperCase() ? { ...p, description: e.description } : p));
      if (design) design = { ...design, ioWiring: design.ioWiring.map((w) => (w.address.toUpperCase() === e.address.toUpperCase() ? { ...w, description: e.description } : w)) };
    } else if (e.kind === 'device-location' && design) {
      design = { ...design, ioWiring: design.ioWiring.map((w) => (w.deviceTag === e.tag ? { ...w, location: e.location } : w)) };
    } else if (e.kind === 'part' && design) {
      design = { ...design, components: design.components.map((x) => (x.tag === e.tag ? { ...x, partNumber: e.partNumber } : x)) };
    }
  }
  return { design, inputs, io };
}

/** Next revision letter: A, B, … Z, AA (or numeric 0, 1, 2 when numbering started with a digit). */
export function nextRev(revs: { rev: string }[]): string {
  const last = revs[revs.length - 1]?.rev;
  if (!last) return 'A';
  if (/^\d+$/.test(last)) return String(Number(last) + 1);
  const up = last.toUpperCase();
  return up.endsWith('Z') ? `${up}A` : up.slice(0, -1) + String.fromCharCode(up.charCodeAt(up.length - 1) + 1);
}

/** One line of the revision's change list. */
export function changeLine(r: Redline, done: string[]): string {
  const where = r.at.kind === 'sheet' ? `Sheet ${r.at.sheet} (${r.at.drawingNo})` : 'Field change';
  return `${where}: ${r.note.trim()}${done.length ? ` → ${done.join('; ')}` : ' → to be edited by hand'}`;
}
