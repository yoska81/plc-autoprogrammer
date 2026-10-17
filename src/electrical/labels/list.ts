import type { DrawingContext } from '../derive';
import { buildLabels, type Label } from '../labels';
import { currentEdits, type LabelEdit } from '../../edits/useEditsStore';

/** A label with a stable id for selection and copy edits. */
export interface ListedLabel extends Label {
  id: string;
  /** Texts the user typed over, with the generated values to go back to. */
  edited?: LabelEdit;
}

/**
 * Every label of the design with ids that stay the same while the design does, with the user's
 * own texts (default: the open project's) in place of the generated ones.
 */
export function listLabels(ctx: DrawingContext, edits: Record<string, LabelEdit> = currentEdits().labels): ListedLabel[] {
  const seen = new Map<string, number>();
  return buildLabels(ctx).map((l) => {
    const base = `${l.kind}|${l.group}|${l.code}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const id = `${base}|${n}`;
    const e = edits[id];
    if (!e) return { ...l, id };
    const edited: LabelEdit = {
      ...(e.code !== undefined && e.code !== l.code ? { code: l.code } : {}),
      ...(e.description !== undefined && e.description !== l.description ? { description: l.description } : {}),
    };
    return { ...l, id, code: e.code ?? l.code, description: e.description ?? l.description, ...(Object.keys(edited).length ? { edited } : {}) };
  });
}
