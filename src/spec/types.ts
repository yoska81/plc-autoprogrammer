/**
 * The project specification: the single source of truth every later stage
 * (I/O, electrical, HMI, PLC program, simulation) is generated from.
 */

export type SpecSectionId =
  | 'overview' | 'sequence' | 'safety' | 'guarding' | 'homing' | 'modes'
  | 'motion' | 'pneumatics' | 'sensing' | 'operator' | 'alarms' | 'utilities' | 'other';

export interface SpecSectionDef {
  id: SpecSectionId;
  title: string;
  /** What to write here; shown as the placeholder. */
  hint: string;
}

export const SPEC_SECTIONS: SpecSectionDef[] = [
  { id: 'overview', title: 'Machine overview', hint: 'What the machine does, the product, throughput, where it sits in the line.' },
  { id: 'sequence', title: 'Sequence of operation', hint: 'Step by step automatic cycle: what moves, in which order, what each step waits for.' },
  { id: 'safety', title: 'Safety', hint: 'E-stops and where they are, safety relay / category, light curtains, what must stop and how (stop category 0/1).' },
  { id: 'guarding', title: 'Doors and guarding', hint: 'Guard doors, interlock switches, door locks, what happens when a door opens.' },
  { id: 'homing', title: 'Start-up and homing', hint: 'Power-up state, homing order and method, conditions before Auto can start.' },
  { id: 'modes', title: 'Operating modes', hint: 'Auto, Manual/jog, Setup, single cycle; how the operator switches modes.' },
  { id: 'motion', title: 'Motors and drives', hint: 'Each motor: purpose, HP, voltage, starter or VFD, direction, speeds, servo axes.' },
  { id: 'pneumatics', title: 'Pneumatics', hint: 'Each cylinder / gripper / vacuum: valve type, sensors, fail-safe position.' },
  { id: 'sensing', title: 'Sensors and product detection', hint: 'Photo-eyes, proximity sensors, part presence, counting, reject detection.' },
  { id: 'operator', title: 'Operator station and HMI', hint: 'Pushbuttons, pilot lights, stack light, HMI model and screens wanted.' },
  { id: 'alarms', title: 'Alarms and recovery', hint: 'Faults to detect (timeouts, jams, overloads), alarm messages, how to reset and resume.' },
  { id: 'utilities', title: 'Power and utilities', hint: 'Supply voltage, air supply, enclosure rating, environment, standards (UL 508A, NFPA 79).' },
  { id: 'other', title: 'Other requirements', hint: 'Interfaces to other machines, recipes, data logging, customer standards.' },
];

/**
 * The spec sections, plus `qa`: the project's questions and answers as text
 * (kept in sync from the question list). The Q&A is part of the spec: it is
 * in the fingerprint (answering makes later stages out of date) and in the
 * text every AI prompt reads, without being copied into the sections.
 */
export type SpecSections = Record<SpecSectionId, string> & { qa?: string };

export const EMPTY_SECTIONS: SpecSections = Object.fromEntries(SPEC_SECTIONS.map((s) => [s.id, ''])) as SpecSections;

export interface SpecDocument {
  name: string;
  addedAt: string;
}

/** Stable short fingerprint of any JSON-able value (to detect out-of-date stages). */
export function fingerprint(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function specToText(sections: SpecSections): string {
  const parts = SPEC_SECTIONS.filter((d) => sections[d.id]?.trim()).map((d) => `## ${d.title}\n${sections[d.id].trim()}`);
  if (sections.qa?.trim()) parts.push(`## Questions and answers\n${sections.qa.trim()}`);
  return parts.join('\n\n');
}

/** Section titles whose text differs between two versions of the spec. */
export function changedSections(before: SpecSections | null, after: SpecSections): string[] {
  const out = SPEC_SECTIONS.filter((d) => (before?.[d.id] ?? '').trim() !== (after[d.id] ?? '').trim()).map((d) => d.title);
  if ((before?.qa ?? '').trim() !== (after.qa ?? '').trim()) out.push('Questions and answers');
  return out;
}
