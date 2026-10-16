/**
 * Layout geometry (pure, metres): scale conversion, cable route graph and routed cable lengths.
 *
 * A cable runs from one item to the other along the drawn routes (tray / conduit / drag chain):
 * a drop from each item to the nearest point of a route, then the shortest path along the routes
 * (routes that cross or touch are connected). Items close together (or a layout without routes)
 * use the orthogonal (Manhattan) distance — cables are run along machine members, not diagonally.
 */
import type { LayoutForDesign, LengthUnit, MachineLayout, RouteKind, ServiceAllowance } from './types';

export type Pt = [number, number];

export const TO_M: Record<LengthUnit, number> = { m: 1, mm: 0.001, in: 0.0254, ft: 0.3048 };

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const manhattan = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/** Canvas units per metre from two clicked points and the real distance between them. */
export function unitsPerMeter(a: Pt, b: Pt, value: number, unit: LengthUnit): number {
  const m = value * TO_M[unit];
  return m > 0 ? dist(a, b) / m : 0;
}

/** The layout in metres for the electrical design, or undefined without a scale / placed items. */
export function layoutForDesign(l: MachineLayout | undefined): LayoutForDesign | undefined {
  if (!l?.scale || l.scale.unitsPerMeter <= 0 || !l.items.length) return undefined;
  const k = 1 / l.scale.unitsPerMeter;
  const pos: LayoutForDesign['pos'] = {};
  for (const it of l.items) pos[it.tag] = { x: it.x * k, y: it.y * k };
  return {
    pos,
    routes: l.routes.filter((r) => r.points.length >= 2).map((r) => ({ kind: r.kind, pts: r.points.map(([x, y]) => [x * k, y * k] as Pt) })),
    service: l.service,
    manifolds: l.manifolds.map((m) => ({ ...m, x: m.x * k, y: m.y * k })),
    remoteIo: l.remoteIo.map((r) => ({ ...r, x: r.x * k, y: r.y * k })),
    background: l.background ? { dataUrl: l.background.dataUrl, wM: l.background.w * k, hM: l.background.h * k } : undefined,
    sizeM: { w: l.canvas.w * k, h: l.canvas.h * k },
  };
}

/** Closest point on segment ab to p, and the parameter t (0..1). */
export function project(p: Pt, a: Pt, b: Pt): { q: Pt; t: number; d: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  const q: Pt = [a[0] + t * dx, a[1] + t * dy];
  return { q, t, d: dist(p, q) };
}

function intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r: Pt = [b[0] - a[0], b[1] - a[1]], s: Pt = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}

interface Seg { a: Pt; b: Pt; route: number; kind: RouteKind }

/** Route graph: every polyline split at crossings / touching ends, as an adjacency list. */
export class RouteGraph {
  readonly nodes: Pt[] = [];
  readonly adj: { to: number; w: number; route: number }[][] = [];
  readonly segs: Seg[] = [];
  private snap: number;

  constructor(routes: LayoutForDesign['routes'], snapM = 0.3) {
    this.snap = snapM;
    const raw: Seg[] = [];
    routes.forEach((r, ri) => { for (let i = 1; i < r.pts.length; i++) raw.push({ a: r.pts[i - 1], b: r.pts[i], route: ri, kind: r.kind }); });
    // split points per segment: crossings with other segments, and route ends that touch a segment
    const cuts: number[][] = raw.map(() => []);
    for (let i = 0; i < raw.length; i++) {
      for (let j = i + 1; j < raw.length; j++) {
        if (raw[i].route === raw[j].route && Math.abs(i - j) === 1) continue;
        const x = intersect(raw[i].a, raw[i].b, raw[j].a, raw[j].b);
        if (x) { cuts[i].push(project(x, raw[i].a, raw[i].b).t); cuts[j].push(project(x, raw[j].a, raw[j].b).t); }
      }
      for (const end of [raw[i].a, raw[i].b]) {
        for (let j = 0; j < raw.length; j++) {
          if (j === i || raw[j].route === raw[i].route) continue;
          const pr = project(end, raw[j].a, raw[j].b);
          if (pr.d <= this.snap) cuts[j].push(pr.t);
        }
      }
    }
    raw.forEach((s, i) => {
      const ts = [...new Set([0, 1, ...cuts[i].map((t) => Math.round(t * 1e6) / 1e6)])].sort((x, y) => x - y);
      for (let k = 1; k < ts.length; k++) {
        const p = (t: number): Pt => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
        const seg = { a: p(ts[k - 1]), b: p(ts[k]), route: s.route, kind: s.kind };
        this.segs.push(seg);
        this.link(this.node(seg.a), this.node(seg.b), s.route);
      }
    });
  }

  /** Node id for a point (merging points closer than the snap distance). */
  node(p: Pt): number {
    const i = this.nodes.findIndex((n) => dist(n, p) <= Math.min(this.snap, 0.05) || dist(n, p) < 1e-6);
    if (i >= 0) return i;
    this.nodes.push(p);
    this.adj.push([]);
    return this.nodes.length - 1;
  }

  private link(i: number, j: number, route: number) {
    if (i === j) return;
    const w = dist(this.nodes[i], this.nodes[j]);
    this.adj[i].push({ to: j, w, route });
    this.adj[j].push({ to: i, w, route });
  }

  /** Attach a point to the nearest route: returns the node on the route and the drop length. */
  attach(p: Pt): { node: number; drop: number } | null {
    let best: { seg: number; q: Pt; d: number } | null = null;
    // the drop is run orthogonally, so pick the route with the shortest orthogonal drop
    this.segs.forEach((s, i) => { const pr = project(p, s.a, s.b); const d = manhattan(p, pr.q) + pr.d * 1e-6; if (!best || d < best.d) best = { seg: i, q: pr.q, d }; });
    if (!best) return null;
    const b = best as { seg: number; q: Pt; d: number };
    const s = this.segs[b.seg];
    const n = this.node(b.q);
    const na = this.node(s.a), nb = this.node(s.b);
    if (n !== na && n !== nb) {
      this.link(n, na, s.route); this.link(n, nb, s.route);
      // split the segment so a later attachment on it links to this point, not only to the segment ends
      this.segs.splice(b.seg, 1, { ...s, b: b.q }, { ...s, a: b.q });
    }
    return { node: n, drop: manhattan(p, b.q) };
  }

  /** Shortest path length between two nodes (Infinity when not connected), with the routes used. */
  shortest(from: number, to: number): { len: number; routes: Set<number> } {
    const n = this.nodes.length;
    const d = new Array<number>(n).fill(Infinity), prev = new Array<{ node: number; route: number } | null>(n).fill(null);
    const done = new Array<boolean>(n).fill(false);
    d[from] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
      if (u < 0 || u === to) break;
      done[u] = true;
      for (const e of this.adj[u]) if (d[u] + e.w < d[e.to]) { d[e.to] = d[u] + e.w; prev[e.to] = { node: u, route: e.route }; }
    }
    const routes = new Set<number>();
    for (let v = to; prev[v]; v = prev[v]!.node) routes.add(prev[v]!.route);
    return { len: d[to], routes };
  }
}

/** Below this direct distance a cable is run point to point, not via the routes (m). */
export const DIRECT_M = 2;

/** Routed length between two points (m), without service allowance, and the routes it uses. */
export function routedLength(a: Pt, b: Pt, routes: LayoutForDesign['routes']): { len: number; routes: number[]; viaRoutes: boolean } {
  const direct = manhattan(a, b);
  if (!routes.length || direct <= DIRECT_M) return { len: direct, routes: [], viaRoutes: false };
  const g = new RouteGraph(routes);
  const ra = g.attach(a), rb = g.attach(b);
  if (!ra || !rb) return { len: direct, routes: [], viaRoutes: false };
  const sp = g.shortest(ra.node, rb.node);
  if (!Number.isFinite(sp.len)) return { len: direct, routes: [], viaRoutes: false };
  return { len: ra.drop + sp.len + rb.drop, routes: [...sp.routes], viaRoutes: true };
}

/** Cable length to order: routed length + slack % + a service loop at each end (m). */
export function withService(len: number, s: ServiceAllowance): number {
  return len * (1 + s.pct / 100) + 2 * s.endM;
}

/** Cable length text for schedules: "12.4 m (41 ft)". */
export function lengthText(m: number): string {
  return `${m.toFixed(1)} m (${Math.round(m / 0.3048)} ft)`;
}
