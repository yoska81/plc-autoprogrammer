import { SPEC_SECTIONS, type SpecSectionId } from '../../spec/types';
import type { QuestionSource } from './useQuestionStore';

/**
 * Quick-answer choices a question offers: Yes / No for yes-no questions,
 * the named alternatives for "A or B" questions ("Homing: home switch or
 * hard stop?" → home switch, hard stop). Empty when there is nothing to offer.
 */
export function quickChoices(question: string): string[] {
  const q = question.trim().replace(/\s+/g, ' ');
  const tail = (q.includes(':') ? q.slice(q.lastIndexOf(':') + 1) : q).replace(/[?.]+\s*$/, '').trim();
  const m = /^(.*?)\s+or\s+([^,]+)$/i.exec(tail);
  if (m) {
    const last = m[2].trim();
    const n = Math.min(4, Math.max(1, last.split(' ').length));
    const before = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const first = before.shift() ?? '';
    // Without a colon the first alternative is the end of the sentence ("Is it 0 or 1?" → "0").
    const firstOpt = q.includes(':') ? first : first.split(' ').slice(-n).join(' ');
    const opts = [firstOpt, ...before, last].map((s) => s.replace(/^(either|a|an|the)\s+/i, '').trim()).filter(Boolean);
    if (opts.length >= 2 && opts.length <= 6 && opts.every((o) => o.length <= 48)) return [...new Set(opts)];
  }
  if (/^(is|are|does|do|did|should|can|could|will|would|has|have|must|shall|may)\b/i.test(q)) return ['Yes', 'No'];
  // A stated assumption ("Assumed 480 VAC supply.") can simply be confirmed.
  if (!/\?\s*$/.test(q)) return ['Correct as stated'];
  return [];
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'what', 'how', 'which', 'when', 'does', 'do', 'be', 'with', 'it', 'this', 'that', 'there', 'at', 'by', 'from', 'each', 'any', 'should', 'will']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

const DEFAULT_SECTION: Record<QuestionSource, SpecSectionId> = {
  spec: 'other', io: 'sensing', electrical: 'utilities', hmi: 'operator', program: 'sequence', review: 'other',
};

/** Extra words that point to a section (beyond its title and hint). */
const KEYWORDS: Partial<Record<SpecSectionId, string>> = {
  overview: 'throughput rate minute hour cycle time speed capacity product line',
  safety: 'emergency estop category performance level light curtain',
  utilities: 'voltage supply phase amps fault current air pressure enclosure nema ambient',
  operator: 'pushbutton pilot light stack hmi screen display',
  alarms: 'alarm fault reset timeout jam',
};

/** Crude stem so "homed", "homing" and "home" match. */
const stem = (w: string) => w.replace(/(ing|ed|es|s|e)$/, '');

/** Spec section an answer belongs in: best word overlap with the section titles (weighted) and hints. */
export function guessSection(question: string, source: QuestionSource): SpecSectionId {
  const w = new Set(words(question).map(stem));
  let best: SpecSectionId = DEFAULT_SECTION[source];
  let score = 0;
  for (const s of SPEC_SECTIONS) {
    const hits = (t: string) => new Set(words(t).map(stem).filter((x) => w.has(x))).size;
    const sc = 2 * hits(s.title) + hits(s.hint) + 2 * hits(KEYWORDS[s.id] ?? '');
    if (sc > score) { score = sc; best = s.id; }
  }
  return best;
}
