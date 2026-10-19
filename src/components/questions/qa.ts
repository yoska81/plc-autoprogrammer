import { useSpecStore } from '../../store/useSpecStore';
import { activeHmiDesign } from '../../hmi/projectPanel';
import { runDerived, useProjectsStore } from '../../store/useProjectsStore';
import { SOURCE_LABEL, setExternalKnowledge, type SyncItem, useQuestionStore, type Question, type QuestionSource } from './useQuestionStore';
import { useReviewStore } from '../../review/useReviewStore';
import { useProgramStore } from '../../store/useProgramStore';
import type { Finding, FindingMark } from '../../review/types';
import type { KnownAnswer } from './knowledge';
import { isTechnicalIssue } from './classify';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useHmiStore } from '../../store/useHmiStore';
import { useDraftStore } from '../../store/useDraftStore';
import { userNotes } from './classify';
import { SPEC_SECTIONS, specToText, type SpecSections } from '../../spec/types';
import { missingNeeds } from '../../spec/needs';
import { guessSection } from './parse';

/**
 * The project's questions and answers as part of the specification. They are
 * not copied into the spec sections: the text below is kept in
 * `spec.sections.qa`, so it is in the spec fingerprint (answering makes later
 * stages out of date) and in every AI prompt that reads the spec.
 */

/** "A: …" for a question that has an answer (or uses the AI's assumption). */
export function answerText(q: Question): string {
  if (q.status === 'dismissed') return 'Not applicable — do not ask again.';
  if (q.status === 'assumed') return `(AI's assumption: ${q.assumption && q.assumption !== q.text ? q.assumption : 'use the engineer\'s judgement'})`;
  return q.answer.trim();
}

/** The label review decisions carry in the Q&A: no stage is out of date because of one (they read it, though). */
export const DECISION_LABEL = 'Design review decision';

/** Design review findings the user resolved or accepted, with the reason (what the user decided). */
export function reviewDecisions(findings: Finding[], marks: Record<string, FindingMark>): KnownAnswer[] {
  const seen = new Set<string>();
  return findings.flatMap((f) => {
    const m = marks[f.id];
    if (!m || m.status === 'open' || seen.has(f.id) || isTechnicalIssue(f.title)) return [];
    seen.add(f.id);
    const question = f.detail && f.detail !== f.title ? `${f.title}: ${f.detail}` : f.title;
    return [{ ref: f.id, question, answer: `${m.status === 'resolved' ? 'Resolved' : 'Accepted as is'}${m.reason.trim() ? `: ${m.reason.trim()}` : ''}`, where: { label: SOURCE_LABEL.review, route: '/review' } }];
  });
}

const decisionsNow = () => {
  const { checks, ai, marks } = useReviewStore.getState();
  return reviewDecisions([...checks, ...(ai?.findings ?? [])], marks);
};

/**
 * Answered questions as Q/A text, in the order asked (open questions are not part of the spec yet),
 * then the design review decisions. Automatic answers are left out: they repeat an answer already
 * here, and the AI rewords its questions on every run (the spec would change with each run).
 */
// A fixed order, so revisiting a page (which re-registers its questions) never changes the spec text.
const SOURCE_ORDER = Object.keys(SOURCE_LABEL);
export function qaText(questions: Question[], decisions: KnownAnswer[] = []): string {
  return [...questions
    .filter((q) => q.status !== 'open' && !q.known)
    .slice()
    .sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((q) => `Q (${SOURCE_LABEL[q.source]}): ${q.text.trim()}\nA: ${answerText(q)}`),
  ...decisions.slice().sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0)).map((d) => `Q (${DECISION_LABEL}): ${d.question.trim()}\nA: ${d.answer}`),
  ].join('\n');
}

const listFor = (projectId: string | null) => useQuestionStore.getState().byProject[projectId ?? 'default'] ?? [];

/** Write the open project's Q&A into the spec (only when it changed). */
export function syncQaIntoSpec(): void {
  const qa = qaText(listFor(useProjectsStore.getState().activeId), decisionsNow());
  const spec = useSpecStore.getState();
  if ((spec.sections.qa ?? '') === qa) return;
  // Derived from the question list (the answers themselves are the user's change).
  runDerived(() => useSpecStore.setState({ sections: { ...spec.sections, qa } }));
}

type Item = SyncItem;

/** Heading of the gaps a later stage found (asked on the Machine description page, never on the stage's own page). */
export const foundWhile = (source: QuestionSource) => `Found while designing: ${SOURCE_LABEL[source]}`;

/**
 * Everything the Machine description page asks: the needs checklist items the description does not
 * cover yet (src/spec/needs.ts, follow-ups included), then the AI's own questions about the spec.
 */
export function specQuestionItems(sections: SpecSections, aiQuestions: string[]): Item[] {
  const needs = missingNeeds({ text: specToText(sections), sections }).map((n) => ({ text: n.question, topic: n.topic, need: n.id }));
  const sectionTitle = (t: string) => SPEC_SECTIONS.find((d) => d.id === guessSection(t, 'spec'))?.title ?? 'Other requirements';
  return [...needs, ...aiQuestions.map((text) => ({ text, topic: sectionTitle(text) }))];
}

/**
 * The questions each stage raised, read from its data (the spec's open questions and checklist, the
 * I/O plan, the electrical and HMI designs' notes, the program's cycle). Only the Machine description
 * page asks them: a later stage's notes are gaps it found, built with the stated default (the
 * "assumption") and listed on its page under "Assumptions used". Registered globally, not only when a
 * page is open, so the badges and the machine spec always have them. (Review findings are computed on
 * the review page and registered there.)
 */
function stageQuestions(): Record<Exclude<QuestionSource, 'review'>, Item[] | null> {
  const ladder = useProgramStore.getState().ladder;
  const plan = useDraftStore.getState().drafts['io.plan'] as { questions?: string[] } | null | undefined;
  const ioUpdate = useDraftStore.getState().drafts['io.updateQuestions'] as { text: string; assumption?: string }[] | undefined;
  const el = useElectricalStore.getState().design;
  const hmi = activeHmiDesign();
  return {
    spec: specQuestionItems(useSpecStore.getState().sections, useSpecStore.getState().questions),
    // the I/O page's own reading, else the one Update all made (src/spec/updateAll.ts)
    io: plan?.questions ? plan.questions.map((text) => ({ text, topic: foundWhile('io') }))
      : ioUpdate ? ioUpdate.map((q) => ({ ...q, topic: foundWhile('io') })) : null,
    electrical: el ? userNotes(el).map((n) => ({ text: n, assumption: n, topic: foundWhile('electrical') })) : null,
    hmi: hmi ? userNotes(hmi).map((n) => ({ text: n, assumption: n, section: 'operator' as const, topic: foundWhile('hmi') })) : null,
    program: ladder.rungs.length ? (ladder.sequence?.questions ?? []).map((text) => ({ text, section: 'sequence' as const, topic: foundWhile('program') })) : null,
    // Convert existing drawings: what the drawings don't tell (src/convert/apply.ts keeps them with the project)
    drawings: (useDraftStore.getState().drafts['convert.questions'] as Item[] | undefined) ?? null,
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
  setExternalKnowledge(decisionsNow);
  useQuestionStore.subscribe(syncQaIntoSpec);
  useProjectsStore.subscribe(syncQaIntoSpec);
  // A review decision answers the questions that ask the same thing, and is part of the Q&A.
  useReviewStore.subscribe((s, prev) => {
    if (s.marks === prev.marks && s.ai === prev.ai && s.checks === prev.checks) return;
    runDerived(() => useQuestionStore.getState().resolveKnown(useProjectsStore.getState().activeId));
    syncQaIntoSpec();
  });
  for (const store of [useSpecStore, useElectricalStore, useHmiStore, useDraftStore, useProgramStore, useProjectsStore] as { subscribe: (cb: () => void) => () => void }[]) store.subscribe(registerStageQuestions);
  registerStageQuestions();
  // Project data are loaded into the spec store on project switch; re-sync after it.
  useSpecStore.subscribe((s, prev) => { if (s.sections !== prev.sections && (s.sections.qa ?? '') !== qaText(listFor(useProjectsStore.getState().activeId), decisionsNow())) syncQaIntoSpec(); });
  syncQaIntoSpec();
}
