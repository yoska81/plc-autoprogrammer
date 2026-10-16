import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionList from '../components/questions/QuestionList';
import { useQuestions, useSyncQuestions } from '../components/questions/useQuestionStore';
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon, SparklesIcon } from '@heroicons/react/20/solid';
import { collectProject } from '../deliverables/collect';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSettingsStore, activeCredentials } from '../store/useSettingsStore';
import { Spinner } from '../components/common';
import { fixText, refreshChecks } from './actions';
import { runAiReview } from './reviewAI';
import { statusOf, useReviewStore } from './useReviewStore';
import { AREA_LABEL, SEVERITY_LABEL, SEVERITY_ORDER, pageRoute, sortFindings, type Finding, type FindingStatus, type ReviewArea, type Severity } from './types';
import { startAiJob, useAiJobError, useAiJobRunning } from '../lib/ai/jobs';

const SEV_STYLE: Record<Severity, string> = {
  critical: 'bg-red-600 text-white',
  major: 'bg-amber-500 text-amber-950',
  minor: 'bg-sky-100 text-sky-800',
  info: 'bg-steel-100 text-steel-600',
};
const STATUS_STYLE: Record<FindingStatus, string> = { open: 'text-steel-700', resolved: 'text-emerald-700', ignored: 'text-steel-400' };

function Row({ f, onGo, onFix }: { f: Finding; onGo: () => void; onFix: (() => void) | null }) {
  const marks = useReviewStore((s) => s.marks);
  const mark = useReviewStore((s) => s.mark);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [marking, setMarking] = useState<FindingStatus | null>(null);
  const st = statusOf(marks, f.id);
  const m = marks[f.id];
  return (
    <>
      <tr className={`border-t border-steel-100 align-top ${st !== 'open' ? 'opacity-60' : ''}`}>
        <td className="py-2 pl-3 pr-2"><span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold uppercase ${SEV_STYLE[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span></td>
        <td className="py-2 pr-2 text-steel-600 whitespace-nowrap">{AREA_LABEL[f.area]}</td>
        <td className="py-2 pr-2">
          <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-start gap-1 text-left font-medium text-steel-900 hover:underline">
            {open ? <ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{f.title}</span>
          </button>
          {open && (
            <div className="mt-1 space-y-1 pl-5 text-[12.5px] text-steel-700">
              <p>{f.detail}</p>
              <p><span className="font-semibold text-steel-800">Fix: </span>{f.fix}</p>
              {m && <p className="text-steel-500">{m.status === 'resolved' ? 'Resolved' : 'Ignored'}: {m.reason || '—'} · {new Date(m.at).toLocaleString()}</p>}
            </div>
          )}
        </td>
        <td className="py-2 pr-2 text-[11px] text-steel-500 whitespace-nowrap">{f.source === 'ai' ? 'AI review' : 'Check'}</td>
        <td className={`py-2 pr-2 text-[12px] font-medium capitalize whitespace-nowrap ${STATUS_STYLE[st]}`}>{st}</td>
        <td className="py-2 pr-3">
          <div className="flex flex-wrap justify-end gap-1">
            <button type="button" onClick={onGo} className="rounded border border-steel-300 px-2 py-0.5 text-[12px] hover:bg-steel-50">Go to</button>
            {onFix && st === 'open' && (
              <button type="button" onClick={onFix} title="Opens the stage's AI fix with this finding; you approve the proposed change there"
                className="rounded border border-brand-600 bg-brand-600 px-2 py-0.5 text-[12px] font-semibold text-white hover:bg-brand-700">Ask AI to fix</button>
            )}
            {st === 'open' ? (
              <>
                <button type="button" onClick={() => setMarking('resolved')} className="rounded border border-steel-300 px-2 py-0.5 text-[12px] hover:bg-emerald-50">Resolved</button>
                <button type="button" onClick={() => setMarking('ignored')} className="rounded border border-steel-300 px-2 py-0.5 text-[12px] hover:bg-steel-50">Ignore</button>
              </>
            ) : (
              <button type="button" onClick={() => mark(f.id, 'open', '')} className="rounded border border-steel-300 px-2 py-0.5 text-[12px] hover:bg-steel-50">Reopen</button>
            )}
          </div>
        </td>
      </tr>
      {marking && (
        <tr className="bg-steel-50">
          <td colSpan={6} className="px-3 py-2">
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); mark(f.id, marking, reason.trim()); setMarking(null); setReason(''); }}>
              <label className="text-[12px] font-medium text-steel-700" htmlFor={`r-${f.id}`}>{marking === 'resolved' ? 'How was it resolved?' : 'Why is it acceptable?'}</label>
              <input id={`r-${f.id}`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown in the engineering package)"
                className="flex-1 rounded border border-steel-300 px-2 py-1 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button type="submit" disabled={!reason.trim()} className="rounded bg-brand-600 px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-40">Save</button>
              <button type="button" onClick={() => setMarking(null)} className="rounded border border-steel-300 px-3 py-1 text-[12px]">Cancel</button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { checks, checkedAt, ai, marks, requestFix } = useReviewStore();
  const settings = useSettingsStore();
  const { apiKey, model } = activeCredentials(settings);
  // Global AI job: the review keeps running when the user leaves this page.
  const busy = useAiJobRunning('review');
  const error = useAiJobError('review');
  const [sev, setSev] = useState<Set<Severity>>(new Set(SEVERITY_ORDER));
  const [area, setArea] = useState<ReviewArea | 'all'>('all');
  const [source, setSource] = useState<'all' | 'check' | 'ai'>('all');
  const [status, setStatus] = useState<FindingStatus | 'all'>('open');
  const [q, setQ] = useState('');

  // The checks are instant: run them every time the page opens.
  useEffect(() => { refreshChecks(); }, []);

  const all = useMemo(() => sortFindings([...checks, ...(ai?.findings ?? [])]), [checks, ai]);
  // Info findings that need the user's input become questions (electrical / HMI notes are already asked on their pages).
  useSyncQuestions('review', all.filter((f) => f.severity === 'info' && !/^(enote|hnote|empty):/.test(f.id) && /confirm|\?|provide|unknown|not (stated|known|given)|to be /i.test(`${f.title} ${f.detail}`))
    .map((f) => ({ text: f.detail && f.detail !== f.title ? `${f.title}: ${f.detail}` : f.title, assumption: f.fix || undefined })));
  const allQuestions = useQuestions();
  const shown = all.filter((f) => sev.has(f.severity) && (area === 'all' || f.area === area) && (source === 'all' || f.source === source)
    && (status === 'all' || statusOf(marks, f.id) === status) && (!q.trim() || `${f.title} ${f.detail}`.toLowerCase().includes(q.toLowerCase())));
  const openCount = (s: Severity) => all.filter((f) => f.severity === s && statusOf(marks, f.id) === 'open').length;

  const runAi = () => {
    const det = refreshChecks();
    const snapshot = collectProject();
    void startAiJob({
      kind: 'review', label: 'AI design review',
      run: (h) => runAiReview({ provider: settings.provider, apiKey, model, effort: settings.effort, signal: h.signal }, snapshot, det),
      apply: (r) => useReviewStore.getState().setAi(r),
    });
  };

  const fixFor = (f: Finding): (() => void) | null => {
    if (f.severity === 'info') return null;
    if (f.page === 'program') return () => { requestFix({ stage: 'program', text: fixText(f), findingId: f.id }); navigate('/program?tab=fix'); };
    if (f.page === 'electrical' && useElectricalStore.getState().design) return () => {
      const el = useElectricalStore.getState();
      const notes = el.inputs.notes?.trim();
      el.setInputs({ ...el.inputs, notes: `${notes ? `${notes}\n` : ''}${fixText(f)}` });
      navigate('/electrical?tab=design&from=review');
    };
    return null;
  };

  const chip = (on: boolean) => `rounded px-2 py-0.5 text-[12px] font-semibold border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-steel-300 bg-white text-steel-600 hover:bg-steel-50'}`;
  const areas = [...new Set(all.map((f) => f.area))];

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-steel-200 bg-white px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-steel-800">8 · Design review</h2>
          <p className="mt-0.5 text-xs text-steel-500">A checking engineer's pass over the whole project before anything is built: instant consistency checks plus an AI senior-engineer review. Resolve or justify every finding; the result goes into the engineering package.</p>
        </div>
        <button type="button" onClick={() => refreshChecks()} className="inline-flex items-center gap-1 rounded border border-steel-300 bg-white px-3 py-1.5 text-sm hover:bg-steel-50">
          <ArrowPathIcon className="h-4 w-4" /> Re-run checks
        </button>
        <button type="button" onClick={runAi} disabled={busy || !apiKey}
          className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {busy ? <><Spinner /> Reviewing…</> : <><SparklesIcon className="h-4 w-4" /> {ai ? 'Re-run AI review' : 'Run AI review'}</>}
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!apiKey && <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">Add your API key in Settings to run the AI review. The checks below work without it.</div>}
        {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>AI review failed:</b> {error}</div>}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SEVERITY_ORDER.map((s) => (
            <div key={s} className="rounded border border-steel-200 bg-white p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-steel-500">{SEVERITY_LABEL[s]} open</div>
              <div className={`text-2xl font-semibold ${openCount(s) && (s === 'critical' || s === 'major') ? (s === 'critical' ? 'text-red-600' : 'text-amber-600') : 'text-steel-800'}`}>{openCount(s)}</div>
            </div>
          ))}
        </div>

        <div className="rounded border border-steel-200 bg-white p-3 text-sm text-steel-700">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-steel-500">
            <span>Checks: {checks.length} finding{checks.length === 1 ? '' : 's'}{checkedAt ? ` · ${new Date(checkedAt).toLocaleString()}` : ''}</span>
            <span>AI review: {ai ? `${ai.findings.length} finding${ai.findings.length === 1 ? '' : 's'} · ${new Date(ai.at).toLocaleString()}` : 'not run yet'}</span>
          </div>
          {ai?.summary && <p className="mt-1.5"><span className="font-semibold text-steel-800">Reviewer's verdict: </span>{ai.summary}</p>}
        </div>

        <QuestionList questions={allQuestions} title="Questions to answer (all stages)" showSource
          intro="Every open question and assumption from the machine description, I/O, electrical design, HMI and this review, each with its answer box right under it. Answers are saved in the Questions & answers of the machine description (part of the spec); the affected stages become out of date so Update uses them." />

        <div className="flex flex-wrap items-center gap-1.5 rounded border border-steel-200 bg-white px-3 py-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-steel-500">Severity</span>
          {SEVERITY_ORDER.map((s) => (
            <button key={s} type="button" aria-pressed={sev.has(s)} className={chip(sev.has(s))}
              onClick={() => setSev((x) => { const n = new Set(x); if (n.has(s)) n.delete(s); else n.add(s); return n; })}>{SEVERITY_LABEL[s]}</button>
          ))}
          <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value as ReviewArea | 'all')} className="ml-2 rounded border border-steel-300 px-2 py-0.5 text-[12px]">
            <option value="all">All areas</option>
            {areas.map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
          </select>
          <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value as 'all' | 'check' | 'ai')} className="rounded border border-steel-300 px-2 py-0.5 text-[12px]">
            <option value="all">Checks and AI</option><option value="check">Checks only</option><option value="ai">AI review only</option>
          </select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as FindingStatus | 'all')} className="rounded border border-steel-300 px-2 py-0.5 text-[12px]">
            <option value="open">Open</option><option value="resolved">Resolved</option><option value="ignored">Ignored</option><option value="all">All statuses</option>
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search findings" className="ml-auto w-48 rounded border border-steel-300 px-2 py-0.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>

        <div className="overflow-x-auto rounded border border-steel-200 bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f7f8f9] text-[11px] uppercase tracking-wide text-steel-500">
              <tr>
                <th className="py-1.5 pl-3 pr-2 text-left font-semibold">Severity</th>
                <th className="pr-2 text-left font-semibold">Area</th>
                <th className="pr-2 text-left font-semibold">Finding</th>
                <th className="pr-2 text-left font-semibold">Source</th>
                <th className="pr-2 text-left font-semibold">Status</th>
                <th className="pr-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => <Row key={f.id} f={f} onGo={() => navigate(pageRoute(f.page, f.item) + (f.page === 'program' && f.item ? `?rung=${encodeURIComponent(f.item)}` : ''))} onFix={fixFor(f)} />)}
              {!shown.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-steel-500">{all.length ? 'No findings match the filters.' : 'No findings. Run the AI review for a senior-engineer pass.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
