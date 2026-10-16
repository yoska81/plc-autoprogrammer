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
  return niceScale(Math.min(250 / e.w, 176 / e.h));
}

export function doorScale(plan: DrawingPlan): number {
  const e = plan.layout.door;
  return niceScale(Math.min(160 / e.w, 176 / e.h));
}
