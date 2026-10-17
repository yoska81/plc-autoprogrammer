import { useNavigate } from 'react-router-dom';
import StartCleanBanner from '../components/StartCleanBanner';
import { useSpecStore } from '../store/useSpecStore';
import { SPEC_SECTIONS } from '../spec/types';
import SpecIntake from '../components/SpecIntake';
import QuestionList from '../components/questions/QuestionList';
import { useQuestions } from '../components/questions/useQuestionStore';
import VoiceTextarea from '../voice/VoiceTextarea';

export default function SpecPage() {
  const navigate = useNavigate();
  const spec = useSpecStore();
  const questions = useQuestions();
  const filled = SPEC_SECTIONS.filter((s) => spec.sections[s.id]?.trim()).length;
  const open = questions.filter((q) => q.status === 'open').length;

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-steel-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-steel-900">1 · Describe the machine</h2>
          <p className="text-xs text-steel-500 mt-0.5">The spec drives every step. Change it any time; the steps after it are marked out of date and can be updated in one click.</p>
        </div>
        <button onClick={() => navigate('/equipment')} disabled={!filled}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-40 whitespace-nowrap">
          Next: Equipment →
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl space-y-5">
          <StartCleanBanner />
          {open > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <span className="flex-1">The AI has <b>{open} question{open === 1 ? '' : 's'}</b> about your machine. Answers make the design more accurate; every step also works without them (the AI then uses its assumption).</span>
              <button onClick={() => document.getElementById('questions-and-answers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-3 py-1 text-xs font-medium bg-white border border-amber-300 rounded-sm hover:bg-amber-100">Answer them ↓</button>
            </div>
          )}
          <SpecIntake />

          {/* Sections */}
          <div className="bg-white rounded-lg border border-steel-200 divide-y divide-steel-100">
            <div className="px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-steel-800">Specification</h3>
              <span className="text-xs text-steel-400">{filled} of {SPEC_SECTIONS.length} sections filled</span>
            </div>
            {SPEC_SECTIONS.map((s) => (
              <div key={s.id} className="px-5 py-3">
                <label htmlFor={`spec-${s.id}`} className="block text-sm font-medium text-steel-700">{s.title}</label>
                <VoiceTextarea
                  id={`spec-${s.id}`}
                  speak
                  value={spec.sections[s.id] ?? ''}
                  onValueChange={(v) => spec.setSection(s.id, v)}
                  placeholder={s.hint}
                  rows={Math.min(12, Math.max(2, (spec.sections[s.id] ?? '').split('\n').length + 1))}
                  className="mt-1 w-full border border-steel-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-steel-400"
                />
              </div>
            ))}
          </div>

          {/* Questions & answers: part of the specification (asked here and on the later pages). */}
          <div id="questions-and-answers">
            <QuestionList questions={questions} all showSource title="Questions & answers"
              intro="Questions the AI asked about this machine, with your answers right under them. They are part of the specification: every later stage reads them, and changing an answer marks those stages out of date. Answer open ones in the box under the question; change an answer any time." />
          </div>
        </div>
      </div>
    </>
  );
}
