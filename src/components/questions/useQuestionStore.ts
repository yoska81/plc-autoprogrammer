import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SpecSectionId } from '../../spec/types';
import { isTechnicalIssue } from './classify';
import { findKnown, type KnownAnswer, type KnownWhere } from './knowledge';
import { useProjectsStore, runDerived } from '../../store/useProjectsStore';

/**
 * Open questions the AI asks at every stage, with the user's answers.
 * Stored per project (by project id) so answers survive reloads and project
 * switches; an answer is merged into the spec once ("merged").
 */

export type QuestionSource = 'spec' | 'io' | 'electrical' | 'hmi' | 'program' | 'review';

export const SOURCE_LABEL: Record<QuestionSource, string> = {
  spec: 'Machine description', io: 'I/O list', electrical: 'Electrical design', hmi: 'HMI', program: 'PLC program', review: 'Design review',
};

/** Page where each source's questions are asked (for "answered in …" links). */
export const SOURCE_ROUTE: Record<QuestionSource, string> = {
  spec: '/spec', io: '/io', electrical: '/electrical?tab=design', hmi: '/hmi', program: '/program', review: '/review',
};

/** `dismissed`: "Not applicable — don't ask again" (questions that ask the same thing are dismissed too). */
export type QuestionStatus = 'open' | 'answered' | 'assumed' | 'dismissed';

export interface Question {
  /** Stable id from the source and the question text. */
  id: string;
  source: QuestionSource;
  text: string;
  answer: string;
  status: QuestionStatus;
  /** When it was asked, then when it was answered. */
  date: string;
  /** The AI's assumption, when the source states one (e.g. electrical "assumptions to confirm"). */
  assumption?: string;
  /** Spec section the answer belongs in (guessed when not given). */
  section?: SpecSectionId;
  /** Legacy: answers used to be merged into the spec sections (kept for old data). */
  merged: boolean;
  /** Answered automatically: the same question was already answered there (the answer is copied from it). */
  known?: { ref: string; question: string; where: KnownWhere };
  /** The user reopened an automatic answer: ask it even though a similar one is answered. */
  ask?: boolean;
}

/** What the user answered in this question list (automatic answers only copy these). */
export function knownFromQuestions(list: Question[]): KnownAnswer[] {
  return list.filter((q) => q.status !== 'open' && !q.known).map((q) => ({
    ref: q.id, question: q.text, dismissed: q.status === 'dismissed' || undefined,
    answer: q.status === 'answered' ? q.answer.trim() : q.status === 'dismissed' ? 'Not applicable' : `AI's assumption: ${q.assumption && q.assumption !== q.text ? q.assumption : "the engineer's judgement"}`,
    where: { label: SOURCE_LABEL[q.source], route: SOURCE_ROUTE[q.source] },
  }));
}

/** Answers given outside the question list (design review decisions); set by ./qa. */
let external: () => KnownAnswer[] = () => [];
export function setExternalKnowledge(fn: () => KnownAnswer[]): void { external = fn; }

/**
 * Answer every open question the user already answered somewhere (in other words, on another page,
 * as a review decision), and keep automatic answers in step with the answer they copy.
 */
export function applyKnown(list: Question[]): Question[] {
  const known = [...knownFromQuestions(list), ...external()];
  let changed = false;
  const next = list.map((q) => {
    if (q.ask || (q.status !== 'open' && !q.known)) return q;
    const k = findKnown(q.text, known.filter((x) => x.ref !== q.id));
    if (!k) {
      if (!q.known) return q;
      changed = true;
      return { ...q, status: 'open' as const, answer: '', known: undefined };
    }
    const status: QuestionStatus = k.dismissed ? 'dismissed' : 'answered';
    if (q.known?.ref === k.ref && q.answer === k.answer && q.status === status) return q;
    changed = true;
    return { ...q, status, answer: k.answer, known: { ref: k.ref, question: k.question, where: k.where }, merged: false };
  });
  return changed ? next : list;
}


export function questionId(source: QuestionSource, text: string): string {
  let h = 2166136261;
  const s = `${source}|${text.trim().toLowerCase()}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${source}-${(h >>> 0).toString(36)}`;
}

interface QuestionStore {
  byProject: Record<string, Question[]>;
  /** Register a stage's current questions: new ones are added as open, answered ones are kept, open ones that disappeared are dropped. */
  sync: (projectId: string | null, source: QuestionSource, items: { text: string; assumption?: string; section?: SpecSectionId }[]) => void;
  answer: (projectId: string | null, id: string, answer: string, status: Exclude<QuestionStatus, 'open'>) => void;
  reopen: (projectId: string | null, id: string) => void;
  /** Re-check open questions against what is answered (after a design review decision). */
  resolveKnown: (projectId: string | null) => void;
  markMerged: (projectId: string | null, ids: string[]) => void;
}

const key = (projectId: string | null) => projectId ?? 'default';
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export const useQuestionStore = create<QuestionStore>()(
  persist(
    (set) => ({
      byProject: {},
      sync: (projectId, source, items) => set((s) => {
        const list = s.byProject[key(projectId)] ?? [];
        const ids = new Set<string>();
        const fresh: Question[] = [];
        for (const it of items) {
          const text = it.text.trim();
          if (!text || isTechnicalIssue(text)) continue;
          const id = questionId(source, text);
          if (ids.has(id)) continue;
          ids.add(id);
          const cur = list.find((q) => q.id === id);
          fresh.push(cur ? { ...cur, assumption: it.assumption ?? cur.assumption, section: cur.section ?? it.section } : { id, source, text, answer: '', status: 'open', date: now(), assumption: it.assumption, section: it.section, merged: false });
        }
        // Keep answers already given (history) even when the AI no longer asks, and keep every
        // question where it was in the list: revisiting a page must not reorder anything.
        const byId = new Map(fresh.map((q) => [q.id, q]));
        const next: Question[] = [];
        for (const q of list) {
          if (q.source !== source) next.push(q);
          else if (byId.has(q.id)) { next.push(byId.get(q.id)!); byId.delete(q.id); }
          else if (q.status !== 'open') next.push(q);
        }
        next.push(...byId.values());
        const resolved = applyKnown(next);
        if (resolved !== next) return { byProject: { ...s.byProject, [key(projectId)]: resolved } };
        const same = next.length === list.length && next.every((q, i) => q === list[i]);
        return same ? s : { byProject: { ...s.byProject, [key(projectId)]: next } };
      }),
      // An answer given here also answers the other questions that ask the same thing.
      answer: (projectId, id, answer, status) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: applyKnown((s.byProject[key(projectId)] ?? []).map((q) => (q.id === id ? { ...q, answer, status, date: now(), merged: false, known: undefined } : q))) },
      })),
      // Reopening an automatic answer asks the question for real (it is not answered automatically again).
      reopen: (projectId, id) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: applyKnown((s.byProject[key(projectId)] ?? []).map((q) => (q.id === id ? { ...q, status: 'open' as const, merged: false, ...(q.known ? { known: undefined, answer: '', ask: true } : {}) } : q))) },
      })),
      resolveKnown: (projectId) => set((s) => {
        const list = s.byProject[key(projectId)] ?? [];
        const next = applyKnown(list);
        return next === list ? s : { byProject: { ...s.byProject, [key(projectId)]: next } };
      }),
      markMerged: (projectId, ids) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: (s.byProject[key(projectId)] ?? []).map((q) => (ids.includes(q.id) ? { ...q, merged: true } : q)) },
      })),
    }),
    {
      name: 'isa-questions',
      // Technical issues (HMI layout checks, wiring / catalog remarks) stored as questions by older versions are dropped on load.
      merge: (persisted, current) => {
        const byProject = (persisted as Partial<QuestionStore> | undefined)?.byProject ?? {};
        const clean = Object.fromEntries(Object.entries(byProject).map(([k, list]) => [k, (list ?? []).filter((q) => !isTechnicalIssue(q.text))]));
        return { ...current, byProject: clean };
      },
    },
  ),
);

const NONE: Question[] = [];

/** Questions of the open project (optionally of one source). */
export function useQuestions(source?: QuestionSource): Question[] {
  const projectId = useProjectsStore((s) => s.activeId);
  const list = useQuestionStore((s) => s.byProject[key(projectId)] ?? NONE);
  return source ? list.filter((q) => q.source === source) : list;
}

export function useActiveProjectId(): string | null {
  return useProjectsStore((s) => s.activeId);
}

/** Open questions per source, for badges. */
export function useOpenCounts(): Record<QuestionSource, number> {
  const list = useQuestions();
  const out: Record<QuestionSource, number> = { spec: 0, io: 0, electrical: 0, hmi: 0, program: 0, review: 0 };
  for (const q of list) if (q.status === 'open') out[q.source]++;
  return out;
}

/** Register a stage's current questions with the store (call from the page that shows them). */
export function useSyncQuestions(source: QuestionSource, items: { text: string; assumption?: string; section?: SpecSectionId }[] | null): void {
  const projectId = useActiveProjectId();
  const sync = useQuestionStore((s) => s.sync);
  const sig = items ? JSON.stringify(items) : null;
  useEffect(() => {
    // Registering the questions a stage asked is derived data, not a user change.
    if (sig !== null) runDerived(() => sync(projectId, source, JSON.parse(sig) as { text: string; assumption?: string; section?: SpecSectionId }[]));
  }, [projectId, source, sig, sync]);
}
