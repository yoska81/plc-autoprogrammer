/** Design review result for the deliverables: fresh checks + the stored AI review, with resolved/ignored marks. */
import type { ProjectSnapshot } from '../deliverables/collect';
import { checksFor } from './actions';
import { statusOf, useReviewStore } from './useReviewStore';
import { AREA_LABEL, SEVERITY_LABEL, sortFindings, type FindingStatus } from './types';
import { currentEdits } from '../edits/useEditsStore';

/** Key of the user's note on a finding (hand-edit store). */
export const reviewNoteKey = (findingId: string) => `review:${findingId}`;

export interface ReviewRow {
  id: string;
  severity: string;
  area: string;
  title: string;
  fix: string;
  source: 'Check' | 'AI review';
  status: FindingStatus;
  reason: string;
  date: string;
  /** The user's note on the finding. */
  note: string;
}

export function reviewRows(p: ProjectSnapshot): ReviewRow[] {
  const { ai, marks } = useReviewStore.getState();
  const { notes } = currentEdits();
  const findings = sortFindings([...checksFor(p), ...(ai?.findings ?? [])]);
  return findings.map((f, i) => ({
    id: `DR-${String(i + 1).padStart(2, '0')}`,
    severity: SEVERITY_LABEL[f.severity],
    area: AREA_LABEL[f.area],
    // Long checker messages are shortened in the title; the document prints them in full.
    title: f.title.endsWith('…') ? f.detail : f.title,
    fix: f.fix,
    source: f.source === 'ai' ? 'AI review' : 'Check',
    status: statusOf(marks, f.id),
    reason: marks[f.id]?.reason ?? '',
    date: marks[f.id]?.at.slice(0, 10) ?? '',
    note: notes[reviewNoteKey(f.id)] ?? '',
  }));
}

/** One line for the document: when the AI review ran, or that it did not. */
export function aiReviewNote(): string {
  const ai = useReviewStore.getState().ai;
  return ai ? `AI design review of ${ai.at.slice(0, 10)}: ${ai.summary}` : 'The AI design review has not been run for this revision (Design review page).';
}
