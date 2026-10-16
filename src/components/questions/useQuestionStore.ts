import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SpecSectionId } from '../../spec/types';
import { isTechnicalIssue } from './classify';
import { useProjectsStore } from '../../store/useProjectsStore';

/**
 * Open questions the AI asks at every stage, with the user's answers.
 * Stored per project (by project id) so answers survive reloads and project
 * switches; an answer is merged into the spec once ("merged").
 */

export type QuestionSource = 'spec' | 'io' | 'electrical' | 'hmi' | 'review';

export const SOURCE_LABEL: Record<QuestionSource, string> = {
  spec: 'Machine description', io: 'I/O list', electrical: 'Electrical design', hmi: 'HMI', review: 'Design review',
};

export type QuestionStatus = 'open' | 'answered' | 'assumed';

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
        // Keep answers already given (history) even when the AI no longer asks.
        const kept = list.filter((q) => q.source === source && !ids.has(q.id) && q.status !== 'open');
        const others = list.filter((q) => q.source !== source);
        const next = [...others, ...fresh, ...kept];
        const same = next.length === list.length && next.every((q, i) => q === list[i]);
        return same ? s : { byProject: { ...s.byProject, [key(projectId)]: next } };
      }),
      answer: (projectId, id, answer, status) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: (s.byProject[key(projectId)] ?? []).map((q) => (q.id === id ? { ...q, answer, status, date: now(), merged: false } : q)) },
      })),
      reopen: (projectId, id) => set((s) => ({
        byProject: { ...s.byProject, [key(projectId)]: (s.byProject[key(projectId)] ?? []).map((q) => (q.id === id ? { ...q, status: 'open' as const, merged: false } : q)) },
      })),
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
  const out: Record<QuestionSource, number> = { spec: 0, io: 0, electrical: 0, hmi: 0, review: 0 };
  for (const q of list) if (q.status === 'open') out[q.source]++;
  return out;
}

/** Register a stage's current questions with the store (call from the page that shows them). */
export function useSyncQuestions(source: QuestionSource, items: { text: string; assumption?: string; section?: SpecSectionId }[] | null): void {
  const projectId = useActiveProjectId();
  const sync = useQuestionStore((s) => s.sync);
  const sig = items ? JSON.stringify(items) : null;
  useEffect(() => {
    if (sig !== null) sync(projectId, source, JSON.parse(sig) as { text: string; assumption?: string; section?: SpecSectionId }[]);
  }, [projectId, source, sig, sync]);
}
