/**
 * Changing the touch panel keeps the designed screens: every element (and machine symbol) is
 * scaled from the old panel's resolution to the new one's, and the design is moved to the new
 * panel. Touch targets keep at least the minimum touch size; the layout check reports anything
 * that no longer fits, so a very different aspect ratio may still need a redesign.
 */
import { useHmiStore } from '../store/useHmiStore';
import { useStageStore } from '../store/useStageStore';
import { getHmi } from './hmiCatalog';
import { MIN_TOUCH } from './layout';
import type { HmiDesign, HmiElement } from './types';
import { fingerprint } from '../spec/types';

const TOUCH: HmiElement['kind'][] = ['button', 'nav', 'numeric-entry'];

export function retargetDesign(design: HmiDesign, from: { w: number; h: number }, to: { w: number; h: number }, partNumber: string): HmiDesign {
  // Scale from the screens as they were before the first switch while they are untouched since: 7" → 4.3" → 7"
  // gives the 7" screens back exactly instead of a twice-rounded copy with minimum touch sizes baked in.
  const lb = design.layoutBase;
  const base = lb && fingerprint(design.screens) === lb.after ? lb : { w: from.w, h: from.h, screens: design.screens };
  const rest = { ...design };
  delete rest.layoutBase;
  if (base.w === to.w && base.h === to.h) return { ...rest, hmiPartNumber: partNumber, screens: base.screens };
  const scaled = scaleScreens(base.screens, base, to);
  return { ...rest, hmiPartNumber: partNumber, screens: scaled, layoutBase: { w: base.w, h: base.h, screens: base.screens, after: fingerprint(scaled) } };
}

function scaleScreens(screens: HmiDesign['screens'], from: { w: number; h: number }, to: { w: number; h: number }): HmiDesign['screens'] {
  const sx = to.w / from.w, sy = to.h / from.h;
  const scaleEl = (e: HmiElement): HmiElement => {
    const minW = TOUCH.includes(e.kind) ? MIN_TOUCH.w : 1, minH = TOUCH.includes(e.kind) ? MIN_TOUCH.h : 1;
    const w = Math.max(minW, Math.round(e.w * sx)), h = Math.max(minH, Math.round(e.h * sy));
    const x = Math.min(Math.max(0, Math.round(e.x * sx)), Math.max(0, to.w - w));
    const y = Math.min(Math.max(0, Math.round(e.y * sy)), Math.max(0, to.h - h));
    return {
      ...e, x, y, w, h,
      ...(e.symbols ? { symbols: e.symbols.map((s) => ({ ...s, x: Math.round(s.x * sx), y: Math.round(s.y * sy), w: Math.max(1, Math.round(s.w * sx)), h: Math.max(1, Math.round(s.h * sy)) })) } : {}),
    };
  };
  return screens.map((s) => ({ ...s, elements: s.elements.map(scaleEl) }));
}

/** Set the project's touch panel; an existing design follows it (scaled to the new resolution). */
export function setProjectPanel(partNumber: string) {
  const st = useHmiStore.getState();
  st.setHmiPartNumber(partNumber);
  const d = st.design;
  if (!d || !partNumber || d.hmiPartNumber === partNumber) return;
  const from = getHmi(d.hmiPartNumber), to = getHmi(partNumber);
  if (!from || !to) return;
  // Older projects did not record the panel their screens were laid out for: it is the one being left.
  const stages = useStageStore.getState();
  const src = stages.sources.hmi;
  if (src && !src.panel) useStageStore.setState({ sources: { ...stages.sources, hmi: { ...src, panel: d.hmiPartNumber } } });
  st.setDesign(retargetDesign(d, { w: from.widthPx, h: from.heightPx }, { w: to.widthPx, h: to.heightPx }, to.partNumber), st.explanation);
}
