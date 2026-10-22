import { useDraft, useDraftStore } from '../../store/useDraftStore';
import type { AiSummaries } from './explain';

/** The AI's paragraphs per block, saved with the project (each with the fingerprint of the logic it describes). */
export const EXPLAIN_AI_KEY = 'program.explainAi';

const NONE: AiSummaries = {};
export const useExplainSummaries = () => useDraft<AiSummaries>(EXPLAIN_AI_KEY, NONE);
export const explainSummaries = (): AiSummaries => (useDraftStore.getState().drafts[EXPLAIN_AI_KEY] as AiSummaries | undefined) ?? NONE;
export const saveExplainSummaries = (s: AiSummaries) => useDraftStore.getState().setDraft(EXPLAIN_AI_KEY, s);
