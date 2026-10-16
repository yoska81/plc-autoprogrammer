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
 *     ├─ enclosure shell (5 walls, open front)
 *     ├─ "<ENC> door assembly"  (origin on the hinge line: rotate about its Z axis to open)
 *     │    ├─ door plate with cutouts, door operators, HMI, disconnect handle
 *     └─ "<ENC> back panel assembly" (origin = front face of the back panel, bottom-left corner)
 *          ├─ back panel, DIN rails, wire ducts, every back-panel component
 *
 * Components are envelope boxes (width/height from the layout, depth from the catalog or a
 * per-category default); door operators are coaxial cylinders, the HMI a bezel + body.
 */
import { panelLayout, type DoorItem, type DrawingContext, type PlacedItem } from '../derive';
import type { CatalogCategory, CatalogPart } from '../types';
import { getHmi } from '../../hmi/hmiCatalog';
import { writeStepAssembly, type Rgb, type SolidGeom, type StepAssembly, type StepPart, type V3 } from './stepWriter';

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
  /** Display colour, #rrggbb. */
  color: string;
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

/** Realistic default depths (mm, from the mounting surface) when the catalog has none. */
const DEFAULT_DEPTH: Partial<Record<CatalogCategory, number>> = {
  breaker: 75, fuse: 75, disconnect: 80, motorProtector: 80, contactor: 80, overload: 80, vfd: 140,
  powerSupply: 115, plc: 70, plcModule: 70, relay: 65, safetyRelay: 115, terminal: 45, groundBar: 20, other: 80,
};

const COLORS = {
  enclosure: [0.84, 0.85, 0.83] as Rgb,     // RAL 7035 light grey
  backPanel: [0.94, 0.94, 0.92] as Rgb,     // white subpanel
  rail: [0.76, 0.77, 0.79] as Rgb,          // zinc plated
  duct: [0.58, 0.59, 0.61] as Rgb,
  component: [0.26, 0.27, 0.29] as Rgb,
  plc: [0.82, 0.82, 0.80] as Rgb,
  safety: [0.95, 0.78, 0.08] as Rgb,
  terminal: [0.55, 0.56, 0.58] as Rgb,
  ground: [0.72, 0.45, 0.20] as Rgb,
  hmi: [0.16, 0.17, 0.19] as Rgb,
  operator: [0.18, 0.18, 0.20] as Rgb,
  handle: [0.12, 0.12, 0.13] as Rgb,
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

function componentColor(cat: CatalogCategory): Rgb {
  if (cat === 'plc' || cat === 'plcModule') return COLORS.plc;
  if (cat === 'safetyRelay') return COLORS.safety;
  if (cat === 'terminal') return COLORS.terminal;
  if (cat === 'groundBar') return COLORS.ground;
  return COLORS.component;
}

function defaultDepth(cat: CatalogCategory, p: CatalogPart | undefined): number {
  if (/transformer/i.test(p?.description ?? '')) return 100;
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
  const push = (b: Omit<CabinetStepBody, 'color'>, color: Rgb) => bodies.push({ ...b, color: hex(color), min: b.min.map(r1) as [number, number, number], size: b.size.map(r1) as [number, number, number] });

  // ---- Enclosure shell ---------------------------------------------------------------------------
  const encName = named(encTag, encPn);
  const shell: StepPart = {
    kind: 'part', name: encName, description: encPart?.description ?? 'Enclosure (estimated size)', color: COLORS.enclosure,
    geom: { type: 'tray', w: W, d: D, h: H, t: WALL }, at: [0, 0, 0],
  };
  push({ name: encName, tag: encTag, partNumber: encPn, description: shell.description, kind: 'enclosure', category: 'enclosure', assembly: 'cabinet', min: [0, 0, 0], size: [W, D, H], sizeEstimated: L.enclosure.estimated, depthEstimated }, COLORS.enclosure);

  // ---- Back panel assembly -----------------------------------------------------------------------
  const bpOrigin: V3 = [bp.x, yPanel, zOf(bp.y, bp.h)];
  const bpKids: StepPart[] = [];
  const addBp = (p: Omit<StepPart, 'kind'>, meta: Omit<CabinetStepBody, 'name' | 'description' | 'min' | 'size' | 'assembly' | 'color'>, size: V3) => {
    bpKids.push({ kind: 'part', ...p });
    push({ ...meta, name: p.name, description: p.description, assembly: 'backPanel', min: [bpOrigin[0] + p.at[0], bpOrigin[1] + p.at[1], bpOrigin[2] + p.at[2]], size: [...size] }, p.color);
  };
  /** Layout rect -> back-panel-assembly local X/Z of the bottom-left corner. */
  const local = (x: number, y: number, h: number): [number, number] => [x - bp.x, bp.y + bp.h - y - h];

  const bpTag = bp.tag ?? `${encTag}-BP`;
  const bpPn = bp.partNumber ?? encPn;
  if (bp.w > W - 2 * WALL || bp.h > H - 2 * WALL) warnings.push(`Back panel ${Math.round(bp.w)} x ${Math.round(bp.h)} mm does not fit inside the enclosure walls.`);
  addBp({
    name: named(bpTag, bpPn), description: partOf(bp.partNumber ?? '')?.description ?? `Back panel for ${encPn || 'enclosure'}${bp.estimated ? ' (estimated size)' : ''}`,
    color: COLORS.backPanel, geom: { type: 'box', w: bp.w, d: PANEL_T, h: bp.h }, at: [0, 0, 0],
  }, { tag: bpTag, partNumber: bpPn, kind: 'backPanel', sizeEstimated: bp.estimated, depthEstimated: false }, [bp.w, PANEL_T, bp.h]);

  const railComp = ctx.design.components.find((c) => partOf(c.partNumber)?.category === 'dinRail');
  L.rails.forEach((r, i) => {
    const [lx, lz] = local(r.x, r.y, r.h);
    addBp({
      name: named(`DIN RAIL ${i + 1}`, railComp?.partNumber ?? ''), description: partOf(railComp?.partNumber ?? '')?.description ?? '35 mm DIN rail (TS35 x 7.5)',
      color: COLORS.rail, geom: { type: 'extrudeX', length: r.w, poly: HAT }, at: [lx, -RAIL_D, lz],
    }, { tag: `DIN RAIL ${i + 1}`, partNumber: railComp?.partNumber ?? '', kind: 'dinRail', category: 'dinRail', sizeEstimated: false, depthEstimated: false }, [r.w, RAIL_D, 35]);
  });

  const ductComp = ctx.design.components.find((c) => partOf(c.partNumber)?.category === 'wireDuct');
  const dd = ductDepth(partOf(ductComp?.partNumber ?? ''));
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
    addBp({
      name: named(`WIRE DUCT ${i + 1}`, ductComp?.partNumber ?? ''), description: partOf(ductComp?.partNumber ?? '')?.description ?? 'Slotted wire duct with cover',
      color: COLORS.duct, geom: { type: 'box', w: r.w, d: dd.d, h: r.h }, at: [lx, -dd.d, lz],
    }, { tag: `WIRE DUCT ${i + 1}`, partNumber: ductComp?.partNumber ?? '', kind: 'wireDuct', category: 'wireDuct', sizeEstimated: !ductComp, depthEstimated: dd.estimated }, [r.w, dd.d, r.h]);
  });

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
    addBp({
      name: named(tag, it.partNumber), description: desc, color: componentColor(it.category),
      geom: { type: 'box', w: it.w, d: depth, h: it.h }, at: [lx, back - depth, lz],
    }, { tag, partNumber: it.partNumber, kind: 'component', category: it.category, sizeEstimated: it.estimated, depthEstimated: cd === undefined }, [it.w, depth, it.h]);
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
    const pushDoor = (p: Omit<StepPart, 'kind'>, meta: Omit<CabinetStepBody, 'name' | 'description' | 'min' | 'size' | 'assembly' | 'color'>, min: V3, size: V3) => {
      doorKids.push({ kind: 'part', ...p });
      push({ ...meta, name: p.name, description: p.description, assembly: 'door', min: [...min], size: [...size] }, p.color);
    };

    for (const d of doorItems) {
      const cz = H - d.cy;
      const p = partOf(d.partNumber);
      const desc = p?.description ?? compByTag.get(d.tag)?.function ?? d.kind;
      if (d.kind === 'hmi') {
        const m = getHmi(d.partNumber);
        const bw = m?.bezelMm?.width ?? d.w, bh = m?.bezelMm?.height ?? d.h;
        const cw = m?.cutoutMm?.width ?? Math.max(20, bw - 16), ch = m?.cutoutMm?.height ?? Math.max(20, bh - 16);
        const front = 6;
        if (!addHole(d.tag, d.partNumber, { kind: 'rect', x0: d.cx - cw / 2, z0: cz - ch / 2, x1: d.cx + cw / 2, z1: cz + ch / 2 })) continue;
        pushDoor({
          name: named(d.tag, d.partNumber), description: m?.description ?? desc, color: COLORS.hmi,
          geom: { type: 'stack', profile: 'rect', sections: [{ w: bw, h: bh, y0: -front, y1: 0 }, { w: cw - 1, h: ch - 1, y0: 0, y1: DOOR_T + HMI_BODY_D }] },
          at: [d.cx, -DOOR_T, cz],
        }, { tag: d.tag, partNumber: d.partNumber, kind: 'hmi', category: 'hmi', sizeEstimated: !m?.bezelMm, depthEstimated: true },
        [d.cx - bw / 2, -DOOR_T - front, cz - bh / 2], [bw, front + DOOR_T + HMI_BODY_D, bh]);
        continue;
      }
      // 22 mm operator: front bezel / mushroom, stem through the Ø22.5 hole, contact-block body behind.
      const estop = d.kind === 'estop';
      const sections = estop
        ? [{ w: 40, h: 0, y0: -32, y1: -20 }, { w: 30, h: 0, y0: -20, y1: 0 }, { w: 22, h: 0, y0: 0, y1: DOOR_T }, { w: 30, h: 0, y0: DOOR_T, y1: DOOR_T + 45 }]
        : [{ w: Math.max(22.6, Math.min(d.w, 40)), h: 0, y0: -12, y1: 0 }, { w: 22, h: 0, y0: 0, y1: DOOR_T }, { w: 30, h: 0, y0: DOOR_T, y1: DOOR_T + 40 }];
      if (!addHole(d.tag, d.partNumber, { kind: 'circle', cx: d.cx, cz, r: HOLE_22 })) continue;
      const col = LENS[d.color] ?? (estop ? LENS.RED : COLORS.operator);
      const maxD = Math.max(...sections.map((s) => s.w));
      const y0 = sections[0].y0, y1 = sections[sections.length - 1].y1;
      pushDoor({
        name: named(d.tag, d.partNumber), description: desc, color: col,
        geom: { type: 'stack', profile: 'circle', sections }, at: [d.cx, -DOOR_T, cz],
      }, { tag: d.tag, partNumber: d.partNumber, kind: 'doorDevice', category: p?.category, sizeEstimated: !p?.widthMm, depthEstimated: true },
      [d.cx - maxD / 2, -DOOR_T + y0, cz - maxD / 2], [maxD, y1 - y0, maxD]);
    }

    // Through-door disconnect handle, centred on the disconnect's shaft.
    if (L.door.handle) {
      const ds = L.items.find((i) => i.category === 'disconnect');
      if (ds) {
        const hw = 60, hd = 30, cx = ds.x + ds.w / 2, cz = H - (ds.y + ds.h / 2);
        const hp = partOf(L.door.handle.partNumber);
        const htag = L.door.handle.tag === ds.tag ? `${ds.tag} HANDLE` : L.door.handle.tag;
        pushDoor({
          name: named(htag, L.door.handle.partNumber), description: hp && hp.category !== 'disconnect' ? hp.description : 'Disconnect through-door operating handle',
          color: COLORS.handle, geom: { type: 'box', w: hw, d: hd, h: hw }, at: [cx - hw / 2, -DOOR_T - hd, cz - hw / 2],
        }, { tag: htag, partNumber: L.door.handle.partNumber, kind: 'handle', category: hp?.category, sizeEstimated: true, depthEstimated: true },
        [cx - hw / 2, -DOOR_T - hd, cz - hw / 2], [hw, hd, hw]);
      } else notModelled.push({ tag: L.door.handle.tag, partNumber: L.door.handle.partNumber, reason: 'No disconnect on the back panel to align the handle with' });
    }
    if (doorItems.some((d) => d.cy + d.h / 2 > H - 15)) warnings.push('Door devices run past the bottom of the door — check the door layout.');

    const doorName = named(`${encTag}-DOOR`, encPn);
    const door: StepPart = {
      kind: 'part', name: doorName, description: `Door${encPart ? ` of ${encPart.description}` : ''} — ${holes.length} cutout(s)`, color: COLORS.enclosure,
      geom: { type: 'plate', w: W, h: H, t: DOOR_T, holes }, at: [0, -DOOR_T, 0],
    };
    bodies.splice(1, 0, { name: doorName, tag: `${encTag}-DOOR`, partNumber: encPn, description: door.description, kind: 'door', category: 'enclosure', assembly: 'door', min: [0, -DOOR_T, 0], size: [r1(W), DOOR_T, r1(H)], sizeEstimated: L.enclosure.estimated, depthEstimated: false, color: hex(COLORS.enclosure) });
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
    description: `${ctx.projectName || 'Project'} control cabinet 3D model (envelope geometry, mm)`,
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
