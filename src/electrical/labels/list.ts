import type { DrawingContext } from '../derive';
import { buildLabels, type Label } from '../labels';

/** A label with a stable id for selection and copy edits. */
export interface ListedLabel extends Label { id: string }

/** Every label of the design with ids that stay the same while the design does. */
export function listLabels(ctx: DrawingContext): ListedLabel[] {
  const seen = new Map<string, number>();
  return buildLabels(ctx).map((l) => {
    const base = `${l.kind}|${l.group}|${l.code}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...l, id: `${base}|${n}` };
  });
}
