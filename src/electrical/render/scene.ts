/**
 * Scene builder for the realistic cabinet render (CabinetRender.tsx).
 * Pure functions, no React. Everything is in millimetres in enclosure coordinates
 * (0,0 = top-left corner of the enclosure front) and comes from panelLayout()/buildModel():
 * nothing is placed here that is not in the design. This file only decides how the
 * placed parts look (terminal screws, wires into the nearest duct, tag plates, door view).
 */
import type { CatalogCategory, CatalogPart } from '../types';
import { buildModel, panelLayout, ratingText, supplyText } from '../derive';
import type { DoorItem, DrawingContext, ElectricalModel, IoGroup, PanelLayout, Rect, ResolvedComponent, TerminalStrip } from '../derive';
import { getHmi } from '../../hmi/hmiCatalog';

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** NFPA 79 conductor colours used inside the panel. */
export type WireColor = 'BK' | 'BU' | 'WH/BU' | 'GN/YE' | 'RD' | 'WH';

export const WIRE_HEX: Record<WireColor, { base: string; edge: string; stripe?: string }> = {
  BK: { base: '#232427', edge: '#0b0b0c' },
  BU: { base: '#1f5fd0', edge: '#123a85' },
  'WH/BU': { base: '#f1f2f0', edge: '#9a9c99', stripe: '#2a62cc' },
  'GN/YE': { base: '#2f9a45', edge: '#1c5f2a', stripe: '#f2d22e' },
  RD: { base: '#cf2a2a', edge: '#7e1717' },
  WH: { base: '#f3f3f1', edge: '#9a9c99' },
};

/** Operator colours (caps, lenses). */
export const OP_HEX: Record<string, { base: string; light: string; dark: string }> = {
  GREEN: { base: '#22a046', light: '#7be38f', dark: '#0d5e24' },
  RED: { base: '#d42525', light: '#ff8a7a', dark: '#7a0d0d' },
  BLUE: { base: '#1f5ec9', light: '#79a9ff', dark: '#0c2f6e' },
  BLACK: { base: '#2a2b2e', light: '#6b6e73', dark: '#0d0d0f' },
  WHITE: { base: '#f2f2ee', light: '#ffffff', dark: '#b5b6b0' },
  YELLOW: { base: '#f4c21b', light: '#ffe58a', dark: '#9a7300' },
  AMBER: { base: '#f39a12', light: '#ffd07a', dark: '#99560a' },
  CLEAR: { base: '#e6eef2', light: '#ffffff', dark: '#a9b6bd' },
};
export const opColor = (c: string) => OP_HEX[c.toUpperCase()] ?? OP_HEX.BLACK;

// ---------------------------------------------------------------------------
// Devices on the back panel
// ---------------------------------------------------------------------------

export interface DeviceView {
  key: string;
  /** Tag shown on the engraved plate (CB1, K1, TB2...). */
  tag: string;
  rect: Rect;
  /** Rectangle of the whole placed item (contactor + its direct-mount overload). */
  itemRect: Rect;
  category: CatalogCategory;
  partNumber: string;
  part?: CatalogPart;
  description: string;
  /** Short rating text from the catalog data ("10A 2P", "24VDC 5A"...). */
  rating: string;
  estimated: boolean;
  /** upper = contactor carrying a direct-mount overload; lower = that overload. */
  stack: 'single' | 'upper' | 'lower';
  strip?: TerminalStrip;
  groups: IoGroup[];
  /** Disconnect with a through-door shaft. */
  shaft: boolean;
}

export interface Pin { x: number; y: number }
export interface PinLayout { top: Pin[]; bottom: Pin[] }

const num = (r: Record<string, string | number> | undefined, ...keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = r?.[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

export function polesOf(d: DeviceView, fallback = 3): number {
  const p = num(d.part?.ratings, 'poles');
  if (p && p >= 1 && p <= 4) return Math.round(p);
  if (d.category === 'breaker' || d.category === 'fuse') return Math.max(1, Math.min(4, Math.round(d.rect.w / 18)));
  return fallback;
}

export const isTransformer = (d: Pick<DeviceView, 'description' | 'part'>) => /transformer/i.test(d.description) || d.part?.ratings.kind === 'transformer';

export type RelayStyle = 'socket' | 'cube' | 'slim' | 'module';
export function relayStyle(d: DeviceView): RelayStyle {
  const s = d.description;
  if (/socket|base\b/i.test(s) && !/relay,? \d|coil/i.test(s)) return 'socket';
  if (/ice cube|cube|plug-?in|782-|784-/i.test(s)) return 'cube';
  if (/slim|6\.2 ?mm/i.test(s) || d.rect.w <= 8) return 'slim';
  return 'module';
}

/** I/O point counts on a CLICK CPU / module (catalog data, else the design's groups). */
export function ioCounts(d: DeviceView): { inputs: number; outputs: number } {
  const r = d.part?.ratings;
  const gi = d.groups.filter((g) => g.type === 'input').reduce((a, g) => a + g.points.length, 0);
  const go = d.groups.filter((g) => g.type === 'output').reduce((a, g) => a + g.points.length, 0);
  return {
    inputs: num(r, 'discreteInputs', 'inputs') ?? (gi || (/input/i.test(d.description) ? 8 : 0)),
    outputs: num(r, 'discreteOutputs', 'outputs') ?? (go || (/output/i.test(d.description) ? 8 : 0)),
  };
}

const evenly = (x: number, w: number, n: number, y: number): Pin[] => Array.from({ length: n }, (_, i) => ({ x: x + (w * (i + 0.5)) / n, y }));
const pitchRow = (x0: number, x1: number, pitch: number, y: number): Pin[] => {
  const n = Math.max(1, Math.floor((x1 - x0) / pitch));
  const off = x0 + (x1 - x0 - (n - 1) * pitch) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: off + i * pitch, y }));
};

/** Terminal screw positions of a device; the device drawing and the wiring both use these. */
export function pinLayout(d: DeviceView): PinLayout {
  const { x, y, w, h } = d.rect;
  switch (d.category) {
    case 'breaker': case 'fuse': case 'disconnect': case 'motorProtector': {
      const n = polesOf(d, d.category === 'disconnect' || d.category === 'motorProtector' ? 3 : 1);
      return { top: evenly(x, w, n, y + 6.5), bottom: evenly(x, w, n, y + h - 6.5) };
    }
    case 'contactor': {
      const n = polesOf(d, 3);
      const pw = w - 7;
      return {
        top: [...evenly(x + 1, pw, n, y + 6.5), { x: x + w - 4, y: y + 5 }],
        bottom: d.stack === 'upper' ? [] : [...evenly(x + 1, pw, n, y + h - 6.5), { x: x + w - 4, y: y + h - 5 }],
      };
    }
    case 'overload':
      return { top: d.stack === 'lower' ? [] : evenly(x, w, 3, y + 6.5), bottom: [...evenly(x + 1, w - 9, 3, y + h - 6.5), { x: x + w - 4.5, y: y + h - 6.5 }] };
    case 'powerSupply': {
      const sp = Math.min(7.5, (w - 8) / 4);
      return {
        top: Array.from({ length: 3 }, (_, i) => ({ x: x + 4 + sp * (i + 0.5), y: y + 7.5 })),
        bottom: Array.from({ length: 4 }, (_, i) => ({ x: x + w - 4 - sp * (3.5 - i), y: y + h - 7.5 })),
      };
    }
    case 'plc': case 'plcModule':
      return { top: pitchRow(x + 3.5, x + w - 3.5, 3.6, y + 7.5), bottom: pitchRow(x + 3.5, x + w - 3.5, 3.6, y + h - 7.5) };
    case 'safetyRelay': case 'relay': {
      if (d.category === 'relay' && relayStyle(d) === 'slim') return { top: [{ x: x + w / 2, y: y + 5 }], bottom: [{ x: x + w / 2, y: y + h - 5 }] };
      const p = pitchRow(x + 2.5, x + w - 2.5, 5.2, 0);
      return { top: p.map((q) => ({ x: q.x, y: y + 5.5 })), bottom: p.map((q) => ({ x: q.x, y: y + h - 5.5 })) };
    }
    case 'vfd':
      return { top: [], bottom: pitchRow(x + 6, x + w - 6, Math.min(9, (w - 12) / 7), y + h - 13) };
    case 'groundBar': {
      const n = Math.max(2, Math.min(40, Math.round(num(d.part?.ratings, 'points', 'terminals') ?? Math.floor((w - 16) / 9))));
      return { top: evenly(x + 10, w - 20, n, y + h / 2), bottom: [] };
    }
    case 'terminal': {
      const s = d.strip;
      if (!s) return { top: [], bottom: [] };
      const g = stripGeometry(d);
      return { top: g.terminals.map((t) => ({ x: t.x + t.w / 2, y: y + 5.5 })), bottom: g.terminals.map((t) => ({ x: t.x + t.w / 2, y: y + h - 5.5 })) };
    }
    default:
      if (isTransformer(d)) return { top: evenly(x + w * 0.15, w * 0.7, 4, y + 6), bottom: evenly(x + w * 0.3, w * 0.4, 2, y + h - 6) };
      return { top: [], bottom: [] };
  }
}

/** Positions of the individual pieces of a terminal strip (end stops, terminals, end plates). */
export function stripGeometry(d: DeviceView) {
  const s = d.strip;
  const { x, w } = d.rect;
  const n = s?.terminals.length ?? 0;
  const stops = Math.max(0, Math.min(2, s?.endStops ?? 2));
  const plates = Math.max(0, Math.min(2, s?.endPlates ?? 1));
  const tw = n ? Math.max(2, (w - plates * 1.5 - stops * 9) / n) : 6;
  let cx = x;
  const out: { stops: Rect[]; plates: Rect[]; terminals: (Rect & { i: number })[] } = { stops: [], plates: [], terminals: [] };
  const H = d.rect.h, Y = d.rect.y;
  if (stops > 0) { out.stops.push({ x: cx, y: Y + 4, w: 9, h: H - 8 }); cx += 9; }
  for (let i = 0; i < n; i++) { out.terminals.push({ x: cx, y: Y, w: tw, h: H, i }); cx += tw; }
  for (let i = 0; i < plates; i++) { out.plates.push({ x: cx, y: Y + 1, w: 1.5, h: H - 2 }); cx += 1.5; }
  if (stops > 1) out.stops.push({ x: cx, y: Y + 4, w: 9, h: H - 8 });
  return out;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export interface WirePath { d: string; color: WireColor; w: number }
export interface Duct extends Rect { orientation: 'h' | 'v' }
/** Duct fingers: finger width and pitch along the duct (mm). */
export const FINGER_W = 5.5;
export const FINGER_PITCH = 10;

function colorOfWireName(name: string, m: ElectricalModel): WireColor | null {
  const rec = m.wires.find((w) => w.wire === name && !/cable/i.test(w.color)) ?? m.wires.find((w) => w.wire === name);
  const c = rec?.color.replace(/\s*\(cable\)/i, '').toUpperCase();
  if (c && c in WIRE_HEX) return c as WireColor;
  if (/^PE$/i.test(name)) return 'GN/YE';
  if (/^0V/i.test(name)) return 'WH/BU';
  if (/^X1$/i.test(name)) return 'RD';
  if (/^X2$/i.test(name)) return 'WH';
  if (/^24\+/.test(name) || /^[XY]\d/.test(name) || /^S\d\d/.test(name)) return 'BU';
  if (/L\d|T\d|^N$/.test(name)) return 'BK';
  return name ? 'BU' : null;
}

/** Which pins of a device carry a wire, and its colour (index-aligned with pinLayout). */
function wireColors(d: DeviceView, pins: PinLayout, m: ElectricalModel): { top: (WireColor | null)[]; bottom: (WireColor | null)[] } {
  const fill = (n: number, ...cs: (WireColor | null)[]) => Array.from({ length: n }, (_, i) => cs[i] ?? null);
  const T = pins.top.length, B = pins.bottom.length;
  const n3 = (c: WireColor) => Array.from({ length: Math.max(0, polesOf(d, 3)) }, () => c);
  switch (d.category) {
    case 'breaker': case 'fuse': case 'motorProtector':
      return { top: fill(T, ...n3('BK')), bottom: fill(B, ...n3('BK')) };
    case 'disconnect':
      return { top: fill(T), bottom: fill(B, ...n3('BK')) };
    case 'contactor': {
      const coil: WireColor = /vac|ac\b/i.test(String(d.part?.ratings.coil ?? d.part?.ratings.coilVoltage ?? '')) && !/dc/i.test(String(d.part?.ratings.coil ?? '')) ? 'RD' : 'BU';
      const pw: WireColor[] = n3('BK');
      const ret: WireColor = coil === 'RD' ? 'WH' : 'WH/BU';
      return { top: [...pw, coil].slice(0, T), bottom: B ? [...pw, ret].slice(0, B) : [] };
    }
    case 'overload':
      return { top: d.stack === 'lower' ? [] : fill(T, 'BK', 'BK', 'BK'), bottom: fill(B, 'BK', 'BK', 'BK', 'BU') };
    case 'powerSupply':
      return { top: fill(T, 'BK', 'BK', 'GN/YE'), bottom: fill(B, 'BU', 'BU', 'WH/BU', 'WH/BU') };
    case 'plc': case 'plcModule': {
      // Wires only on the I/O points the design uses. CLICK: inputs on the upper connector,
      // outputs (+ the CPU's 24VDC supply at the end) on the lower connector.
      const used = (type: 'input' | 'output') => d.groups.filter((g) => g.type === type).reduce((a, g) => a + g.points.length, 0);
      const rep = (n: number, c: WireColor) => Array.from({ length: Math.max(0, n) }, () => c);
      const ui = Math.min(Math.max(0, T - 1), used('input'));
      const uo = Math.min(Math.max(0, B - 3), used('output'));
      const top = fill(T, ...rep(ui, 'BU'), ui ? 'WH/BU' : null);
      const bottom = fill(B, ...rep(uo, 'BU'), uo ? 'BU' : null);
      if (d.category === 'plc' && B >= 2) { bottom[B - 2] = 'BU'; bottom[B - 1] = 'WH/BU'; }
      return { top, bottom };
    }
    case 'safetyRelay':
      return { top: fill(T, 'BU', 'WH/BU', 'BU', 'BU'), bottom: fill(B, 'BU', 'BU', 'BU') };
    case 'relay':
      if (relayStyle(d) === 'socket' || relayStyle(d) === 'cube' || relayStyle(d) === 'module') return { top: fill(T, 'BU', 'WH/BU'), bottom: fill(B, 'BU', 'BU') };
      return { top: fill(T, 'BU'), bottom: fill(B, 'BU') };
    case 'vfd':
      return { top: [], bottom: fill(B, 'BK', 'BK', 'BK', 'BK', 'BK', 'BK', 'GN/YE') };
    case 'groundBar': {
      const pe = m.wires.filter((w) => /^GN/.test(w.color) && (w.from.startsWith(d.tag) || w.to.startsWith(d.tag))).length;
      const n = Math.max(2, Math.min(T, pe || Math.ceil(T / 2)));
      const top = fill(T);
      for (let i = 0; i < n; i++) top[Math.min(T - 1, Math.round(((i + 0.5) * T) / n - 0.5))] = 'GN/YE';
      return { top, bottom: [] };
    }
    case 'terminal': {
      const ts = d.strip?.terminals ?? [];
      return { top: ts.map((t) => (t.kind === 'spare' ? null : t.kind === 'ground' ? 'GN/YE' : colorOfWireName(t.wire, m))), bottom: fill(B) };
    }
    default:
      if (isTransformer(d)) return { top: fill(T, 'BK', null, null, 'BK'), bottom: fill(B, 'RD', 'WH') };
      return { top: fill(T), bottom: fill(B) };
  }
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

class Router {
  private used = new Map<string, number>();
  private ducts: Duct[];
  private obstacles: Rect[];
  constructor(ducts: Duct[], obstacles: Rect[]) {
    this.ducts = ducts.filter((d) => d.w > 1 && d.h > 1);
    this.obstacles = obstacles;
  }

  private blocked(r: Rect, self: Rect) {
    return this.obstacles.some((o) => o !== self && overlaps(o, r) && !overlaps(o, { x: self.x + 0.5, y: self.y + 0.5, w: self.w - 1, h: self.h - 1 }));
  }

  private slot(key: string, start: number, along: number) {
    const k = Math.round((along - start - FINGER_W - (FINGER_PITCH - FINGER_W) / 2) / FINGER_PITCH);
    const id = `${key}:${k}`;
    const c = this.used.get(id) ?? 0;
    this.used.set(id, c + 1);
    return start + k * FINGER_PITCH + FINGER_W + (FINGER_PITCH - FINGER_W) / 2 + [0, -1.1, 1.1][c % 3];
  }

  /** Route a wire from a terminal into the nearest duct in the given direction. */
  route(p: Pin, dir: 'up' | 'down', self: Rect): string {
    const sgn = dir === 'up' ? -1 : 1;
    type Cand = { cost: number; make: () => string };
    const cands: Cand[] = [];
    this.ducts.forEach((d, di) => {
      const edge = dir === 'up' ? d.y + d.h : d.y;
      const inX = p.x >= d.x + 2 && p.x <= d.x + d.w - 2;
      if (inX && (dir === 'up' ? edge <= p.y + 0.1 : edge >= p.y - 0.1)) {
        const span = { x: p.x - 1.2, y: Math.min(edge, p.y) + 0.5, w: 2.4, h: Math.abs(edge - p.y) - 1 };
        if (span.h <= 0 || !this.blocked(span, self)) {
          cands.push({
            cost: Math.abs(edge - p.y) + (d.orientation === 'v' ? 4 : 0),
            make: () => {
              const sx = d.orientation === 'h' ? this.slot(`${di}${dir}`, d.x, p.x) : Math.min(d.x + d.w - 4, Math.max(d.x + 4, p.x));
              const dy = edge - p.y;
              const inside = edge + sgn * d.h * (d.orientation === 'h' ? 0.5 : 0.2);
              return `M${f(p.x)} ${f(p.y)} C${f(p.x)} ${f(p.y + dy * 0.55)} ${f(sx)} ${f(edge - dy * 0.3)} ${f(sx)} ${f(edge)} L${f(sx)} ${f(inside)}`;
            },
          });
        }
      }
      // side entry into a vertical duct
      if (d.orientation === 'v') {
        const ty = p.y + sgn * 14;
        if (ty >= d.y + 6 && ty <= d.y + d.h - 6) {
          const right = p.x > d.x + d.w;
          const ex = right ? d.x + d.w : d.x;
          const span = { x: Math.min(ex, p.x) + 0.5, y: ty - 1.2, w: Math.abs(ex - p.x) - 1, h: 2.4 };
          if (span.w <= 0 || !this.blocked(span, self)) {
            cands.push({
              cost: Math.abs(ex - p.x) + 25,
              make: () => {
                const sy = this.slot(`${di}side`, d.y, ty);
                const inside = ex + (right ? -1 : 1) * d.w * 0.5;
                return `M${f(p.x)} ${f(p.y)} C${f(p.x)} ${f(sy)} ${f(p.x)} ${f(sy)} ${f(p.x + (ex - p.x) * 0.4)} ${f(sy)} L${f(inside)} ${f(sy)}`;
              },
            });
          }
        }
        // into the open end of a vertical duct from the side (e.g. ground bar under the duct end)
        const end = dir === 'up' ? d.y + d.h : d.y;
        if (!inX && (dir === 'up' ? end <= p.y - 3 : end >= p.y + 3) && Math.abs(p.x - (d.x + d.w / 2)) < 160) {
          const near = p.x < d.x ? d.x + 4 : d.x + d.w - 4;
          const span = { x: Math.min(near, p.x) + 0.5, y: Math.min(end, p.y) + 0.5, w: Math.abs(near - p.x) - 1, h: Math.abs(end - p.y) - 1 };
          if (!this.blocked(span, self)) {
            cands.push({
              cost: Math.abs(end - p.y) + Math.abs(near - p.x) * 1.3 + 6,
              make: () => {
                const id = `${di}end${dir}`;
                const c = this.used.get(id) ?? 0;
                this.used.set(id, c + 1);
                const tx = Math.min(d.x + d.w - 3, Math.max(d.x + 3, near + (p.x < d.x ? 1 : -1) * (c % 10) * 3));
                const inside = end + sgn * 12;
                return `M${f(p.x)} ${f(p.y)} C${f(p.x)} ${f(p.y + (end - p.y) * 0.9)} ${f(tx)} ${f(p.y + (end - p.y) * 0.4)} ${f(tx)} ${f(end)} L${f(tx)} ${f(inside)}`;
              },
            });
          }
        }
      }
    });
    cands.sort((a, b) => a.cost - b.cost);
    if (cands.length) return cands[0].make();
    return `M${f(p.x)} ${f(p.y)} L${f(p.x)} ${f(p.y + sgn * 12)}`;
  }
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

// ---------------------------------------------------------------------------
// Tag plates
// ---------------------------------------------------------------------------

export interface TagPlate { x: number; y: number; w: number; h: number; text: string; font: number }
const PLATE_H = 7;

/** `k` scales the plate with the cabinet so tags stay readable when a large panel is fitted to the screen. */
function plateFor(text: string, cx: number, y: number, maxW: number, k = 1): TagPlate {
  const natural = text.length * 2.75 * k + 4;
  const w = Math.max(10, Math.min(natural, Math.max(maxW, 10)));
  const font = Math.min(4.2 * k, (w - 2.4) / (text.length * 0.64));
  return { x: cx - w / 2, y, w, h: PLATE_H * k, text, font };
}

// ---------------------------------------------------------------------------
// Door
// ---------------------------------------------------------------------------

export interface HandleInfo { x: number; y: number; tag: string; partNumber?: string; lever: string; plate: string }
export interface DoorScene {
  w: number; h: number;
  /** Door leaves left to right (two on a double door, meeting at the centre); `leaf` carries the devices and the latch. */
  leaves: { x0: number; x1: number }[]; leaf: number;
  /** Latch centre X on the closed door (free edge of the device leaf). */
  latchX: number;
  items: DoorItem[];
  handle?: HandleInfo;
  latch: 'quarter-turn' | 'handle';
  latchY: number;
  warning: Rect;
  nameplate: Rect;
  nameLines: string[];
  hmiOverflow: boolean;
  /** Text shown on the HMI screen. */
  hmiScreen: { title: string; lamps: { text: string; color: string }[]; buttons: { text: string; color: string }[] };
  finish: 'painted' | 'stainless' | 'nonmetal';
}

function handleColors(part: CatalogPart | undefined): { lever: string; plate: string } {
  const s = `${part?.ratings.color ?? ''} ${part?.description ?? ''}`.toLowerCase();
  const m = s.match(/\b(red|black|grey|gray)\s*\/\s*(yellow|blue|black|grey|gray)\b/);
  if (m) return { lever: m[1], plate: m[2] };
  if (/black/.test(s)) return { lever: 'black', plate: 'gray' };
  return { lever: 'red', plate: 'yellow' };
}

function freeSpot(occupied: Rect[], cands: Rect[], fallback: Rect): Rect {
  return cands.find((c) => !occupied.some((o) => overlaps(o, c))) ?? fallback;
}

/** Door devices incl. the HMI chosen on the HMI page (placed like the layout engine places HMIs). */
function doorItems(L: PanelLayout, hmiPartNumber: string | null): { items: DoorItem[]; hmiOverflow: boolean } {
  const items = L.door.items.map((d) => {
    if (d.kind !== 'hmi') return d;
    const b = getHmi(d.partNumber)?.bezelMm;
    return b ? { ...d, w: b.width, h: b.height, estimated: false } : d;
  });
  if (!hmiPartNumber || items.some((d) => d.kind === 'hmi')) return { items, hmiOverflow: false };
  const model = getHmi(hmiPartNumber);
  const b = model?.bezelMm;
  const w = b?.width ?? (model ? model.sizeIn * 25.4 * 0.87 + 40 : 200);
  const h = b?.height ?? (model ? model.sizeIn * 25.4 * 0.49 + 40 : 150);
  const top = Math.min(90, L.door.h * 0.15);
  const shift = h + 40;
  const shifted = items.map((d) => ({ ...d, cy: d.cy + shift }));
  const lf = L.door.leaves[L.door.leaf] ?? { x0: 0, x1: L.door.w };
  const hmi: DoorItem = { tag: 'HMI', partNumber: hmiPartNumber, kind: 'hmi', cx: (lf.x0 + lf.x1) / 2, cy: top + h / 2, w, h, legend: [], color: '', estimated: !b };
  const lowest = Math.max(top + h, ...shifted.map((d) => d.cy + (d.kind === 'estop' ? 30 : 22)));
  return { items: [hmi, ...shifted], hmiOverflow: lowest > L.door.h - 30 || w > lf.x1 - lf.x0 - 40 };
}

export function doorItemBox(d: DoorItem): Rect {
  if (d.kind === 'hmi') return { x: d.cx - d.w / 2, y: d.cy - d.h / 2, w: d.w, h: d.h };
  if (d.kind === 'estop') return { x: d.cx - 31, y: d.cy - 31, w: 62, h: 62 };
  return { x: d.cx - 16, y: d.cy - 36, w: 32, h: 54 };
}

// ---------------------------------------------------------------------------
// Open door seen from the inside (perspective-ish projection)
// ---------------------------------------------------------------------------

/** Horizontal foreshortening and perspective growth of the open door. */
const DOOR_C = 0.36;
const DOOR_K = 0.12;
export interface DoorPoint { x: number; y: number; sx: number; sy: number }
/** u = distance from the hinge along the door, v = height on the door (mm). Hinge is at x = 0. */
export function projectDoor(W: number, H: number, u: number, v: number): DoorPoint {
  const s = 1 + (DOOR_K * u) / W;
  return { x: -DOOR_C * u * (1 + (DOOR_K * u) / W / 2), y: H / 2 + (v - H / 2) * s, sx: DOOR_C * s, sy: s };
}

/** Leaf of a point on the closed door. */
export function leafOf(door: Pick<DoorScene, 'w' | 'leaves'>, x: number): number {
  return door.leaves.length > 1 && x >= door.w / 2 ? 1 : 0;
}

/**
 * A point (x, y on the closed door) on the open door: a single door swings open about its left hinge;
 * on a double door the left leaf swings left about x = 0 and the right leaf right about x = W.
 */
export function openDoorPoint(door: Pick<DoorScene, 'w' | 'h' | 'leaves'>, x: number, y: number, li = leafOf(door, x)): DoorPoint {
  const l = door.leaves[li];
  const right = door.leaves.length > 1 && li === 1;
  const q = projectDoor(l.x1 - l.x0, door.h, right ? l.x1 - x : x - l.x0, y);
  return right ? { ...q, x: door.w - q.x } : q;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export interface Scene {
  layout: PanelLayout;
  enc: { w: number; h: number; finish: 'painted' | 'stainless' | 'nonmetal'; color: string };
  backplateFinish: 'white' | 'galvanized' | 'orange';
  devices: DeviceView[];
  pins: Map<string, PinLayout>;
  wires: WirePath[];
  plates: TagPlate[];
  door: DoorScene;
  /** Bundle of door wires: path from the open door across the hinge into the left duct. */
  doorBundle?: string;
  /** Individual wires on the open door from each device back to the bundle. */
  doorWires: WirePath[];
  notShown: string[];
  title: string;
}

export function buildScene(ctx: DrawingContext, hmiPartNumber: string | null): Scene {
  const L = panelLayout(ctx);
  const m = buildModel(ctx);
  const byTag = new Map<string, ResolvedComponent>(m.rc.map((c) => [c.tag, c] as const));
  const encRc = m.rc.find((c) => c.category === 'enclosure' && c.partNumber === L.enclosure.partNumber);
  const encDesc = `${encRc?.part?.description ?? ''} ${encRc?.part?.ratings.material ?? ''}`;
  const finish: Scene['enc']['finish'] = /stainless|304|316/i.test(encDesc) ? 'stainless' : /fiberglass|polycarbonate|plastic|nonmetal|abs\b/i.test(encDesc) ? 'nonmetal' : 'painted';
  const bpRc = L.backplate.tag ? byTag.get(L.backplate.tag) : undefined;
  const bpDesc = `${bpRc?.part?.description ?? ''} ${bpRc?.part?.ratings.material ?? ''} ${bpRc?.part?.ratings.finish ?? ''}`;
  const backplateFinish: Scene['backplateFinish'] = /galvaniz|zinc/i.test(bpDesc) ? 'galvanized' : /orange/i.test(bpDesc) ? 'orange' : 'white';

  // --- devices
  const shaftPart = m.rc.some((c) => c.category === 'disconnect' && /shaft/i.test(`${c.part?.description ?? ''} ${c.comp.function}`));
  const handleRc = m.rc.find((c) => c.category === 'disconnect' && (c.mount === 'door' || /\bhandle\b/i.test(`${c.part?.description ?? ''} ${c.comp.function}`)) && !/^(disconnect )?shaft/i.test(c.part?.description ?? '') && !/\bswitch\b/i.test(c.part?.description ?? ''));
  const devices: DeviceView[] = [];
  for (const it of L.items) {
    const parts = it.sub ?? [it];
    parts.forEach((p, i) => {
      const rc = byTag.get(p.tag);
      const part = rc?.part ?? ctx.getPart(p.partNumber) ?? (p.category === 'plc' ? m.plcPart : undefined);
      const desc = part?.description ?? rc?.comp.function ?? '';
      const tag = p.category === 'terminal' ? p.tag : it.sub ? p.tag : it.label;
      devices.push({
        key: `${it.label}-${i}`,
        tag,
        rect: { x: p.x, y: p.y, w: p.w, h: p.h },
        itemRect: { x: it.x, y: it.y, w: it.w, h: it.h },
        category: p.category,
        partNumber: p.partNumber,
        part,
        description: desc,
        rating: rc ? ratingText(rc) : '',
        estimated: p.estimated,
        stack: it.sub ? (i === 0 ? 'upper' : 'lower') : 'single',
        strip: p.category === 'terminal' ? m.strips.find((s) => s.tag === p.tag) : undefined,
        groups: m.groups.filter((g) => g.devTag === p.tag || (p.category === 'plc' && g.devTag === m.plcTag && p.tag === m.plcTag)),
        shaft: p.category === 'disconnect' && (shaftPart || !!handleRc || /through-?door|handle/i.test(desc)),
      });
    });
  }

  // --- wiring
  const ducts: Duct[] = L.ducts;
  const itemRects = new Map<string, Rect>();
  const obstacles: Rect[] = devices.map((d) => { const r = d.itemRect; itemRects.set(d.key, r); return r; });
  const router = new Router(ducts, obstacles);
  const pins = new Map<string, PinLayout>();
  const wires: WirePath[] = [];
  const wired = new Map<string, { top: boolean; bottom: boolean }>();
  for (const d of devices) {
    const pl = pinLayout(d);
    pins.set(d.key, pl);
    const cols = wireColors(d, pl, m);
    const self = itemRects.get(d.key)!;
    const width = (c: WireColor) => (c === 'BK' && d.category !== 'terminal' ? 2.5 : 2.1);
    pl.top.forEach((p, i) => { const c = cols.top[i]; if (c) wires.push({ d: router.route(p, 'up', self), color: c, w: width(c) }); });
    pl.bottom.forEach((p, i) => { const c = cols.bottom[i]; if (c) wires.push({ d: router.route(p, 'down', self), color: c, w: width(c) }); });
    wired.set(d.key, { top: cols.top.some(Boolean), bottom: cols.bottom.some(Boolean) });
  }

  // --- tag plates: on the back panel next to the device when that side is free of wires,
  // otherwise on the wire-duct cover (upper half for the device above, lower half for the one below).
  const plates: TagPlate[] = [];
  const hd = ducts.filter((d) => d.orientation === 'h');
  const spans = (d: Duct, r: Rect) => d.x <= r.x + r.w / 2 && d.x + d.w >= r.x + r.w / 2;
  const ductBelow = (r: Rect) => hd.filter((d) => d.y >= r.y + r.h - 0.1 && spans(d, r)).sort((a, b) => a.y - b.y)[0];
  const ductAbove = (r: Rect) => hd.filter((d) => d.y + d.h <= r.y + 0.1 && spans(d, r)).sort((a, b) => b.y - a.y)[0];
  const rowPlates: TagPlate[] = [];
  // plate size grows with the back panel (a 30" panel fitted to ~500 px would make 4 mm text about 3 px tall)
  const pk = Math.min(1.5, Math.max(1, L.backplate.h / 480));
  const PH = PLATE_H * pk;
  for (const d of devices) {
    const r = d.rect;
    const w = wired.get(d.key)!;
    const maxW = d.category === 'terminal' ? Math.min(30, r.w) : r.w + 2;
    const cx = d.category === 'terminal' ? r.x + Math.min(r.w / 2, 18) : r.x + r.w / 2;
    const useTop = d.stack === 'upper' || d.category === 'terminal';
    if (useTop) {
      const a = ductAbove(r);
      const room = a ? r.y - (a.y + a.h) : 99;
      const y = !w.top && room >= PH + 3 ? r.y - PH - 1.5 : a ? a.y + a.h * 0.75 - PH / 2 : r.y - PH - 1.5;
      rowPlates.push(plateFor(d.tag, cx, y, maxW, pk));
      continue;
    }
    const db = ductBelow(r);
    const room = (db ? db.y : Infinity) - (r.y + r.h);
    const y = !w.bottom && room >= PH + 3 ? r.y + r.h + 1.5 : db ? db.y + db.h * 0.25 - PH / 2 : r.y + r.h + 1.5;
    rowPlates.push(plateFor(d.tag, cx, y, maxW, pk));
  }
  // keep plates on the same line from overlapping
  rowPlates.sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 1; i < rowPlates.length; i++) {
    const a = rowPlates[i - 1], b = rowPlates[i];
    if (Math.abs(a.y - b.y) < 1 && a.x + a.w + 1 > b.x) {
      const mid = (a.x + a.w + b.x) / 2;
      const cut = (a.x + a.w + 1 - b.x) / 2;
      a.w = Math.max(6, a.w - cut); b.x = mid + 0.5; b.w = Math.max(6, b.w - cut);
      a.font = Math.min(a.font, (a.w - 1.5) / (a.text.length * 0.64));
      b.font = Math.min(b.font, (b.w - 1.5) / (b.text.length * 0.64));
    }
  }
  plates.push(...rowPlates);

  // --- door
  const W = L.enclosure.w, H = L.enclosure.h;
  const { items, hmiOverflow } = doorItems(L, hmiPartNumber);
  const disc = devices.find((d) => d.category === 'disconnect');
  let handle: HandleInfo | undefined;
  if (handleRc || (disc && disc.shaft)) {
    const c = handleColors(handleRc?.part);
    // A through-door handle sits on the disconnect's shaft axis.
    const hx = disc ? disc.rect.x + disc.rect.w / 2 : W - 60;
    const hy = disc ? disc.rect.y + disc.rect.h / 2 : H * 0.45;
    handle = { x: hx, y: hy, tag: handleRc?.tag ?? disc?.tag ?? 'DS', partNumber: handleRc?.partNumber, ...c };
  }
  const latch: DoorScene['latch'] = /1\/4[- ]?turn|quarter[- ]?turn/i.test(encDesc) ? 'quarter-turn' : 'handle';
  const leaves = L.door.leaves, leaf = L.door.leaf;
  const two = leaves.length > 1;
  const latchX = two ? (leaf === 1 ? W / 2 + 22 : W / 2 - 22) : W - 22;
  const occupied: Rect[] = [...items.map(doorItemBox), ...(handle ? [{ x: handle.x - 42, y: handle.y - 42, w: 84, h: 84 }] : []), { x: latchX - 28, y: H * 0.62 - 50, w: 56, h: 100 },
    // labels never across the split of a double door
    ...(two ? [{ x: W / 2 - 12, y: 0, w: 24, h: H }] : [])];
  const ww = Math.min(80, W * 0.2), wh = ww * 0.62;
  const warning = freeSpot(occupied, [
    { x: W - ww - 34, y: 34, w: ww, h: wh }, { x: 34, y: 34, w: ww, h: wh },
    { x: W - ww - 34, y: H * 0.3, w: ww, h: wh }, { x: 34, y: H * 0.3, w: ww, h: wh },
    { x: W / 2 - ww / 2, y: H * 0.55, w: ww, h: wh },
  ], { x: W - ww - 34, y: H - wh - 34 - 60, w: ww, h: wh });
  occupied.push(warning);
  const nw = Math.min(120, W * 0.32), nh = nw * 0.36;
  const nameplate = freeSpot(occupied, [
    { x: W / 2 - nw / 2, y: H - nh - 40, w: nw, h: nh }, { x: 40, y: H - nh - 40, w: nw, h: nh }, { x: W - nw - 50, y: H - nh - 40, w: nw, h: nh },
    { x: W / 2 - nw / 2, y: H * 0.7, w: nw, h: nh },
  ], { x: W / 2 - nw / 2, y: H - nh - 40, w: nw, h: nh });
  const ins = ctx.design.inputs;
  const nameLines = [
    ctx.projectName || 'Control Panel',
    `${supplyText(ins.supply)}  ·  ${ins.enclosureRating}`,
    `${L.enclosure.partNumber ?? 'Enclosure'}  ·  ${(ctx.design.generatedAt || '').slice(0, 10)}`,
  ];
  const lamps = items.filter((d) => d.kind === 'pilot').slice(0, 3).map((d) => ({ text: d.legend.join(' '), color: d.color }));
  const door: DoorScene = {
    w: W, h: H, leaves, leaf, latchX, items, handle, latch, latchY: H * 0.62, warning, nameplate, nameLines, hmiOverflow, finish,
    hmiScreen: {
      title: (ctx.projectName || 'MACHINE').toUpperCase(),
      lamps,
      buttons: items.filter((d) => d.kind === 'pushbutton').slice(0, 3).map((d) => ({ text: d.legend.join(' '), color: d.color })),
    },
  };

  // --- door bundle (open door -> hinge -> nearest vertical duct: the left one, the right one for a right leaf)
  let doorBundle: string | undefined;
  const doorWires: WirePath[] = [];
  const right = two && leaf === 1;
  const vds = ducts.filter((d) => d.orientation === 'v' && d.h > 20).sort((a, b) => a.x - b.x);
  const sideV = right ? vds[vds.length - 1] : vds[0];
  if (items.length && sideV) {
    const lf = leaves[leaf];
    const ys = items.map((d) => d.cy);
    const vy = Math.min(Math.max(ys.reduce((a, b) => a + b, 0) / ys.length, sideV.y + 25), sideV.y + sideV.h - 25);
    // u = distance from the hinge of the device leaf; xAt(u) = the closed-door X at that distance
    const xAt = (u: number) => (right ? lf.x1 - u : lf.x0 + u);
    const nearU = Math.max(40, Math.min(...items.map((d) => (right ? lf.x1 - d.cx : d.cx - lf.x0) - d.w / 2)) - 10);
    const dp = { w: W, h: H, leaves };
    const a = openDoorPoint(dp, xAt(nearU), vy, leaf);
    const b = openDoorPoint(dp, xAt(22), vy + 12, leaf);
    const tx = sideV.x + sideV.w / 2;
    const m = right ? -1 : 1;
    for (const d of items) {
      const q = openDoorPoint(dp, d.cx, d.cy + (d.kind === 'hmi' ? d.h * 0.3 : 0), leaf);
      const cols: WireColor[] = d.kind === 'pilot' ? ['BU', 'WH/BU'] : d.kind === 'hmi' ? ['BU', 'WH/BU'] : ['BU', 'BU'];
      cols.forEach((c, k) => {
        const ox = (k - 0.5) * 2.4 * q.sx, oy = (k - 0.5) * 2.4;
        const mx = (q.x + a.x) / 2;
        doorWires.push({ d: `M${f(q.x + ox)} ${f(q.y + oy)} C${f(mx)} ${f(q.y + oy + (a.y - q.y) * 0.1)} ${f(mx)} ${f(a.y + oy * 0.4)} ${f(a.x)} ${f(a.y + oy * 0.4)}`, color: c, w: 1.5 });
      });
    }
    doorBundle = `M${f(a.x)} ${f(a.y)} C${f(b.x - 10 * m)} ${f(b.y)} ${f(b.x)} ${f(b.y + 18)} ${f(right ? W + 4 : -4)} ${f(vy + 22)} S${f(tx - 30 * m)} ${f(vy + 6)} ${f(tx)} ${f(vy + 4)}`;
  }

  const notShown = [...L.notFit.map((n) => `${n.tag} (${n.partNumber}) — does not fit`), ...L.unplaced.map((u) => `${u.tag} (${u.partNumber}) — ${u.reason}`)];
  const encColor = finish === 'stainless' ? '#c9cdd1' : finish === 'nonmetal' ? '#d9dad6' : '#cfd2cd';
  return {
    layout: L, enc: { w: W, h: H, finish, color: encColor }, backplateFinish, devices, pins, wires, plates, door, doorBundle, doorWires, notShown,
    title: ctx.projectName || 'Control panel',
  };
}
