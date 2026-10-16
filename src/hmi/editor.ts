/**
 * Manual HMI screen editing: pure functions on screens and elements (no React),
 * so moving, resizing, snapping, aligning and undo are unit-tested on their own.
 * Coordinates are the panel's native pixels.
 */
import { MIN_TOUCH } from './layout';
import type { HmiDesign, HmiElement, HmiElementKind, HmiScreen, HmiTag } from './types';

export const GRID = 8;
export const MIN_SIZE = 16;

export interface Bounds { w: number; h: number }

export const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid || 0;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Kinds offered in the editor palette, in palette order, with plain names. */
export const PALETTE: { kind: HmiElementKind; label: string }[] = [
  { kind: 'button', label: 'Push button' },
  { kind: 'indicator', label: 'Indicator lamp' },
  { kind: 'numeric', label: 'Numeric display' },
  { kind: 'numeric-entry', label: 'Numeric entry' },
  { kind: 'bar', label: 'Bar graph' },
  { kind: 'multistate', label: 'Multistate text' },
  { kind: 'text', label: 'Text' },
  { kind: 'alarm-banner', label: 'Alarm banner' },
  { kind: 'nav', label: 'Screen button' },
  { kind: 'panel', label: 'Group frame' },
];

const DEFAULT_SIZE: Partial<Record<HmiElementKind, [number, number]>> = {
  button: [120, 56], nav: [120, 56], indicator: [160, 48], numeric: [160, 56], 'numeric-entry': [160, 56],
  bar: [200, 40], multistate: [200, 48], text: [160, 32], 'alarm-banner': [480, 40], panel: [240, 160],
};
const DEFAULT_LABEL: Partial<Record<HmiElementKind, string>> = {
  button: 'Start', nav: 'Main', indicator: 'Running', numeric: 'Count', 'numeric-entry': 'Setpoint',
  bar: 'Level', multistate: 'Mode', text: 'Label', 'alarm-banner': 'Alarms', panel: 'Group',
};

/** Unique element id within a design. */
export function newElementId(design: HmiDesign | null, prefix = 'el'): string {
  const used = new Set((design?.screens ?? []).flatMap((s) => s.elements.map((e) => e.id)));
  let n = 1;
  while (used.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

/** A new element of `kind` centred on (cx, cy), snapped and kept on screen. */
export function createElement(kind: HmiElementKind, id: string, cx: number, cy: number, bounds: Bounds, grid = GRID): HmiElement {
  const [w, h] = DEFAULT_SIZE[kind] ?? [160, 48];
  const x = clamp(snap(cx - w / 2, grid), 0, Math.max(0, bounds.w - w));
  const y = clamp(snap(cy - h / 2, grid), 0, Math.max(0, bounds.h - h));
  return {
    id, kind, label: DEFAULT_LABEL[kind] ?? 'Label', x, y, w, h,
    address: null, action: kind === 'button' ? 'momentary' : null, targetScreenId: null,
    onText: null, offText: null, style: 'normal', units: null,
    min: kind === 'bar' ? 0 : null, max: kind === 'bar' ? 100 : null, note: null,
    ...(kind === 'multistate' ? { states: [{ value: 0, text: 'Stopped', style: 'normal' as const }, { value: 1, text: 'Running', style: 'ok' as const }] } : {}),
  };
}

const touch = (k: HmiElementKind) => k === 'button' || k === 'nav' || k === 'numeric-entry';

/** Move elements by (dx, dy); the group keeps its shape, snaps to the grid and stays on the panel. */
export function moveElements(screen: HmiScreen, ids: string[], dx: number, dy: number, bounds: Bounds, grid = GRID): HmiScreen {
  const sel = screen.elements.filter((e) => ids.includes(e.id));
  if (!sel.length) return screen;
  const left = Math.min(...sel.map((e) => e.x));
  const top = Math.min(...sel.map((e) => e.y));
  const right = Math.max(...sel.map((e) => e.x + e.w));
  const bottom = Math.max(...sel.map((e) => e.y + e.h));
  // Snap the group's top-left corner, then keep the whole group inside the panel.
  let nx = grid > 1 ? snap(left + dx, grid) : Math.round(left + dx);
  let ny = grid > 1 ? snap(top + dy, grid) : Math.round(top + dy);
  nx = clamp(nx, 0, Math.max(0, bounds.w - (right - left)));
  ny = clamp(ny, 0, Math.max(0, bounds.h - (bottom - top)));
  const ox = nx - left;
  const oy = ny - top;
  if (!ox && !oy) return screen;
  return { ...screen, elements: screen.elements.map((e) => (ids.includes(e.id) ? { ...e, x: e.x + ox, y: e.y + oy } : e)) };
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Resize one element by dragging `handle` by (dx, dy); edges snap, the size never goes below the minimum. */
export function resizeElement(el: HmiElement, handle: Handle, dx: number, dy: number, bounds: Bounds, grid = GRID): HmiElement {
  const s = (v: number) => (grid > 1 ? snap(v, grid) : Math.round(v));
  const minW = touch(el.kind) ? Math.min(MIN_TOUCH.w, MIN_SIZE * 4) : MIN_SIZE;
  const minH = touch(el.kind) ? Math.min(MIN_TOUCH.h, MIN_SIZE * 3) : MIN_SIZE;
  let l = el.x, t = el.y, r = el.x + el.w, b = el.y + el.h;
  if (handle.includes('w')) l = clamp(s(l + dx), 0, r - minW);
  if (handle.includes('e')) r = clamp(s(r + dx), l + minW, bounds.w);
  if (handle.includes('n')) t = clamp(s(t + dy), 0, b - minH);
  if (handle.includes('s')) b = clamp(s(b + dy), t + minH, bounds.h);
  return { ...el, x: l, y: t, w: r - l, h: b - t };
}

export type Align = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Line up the selected elements on the edge / centre of the selection. */
export function alignElements(screen: HmiScreen, ids: string[], how: Align): HmiScreen {
  const sel = screen.elements.filter((e) => ids.includes(e.id));
  if (sel.length < 2) return screen;
  const left = Math.min(...sel.map((e) => e.x));
  const right = Math.max(...sel.map((e) => e.x + e.w));
  const top = Math.min(...sel.map((e) => e.y));
  const bottom = Math.max(...sel.map((e) => e.y + e.h));
  const place = (e: HmiElement): HmiElement => {
    switch (how) {
      case 'left': return { ...e, x: left };
      case 'right': return { ...e, x: right - e.w };
      case 'hcenter': return { ...e, x: Math.round((left + right) / 2 - e.w / 2) };
      case 'top': return { ...e, y: top };
      case 'bottom': return { ...e, y: bottom - e.h };
      case 'vcenter': return { ...e, y: Math.round((top + bottom) / 2 - e.h / 2) };
    }
  };
  return { ...screen, elements: screen.elements.map((e) => (ids.includes(e.id) ? place(e) : e)) };
}

/** Equal gaps between three or more elements, horizontally or vertically (first and last stay put). */
export function distributeElements(screen: HmiScreen, ids: string[], axis: 'h' | 'v'): HmiScreen {
  const sel = screen.elements.filter((e) => ids.includes(e.id));
  if (sel.length < 3) return screen;
  const pos = (e: HmiElement) => (axis === 'h' ? e.x : e.y);
  const size = (e: HmiElement) => (axis === 'h' ? e.w : e.h);
  const sorted = [...sel].sort((a, b) => pos(a) - pos(b));
  const start = pos(sorted[0]);
  const end = pos(sorted[sorted.length - 1]) + size(sorted[sorted.length - 1]);
  const gap = (end - start - sorted.reduce((n, e) => n + size(e), 0)) / (sorted.length - 1);
  const next = new Map<string, number>();
  let at = start;
  for (const e of sorted) { next.set(e.id, Math.round(at)); at += size(e) + gap; }
  return { ...screen, elements: screen.elements.map((e) => (next.has(e.id) ? (axis === 'h' ? { ...e, x: next.get(e.id)! } : { ...e, y: next.get(e.id)! }) : e)) };
}

/** Copies of the selected elements, one grid step down and right; returns the new screen and new ids. */
export function duplicateElements(screen: HmiScreen, ids: string[], makeId: () => string, bounds: Bounds, grid = GRID): { screen: HmiScreen; ids: string[] } {
  const copies = screen.elements.filter((e) => ids.includes(e.id)).map((e) => ({
    ...structuredClone(e), id: makeId(),
    x: clamp(e.x + grid * 2, 0, Math.max(0, bounds.w - e.w)), y: clamp(e.y + grid * 2, 0, Math.max(0, bounds.h - e.h)),
  }));
  return { screen: { ...screen, elements: [...screen.elements, ...copies] }, ids: copies.map((c) => c.id) };
}

export function deleteElements(screen: HmiScreen, ids: string[]): HmiScreen {
  return { ...screen, elements: screen.elements.filter((e) => !ids.includes(e.id)) };
}

/** Elements whose box intersects the rectangle (marquee selection). */
export function elementsInRect(screen: HmiScreen, x1: number, y1: number, x2: number, y2: number): string[] {
  const [l, r] = [Math.min(x1, x2), Math.max(x1, x2)];
  const [t, b] = [Math.min(y1, y2), Math.max(y1, y2)];
  return screen.elements.filter((e) => e.x < r && e.x + e.w > l && e.y < b && e.y + e.h > t).map((e) => e.id);
}

// ── Undo / redo ─────────────────────────────────────────────────────────────

export interface History<T> { past: T[]; present: T; future: T[] }

export const historyOf = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** Record a new state (drops the redo branch); identical states are not recorded. */
export function record<T>(h: History<T>, next: T, limit = 100): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}
export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}
export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

// ── Tags for hand-placed elements ───────────────────────────────────────────

const BIT = /^(X|Y|C|T|CT|SC)\d+$/;
const tagName = (label: string, address: string) => (label.trim() || address).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || address;

/**
 * Tags for addresses used on the screens but missing from the tag list, so the
 * PLC program implements them (adding tags marks the program out of date).
 */
export function missingTags(design: HmiDesign, describe: (address: string) => string | undefined): HmiTag[] {
  const known = new Set(design.tags.map((t) => t.address.toUpperCase()));
  const out: HmiTag[] = [];
  for (const sc of design.screens) for (const e of sc.elements) {
    for (const [addr, role] of [[e.address, 'main'], [e.interlock ?? null, 'interlock']] as const) {
      if (!addr) continue;
      const a = addr.toUpperCase();
      // Physical inputs/outputs are wired I/O the program already handles; only internal memory needs a tag.
      if (known.has(a) || /^[XY]\d+$/.test(a)) continue;
      known.add(a);
      const writes = role === 'main' && (e.kind === 'button' || e.kind === 'numeric-entry');
      const reads = role === 'interlock' || e.kind !== 'button';
      out.push({
        name: tagName(role === 'interlock' ? `${e.label} permissive` : e.label, a),
        address: a,
        dataType: BIT.test(a) ? 'BIT' : a.startsWith('DD') ? 'INT2' : a.startsWith('DF') ? 'FLOAT' : 'INT',
        access: writes && e.kind === 'numeric-entry' ? 'read-write' : writes ? 'write' : reads ? 'read' : 'read-write',
        description: `${describe(a) ? `${describe(a)}. ` : ''}${role === 'interlock' ? 'Permissive for' : 'Shown by'} "${e.label}" on screen "${sc.name}" (placed by hand).`,
      });
    }
  }
  return out;
}

const HAND_MARK = '(placed by hand).';

/**
 * Keep the tag list in step with hand-placed elements: add tags for new addresses,
 * drop tags this editor added whose address is no longer used on any screen.
 */
export function syncHandTags(design: HmiDesign, describe: (address: string) => string | undefined): HmiDesign {
  const used = new Set(design.screens.flatMap((s) => s.elements.flatMap((e) => [e.address, e.interlock ?? null, ...(e.symbols ?? []).map((x) => x.address)]))
    .filter((a): a is string => Boolean(a)).map((a) => a.toUpperCase()));
  const kept = design.tags.filter((t) => !t.description.endsWith(HAND_MARK) || used.has(t.address.toUpperCase()));
  const base = kept.length === design.tags.length ? design : { ...design, tags: kept };
  const add = missingTags(base, describe);
  return add.length ? { ...base, tags: [...base.tags, ...add] } : base;
}
