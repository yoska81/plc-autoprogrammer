/**
 * Minimal, dependency-free ISO 10303-21 (STEP) writer for AP214 (AUTOMOTIVE_DESIGN)
 * assemblies of B-rep solids in millimetres.
 *
 * Geometry is written as MANIFOLD_SOLID_BREP / CLOSED_SHELL / ADVANCED_FACE on PLANE and
 * CYLINDRICAL_SURFACE with LINE / CIRCLE edges, the subset every CAD importer reads.
 * Assemblies use the standard AP214 pattern: PRODUCT -> PRODUCT_DEFINITION, children linked by
 * NEXT_ASSEMBLY_USAGE_OCCURRENCE and placed by CONTEXT_DEPENDENT_SHAPE_REPRESENTATION +
 * ITEM_DEFINED_TRANSFORMATION (translation only). Colours via STYLED_ITEM / COLOUR_RGB in a
 * MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION.
 *
 * Output is deterministic: entities are numbered in creation order and no clock is read.
 */

export type V3 = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

// ---------------------------------------------------------------------------
// Solid geometry specifications (all in the part's local frame, mm)
// ---------------------------------------------------------------------------

/** Axis-aligned box from the origin to (w, d, h) along X, Y, Z. */
export interface BoxGeom { type: 'box'; w: number; d: number; h: number }
/** Open-front box shell: outer (0..w, 0..d, 0..h), walls of thickness t, open face at y = 0. */
export interface TrayGeom { type: 'tray'; w: number; d: number; h: number; t: number }
/** Plate (0..w, 0..t, 0..h) in the XZ plane with through-holes along Y. */
export interface PlateGeom {
  type: 'plate'; w: number; h: number; t: number;
  holes: ({ kind: 'circle'; cx: number; cz: number; r: number } | { kind: 'rect'; x0: number; z0: number; x1: number; z1: number })[];
}
/** Polygon in the local (y, z) plane extruded along X from 0 to length. */
export interface ExtrudeXGeom { type: 'extrudeX'; length: number; poly: [number, number][] }
/** Coaxial stack along +Y centred on the Y axis; adjacent sections must differ in size. */
export interface StackGeom {
  type: 'stack';
  profile: 'circle' | 'rect';
  /** circle: w = diameter (h ignored); rect: w along X, h along Z. Sections must be contiguous in y. */
  sections: { w: number; h: number; y0: number; y1: number }[];
}
export type SolidGeom = BoxGeom | TrayGeom | PlateGeom | ExtrudeXGeom | StackGeom;

// ---------------------------------------------------------------------------
// Assembly tree
// ---------------------------------------------------------------------------

export interface StepPart {
  kind: 'part';
  name: string;
  description: string;
  color: Rgb;
  geom: SolidGeom;
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
export type StepNode = StepPart | StepAssembly;

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
  constructor(w: EntityWriter) { this.w = w; }

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

  /** Oriented edge for the straight segment a -> b. */
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

  /** Planar face with outward normal n; first loop is the outer boundary, the rest are holes. */
  plane(n: V3, outer: Loop, holes: Loop[] = []): void {
    const nu = unit(n);
    const bounds = [this.loop(outer, nu, true), ...holes.map((h) => this.loop(h, nu, false))];
    const origin = 'circle' in outer ? outer.circle.c : outer.pts[0];
    const pl = this.w.add(`PLANE('',#${this.w.axis(origin, nu, perp(nu))})`);
    this.faces.push(this.w.add(`ADVANCED_FACE('',(${bounds.map((b) => `#${b}`).join(',')}),#${pl},.T.)`));
  }

  /** Cylindrical face from c0 along axis for length; outward = solid inside (peg) vs. outside (hole). */
  cylinder(c0: V3, axis: V3, ref: V3, r: number, length: number, outward: boolean): void {
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

  finish(name: string): number {
    const shell = this.w.add(`CLOSED_SHELL('',(${this.faces.map((f) => `#${f}`).join(',')}))`);
    return this.w.add(`MANIFOLD_SOLID_BREP(${p21String(name)},#${shell})`);
  }
}

const rectPts = (x0: number, z0: number, x1: number, z1: number, y: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];

function buildBox(b: SolidBuilder, g: BoxGeom) {
  const { w, d, h } = g;
  b.plane([0, -1, 0], { pts: rectPts(0, 0, w, h, 0) });
  b.plane([0, 1, 0], { pts: rectPts(0, 0, w, h, d) });
  b.plane([-1, 0, 0], { pts: [[0, 0, 0], [0, d, 0], [0, d, h], [0, 0, h]] });
  b.plane([1, 0, 0], { pts: [[w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]] });
  b.plane([0, 0, -1], { pts: [[0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0]] });
  b.plane([0, 0, 1], { pts: [[0, 0, h], [w, 0, h], [w, d, h], [0, d, h]] });
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
  let area2 = 0;
  poly.forEach(([y, z], i) => { const [y2, z2] = poly[(i + 1) % poly.length]; area2 += y * z2 - y2 * z; });
  const s = area2 > 0 ? 1 : -1;
  b.plane([-1, 0, 0], { pts: poly.map(([y, z]) => [0, y, z] as V3) });
  b.plane([1, 0, 0], { pts: poly.map(([y, z]) => [L, y, z] as V3) });
  poly.forEach(([y, z], i) => {
    const [y2, z2] = poly[(i + 1) % poly.length];
    b.plane([0, s * (z2 - z), -s * (y2 - y)], { pts: [[0, y, z], [0, y2, z2], [L, y2, z2], [L, y, z]] });
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

function buildSolid(w: EntityWriter, g: SolidGeom, name: string): number {
  const b = new SolidBuilder(w);
  switch (g.type) {
    case 'box': buildBox(b, g); break;
    case 'tray': buildTray(b, g); break;
    case 'plate': buildPlate(b, g); break;
    case 'extrudeX': buildExtrudeX(b, g); break;
    case 'stack': buildStack(b, g); break;
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

  /** Writes a product (and its subtree); returns its PRODUCT_DEFINITION and shape representation. */
  const emit = (node: StepNode): { pd: number; rep: number; origin: number } => {
    const nm = p21String(node.name);
    const prod = w.add(`PRODUCT(${nm},${nm},${p21String(node.description)},(#${prodCtx}))`);
    products.push(prod);
    const pdf = w.add(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`);
    const pd = w.add(`PRODUCT_DEFINITION('design','',#${pdf},#${pdCtx})`);
    const pds = w.add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
    const origin = w.axis([0, 0, 0]);
    let rep: number;
    if (node.kind === 'part') {
      const brep = buildSolid(w, node.geom, node.name);
      rep = w.add(`ADVANCED_BREP_SHAPE_REPRESENTATION(${nm},(#${brep},#${origin}),#${ctx})`);
      styled.push(w.add(`STYLED_ITEM('color',(#${style(node.color)}),#${brep})`));
    } else {
      const kids = node.children.map((c) => ({ c, r: emit(c) }));
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
    return { pd, rep, origin };
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
