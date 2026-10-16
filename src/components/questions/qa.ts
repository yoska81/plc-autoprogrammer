import { useSpecStore } from '../../store/useSpecStore';
import { runDerived, useProjectsStore } from '../../store/useProjectsStore';
import { SOURCE_LABEL, useQuestionStore, type Question } from './useQuestionStore';

/**
 * The project's questions and answers as part of the specification. They are
 * not copied into the spec sections: the text below is kept in
 * `spec.sections.qa`, so it is in the spec fingerprint (answering makes later
 * stages out of date) and in every AI prompt that reads the spec.
 */

/** "A: …" for a question that has an answer (or uses the AI's assumption). */
export function answerText(q: Question): string {
  if (q.status === 'assumed') return `(AI's assumption: ${q.assumption && q.assumption !== q.text ? q.assumption : 'use the engineer\'s judgement'})`;
  return q.answer.trim();
}

/** Answered questions as Q/A text, in the order asked (open questions are not part of the spec yet). */
export function qaText(questions: Question[]): string {
  return questions
    .filter((q) => q.status !== 'open')
    .map((q) => `Q (${SOURCE_LABEL[q.source]}): ${q.text.trim()}\nA: ${answerText(q)}`)
    .join('\n');
}

const listFor = (projectId: string | null) => useQuestionStore.getState().byProject[projectId ?? 'default'] ?? [];

/** Write the open project's Q&A into the spec (only when it changed). */
export function syncQaIntoSpec(): void {
  const qa = qaText(listFor(useProjectsStore.getState().activeId));
  const spec = useSpecStore.getState();
  if ((spec.sections.qa ?? '') === qa) return;
  // Derived from the question list (the answers themselves are the user's change).
  runDerived(() => useSpecStore.setState({ sections: { ...spec.sections, qa } }));
}

let installed = false;
/** Keep the spec's Q&A in step with the question list and the open project. */
export function installQaSync(): void {
  if (installed) return;
  installed = true;
  useQuestionStore.subscribe(syncQaIntoSpec);
  useProjectsStore.subscribe(syncQaIntoSpec);
  // Project data are loaded into the spec store on project switch; re-sync after it.
  useSpecStore.subscribe((s, prev) => { if (s.sections !== prev.sections && (s.sections.qa ?? '') !== qaText(listFor(useProjectsStore.getState().activeId))) syncQaIntoSpec(); });
  syncQaIntoSpec();
}
