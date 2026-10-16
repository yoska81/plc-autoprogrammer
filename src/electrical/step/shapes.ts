/**
 * Parametric 3D shapes of cabinet components for the STEP export.
 *
 * Every generator builds a recognisable multi-body model of one component inside its envelope,
 * in the component frame: X 0..w to the right, Y 0..d from the FRONT (y = 0) to the mounting
 * surface (y = d), Z 0..h up. The union of the solids fills the envelope exactly (some solid
 * touches each of the six envelope faces) so positions agree with the 2D layout; the caller
 * validates this and falls back to a plain box when a shape cannot be built for odd sizes.
 *
 * The shapes are generic, proportional models of the product families AutomationDirect sells
 * (miniature breakers, IEC contactors and overloads, RHINO supplies, CLICK PLC, DIN terminals,
 * DURApulse drives, open-core control transformers…), not manufacturer CAD models.
 */
import {
  ROT_EXTRUDE_Z, ROT_Y_TO_X, ROT_Y_TO_Z,
  type BoxFace, type BoxPocket, type EdgePocket, type PocketShape, type Rgb, type StepSolid, type V3,
} from './stepWriter';

// ---------------------------------------------------------------------------
// Colours (sRGB 0..1)
// ---------------------------------------------------------------------------

export const COL = {
  enclosure: [0.84, 0.85, 0.83] as Rgb,      // RAL 7035 light grey
  backPanel: [0.94, 0.94, 0.92] as Rgb,      // white powder-coated subpanel
  zinc: [0.76, 0.77, 0.79] as Rgb,           // zinc-plated steel (rails, studs, brackets)
  steel: [0.62, 0.63, 0.65] as Rgb,
  black: [0.11, 0.11, 0.12] as Rgb,
  charcoal: [0.20, 0.21, 0.23] as Rgb,
  darkGrey: [0.30, 0.31, 0.33] as Rgb,
  midGrey: [0.55, 0.56, 0.58] as Rgb,
  lightGrey: [0.80, 0.81, 0.82] as Rgb,
  moduleWhite: [0.90, 0.90, 0.88] as Rgb,    // DIN modular devices (breakers, fuse holders)
  plc: [0.86, 0.86, 0.83] as Rgb,            // CLICK housing
  safety: [0.95, 0.78, 0.08] as Rgb,
  terminalGrey: [0.60, 0.61, 0.63] as Rgb,
  terminalBlue: [0.16, 0.36, 0.75] as Rgb,
  groundGreen: [0.10, 0.58, 0.22] as Rgb,
  groundYellow: [0.96, 0.84, 0.10] as Rgb,
  marker: [0.97, 0.97, 0.95] as Rgb,
  duct: [0.60, 0.61, 0.63] as Rgb,
  ductCover: [0.66, 0.67, 0.69] as Rgb,
  tin: [0.80, 0.80, 0.78] as Rgb,
  copper: [0.78, 0.48, 0.24] as Rgb,
  aluminium: [0.73, 0.75, 0.77] as Rgb,
  laminations: [0.33, 0.34, 0.36] as Rgb,
  coilPrimary: [0.83, 0.64, 0.30] as Rgb,    // taped coil (amber)
  coilSecondary: [0.72, 0.50, 0.22] as Rgb,
  ledGreen: [0.15, 0.85, 0.30] as Rgb,
  ledAmber: [1.0, 0.65, 0.10] as Rgb,
  ledWindow: [0.12, 0.20, 0.16] as Rgb,
  display: [0.30, 0.04, 0.04] as Rgb,        // 7-segment LED display behind red filter
  screen: [0.05, 0.08, 0.13] as Rgb,         // HMI glass
  relayCube: [0.74, 0.82, 0.90] as Rgb,      // clear cover (opaque approximation)
  blueButton: [0.12, 0.32, 0.78] as Rgb,
  redButton: [0.80, 0.10, 0.08] as Rgb,
  gasket: [0.08, 0.08, 0.09] as Rgb,
};

// ---------------------------------------------------------------------------
// Solid helpers (component frame)
// ---------------------------------------------------------------------------

type Face = BoxFace;
/** Pocket on a box, in component coordinates (face axes: ±x -> (y, z), ±y -> (x, z), ±z -> (x, y)). */
export type CPocket = PocketShape & { face: Face; depth: number };

const faceAxes = (f: Face): [number, number] => (f[1] === 'x' ? [1, 2] : f[1] === 'y' ? [0, 2] : [0, 1]);

/** Box from (x0, y0, z0) to (x1, y1, z1) with pockets given in component coordinates. */
export function bx(name: string, color: Rgb, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pockets: CPocket[] = []): StepSolid {
  const o: V3 = [x0, y0, z0];
  const ps: BoxPocket[] = pockets.map((p) => {
    const [ia, ib] = faceAxes(p.face);
    return p.kind === 'circle'
      ? { face: p.face, depth: p.depth, kind: 'circle', a: p.a - o[ia], b: p.b - o[ib], r: p.r }
      : { face: p.face, depth: p.depth, kind: 'rect', a0: p.a0 - o[ia], b0: p.b0 - o[ib], a1: p.a1 - o[ia], b1: p.b1 - o[ib] };
  });
  return { name, color, at: o, geom: { type: 'box', w: x1 - x0, d: y1 - y0, h: z1 - z0, pockets: ps.length ? ps : undefined } };
}

const circ = (face: Face, a: number, b: number, r: number, depth: number): CPocket => ({ face, kind: 'circle', a, b, r, depth });
const rect = (face: Face, a0: number, b0: number, a1: number, b1: number, depth: number): CPocket => ({ face, kind: 'rect', a0, b0, a1, b1, depth });

/** Pocket on an extrusion side face, located by its centre (y, z) on the profile edge. */
export interface PPocket { x: number; y: number; z: number; depth: number; r?: number; dx?: number; ds?: number }

function findEdge(poly: [number, number][], y: number, z: number): { i: number; s: number } | null {
  for (let i = 0; i < poly.length; i++) {
    const [y0, z0] = poly[i], [y1, z1] = poly[(i + 1) % poly.length];
    const ey = y1 - y0, ez = z1 - z0, L = Math.hypot(ey, ez);
    const s = ((y - y0) * ey + (z - z0) * ez) / L;
    const dist = Math.abs((y - y0) * ez - (z - z0) * ey) / L;
    if (dist < 1e-6 && s > 0 && s < L) return { i, s };
  }
  return null;
}

/** Polygon in (y, z) extruded along X from x0 to x1, with pockets on its side faces. */
export function px(name: string, color: Rgb, x0: number, x1: number, poly: [number, number][], pockets: PPocket[] = []): StepSolid {
  const ps: EdgePocket[] = [];
  for (const p of pockets) {
    const e = findEdge(poly, p.y, p.z);
    if (!e) throw new Error(`STEP shape ${name}: pocket centre (${p.y}, ${p.z}) is not on the profile`);
    const a = p.x - x0;
    ps.push(p.r !== undefined
      ? { edge: e.i, depth: p.depth, kind: 'circle', a, b: e.s, r: p.r }
      : { edge: e.i, depth: p.depth, kind: 'rect', a0: a - p.dx!, b0: e.s - p.ds!, a1: a + p.dx!, b1: e.s + p.ds! });
  }
  return { name, color, at: [x0, 0, 0], geom: { type: 'extrudeX', length: x1 - x0, poly, pockets: ps.length ? ps : undefined } };
}

/** Coaxial round stack along +Y at (cx, cz); sections as [diameter, y0, y1]. */
export function cylY(name: string, color: Rgb, cx: number, cz: number, secs: [number, number, number][]): StepSolid {
  return { name, color, at: [cx, 0, cz], geom: { type: 'stack', profile: 'circle', sections: secs.map(([w, y0, y1]) => ({ w, h: 0, y0, y1 })) } };
}
/** Round bar along +Z at (cx, cy) from z0 to z1. */
export function cylZ(name: string, color: Rgb, cx: number, cy: number, z0: number, z1: number, dia: number): StepSolid {
  return { name, color, at: [cx, cy, 0], rot: ROT_Y_TO_Z, geom: { type: 'stack', profile: 'circle', sections: [{ w: dia, h: 0, y0: z0, y1: z1 }] } };
}
/** Round bar along +X at (cy, cz) from x0 to x1. */
export function cylX(name: string, color: Rgb, cy: number, cz: number, x0: number, x1: number, dia: number): StepSolid {
  return { name, color, at: [0, cy, cz], rot: ROT_Y_TO_X, geom: { type: 'stack', profile: 'circle', sections: [{ w: dia, h: 0, y0: x0, y1: x1 }] } };
}
/** Polygon in (x, y) extruded along +Z from z0 to z1. */
export function pz(name: string, color: Rgb, z0: number, z1: number, poly: [number, number][]): StepSolid {
  return { name, color, at: [0, 0, z0], rot: ROT_EXTRUDE_Z, geom: { type: 'extrudeX', length: z1 - z0, poly } };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Side profile of a DIN modular device: full-height base from ys to d, front hump z0..z1 from yh to ys. */
function stepped(d: number, h: number, ys: number, yh: number, z0: number, z1: number): [number, number][] {
  return [[d, 0], [d, h], [ys, h], [ys, z1], [yh, z1], [yh, z0], [ys, z0], [ys, 0]];
}

/** Evenly spaced centres across 0..w. */
const spread = (n: number, w: number, x0 = 0) => Array.from({ length: n }, (_, i) => x0 + (w * (i + 0.5)) / n);

/** Shoulder screws (front-facing) and top/bottom wire entries for each pole of a stepped body. */
function poleTerminals(xs: number[], pitch: number, d: number, h: number, ys: number, z0: number, z1: number, opts: { top?: boolean; bottom?: boolean; entries?: boolean } = {}): PPocket[] {
  const out: PPocket[] = [];
  const room = (d - ys);
  for (const x of xs) {
    for (const top of [true, false]) {
      if (top ? opts.top === false : opts.bottom === false) continue;
      const band = top ? h - z1 : z0;
      const zc = top ? (z1 + h) / 2 : z0 / 2;
      const r = Math.min(2.8, pitch * 0.2, band / 2 - 1.2);
      if (r > 0.6) out.push({ x, y: ys, z: zc, r, depth: Math.min(3, room * 0.15) });
      if (opts.entries !== false && room > 16 && band > 6) {
        const ds = Math.min(3.2, room * 0.12);
        out.push({ x, y: ys + 3.6 + ds, z: top ? h : 0, dx: Math.min(3.5, pitch * 0.3), ds, depth: Math.min(8, band * 0.7) });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Component generators
// ---------------------------------------------------------------------------

export interface ShapeInput {
  w: number;
  d: number;
  h: number;
  /** Lower-cased catalog description + function, for detecting variants. */
  text: string;
  ratings: Record<string, string | number>;
  /** Main housing colour override. */
  color?: Rgb;
}

const poleCount = (s: ShapeInput, perPole: number, max = 4) => {
  const p = Number(s.ratings.poles);
  return clamp(Number.isFinite(p) && p > 0 ? Math.round(p) : Math.round(s.w / perPole), 1, max);
};

/** Miniature circuit breaker / supplementary protector: stepped body per pole, toggle lever, screws, clip slot. */
export function breakerShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const poles = poleCount(s, 18);
  const pw = w / poles;
  const yh = clamp(d * 0.1, 3, 9);
  const humpH = h >= 80 ? 45 : h * 0.5;
  const z0 = (h - humpH) / 2, z1 = z0 + humpH;
  const ys = yh + clamp((d - yh) * 0.22, 6, 18);
  const poly = stepped(d, h, ys, yh, z0, z1);
  const xs = spread(poles, w);
  const pk = poleTerminals(xs, pw, d, h, ys, z0, z1);
  for (const x of xs) {
    pk.push({ x, y: d - 6, z: 0, dx: Math.min(2, pw * 0.15), ds: 2.4, depth: Math.min(3, z0 * 0.5) }); // DIN clip slot
    pk.push({ x, y: yh, z: z0 + humpH * 0.2, dx: Math.min(2.5, pw * 0.2), ds: Math.min(2.5, humpH * 0.06), depth: 1 }); // trip indicator window
  }
  const leverH = Math.min(12, humpH * 0.28);
  return [
    px('housing', s.color ?? COL.moduleWhite, 0, w, poly, pk),
    bx('toggle', COL.black, poles > 1 ? pw * 0.3 : pw * 0.28, 0, h / 2 + 1, poles > 1 ? w - pw * 0.3 : w - pw * 0.28, yh, h / 2 + 1 + leverH),
  ];
}

/** DIN fuse holder: modular base per pole with a hinged fuse carrier in front. */
export function fuseHolderShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const poles = poleCount(s, 18);
  const pw = w / poles;
  const humpH = h >= 80 ? 45 : h * 0.5;
  const z0 = (h - humpH) / 2, z1 = z0 + humpH;
  const ys = clamp(d * 0.35, 10, 30);
  const yb = ys - 2;
  const xs = spread(poles, w);
  const out: StepSolid[] = [px('base', s.color ?? COL.moduleWhite, 0, w, stepped(d, h, ys, yb, z0, z1), poleTerminals(xs, pw, d, h, ys, z0, z1))];
  xs.forEach((x, i) => {
    const gx = Math.min(pw * 0.25, 3);
    out.push(bx(`fuse carrier ${i + 1}`, COL.charcoal, x - pw / 2 + 0.5, 0, z0 + 0.5, x + pw / 2 - 0.5, yb, z1 - 0.5,
      [rect('-y', x - gx, z1 - humpH * 0.25, x + gx, z1 - humpH * 0.1, Math.min(2, yb * 0.3))]));
  });
  return out;
}

/** Manual motor protector (rotary): stepped body, rotary knob with pointer, current-setting dial. */
export function motorProtectorShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const poles = 3;
  const yh = clamp(d * 0.16, 5, 16);
  const humpH = h >= 80 ? 45 : h * 0.5;
  const z0 = (h - humpH) / 2, z1 = z0 + humpH;
  const ys = yh + clamp((d - yh) * 0.22, 6, 18);
  const xs = spread(poles, w);
  const knobD = Math.min(w * 0.7, humpH * 0.62, 32);
  const kz = h / 2 - humpH * 0.08;
  const dialD = Math.min(7, w * 0.15);
  return [
    px('housing', s.color ?? COL.darkGrey, 0, w, stepped(d, h, ys, yh, z0, z1), poleTerminals(xs, w / poles, d, h, ys, z0, z1)),
    cylY('rotary knob', COL.black, w / 2, kz, [[knobD * 0.8, 1.5, yh * 0.45], [knobD, yh * 0.45, yh]]),
    bx('knob pointer', COL.marker, w / 2 - knobD * 0.32, 0, kz - 1.4, w / 2 + knobD * 0.32, 1.5, kz + 1.4),
    cylY('current setting dial', COL.blueButton, w / 2, Math.min(z1 - dialD / 2 - 1.5, kz + knobD / 2 + dialD / 2 + 2), [[dialD, yh - 2, yh]]),
  ];
}

/** IEC contactor: stepped body, front contact carrier in its window, coil terminal block, pole screws. */
export function contactorShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const yf = clamp(d * 0.05, 2, 5);
  const fz0 = h * 0.17, fz1 = h * 0.83;
  const ys = yf + clamp((d - yf) * 0.3, 8, 26);
  const xs = spread(3, w);
  const pk = poleTerminals(xs, w / 3, d, h, ys, fz0, fz1);
  const cw = w * 0.2, ch = h * 0.11, cd = Math.min(3.5, (ys - yf) * 0.4);
  pk.push({ x: w / 2, y: yf, z: h / 2, dx: cw, ds: ch, depth: cd }); // carrier window
  const band = h - fz1;
  const screwR = Math.min(2.8, (w / 3) * 0.2, band / 2 - 1.2);
  const coilH = clamp(band / 2 - screwR - 0.6, 1, 3.5);
  const out: StepSolid[] = [
    px('housing', s.color ?? COL.lightGrey, 0, w, stepped(d, h, ys, yf, fz0, fz1), pk),
    bx('contact carrier', COL.charcoal, w / 2 - cw + 0.5, 0, h / 2 - ch + 0.5, w / 2 + cw - 0.5, yf + cd, h / 2 + ch - 0.5),
  ];
  if (coilH > 1.2 && ys - yf > 5) {
    const r = Math.min(1, coilH * 0.3);
    out.push(bx('coil terminals A1 A2', COL.darkGrey, w * 0.6, yf + 2, fz1, w * 0.95, ys, fz1 + coilH,
      [circ('-y', w * 0.68, fz1 + coilH / 2, r, 1), circ('-y', w * 0.87, fz1 + coilH / 2, r, 1)]));
  }
  return out;
}

/** Thermal overload relay: body with load-side screws, current dial, reset and test buttons. */
export function overloadShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const yf = clamp(d * 0.05, 2, 5);
  const fz0 = h * 0.3;
  const ys = yf + clamp((d - yf) * 0.3, 8, 26);
  const poly: [number, number][] = [[d, 0], [d, h], [yf, h], [yf, fz0], [ys, fz0], [ys, 0]];
  const xs = spread(3, w);
  const pk = poleTerminals(xs, w / 3, d, h, ys, fz0, h, { top: false });
  const zc = fz0 + (h - fz0) * 0.55;
  const dialD = Math.min(12, w * 0.28, (h - fz0) * 0.45);
  const btnD = Math.min(8, w * 0.18, (h - fz0) * 0.35);
  const tz = fz0 + (h - fz0) * 0.15;
  return [
    px('housing', s.color ?? COL.lightGrey, 0, w, poly, pk),
    cylY('current dial', COL.marker, w * 0.3, zc, [[dialD, 0, yf]]),
    cylY('reset button', COL.blueButton, w * 0.72, zc, [[btnD, 0, yf]]),
    bx('test button', COL.redButton, w * 0.72 - 2, 0, Math.max(fz0 + 0.5, tz - 1.5), w * 0.72 + 2, yf, Math.max(fz0 + 0.5, tz - 1.5) + 3),
  ];
}

/** DIN-rail power supply: housing with vent slots, input and output terminal rows, LED and voltage pot. */
export function powerSupplyShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const threePhase = /3-?\s?phase|3-ph|3ph/.test(s.text) || Number(s.ratings.phases) === 3;
  const ys = clamp(d * 0.16, 8, 22);
  const ft0 = h * 0.17, ft1 = h * 0.83;
  const tD = ys * 0.75, tH = (h - ft1) * 0.6;
  const nIn = threePhase ? 4 : 3, nOut = w >= 60 ? 6 : 4;
  const pk: PPocket[] = [];
  // Vent slots on top and bottom of the housing.
  const nv = Math.max(2, Math.floor((w - 6) / 5));
  for (const x of spread(nv, w - 6, 3)) for (const z of [0, h]) pk.push({ x, y: ys + (d - ys) * 0.55, z, dx: 1.1, ds: (d - ys) * 0.28, depth: 2 });
  // LED and output-voltage pot sunk into the front.
  const fz = ft1 - Math.min(10, (ft1 - ft0) * 0.12);
  pk.push({ x: w * 0.72, y: 0, z: fz, dx: 1.6, ds: 1.2, depth: 1 }, { x: w * 0.3, y: 0, z: fz, r: 2.5, depth: 1.5 });
  const out: StepSolid[] = [px('housing', s.color ?? COL.lightGrey, 0, w, stepped(d, h, ys, 0, ft0, ft1), pk)];
  const row = (name: string, n: number, zb: number, zt: number, top: boolean) => {
    const pitch = (w - 2) / n;
    const r = Math.min(2.2, pitch * 0.3, (zt - zb) * 0.3);
    const ds = tD * 0.22;
    const ps: CPocket[] = [];
    for (const x of spread(n, w - 2, 1)) {
      ps.push(circ('-y', x, (zb + zt) / 2, r, Math.min(2.5, tD * 0.3)));
      ps.push(rect(top ? '+z' : '-z', x - pitch * 0.3, ys - tD * 0.42 - ds, x + pitch * 0.3, ys - tD * 0.42 + ds, Math.min(3, (zt - zb) * 0.45)));
    }
    out.push(bx(name, COL.charcoal, 1, ys - tD, zb, w - 1, ys, zt, ps));
  };
  row('output terminals', nOut, ft1, ft1 + tH, true);
  row('input terminals', nIn, ft0 - tH, ft0, false);
  out.push(bx('DC OK LED', COL.ledGreen, w * 0.72 - 1.4, 0.2, fz - 1, w * 0.72 + 1.4, 1, fz + 1));
  out.push(cylY('voltage adjust pot', COL.marker, w * 0.3, fz, [[3.6, 0.3, 1.5]]));
  return out;
}

/** PLC CPU or I/O module: housing with vents, LED window, removable front terminal block; RJ45/RJ12 on the CPU. */
export function plcShape(s: ShapeInput, cpu: boolean): StepSolid[] {
  const { w, d, h } = s;
  const tbD = clamp(d * 0.16, 5, 12);
  const pk: CPocket[] = [];
  const nv = Math.max(2, Math.floor((w - 4) / 4));
  for (const x of spread(nv, w - 4, 2)) pk.push(rect('+z', x - 0.8, tbD + (d - tbD) * 0.25, x + 0.8, tbD + (d - tbD) * 0.7, 1.5));
  const led = cpu ? [w * 0.08, h * 0.74, w * 0.45, h * 0.92] : [w * 0.15, h * 0.76, w * 0.85, h * 0.94];
  pk.push(rect('-y', led[0], led[1], led[2], led[3], 1.5));
  const deep = Math.min(12, (d - tbD) * 0.3);
  if (cpu) {
    const jw = Math.min(14, w * 0.36);
    pk.push(rect('-y', w * 0.07, h * 0.28, w * 0.07 + jw, h * 0.28 + Math.min(12, h * 0.13), deep));          // Ethernet RJ45
    pk.push(rect('-y', w * 0.07, h * 0.5, w * 0.07 + jw * 0.72, h * 0.5 + Math.min(8, h * 0.09), deep * 0.7)); // RS-232 RJ12
  }
  const out: StepSolid[] = [
    bx('housing', s.color ?? COL.plc, 0, tbD, 0, w, d, h, pk),
    bx('LED window', COL.ledWindow, led[0] + 0.2, tbD + 0.4, led[1] + 0.2, led[2] - 0.2, tbD + 1.5, led[3] - 0.2),
  ];
  // Removable terminal block with a chamfered front and one or two screw columns.
  const x0 = cpu ? w * 0.52 : 1.2, x1 = w - 1.2;
  const z0 = h * 0.08, z1 = h * 0.68;
  const c = Math.min(1.5, tbD * 0.2);
  const poly: [number, number][] = [[tbD, z0], [tbD, z1], [c, z1], [0, z1 - c], [0, z0 + c], [c, z0]];
  const pitch = 5;
  const n = Math.max(1, Math.floor((z1 - z0 - 2 * c - 2) / pitch));
  const cols = x1 - x0 >= 20 ? [x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7] : [(x0 + x1) / 2];
  const r = Math.min(1.6, pitch * 0.3, ((x1 - x0) / cols.length) * 0.3);
  const tp: PPocket[] = [];
  for (const x of cols) for (const z of spread(n, z1 - z0 - 2 * c - 2, z0 + c + 1)) tp.push({ x, y: 0, z, r, depth: Math.min(2.5, tbD * 0.4) });
  out.push(px('removable terminal block', COL.charcoal, x0, x1, poly, tp));
  return out;
}

/** Terminal strip slice layout: what sits at each X position along the strip. */
export type StripPiece = { kind: 'terminal'; w: number; ground: boolean; color: Rgb } | { kind: 'endPlate'; w: number; color: Rgb } | { kind: 'endStop'; w: number };

/** Terminal strip: individual feed-through slices with screw and wire entries, markers, end plates and end stops. */
export function terminalStripShape(s: ShapeInput, pieces: StripPiece[], detail: boolean): StepSolid[] {
  const { d, h } = s;
  const yS = d * 0.47, sH = h * 0.24, yR = d * 0.25, zr1 = h / 2 + h * 0.14, zr0 = h / 2 - h * 0.14, yM = Math.min(0.8, d * 0.03);
  const prof: [number, number][] = [[d, 0], [d, h], [yS, h], [yS, h - sH], [yR, zr1], [yM, zr1], [yM, zr0], [yR, zr0], [yS, sH], [yS, 0]];
  const out: StepSolid[] = [];
  let x = 0, k = 0;
  for (const p of pieces) {
    const x0 = x, x1 = x + p.w;
    x = x1;
    if (p.kind === 'endStop') {
      const sy = d * 0.3;
      const poly: [number, number][] = [[d, h * 0.06], [d, h * 0.9], [d * 0.48, h * 0.9], [sy, h * 0.68], [sy, h * 0.32], [d * 0.48, h * 0.06]];
      out.push(px('end stop', COL.charcoal, x0, x1, poly, [{ x: (x0 + x1) / 2, y: sy, z: h / 2, r: Math.min(2.4, p.w * 0.3), depth: 2 }]));
      continue;
    }
    if (p.kind === 'endPlate') { out.push(px('end plate', p.color, x0, x1, prof)); continue; }
    k++;
    const tw = p.w;
    const pk: PPocket[] = [];
    if (detail && tw >= 3) {
      const r = Math.min(1.9, tw * 0.32, sH * 0.3);
      const dx = Math.min(tw * 0.3, 2.2);
      const ds = Math.min(3, (d - yS) * 0.18);
      const xc = (x0 + x1) / 2;
      for (const top of [true, false]) {
        pk.push({ x: xc, y: yS, z: top ? h - sH / 2 : sH / 2, r, depth: 1.5 });
        pk.push({ x: xc, y: yS + 2 + ds, z: top ? h : 0, dx, ds, depth: Math.min(8, sH * 0.65) });
      }
    }
    out.push(px(`terminal ${k}`, p.color, x0, x1, prof, pk));
    if (detail && tw >= 2) out.push(bx(`marker ${k}`, p.ground ? COL.groundYellow : COL.marker, x0 + Math.min(0.4, tw * 0.1), 0, zr0 + 1, x1 - Math.min(0.4, tw * 0.1), yM, zr1 - 1));
  }
  return out;
}

/** Relay: plug-in cube relay on its socket, socket alone, or slim interface relay. */
export function relayShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const socket = /socket/.test(s.text) && !/relay,|relay with/.test(s.text);
  const cube = /cube|plug-?in/.test(s.text);
  if (!socket && !cube) {
    // Slim / force-guided relay: modular body with LED and terminals.
    const yh = clamp(d * 0.04, 1, 3);
    const z0 = h * 0.2, z1 = h * 0.8;
    const ys = yh + clamp((d - yh) * 0.25, 6, 20);
    const xs = spread(w >= 14 ? 2 : 1, w);
    const out = [px('housing', s.color ?? COL.charcoal, 0, w, stepped(d, h, ys, yh, z0, z1), poleTerminals(xs, w / xs.length, d, h, ys, z0, z1))];
    out.push(bx('status LED', COL.ledAmber, w / 2 - Math.min(1.5, w * 0.2), 0, z1 - 6, w / 2 + Math.min(1.5, w * 0.2), yh, z1 - 3.5));
    return out;
  }
  const z0 = h * 0.2, z1 = h * 0.8;
  const ys = d * (socket ? 0.35 : 0.62);
  const yr = socket ? 0 : d * 0.55;
  const xs = spread(2, w);
  const pk = poleTerminals(xs, w / 2, d, h, ys, z0, z1, { entries: false });
  if (socket) {
    // Pin slots of the receptacle.
    for (const x of spread(2, w * 0.6, w * 0.2)) for (const z of spread(4, (z1 - z0) * 0.7, z0 + (z1 - z0) * 0.15)) pk.push({ x, y: 0, z, dx: Math.min(1.2, w * 0.06), ds: 0.8, depth: Math.min(3, ys * 0.3) });
  }
  const out: StepSolid[] = [px(socket ? 'relay socket' : 'socket', COL.charcoal, 0, w, stepped(d, h, ys, yr, z0, z1), pk)];
  if (!socket) {
    out.push(bx('relay cover', COL.relayCube, w * 0.06, 1.2, z0 + 1, w * 0.94, yr, z1 - 1));
    out.push(bx('push-to-test button', COL.ledAmber, w * 0.4, 0, z1 - 9, w * 0.6, 1.2, z1 - 5));
  }
  return out;
}

/** Safety relay: housing with plug-in terminal blocks top and bottom, status LEDs. */
export function safetyRelayShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const ys = clamp(d * 0.12, 6, 14);
  const z0 = h * 0.17, z1 = h * 0.83;
  const n = Math.max(2, Math.floor(w / 7));
  const pitch = (w - 1.2) / n;
  const pk: PPocket[] = [];
  const leds = [0.62, 0.7, 0.78].map((f) => z0 + (z1 - z0) * f);
  for (const z of leds) pk.push({ x: w * 0.3, y: 0, z, dx: Math.min(1.2, w * 0.08), ds: 0.9, depth: 1 });
  const out: StepSolid[] = [px('housing', s.color ?? COL.safety, 0, w, stepped(d, h, ys, 0, z0, z1), pk)];
  leds.forEach((z, i) => out.push(bx(`LED ${i + 1}`, i === 0 ? COL.ledGreen : COL.ledAmber, w * 0.3 - Math.min(1.2, w * 0.08) + 0.2, 0.2, z - 0.7, w * 0.3 + Math.min(1.2, w * 0.08) - 0.2, 1, z + 0.7)));
  const tD = ys * 0.6;
  for (const top of [true, false]) {
    const zb = top ? z1 : 1, zt = top ? h - 1 : z0;
    const r = Math.min(1.6, pitch * 0.3, (zt - zb) * 0.25);
    const ps: CPocket[] = [];
    for (const x of spread(n, w - 1.2, 0.6)) {
      ps.push(circ('-y', x, (zb + zt) / 2, r, Math.min(2, tD * 0.4)));
      ps.push(rect(top ? '+z' : '-z', x - pitch * 0.28, ys - tD * 0.55, x + pitch * 0.28, ys - tD * 0.2, Math.min(3, (zt - zb) * 0.4)));
    }
    out.push(bx(top ? 'terminal block (top)' : 'terminal block (bottom)', COL.charcoal, 0.6, ys - tD, zb, w - 0.6, ys, zt, ps));
  }
  return out;
}

/** AC drive: plastic front housing with keypad, display and vents; finned aluminium heat sink at the back. */
export function vfdShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const split = d * 0.55;
  const kp = [w * 0.15, h * 0.55, w * 0.85, h * 0.9];
  const kd = Math.min(3, split * 0.25);
  const pk: CPocket[] = [rect('-y', kp[0], kp[1], kp[2], kp[3], kd)];
  for (let i = 0; i < 5; i++) {
    const z = h * 0.08 + i * 3.6;
    if (z + 1.6 < kp[1] - 2) pk.push(rect('-y', w * 0.22, z, w * 0.78, z + 1.6, 2));
  }
  const nv = Math.max(2, Math.floor((w - 8) / 5));
  for (const x of spread(nv, w - 8, 4)) pk.push(rect('+z', x - 1, split * 0.2, x + 1, split * 0.8, 2));
  const out: StepSolid[] = [bx('housing', s.color ?? COL.charcoal, 0, 0, 0, w, split, h, pk)];
  // Keypad sunk into the front, with display and keys.
  const kx0 = kp[0] + 0.3, kx1 = kp[2] - 0.3, kz0 = kp[1] + 0.3, kz1 = kp[3] - 0.3, ky0 = 0.5;
  const kw = kx1 - kx0, kh = kz1 - kz0;
  const disp = [kx0 + kw * 0.12, kz1 - kh * 0.4, kx1 - kw * 0.12, kz1 - kh * 0.1];
  const kpk: CPocket[] = [rect('-y', disp[0], disp[1], disp[2], disp[3], 1)];
  const br = Math.min(3, kw * 0.06, kh * 0.08);
  for (const z of [kz0 + kh * 0.2, kz0 + kh * 0.42]) for (const x of spread(3, kw * 0.8, kx0 + kw * 0.1)) kpk.push(circ('-y', x, z, br, 0.8));
  out.push(bx('keypad', COL.black, kx0, ky0, kz0, kx1, kd, kz1, kpk));
  out.push(bx('display', COL.display, disp[0] + 0.2, ky0 + 0.3, disp[1] + 0.2, disp[2] - 0.2, ky0 + 1, disp[3] - 0.2));
  // Heat sink: base plate + vertical fins, one extrusion along Z.
  const bt = (d - split) * 0.2, ft = 1.8;
  const nf = Math.max(2, Math.floor((w - ft) / 5.5) + 1);
  const sp = (w - ft) / (nf - 1);
  const poly: [number, number][] = [[0, split], [w, split]];
  for (let i = nf - 1; i >= 0; i--) {
    const a = i * sp, b = i === nf - 1 ? w : a + ft;
    if (i < nf - 1) poly.push([b, split + bt]);
    poly.push([b, d], [a, d]);
    if (i > 0) poly.push([a, split + bt]);
  }
  out.push(pz('heat sink', COL.aluminium, 0, h, poly));
  return out;
}

/** Open-core control transformer: L-brackets, laminated E-I core, two coil bobbins, terminal strip. */
export function transformerShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const out: StepSolid[] = [];
  const bt = Math.min(2, h * 0.04);            // bracket sheet thickness
  const yt = clamp(d * 0.08, 4, 10);           // terminal strip depth
  const ya = yt + (d - yt) * 0.25, yb = d - (d - yt) * 0.22; // core stack
  const yoke = (h - 2 * bt) * 0.18;
  const zw0 = bt + yoke, zw1 = h - bt - yoke;  // window height
  const hf = Math.min(h * 0.12, zw0 - bt - 1);
  // L-brackets top and bottom (mounting foot against the panel).
  for (const top of [true, false]) {
    const Z = (z: number) => (top ? h - z : z);
    const poly: [number, number][] = [[ya, Z(0)], [d, Z(0)], [d, Z(hf)], [d - 2.5, Z(hf)], [d - 2.5, Z(bt)], [ya, Z(bt)]];
    const pk = spread(2, w * 0.7, w * 0.15).map((x) => ({ x, y: (ya + d - 2.5) / 2 + (d - 2.5 - ya) * 0.2, z: Z(0), dx: Math.min(4, w * 0.06), ds: Math.min(2, (d - ya) * 0.08), depth: bt * 0.6 }));
    out.push(px(top ? 'mounting bracket (top)' : 'mounting bracket (bottom)', COL.zinc, 0, w, top ? poly.slice().reverse() : poly, pk));
  }
  // Laminated core: thin E-I plates with two windows each.
  const cw = w * 0.3, ol = w * 0.16;
  const n = 6, gap = 0.3;
  const tp = ((yb - ya) - (n - 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const y0 = ya + i * (tp + gap);
    out.push({
      name: `lamination ${i + 1}`, color: COL.laminations, at: [0, y0, bt],
      geom: { type: 'plate', w, h: h - 2 * bt, t: tp, holes: [
        { kind: 'rect', x0: ol, z0: yoke, x1: (w - cw) / 2, z1: h - 2 * bt - yoke },
        { kind: 'rect', x0: (w + cw) / 2, z0: yoke, x1: w - ol, z1: h - 2 * bt - yoke },
      ] },
    });
  }
  // Coils: rectangular tubes around the centre leg (axis Z), primary above secondary.
  const cx0 = ol + 0.5, cx1 = w - ol - 0.5, cy0 = yt, cy1 = d - 3;
  const hx0 = (w - cw) / 2 - 0.5, hx1 = (w + cw) / 2 + 0.5, hy0 = ya - 0.5, hy1 = yb + 0.5;
  const zm = (zw0 + zw1) / 2;
  for (const [name, color, z0, z1] of [['secondary coil', COL.coilSecondary, zw0 + 0.5, zm - 0.5], ['primary coil', COL.coilPrimary, zm + 0.5, zw1 - 0.5]] as const) {
    // Plate local (x, t, z) -> part (x, z, -y): thickness along Z, height along -Y.
    out.push({
      name, color, at: [cx0, cy1, z0], rot: ROT_Y_TO_Z,
      geom: { type: 'plate', w: cx1 - cx0, t: z1 - z0, h: cy1 - cy0, holes: [{ kind: 'rect', x0: hx0 - cx0, z0: cy1 - hy1, x1: hx1 - cx0, z1: cy1 - hy0 }] },
    });
  }
  // Terminal strip on the front of the coils (H1..H4, X1, X2).
  const sx0 = cx0 + 1, sx1 = cx1 - 1, sz0 = zm - Math.min(7, (zw1 - zw0) * 0.25), sz1 = zm + Math.min(7, (zw1 - zw0) * 0.25);
  const nt = 6;
  const r = Math.min(2, ((sx1 - sx0) / nt) * 0.3, (sz1 - sz0) * 0.25);
  out.push(bx('terminal strip', COL.black, sx0, 0, sz0, sx1, yt, sz1, spread(nt, sx1 - sx0, sx0).map((x) => circ('-y', x, (sz0 + sz1) / 2, r, Math.min(2, yt * 0.4)))));
  return out;
}

/** Rotary disconnect switch body: stepped body, shaft coupling and position window. */
export function disconnectShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const yh = clamp(d * 0.12, 5, 12);
  const z0 = h * 0.22, z1 = h * 0.78;
  const ys = yh + clamp((d - yh) * 0.25, 8, 22);
  const xs = spread(3, w);
  const pk = poleTerminals(xs, w / 3, d, h, ys, z0, z1);
  const cd = Math.min(24, w * 0.45, (z1 - z0) * 0.5);
  pk.push({ x: w / 2, y: yh, z: z1 - (z1 - z0) * 0.1, dx: Math.min(4, w * 0.1), ds: Math.min(2, (z1 - z0) * 0.04), depth: 1 });
  return [
    px('switch body', s.color ?? COL.darkGrey, 0, w, stepped(d, h, ys, yh, z0, z1), pk),
    cylY('shaft coupling', COL.black, w / 2, h / 2, [[cd, yh * 0.35, yh]]),
    bx('shaft drive', COL.redButton, w / 2 - 3.5, 0, h / 2 - 3.5, w / 2 + 3.5, yh * 0.35, h / 2 + 3.5),
  ];
}

/** Ground (PE) bar: tin-plated or copper bar with screws in tapped holes, on two standoffs. */
export function groundBarShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const y0 = Math.min(2.5, d * 0.15);
  const bt = Math.min(6.35, (d - y0) * 0.4);
  const m = /\((\d+)\)\s*#?\s*[\d/-]*\s*(?:tapped|terminal|hole)/.exec(s.text) ?? /(\d+)\s*(?:terminals|holes|positions)/.exec(s.text);
  const mEnd = Math.min(12, w * 0.12);
  let n = Number(s.ratings.terminals ?? s.ratings.holes) || (m ? parseInt(m[1], 10) : Math.floor((w - 2 * mEnd) / 9) + 1);
  n = clamp(n, 1, Math.max(1, Math.floor((w - 2 * mEnd) / 6) + 1));
  const pitch = n > 1 ? (w - 2 * mEnd - 6) / (n - 1) : 0;
  const xs = Array.from({ length: n }, (_, i) => (n > 1 ? mEnd + 3 + i * pitch : w / 2));
  const hr = Math.min(2.4, h * 0.15, n > 1 ? pitch * 0.3 : 2.4);
  const head = Math.min(7.5, h * 0.6, n > 1 ? pitch - 1 : 7.5);
  const bar = /copper/.test(s.text) && !/tin/.test(s.text) ? COL.copper : COL.tin;
  const pk: CPocket[] = xs.map((x) => circ('-y', x, h / 2, hr, bt * 0.8));
  const mr = Math.min(3.5, mEnd * 0.3, h * 0.2);
  if (mEnd > 2 * mr + 1) pk.push(circ('-y', mEnd / 2, h / 2, mr, bt * 0.8), circ('-y', w - mEnd / 2, h / 2, mr, bt * 0.8));
  const out: StepSolid[] = [bx('bar', bar, 0, y0, 0, w, y0 + bt, h, pk)];
  if (head > hr * 2 + 0.4) xs.forEach((x, i) => out.push(cylY(`screw ${i + 1}`, COL.zinc, x, h / 2, [[head, 0, y0], [hr * 2 - 0.4, y0, y0 + bt * 0.7]])));
  else out[0] = bx('bar', bar, 0, 0, 0, w, y0 + bt, h);
  const sw = Math.min(12, w * 0.12);
  out.push(bx('standoff', COL.zinc, 1, y0 + bt, h * 0.15, 1 + sw, d, h * 0.85), bx('standoff', COL.zinc, w - 1 - sw, y0 + bt, h * 0.15, w - 1, d, h * 0.85));
  return out;
}

/** Generic DIN-rail device: stepped housing with terminals. */
export function genericShape(s: ShapeInput): StepSolid[] {
  const { w, d, h } = s;
  const yh = 0;
  const z0 = h * 0.2, z1 = h * 0.8;
  const ys = clamp(d * 0.25, 6, 25);
  const n = clamp(Math.round(w / 12), 1, 6);
  return [px('housing', s.color ?? COL.darkGrey, 0, w, stepped(d, h, ys, yh, z0, z1), poleTerminals(spread(n, w), w / n, d, h, ys, z0, z1))];
}

// ---------------------------------------------------------------------------
// Wire duct and DIN rail
// ---------------------------------------------------------------------------

/** Slotted wire duct run: base, two comb side walls with finger slots, snap-on cover (cover at y = 0). */
export function ductShape(w: number, d: number, h: number, horizontal: boolean, color: Rgb): StepSolid[] {
  const t = 2, cT = 2.5;
  const L = horizontal ? w : h;      // run length
  const slotDepth = (d - cT) * 0.68;
  const yb = cT + slotDepth;
  const sw = 6, fw = 8, p = sw + fw;
  const n = L > 3 * p ? Math.floor((L - fw) / p) : 0;
  const off = (L - (n * p + fw)) / 2;
  // Comb polygon in (along-run, y): spine at the back, fingers towards the cover.
  const comb: [number, number][] = [[0, d], [0, cT]];
  for (let k = 0; k < n; k++) {
    const a = off + fw + k * p;
    comb.push([a, cT], [a, yb], [a + sw, yb], [a + sw, cT]);
  }
  comb.push([L, cT], [L, d]);
  const cover = color === COL.duct ? COL.ductCover : color;
  if (horizontal) {
    return [
      bx('cover', cover, 0, 0, 0, w, cT, h),
      pz('side wall', color, 0, t, comb.map(([a, y]) => [a, y])),
      pz('side wall', color, h - t, h, comb.map(([a, y]) => [a, y])),
      bx('base', color, 0, d - t, t, w, d, h - t),
    ];
  }
  const wall = comb.map(([a, y]) => [y, a] as [number, number]);
  return [
    bx('cover', cover, 0, 0, 0, w, cT, h),
    px('side wall', color, 0, t, wall),
    px('side wall', color, w - t, w, wall),
    bx('base', color, t, d - t, 0, w - t, d, h),
  ];
}

/** Rail web slots for a slotted TS35 rail (pockets on the web face of the hat profile). */
export function railSlots(length: number): PPocket[] {
  const pitch = 25, half = 9;
  const n = Math.floor((length - 6) / pitch);
  const off = (length - (n - 1) * pitch) / 2;
  return Array.from({ length: Math.max(0, n) }, (_, i) => ({ x: off + i * pitch, y: 6.5, z: 17.5, dx: half, ds: 2.6, depth: 0.6 }));
}

// ---------------------------------------------------------------------------
// Door devices (frame: y = 0 at the door FRONT face, door back face at y = doorT; centred on X/Z)
// ---------------------------------------------------------------------------

export type OperatorKind = 'pushbutton' | 'estop' | 'pilot' | 'selector' | 'other';

/** 22 mm operator: front operator, bezel, stem through the door, latch and contact/LED block behind. */
export function operatorShape(kind: OperatorKind, color: Rgb, doorT: number): StepSolid[] {
  const bezel = COL.black;
  const behind: StepSolid[] = [
    bx('latch', COL.charcoal, -14, doorT + 3, -14, 14, doorT + 9, 14),
    bx(kind === 'pilot' ? 'LED module' : 'contact block', COL.lightGrey, -13, doorT + 9, -14, 13, doorT + 40, 14,
      [circ('+y', -6, 6, 2, 1.5), circ('+y', 6, 6, 2, 1.5), circ('+y', -6, -6, 2, 1.5), circ('+y', 6, -6, 2, 1.5)]),
  ];
  const stem = (y0: number, d0: number): [number, number, number][] => [[d0, y0, 0], [22, 0, doorT], [27, doorT, doorT + 3]];
  switch (kind) {
    case 'estop':
      return [
        { name: 'legend plate', color: COL.groundYellow, at: [0, 0, 0], geom: { type: 'tube', ro: 28, ri: 15.25, y0: -1.2, y1: 0 } },
        cylY('bezel', bezel, 0, 0, stem(-8, 30)),
        cylY('mushroom head', color, 0, 0, [[40, -32, -21], [26, -21, -8]]),
        ...behind,
      ];
    case 'pilot':
      return [cylY('bezel', bezel, 0, 0, stem(-5, 29.5)), cylY('lens', color, 0, 0, [[18, -14, -11], [24, -11, -5]]), ...behind];
    case 'selector':
      return [
        cylY('bezel', bezel, 0, 0, stem(-5, 29.5)),
        cylY('knob', COL.black, 0, 0, [[25, -12, -5]]),
        bx('knob lever', color === COL.black ? COL.charcoal : color, -11, -20, -3.5, 11, -12, 3.5),
        ...behind,
      ];
    default:
      return [cylY('bezel', bezel, 0, 0, stem(-5, 29.5)), cylY('button', color, 0, 0, [[24, -10, -5]]), ...behind];
  }
}

/** Through-door rotary handle: front escutcheon and grip, stem through the door, shaft coupling behind. */
export function handleShape(doorT: number, color: Rgb): StepSolid[] {
  return [
    cylY('escutcheon', COL.charcoal, 0, 0, [[60, -6, 0], [22, 0, doorT]]),
    bx('grip', color, -28, -30, -7, 28, -6, 7),
    bx('shaft coupling', COL.black, -10, doorT, -10, 10, doorT + 14, 10),
  ];
}

/** HMI: bezel with recessed glass, body through the cutout, mounting clips and rear connectors. */
export function hmiShape(bw: number, bh: number, cw: number, ch: number, front: number, bodyD: number, doorT: number): StepSolid[] {
  const sw = Math.min(bw * 0.82, bw - 24), sh = Math.min(bh * 0.74, bh - 30);
  const sz = bh * 0.03;
  const out: StepSolid[] = [
    bx('bezel', COL.charcoal, -bw / 2, -front, -bh / 2, bw / 2, 0, bh / 2, [rect('-y', -sw / 2, sz - sh / 2, sw / 2, sz + sh / 2, 1.5)]),
    bx('touch screen', COL.screen, -sw / 2 + 0.3, -front + 0.5, sz - sh / 2 + 0.3, sw / 2 - 0.3, -front + 1.5, sz + sh / 2 - 0.3),
    bx('body', COL.darkGrey, -cw / 2 + 0.5, 0, -ch / 2 + 0.5, cw / 2 - 0.5, doorT + bodyD - 6, ch / 2 - 0.5),
  ];
  // Mounting clips just behind the door (top and bottom edges of the body).
  for (const zs of [1, -1]) for (const xf of [-0.3, 0.3]) {
    const z0 = zs > 0 ? ch / 2 - 0.5 : -ch / 2 - 3.5, z1 = z0 + 4;
    if (Math.abs(z1) <= bh / 2 && Math.abs(z0) <= bh / 2) out.push(bx('mounting clip', COL.black, cw * xf - 6, doorT, z0, cw * xf + 6, doorT + 10, z1));
  }
  // Rear connectors: power plug and Ethernet jack.
  out.push(bx('power connector', COL.groundGreen, -cw / 2 + 6, doorT + bodyD - 6, -ch / 2 + 6, -cw / 2 + 21, doorT + bodyD, -ch / 2 + 14));
  out.push(bx('Ethernet port', COL.lightGrey, -cw / 2 + 26, doorT + bodyD - 6, -ch / 2 + 6, -cw / 2 + 42, doorT + bodyD, -ch / 2 + 19));
  return out;
}

