/**
 * Which AI / checker notes are questions for the user and which are technical
 * issues. Only real questions (information the user can know: speeds, counts,
 * sensor types, preferences) and assumptions the user must confirm belong in
 * "Questions & answers". Technical problems (HMI layout, wiring, catalog,
 * protection) go to the design review, where "Ask AI to fix" handles them.
 */

export type NoteKind = 'question' | 'assumption' | 'issue';
export interface DesignNote { kind: NoteKind; text: string }

/** JSON schema of one note in the AI replies. */
export const NOTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'text'],
  properties: {
    kind: { type: 'string', enum: ['question', 'assumption', 'issue'] },
    text: { type: 'string' },
  },
} as const;

/** Prompt text explaining the note kinds to the AI. */
export const NOTE_KINDS_RULE = `Each note has a "kind":
- "question": information missing from the specification that the customer can answer (speeds, counts, sizes, sensor or product types, preferences). Write it as a plain-English question.
- "assumption": something you assumed that the customer should confirm (e.g. "Motor M1 is 2 HP; confirm the nameplate").
- "issue": a technical remark or problem for the engineer (layout, wiring, protection, catalog limits, code rules). The customer is not an engineer and will never see these as questions.`;

/** Technical / checker messages, for notes stored before the AI gave a kind. */
const ISSUE_PATTERNS: RegExp[] = [
  /^layout check:/i,
  /\bheader bar\b/i,
  /\bon the HMI page\b/i,
  /\boverlap/i,
  /touch target/i,
  /brought back onto the/i,
  /moved into free space/i,
  /\bnot in the catalog\b|\bcatalog has no\b/i,
  /\bAWG\b|\bbranch protection\b|\bfused terminal\b/i,
];

export const isTechnicalIssue = (text: string) => ISSUE_PATTERNS.some((r) => r.test(text));

/** Reads AI notes that may be objects with a kind or (older replies) plain strings. */
export function normalizeNotes(raw: unknown): DesignNote[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((n): DesignNote[] => {
    if (typeof n === 'string') return n.trim() ? [{ kind: isTechnicalIssue(n) ? 'issue' : 'assumption', text: n.trim() }] : [];
    if (n && typeof n === 'object' && typeof (n as DesignNote).text === 'string' && (n as DesignNote).text.trim()) {
      const k = (n as DesignNote).kind;
      const text = (n as DesignNote).text.trim();
      return [{ kind: k === 'question' || k === 'assumption' || k === 'issue' ? (isTechnicalIssue(text) ? 'issue' : k) : (isTechnicalIssue(text) ? 'issue' : 'assumption'), text }];
    }
    return [];
  });
}

/** The notes of a design that are for the user: `askUser` when the AI classified them, else every note that is not a technical issue. */
export function userNotes(design: { notes: string[]; askUser?: string[] } | null | undefined): string[] {
  if (!design) return [];
  return (design.askUser ?? design.notes).filter((n) => !isTechnicalIssue(n));
}

/** True when a note of this design is a technical issue (not a question for the user). */
export function isIssueNote(design: { askUser?: string[] }, note: string): boolean {
  return design.askUser ? !design.askUser.includes(note) : isTechnicalIssue(note);
}

/**
 * Prompt rule for every AI that asks questions or lists assumptions: the spec's "Questions and answers"
 * (answers from every page and the design review decisions) are settled.
 */
export const ANSWERED_RULE = `The specification's "Questions and answers" section is what the customer already answered on any page (machine description, I/O list, electrical design, HMI, PLC program, design review) and the design review decisions. Those are settled: use the answers in the design, never ask any of them again in other words, and never restate one as an assumption to confirm (not even "the customer confirmed X, so confirm Y"). An answer "Not applicable — do not ask again" means: do not ask about that at all. Ask only about what is still unknown.`;
