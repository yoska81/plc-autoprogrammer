import { useSpecStore } from '../../store/useSpecStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { SPEC_SECTIONS, type SpecSections } from '../../spec/types';
import { guessSection } from './parse';
import { SOURCE_LABEL, useQuestionStore, type Question } from './useQuestionStore';

/**
 * Write answered questions into the spec. With the AI: one call with all new
 * answers so they land in the right sections in the spec's own words.
 * Without it (or if that call fails): appended under an "Answers to open
 * questions" heading in the matching section. Changing the spec makes the
 * later stages out of date, so "Update" picks the answers up.
 */

const HEADING = 'Answers to open questions:';

export function answerLine(q: Question): string {
  const a = q.status === 'assumed'
    ? `no preference — use the engineer's assumption${q.assumption && q.assumption !== q.text ? ` (${q.assumption})` : ''}`
    : q.answer.trim();
  return `- Q: ${q.text.trim()} A: ${a}`;
}

/** Plain append of answers to their sections (no AI). */
export function appendAnswers(sections: SpecSections, qs: Question[]): SpecSections {
  const out = { ...sections };
  for (const q of qs) {
    const id = q.section ?? guessSection(q.text, q.source);
    const cur = (out[id] ?? '').trimEnd();
    const line = answerLine(q);
    if (cur.includes(line)) continue;
    out[id] = cur.includes(HEADING) ? `${cur}\n${line}` : `${cur}${cur ? '\n\n' : ''}${HEADING}\n${line}`;
  }
  return out;
}

const pending = (projectId: string | null) =>
  (useQuestionStore.getState().byProject[projectId ?? 'default'] ?? []).filter((q) => q.status !== 'open' && !q.merged);

/** Merge every answered-but-not-merged question of the open project into the spec now. */
export async function mergeAnswersNow(): Promise<void> {
  const projectId = useProjectsStore.getState().activeId;
  const qs = pending(projectId);
  const store = useQuestionStore.getState();
  if (!qs.length || store.merge.busy) return;
  store.setMerge({ busy: true, error: null, note: null });
  const spec = useSpecStore.getState();
  const settings = useSettingsStore.getState();
  let note: string;
  try {
    if (settings.anthropicApiKey) {
      try {
        const { organizeSpec } = await import('../../lib/ai/specAI');
        const r = await organizeSpec({
          apiKey: settings.anthropicApiKey, model: settings.anthropicModel, effort: settings.effort,
          current: spec.sections, files: [],
          newText: `Answers to open questions (from the ${[...new Set(qs.map((q) => SOURCE_LABEL[q.source]))].join(', ')}). Put each answer into the section it belongs to:\n${qs.map(answerLine).join('\n')}`,
        });
        // Keep only the questions the AI still has; answered ones are gone from its list.
        spec.setSections(r.sections);
        spec.setQuestions(r.questions);
        note = `${qs.length} answer${qs.length === 1 ? '' : 's'} added to the spec. ${r.summary}`;
      } catch (e) {
        spec.setSections(appendAnswers(spec.sections, qs));
        note = `The AI could not merge the answers (${e instanceof Error ? e.message : String(e)}), so they were added under "Answers to open questions" in the matching spec sections.`;
      }
    } else {
      spec.setSections(appendAnswers(spec.sections, qs));
      note = `${qs.length} answer${qs.length === 1 ? '' : 's'} added under "Answers to open questions" in ${[...new Set(qs.map((q) => SPEC_SECTIONS.find((s) => s.id === (q.section ?? guessSection(q.text, q.source)))?.title))].join(', ')}.`;
    }
    useQuestionStore.getState().markMerged(projectId, qs.map((q) => q.id));
    useQuestionStore.getState().setMerge({ busy: false, note });
  } catch (e) {
    useQuestionStore.getState().setMerge({ busy: false, error: e instanceof Error ? e.message : String(e) });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Merge shortly after the last answer, so several quick answers go in one AI call. */
export function scheduleMerge(delayMs = 1500): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void mergeAnswersNow(); }, delayMs);
}
