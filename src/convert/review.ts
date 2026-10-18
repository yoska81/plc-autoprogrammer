/**
 * The review of what was read from the drawings, before anything is rebuilt: every I/O point, part and
 * motor is shown with where it was read and how sure the reading is; the user confirms or corrects each
 * one or leaves it out. What stays low-confidence and unconfirmed becomes a question on the Machine
 * description page ("Existing drawings"), so the design is built on it only as a stated assumption.
 */
import type { SyncItem } from '../components/questions/useQuestionStore';
import type { SpecSectionId } from '../spec/types';
import type { ExistingMachine } from './types';

export interface ReviewState {
  /** Items left out of the conversion (keys from itemKey). */
  excluded: string[];
  /** Items the user confirmed or corrected (a correction confirms it). */
  confirmed: string[];
}

export const EMPTY_REVIEW: ReviewState = { excluded: [], confirmed: [] };

export type ReviewKind = 'io' | 'part' | 'motor';
/** Stable key of one item: "io:X0", "part:KM1", "motor:M1". */
export const itemKey = (kind: ReviewKind, id: string) => `${kind}:${id}`;

const ioSection = (category: string): SpecSectionId => (category === 'Safety' ? 'safety' : category === 'Operator/HMI' ? 'operator' : category === 'Pneumatic' ? 'pneumatics' : 'sensing');

/** Every item to review, with its key, what it is and how sure the reading is. */
export function reviewItems(m: ExistingMachine): { key: string; kind: ReviewKind; label: string; source: string; confidence: 'high' | 'medium' | 'low'; section: SpecSectionId }[] {
  return [
    ...m.io.map((p) => ({ key: itemKey('io', p.address), kind: 'io' as const, label: `${p.address} ${p.description}`, source: p.source, confidence: p.confidence, section: ioSection(p.category) })),
    ...m.components.map((c) => ({ key: itemKey('part', c.tag), kind: 'part' as const, label: `${c.tag} ${[c.manufacturer, c.partNumber].filter(Boolean).join(' ') || c.description}`, source: c.source, confidence: c.confidence, section: 'utilities' as const })),
    ...m.motors.map((x) => ({ key: itemKey('motor', x.tag), kind: 'motor' as const, label: `${x.tag} ${x.description}${x.kw ? ` ${x.kw} kW` : ''}`, source: x.source, confidence: x.confidence, section: 'motion' as const })),
  ];
}

/** Items still to look at: low confidence and neither confirmed nor left out. */
export function unconfirmed(m: ExistingMachine, r: ReviewState) {
  return reviewItems(m).filter((i) => i.confidence === 'low' && !r.confirmed.includes(i.key) && !r.excluded.includes(i.key));
}

/** The machine as reviewed (left-out items removed) and the questions for what was not confirmed. */
export function reviewedMachine(m: ExistingMachine, r: ReviewState): { machine: ExistingMachine; questions: SyncItem[] } {
  const out = (kind: ReviewKind, id: string) => r.excluded.includes(itemKey(kind, id));
  const machine: ExistingMachine = {
    ...m,
    io: m.io.filter((p) => !out('io', p.address)),
    components: m.components.filter((c) => !out('part', c.tag)),
    motors: m.motors.filter((x) => !out('motor', x.tag)),
  };
  const questions = unconfirmed(machine, r).map((i) => ({
    text: `Please check on the machine: ${i.label} — read with low confidence${i.source ? ` from ${i.source}` : ''}. Is it right?`,
    section: i.section,
    assumption: 'As read from the drawings',
  }));
  return { machine, questions };
}
