import { useSpecStore } from '../../store/useSpecStore';
import { runDerived, useProjectsStore } from '../../store/useProjectsStore';
import { SOURCE_LABEL, useQuestionStore, type Question, type QuestionSource } from './useQuestionStore';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useHmiStore } from '../../store/useHmiStore';
import { useDraftStore } from '../../store/useDraftStore';
import { userNotes } from './classify';
import type { SpecSectionId } from '../../spec/types';

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
// A fixed order, so revisiting a page (which re-registers its questions) never changes the spec text.
const SOURCE_ORDER = Object.keys(SOURCE_LABEL);
export function qaText(questions: Question[]): string {
  return questions
    .filter((q) => q.status !== 'open')
    .slice()
    .sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
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

type Item = { text: string; assumption?: string; section?: SpecSectionId };

/**
 * The questions each stage asked, read from its data (the spec's open questions, the I/O plan, the
 * electrical and HMI designs' notes). Registered globally, not only when a page is open, so the
 * design review, the badges and the machine spec always have them. (Review findings are computed on
 * the review page and registered there.)
 */
function stageQuestions(): Record<Exclude<QuestionSource, 'review'>, Item[] | null> {
  const plan = useDraftStore.getState().drafts['io.plan'] as { questions?: string[] } | null | undefined;
  const el = useElectricalStore.getState().design;
  const hmi = useHmiStore.getState().design;
  return {
    spec: useSpecStore.getState().questions.map((text) => ({ text })),
    io: plan?.questions ? plan.questions.map((text) => ({ text })) : null,
    electrical: el ? userNotes(el).map((n) => ({ text: n, assumption: n })) : null,
    hmi: hmi ? userNotes(hmi).map((n) => ({ text: n, assumption: n, section: 'operator' as const })) : null,
  };
}

const registered = new Map<string, string>();
/** Register the open project's stage questions (only what changed since the last time). */
export function registerStageQuestions(): void {
  const projectId = useProjectsStore.getState().activeId;
  for (const [source, items] of Object.entries(stageQuestions()) as [QuestionSource, Item[] | null][]) {
    if (!items) continue;
    const k = `${projectId}|${source}`, sig = JSON.stringify(items);
    if (registered.get(k) === sig) continue;
    registered.set(k, sig);
    runDerived(() => useQuestionStore.getState().sync(projectId, source, items));
  }
}

let installed = false;
/** Keep the spec's Q&A in step with the question list and the open project. */
export function installQaSync(): void {
  if (installed) return;
  installed = true;
  useQuestionStore.subscribe(syncQaIntoSpec);
  useProjectsStore.subscribe(syncQaIntoSpec);
  for (const store of [useSpecStore, useElectricalStore, useHmiStore, useDraftStore, useProjectsStore] as { subscribe: (cb: () => void) => () => void }[]) store.subscribe(registerStageQuestions);
  registerStageQuestions();
  // Project data are loaded into the spec store on project switch; re-sync after it.
  useSpecStore.subscribe((s, prev) => { if (s.sections !== prev.sections && (s.sections.qa ?? '') !== qaText(listFor(useProjectsStore.getState().activeId))) syncQaIntoSpec(); });
  syncQaIntoSpec();
}
