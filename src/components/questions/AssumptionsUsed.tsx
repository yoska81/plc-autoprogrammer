import { Link } from 'react-router-dom';
import { answerText } from './qa';
import type { Question } from './useQuestionStore';

/**
 * What a later stage (I/O, electrical, HMI, program, review) assumed where the description was
 * silent. Read-only: the stages never ask. An item still open is asked on the Machine description
 * page (the stage was built with the default shown here); "Change" goes to that question.
 */
export default function AssumptionsUsed({ questions, title = 'Assumptions used' }: { questions: Question[]; title?: string }) {
  if (!questions.length) return null;
  const open = questions.filter((q) => q.status === 'open').length;
  return (
    <section className="rounded-lg border border-steel-200 bg-white p-4 space-y-2" aria-label={title} data-testid="assumptions-used">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-steel-900">{title}</h3>
        <span className="text-xs text-steel-600">{questions.length} item{questions.length === 1 ? '' : 's'}{open ? ` · ${open} waiting for an answer on the Machine description page` : ''}</span>
      </div>
      <p className="text-xs text-steel-600">Where the machine description did not say, this stage used the default below. Questions are asked only on the Machine description page; answer or change them there and Update uses the answer.</p>
      <ul className="divide-y divide-steel-100">
        {questions.map((q) => (
          <li key={q.id} className="flex items-start gap-2 py-1.5 text-sm" data-assumption={q.id}>
            <div className="min-w-0 flex-1">
              <p className="text-steel-800">{q.status === 'open' ? (q.assumption && q.assumption !== q.text ? q.assumption : q.text) : q.text}</p>
              <p className="text-xs text-steel-500">
                {q.status === 'open' ? 'Default used — the question is on the Machine description page.'
                  : q.status === 'dismissed' ? 'Not applicable.'
                  : <>Answered: <span className="text-steel-700">{q.status === 'assumed' ? answerText(q) : q.answer}</span>{q.known ? ` (in ${q.known.where.label})` : ''}</>}
              </p>
            </div>
            <Link to={`/spec?q=${encodeURIComponent(q.known?.ref && q.known.where.route.startsWith('/spec') ? q.known.ref : q.id)}`}
              className={`shrink-0 text-xs underline ${q.status === 'open' ? 'font-semibold text-amber-800' : 'text-steel-500'}`}>{q.status === 'open' ? 'Answer' : 'Change'}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
