/**
 * What changed in the program during this session, for the Change report: each Reorganize, AI simplify and Add
 * comments once its proposal is approved, each move to another PLC when it happens. Kept for the browser tab's
 * session (a reload keeps it, a new session starts empty), per project; the History tab keeps the programs themselves.
 */
import { create } from 'zustand';
import type { ProjectSnapshot } from '../../deliverables/collect';
import { programInfo } from '../../deliverables/docs/program';
import { rungWrites, type LadderProgram, type Rung } from '../core/ladder';
import { getProfile } from '../core/profiles';
import { remakeCoverage, type RemakeCoverage } from '../import/remake';
import { useHmiStore } from '../../store/useHmiStore';
import { useIOStore } from '../../store/useIOStore';
import { useProgramStore } from '../../store/useProgramStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { equivalenceSummary, type EquivalenceResult } from './equivalence';
import { keptBackReasons, removalPreview, REMOVAL_REASON, type ReorgPlan, type SectionId } from './reorganize';
import type { RewriteResult } from './rewrite';

/** The behaviour check behind a change: its one-line summary, or why there was none. */
export interface CheckLine { passed: boolean | null; text: string }

export type ChangeEntry = { at: string; projectId: string | null } & (
  | { kind: 'convert'; from: string; to: string; cpu: string; coverage: RemakeCoverage | null; notes: string[] }
  | {
    kind: 'reorganize'; rungsBefore: number; rungsAfter: number;
    removed: { section: string; rung: number; what: string; reason: string }[];
    keptBack: { rung: number; what: string; why: string }[];
    changed: { section: string; items: string[] }[];
    check: CheckLine;
  }
  | { kind: 'simplify'; kept: { name: string; rungsBefore: number; rungsAfter: number; partsBefore: number; partsAfter: number; check: string }[]; dropped: { name: string; why: string }[]; check: CheckLine }
  | { kind: 'comments'; perBlock: { block: string; count: number }[]; total: number; byAi: number }
);

/** An entry without its time and project (added when it is recorded). */
type NewEntry = ChangeEntry extends infer E ? E extends ChangeEntry ? Omit<E, 'at' | 'projectId'> : never : never;

interface ChangeLogStore {
  entries: ChangeEntry[];
  /** A change waiting for its proposal's approval, and whether to make the report then. */
  pending: { entry: NewEntry; proposal: object; report: boolean } | null;
}

const KEY = 'plc-change-log';
/** The entries kept for the tab's session (none in Node, or when the browser refuses: then in memory only). */
function loadEntries(): ChangeEntry[] {
  try { return JSON.parse(globalThis.sessionStorage?.getItem(KEY) ?? '[]') as ChangeEntry[]; } catch { return []; }
}

export const useChangeLog = create<ChangeLogStore>()(() => ({ entries: loadEntries(), pending: null }));
// Not the project's data (that is appStorage's): only this session's list, so the tab's sessionStorage.
useChangeLog.subscribe((s, prev) => {
  if (s.entries === prev.entries) return;
  try { globalThis.sessionStorage?.setItem(KEY, JSON.stringify(s.entries)); } catch { /* kept in memory */ }
});

const activeProject = () => useProjectsStore.getState().activeId ?? null;
const stamp = (e: NewEntry): ChangeEntry => ({ ...e, at: new Date().toISOString(), projectId: activeProject() } as ChangeEntry);

/** The entries of the open project. */
export const projectChanges = (entries = useChangeLog.getState().entries) => entries.filter((e) => e.projectId === activeProject());

/** A change applied right away (a move to another PLC). */
export function recordChange(e: NewEntry, report = false) {
  useChangeLog.setState((s) => ({ entries: [...s.entries, stamp(e)] }));
  // "Also make a change report" ticked: the report of the session so far, this change included.
  if (report) void import('./changeReportDownload').then((m) => m.downloadChangeReport());
}

/** A change offered as a proposal: recorded when the proposal now waiting is approved, dropped when it is rejected. */
export function stageChange(e: NewEntry, report = false) {
  const proposal = useProgramStore.getState().proposal;
  if (!proposal) return;
  useChangeLog.setState({ pending: { entry: e, proposal, report } });
}

// Approve replaces the program; Reject leaves it.
useProgramStore.subscribe((s, prev) => {
  const pending = useChangeLog.getState().pending;
  if (!pending || !prev.proposal || s.proposal || prev.proposal !== pending.proposal) return;
  useChangeLog.setState({ pending: null });
  if (s.ladder !== prev.ladder) recordChange(pending.entry, pending.report);
});

const checkLine = (r: EquivalenceResult | null): CheckLine => (r
  ? { passed: r.differences.length === 0, text: equivalenceSummary(r) }
  : { passed: null, text: 'Equivalence check not run.' });

// ── Entries for each kind of change ──

/** A Reorganize: what each chosen section removed (with its reason), what it kept back (and why), what it changed. */
export function reorganizeEntry(p: ProjectSnapshot, plan: ReorgPlan, chosen: Set<SectionId>, after: LadderProgram, check: EquivalenceResult | null): NewEntry {
  const info = programInfo(p);
  const l = p.ladder;
  const byId = new Map(l.rungs.map((r) => [r.id, r] as const));
  const what = (r: Rung) => rungWrites(r).map((a) => info.ref(a)).join(', ') || r.comment.trim() || 'no outputs';
  const preview = removalPreview(l, plan, chosen);
  const title = new Map(plan.sections.map((x) => [x.id, x.title] as const));
  const removed: { section: string; rung: number; what: string; reason: string }[] = [];
  for (const id of ['remove-internal', 'remove-registers', 'remove-never', 'remove-uncalled', 'remove-jumped'] as SectionId[]) {
    if (!chosen.has(id)) continue;
    for (const rid of plan.removals[id] ?? []) {
      const r = byId.get(rid);
      if (r && preview.drop.has(rid)) removed.push({ section: title.get(id) ?? id, rung: info.rungNo(r), what: what(r), reason: REMOVAL_REASON[id] ?? '' });
    }
  }
  if (chosen.has('remove-tags')) for (const a of plan.unusedTags) removed.push({ section: title.get('remove-tags') ?? 'Unused names', rung: 0, what: info.ref(a), reason: 'no rung reads or writes it' });
  const readers = keptBackReasons(l, plan, chosen);
  const keptBack = [...preview.keptBack].flatMap((rid) => {
    const r = byId.get(rid);
    const reader = byId.get(readers.get(rid) ?? '');
    return r ? [{ rung: info.rungNo(r), what: what(r), why: reader ? `rung ${info.rungNo(reader)}, which stays, still uses what it sets` : 'a rung that stays still uses what it sets' }] : [];
  });
  const changed = plan.sections
    .filter((x) => chosen.has(x.id) && !x.id.startsWith('remove-'))
    .map((x) => ({ section: x.title, items: x.id === 'reorder' ? [] : x.items }));
  return { kind: 'reorganize', rungsBefore: l.rungs.length, rungsAfter: after.rungs.length, removed, keptBack, changed, check: checkLine(check) };
}

/** An AI simplify: the blocks kept (sizes before and after, their check) and the ones dropped with the reason. */
export function simplifyEntry(r: RewriteResult): NewEntry {
  return {
    kind: 'simplify',
    kept: r.kept.map((k) => ({ name: k.name, rungsBefore: k.rungsBefore, rungsAfter: k.rungsAfter, partsBefore: k.before, partsAfter: k.after, check: k.summary })),
    dropped: r.dropped.map((d) => ({ name: d.name, why: d.why })),
    check: r.kept.length ? { passed: true, text: r.final ? equivalenceSummary(r.final) : r.kept[0].summary } : { passed: null, text: 'Nothing kept, so nothing to check.' },
  };
}

/** Add comments: how many rung comments each block got (block descriptions and tag comments in the total). */
export function commentsEntry(before: LadderProgram, after: LadderProgram, total: number, byAi: number): NewEntry {
  const names = new Map((after.blocks ?? []).map((b) => [b.id, b.name] as const));
  const prev = new Map(before.rungs.map((r) => [r.id, r.comment] as const));
  const per = new Map<string, number>();
  for (const r of after.rungs) if ((prev.get(r.id) ?? '') !== r.comment) { const b = names.get(r.block ?? '') ?? 'General'; per.set(b, (per.get(b) ?? 0) + 1); }
  return { kind: 'comments', perBlock: [...per].map(([block, count]) => ({ block, count })), total, byAi };
}

/** A move to another PLC, worked out before it happens (how much converts, what is kept, the servo axes). */
export function conversionEntry(plcId: string): NewEntry | null {
  const pr = useProjectStore.getState();
  if (pr.plcId === plcId) return null;
  const from = getProfile(pr.plcId), to = getProfile(plcId);
  const program = useProgramStore.getState().ladder;
  const coverage = program.rungs.length
    ? remakeCoverage({ io: useIOStore.getState().projectIO, plcId: pr.plcId, cpuId: pr.cpuId, modules: pr.modules, program, hmi: useHmiStore.getState().design }, plcId)
    : null;
  return { kind: 'convert', from: `${from.vendor} ${from.name} (${pr.cpuId})`, to: `${to.vendor} ${to.name}`, cpu: coverage?.cpuId ?? '', coverage, notes: [] };
}

/** Record a move to another PLC: `move` does it and returns its notes. */
export function recordConversion<T extends string[]>(plcId: string, move: () => T, report = false): T {
  const e = conversionEntry(plcId);
  const notes = move();
  if (e && e.kind === 'convert') recordChange({ ...e, cpu: useProjectStore.getState().cpuId, notes }, report);
  return notes;
}
