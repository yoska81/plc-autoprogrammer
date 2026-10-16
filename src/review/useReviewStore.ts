import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Finding, FindingMark, FindingStatus } from './types';

/** A finding handed to another stage's AI fix flow (consumed once by that page). */
export interface FixRequest { stage: 'program'; text: string; findingId: string }

interface ReviewStore {
  checks: Finding[];
  checkedAt: string | null;
  ai: { summary: string; findings: Finding[]; at: string } | null;
  /** Resolved / ignored marks by finding id; findings without a mark are open. */
  marks: Record<string, FindingMark>;
  fixRequest: FixRequest | null;
  setChecks: (f: Finding[]) => void;
  setAi: (r: { summary: string; findings: Finding[] } | null) => void;
  mark: (id: string, status: FindingStatus, reason: string) => void;
  requestFix: (r: FixRequest | null) => void;
}

export const useReviewStore = create<ReviewStore>()(
  persist(
    (set) => ({
      checks: [],
      checkedAt: null,
      ai: null,
      marks: {},
      fixRequest: null,
      setChecks: (checks) => set({ checks, checkedAt: new Date().toISOString() }),
      setAi: (r) => set({ ai: r ? { ...r, at: new Date().toISOString() } : null }),
      mark: (id, status, reason) => set((s) => {
        const marks = { ...s.marks };
        if (status === 'open') delete marks[id];
        else marks[id] = { status, reason, at: new Date().toISOString() };
        return { marks };
      }),
      requestFix: (fixRequest) => set({ fixRequest }),
    }),
    { name: 'plc-review-store', partialize: (s) => ({ checks: s.checks, checkedAt: s.checkedAt, ai: s.ai, marks: s.marks }) },
  ),
);

export const statusOf = (marks: Record<string, FindingMark>, id: string): FindingStatus => marks[id]?.status ?? 'open';
