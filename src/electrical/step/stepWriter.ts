/**
 * Minimal, dependency-free ISO 10303-21 (STEP) writer for AP214 (AUTOMOTIVE_DESIGN)
 * assemblies of B-rep solids in millimetres.
 *
 * Geometry is written as MANIFOLD_SOLID_BREP / CLOSED_SHELL / ADVANCED_FACE on PLANE and
 * CYLINDRICAL_SURFACE with LINE / CIRCLE edges, the subset every CAD importer reads.
 * Assemblies use the standard AP214 pattern: PRODUCT -> PRODUCT_DEFINITION, children linked by
 * NEXT_ASSEMBLY_USAGE_OCCURRENCE and placed by CONTEXT_DEPENDENT_SHAPE_REPRESENTATION +
 * ITEM_DEFINED_TRANSFORMATION (translation only). A part may hold several solids (a multi-body
 * part in SolidWorks / Inventor / Fusion); every solid has its own colour (STYLED_ITEM /
 * COLOUR_RGB in a MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION).
 *
 * Solids are simple primitives (box, tray, plate with through-holes, extruded polygon, coaxial
 * stack, tube) with optional blind pockets (round or rectangular) sunk into their planar faces,
 * placed inside the part by a translation and an axis-permutation rotation.
 *
 * Output is deterministic: entities are numbered in creation order and no clock is read.
 */

export type V3 = readonly [number, number, number];
export type Rgb = readonly [number, number, number];
/** Rotation as the images of the local X, Y and Z axes (orthonormal, right-handed). */
export type Mat3 = readonly [V3, V3, V3];

// ---------------------------------------------------------------------------
// Solid geometry specifications (all in the solid's local frame, mm)
// ---------------------------------------------------------------------------

/** Blind pocket outline: circle centred at (a, b) or rectangle (a0, b0)-(a1, b1), in face coordinates. */
export type PocketShape = { kind: 'circle'; a: number; b: number; r: number } | { kind: 'rect'; a0: number; b0: number; a1: number; b1: number };
export type BoxFace = '-x' | '+x' | '-y' | '+y' | '-z' | '+z';
/**
 * Pocket sunk into a box face. Face coordinates (a, b) are the two remaining local axes in X, Y, Z
 * order: ±x faces use (y, z), ±y faces (x, z), ±z faces (x, y).
 */
export type BoxPocket = PocketShape & { face: BoxFace; depth: number };
/**
 * Pocket sunk into a side face of an extrusion: `edge` is the polygon edge index (edge i runs from
 * poly[i] to poly[i+1]); face coordinates are a = x (along the extrusion), b = distance along the edge.
 */
export type EdgePocket = PocketShape & { edge: number; depth: number };

/** Axis-aligned box from the origin to (w, d, h) along X, Y, Z. */
export interface BoxGeom { type: 'box'; w: number; d: number; h: number; pockets?: BoxPocket[] }
/** Open-front box shell: outer (0..w, 0..d, 0..h), walls of thickness t, open face at y = 0. */
export interface TrayGeom { type: 'tray'; w: number; d: number; h: number; t: number }
/** Plate (0..w, 0..t, 0..h) in the XZ plane with through-holes along Y. */
export interface PlateGeom {
  type: 'plate'; w: number; h: number; t: number;
  holes: ({ kind: 'circle'; cx: number; cz: number; r: number } | { kind: 'rect'; x0: number; z0: number; x1: number; z1: number })[];
}
/** Polygon in the local (y, z) plane extruded along X from 0 to length. */
export interface ExtrudeXGeom { type: 'extrudeX'; length: number; poly: [number, number][]; pockets?: EdgePocket[] }
/** Coaxial stack along +Y centred on the Y axis; adjacent sections must differ in size. */
export interface StackGeom {
  type: 'stack';
  profile: 'circle' | 'rect';
  /** circle: w = diameter (h ignored); rect: w along X, h along Z. Sections must be contiguous in y. */
  sections: { w: number; h: number; y0: number; y1: number }[];
}
/** Round tube (ring) along +Y centred on the Y axis, from y0 to y1. */
export interface TubeGeom { type: 'tube'; ro: number; ri: number; y0: number; y1: number }
export type SolidGeom = BoxGeom | TrayGeom | PlateGeom | ExtrudeXGeom | StackGeom | TubeGeom;

/** One solid body of a part, placed in the part frame by `rot` (about the solid origin) then `at`. */
export interface StepSolid {
  name: string;
  color: Rgb;
  geom: SolidGeom;
  at?: V3;
  rot?: Mat3;
}

// ---------------------------------------------------------------------------
// Assembly tree
// ---------------------------------------------------------------------------

export interface StepPart {
  kind: 'part';
  name: string;
  description: string;
  /** One or more solids (a multi-body part). */
  solids: StepSolid[];
  /** Translation of the part origin in the parent frame. */
  at: V3;
}
export interface StepAssembly {
  kind: 'assembly';
  name: string;
  description: string;
  at: V3;
  children: StepNode[];
}
/**
 * Another placement of a part or sub-assembly that may be placed several times (written once as a
 * product, then referenced by one NEXT_ASSEMBLY_USAGE_OCCURRENCE per instance, e.g. the identical
 * terminal blocks of a strip). `name` is the instance (occurrence) name.
 */
export interface StepInstance {
  kind: 'instance';
  name: string;
  of: StepPart | StepAssembly;
  at: V3;
}
export type StepNode = StepPart | StepAssembly | StepInstance;

export interface StepHeader {
  fileName: string;
  description: string;
  timeStamp: string;
  author: string;
  organization: string;
  system: string;
}

// ---------------------------------------------------------------------------
// Part 21 encoding helpers
// ---------------------------------------------------------------------------

/** Encode a string as a Part 21 string literal (with quotes); non-ASCII via \X2\ hex. */
export function p21String(s: string): string {
  let out = '';
  let wide = '';
  const flush = () => { if (wide) { out += `\\X2\\${wide}\\X0\\`; wide = ''; } };
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 32 && cp <= 126) {
      flush();
      out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch;
    } else if (cp > 0xffff) {
      flush();
      out += `\\X4\\${cp.toString(16).toUpperCase().padStart(8, '0')}\\X0\\`;
    } else if (cp < 32) {
      flush();
      out += ' ';
    } else {
      wide += cp.toString(16).toUpperCase().padStart(4, '0');
    }
  }
  flush();
  return `'${out}'`;
}

/** Part 21 REAL: always with a decimal point, never exponent for the magnitudes used here. */
export function p21Real(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`STEP: non-finite number ${n}`);
  const v = Math.round(n * 1e6) / 1e6;
  if (v === 0) return '0.';
  let s = String(v);
  if (/e/i.test(s)) s = v.toFixed(6).replace(/0+$/, '');
  return s.includes('.') ? s : `${s}.`;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.sqrt(dot(a, a));
const unit = (a: V3): V3 => mul(a, 1 / len(a));
const perp = (n: V3): V3 => unit(cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));

export const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** Rotation whose local +Y axis points along global +Z (local X stays X): stacks/tubes standing upright. */
export const ROT_Y_TO_Z: Mat3 = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
/** Rotation whose local +Y axis points along global +X: stacks/tubes lying along X. */
export const ROT_Y_TO_X: Mat3 = [[0, 1, 0], [1, 0, 0], [0, 0, -1]];
/** Rotation for extrusions along global Z: local (X, Y, Z) -> global (Z, X, Y); the polygon is in global (x, y). */
export const ROT_EXTRUDE_Z: Mat3 = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];

/** Applies rotation then translation to a point. */
export function xfPoint(p: V3, rot: Mat3 = IDENTITY, at: V3 = [0, 0, 0]): V3 {
  return [
    at[0] + rot[0][0] * p[0] + rot[1][0] * p[1] + rot[2][0] * p[2],
    at[1] + rot[0][1] * p[0] + rot[1][1] * p[1] + rot[2][1] * p[2],
    at[2] + rot[0][2] * p[0] + rot[1][2] * p[1] + rot[2][2] * p[2],
  ];
}

// ---------------------------------------------------------------------------
// Bounds and validation (used by callers to keep every body inside its envelope)
// ---------------------------------------------------------------------------

export interface Bounds { min: [number, number, number]; max: [number, number, number] }

function localBounds(g: SolidGeom): Bounds {
  switch (g.type) {
    case 'box': case 'tray': return { min: [0, 0, 0], max: [g.w, g.d, g.h] };
    case 'plate': return { min: [0, 0, 0], max: [g.w, g.t, g.h] };
    case 'extrudeX': {
      const ys = g.poly.map((p) => p[0]), zs = g.poly.map((p) => p[1]);
      return { min: [0, Math.min(...ys), Math.min(...zs)], max: [g.length, Math.max(...ys), Math.max(...zs)] };
    }
    case 'stack': {
      const rw = Math.max(...g.sections.map((s) => s.w)) / 2;
      const rh = g.profile === 'circle' ? rw : Math.max(...g.sections.map((s) => s.h)) / 2;
      return { min: [-rw, g.sections[0].y0, -rh], max: [rw, g.sections[g.sections.length - 1].y1, rh] };
    }
    case 'tube': return { min: [-g.ro, g.y0, -g.ro], max: [g.ro, g.y1, g.ro] };
  }
}

/** Axis-aligned bounds of a solid in its part frame. */
export function solidBounds(s: StepSolid): Bounds {
  const b = localBounds(s.geom);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const p = xfPoint([i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]], s.rot, s.at);
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
  }
  return { min, max };
}

/** Union of solid bounds. */
export function unionBounds(list: Bounds[]): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of list) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); }
  return { min, max };
}

const EPS = 0.15; // minimum wall left around pockets and holes (mm)

interface Frame { o: V3; u: V3; v: V3; n: V3 }

/** Face frames of a box: origin, in-face axes u (a) and v (b), outward normal, and the face extents. */
function boxFace(g: BoxGeom, f: BoxFace): Frame & { ua: number; vb: number; thick: number } {
  const { w, d, h } = g;
  switch (f) {
    case '-x': return { o: [0, 0, 0], u: [0, 1, 0], v: [0, 0, 1], n: [-1, 0, 0], ua: d, vb: h, thick: w };
    case '+x': return { o: [w, 0, 0], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], ua: d, vb: h, thick: w };
    case '-y': return { o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], ua: w, vb: h, thick: d };
    case '+y': return { o: [0, d, 0], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], ua: w, vb: h, thick: d };
    case '-z': return { o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, -1], ua: w, vb: d, thick: h };
    case '+z': return { o: [0, 0, h], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], ua: w, vb: d, thick: h };
  }
}

/** Side-face frame of an extrusion edge. */
function edgeFrame(g: ExtrudeXGeom, i: number, sign: number): Frame & { length: number } {
  const [y, z] = g.poly[i], [y2, z2] = g.poly[(i + 1) % g.poly.length];
  const e: V3 = [0, y2 - y, z2 - z];
  const L = len(e);
  return { o: [0, y, z], u: [1, 0, 0], v: mul(e, 1 / L), n: unit([0, sign * (z2 - z), -sign * (y2 - y)]), length: L };
}

const polyArea2 = (poly: [number, number][]) => poly.reduce((a, [y, z], i) => { const [y2, z2] = poly[(i + 1) % poly.length]; return a + y * z2 - y2 * z; }, 0);

/** Point strictly inside a polygon (even-odd rule). */
function inPoly(poly: [number, number][], y: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, zi] = poly[i], [yj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && y < ((yj - yi) * (z - zi)) / (zj - zi) + yi) inside = !inside;
  }
  return inside;
}

const shapeExtent = (p: PocketShape): [number, number, number, number] => (p.kind === 'circle' ? [p.a - p.r, p.b - p.r, p.a + p.r, p.b + p.r] : [Math.min(p.a0, p.a1), Math.min(p.b0, p.b1), Math.max(p.a0, p.a1), Math.max(p.b0, p.b1)]);

/** World-space (solid-local) AABB of a pocket volume. */
function pocketBox(fr: Frame, p: PocketShape, depth: number): Bounds {
  const [a0, b0, a1, b1] = shapeExtent(p);
  const pts: V3[] = [];
  for (const a of [a0, a1]) for (const b of [b0, b1]) for (const t of [0, depth]) pts.push(add(add(add(fr.o, mul(fr.u, a)), mul(fr.v, b)), mul(fr.n, -t)));
  return unionBounds(pts.map((p3) => ({ min: [...p3] as [number, number, number], max: [...p3] as [number, number, number] })));
}

const boxesOverlap = (a: Bounds, b: Bounds, m: number) => [0, 1, 2].every((k) => a.min[k] < b.max[k] + m && b.min[k] < a.max[k] + m);

/**
 * Checks that a solid can be written as a valid B-rep: positive sizes, pockets inside their faces
 * and inside the material, pockets not touching each other. Returns an error text or null.
 */
export function validateSolid(s: StepSolid): string | null {
  const g = s.geom;
  const pos = (...v: number[]) => v.every((x) => Number.isFinite(x) && x > 0.05);
  if (s.rot) {
    const [x, y, z] = s.rot;
    if (Math.abs(dot(cross(x, y), z) - 1) > 1e-9 || [x, y, z].some((a) => Math.abs(len(a) - 1) > 1e-9)) return 'rotation is not a proper rotation';
  }
  const checkPocketSet = (items: { fr: Frame; p: PocketShape; depth: number }[]): string | null => {
    const vols = items.map((it) => pocketBox(it.fr, it.p, it.depth));
    for (let i = 0; i < vols.length; i++) for (let j = i + 1; j < vols.length; j++) if (boxesOverlap(vols[i], vols[j], EPS)) return 'pockets overlap';
    return null;
  };
  const shapeOk = (p: PocketShape) => (p.kind === 'circle' ? pos(p.r) : pos(Math.abs(p.a1 - p.a0), Math.abs(p.b1 - p.b0)));
  switch (g.type) {
    case 'box': {
      if (!pos(g.w, g.d, g.h)) return 'box size';
      const items = (g.pockets ?? []).map((p) => {
        const fr = boxFace(g, p.face);
        const [a0, b0, a1, b1] = shapeExtent(p);
        if (!shapeOk(p) || !pos(p.depth) || a0 < EPS || b0 < EPS || a1 > fr.ua - EPS || b1 > fr.vb - EPS || p.depth > fr.thick - EPS) return null;
        return { fr, p, depth: p.depth };
      });
      if (items.some((x) => !x)) return 'box pocket outside its face';
      return checkPocketSet(items as { fr: Frame; p: PocketShape; depth: number }[]);
    }
    case 'tray': return pos(g.w, g.d, g.h, g.t) && 2 * g.t < Math.min(g.w, g.h) && g.t < g.d ? null : 'tray size';
    case 'plate': {
      if (!pos(g.w, g.h, g.t)) return 'plate size';
      const ext = g.holes.map((o) => (o.kind === 'circle' ? [o.cx - o.r, o.cz - o.r, o.cx + o.r, o.cz + o.r] : [o.x0, o.z0, o.x1, o.z1]));
      if (ext.some(([x0, z0, x1, z1]) => !(x0 > EPS && z0 > EPS && x1 < g.w - EPS && z1 < g.h - EPS && x1 - x0 > 0.05 && z1 - z0 > 0.05))) return 'plate hole outside the plate';
      for (let i = 0; i < ext.length; i++) for (let j = i + 1; j < ext.length; j++) {
        const a = ext[i], b = ext[j];
        if (a[0] < b[2] + EPS && b[0] < a[2] + EPS && a[1] < b[3] + EPS && b[1] < a[3] + EPS) return 'plate holes overlap';
      }
      return null;
    }
    case 'extrudeX': {
      const P = g.poly;
      if (!pos(g.length) || P.length < 3 || Math.abs(polyArea2(P)) < 0.01) return 'extrusion size';
      for (let i = 0; i < P.length; i++) {
        const [y, z] = P[i], [y2, z2] = P[(i + 1) % P.length];
        if (Math.hypot(y2 - y, z2 - z) < 0.05) return 'extrusion has a degenerate edge';
      }
      const sign = polyArea2(P) > 0 ? 1 : -1;
      const items: { fr: Frame; p: PocketShape; depth: number }[] = [];
      for (const p of g.pockets ?? []) {
        if (!(p.edge >= 0 && p.edge < P.length) || !shapeOk(p) || !pos(p.depth)) return 'extrusion pocket';
        const fr = edgeFrame(g, p.edge, sign);
        const [a0, b0, a1, b1] = shapeExtent(p);
        if (a0 < EPS || a1 > g.length - EPS || b0 < EPS || b1 > fr.length - EPS) return 'extrusion pocket outside its face';
        // The pocket's cross-section quad (in y, z) must lie inside the profile material.
        const at = (b: number, t: number): [number, number] => { const q = add(add(fr.o, mul(fr.v, b)), mul(fr.n, -t)); return [q[1], q[2]]; };
        const quad = [at(b0, 0.01), at(b1, 0.01), at(b1, p.depth), at(b0, p.depth)];
        if (!quad.every(([y, z]) => inPoly(P, y, z))) return 'extrusion pocket leaves the material';
        const qa = quad.map(([y, z]) => [y, z] as [number, number]);
        if (P.some(([y, z]) => inPoly(qa, y, z))) return 'extrusion pocket cuts a profile corner';
        // A second profile edge must not cross the pocket (checked with a sampled interior grid).
        for (let si = 1; si < 6; si++) for (let ti = 1; ti < 6; ti++) {
          const [y, z] = at(b0 + ((b1 - b0) * si) / 6, (p.depth * ti) / 6);
          if (!inPoly(P, y, z)) return 'extrusion pocket leaves the material';
        }
        items.push({ fr, p, depth: p.depth });
      }
      return checkPocketSet(items);
    }
    case 'stack': {
      const ss = g.sections;
      if (!ss.length) return 'empty stack';
      for (let i = 0; i < ss.length; i++) {
        const sc = ss[i];
        if (!pos(sc.w, sc.y1 - sc.y0) || (g.profile === 'rect' && !pos(sc.h))) return 'stack section size';
        const nx = ss[i + 1];
        if (nx) {
          if (Math.abs(nx.y0 - sc.y1) > 1e-9) return 'stack sections not contiguous';
          const big = (a: typeof sc, c: typeof sc) => (g.profile === 'circle' ? a.w > c.w + 0.05 : a.w > c.w + 0.05 && a.h > c.h + 0.05);
          if (!big(sc, nx) && !big(nx, sc)) return 'stack sections not nested';
        }
      }
      return null;
    }
    case 'tube': return pos(g.ri, g.ro - g.ri - 0.05, g.y1 - g.y0) ? null : 'tube size';
  }
}

// ---------------------------------------------------------------------------
// Entity writer
// ---------------------------------------------------------------------------

class EntityWriter {
  private lines: string[] = [];
  private dirs = new Map<string, number>();
  add(body: string): number {
    this.lines.push(`#${this.lines.length + 1}=${body};`);
    return this.lines.length;
  }
  point(p: V3): number {
    return this.add(`CARTESIAN_POINT('',(${p.map(p21Real).join(',')}))`);
  }
  dir(d: V3): number {
    const u = unit(d);
    const k = u.map(p21Real).join(',');
    let id = this.dirs.get(k);
    if (id === undefined) { id = this.add(`DIRECTION('',(${k}))`); this.dirs.set(k, id); }
    return id;
  }
  axis(origin: V3, z: V3 = [0, 0, 1], x: V3 = [1, 0, 0]): number {
    return this.add(`AXIS2_PLACEMENT_3D('',#${this.point(origin)},#${this.dir(z)},#${this.dir(x)})`);
  }
  text(): string { return this.lines.join('\n'); }
}

// ---------------------------------------------------------------------------
// B-rep builder: shares vertices/edges by position so every edge is used exactly twice
// ---------------------------------------------------------------------------

interface CircleSpec { c: V3; axis: V3; ref: V3; r: number }
type Loop = { pts: V3[] } | { circle: CircleSpec };

class SolidBuilder {
  private verts = new Map<string, { id: number; pid: number }>();
  private edges = new Map<string, { id: number; start: number }>();
  private circles = new Map<string, number>();
  private faces: number[] = [];
  private readonly w: EntityWriter;
  private readonly rot: Mat3;
  private readonly at: V3;
  constructor(w: EntityWriter, rot: Mat3 = IDENTITY, at: V3 = [0, 0, 0]) { this.w = w; this.rot = rot; this.at = at; }

  private P(p: V3): V3 { return xfPoint(p, this.rot, this.at); }
  private D(d: V3): V3 { return xfPoint(d, this.rot); }
  private key(p: V3): string { return p.map((v) => (Math.round(v * 1e5) / 1e5).toFixed(5)).join(','); }

  private vertex(p: V3): { id: number; pid: number } {
    const k = this.key(p);
    let v = this.verts.get(k);
    if (!v) {
      const pid = this.w.point(p);
      v = { id: this.w.add(`VERTEX_POINT('',#${pid})`), pid };
      this.verts.set(k, v);
    }
    return v;
  }

  /** Oriented edge for the straight segment a -> b (world coordinates). */
  private line(a: V3, b: V3): number {
    const va = this.vertex(a), vb = this.vertex(b);
    if (va.id === vb.id) throw new Error('STEP: degenerate edge');
    const k = va.id < vb.id ? `${va.id}|${vb.id}` : `${vb.id}|${va.id}`;
    let e = this.edges.get(k);
    if (!e) {
      const d = sub(b, a);
      const vec = this.w.add(`VECTOR('',#${this.w.dir(d)},${p21Real(len(d))})`);
      const ln = this.w.add(`LINE('',#${va.pid},#${vec})`);
      e = { id: this.w.add(`EDGE_CURVE('',#${va.id},#${vb.id},#${ln},.T.)`), start: va.id };
      this.edges.set(k, e);
    }
    return this.w.add(`ORIENTED_EDGE('',*,*,#${e.id},${e.start === va.id ? '.T.' : '.F.'})`);
  }

  private circleEdge(c: CircleSpec): number {
    const k = `${this.key(c.c)}|${this.key(c.axis)}|${c.r.toFixed(5)}`;
    let id = this.circles.get(k);
    if (id === undefined) {
      const v = this.vertex(add(c.c, mul(c.ref, c.r)));
      const circ = this.w.add(`CIRCLE('',#${this.w.axis(c.c, c.axis, c.ref)},${p21Real(c.r)})`);
      id = this.w.add(`EDGE_CURVE('',#${v.id},#${v.id},#${circ},.T.)`);
      this.circles.set(k, id);
    }
    return id;
  }

  private loop(l: Loop, n: V3, outer: boolean): number {
    let oes: number[];
    if ('circle' in l) {
      const ccw = dot(l.circle.axis, n) > 0;
      const e = this.circleEdge(l.circle);
      oes = [this.w.add(`ORIENTED_EDGE('',*,*,#${e},${ccw === outer ? '.T.' : '.F.'})`)];
    } else {
      // Newell normal: outer loops counter-clockwise about the face normal, inner loops clockwise.
      let nn: V3 = [0, 0, 0];
      const p = l.pts;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        nn = add(nn, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
      }
      const pts = (dot(nn, n) > 0) === outer ? p : [...p].reverse();
      oes = pts.map((a, i) => this.line(a, pts[(i + 1) % pts.length]));
    }
    const el = this.w.add(`EDGE_LOOP('',(${oes.map((o) => `#${o}`).join(',')}))`);
    return this.w.add(`${outer ? 'FACE_OUTER_BOUND' : 'FACE_BOUND'}('',#${el},.T.)`);
  }

  private xLoop(l: Loop): Loop {
    return 'circle' in l
      ? { circle: { c: this.P(l.circle.c), axis: this.D(l.circle.axis), ref: this.D(l.circle.ref), r: l.circle.r } }
      : { pts: l.pts.map((p) => this.P(p)) };
  }

  /** Planar face with outward normal n (local frame); first loop is the outer boundary, the rest are holes. */
  plane(n: V3, outer: Loop, holes: Loop[] = []): void {
    const nu = unit(this.D(n));
    const o = this.xLoop(outer);
    const bounds = [this.loop(o, nu, true), ...holes.map((h) => this.loop(this.xLoop(h), nu, false))];
    const origin = 'circle' in o ? o.circle.c : o.pts[0];
    const pl = this.w.add(`PLANE('',#${this.w.axis(origin, nu, perp(nu))})`);
    this.faces.push(this.w.add(`ADVANCED_FACE('',(${bounds.map((b) => `#${b}`).join(',')}),#${pl},.T.)`));
  }

  /** Cylindrical face (local frame) from c0 along axis for length; outward = solid inside (peg) vs. outside (hole). */
  cylinder(c0L: V3, axisL: V3, refL: V3, r: number, length: number, outward: boolean): void {
    const c0 = this.P(c0L), axis = unit(this.D(axisL)), ref = unit(this.D(refL));
    const c1 = add(c0, mul(axis, length));
    const e0 = this.circleEdge({ c: c0, axis, ref, r });
    const e1 = this.circleEdge({ c: c1, axis, ref, r });
    const p0 = add(c0, mul(ref, r)), p1 = add(c1, mul(ref, r));
    const oe = (e: number, s: boolean) => this.w.add(`ORIENTED_EDGE('',*,*,#${e},${s ? '.T.' : '.F.'})`);
    const oes = outward
      ? [oe(e0, true), this.line(p0, p1), oe(e1, false), this.line(p1, p0)]
      : [this.line(p0, p1), oe(e1, true), this.line(p1, p0), oe(e0, false)];
    const el = this.w.add(`EDGE_LOOP('',(${oes.map((o) => `#${o}`).join(',')}))`);
    const fb = this.w.add(`FACE_OUTER_BOUND('',#${el},.T.)`);
    const cs = this.w.add(`CYLINDRICAL_SURFACE('',#${this.w.axis(c0, axis, ref)},${p21Real(r)})`);
    this.faces.push(this.w.add(`ADVANCED_FACE('',(#${fb}),#${cs},${outward ? '.T.' : '.F.'})`));
  }

  /** Planar face given by a frame with blind pockets: the face itself, then every pocket's walls and floor. */
  pocketedFace(fr: Frame, outer: V3[], pockets: { p: PocketShape; depth: number }[]): void {
    const at = (a: number, b: number, t = 0): V3 => add(add(add(fr.o, mul(fr.u, a)), mul(fr.v, b)), mul(fr.n, -t));
    const loops: Loop[] = pockets.map(({ p }) => (p.kind === 'circle'
      ? { circle: { c: at(p.a, p.b), axis: fr.n, ref: fr.u, r: p.r } }
      : { pts: [at(p.a0, p.b0), at(p.a1, p.b0), at(p.a1, p.b1), at(p.a0, p.b1)] }));
    this.plane(fr.n, { pts: outer }, loops);
    for (const { p, depth } of pockets) {
      if (p.kind === 'circle') {
        const c0 = at(p.a, p.b, depth);
        this.cylinder(c0, fr.n, fr.u, p.r, depth, false);
        this.plane(fr.n, { circle: { c: c0, axis: fr.n, ref: fr.u, r: p.r } });
        continue;
      }
      const a0 = Math.min(p.a0, p.a1), a1 = Math.max(p.a0, p.a1), b0 = Math.min(p.b0, p.b1), b1 = Math.max(p.b0, p.b1);
      const wall = (n: V3, q: [number, number][]) => this.plane(n, { pts: [at(q[0][0], q[0][1]), at(q[1][0], q[1][1]), at(q[1][0], q[1][1], depth), at(q[0][0], q[0][1], depth)] });
      wall(fr.u, [[a0, b0], [a0, b1]]);
      wall(mul(fr.u, -1), [[a1, b0], [a1, b1]]);
      wall(fr.v, [[a0, b0], [a1, b0]]);
      wall(mul(fr.v, -1), [[a0, b1], [a1, b1]]);
      this.plane(fr.n, { pts: [at(a0, b0, depth), at(a1, b0, depth), at(a1, b1, depth), at(a0, b1, depth)] });
    }
  }

  finish(name: string): number {
    const shell = this.w.add(`CLOSED_SHELL('',(${this.faces.map((f) => `#${f}`).join(',')}))`);
    return this.w.add(`MANIFOLD_SOLID_BREP(${p21String(name)},#${shell})`);
  }
}

const rectPts = (x0: number, z0: number, x1: number, z1: number, y: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];

function buildBox(b: SolidBuilder, g: BoxGeom) {
  const faces: BoxFace[] = ['-y', '+y', '-x', '+x', '-z', '+z'];
  for (const f of faces) {
    const fr = boxFace(g, f);
    const corner = (a: number, c: number): V3 => add(add(fr.o, mul(fr.u, a)), mul(fr.v, c));
    const outer = [corner(0, 0), corner(fr.ua, 0), corner(fr.ua, fr.vb), corner(0, fr.vb)];
    b.pocketedFace(fr, outer, (g.pockets ?? []).filter((p) => p.face === f).map((p) => ({ p, depth: p.depth })));
  }
}

function buildTray(b: SolidBuilder, g: TrayGeom) {
  const { w, d, h, t } = g;
  const di = d - t, xi = w - t, zi = h - t;
  // Outer skin
  b.plane([0, 1, 0], { pts: rectPts(0, 0, w, h, d) });
  b.plane([-1, 0, 0], { pts: [[0, 0, 0], [0, d, 0], [0, d, h], [0, 0, h]] });
  b.plane([1, 0, 0], { pts: [[w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]] });
  b.plane([0, 0, -1], { pts: [[0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0]] });
  b.plane([0, 0, 1], { pts: [[0, 0, h], [w, 0, h], [w, d, h], [0, d, h]] });
  // Front rim (ring)
  b.plane([0, -1, 0], { pts: rectPts(0, 0, w, h, 0) }, [{ pts: rectPts(t, t, xi, zi, 0) }]);
  // Cavity (normals point into the cavity)
  b.plane([0, -1, 0], { pts: rectPts(t, t, xi, zi, di) });
  b.plane([1, 0, 0], { pts: [[t, 0, t], [t, di, t], [t, di, zi], [t, 0, zi]] });
  b.plane([-1, 0, 0], { pts: [[xi, 0, t], [xi, di, t], [xi, di, zi], [xi, 0, zi]] });
  b.plane([0, 0, 1], { pts: [[t, 0, t], [xi, 0, t], [xi, di, t], [t, di, t]] });
  b.plane([0, 0, -1], { pts: [[t, 0, zi], [xi, 0, zi], [xi, di, zi], [t, di, zi]] });
}

function buildPlate(b: SolidBuilder, g: PlateGeom) {
  const { w, h, t } = g;
  const holeLoops = (y: number): Loop[] => g.holes.map((o) => (o.kind === 'circle'
    ? { circle: { c: [o.cx, y, o.cz] as V3, axis: [0, 1, 0] as V3, ref: [1, 0, 0] as V3, r: o.r } }
    : { pts: rectPts(o.x0, o.z0, o.x1, o.z1, y) }));
  b.plane([0, -1, 0], { pts: rectPts(0, 0, w, h, 0) }, holeLoops(0));
  b.plane([0, 1, 0], { pts: rectPts(0, 0, w, h, t) }, holeLoops(t));
  b.plane([-1, 0, 0], { pts: [[0, 0, 0], [0, t, 0], [0, t, h], [0, 0, h]] });
  b.plane([1, 0, 0], { pts: [[w, 0, 0], [w, t, 0], [w, t, h], [w, 0, h]] });
  b.plane([0, 0, -1], { pts: [[0, 0, 0], [w, 0, 0], [w, t, 0], [0, t, 0]] });
  b.plane([0, 0, 1], { pts: [[0, 0, h], [w, 0, h], [w, t, h], [0, t, h]] });
  for (const o of g.holes) {
    if (o.kind === 'circle') { b.cylinder([o.cx, 0, o.cz], [0, 1, 0], [1, 0, 0], o.r, t, false); continue; }
    const { x0, z0, x1, z1 } = o;
    b.plane([1, 0, 0], { pts: [[x0, 0, z0], [x0, t, z0], [x0, t, z1], [x0, 0, z1]] });
    b.plane([-1, 0, 0], { pts: [[x1, 0, z0], [x1, t, z0], [x1, t, z1], [x1, 0, z1]] });
    b.plane([0, 0, 1], { pts: [[x0, 0, z0], [x1, 0, z0], [x1, t, z0], [x0, t, z0]] });
    b.plane([0, 0, -1], { pts: [[x0, 0, z1], [x1, 0, z1], [x1, t, z1], [x0, t, z1]] });
  }
}

function buildExtrudeX(b: SolidBuilder, g: ExtrudeXGeom) {
  const { length: L, poly } = g;
  const s = polyArea2(poly) > 0 ? 1 : -1;
  b.plane([-1, 0, 0], { pts: poly.map(([y, z]) => [0, y, z] as V3) });
  b.plane([1, 0, 0], { pts: poly.map(([y, z]) => [L, y, z] as V3) });
  poly.forEach(([y, z], i) => {
    const [y2, z2] = poly[(i + 1) % poly.length];
    const fr = edgeFrame(g, i, s);
    b.pocketedFace(fr, [[0, y, z], [0, y2, z2], [L, y2, z2], [L, y, z]], (g.pockets ?? []).filter((p) => p.edge === i).map((p) => ({ p, depth: p.depth })));
  });
}

function buildStack(b: SolidBuilder, g: StackGeom) {
  const secs = g.sections;
  const Y: V3 = [0, 1, 0], X: V3 = [1, 0, 0];
  const prof = (s: StackGeom['sections'][number], y: number): Loop => (g.profile === 'circle'
    ? { circle: { c: [0, y, 0], axis: Y, ref: X, r: s.w / 2 } }
    : { pts: rectPts(-s.w / 2, -s.h / 2, s.w / 2, s.h / 2, y) });
  const bigger = (a: StackGeom['sections'][number], c: StackGeom['sections'][number]) => (g.profile === 'circle' ? a.w > c.w : a.w > c.w && a.h > c.h);
  b.plane([0, -1, 0], prof(secs[0], secs[0].y0));
  secs.forEach((s, i) => {
    const L = s.y1 - s.y0;
    if (g.profile === 'circle') b.cylinder([0, s.y0, 0], Y, X, s.w / 2, L, true);
    else {
      const x0 = -s.w / 2, x1 = s.w / 2, z0 = -s.h / 2, z1 = s.h / 2;
      b.plane([-1, 0, 0], { pts: [[x0, s.y0, z0], [x0, s.y1, z0], [x0, s.y1, z1], [x0, s.y0, z1]] });
      b.plane([1, 0, 0], { pts: [[x1, s.y0, z0], [x1, s.y1, z0], [x1, s.y1, z1], [x1, s.y0, z1]] });
      b.plane([0, 0, -1], { pts: [[x0, s.y0, z0], [x1, s.y0, z0], [x1, s.y1, z0], [x0, s.y1, z0]] });
      b.plane([0, 0, 1], { pts: [[x0, s.y0, z1], [x1, s.y0, z1], [x1, s.y1, z1], [x0, s.y1, z1]] });
    }
    const nx = secs[i + 1];
    if (nx) {
      if (bigger(s, nx)) b.plane([0, 1, 0], prof(s, s.y1), [prof(nx, s.y1)]);
      else if (bigger(nx, s)) b.plane([0, -1, 0], prof(nx, s.y1), [prof(s, s.y1)]);
      else throw new Error('STEP: stacked sections must be strictly nested');
    }
  });
  const last = secs[secs.length - 1];
  b.plane([0, 1, 0], prof(last, last.y1));
}

function buildTube(b: SolidBuilder, g: TubeGeom) {
  const Y: V3 = [0, 1, 0], X: V3 = [1, 0, 0];
  const c = (r: number, y: number): Loop => ({ circle: { c: [0, y, 0], axis: Y, ref: X, r } });
  b.plane([0, -1, 0], c(g.ro, g.y0), [c(g.ri, g.y0)]);
  b.plane([0, 1, 0], c(g.ro, g.y1), [c(g.ri, g.y1)]);
  b.cylinder([0, g.y0, 0], Y, X, g.ro, g.y1 - g.y0, true);
  b.cylinder([0, g.y0, 0], Y, X, g.ri, g.y1 - g.y0, false);
}

function buildSolid(w: EntityWriter, s: StepSolid, name: string): number {
  const b = new SolidBuilder(w, s.rot, s.at);
  const g = s.geom;
  switch (g.type) {
    case 'box': buildBox(b, g); break;
    case 'tray': buildTray(b, g); break;
    case 'plate': buildPlate(b, g); break;
    case 'extrudeX': buildExtrudeX(b, g); break;
    case 'stack': buildStack(b, g); break;
    case 'tube': buildTube(b, g); break;
  }
  return b.finish(name);
}

// ---------------------------------------------------------------------------
// File assembly
// ---------------------------------------------------------------------------

/** Writes a complete Part 21 file for an assembly tree (root must be an assembly). */
export function writeStepAssembly(root: StepAssembly, header: StepHeader): string {
  const w = new EntityWriter();
  const appCtx = w.add(`APPLICATION_CONTEXT('core data for automotive mechanical design processes')`);
  w.add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${appCtx})`);
  const prodCtx = w.add(`PRODUCT_CONTEXT('',#${appCtx},'mechanical')`);
  const pdCtx = w.add(`PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design')`);
  const mm = w.add('( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )');
  const rad = w.add('( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )');
  const sr = w.add('( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )');
  const unc = w.add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-03),#${mm},'distance_accuracy_value','confusion accuracy')`);
  const ctx = w.add(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${mm},#${rad},#${sr})) REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY') )`);

  const products: number[] = [];
  const styled: number[] = [];
  const styleByColor = new Map<string, number>();
  const style = (c: Rgb): number => {
    const k = c.map(p21Real).join(',');
    let psa = styleByColor.get(k);
    if (psa === undefined) {
      const col = w.add(`COLOUR_RGB('',${k})`);
      const fac = w.add(`FILL_AREA_STYLE_COLOUR('',#${col})`);
      const fas = w.add(`FILL_AREA_STYLE('',(#${fac}))`);
      const ssfa = w.add(`SURFACE_STYLE_FILL_AREA(#${fas})`);
      const sss = w.add(`SURFACE_SIDE_STYLE('',(#${ssfa}))`);
      const ssu = w.add(`SURFACE_STYLE_USAGE(.BOTH.,#${sss})`);
      psa = w.add(`PRESENTATION_STYLE_ASSIGNMENT((#${ssu}))`);
      styleByColor.set(k, psa);
    }
    return psa;
  };
  let nauoCount = 0;
  const written = new Map<StepPart | StepAssembly, { pd: number; rep: number; origin: number }>();

  /** Writes a product (and its subtree) once; returns its PRODUCT_DEFINITION and shape representation. */
  const emit = (node: StepPart | StepAssembly): { pd: number; rep: number; origin: number } => {
    const done = written.get(node);
    if (done) return done;
    const nm = p21String(node.name);
    const prod = w.add(`PRODUCT(${nm},${nm},${p21String(node.description)},(#${prodCtx}))`);
    products.push(prod);
    const pdf = w.add(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`);
    const pd = w.add(`PRODUCT_DEFINITION('design','',#${pdf},#${pdCtx})`);
    const pds = w.add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
    const origin = w.axis([0, 0, 0]);
    let rep: number;
    if (node.kind === 'part') {
      const breps = node.solids.map((s) => {
        const brep = buildSolid(w, s, s.name);
        styled.push(w.add(`STYLED_ITEM('color',(#${style(s.color)}),#${brep})`));
        return brep;
      });
      rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION(${nm},(${breps.map((b) => `#${b},`).join('')}#${origin}),#${ctx})`);
    } else {
      const kids = node.children.map((c) => ({ c, r: emit(c.kind === 'instance' ? c.of : c) }));
      const places = kids.map(({ c }) => w.axis(c.at));
      rep = w.add(`SHAPE_REPRESENTATION(${nm},(#${origin}${places.map((p) => `,#${p}`).join('')}),#${ctx})`);
      kids.forEach(({ c, r }, i) => {
        nauoCount++;
        const cn = p21String(c.name);
        const nauo = w.add(`NEXT_ASSEMBLY_USAGE_OCCURRENCE('NAUO${nauoCount}',${cn},'',#${pd},#${r.pd},$)`);
        const pdsN = w.add(`PRODUCT_DEFINITION_SHAPE('Placement','Placement of an item',#${nauo})`);
        const idt = w.add(`ITEM_DEFINED_TRANSFORMATION('','',#${r.origin},#${places[i]})`);
        const rr = w.add(`( REPRESENTATION_RELATIONSHIP('','',#${r.rep},#${rep}) REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION(#${idt}) SHAPE_REPRESENTATION_RELATIONSHIP() )`);
        w.add(`CONTEXT_DEPENDENT_SHAPE_REPRESENTATION(#${rr},#${pdsN})`);
      });
    }
    w.add(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`);
    const res = { pd, rep, origin };
    written.set(node, res);
    return res;
  };
  emit(root);
  w.add(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(${products.map((p) => `#${p}`).join(',')}))`);
  if (styled.length) w.add(`MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('',(${styled.map((s) => `#${s}`).join(',')}),#${ctx})`);

  return [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION((${p21String(header.description)}),'2;1');`,
    `FILE_NAME(${p21String(header.fileName)},${p21String(header.timeStamp)},(${p21String(header.author)}),(${p21String(header.organization)}),${p21String(header.system)},${p21String(header.system)},'');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    'ENDSEC;',
    'DATA;',
    w.text(),
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n');
}
