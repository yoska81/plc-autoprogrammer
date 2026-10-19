/**
 * A screen's size and geometry as numbers, always: a design that reaches the renderer or the generator without a
 * panel size (a part number the catalog does not know, an old or hand-made design) or with an element missing x / y /
 * w / h is drawn from the next best size instead of with NaN in the SVG (and the PNG / PDF made from it).
 */
import { getHmi } from './hmiCatalog';
import type { HmiDesign, HmiScreen } from './types';

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** The panel size to draw with: the one given, else the design's panel, else the size the screens were laid out for, else what the elements cover (at least 800 × 480). */
export function safeScreenSize(widthPx: unknown, heightPx: unknown, design?: HmiDesign | null, screen?: HmiScreen | null): { w: number; h: number } {
  if (ok(widthPx) && ok(heightPx)) return { w: widthPx, h: heightPx };
  const m = design?.hmiPartNumber ? getHmi(design.hmiPartNumber) : undefined;
  if (m && ok(m.widthPx) && ok(m.heightPx)) return { w: m.widthPx, h: m.heightPx };
  if (ok(design?.layoutBase?.w) && ok(design?.layoutBase?.h)) return { w: design!.layoutBase!.w, h: design!.layoutBase!.h };
  const els = screen?.elements ?? [];
  return { w: Math.max(800, ...els.map((e) => num(e.x) + num(e.w))), h: Math.max(480, ...els.map((e) => num(e.y) + num(e.h))) };
}

/** Element and machine-symbol geometry that is not a number is drawn at 0. Returns the screen itself when all is well. */
export function safeGeometry(screen: HmiScreen): HmiScreen {
  const bad = (o: { x: unknown; y: unknown; w: unknown; h: unknown }) => ![o.x, o.y, o.w, o.h].every((n) => typeof n === 'number' && Number.isFinite(n));
  if (!screen.elements.some((e) => bad(e) || e.symbols?.some(bad))) return screen;
  const fix = <T extends { x: number; y: number; w: number; h: number }>(o: T): T => ({ ...o, x: num(o.x), y: num(o.y), w: num(o.w), h: num(o.h) });
  return { ...screen, elements: screen.elements.map((e) => ({ ...fix(e), ...(e.symbols ? { symbols: e.symbols.map(fix) } : {}) })) };
}
