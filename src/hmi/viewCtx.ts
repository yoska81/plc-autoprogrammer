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
