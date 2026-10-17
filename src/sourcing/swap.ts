/**
 * Swapping a part: every design component with that part number takes the replacement; the drawing
 * model (wiring, layout, SCCR, heat, BOM, drawings) is derived from the design, so it follows. The
 * impact compares the model before and after, so the user sees what changed.
 */
import { billOfMaterials, designWarnings, panelLayout, wireNumbers, type DrawingContext } from '../electrical/derive';
import { panelSccr } from '../electrical/sccr';
import { cabinetHeat } from '../electrical/thermal';
import type { ElectricalDesign } from '../electrical/types';

/** The design with `from` replaced by `to` in every component (and the required parts list). */
export function swapInDesign(design: ElectricalDesign, from: string, to: string): ElectricalDesign {
  const k = from.trim().toUpperCase();
  return {
    ...design,
    components: design.components.map((c) => (c.partNumber.trim().toUpperCase() === k ? { ...c, partNumber: to } : c)),
    inputs: { ...design.inputs, requiredParts: design.inputs.requiredParts.map((r) => (r.partNumber.trim().toUpperCase() === k ? { ...r, partNumber: to } : r)) },
  };
}

export interface ImpactLine { what: string; before: string; after: string; level: 'good' | 'bad' | 'neutral' }

const kA = (v: number | null) => (v === null ? 'not known' : `${v} kA`);

/** What a design change does to the panel: SCCR, enclosure fit, heat, wiring, BOM and warnings. */
export function impactOf(before: DrawingContext, after: DrawingContext): ImpactLine[] {
  const out: ImpactLine[] = [];
  const s0 = panelSccr(before), s1 = panelSccr(after);
  if (s0.lowest !== s1.lowest || s0.limiting.join() !== s1.limiting.join()) {
    out.push({ what: 'Panel SCCR (weakest part)', before: `${kA(s0.lowest)}${s0.limiting.length ? ` (${s0.limiting.join(', ')})` : ''}`, after: `${kA(s1.lowest)}${s1.limiting.length ? ` (${s1.limiting.join(', ')})` : ''}`,
      level: (s1.lowest ?? -1) > (s0.lowest ?? -1) ? 'good' : (s1.lowest ?? -1) < (s0.lowest ?? -1) ? 'bad' : 'neutral' });
  }
  const l0 = panelLayout(before), l1 = panelLayout(after);
  const fit = (l: typeof l0) => (l.overflow || l.notFit.length ? `does not fit (${l.notFit.map((n) => n.tag).join(', ') || 'overflow'})` : 'fits');
  if (fit(l0) !== fit(l1)) out.push({ what: 'Back panel', before: fit(l0), after: fit(l1), level: l1.overflow || l1.notFit.length ? 'bad' : 'good' });
  const h0 = cabinetHeat(before.design.components, before.getPart), h1 = cabinetHeat(after.design.components, after.getPart);
  if (Math.round(h0.watts) !== Math.round(h1.watts)) out.push({ what: 'Heat in the cabinet', before: `${Math.round(h0.watts)} W`, after: `${Math.round(h1.watts)} W`, level: h1.watts > h0.watts ? 'bad' : 'good' });
  const sizes = (c: DrawingContext) => wireNumbers(c).map((w) => `${w.wire}|${w.from}|${w.to}|${w.size}`);
  const w0 = new Set(sizes(before)), w1 = sizes(after);
  const changedWires = w1.filter((w) => !w0.has(w)).length;
  if (changedWires) out.push({ what: 'Wiring', before: `${w0.size} wires`, after: `${w1.length} wires, ${changedWires} new or changed`, level: 'neutral' });
  const bom = (c: DrawingContext) => billOfMaterials(c).flatMap((g) => g.lines.map((l) => `${l.qty}× ${l.partNumber}`)).filter((x) => !x.endsWith('× '));
  const b0 = new Set(bom(before)), b1 = new Set(bom(after));
  const added = [...b1].filter((x) => !b0.has(x)), removed = [...b0].filter((x) => !b1.has(x));
  if (added.length || removed.length) out.push({ what: 'Bill of materials', before: removed.join(', ') || '—', after: added.join(', ') || '—', level: 'neutral' });
  out.push(...mountingBreaks(before, after));
  const d0 = new Set(designWarnings(before)), d1 = designWarnings(after);
  const newWarnings = d1.filter((w) => !d0.has(w)), gone = [...d0].filter((w) => !d1.includes(w));
  for (const w of newWarnings) out.push({ what: 'New design warning', before: '—', after: w, level: 'bad' });
  for (const w of gone) out.push({ what: 'Warning cleared', before: w, after: '—', level: 'good' });
  return out;
}

/**
 * Accessories that mount on a swapped part (an overload on its contactor, an aux block, a handle on a
 * disconnect): their "forUse" names the old part's series; when it does not name the new part's, the
 * accessory no longer fits.
 */
function mountingBreaks(before: DrawingContext, after: DrawingContext): ImpactLine[] {
  const out: ImpactLine[] = [];
  const pns = (c: DrawingContext) => new Set(c.design.components.map((x) => x.partNumber));
  const gone = [...pns(before)].filter((pn) => !pns(after).has(pn));
  const added = [...pns(after)].filter((pn) => !pns(before).has(pn));
  if (!gone.length || !added.length) return out;
  // Series stem of a part number: "SC-E02PG-24VDC" → "SC-E0", "100-C09EJ10" → "100-C".
  const stem = (pn: string) => pn.toUpperCase().replace(/^([A-Z0-9]+-?[A-Z]+\d?).*$/, '$1');
  for (const c of after.design.components) {
    const forUse = String(after.getPart(c.partNumber)?.ratings.forUse ?? '').toUpperCase();
    if (!forUse) continue;
    const fitsOld = gone.some((pn) => forUse.includes(stem(pn)));
    const fitsNew = added.some((pn) => forUse.includes(stem(pn)));
    if (fitsOld && !fitsNew) out.push({ what: `${c.tag} ${c.partNumber} no longer fits`, before: `mounts on ${gone.join(', ')}`, after: `made for ${String(after.getPart(c.partNumber)?.ratings.forUse)}: swap it too`, level: 'bad' });
  }
  return out;
}
