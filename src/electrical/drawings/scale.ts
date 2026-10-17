/** Drawing scales for the layout sheets (pure helpers). */
import type { DrawingPlan } from './plan';

const NICE = [1, 1 / 1.5, 1 / 2, 1 / 2.5, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 12, 1 / 15, 1 / 20, 1 / 25];

/** Largest standard scale not exceeding maxS. */
export function niceScale(maxS: number): number {
  return NICE.find((s) => s <= maxS) ?? NICE[NICE.length - 1];
}

export function scaleText(s: number): string {
  const d = 1 / s;
  return `1:${Number.isInteger(d) ? d : d.toFixed(1)}`;
}

export function panelScale(plan: DrawingPlan): number {
  const e = plan.layout.enclosure;
  return niceScale(Math.min(200 / e.w, 176 / e.h));
}

export function doorScale(plan: DrawingPlan): number {
  const e = plan.layout.door;
  return niceScale(Math.min(160 / e.w, 176 / e.h));
}

/** Scale for the machining (drilling / cutout) sheets. */
export function drillScale(w: number, h: number): number {
  return niceScale(Math.min(240 / w, 168 / h));
}

/** Scale of a machining drawing sheet: leaves room below the part for the dual-dimension ordinates. */
export const drillSheetScale = (d: { w: number; h: number }) => drillScale(d.w, d.h * (168 / 150));

/** Machine layout sheet drawing window (mm). */
export const LAYOUT_DW = 272;
export const LAYOUT_DH = 187;
const LAYOUT_DENOM = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000];

/** Scale denominator (1:n) of the machine layout sheet, or null without a layout. */
export function machineLayoutScale(plan: DrawingPlan): number | null {
  const ml = plan.ctx.machineLayout;
  if (!ml || ml.sizeM.w <= 0 || ml.sizeM.h <= 0) return null;
  const mmPerM = Math.min(LAYOUT_DW / ml.sizeM.w, LAYOUT_DH / ml.sizeM.h);
  return LAYOUT_DENOM.find((d) => 1000 / d <= mmPerM) ?? LAYOUT_DENOM[LAYOUT_DENOM.length - 1];
}
