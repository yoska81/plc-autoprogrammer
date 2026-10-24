import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { refreshChecks } from './actions';
import { statusOf, useReviewStore } from './useReviewStore';

/** Deliverables page: open design review findings before anything is sent out. */
export default function ReviewCard() {
  const { checks, ai, marks } = useReviewStore();
  useEffect(() => { refreshChecks(); }, []);
  const open = [...checks, ...(ai?.findings ?? [])].filter((f) => statusOf(marks, f.id) === 'open');
  const crit = open.filter((f) => f.severity === 'critical').length;
  const major = open.filter((f) => f.severity === 'major').length;
  const tone = crit ? 'border-red-300 bg-red-50' : major ? 'border-amber-300 bg-amber-50' : 'border-steel-200 bg-white';
  return (
    <div className={`flex flex-wrap items-center gap-4 rounded-sm border p-5 ${tone}`}>
      <div className="min-w-64 flex-1">
        <h3 className="text-sm font-semibold text-steel-800">Design review</h3>
        <p className="text-xs text-steel-600">
          {open.length ? `${open.length} open finding${open.length === 1 ? '' : 's'}${crit || major ? ` (${crit} critical, ${major} major)` : ''}` : 'No open findings'}
          {' · '}{ai ? `AI review run ${new Date(ai.at).toLocaleDateString()}` : 'AI review not run yet'}. The findings and their resolutions are printed in the engineering package (Appendix C) and the Excel report.
        </p>
      </div>
      <Link to="/review" className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Open design review</Link>
    </div>
  );
}
