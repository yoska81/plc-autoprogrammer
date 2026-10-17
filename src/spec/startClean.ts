/**
 * "Start clean from my description": a project made as a copy of the example keeps the example's
 * equipment, electrical design, motors, HMI, program and questions until they are regenerated.
 * This finds those leftovers (compared with the example's seed data) and clears them, keeping the
 * user's machine description and — if they want — their I/O list. A backup is taken first.
 */
import { DESIGN, DOC_CONTROL, EXAMPLE_ID, EXAMPLE_IO, HMI, LADDER, RECOMMENDATION, SPEC } from '../preview/sampleProject';
import { useProjectStore } from '../store/useProjectStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { useSpecStore } from '../store/useSpecStore';
import { useStageStore } from '../store/useStageStore';
import { useEditsStore } from '../edits/useEditsStore';
import { useDraftStore } from '../store/useDraftStore';
import { useReviewStore } from '../review/useReviewStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { backupActiveProject, useProjectsStore } from '../store/useProjectsStore';
import { SPEC_SECTIONS, specToText, type SpecSectionId } from './types';
import { looksLeftOver } from './leftovers';

export type LeftoverKey = 'spec' | 'io' | 'docControl' | 'equipment' | 'electrical' | 'motors' | 'hmi' | 'program' | 'notes' | 'questions';
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
  const sections = exampleSections();
  if (sections.length) out.push({ key: 'spec', label: `description sections still the example's (${sections.map((id) => SPEC_SECTIONS.find((d) => d.id === id)!.title.toLowerCase()).join(', ')})` });
  if (ioIsExample()) out.push({ key: 'io', label: `the example's I/O list (${EXAMPLE_IO.length} conveyor points)` });
  const doc = exampleDocControl();
  if (doc.length) out.push({ key: 'docControl', label: `the example's document control (${doc.join(', ')})` });
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

const norm = (t: string | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();

/** Description sections (besides the overview) whose text is still the example's. */
export function exampleSections(): SpecSectionId[] {
  const spec = useSpecStore.getState().sections;
  return SPEC_SECTIONS.map((d) => d.id).filter((id) => id !== 'overview' && norm(SPEC[id]) && norm(spec[id]) === norm(SPEC[id]));
}

/** The I/O list is still the example's 9 conveyor points (same descriptions and types, any order). */
export function ioIsExample(): boolean {
  const io = useIOStore.getState().projectIO;
  if (io.length !== EXAMPLE_IO.length) return false;
  const key = (p: { description: string; type: string }) => `${p.type}:${norm(p.description).toLowerCase()}`;
  const ex = new Set(EXAMPLE_IO.map(key));
  return io.every((p) => ex.has(key(p)));
}

/** Title-block fields still holding the example's values, as "customer Example Foods Inc."… */
function exampleDocControl(): string[] {
  const info = useProjectStore.getState().info;
  const labels: Record<keyof typeof DOC_CONTROL, string> = { customer: 'customer', site: 'site', projectNumber: 'project no.', drawingPrefix: 'drawing prefix', preparedBy: 'prepared by' };
  const out = (Object.keys(DOC_CONTROL) as (keyof typeof DOC_CONTROL)[]).filter((k) => k !== 'preparedBy' && info[k].trim() === DOC_CONTROL[k]).map((k) => `${labels[k]} ${DOC_CONTROL[k]}`);
  if (out.length && info.revisions.some((r) => r.description === 'Issued for review' && r.by === 'AI')) out.push('its revision history');
  return out;
}

/** Drawing prefix from the project name: initials ("Sealing Head" → "SH"), or its first letters. */
export function prefixFromName(name: string): string {
  const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const p = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3);
  return p.slice(0, 8);
}

/**
 * Clear every stage output that came from the example (equipment suggestion, electrical design
 * and its motors/notes/required parts, HMI, program and its notes, design-review results, the
 * questions those stages asked). The machine description stays; the I/O list stays unless
 * `keepIo` is false. A backup of the project is taken first (Project › Recover).
 */
export function startClean({ keepIo, clearSections = true }: { keepIo: boolean; clearSections?: boolean }) {
  backupActiveProject('Before "Start clean from my description"');
  const project = useProjectStore.getState();
  // The example's document control: its customer, site, job number, prefix and revision history.
  if (exampleDocControl().length) {
    const info = project.info;
    const reset = <K extends keyof typeof DOC_CONTROL>(k: K) => (info[k].trim() === DOC_CONTROL[k] ? '' : info[k]);
    const name = useProjectsStore.getState().projects.find((p) => p.id === useProjectsStore.getState().activeId)?.name ?? '';
    project.setInfo({
      customer: reset('customer'), site: reset('site'), projectNumber: reset('projectNumber'), preparedBy: reset('preparedBy'),
      drawingPrefix: info.drawingPrefix.trim() === DOC_CONTROL.drawingPrefix ? prefixFromName(name) : info.drawingPrefix,
      revisions: [], checkedBy: '', approvedBy: '',
    });
  }
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
  // Description sections that are still the example's text: emptied (the AI fills them from the overview).
  const sections = clearSections ? exampleSections() : [];
  if (sections.length) {
    const spec = useSpecStore.getState().sections;
    useSpecStore.getState().setSections({ ...spec, ...Object.fromEntries(sections.map((id) => [id, ''])) });
  }
  const pid = useProjectsStore.getState().activeId ?? 'default';
  useQuestionStore.setState((s) => ({ byProject: { ...s.byProject, [pid]: (s.byProject[pid] ?? []).filter((q) => q.source === 'spec') } }));
  // Generation records of the cleared stages; pending choices made on the example's outputs.
  const keep = keepIo ? ['io'] : [];
  useStageStore.setState((s) => ({ sources: Object.fromEntries(Object.entries(s.sources).filter(([k]) => keep.includes(k))) }));
  useDraftStore.setState((s) => ({ drafts: Object.fromEntries(Object.entries(s.drafts).filter(([k]) => k.startsWith('spec.'))) }));
  // Values typed over the example's outputs (prices, labels, notes); I/O description edits stay with the kept I/O.
  useEditsStore.setState((s) => ({ bom: {}, labels: {}, notes: {}, texts: Object.fromEntries(Object.entries(s.texts).filter(([k]) => keepIo && k.startsWith('io:'))) }));
}
