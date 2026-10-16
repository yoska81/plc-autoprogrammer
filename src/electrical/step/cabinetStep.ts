/**
 * 3D STEP (ISO 10303-21, AP214) export of the designed control cabinet, for integrating the
 * cabinet into the machine model in SolidWorks / Inventor / Fusion / FreeCAD.
 *
 * Built from the same panelLayout() as the 2D layout sheets, so positions always agree.
 *
 * Frame (mm): origin at the front-bottom-left outer corner of the enclosure; +X to the right
 * (as seen from the front), +Y into the cabinet (front opening at Y = 0, back wall at Y = depth),
 * +Z up. The door is closed (Y = -door thickness .. 0) and hinged on the left (X = 0).
 *
 * Assembly tree:
 *   "<project> cabinet"
 *     ├─ enclosure (shell, front flange, back-panel studs, wall-mount feet when wall-mount)
 *     ├─ "<ENC> door assembly"  (origin on the hinge line: rotate about its Z axis to open)
 *     │    ├─ door (plate with cutouts, gasket, hinges, latches), operators, HMI, handle
 *     └─ "<ENC> back panel assembly" (origin = front face of the back panel, bottom-left corner)
 *          ├─ back panel, DIN rails, wire ducts, every back-panel component, disconnect shaft
 *
 * Each component is one part made of several solids (see shapes.ts): a recognisable model of
 * its product family that fills exactly the layout footprint x depth envelope. Depth comes from
 * the catalog or a per-category default. A shape that cannot be built for unusual sizes falls
 * back to the plain envelope box.
 */
import { panelLayout, terminalPlan, type DoorItem, type DrawingContext, type PlacedItem } from '../derive';
import type { CatalogCategory, CatalogPart } from '../types';
import { getHmi } from '../../hmi/hmiCatalog';
import {
  solidBounds, unionBounds, validateSolid, writeStepAssembly,
  type Bounds, type Rgb, type SolidGeom, type StepAssembly, type StepPart, type StepSolid, type V3,
} from './stepWriter';
import {
  COL, breakerShape, bx, contactorShape, cylY, cylZ, disconnectShape, ductShape, fuseHolderShape, genericShape, groundBarShape,
  handleShape, hmiShape, motorProtectorShape, operatorShape, overloadShape, plcShape, powerSupplyShape, px, railSlots, relayShape,
  safetyRelayShape, terminalStripShape, transformerShape, vfdShape, type OperatorKind, type ShapeInput, type StripPiece,
} from './shapes';

export interface CabinetStepOptions {
  /** HMI to put on the door when the design itself has no HMI component. */
  hmiPartNumber?: string | null;
  /** Include the door and door devices (default true). */
  includeDoor?: boolean;
}

export type CabinetBodyKind = 'enclosure' | 'door' | 'backPanel' | 'dinRail' | 'wireDuct' | 'component' | 'doorDevice' | 'hmi' | 'handle';

export interface CabinetStepBody {
  /** Product name in the STEP file: "TAG — PARTNUMBER". */
  name: string;
  tag: string;
  partNumber: string;
  description: string;
  kind: CabinetBodyKind;
  category?: CatalogCategory;
  /** Sub-assembly the body belongs to. */
  assembly: 'cabinet' | 'door' | 'backPanel';
  /** Axis-aligned envelope in the cabinet frame (mm): min corner and size along X (width), Y (depth), Z (height). */
  min: [number, number, number];
  size: [number, number, number];
  /** Width/height not from catalog data. */
  sizeEstimated: boolean;
  /** Depth not from catalog data (per-category default). */
  depthEstimated: boolean;
  /** Display colour (main body), #rrggbb. */
  color: string;
  /** Number of solids in the part (multi-body part). */
  solids?: number;
  /** Detailed shape could not be built for this size: the part is a plain envelope box. */
  simplified?: boolean;
}

export interface CabinetStepSummary {
  /** Coordinate frame description for the UI note. */
  frame: string;
  enclosure: { w: number; h: number; d: number; sizeEstimated: boolean; depthEstimated: boolean; partNumber?: string };
  bodies: CabinetStepBody[];
  /** Bodies whose size or depth is estimated. */
  estimatedCount: number;
  /** Parts in the design that are not in the 3D model, with the reason. */
  notModelled: { tag: string; partNumber: string; reason: string }[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALL = 1.5;          // enclosure sheet steel
const DOOR_T = 1.5;        // door sheet steel
const PANEL_T = 2.5;       // back panel
const STANDOFF = 10;       // back wall to back panel (collar studs)
const RAIL_D = 7.5;        // TS35 x 7.5 DIN rail
const HOLE_22 = 22.5 / 2;  // 22 mm operator mounting hole radius
const HMI_BODY_D = 55;     // HMI depth behind the door when unknown
const DEFAULT_DUCT_D = 76; // 3" wire duct
const GASKET_T = 3;        // door gasket (the body flange sits behind it)
const FLANGE_W = 20;       // enclosure front flange width
/** Terminal slices above this count are modelled without screw/wire pockets and markers (file size). */
const DETAILED_TERMINALS_MAX = 160;

/** Realistic default depths (mm, from the mounting surface) when the catalog has none. */
const DEFAULT_DEPTH: Partial<Record<CatalogCategory, number>> = {
  breaker: 75, fuse: 75, disconnect: 80, motorProtector: 80, contactor: 80, overload: 80, vfd: 140,
  powerSupply: 115, plc: 70, plcModule: 70, relay: 65, safetyRelay: 115, terminal: 45, groundBar: 20, other: 80,
};

const LENS: Record<string, Rgb> = {
  RED: [0.80, 0.08, 0.08], GREEN: [0.10, 0.62, 0.20], AMBER: [0.95, 0.60, 0.05], YELLOW: [0.95, 0.85, 0.10],
  BLUE: [0.10, 0.30, 0.80], WHITE: [0.95, 0.95, 0.95], BLACK: [0.10, 0.10, 0.10], CLEAR: [0.85, 0.90, 0.95],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(r: CatalogPart['ratings'] | undefined, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = r?.[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

const hex = (c: Rgb) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Depth from catalog data (ratings depthMm / depthIn / depth), else undefined. */
function catalogDepth(p: CatalogPart | undefined): number | undefined {
  const mm = num(p?.ratings, 'depthMm', 'depth');
  if (mm) return mm;
  const inch = num(p?.ratings, 'depthIn');
  return inch ? inch * 25.4 : undefined;
}

const isTransformerPart = (p: CatalogPart | undefined) => p?.ratings?.kind === 'transformer' || /\btransformer\b/i.test(p?.description ?? '');

function defaultDepth(cat: CatalogCategory, p: CatalogPart | undefined): number {
  if (isTransformerPart(p)) return 100;
  return DEFAULT_DEPTH[cat] ?? 80;
}

/** Wire duct depth (its height off the panel): ratings heightIn / heightMm, '…x 3"H' in the description, else 3". */
function ductDepth(p: CatalogPart | undefined): { d: number; estimated: boolean } {
  const mm = num(p?.ratings, 'heightMm');
  if (mm) return { d: mm, estimated: false };
  const inch = num(p?.ratings, 'heightIn');
  if (inch) return { d: inch * 25.4, estimated: false };
  const m = /x\s*([\d.]+)\s*(?:"|in)\s*H\b/i.exec(p?.description ?? '');
  if (m) return { d: parseFloat(m[1]) * 25.4, estimated: false };
  return { d: DEFAULT_DUCT_D, estimated: true };
}

/** TS35 x 7.5 top-hat profile in (y, z): y = 0 at the rail front lips, y = 7.5 on the panel; z 0..35. */
const HAT: [number, number][] = [
  [7.5, 4], [7.5, 31], [1, 31], [1, 35], [0, 35], [0, 30], [6.5, 30], [6.5, 5], [0, 5], [0, 0], [1, 0], [1, 4],
];

/** True when every solid is valid and (if given) the solids fill exactly the envelope 0..size. */
function solidsOk(solids: StepSolid[], size?: V3): boolean {
  if (!solids.length || solids.some((s) => validateSolid(s) !== null)) return false;
  if (!size) return true;
  const u = unionBounds(solids.map(solidBounds));
  return [0, 1, 2].every((k) => Math.abs(u.min[k]) < 1e-6 && Math.abs(u.max[k] - size[k]) < 1e-6);
}

/** The detailed shape of a back-panel component, in its envelope frame (front at y = 0). */
function componentSolids(cat: CatalogCategory, p: CatalogPart | undefined, s: ShapeInput, strip?: { pieces: StripPiece[]; detail: boolean }): StepSolid[] {
  if (cat === 'terminal' && strip) return terminalStripShape(s, strip.pieces, strip.detail);
  switch (cat) {
    case 'breaker': return breakerShape(s);
    case 'fuse': return fuseHolderShape(s);
    case 'motorProtector': return motorProtectorShape(s);
    case 'contactor': return contactorShape(s);
    case 'overload': return overloadShape(s);
    case 'powerSupply': return /\bclick\b/.test(s.text) ? plcShape(s, false) : powerSupplyShape(s);
    case 'plc': return plcShape(s, true);
    case 'plcModule': return plcShape(s, false);
    case 'relay': return relayShape(s);
    case 'safetyRelay': return safetyRelayShape(s);
    case 'vfd': return vfdShape(s);
    case 'disconnect': return disconnectShape(s);
    case 'groundBar': return groundBarShape(s);
    default: return isTransformerPart(p) ? transformerShape(s) : genericShape(s);
  }
}

/** Main colour of a component category (summary / fallback box). */
function componentColor(cat: CatalogCategory, p: CatalogPart | undefined): Rgb {
  switch (cat) {
    case 'plc': case 'plcModule': return COL.plc;
    case 'safetyRelay': return COL.safety;
    case 'terminal': return /\bblue\b/i.test(p?.description ?? '') ? COL.terminalBlue : COL.terminalGrey;
    case 'groundBar': return /copper/i.test(p?.description ?? '') && !/\btin/i.test(p?.description ?? '') ? COL.copper : COL.tin;
    case 'breaker': case 'fuse': return COL.moduleWhite;
    case 'contactor': case 'overload': case 'powerSupply': return COL.lightGrey;
    case 'vfd': case 'relay': return COL.charcoal;
    default: return isTransformerPart(p) ? COL.laminations : COL.darkGrey;
  }
}

const clampShaft = (v: number) => Math.max(4, Math.min(12, v));
const offset = (b: Bounds, o: V3): Bounds => ({ min: [b.min[0] + o[0], b.min[1] + o[1], b.min[2] + o[2]], max: [b.max[0] + o[0], b.max[1] + o[1], b.max[2] + o[2]] });

// ---------------------------------------------------------------------------
// Model building
// ---------------------------------------------------------------------------

interface Built {
  root: StepAssembly;
  summary: CabinetStepSummary;
}

function build(ctx: DrawingContext, opts: CabinetStepOptions = {}): Built {
  const L = panelLayout(ctx);
  const warnings: string[] = [];
  const notModelled: CabinetStepSummary['notModelled'] = [];
  const bodies: CabinetStepBody[] = [];
  const usedNames = new Set<string>();
  const uniqueName = (n: string) => {
    let k = n, i = 2;
    while (usedNames.has(k)) k = `${n} (${i++})`;
    usedNames.add(k);
    return k;
  };
  const partOf = (pn: string) => (pn ? ctx.getPart(pn) : undefined);
  const compByTag = new Map(ctx.design.components.map((c) => [c.tag, c] as const));

  // ---- Enclosure size --------------------------------------------------------------------------
  const W = L.enclosure.w, H = L.enclosure.h;
  const bp = L.backplate;
  const itemDepth = (it: PlacedItem) => catalogDepth(partOf(it.partNumber)) ?? defaultDepth(it.category, partOf(it.partNumber));
  const deepest = Math.max(0, ...L.items.flatMap((it) => (it.sub ?? [it]).map(itemDepth)));
  if (L.enclosure.estimated) warnings.push(`No enclosure size in the design — modelled as an estimated ${Math.round(W)} x ${Math.round(H)} mm enclosure.`);
  let D = L.enclosure.d ?? 0;
  const depthEstimated = !(D > 0);
  if (depthEstimated) {
    D = Math.max(200, Math.ceil((deepest + RAIL_D + PANEL_T + STANDOFF + WALL + 60) / 50) * 50);
    warnings.push(`Enclosure depth not in catalog data — modelled as ${D} mm.`);
  }
  const encPn = L.enclosure.partNumber ?? '';
  const encTag = L.enclosure.tag ?? 'ENC1';
  const encPart = partOf(encPn);
  const yPanel = D - WALL - STANDOFF - PANEL_T; // front face of the back panel (cabinet frame)
  const zOf = (y: number, h: number) => H - y - h; // layout (top-down) -> cabinet Z of the bottom edge

  const named = (tag: string, pn: string) => uniqueName(`${tag} — ${pn || 'no part number'}`);
  /** Records a part in the summary; `origin` is the part's parent-assembly origin in the cabinet frame. */
  const record = (part: StepPart, origin: V3, meta: Omit<CabinetStepBody, 'name' | 'description' | 'min' | 'size' | 'color' | 'solids'>, color: Rgb) => {
    const b = offset(unionBounds(part.solids.map(solidBounds)), [origin[0] + part.at[0], origin[1] + part.at[1], origin[2] + part.at[2]]);
    bodies.push({
      ...meta, name: part.name, description: part.description, color: hex(color), solids: part.solids.length,
      min: b.min.map(r1) as [number, number, number], size: [0, 1, 2].map((k) => r1(b.max[k] - b.min[k])) as [number, number, number],
    });
  };

  // ---- Enclosure (shell, front flange, back-panel studs, wall-mount feet) -----------------------
  const encName = named(encTag, encPn);
  const encSolids: StepSolid[] = [{ name: 'enclosure body', color: COL.enclosure, geom: { type: 'tray', w: W, d: D, h: H, t: WALL } }];
  const flange: StepSolid = {
    name: 'front flange', color: COL.enclosure, at: [WALL, GASKET_T, WALL],
    geom: { type: 'plate', w: W - 2 * WALL, h: H - 2 * WALL, t: WALL, holes: [{ kind: 'rect', x0: FLANGE_W - WALL, z0: FLANGE_W - WALL, x1: W - WALL - FLANGE_W, z1: H - WALL - FLANGE_W }] },
  };
  if (W > 3 * FLANGE_W && H > 3 * FLANGE_W && D > GASKET_T + 3 * WALL && solidsOk([flange])) encSolids.push(flange);
  const bpZ0 = zOf(bp.y, bp.h);
  if (bp.w > 60 && bp.h > 60) {
    for (const [sx, sz] of [[12, 12], [bp.w - 12, 12], [12, bp.h - 12], [bp.w - 12, bp.h - 12]]) {
      encSolids.push(cylY('back panel stud', COL.zinc, bp.x + sx, bpZ0 + sz, [[8, yPanel + PANEL_T, D - WALL]]));
    }
  }
  const wallMount = /wall[- ]?mount/i.test(encPart?.description ?? '') || /wall/i.test(String(encPart?.ratings?.mounting ?? ''));
  if (wallMount && W >= 150) {
    for (const fx of [15, W - 55]) for (const top of [true, false]) {
      encSolids.push({
        name: 'mounting foot', color: COL.enclosure, at: [fx, D - 3, top ? H : -25],
        geom: { type: 'plate', w: 40, h: 25, t: 3, holes: [{ kind: 'rect', x0: 16, z0: top ? 7 : 6, x1: 24, z1: top ? 19 : 18 }] },
      });
    }
  }
  const shell: StepPart = { kind: 'part', name: encName, description: encPart?.description ?? 'Enclosure (estimated size)', solids: encSolids, at: [0, 0, 0] };
  record(shell, [0, 0, 0], { tag: encTag, partNumber: encPn, kind: 'enclosure', category: 'enclosure', assembly: 'cabinet', sizeEstimated: L.enclosure.estimated, depthEstimated }, COL.enclosure);

  // ---- Back panel assembly -----------------------------------------------------------------------
  const bpOrigin: V3 = [bp.x, yPanel, bpZ0];
  const bpKids: StepPart[] = [];
  const addBp = (p: Omit<StepPart, 'kind'>, meta: Omit<CabinetStepBody, 'name' | 'description' | 'min' | 'size' | 'assembly' | 'color' | 'solids'>, color: Rgb) => {
    const part: StepPart = { kind: 'part', ...p };
    bpKids.push(part);
    record(part, bpOrigin, { ...meta, assembly: 'backPanel' }, color);
    return part;
  };
  /** Layout rect -> back-panel-assembly local X/Z of the bottom-left corner. */
  const local = (x: number, y: number, h: number): [number, number] => [x - bp.x, bp.y + bp.h - y - h];

  const bpTag = bp.tag ?? `${encTag}-BP`;
  const bpPn = bp.partNumber ?? encPn;
  if (bp.w > W - 2 * WALL || bp.h > H - 2 * WALL) warnings.push(`Back panel ${Math.round(bp.w)} x ${Math.round(bp.h)} mm does not fit inside the enclosure walls.`);
  addBp({
    name: named(bpTag, bpPn), description: partOf(bp.partNumber ?? '')?.description ?? `Back panel for ${encPn || 'enclosure'}${bp.estimated ? ' (estimated size)' : ''}`,
    solids: [bx('back panel', COL.backPanel, 0, 0, 0, bp.w, PANEL_T, bp.h)], at: [0, 0, 0],
  }, { tag: bpTag, partNumber: bpPn, kind: 'backPanel', sizeEstimated: bp.estimated, depthEstimated: false }, COL.backPanel);

  const railComp = ctx.design.components.find((c) => partOf(c.partNumber)?.category === 'dinRail');
  const railDesc = partOf(railComp?.partNumber ?? '')?.description ?? '';
  const slotted = !/\b(solid|unslotted|un-slotted)\b/i.test(railDesc);
  L.rails.forEach((r, i) => {
    const [lx, lz] = local(r.x, r.y, r.h);
    const plain = [px('rail', COL.zinc, 0, r.w, HAT)];
    const withSlots = slotted ? [px('rail', COL.zinc, 0, r.w, HAT, railSlots(r.w))] : plain;
    addBp({
      name: named(`DIN RAIL ${i + 1}`, railComp?.partNumber ?? ''), description: railDesc || '35 mm DIN rail (TS35 x 7.5)',
      solids: solidsOk(withSlots) ? withSlots : plain, at: [lx, -RAIL_D, lz],
    }, { tag: `DIN RAIL ${i + 1}`, partNumber: railComp?.partNumber ?? '', kind: 'dinRail', category: 'dinRail', sizeEstimated: false, depthEstimated: false }, COL.zinc);
  });

  const ductComp = ctx.design.components.find((c) => partOf(c.partNumber)?.category === 'wireDuct');
  const ductPart = partOf(ductComp?.partNumber ?? '');
  const ductColor = /\bwhite\b/i.test(ductPart?.description ?? '') ? COL.backPanel : COL.duct;
  const dd = ductDepth(ductPart);
  // The 2D layout draws vertical ducts through the horizontal runs (T-junctions); in 3D split them
  // into segments between the horizontal ducts so no two bodies overlap.
  const hDucts = L.ducts.filter((r) => r.orientation === 'h');
  const runs = L.ducts.flatMap((r) => {
    if (r.orientation === 'h') return [r];
    let segs: { y0: number; y1: number }[] = [{ y0: r.y, y1: r.y + r.h }];
    for (const hd of hDucts) {
      if (hd.x >= r.x + r.w || hd.x + hd.w <= r.x) continue;
      segs = segs.flatMap((s) => (hd.y >= s.y1 || hd.y + hd.h <= s.y0 ? [s] : [{ y0: s.y0, y1: hd.y }, { y0: hd.y + hd.h, y1: s.y1 }]));
    }
    return segs.filter((s) => s.y1 - s.y0 > 1).map((s) => ({ ...r, y: s.y0, h: s.y1 - s.y0 }));
  });
  runs.forEach((r, i) => {
    if (r.w <= 0 || r.h <= 0) return;
    const [lx, lz] = local(r.x, r.y, r.h);
    let solids = ductShape(r.w, dd.d, r.h, r.orientation === 'h', ductColor);
    const simplified = !solidsOk(solids, [r.w, dd.d, r.h]);
    if (simplified) solids = [bx('wire duct', ductColor, 0, 0, 0, r.w, dd.d, r.h)];
    addBp({
      name: named(`WIRE DUCT ${i + 1}`, ductComp?.partNumber ?? ''), description: ductPart?.description ?? 'Slotted wire duct with cover',
      solids, at: [lx, -dd.d, lz],
    }, { tag: `WIRE DUCT ${i + 1}`, partNumber: ductComp?.partNumber ?? '', kind: 'wireDuct', category: 'wireDuct', sizeEstimated: !ductComp, depthEstimated: dd.estimated, simplified: simplified || undefined }, ductColor);
  });

  // Terminal strips: slices from the terminal plan (ground terminals green-yellow).
  const strips = new Map(terminalPlan(ctx).map((s) => [s.tag, s] as const));
  const totalTerminals = L.items.filter((i) => i.category === 'terminal').reduce((a, it) => a + (strips.get(it.tag)?.terminals.length ?? 0), 0);
  const stripPieces = (it: PlacedItem, p: CatalogPart | undefined): StripPiece[] | null => {
    const s = strips.get(it.tag);
    const n = s?.terminals.length ?? parseInt(/\((\d+)\)/.exec(it.label)?.[1] ?? '0', 10);
    if (!(n > 0)) return null;
    const plates = s?.endPlates ?? 0, stops = s?.endStops ?? 0;
    const tw = (it.w - plates * 1.5 - stops * 9) / n;
    if (!(tw >= 2 && tw <= 20)) return null;
    const base = componentColor('terminal', p);
    const kinds = s?.terminals.map((t) => t.kind) ?? Array.from({ length: n }, () => 'feed' as const);
    const left = Math.ceil(stops / 2);
    return [
      ...Array.from({ length: left }, () => ({ kind: 'endStop' as const, w: 9 })),
      ...kinds.map((k) => ({ kind: 'terminal' as const, w: tw, ground: k === 'ground', color: k === 'ground' ? COL.groundGreen : base })),
      ...Array.from({ length: plates }, () => ({ kind: 'endPlate' as const, w: 1.5, color: base })),
      ...Array.from({ length: stops - left }, () => ({ kind: 'endStop' as const, w: 9 })),
    ];
  };

  const placeItem = (it: PlacedItem) => {
    const p = partOf(it.partNumber);
    const cd = catalogDepth(p);
    const depth = cd ?? defaultDepth(it.category, p);
    const onRail = it.category !== 'groundBar';
    const back = onRail ? -RAIL_D : 0;
    const [lx, lz] = local(it.x, it.y, it.h);
    const tag = it.category === 'terminal' ? it.tag : it.label;
    let desc = p?.description ?? compByTag.get(it.tag)?.function ?? it.category;
    if (it.category === 'terminal') desc = `${it.label.replace(/^\S+\s*/, '').replace(/[()]/g, '')} terminals — ${desc}`;
    const color = componentColor(it.category, p);
    const input: ShapeInput = { w: it.w, d: depth, h: it.h, text: `${p?.description ?? ''} ${compByTag.get(it.tag)?.function ?? ''}`.toLowerCase(), ratings: p?.ratings ?? {} };
    let solids: StepSolid[] = [];
    try {
      const pieces = it.category === 'terminal' ? stripPieces(it, p) : null;
      if (it.category !== 'terminal' || pieces) solids = componentSolids(it.category, p, input, pieces ? { pieces, detail: totalTerminals <= DETAILED_TERMINALS_MAX } : undefined);
    } catch {
      solids = [];
    }
    const simplified = !solidsOk(solids, [it.w, depth, it.h]);
    if (simplified) solids = [bx('housing', color, 0, 0, 0, it.w, depth, it.h)];
    addBp({ name: named(tag, it.partNumber), description: desc, solids, at: [lx, back - depth, lz] },
      { tag, partNumber: it.partNumber, kind: 'component', category: it.category, sizeEstimated: it.estimated, depthEstimated: cd === undefined, simplified: simplified || undefined }, color);
    if (yPanel + back - depth < 0) warnings.push(`${tag} (${Math.round(depth)} mm deep) sticks out of the enclosure front — needs a deeper enclosure.`);
  };
  for (const it of L.items) for (const s of it.sub ?? [it]) placeItem(s);

  for (const n of L.notFit) notModelled.push({ tag: n.tag, partNumber: n.partNumber, reason: 'Does not fit on the back panel in the layout' });
  for (const u of L.unplaced) notModelled.push({ tag: u.tag, partNumber: u.partNumber, reason: u.reason });

  const children: StepAssembly['children'] = [shell];

  // ---- Door assembly -----------------------------------------------------------------------------
  if (opts.includeDoor !== false) {
    const doorKids: StepPart[] = [];
    const doorItems: DoorItem[] = L.door.items.map((d) => ({ ...d }));
    const hmiPn = opts.hmiPartNumber ?? (ctx as DrawingContext & { hmiPartNumber?: string | null }).hmiPartNumber ?? null;
    if (hmiPn && !doorItems.some((d) => d.kind === 'hmi')) {
      const m = getHmi(hmiPn);
      const bw = m?.bezelMm?.width ?? 200, bh = m?.bezelMm?.height ?? 150;
      const top = Math.min(90, H * 0.15);
      for (const d of doorItems) d.cy += bh + 40;
      doorItems.unshift({ tag: 'HMI1', partNumber: m?.partNumber ?? hmiPn, kind: 'hmi', cx: W / 2, cy: top + bh / 2, w: bw, h: bh, legend: [], color: '', estimated: !m?.bezelMm });
    }
    const holes: Extract<SolidGeom, { type: 'plate' }>['holes'] = [];
    const holeBoxes: { x0: number; z0: number; x1: number; z1: number; tag: string }[] = [];
    /** Adds the door cutout; false when the device is off the door (device then not modelled). */
    const addHole = (tag: string, pn: string, h: (typeof holes)[number]): boolean => {
      const b = h.kind === 'circle' ? { x0: h.cx - h.r, z0: h.cz - h.r, x1: h.cx + h.r, z1: h.cz + h.r } : h;
      if (!(b.x0 > 2 && b.z0 > 2 && b.x1 < W - 2 && b.z1 < H - 2)) {
        notModelled.push({ tag, partNumber: pn, reason: 'Off the door in the door layout (door overflow)' });
        return false;
      }
      const clash = holeBoxes.find((o) => b.x0 < o.x1 + 1 && o.x0 < b.x1 + 1 && b.z0 < o.z1 + 1 && o.z0 < b.z1 + 1);
      if (clash) warnings.push(`Door cutout for ${tag} overlaps ${clash.tag} — cutout left out of the 3D door.`);
      else { holes.push(h); holeBoxes.push({ ...b, tag }); }
      return true;
    };
    const pushDoor = (p: Omit<StepPart, 'kind'>, meta: Omit<CabinetStepBody, 'name' | 'description' | 'min' | 'size' | 'assembly' | 'color' | 'solids'>, color: Rgb) => {
      const part: StepPart = { kind: 'part', ...p };
      doorKids.push(part);
      record(part, [0, 0, 0], { ...meta, assembly: 'door' }, color);
    };
    /** Front-view footprints of the door devices (for placing the latches clear of them). */
    const doorFoot: { x0: number; z0: number; x1: number; z1: number }[] = [];

    for (const d of doorItems) {
      const cz = H - d.cy;
      const p = partOf(d.partNumber);
      const desc = p?.description ?? compByTag.get(d.tag)?.function ?? d.kind;
      if (d.kind === 'hmi') {
        const m = getHmi(d.partNumber);
        const bw = m?.bezelMm?.width ?? d.w, bh = m?.bezelMm?.height ?? d.h;
        const cw = m?.cutoutMm?.width ?? Math.max(20, bw - 16), ch = m?.cutoutMm?.height ?? Math.max(20, bh - 16);
        if (!addHole(d.tag, d.partNumber, { kind: 'rect', x0: d.cx - cw / 2, z0: cz - ch / 2, x1: d.cx + cw / 2, z1: cz + ch / 2 })) continue;
        let solids = hmiShape(bw, bh, cw, ch, 6, HMI_BODY_D, DOOR_T);
        if (!solidsOk(solids)) solids = [{ name: 'HMI', color: COL.charcoal, geom: { type: 'stack', profile: 'rect', sections: [{ w: bw, h: bh, y0: -6, y1: 0 }, { w: cw - 1, h: ch - 1, y0: 0, y1: DOOR_T + HMI_BODY_D }] } }];
        pushDoor({ name: named(d.tag, d.partNumber), description: m?.description ?? desc, solids, at: [d.cx, -DOOR_T, cz] },
          { tag: d.tag, partNumber: d.partNumber, kind: 'hmi', category: 'hmi', sizeEstimated: !m?.bezelMm, depthEstimated: true }, COL.charcoal);
        doorFoot.push({ x0: d.cx - bw / 2, z0: cz - bh / 2, x1: d.cx + bw / 2, z1: cz + bh / 2 });
        continue;
      }
      // 22 mm operator: bezel and operator in front, stem through the Ø22.5 hole, latch + contact block behind.
      if (!addHole(d.tag, d.partNumber, { kind: 'circle', cx: d.cx, cz, r: HOLE_22 })) continue;
      const estop = d.kind === 'estop';
      const col = LENS[d.color] ?? (estop ? LENS.RED : COL.charcoal);
      let solids = operatorShape(d.kind as OperatorKind, col, DOOR_T);
      if (!solidsOk(solids)) solids = [cylY('operator', col, 0, 0, [[30, -12, 0], [22, 0, DOOR_T], [30, DOOR_T, DOOR_T + 40]])];
      pushDoor({ name: named(d.tag, d.partNumber), description: desc, solids, at: [d.cx, -DOOR_T, cz] },
        { tag: d.tag, partNumber: d.partNumber, kind: 'doorDevice', category: p?.category, sizeEstimated: !p?.widthMm, depthEstimated: true }, col);
      const rr = estop ? 28 : 15;
      doorFoot.push({ x0: d.cx - rr, z0: cz - rr, x1: d.cx + rr, z1: cz + rr });
    }

    // Through-door disconnect handle, centred on the disconnect's shaft, and the shaft itself.
    if (L.door.handle) {
      const ds = L.items.find((i) => i.category === 'disconnect');
      if (ds) {
        const cx = ds.x + ds.w / 2, cz = H - (ds.y + ds.h / 2);
        const hp = partOf(L.door.handle.partNumber);
        const htag = L.door.handle.tag === ds.tag ? `${ds.tag} HANDLE` : L.door.handle.tag;
        const red = /red|yellow/i.test(hp?.description ?? '');
        if (addHole(htag, L.door.handle.partNumber, { kind: 'circle', cx, cz, r: HOLE_22 })) {
          pushDoor({
            name: named(htag, L.door.handle.partNumber), description: hp && hp.category !== 'disconnect' ? hp.description : hp?.description ?? 'Disconnect through-door operating handle',
            solids: handleShape(DOOR_T, red ? COL.redButton : COL.black), at: [cx, -DOOR_T, cz],
          }, { tag: htag, partNumber: L.door.handle.partNumber, kind: 'handle', category: hp?.category, sizeEstimated: true, depthEstimated: true }, red ? COL.redButton : COL.black);
          doorFoot.push({ x0: cx - 30, z0: cz - 30, x1: cx + 30, z1: cz + 30 });
          // Shaft from the switch front to just behind the handle coupling.
          const dsDepth = itemDepth(ds);
          const yFront = yPanel - RAIL_D - dsDepth; // cabinet Y of the switch front
          const y0 = DOOR_T + 14 + 2;
          const shaftComp = ctx.design.components.find((c) => partOf(c.partNumber)?.category === 'disconnect' && /\bshaft\b/i.test(partOf(c.partNumber)?.description ?? '') && !/\bswitch\b/i.test(partOf(c.partNumber)?.description ?? ''));
          const sp = partOf(shaftComp?.partNumber ?? '');
          const sqm = /\b(\d+(?:\.\d+)?)\s*x\s*\d+(?:\.\d+)?\s*mm\b/i.exec(sp?.description ?? '');
          const sq = sqm ? clampShaft(parseFloat(sqm[1])) : 6;
          if (yFront - y0 > 5) {
            const [lx, lz] = local(cx, ds.y + ds.h / 2, 0);
            addBp({
              name: named(shaftComp?.tag ?? `${ds.tag} SHAFT`, shaftComp?.partNumber ?? ''), description: sp?.description ?? 'Disconnect extension shaft (cut to length)',
              solids: [bx('shaft', COL.zinc, -sq / 2, 0, -sq / 2, sq / 2, yFront - y0, sq / 2)], at: [lx, y0 - yPanel, lz],
            }, { tag: shaftComp?.tag ?? `${ds.tag} SHAFT`, partNumber: shaftComp?.partNumber ?? '', kind: 'component', category: 'disconnect', sizeEstimated: !sp, depthEstimated: false }, COL.zinc);
          }
        }
      } else notModelled.push({ tag: L.door.handle.tag, partNumber: L.door.handle.partNumber, reason: 'No disconnect on the back panel to align the handle with' });
    }
    if (doorItems.some((d) => d.cy + d.h / 2 > H - 15)) warnings.push('Door devices run past the bottom of the door — check the door layout.');

    // Door: plate with cutouts, gasket, hinges on the left, quarter-turn latches on the right.
    const doorName = named(`${encTag}-DOOR`, encPn);
    const doorSolids: StepSolid[] = [{ name: 'door', color: COL.enclosure, at: [0, -DOOR_T, 0], geom: { type: 'plate', w: W, h: H, t: DOOR_T, holes } }];
    const gasket: StepSolid = {
      name: 'door gasket', color: COL.gasket, at: [3, 0, 3],
      geom: { type: 'plate', w: W - 6, h: H - 6, t: GASKET_T, holes: [{ kind: 'rect', x0: 8, z0: 8, x1: W - 14, z1: H - 14 }] },
    };
    if (W > 60 && H > 60 && solidsOk([gasket])) doorSolids.push(gasket);
    if (H > 150 && W > 100) {
      const hl = Math.min(80, Math.max(30, H * 0.1));
      const zs = H > 1000 ? [H * 0.1, (H - hl) / 2, H * 0.9 - hl] : [H * 0.1, H * 0.9 - hl];
      for (const z0 of zs) {
        doorSolids.push(cylZ('hinge knuckle', COL.charcoal, 4, -DOOR_T - 4, z0, z0 + hl, 8));
        doorSolids.push(bx('hinge leaf', COL.charcoal, 8.6, -DOOR_T - 2, z0 + 4, 30, -DOOR_T, z0 + hl - 4));
      }
      const lx = W - 22;
      const free = (z: number) => doorFoot.every((f) => lx + 13 < f.x0 || lx - 13 > f.x1 || z + 13 < f.z0 || z - 13 > f.z1);
      const want = H > 1000 ? 2 : 1;
      const latchZ: number[] = [];
      for (const f of [0.5, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]) {
        const z = H * f;
        if (latchZ.length < want && free(z) && latchZ.every((q) => Math.abs(q - z) > 60)) latchZ.push(z);
      }
      for (const z of latchZ) {
        doorSolids.push(cylY('quarter-turn latch', COL.charcoal, lx, z, [[14, -DOOR_T - 8, -DOOR_T - 4], [24, -DOOR_T - 4, -DOOR_T]]));
        doorSolids.push(bx('latch slot bar', COL.black, lx - 5, -DOOR_T - 9, z - 1.5, lx + 5, -DOOR_T - 8, z + 1.5));
      }
    }
    const door: StepPart = {
      kind: 'part', name: doorName, description: `Door${encPart ? ` of ${encPart.description}` : ''} — ${holes.length} cutout(s)`, solids: doorSolids, at: [0, 0, 0],
    };
    const doorBody = { tag: `${encTag}-DOOR`, partNumber: encPn, kind: 'door' as const, category: 'enclosure' as const, assembly: 'door' as const, sizeEstimated: L.enclosure.estimated, depthEstimated: false };
    record(door, [0, 0, 0], doorBody, COL.enclosure);
    bodies.splice(1, 0, bodies.pop()!);
    children.push({ kind: 'assembly', name: uniqueName(`${encTag} door assembly`), description: 'Door with operator devices (closed; hinge line on the left edge along Z)', at: [0, 0, 0], children: [door, ...doorKids] });
  }

  children.push({ kind: 'assembly', name: uniqueName(`${encTag} back panel assembly`), description: 'Back panel with DIN rails, wire ducts and components', at: bpOrigin, children: bpKids });

  // ---- Clash check (envelopes) ----------------------------------------------------------------------
  const solidish = bodies.filter((b) => b.kind !== 'enclosure');
  for (let i = 0; i < solidish.length; i++) {
    for (let j = i + 1; j < solidish.length; j++) {
      const a = solidish[i], b = solidish[j];
      // Door devices pass through their door cutouts.
      if ((a.kind === 'door' && b.assembly === 'door') || (b.kind === 'door' && a.assembly === 'door')) continue;
      const ov = [0, 1, 2].every((k) => a.min[k] < b.min[k] + b.size[k] - 0.05 && b.min[k] < a.min[k] + a.size[k] - 0.05);
      if (ov) warnings.push(`3D clash: ${a.name} overlaps ${b.name}.`);
    }
  }
  if (L.overflow) warnings.push('The 2D layout overflows the back panel; parts that do not fit are not in the 3D model.');

  const root: StepAssembly = {
    kind: 'assembly', name: `${ctx.projectName || 'Project'} cabinet`,
    description: `Control cabinet ${encTag} ${encPn}`.trim(), at: [0, 0, 0], children,
  };
  const summary: CabinetStepSummary = {
    frame: 'mm; origin at the front-bottom-left enclosure corner; +X right, +Y into the cabinet (door at Y<0), +Z up',
    enclosure: { w: r1(W), h: r1(H), d: r1(D), sizeEstimated: L.enclosure.estimated, depthEstimated, partNumber: encPn || undefined },
    bodies,
    estimatedCount: bodies.filter((b) => b.sizeEstimated || b.depthEstimated).length,
    notModelled,
    warnings,
  };
  return { root, summary };
}

/** STEP AP214 (ISO 10303-21) assembly of the cabinet with all components, in millimetres. */
export function cabinetStep(ctx: DrawingContext, opts?: CabinetStepOptions): string {
  const { root } = build(ctx, opts);
  return writeStepAssembly(root, {
    fileName: `${ctx.projectName || 'project'} cabinet.stp`,
    description: `${ctx.projectName || 'Project'} control cabinet 3D model (parametric component shapes, mm)`,
    timeStamp: ctx.design.generatedAt || '2000-01-01T00:00:00',
    author: '',
    organization: '',
    system: 'PLC Autoprogrammer cabinet STEP export',
  });
}

/** What the STEP export contains: every body with its size and whether size/depth are estimated. */
export function cabinetStepSummary(ctx: DrawingContext, opts?: CabinetStepOptions): CabinetStepSummary {
  return build(ctx, opts).summary;
}
