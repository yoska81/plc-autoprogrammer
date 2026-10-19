/**
 * The touch panel to move to when the current one cannot stay (leaving an all-in-one PLC takes its built-in
 * screen with it): a panel that talks to the new PLC, current (not legacy), closest in resolution, so the
 * designed screens are scaled as little as possible. Preferred makers first.
 */
import { HMI_MODELS, designable, hmiMaker, type HmiModel } from './hmiCatalog';
import { catalogPanels } from './panels';
import { hmiFit, type Need } from '../plc/core/fit';

export function nearestPanel(cpuId: string, need: Need, from: { w: number; h: number } | null, makers: string[] = []): HmiModel | null {
  const all = [...HMI_MODELS, ...catalogPanels().flatMap((o) => (o.model && o.part.category === 'hmi' ? [o.model] : []))];
  const ok = all.filter((m) => designable(m) && !m.legacy && hmiFit(m, need, cpuId).ok);
  if (!ok.length) return null;
  const pref = (m: HmiModel) => (makers.some((k) => hmiMaker(m).toLowerCase().includes(k.toLowerCase())) ? 0 : 1);
  const dist = (m: HmiModel) => (from ? Math.abs(Math.log(m.widthPx / from.w)) + Math.abs(Math.log(m.heightPx / from.h)) : -m.sizeIn);
  return [...ok].sort((a, b) => pref(a) - pref(b) || dist(a) - dist(b))[0];
}
