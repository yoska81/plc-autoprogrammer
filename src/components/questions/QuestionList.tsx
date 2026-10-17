import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NEED_TOPICS } from '../../spec/needs';
import { quickChoices } from './parse';
import { answerText } from './qa';
import { SOURCE_LABEL, useActiveProjectId, useQuestionStore, type Question } from './useQuestionStore';
import { useDraft } from '../../store/useDraftStore';
import { useUi } from '../../store/useUiStore';

const STATUS: Record<Question['status'], { text: string; cls: string }> = {
  open: { text: 'Open', cls: 'bg-amber-100 text-amber-900' },
  answered: { text: 'Answered', cls: 'bg-green-100 text-green-800' },
  assumed: { text: "AI's assumption used", cls: 'bg-steel-200 text-steel-700' },
  dismissed: { text: 'Not applicable', cls: 'bg-steel-100 text-steel-500' },
};

/** One question with its answer directly under it (Q, then A). */
function QuestionCard({ q, n, showSource }: { q: Question; n: number; showSource: boolean }) {
  const projectId = useActiveProjectId();
  const { answer, reopen } = useQuestionStore();
  const [draft, setDraft] = useDraft(`answer.${q.id}`, q.answer);
  const [stored, setEditing] = useUi(`answer.${q.id}.editing`, q.status === 'open');
  // "Answer" / "Change" on a later stage's "Assumptions used" links here with ?q=<id>: open that question.
  const [params, setParams] = useSearchParams();
  const target = params.get('q') === q.id;
  const editing = stored || target;
  const card = useRef<HTMLLIElement>(null);
  useEffect(() => { if (target) card.current?.scrollIntoView({ block: 'center' }); }, [target]);
  const choices = quickChoices(q.text);
  const save = (text: string, status: 'answered' | 'assumed' | 'dismissed') => {
    answer(projectId, q.id, text, status);
    setDraft(text);
    setEditing(false);
    if (target) setParams((p) => { p.delete('q'); return p; }, { replace: true });
  };
  const st = q.known && q.status === 'answered' ? { text: 'Already answered', cls: 'bg-green-100 text-green-800' } : STATUS[q.status];
  return (
    <li ref={card} className={`rounded-sm border bg-white ${q.status === 'open' ? 'border-amber-300' : 'border-steel-200'} ${target ? 'ring-2 ring-brand-500' : ''}`} data-question={q.id}>
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <span className="text-xs font-semibold text-steel-400 tabular-nums pt-0.5">{n}.</span>
        <p className="flex-1 text-sm font-medium text-steel-900"><span className="text-steel-500 font-semibold mr-1">Q:</span>{q.text}</p>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
      </div>
      {showSource && <p className="px-3 pl-8 text-[11px] text-steel-400">{q.source === 'spec' ? 'Asked for the machine description' : `Found while designing: ${SOURCE_LABEL[q.source]}`}</p>}
      {q.assumption && q.assumption !== q.text && q.status === 'open' && <p className="px-3 pl-8 text-xs text-steel-500">AI's assumption: {q.assumption}</p>}
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
                className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40">Save answer</button>
              <button type="button" onClick={() => save('', 'assumed')}
                className="rounded border border-steel-300 bg-white px-3 py-1 text-sm hover:bg-steel-50">Don't know — use the AI's assumption</button>
              <button type="button" onClick={() => save('', 'dismissed')} title="Questions that ask the same thing again are dismissed too"
                className="rounded border border-steel-300 bg-white px-3 py-1 text-sm hover:bg-steel-50">Not applicable — don't ask again</button>
              {q.status !== 'open' && <button type="button" onClick={() => { setDraft(q.answer); setEditing(false); if (target) setParams((p) => { p.delete('q'); return p; }, { replace: true }); }} className="text-sm text-steel-500 underline">Cancel</button>}
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 rounded bg-steel-50 border-l-4 border-brand-600 px-2.5 py-1.5 text-sm text-steel-800" data-answer>
              <span className="text-steel-500 font-semibold mr-1">A:</span>{q.status === 'assumed' || q.status === 'dismissed' ? <em>{answerText(q)}</em> : q.answer}
              {q.known ? (
                <div className="text-[11px] text-steel-500 mt-0.5" data-known>
                  Answered already in <Link to={q.known.where.route} className="underline text-brand-700">{q.known.where.label}</Link>: “{q.known.question}”
                  <button type="button" onClick={() => { reopen(projectId, q.id); setDraft(''); setEditing(true); }} className="ml-2 underline">Not the same question</button>
                </div>
              ) : <div className="text-[11px] text-steel-400 mt-0.5">Part of the specification · {q.date}</div>}
            </div>
            {/* Editing keeps the saved answer (and the stages built on it) until a new one is saved; Cancel leaves it. */}
            <button type="button" onClick={() => { setDraft(q.answer); setEditing(true); }} className="text-xs text-steel-500 underline pt-1.5">Change</button>
          </div>
        )}
      </div>
    </li>
  );
}

const topicOf = (q: Question) => q.topic ?? (q.source === 'spec' ? 'Other requirements' : `Found while designing: ${SOURCE_LABEL[q.source]}`);
/** Topic headings in order: the needs checklist's topics, the description's own, then what the stages found. */
function topicsOf(list: Question[]): string[] {
  const all = [...new Set(list.map(topicOf))];
  const rank = (t: string) => (NEED_TOPICS.includes(t) ? NEED_TOPICS.indexOf(t) : t.startsWith('Found while designing') ? 1000 : 500);
  return all.sort((a, b) => rank(a) - rank(b));
}

/**
 * Questions with their answers right under them. Answers are saved per
 * project and are part of the specification as a Q&A list (see ./qa) —
 * nothing is copied into the spec sections.
 * `all`: show every question (answered ones stay as Q/A pairs); otherwise
 * answered ones can be hidden behind "Show answered".
 */
export default function QuestionList({ questions, title = 'Questions to answer', intro, showSource = false, all = false, grouped = false }: { questions: Question[]; title?: string; intro?: string; showSource?: boolean; all?: boolean; /** Open questions under topic headings (the Machine description page). */ grouped?: boolean }) {
  const [showDone, setShowDone] = useUi('questions.showDone', false);
  if (!questions.length) return null;
  const open = questions.filter((q) => q.status === 'open');
  const done = questions.filter((q) => q.status !== 'open');
  // Open ones first (with their answer box), then the answered Q/A pairs, each group in the order asked.
  const shown = all || showDone || !open.length ? [...open, ...done] : open;
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3" aria-label={title}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-steel-900">{title}</h3>
        <span className="text-xs text-steel-600">{open.length} open · {done.length} answered</span>
        {!all && done.length > 0 && open.length > 0 && (
          <button type="button" onClick={() => setShowDone((v) => !v)} className="ml-auto text-xs text-steel-600 underline">{showDone ? 'Hide answered' : `Show answered (${done.length})`}</button>
        )}
      </div>
      <p className="text-xs text-steel-600">{intro ?? 'Answer each question in the box right under it. Your answers are saved as questions and answers in the machine description and are part of the specification, so the later stages become out of date and "Update" uses them.'}</p>
      {grouped ? (
        <>
          {topicsOf(open).map((t) => (
            <div key={t} className="space-y-1.5" data-topic={t}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-steel-600">{t}</h4>
              <ol className="space-y-2">{open.filter((q) => topicOf(q) === t).map((q) => <QuestionCard key={`${q.id}-${q.status}`} q={q} n={questions.indexOf(q) + 1} showSource={showSource} />)}</ol>
            </div>
          ))}
          {done.length > 0 && (all || showDone || !open.length) && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-steel-600">Answered</h4>
              <ol className="space-y-2">{done.map((q) => <QuestionCard key={`${q.id}-${q.status}`} q={q} n={questions.indexOf(q) + 1} showSource={showSource} />)}</ol>
            </div>
          )}
        </>
      ) : (
        <ol className="space-y-2">
          {shown.map((q) => <QuestionCard key={`${q.id}-${q.status}`} q={q} n={questions.indexOf(q) + 1} showSource={showSource} />)}
        </ol>
      )}
    </section>
  );
}
