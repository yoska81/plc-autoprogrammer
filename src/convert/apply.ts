/**
 * Put a read (and converted) existing machine into the open project: target region and supply, the
 * machine description the AI wrote (gaps as questions on the Machine description page), the original
 * I/O list (addresses re-assigned for the new PLC) and the motors. The machine itself is kept with the
 * project (draft "convert.machine") for the conversion table and the function-kept check.
 */
import { useDraftStore } from '../store/useDraftStore';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { applyRegion } from '../standards/applyRegion';
import type { SpecSections } from '../spec/types';
import type { SyncItem } from '../components/questions/useQuestionStore';
import type { ConvertTarget, Conversion } from './convert';
import type { ExistingMachine } from './types';

export const MACHINE_KEY = 'convert.machine';
export const TARGET_KEY = 'convert.target';
export const QUESTIONS_KEY = 'convert.questions';
/** No PLC on the machine: keep its relay logic or move it into a new PLC (ConvertTarget.logic). */
export const LOGIC_KEY = 'convert.logic';

/** The machine read from the drawings for the open project, if any. */
export const storedMachine = (): ExistingMachine | null => withCircuits(useDraftStore.getState().drafts[MACHINE_KEY] as ExistingMachine | undefined);

/** A machine kept by an earlier version has no circuits list. */
export function withCircuits(m: ExistingMachine | null | undefined): ExistingMachine | null {
  return m ? (m.circuits ? m : { ...m, circuits: [] }) : null;
}

/** The conversion target chosen for the open project. */
export const storedTarget = (): ConvertTarget | null => (useDraftStore.getState().drafts[TARGET_KEY] as ConvertTarget | undefined) ?? null;

/** Keep the read machine with the project (before it is applied, so the user can review it first). */
export function keepMachine(m: ExistingMachine, target: ConvertTarget) {
  useDraftStore.getState().setDraft(MACHINE_KEY, m);
  useDraftStore.getState().setDraft(TARGET_KEY, target);
}

/** The description with the conversion's facts added (target supply and standard) where they belong. */
export function convertedSpec(m: ExistingMachine, conv: Conversion): SpecSections {
  const spec = { ...m.spec } as SpecSections;
  const std = conv.target.region === 'US' ? 'NFPA 79, UL 508A and the NEC' : conv.target.region === 'Canada' ? 'CSA C22.2 No. 14 and the CEC' : 'IEC 60204-1';
  spec.utilities = [m.spec.utilities, `Conversion: ${conv.supplyNote} The panel is redesigned to ${std}.`].filter(Boolean).join('\n');
  // nothing is certified by a conversion: the safety functions are kept, then re-validated
  spec.safety = [m.spec.safety, 'Converted design: every safety function above is kept, and must be re-validated after the conversion (risk assessment, then verification per ISO 13849-2 / NFPA 79 9.2.5.4). The panel needs its own UL 508A listing or field evaluation; the part equivalents carry only their makers\' listings.'].filter(Boolean).join('\n');
  for (const r of conv.recommendations) spec[r.section] = [spec[r.section], `Conversion: ${r.text}`].filter(Boolean).join('\n');
  // the interlocks the wiring enforced, word for word, so the new program and the function-kept check keep them
  if (m.interlocks.length) spec.sequence = [spec.sequence, `Interlocks to keep (from the existing wiring):\n${m.interlocks.map((i) => `- ${i.description}`).join('\n')}`].filter(Boolean).join('\n');
  // each control circuit, with the new tags, where its function now lives (PLC program, relays, or the drive)
  const group = (b: 'program' | 'relays' | 'drive', title: string) => {
    const list = conv.circuits.filter((c) => c.becomes === b);
    if (list.length) spec.sequence = [spec.sequence, `${title}\n${list.map((c) => `- ${c.text}`).join('\n')}`].filter(Boolean).join('\n');
  };
  group('program', 'Program logic from the relay circuits (the PLC keeps each function exactly):');
  group('relays', 'Relay circuits kept as hardwired logic (new tags, parts for the new standard):');
  group('drive', 'Kept in the drive\'s own logic (set its parameters as before):');
  if (conv.motors.length) {
    spec.motion = [spec.motion, `For the new supply: ${conv.motors.map((x, i) => `${x.tag} ${conv.motorKw[i]?.kw ? `${conv.motorKw[i].kw} kW → ` : ''}${x.hp} HP`).join(', ')}.`].filter(Boolean).join('\n');
  }
  return spec;
}

/**
 * Write the machine into the open project (replaces its description, I/O list and motors).
 * descriptionOnly: write only the description and the questions, for a flow that already wrote the I/O,
 * PLC and program itself (the program import, src/plc/import/).
 */
export function applyExistingMachine(m: ExistingMachine, conv: Conversion, reviewQuestions: SyncItem[] = [], opts: { descriptionOnly?: boolean } = {}) {
  if (!opts.descriptionOnly) applyRegion(conv.target.region);
  useSpecStore.getState().setSections(convertedSpec(m, conv));
  const projectId = useProjectsStore.getState().activeId;
  // their own source (the description page's checklist re-syncs 'spec'), kept with the project for the global registration
  const questions = [
    ...m.questions.map((q) => ({ text: q.text, section: q.section, ...(q.assumption ? { assumption: q.assumption } : {}), topic: 'From the drawings' })),
    ...conv.questions.map((q) => ({ ...q, topic: 'Converting to the new standard' })),
    ...reviewQuestions.map((q) => ({ ...q, topic: 'Confirm what was read' })),
  ];
  useDraftStore.getState().setDraft(QUESTIONS_KEY, questions);
  useQuestionStore.getState().sync(projectId, 'drawings', questions);
  if (opts.descriptionOnly) { keepMachine(m, conv.target); return; }
  // The original I/O (with the relay logic moved into a PLC, also the field devices of its circuits),
  // by function: addresses are assigned again for the new PLC.
  // Relay logic kept: no PLC, so no I/O list (the field devices stay on their relay circuits).
  const io = conv.logic === 'keep-relays' ? [] : conv.io;
  useIOStore.getState().importPoints(io.map((p) => ({ description: p.description, type: p.type, category: p.category, deviceType: p.deviceType })), true);
  const el = useElectricalStore.getState();
  el.setInputs({ ...el.inputs, supply: conv.supply, motors: conv.motors, notes: [el.inputs.notes, 'Converted from existing drawings: keep every original function, interlock and safety function.'].filter(Boolean).join('\n') });
  keepMachine(m, conv.target);
}
