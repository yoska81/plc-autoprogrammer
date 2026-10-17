import { useElectricalStore } from '../store/useElectricalStore';
import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { collectProject } from '../deliverables/collect';
import { getPart } from '../electrical/catalog';
import { applyEdits, changeLine, describeEdit, nextRev, parseChange, type ChangeContext, type DesignEdit, type Redline } from './fieldChange';
import { redlinesFor, useRedlineStore } from './useRedlineStore';

/** What the parser can refer to in the open project. */
export function changeContext(): ChangeContext {
  const el = useElectricalStore.getState();
  return { design: el.design, inputs: el.inputs, io: useIOStore.getState().projectIO, addresses: collectProject().addresses, hasPart: (pn) => Boolean(getPart(pn)) };
}

/** The design edits each open redline would make (for the preview before applying). */
export function previewEdits(list: Redline[], ctx: ChangeContext = changeContext()): Map<string, DesignEdit[]> {
  return new Map(list.filter((r) => r.status === 'open').map((r) => [r.id, parseChange(r.note, ctx)]));
}

/**
 * Apply the open redlines: make the design edits the app can make, bump the revision and write the
 * change list (every redline, applied or to be edited by hand) into the revision history.
 */
export function applyRedlines(opts: { by: string; description?: string; date?: string }): { rev: string; applied: number; manual: number } | null {
  const projectId = useProjectsStore.getState().activeId;
  const open = redlinesFor(projectId).filter((r) => r.status === 'open');
  if (!open.length) return null;
  const ctx = changeContext();
  let state = { design: ctx.design, inputs: ctx.inputs, io: ctx.io, addresses: ctx.addresses };
  const results = open.map((r) => {
    const edits = parseChange(r.note, { ...ctx, design: state.design, inputs: state.inputs, io: state.io });
    state = { ...state, ...applyEdits(edits, state) };
    return { r, done: edits.map(describeEdit) };
  });

  const el = useElectricalStore.getState();
  if (state.inputs !== el.inputs) el.setInputs(state.inputs);
  if (state.design && state.design !== el.design) el.setDesign(state.design, el.source ?? 'generated', el.explanation);
  const io = useIOStore.getState();
  for (const p of state.io) {
    const before = ctx.io.find((x) => x.id === p.id);
    if (before && before.description !== p.description) io.updateDescription(p.id, p.description);
  }

  const { info, setInfo } = useProjectStore.getState();
  const rev = nextRev(info.revisions);
  const applied = results.filter((x) => x.done.length).length;
  setInfo({
    revisions: [...info.revisions, {
      rev, date: opts.date ?? new Date().toISOString().slice(0, 10), by: opts.by,
      description: opts.description?.trim() || `Field changes (${open.length} redline${open.length === 1 ? '' : 's'})`,
      changes: results.map(({ r, done }) => changeLine(r, done)),
    }],
  });
  const store = useRedlineStore.getState();
  for (const { r, done } of results) store.update(projectId, r.id, { status: done.length ? 'applied' : 'manual', rev, done });
  return { rev, applied, manual: results.length - applied };
}
