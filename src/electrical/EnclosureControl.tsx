import { useMemo } from 'react';
import { buildModel, chooseEnclosure, enclosureFamily, enclosurePanelArea, enclosureSize, enclosuresFor, isSubpanel, type DrawingContext } from './derive';
import { useElectricalStore } from '../store/useElectricalStore';
import type { CatalogPart } from './types';

const FAMILY_TEXT = { steel: 'Painted steel', stainless: 'Stainless steel', nonmetallic: 'Fiberglass / polycarbonate' } as const;
type Family = keyof typeof FAMILY_TEXT;

const inMm = (inch: unknown) => (typeof inch === 'number' ? Math.round(inch * 25.4) : '?');
const mountText = (p: CatalogPart) => (/floor|free/i.test(`${p.ratings.mounting ?? ''} ${p.ratings.floorStand ?? ''}`) ? 'floor' : 'wall');
const doorsOf = (p: CatalogPart) => (typeof p.ratings.doors === 'number' ? p.ratings.doors : 1);
const optionText = (p: CatalogPart, rec: boolean) =>
  `${rec ? '★ ' : ''}${p.partNumber} — ${enclosureSize(p)} in (${inMm(p.ratings.heightIn)}×${inMm(p.ratings.widthIn)}×${inMm(p.ratings.depthIn)} mm) · ${doorsOf(p)} door${doorsOf(p) > 1 ? 's' : ''} · ${mountText(p)}${rec ? ' — recommended' : ''}`;

/**
 * The cabinet size, first on the Electrical page: the recommended enclosure (the smallest of the rating and
 * material that holds the parts with the spare-space rule) and every enclosure of that rating / material to pick
 * from, sorted by size. A pick is kept when the parts fit (with a note when it is larger than needed); a pick that is
 * too small is replaced by the smallest that works, with a note, and stays recorded for the next try.
 */
export default function EnclosureControl({ ctx }: { ctx: DrawingContext }) {
  const el = useElectricalStore();
  const rating = ctx.design.inputs.enclosureRating ?? 'NEMA 12';
  const pref = el.inputs.enclosurePreference ?? ctx.design.inputs.enclosurePreference ?? null;
  const cur = useMemo(() => buildModel(ctx).rc.find((c) => c.category === 'enclosure' && !isSubpanel(c))?.part, [ctx]);
  const family: Family = cur ? enclosureFamily(cur) : rating === 'NEMA 4X' ? 'stainless' : 'steel';
  const families = useMemo(() => (['steel', 'stainless', 'nonmetallic'] as Family[]).filter((f) => enclosuresFor(rating, f).length), [rating]);
  const list = useMemo(() => enclosuresFor(rating, family), [rating, family]);
  // the recommendation for the parts as they are now (independent of the enclosure in the design)
  const rec = useMemo(() => { try { return chooseEnclosure(ctx, null).choice.recommended; } catch { return null; } }, [ctx]);
  const recPart = list.find((p) => p.partNumber === rec) ?? (rec ? enclosuresFor(rating).find((p) => p.partNumber === rec) : undefined);

  const pick = (pn: string | null) => {
    const st = useElectricalStore.getState();
    st.setInputs({ ...st.inputs, enclosurePreference: pn });
    if (!st.design) return;
    const { design, choice } = chooseEnclosure({ ...ctx, design: st.design }, pn);
    st.setDesign({ ...design, inputs: { ...design.inputs, enclosurePreference: pn } , enclosureChoice: choice }, st.source ?? 'generated', st.explanation);
  };
  const pickFamily = (f: Family) => {
    const first = (rec && enclosuresFor(rating, f).some((p) => p.partNumber === rec)) ? rec : enclosuresFor(rating, f)[0]?.partNumber;
    if (first) pick(first);
  };

  // What to tell the designer about the enclosure in the design.
  let note: { tone: 'info' | 'warn'; text: string } | null = null;
  if (cur && pref && cur.partNumber !== pref) {
    const p = enclosuresFor(rating).find((x) => x.partNumber === pref) ?? list.find((x) => x.partNumber === pref);
    note = { tone: 'warn', text: `Your size (${enclosureSize(p) || pref}) was too small for the parts; we use ${enclosureSize(cur)} (${cur.partNumber}). Your choice stays recorded — pick it again after removing parts.` };
  } else if (cur && recPart && cur.partNumber !== recPart.partNumber && enclosurePanelArea(cur) > enclosurePanelArea(recPart)) {
    note = { tone: 'info', text: `This cabinet is bigger than needed — the recommended size is ${enclosureSize(recPart)} (${recPart.partNumber}).` };
  } else if (cur && recPart && cur.partNumber !== recPart.partNumber) {
    note = { tone: 'warn', text: `This cabinet holds the parts with less than the normal spare space — the recommended size is ${enclosureSize(recPart)} (${recPart.partNumber}).` };
  }

  return (
    <section data-testid="enclosure-control" className="mx-6 mt-3 rounded border border-steel-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold text-steel-800">Enclosure</h3>
        <span className="text-sm text-steel-700" data-testid="enclosure-current">
          {cur ? <>{cur.partNumber} · {enclosureSize(cur)} in ({inMm(cur.ratings.heightIn)}×{inMm(cur.ratings.widthIn)}×{inMm(cur.ratings.depthIn)} mm) · {rating}</> : 'none in the design'}
          {cur && rec === cur.partNumber && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">recommended</span>}
          {cur && pref === cur.partNumber && rec !== cur.partNumber && <span className="ml-2 rounded bg-steel-100 px-1.5 py-0.5 text-xs text-steel-700">your choice</span>}
        </span>
        <label className="text-xs text-steel-500">Material
          <select aria-label="Enclosure material" value={family} onChange={(e) => pickFamily(e.target.value as Family)} className="ml-1 rounded border border-steel-300 px-1 py-0.5 text-sm text-steel-800">
            {families.map((f) => <option key={f} value={f}>{FAMILY_TEXT[f]}</option>)}
          </select>
        </label>
        <label className="text-xs text-steel-500">Size
          <select aria-label="Enclosure size" value={pref && list.some((p) => p.partNumber === pref) ? pref : ''} onChange={(e) => pick(e.target.value || null)} className="ml-1 max-w-[42rem] rounded border border-steel-300 px-1 py-0.5 text-sm text-steel-800">
            <option value="">Recommended{recPart ? `: ${recPart.partNumber} — ${enclosureSize(recPart)} in` : ''}</option>
            {list.map((p) => <option key={p.partNumber} value={p.partNumber}>{optionText(p, p.partNumber === rec)}</option>)}
          </select>
        </label>
      </div>
      {note && <p data-testid="enclosure-note" className={`mt-1.5 text-xs ${note.tone === 'warn' ? 'text-amber-800' : 'text-steel-600'}`}>{note.text}</p>}
    </section>
  );
}
