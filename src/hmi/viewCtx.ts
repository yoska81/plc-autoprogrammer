import type { HmiDesign, HmiElement, HmiScreen, HmiState } from './types';
import type { HmiRuntime } from './runtime';
import type { HmiTheme } from './theme';

/** Shared state and helpers of the screen renderer (console and panel looks). */

export interface AlarmRow { message: string; severity: 'alarm' | 'warning'; on: number | null; off: number | null; active: boolean }

export interface Ctx {
  screen: HmiScreen;
  design?: HmiDesign;
  read?: (address: string) => boolean | number;
  live: boolean;
  now: number;
  rows: AlarmRow[];
  activeCount: number;
  runtime?: HmiRuntime;
  /** Colours, font and text style of the design's look. */
  t: HmiTheme;
}

/** Element kinds the panel looks draw with their own shapes (the rest share the generic renderer). */
export const PANEL_KINDS = new Set<HmiElement['kind']>([
  'header', 'panel', 'button', 'nav', 'indicator', 'multistate', 'numeric', 'numeric-entry', 'bar', 'trend', 'alarm-list', 'alarm-banner', 'datetime', 'text',
]);

/** Register values: integers as-is, floating point (DF, analog in engineering units) to one decimal. */
export const showNum = (v: number) => (Number.isInteger(v) || !Number.isFinite(v) ? String(v) : v.toFixed(1));

export const stateFor = (states: HmiState[] | undefined, v: number): HmiState | null =>
  (states ?? []).find((s) => s.value === v) ?? null;

/**
 * Alarm limits of a bar (its `limits` addresses) as fractions of the bar, live only (a static view
 * has no values), and whether the value is beyond one of them.
 */
export function barLimits(el: HmiElement, ctx: Ctx, v: number): { marks: number[]; beyond: boolean } {
  if (!el.limits || !ctx.read) return { marks: [], beyond: false };
  const min = el.min ?? 0, max = el.max ?? 100, span = max - min || 1;
  const num = (a?: string | null) => { if (!a) return null; const x = Number(ctx.read!(a)); return Number.isFinite(x) && x !== 0 ? x : null; };
  const hi = num(el.limits.hi), lo = num(el.limits.lo);
  const marks = [hi, lo].filter((x): x is number => x !== null && x > min && x < max).map((x) => (x - min) / span);
  return { marks, beyond: (hi !== null && v >= hi) || (lo !== null && v <= lo) };
}
