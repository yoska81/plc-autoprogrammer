/**
 * "Start clean from my description": a project made as a copy of the example keeps the example's
 * equipment, electrical design, motors, HMI, program and questions until they are regenerated.
 * This finds those leftovers (compared with the example's seed data) and clears them, keeping the
 * user's machine description and — if they want — their I/O list. A backup is taken first.
 */
import { DESIGN, EXAMPLE_ID, HMI, LADDER, RECOMMENDATION, SPEC } from '../preview/sampleProject';
import { useProjectStore } from '../store/useProjectStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { useSpecStore } from '../store/useSpecStore';
import { useStageStore } from '../store/useStageStore';
import { useDraftStore } from '../store/useDraftStore';
import { useReviewStore } from '../review/useReviewStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { backupActiveProject, useProjectsStore } from '../store/useProjectsStore';
import { specToText } from './types';
import { looksLeftOver } from './leftovers';

export type LeftoverKey = 'equipment' | 'electrical' | 'motors' | 'hmi' | 'program' | 'notes' | 'questions';
export interface Leftover { key: LeftoverKey; label: string }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What in the open project still comes from the example (empty for the example itself). */
export function exampleLeftovers(): Leftover[] {
  if (useProjectsStore.getState().activeId === EXAMPLE_ID) return [];
  const spec = useSpecStore.getState().sections;
  // A description that is still the example's: starting clean would keep the example anyway.
  if (same(spec, SPEC)) return [];
  const specText = specToText(spec);
  const out: Leftover[] = [];
  const rec = useProjectStore.getState().recommendation;
  if (rec && same(rec, RECOMMENDATION)) out.push({ key: 'equipment', label: "the example's equipment suggestion" });
  const el = useElectricalStore.getState();
  if (el.design && (same(el.design.components, DESIGN.components) || /^Example panel/.test(el.explanation ?? ''))) out.push({ key: 'electrical', label: "the example's electrical design" });
  const motors = el.inputs.motors.filter((m) => same(m, DESIGN.inputs.motors.find((x) => x.tag === m.tag)) || (m.description.trim() && looksLeftOver(m.description, specText, 1).leftOver));
  if (motors.length) out.push({ key: 'motors', label: `motor${motors.length > 1 ? 's' : ''} ${motors.map((m) => `${m.tag} "${m.description}"`).join(', ')}` });
  const hmi = useHmiStore.getState().design;
  if (hmi && same(hmi.tags, HMI.tags)) out.push({ key: 'hmi', label: "the example's HMI screens" });
  const prog = useProgramStore.getState();
  if (prog.ladder.rungs.length && same(prog.ladder.rungs, LADDER.rungs)) out.push({ key: 'program', label: "the example's PLC program" });
  if (prog.userPrompt.trim() && looksLeftOver(prog.userPrompt, specText).leftOver) out.push({ key: 'notes', label: 'program notes about another machine' });
  const pid = useProjectsStore.getState().activeId ?? 'default';
  const exampleNotes = new Set([...DESIGN.notes, ...(HMI.notes ?? [])].map((n) => n.trim().toLowerCase()));
  const qs = (useQuestionStore.getState().byProject[pid] ?? []).filter((q) => q.source !== 'spec' && (exampleNotes.has(q.text.trim().toLowerCase()) || out.length > 0));
  if (qs.length) out.push({ key: 'questions', label: `${qs.length} question${qs.length > 1 ? 's' : ''} from the example's design` });
  return out;
}

/**
 * Clear every stage output that came from the example (equipment suggestion, electrical design
 * and its motors/notes/required parts, HMI, program and its notes, design-review results, the
 * questions those stages asked). The machine description stays; the I/O list stays unless
 * `keepIo` is false. A backup of the project is taken first (Project › Recover).
 */
export function startClean({ keepIo }: { keepIo: boolean }) {
  backupActiveProject('Before "Start clean from my description"');
  const project = useProjectStore.getState();
  project.setRecommendation(null);
  project.setModules([]);
  project.setPlc(project.plcId, '');
  const el = useElectricalStore.getState();
  useElectricalStore.setState({ design: null, explanation: null, inputs: { ...el.inputs, motors: [], notes: '', requiredParts: [] } });
  useHmiStore.setState({ design: null, explanation: null, hmiPartNumber: '' });
  useProgramStore.getState().clearLadder();
  useProgramStore.setState({ userPrompt: '', versions: [], generatedCode: '', reasoning: null });
  const review = useReviewStore.getState();
  review.setAi(null);
  useReviewStore.setState({ marks: {} });
  if (!keepIo) useIOStore.setState({ projectIO: [] });
  const pid = useProjectsStore.getState().activeId ?? 'default';
  useQuestionStore.setState((s) => ({ byProject: { ...s.byProject, [pid]: (s.byProject[pid] ?? []).filter((q) => q.source === 'spec') } }));
  // Generation records of the cleared stages; pending choices made on the example's outputs.
  const keep = keepIo ? ['io'] : [];
  useStageStore.setState((s) => ({ sources: Object.fromEntries(Object.entries(s.sources).filter(([k]) => keep.includes(k))) }));
  useDraftStore.setState((s) => ({ drafts: Object.fromEntries(Object.entries(s.drafts).filter(([k]) => k.startsWith('spec.'))) }));
}
