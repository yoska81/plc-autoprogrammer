import { useMemo } from 'react';
import { enclosureFitProblem, withEnclosure, type DrawingContext, type FitOption } from './derive';
import { useElectricalStore } from '../store/useElectricalStore';
import { notify } from '../store/useNoticeStore';

/**
 * Red banner on the Electrical page when parts don't fit the enclosure (back panel or door), with the
 * ways out: a larger enclosure of the same rating, another NEMA 4X material, a relaxed rating, or two
 * enclosures. Never a silent layout with parts left off.
 */
export default function EnclosureFitBanner({ ctx }: { ctx: DrawingContext }) {
  const problem = useMemo(() => { try { return enclosureFitProblem(ctx); } catch { return null; } }, [ctx]);
  if (!problem) return null;
  const apply = (o: FitOption) => {
    const el = useElectricalStore.getState();
    if (!el.design || !o.fit) return;
    const design = withEnclosure(el.design, ctx.getPart, o.fit.enclosure, o.fit.subpanel);
    const inputs = o.rating ? { ...design.inputs, enclosureRating: o.rating } : design.inputs;
    const note = `Enclosure changed to ${o.fit.enclosure}${o.fit.subpanel ? ` with back panel ${o.fit.subpanel}` : ''}${o.rating ? ` (rating relaxed to ${o.rating})` : ''} because the parts did not fit.`;
    // the pick is recorded as the designer's enclosure choice, so regeneration keeps it
    el.setDesign({ ...design, inputs: { ...inputs, enclosurePreference: o.fit.enclosure }, notes: [...design.notes, note] }, el.source ?? 'generated', el.explanation);
    el.setInputs({ ...el.inputs, enclosurePreference: o.fit.enclosure, ...(o.rating ? { enclosureRating: o.rating } : {}) });
    notify(note);
  };
  const what = [
    problem.notFit.length ? `${problem.notFit.map((n) => `${n.tag} (${n.partNumber})`).join(', ')} ${problem.notFit.length === 1 ? 'does' : 'do'} not fit the back panel` : '',
    problem.door ? 'the door devices do not fit the door' : '',
  ].filter(Boolean).join('; ');
  return (
    <div role="alert" data-testid="enclosure-fit-banner" className="mx-6 mt-3 rounded border-2 border-red-600 bg-red-50 px-4 py-3">
      <p className="text-sm font-semibold text-red-800">Parts don't fit the enclosure: {what}.</p>
      <p className="text-xs text-red-700 mt-0.5">The drawings, the cabinet picture and the machining files leave these parts out until this is fixed. Choose one:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {problem.options.map((o) => o.fit ? (
          <button key={o.kind} onClick={() => apply(o)} title={o.detail} className="px-3 py-1.5 text-sm bg-red-700 text-white rounded hover:bg-red-800">{o.label}</button>
        ) : (
          <span key={o.kind} title={o.detail} className="px-3 py-1.5 text-sm border border-red-300 text-red-800 rounded bg-white">{o.label}: {o.detail}</span>
        ))}
      </div>
    </div>
  );
}
