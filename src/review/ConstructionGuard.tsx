import { Link } from 'react-router-dom';
import type { Finding } from './types';
import { useDraft } from '../store/useDraftStore';

/**
 * Shown instead of issuing a revision "for construction" while critical design
 * review findings are open. The override needs a reason; the caller records it.
 */
export default function ConstructionGuard({ findings, rev, onCancel, onOverride }: {
  findings: Finding[]; rev: string; onCancel: () => void; onOverride: (reason: string) => void;
}) {
  const [reason, setReason] = useDraft('construction.reason', '');
  return (
    <div role="alertdialog" aria-label="Critical findings open" className="mx-3 mb-3 border border-red-300 bg-red-50 p-3 text-sm text-red-900">
      <p className="font-semibold">Revision {rev} cannot be issued for construction: {findings.length} critical design review finding{findings.length === 1 ? ' is' : 's are'} open.</p>
      <ul className="mt-1 list-disc pl-5 text-[13px]">
        {findings.slice(0, 6).map((f) => <li key={f.id}>{f.title}</li>)}
        {findings.length > 6 && <li>…and {findings.length - 6} more</li>}
      </ul>
      <p className="mt-2 text-[13px]">Fix them on the <Link to="/review" className="font-medium underline">Design review</Link> page (or mark them resolved with how they were fixed). Only override if a qualified engineer has accepted the risk.</p>
      <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onOverride(reason.trim()); }}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Override reason (recorded in the revision history and the engineering package)" aria-label="Override reason"
          className="min-w-72 flex-1 rounded-sm border border-red-300 bg-white px-2 py-1 text-[13px] focus:outline-none focus:ring-2 focus:ring-red-400" />
        <button type="submit" disabled={!reason.trim()} className="rounded-sm border border-red-600 bg-red-600 px-3 py-1 text-[13px] font-medium text-white disabled:opacity-40">Issue anyway</button>
        <button type="button" onClick={onCancel} className="rounded-sm border border-steel-300 bg-white px-3 py-1 text-[13px]">Cancel</button>
      </form>
    </div>
  );
}
