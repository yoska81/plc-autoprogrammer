/**
 * ASCII DXF (R12 / AC1009) export of the machining drawings for laser / CNC CAM.
 * Scale 1:1 in inches (default) or millimetres; all text shows dual dimensions `inch [mm]`. Datum: lower-left corner of the panel / door (X right, Y up) —
 * the same coordinates as the BACK PANEL DRILLING and DOOR CUTOUTS sheets.
 *
 * Layers: OUTLINE (part outline), HOLES (drilled/tapped holes, CIRCLE),
 * CUTOUTS (punched operator holes and rectangular cutouts), NOTCH_OPTIONAL
 * (anti-rotation notches — cut only if the operator needs them), TEMPLATE
 * (centre marks for parts drilled from a manufacturer template — do not cut),
 * TEXT (labels, title, units) and DIMS (ordinate reference marks).
 * Pure TypeScript, no dependencies.
 */
import { enclosureFaceDrilling } from './enclosureFaces';
import { backPanelDrilling, doorDrilling, dualDim, dualSize, type DrawingContext, type DrillingPlan } from './derive';

const LAYERS: [string, number][] = [['OUTLINE', 7], ['HOLES', 1], ['CUTOUTS', 5], ['NOTCH_OPTIONAL', 6], ['TEMPLATE', 8], ['TEXT', 3], ['DIMS', 4]];

const f = (v: number) => (Math.round(v * 10000) / 10000).toString();

/** Export options. Geometry is always true size (1:1); only the drawing unit changes. */
export interface DxfOptions {
  /** 'in' (default) or 'mm' — coordinates are converted, the part stays full size. */
  units?: 'mm' | 'in';
  /** Only what the machine cuts: outline, holes and cutouts (no text, centre marks or optional notches). */
  cutOnly?: boolean;
}

class DxfWriter {
  /** mm -> drawing units. */
  private readonly k: number;
  private readonly units: 'mm' | 'in';
  private readonly cutOnly: boolean;
  constructor(k = 1, units: 'mm' | 'in' = 'in', cutOnly = false) { this.k = k; this.units = units; this.cutOnly = cutOnly; }
  private out: string[] = [];
  private minX = Infinity; private minY = Infinity; private maxX = -Infinity; private maxY = -Infinity;
  private pair(code: number, value: string | number) { this.out.push(String(code), typeof value === 'number' ? f(value) : value); }
  private ext(x: number, y: number) { this.minX = Math.min(this.minX, x); this.minY = Math.min(this.minY, y); this.maxX = Math.max(this.maxX, x); this.maxY = Math.max(this.maxY, y); }
  private entities: string[][] = [];
  private ent(fn: () => void) { const save = this.out; this.out = []; fn(); this.entities.push(this.out); this.out = save; }

  private skip(layer: string) { return this.cutOnly && !['OUTLINE', 'HOLES', 'CUTOUTS'].includes(layer); }
  line(layer: string, x1: number, y1: number, x2: number, y2: number) {
    if (this.skip(layer)) return;
    const k = this.k; x1 *= k; y1 *= k; x2 *= k; y2 *= k;
    this.ext(x1, y1); this.ext(x2, y2);
    this.ent(() => { this.pair(0, 'LINE'); this.pair(8, layer); this.pair(10, x1); this.pair(20, y1); this.pair(30, 0); this.pair(11, x2); this.pair(21, y2); this.pair(31, 0); });
  }
  circle(layer: string, x: number, y: number, r: number) {
    if (this.skip(layer)) return;
    const k = this.k; x *= k; y *= k; r *= k;
    this.ext(x - r, y - r); this.ext(x + r, y + r);
    this.ent(() => { this.pair(0, 'CIRCLE'); this.pair(8, layer); this.pair(10, x); this.pair(20, y); this.pair(30, 0); this.pair(40, r); });
  }
  /** Closed 2D polyline (R12 POLYLINE / VERTEX / SEQEND). */
  poly(layer: string, pts: [number, number][]) {
    if (this.skip(layer)) return;
    pts = pts.map(([x, y]) => [x * this.k, y * this.k]);
    for (const [x, y] of pts) this.ext(x, y);
    this.ent(() => {
      this.pair(0, 'POLYLINE'); this.pair(8, layer); this.pair(66, 1); this.pair(10, 0); this.pair(20, 0); this.pair(30, 0); this.pair(70, 1);
      for (const [x, y] of pts) { this.pair(0, 'VERTEX'); this.pair(8, layer); this.pair(10, x); this.pair(20, y); this.pair(30, 0); }
      this.pair(0, 'SEQEND'); this.pair(8, layer);
    });
  }
  rect(layer: string, cx: number, cy: number, w: number, h: number) {
    this.poly(layer, [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]);
  }
  text(layer: string, x: number, y: number, h: number, s: string) {
    if (this.skip(layer)) return;
    const k = this.k; x *= k; y *= k; h *= k;
    this.ext(x, y);
    const clean = s.replace(/[^\x20-\x7E]/g, (c) => (c === 'Ø' ? '%%c' : c === '±' ? '%%p' : c === '°' ? '%%d' : '-'));
    this.ent(() => { this.pair(0, 'TEXT'); this.pair(8, layer); this.pair(10, x); this.pair(20, y); this.pair(30, 0); this.pair(40, h); this.pair(1, clean); });
  }

  toString(): string {
    const o: string[] = [];
    const p = (c: number, v: string | number) => o.push(String(c), typeof v === 'number' ? f(v) : v);
    const ex = Number.isFinite(this.minX) ? [this.minX, this.minY, this.maxX, this.maxY] : [0, 0, 0, 0];
    p(0, 'SECTION'); p(2, 'HEADER');
    p(9, '$ACADVER'); p(1, 'AC1009');
    p(9, '$INSBASE'); p(10, 0); p(20, 0); p(30, 0);
    p(9, '$EXTMIN'); p(10, ex[0]); p(20, ex[1]); p(30, 0);
    p(9, '$EXTMAX'); p(10, ex[2]); p(20, ex[3]); p(30, 0);
    p(9, '$LIMMIN'); p(10, ex[0]); p(20, ex[1]);
    p(9, '$LIMMAX'); p(10, ex[2]); p(20, ex[3]);
    // Units for CAM import: $INSUNITS 4 = mm, 1 = inch (newer readers); $MEASUREMENT 1 = metric, 0 = imperial.
    p(9, '$INSUNITS'); p(70, this.units === 'in' ? 1 : 4);
    p(9, '$MEASUREMENT'); p(70, this.units === 'in' ? 0 : 1);
    p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'TABLES');
    p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 1);
    p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, 0);
    p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'LAYER'); p(70, LAYERS.length);
    for (const [name, color] of LAYERS) { p(0, 'LAYER'); p(2, name); p(70, 0); p(62, color); p(6, 'CONTINUOUS'); }
    p(0, 'ENDTAB');
    p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'BLOCKS'); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'ENTITIES');
    for (const e of this.entities) o.push(...e);
    p(0, 'ENDSEC');
    p(0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }
}

/** Builds the DXF for one machining plan (shared by back panel and door). */
export function drillingDxf(plan: DrillingPlan, projectName = '', opts: DxfOptions = {}): string {
  const units = opts.units ?? 'in';
  const w = new DxfWriter(units === 'in' ? 1 / 25.4 : 1, units, Boolean(opts.cutOnly));
  w.poly('OUTLINE', [[0, 0], [plan.w, 0], [plan.w, plan.h], [0, plan.h]]);
  for (const h of plan.holes) {
    w.circle('HOLES', h.x, h.y, h.dia / 2);
    w.text('TEXT', h.x + h.dia / 2 + 1, h.y + h.dia / 2 + 0.5, 2.5, `${h.id} Ø${dualDim(h.dia)}`);
  }
  for (const c of plan.cutouts) {
    if (c.template) {
      // size not from the catalog: centre mark and outline only, machined per the part's template / datasheet
      const r = Math.max(c.w, c.h) / 2;
      w.line('TEMPLATE', c.x - r - 5, c.y, c.x + r + 5, c.y);
      w.line('TEMPLATE', c.x, c.y - r - 5, c.x, c.y + r + 5);
      if (c.kind === 'rect') w.rect('TEMPLATE', c.x, c.y, c.w, c.h); else w.circle('TEMPLATE', c.x, c.y, c.w / 2);
      w.text('TEXT', c.x + c.w / 2 + 2, c.y + c.h / 2 + 2, 3, `${c.id} ${c.tag} ${c.template} - DO NOT CUT FROM THIS OUTLINE`);
      continue;
    }
    if (c.kind === 'round') {
      w.circle('CUTOUTS', c.x, c.y, c.w / 2);
      if (c.notch) w.poly('NOTCH_OPTIONAL', [[c.x - c.notch.w / 2, c.y + c.w / 2 - 0.3], [c.x + c.notch.w / 2, c.y + c.w / 2 - 0.3], [c.x + c.notch.w / 2, c.y + c.w / 2 + c.notch.d], [c.x - c.notch.w / 2, c.y + c.w / 2 + c.notch.d]]);
    } else w.rect('CUTOUTS', c.x, c.y, c.w, c.h);
    w.text('TEXT', c.x - c.w / 2, c.y - c.h / 2 - 5, 3, `${c.id} ${c.tag} ${c.kind === 'round' ? `Ø${dualDim(c.w)}` : dualSize(c.w, c.h)}`);
  }
  // datum mark and title
  w.line('DIMS', -10, 0, 10, 0);
  w.line('DIMS', 0, -10, 0, 10);
  w.text('TEXT', 2, -8, 3, 'DATUM 0,0');
  w.text('TEXT', 0, -20, 5, `${plan.title} - ${plan.part}${projectName ? ` - ${projectName}` : ''}`);
  w.text('TEXT', 0, -28, 3.5, `SCALE 1:1   DRAWING UNITS: ${units === 'in' ? 'INCH' : 'MM'}   DIMENSIONS INCH [MM]   SIZE ${dualSize(plan.w, plan.h)}   HOLES ${plan.holes.length}   CUTOUTS ${plan.cutouts.length}`);
  plan.codes.forEach((c, i) => w.text('TEXT', 0, -35 - i * 5, 2.5, `${c.code} (${c.count}x): ${c.spec}${c.verified ? '' : ' - VERIFY WITH DATASHEET'}`));
  return w.toString();
}

/** Back-panel drilling DXF (inches unless opts.units = 'mm', lower-left datum). */
export function backPanelDxf(ctx: DrawingContext, opts?: DxfOptions): string {
  return drillingDxf(backPanelDrilling(ctx), ctx.projectName, opts);
}

/** Door cutout DXF (inches unless opts.units = 'mm', lower-left datum, outside view). */
export function doorDxf(ctx: DrawingContext, opts?: DxfOptions): string {
  return drillingDxf(doorDrilling(ctx), ctx.projectName, opts);
}

/** One DXF per enclosure wall with cutouts (bottom, top, left, right). */
export function enclosureFaceDxfs(ctx: DrawingContext, opts?: DxfOptions): { face: DrillingPlan['kind']; dxf: string }[] {
  return enclosureFaceDrilling(ctx).map((p) => ({ face: p.kind, dxf: drillingDxf(p, ctx.projectName, opts) }));
}
