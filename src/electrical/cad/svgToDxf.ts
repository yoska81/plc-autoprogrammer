/**
 * Drawing sheet (SVG, mm, y down) → DXF (mm, y up) for AutoCAD / AutoCAD Electrical / EPLAN "Insert DXF/DWG".
 *
 * Layers follow the sheet's data-cad markers (nearest ancestor): BORDER (frame and title block),
 * SYMS (device symbols), WIRES (lines on schematic sheets outside symbols), WIRENO, TAGS, TEXT,
 * GRAPHICS (everything else). Device tags become INSERTs of block ISA_DEVICE with the AutoCAD
 * Electrical attribute names TAG1 (visible), DESC1, MFG and CAT; wire numbers become INSERTs of
 * block ISA_WIRENO with attribute WIRENO. Curves of paths are flattened to polylines.
 */
import { Attrib, DxfWriter, LWPolylineFlags, SeqEnd, TextHorizontalAlignment, TextVerticalAlignment, Units, point3d, type Insert, type TextOptions, type vec3_t } from '@tarikjabiri/dxf';
import { textOf, type SvgNode } from './svgTree';

export interface CadDevice { tag: string; desc: string; part: string; mfr: string }
export interface SheetDxfOptions {
  /** Device tag → data for the ISA_DEVICE attributes. A text equal to a tag becomes a block reference. */
  devices?: Map<string, CadDevice>;
  /** Sheet kinds whose free lines are wires (schematics). */
  wireSheets?: string[];
  /** Sheet kinds whose device tags become ISA_DEVICE references (schematics and layouts, not tables). */
  deviceSheets?: string[];
}
export interface SheetDxfStats { entities: number; devices: number; wireNumbers: number; skipped: number }

export const CAD_LAYERS: [name: string, color: number][] = [
  ['BORDER', 7], ['SYMS', 7], ['WIRES', 5], ['WIRENO', 3], ['TAGS', 2], ['TEXT', 7], ['GRAPHICS', 8],
];
const WIRE_SHEETS = ['power', 'motors', 'control', 'io', 'analog', 'drive', 'jb'];
const DEVICE_SHEETS = [...WIRE_SHEETS, 'panel', 'door', 'machine', 'layout'];

type M = [number, number, number, number, number, number]; // a b c d e f (SVG matrix)
const ID: M = [1, 0, 0, 1, 0, 0];
/** Capital-letter height per em of the DXF text fonts (Arial, Courier New): DXF heights are cap heights. */
const CAP_SANS = 0.716, CAP_MONO = 0.571;
const mul = (p: M, q: M): M => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m: M) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
const num = (s: string | undefined, d = 0) => { const v = parseFloat(s ?? ''); return Number.isFinite(v) ? v : d; };

/** SVG transform list → matrix. */
export function parseTransform(t: string | undefined): M {
  let m = ID;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let r: RegExpExecArray | null;
  while (t && (r = re.exec(t))) {
    const a = r[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let q: M = ID;
    switch (r[1]) {
      case 'matrix': q = [a[0], a[1], a[2], a[3], a[4], a[5]]; break;
      case 'translate': q = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': q = [a[0], 0, 0, a[1] ?? a[0], 0, 0]; break;
      case 'rotate': {
        const k = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(k), s = Math.sin(k), cx = a[1] ?? 0, cy = a[2] ?? 0;
        q = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
        break;
      }
      case 'skewX': q = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': q = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = mul(m, q);
  }
  return m;
}

/** Path data → subpaths of points (curves flattened), with a closed flag. */
export function flattenPath(d: string): { pts: [number, number][]; closed: boolean }[] {
  const out: { pts: [number, number][]; closed: boolean }[] = [];
  const toks = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0;
  let cur: { pts: [number, number][]; closed: boolean } | null = null;
  const n = () => Number(toks[i++]);
  const start = () => { cur = { pts: [[x, y]], closed: false }; out.push(cur); };
  const to = (nx: number, ny: number) => { if (!cur) start(); cur!.pts.push([nx, ny]); x = nx; y = ny; };
  const cubic = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, u = 1 - t;
      to(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey);
    }
    lcx = x2; lcy = y2;
  };
  const quad = (x1: number, y1: number, ex: number, ey: number) => {
    const x0 = x, y0 = y;
    for (let k = 1; k <= 6; k++) { const t = k / 6, u = 1 - t; to(u * u * x0 + 2 * u * t * x1 + t * t * ex, u * u * y0 + 2 * u * t * y1 + t * t * ey); }
    lcx = x1; lcy = y1;
  };
  const arc = (rx: number, ry: number, rot: number, large: number, sweep: number, ex: number, ey: number) => {
    // SVG endpoint arc → centre parameterisation (SVG 1.1 F.6.5), then sampled
    if (!rx || !ry) { to(ex, ey); return; }
    const phi = (rot * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
    const dx = (x - ex) / 2, dy = (y - ey) / 2, x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const sgn = large === sweep ? -1 : 1;
    const co = sgn * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
    const cxp = (co * rx * y1) / ry, cyp = (-co * ry * x1) / rx;
    const cx = cp * cxp - sp * cyp + (x + ex) / 2, cy = sp * cxp + cp * cyp + (y + ey) / 2;
    const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
    let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
    const steps = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
    for (let k = 1; k <= steps; k++) {
      const t = t1 + (dt * k) / steps;
      to(cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp);
    }
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': { x = n() + ox; y = n() + oy; sx = x; sy = y; start(); cmd = rel ? 'l' : 'L'; break; }
      case 'L': to(n() + ox, n() + oy); break;
      case 'H': to(n() + ox, y); break;
      case 'V': to(x, n() + (rel ? y : 0)); break;
      case 'C': { const a = [n() + ox, n() + oy, n() + ox, n() + oy, n() + ox, n() + oy]; cubic(a[0], a[1], a[2], a[3], a[4], a[5]); break; }
      case 'S': { const a = [n() + ox, n() + oy, n() + ox, n() + oy]; cubic(2 * x - lcx, 2 * y - lcy, a[0], a[1], a[2], a[3]); break; }
      case 'Q': { const a = [n() + ox, n() + oy, n() + ox, n() + oy]; quad(a[0], a[1], a[2], a[3]); break; }
      case 'T': { const a = [n() + ox, n() + oy]; quad(2 * x - lcx, 2 * y - lcy, a[0], a[1]); break; }
      case 'A': { const rx = n(), ry = n(), rot = n(), large = n(), sweep = n(); arc(rx, ry, rot, large, sweep, n() + ox, n() + oy); break; }
      case 'Z': { if (cur) (cur as { closed: boolean }).closed = true; x = sx; y = sy; cur = null; break; }
      default: i++; // unknown token: skip
    }
    if (!/[CcSsQqTt]/.test(cmd)) { lcx = x; lcy = y; }
  }
  return out.filter((p) => p.pts.length > 1);
}

/** One drawing sheet (parsed SVG) as DXF text. */
export function svgToDxf(svg: SvgNode, opts: SheetDxfOptions = {}): { dxf: string; stats: SheetDxfStats } {
  return svgSheetsToDxf([svg], opts);
}

/**
 * Several drawing sheets in ONE DXF: laid out in order, `perRow` sheets per row (sheet 1 top left), with a gap
 * between them, each sheet at 1:1 with its own frame and title block.
 */
export function svgSheetsToDxf(sheets: SvgNode[], opts: SheetDxfOptions & { perRow?: number; gapMm?: number } = {}): { dxf: string; stats: SheetDxfStats } {
  const perRow = opts.perRow ?? 5, gap = opts.gapMm ?? 50;
  const sizes = sheets.map((svg) => { const vb = (svg.attrs.viewBox ?? '0 0 431.8 279.4').split(/[\s,]+/).map(Number); return { w: vb[2], h: vb[3] }; });
  const cellW = Math.max(...sizes.map((z) => z.w)) + gap, cellH = Math.max(...sizes.map((z) => z.h)) + gap;
  // Offset of the current sheet (DXF y up: row 0 on top) and its height (SVG y down -> DXF y up).
  let ox = 0, oy = 0, H = sizes[0]?.h ?? 279.4;
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Millimeters);
  dxf.addLType('DASHED', '__  __  __', [2.5, -1.25]);
  for (const [name, color] of CAD_LAYERS) dxf.addLayer(name, color, 'CONTINUOUS');
  const sans = dxf.tables.addStyle('ISA_SANS'); sans.fontFileName = 'arial.ttf';
  const bold = dxf.tables.addStyle('ISA_SANS_BOLD'); bold.fontFileName = 'arialbd.ttf';
  const mono = dxf.tables.addStyle('ISA_MONO'); mono.fontFileName = 'cour.ttf';
  // Device block: the tag shows, description / manufacturer / catalogue number ride along (AutoCAD Electrical names).
  const devBlock = dxf.addBlock('ISA_DEVICE');
  devBlock.setLayerName('TAGS');
  for (const [tag, vis] of [['TAG1', true], ['DESC1', false], ['MFG', false], ['CAT', false]] as const) {
    const a = devBlock.addAttdef(point3d(0, 0, 0), 2.5, tag, '', { layerName: 'TAGS', visible: vis });
    a.textStyle = 'ISA_SANS';
  }
  const wnBlock = dxf.addBlock('ISA_WIRENO');
  const wa = wnBlock.addAttdef(point3d(0, 0, 0), 2.2, 'WIRENO', '', { layerName: 'WIRENO' });
  wa.textStyle = 'ISA_MONO';

  const stats: SheetDxfStats = { entities: 0, devices: 0, wireNumbers: 0, skipped: 0 };
  // The writer's addAttrib closes every ATTRIB with its own SEQEND (only the first attribute would stay on
  // the insert): add the attributes, then one SEQEND for the insert.
  const attribs = (ins: Insert, list: { p: vec3_t; height: number; tag: string; value: string; style: string; options: TextOptions }[]) => {
    ins.attributesFollowFlag = 1;
    for (const a of list) {
      const at = dxf.modelSpace.addEntity(new Attrib(a.p, a.height, a.tag, a.value, a.options));
      at.textStyle = a.style;
    }
    const se = dxf.modelSpace.addEntity(new SeqEnd());
    se.ownerBlockRecord = ins.handle;
  };
  const devices = opts.devices ?? new Map<string, CadDevice>();
  const wireSheets = opts.wireSheets ?? WIRE_SHEETS;
  const deviceSheets = opts.deviceSheets ?? DEVICE_SHEETS;
  const P = (m: M, x: number, y: number) => { const [X, Y] = apply(m, x, y); return point3d(ox + X, oy + H - Y, 0); };

  const walk = (n: SvgNode, m0: M, inh: { cad: string; sheet: string; stroke: string; fill: string; mono: boolean; bold: boolean; size: number; anchor: string }) => {
    if (['defs', 'pattern', 'clipPath', 'mask', 'marker', 'symbol', 'style', 'title', 'desc', 'metadata'].includes(n.tag)) return;
    if (n.tag === 'image' || n.tag === 'use' || n.tag === 'foreignObject') { stats.skipped++; return; }
    const m = mul(m0, parseTransform(n.attrs.transform));
    const s = {
      cad: n.attrs['data-cad'] ?? inh.cad, sheet: n.attrs['data-cad-sheet'] ?? inh.sheet,
      stroke: n.attrs.stroke ?? inh.stroke, fill: n.attrs.fill ?? inh.fill,
      mono: n.attrs['font-family'] ? /mono|courier|consol/i.test(n.attrs['font-family']) : inh.mono,
      bold: n.attrs['font-weight'] ? /bold|[6-9]00/.test(n.attrs['font-weight']) : inh.bold,
      size: n.attrs['font-size'] ? num(n.attrs['font-size'], inh.size) : inh.size,
      anchor: n.attrs['text-anchor'] ?? inh.anchor,
    };
    const visible = s.stroke !== 'none' || (s.fill !== 'none' && !/^(#fff|#ffffff|white)$/i.test(s.fill));
    const layer = s.cad === 'GRAPHICS' && ['line', 'path', 'polyline'].includes(n.tag) && wireSheets.includes(s.sheet) ? 'WIRES' : s.cad;
    const opt = { layerName: layer, ...(n.attrs['stroke-dasharray'] && n.attrs['stroke-dasharray'] !== 'none' ? { lineType: 'DASHED' } : {}) };
    const poly = (pts: [number, number][], closed: boolean) => {
      dxf.addLWPolyline(pts.map(([x, y]) => { const p = P(m, x, y); return { point: { x: p.x, y: p.y } }; }), { ...opt, flags: closed ? LWPolylineFlags.Closed : LWPolylineFlags.None });
      stats.entities++;
    };
    switch (n.tag) {
      case 'line':
        if (s.stroke === 'none') break;
        dxf.addLine(P(m, num(n.attrs.x1), num(n.attrs.y1)), P(m, num(n.attrs.x2), num(n.attrs.y2)), opt); stats.entities++;
        break;
      case 'rect': {
        if (!visible) break;
        const x = num(n.attrs.x), y = num(n.attrs.y), w = num(n.attrs.width), h = num(n.attrs.height);
        if (w > 0 && h > 0) poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
        break;
      }
      case 'circle': {
        if (!visible) break;
        dxf.addCircle(P(m, num(n.attrs.cx), num(n.attrs.cy)), num(n.attrs.r) * scaleOf(m), opt); stats.entities++;
        break;
      }
      case 'ellipse': {
        if (!visible) break;
        const cx = num(n.attrs.cx), cy = num(n.attrs.cy), rx = num(n.attrs.rx), ry = num(n.attrs.ry);
        const pts: [number, number][] = Array.from({ length: 36 }, (_, k) => [cx + rx * Math.cos((k * Math.PI) / 18), cy + ry * Math.sin((k * Math.PI) / 18)]);
        poly(pts, true);
        break;
      }
      case 'polyline': case 'polygon': {
        if (!visible) break;
        const v = (n.attrs.points ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
        const pts: [number, number][] = []; for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
        if (pts.length > 1) poly(pts, n.tag === 'polygon');
        break;
      }
      case 'path':
        if (!visible) break;
        for (const sp of flattenPath(n.attrs.d ?? '')) poly(sp.pts, sp.closed);
        break;
      case 'text': {
        const value = textOf(n).replace(/\s+/g, ' ').trim();
        if (!value) break;
        const x = num(n.attrs.x), y = num(n.attrs.y);
        const p = P(m, x, y);
        // SVG font-size is the em size; a DXF text height is the capital-letter height (Arial 0.716 em,
        // Courier New 0.571 em), so the text keeps the drawing's size and stays inside its cells.
        const height = s.size * scaleOf(m) * (s.mono ? CAP_MONO : CAP_SANS);
        // rotation: the direction of the baseline after the transform, in DXF (y up) degrees
        const [ax, ay] = apply(m, x + 1, y), [bx, by] = apply(m, x, y);
        const rotation = -(Math.atan2(ay - by, ax - bx) * 180) / Math.PI;
        const hz = s.anchor === 'middle' ? TextHorizontalAlignment.Center : s.anchor === 'end' ? TextHorizontalAlignment.Right : TextHorizontalAlignment.Left;
        const align = hz === TextHorizontalAlignment.Left ? {} : { horizontalAlignment: hz, verticalAlignment: TextVerticalAlignment.BaseLine, secondAlignmentPoint: p };
        const style = s.mono ? 'ISA_MONO' : s.bold ? 'ISA_SANS_BOLD' : 'ISA_SANS';
        const dev = s.cad !== 'BORDER' && deviceSheets.includes(s.sheet) ? devices.get(value) : undefined;
        if (s.cad === 'WIRENO') {
          const ins = dxf.addInsert('ISA_WIRENO', p, { layerName: 'WIRENO', rotationAngle: rotation });
          attribs(ins, [{ p, height, tag: 'WIRENO', value, style, options: { layerName: 'WIRENO', rotation, ...align } }]);
          stats.wireNumbers++; stats.entities++;
        } else if (dev) {
          const ins = dxf.addInsert('ISA_DEVICE', p, { layerName: 'TAGS', rotationAngle: rotation });
          attribs(ins, ([['TAG1', dev.tag, true], ['DESC1', dev.desc, false], ['MFG', dev.mfr, false], ['CAT', dev.part, false]] as const)
            .map(([tag, v, vis]) => ({ p, height, tag, value: v, style, options: { layerName: 'TAGS', rotation, visible: vis, ...align } })));
          stats.devices++; stats.entities++;
        } else {
          const t = dxf.addText(p, height, value, { layerName: s.cad === 'BORDER' ? 'BORDER' : 'TEXT', rotation, ...align });
          t.textStyle = style;
          stats.entities++;
        }
        return; // tspans are part of the text
      }
    }
    for (const c of n.children) walk(c, m, s);
  };
  sheets.forEach((svg, i) => {
    ox = (i % perRow) * cellW;
    oy = -Math.floor(i / perRow) * cellH;
    H = sizes[i].h;
    walk(svg, ID, { cad: 'GRAPHICS', sheet: '', stroke: 'none', fill: 'black', mono: false, bold: false, size: 2.5, anchor: 'start' });
  });
  return { dxf: dxf.stringify(), stats };
}
