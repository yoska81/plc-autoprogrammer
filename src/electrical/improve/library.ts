/**
 * Standard-panel library: proven designs, or one section of a design (a motor starter, the safety circuit,
 * the 24 VDC supply section), saved once and reused. A whole panel starts a new project; a section is added
 * to the open design with its device tags renumbered so nothing clashes. The library lives in app storage
 * (all projects) and travels as a JSON file (export / import).
 */
import type { CatalogPart, DesignComponent, DesignInputs, ElectricalDesign, MotorSpec, SupplyVoltage } from '../types';
import type { IOPoint } from '../../types/io';

export type LibraryKind = 'panel' | 'motor-starter' | 'safety' | 'psu';

export const KIND_LABEL: Record<LibraryKind, string> = {
  panel: 'Whole panel', 'motor-starter': 'Motor starter', safety: 'Safety circuit', psu: '24 V power supply section',
};

/** What a whole panel brings to a new project besides the electrical design. */
export interface PanelProject {
  io: IOPoint[];
  plcId: string;
  cpuId: string;
  modules: string[];
  hmiPartNumber: string;
  region: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  kind: LibraryKind;
  /** Plain-words summary shown in the list. */
  summary: string;
  savedAt: string;
  /** Project it was saved from. */
  from: string;
  supply: SupplyVoltage;
  components: DesignComponent[];
  /** Motor of a motor-starter section. */
  motor?: MotorSpec;
  /** Whole panel only. */
  design?: ElectricalDesign;
  project?: PanelProject;
}

export const LIBRARY_FORMAT = 'isa-panel-library';
export const LIBRARY_VERSION = 1;

const newId = () => `lib_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Components of one section of a design. */
export function sectionComponents(design: ElectricalDesign, kind: Exclude<LibraryKind, 'panel'>, getPart: (pn: string) => CatalogPart | undefined, motorTag?: string): DesignComponent[] {
  const cat = (c: DesignComponent) => getPart(c.partNumber)?.category;
  if (kind === 'motor-starter') return design.components.filter((c) => motorTag && c.motorTag === motorTag);
  if (kind === 'safety') {
    return design.components.filter((c) => !c.motorTag && (cat(c) === 'safetyRelay' || cat(c) === 'estop' || /^(SR|ES)\d/.test(c.tag)
      || /\b(e-?stop|safety relay|safety reset|emergency stop)\b/i.test(c.function)));
  }
  return design.components.filter((c) => !c.motorTag && (cat(c) === 'powerSupply' || getPart(c.partNumber)?.ratings.kind === 'transformer'
    || ((cat(c) === 'breaker' || cat(c) === 'fuse') && /power supply|control transformer|\bT\d+F[PS]\b/i.test(`${c.tag} ${c.function}`))));
}

export function makeSection(design: ElectricalDesign, kind: Exclude<LibraryKind, 'panel'>, name: string, from: string, getPart: (pn: string) => CatalogPart | undefined, motorTag?: string): LibraryItem | null {
  const components = sectionComponents(design, kind, getPart, motorTag);
  if (!components.length) return null;
  const motor = kind === 'motor-starter' ? design.inputs.motors.find((m) => m.tag === motorTag) : undefined;
  const parts = components.map((c) => `${c.tag} ${c.partNumber}`).join(', ');
  return {
    id: newId(), name: name.trim() || KIND_LABEL[kind], kind, from, savedAt: new Date().toISOString(), supply: design.inputs.supply, components: structuredClone(components),
    motor: motor ? { ...motor } : undefined,
    summary: `${motor ? `${motor.hp} HP ${motor.starter.replace(/-/g, ' ')}${motor.reversing ? ', reversing' : ''} at ` : ''}${design.inputs.supply.replace('VAC-', ' V ').replace('PH', '-phase')}: ${parts}`,
  };
}

export function makePanel(design: ElectricalDesign, project: PanelProject, name: string, from: string): LibraryItem {
  const motors = design.inputs.motors.map((m) => `${m.tag} ${m.hp} HP`).join(', ');
  return {
    id: newId(), name: name.trim() || from || 'Standard panel', kind: 'panel', from, savedAt: new Date().toISOString(), supply: design.inputs.supply,
    components: structuredClone(design.components), design: structuredClone(design), project: structuredClone(project),
    summary: `${design.inputs.supply.replace('VAC-', ' V ').replace('PH', '-phase')}, ${design.inputs.enclosureRating}, ${design.components.length} parts, ${project.io.length} I/O points${motors ? `, motors ${motors}` : ''}`,
  };
}

const TAG_RE = /^([A-Z]+)(\d+)(.*)$/;

/**
 * Add a section to a design: tags renumbered past the ones in use (K1 → K3, K1-AUX → K3-AUX, FU1F → FU2F),
 * a motor starter gets the next free motor tag. Returns the design and the tag mapping.
 */
export function insertSection(design: ElectricalDesign, item: LibraryItem): { design: ElectricalDesign; tags: Map<string, string>; motorTag?: string } {
  const used = new Set(design.components.map((c) => c.tag));
  const highest = new Map<string, number>();
  for (const t of used) {
    const m = TAG_RE.exec(t);
    if (m) highest.set(m[1], Math.max(highest.get(m[1]) ?? 0, Number(m[2])));
  }
  const base = new Map<string, string>();
  const rename = (tag: string): string => {
    const m = TAG_RE.exec(tag);
    if (!m) { let t = tag, k = 2; while (used.has(t)) t = `${tag}-${k++}`; return t; }
    const key = `${m[1]}${m[2]}`;
    if (!base.has(key)) {
      // Keep the tag when it is free (an empty design takes the section as it was saved).
      if (![...used].some((u) => TAG_RE.exec(u)?.slice(1, 3).join('') === key)) base.set(key, key);
      else { const n = (highest.get(m[1]) ?? 0) + 1; highest.set(m[1], n); base.set(key, `${m[1]}${n}`); }
    }
    return `${base.get(key)}${m[3]}`;
  };
  const tags = new Map<string, string>();
  for (const c of item.components) tags.set(c.tag, rename(c.tag));

  let motorTag: string | undefined;
  let motors = design.inputs.motors;
  if (item.motor) {
    const taken = new Set(motors.map((m) => m.tag));
    let n = 1;
    while (taken.has(`M${n}`)) n++;
    motorTag = item.motor.tag && !taken.has(item.motor.tag) ? item.motor.tag : `M${n}`;
    motors = [...motors, { ...item.motor, tag: motorTag, voltage: design.inputs.supply }];
  }
  // One pass over the text, so K1 → K3 and K3 → K5 never chain.
  const map = new Map([...base].filter(([a, b]) => a !== b));
  if (item.motor && motorTag && motorTag !== item.motor.tag) map.set(item.motor.tag, motorTag);
  const re = map.size ? new RegExp(`\\b(${[...map.keys()].join('|')})(?![0-9])`, 'g') : null;
  const swapTags = (text: string) => (re ? text.replace(re, (t) => map.get(t) ?? t) : text);
  const added = item.components.map((c) => ({ ...c, tag: tags.get(c.tag)!, function: swapTags(c.function), motorTag: c.motorTag && item.motor ? motorTag ?? null : c.motorTag ?? null }));
  const note = `Added from the panel library: "${item.name}" (${added.map((c) => c.tag).join(', ')}). Wire it to the I/O list and check the drawings; "Update design" replaces it with the rules' own choice.`;
  const inputs: DesignInputs = { ...design.inputs, motors };
  return { design: { ...design, inputs, components: [...design.components, ...added], notes: [...design.notes, note] }, tags, motorTag };
}

export function libraryFile(items: LibraryItem[]): string {
  return JSON.stringify({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, exportedAt: new Date().toISOString(), items }, null, 2);
}

const isComp = (c: unknown): c is DesignComponent => !!c && typeof c === 'object' && typeof (c as DesignComponent).tag === 'string' && typeof (c as DesignComponent).partNumber === 'string' && Number.isFinite((c as DesignComponent).quantity);

/** Read a library file; throws a plain-words error when it is not one. */
export function parseLibrary(text: string): LibraryItem[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not a panel library (it could not be read).'); }
  const d = data as { format?: string; version?: number; items?: unknown[] };
  if (d?.format !== LIBRARY_FORMAT || !Array.isArray(d.items)) throw new Error('This file is not a panel library exported from ISA Auto Programmer.');
  if ((d.version ?? 0) > LIBRARY_VERSION) throw new Error('This library was made by a newer version of the app: update the app to read it.');
  const kinds = Object.keys(KIND_LABEL);
  return d.items.filter((x): x is LibraryItem => {
    const i = x as LibraryItem;
    return !!i && typeof i.name === 'string' && kinds.includes(i.kind) && Array.isArray(i.components) && i.components.every(isComp)
      && (i.kind !== 'panel' || (!!i.design && Array.isArray(i.design.components) && !!i.project && Array.isArray(i.project.io)));
  });
}

/** Imported items added to the library: same id and content = already there; same id, other content = kept as a copy. */
export function mergeLibrary(current: LibraryItem[], incoming: LibraryItem[]): { items: LibraryItem[]; added: number } {
  const out = [...current];
  let added = 0;
  for (const it of incoming) {
    const same = out.find((x) => x.id === it.id);
    if (same && JSON.stringify(same) === JSON.stringify(it)) continue;
    out.push(same ? { ...it, id: newId() } : it);
    added++;
  }
  return { items: out, added };
}
