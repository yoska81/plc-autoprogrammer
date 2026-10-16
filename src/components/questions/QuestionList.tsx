import { useState } from 'react';
import { Spinner } from '../common';
import { quickChoices } from './parse';
import { scheduleMerge } from './merge';
import { SOURCE_LABEL, useActiveProjectId, useQuestionStore, type Question } from './useQuestionStore';

const STATUS: Record<Question['status'], { text: string; cls: string }> = {
  open: { text: 'Open', cls: 'bg-amber-100 text-amber-900' },
  answered: { text: 'Answered', cls: 'bg-green-100 text-green-800' },
  assumed: { text: "AI's assumption used", cls: 'bg-steel-200 text-steel-700' },
};

/** One question with its own answer box directly under it. */
function QuestionCard({ q, n, showSource }: { q: Question; n: number; showSource: boolean }) {
  const projectId = useActiveProjectId();
  const { answer, reopen } = useQuestionStore();
  const [draft, setDraft] = useState(q.answer);
  const [editing, setEditing] = useState(q.status === 'open');
  const choices = quickChoices(q.text);
  const save = (text: string, status: 'answered' | 'assumed') => {
    answer(projectId, q.id, text, status);
    setEditing(false);
    scheduleMerge();
  };
  const st = STATUS[q.status];
  return (
    <li className={`rounded-sm border bg-white ${q.status === 'open' ? 'border-amber-300' : 'border-steel-200'}`} data-question={q.id}>
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <span className="text-xs font-semibold text-steel-400 tabular-nums pt-0.5">{n}.</span>
        <p className="flex-1 text-sm font-medium text-steel-900">{q.text}</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
      </div>
      {showSource && <p className="px-3 pl-8 text-[11px] text-steel-400">From: {SOURCE_LABEL[q.source]}</p>}
      {q.assumption && q.assumption !== q.text && <p className="px-3 pl-8 text-xs text-steel-500">AI's assumption: {q.assumption}</p>}
      <div className="px-3 pb-3 pt-2 pl-8 space-y-2">
        {editing ? (
          <>
            {choices.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick answers">
                {choices.map((c) => (
                  <button key={c} type="button" onClick={() => save(c, 'answered')}
                    className="rounded border border-steel-300 bg-white px-2.5 py-1 text-xs hover:border-brand-600 hover:bg-brand-50">{c}</button>
                ))}
              </div>
            )}
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} aria-label={`Answer to: ${q.text}`}
              placeholder="Type your answer here…"
              className="w-full rounded border border-steel-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!draft.trim()} onClick={() => save(draft.trim(), 'answered')}
                className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-brand-950 hover:bg-brand-700 disabled:opacity-40">Save answer</button>
              <button type="button" onClick={() => save('', 'assumed')}
                className="rounded border border-steel-300 bg-white px-3 py-1 text-sm hover:bg-steel-50">Don't know — use the AI's assumption</button>
              {q.status !== 'open' && <button type="button" onClick={() => { setDraft(q.answer); setEditing(false); }} className="text-sm text-steel-500 underline">Cancel</button>}
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 rounded bg-steel-50 border-l-4 border-brand-600 px-2.5 py-1.5 text-sm text-steel-800">
              {q.status === 'assumed' ? <em>No preference — the AI's assumption is used.</em> : q.answer}
              <div className="text-[11px] text-steel-400 mt-0.5">{q.merged ? `Added to the spec · ${q.date}` : 'Being added to the spec…'}</div>
            </div>
            <button type="button" onClick={() => { setDraft(q.answer); setEditing(true); reopen(projectId, q.id); }} className="text-xs text-steel-500 underline pt-1.5">Change</button>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Questions with their answers right under them. Answers are saved per
 * project and merged into the spec automatically (see ./merge).
 */
export default function QuestionList({ questions, title = 'Questions to answer', intro, showSource = false }: { questions: Question[]; title?: string; intro?: string; showSource?: boolean }) {
  const merge = useQuestionStore((s) => s.merge);
  const [showDone, setShowDone] = useState(false);
  if (!questions.length) return null;
  const open = questions.filter((q) => q.status === 'open');
  const done = questions.filter((q) => q.status !== 'open');
  const shown = showDone ? questions : open.length ? [...open, ...done.filter((q) => !q.merged)] : questions;
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3" aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-steel-900">{title}</h3>
        <span className="text-xs text-steel-600">{open.length} open · {done.length} answered</span>
        {done.length > 0 && open.length > 0 && (
          <button type="button" onClick={() => setShowDone((v) => !v)} className="ml-auto text-xs text-steel-600 underline">{showDone ? 'Hide answered' : `Show answered (${done.length})`}</button>
        )}
      </div>
      <p className="text-xs text-steel-600">{intro ?? 'Answer each question in the box right under it. Answers are saved and added to the machine description automatically; the stages that depend on them become out of date so "Update" uses them.'}</p>
      <ol className="space-y-2">
        {shown.map((q) => <QuestionCard key={q.id} q={q} n={questions.indexOf(q) + 1} showSource={showSource} />)}
      </ol>
      {merge.busy && <p role="status" className="flex items-center gap-2 text-xs text-steel-700"><Spinner /> Adding your answers to the spec…</p>}
      {!merge.busy && merge.note && <p role="status" className="text-xs text-green-900 bg-green-50 border border-green-200 rounded p-2">{merge.note}</p>}
      {merge.error && <p role="alert" className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">{merge.error}</p>}
    </section>
  );
}
