/**
 * Rung comments the user rewrote. The new text is in the program itself; the hand-edit store keeps
 * it by rung id (with the generated comment), so a new generation or an approved AI change that
 * keeps the rung keeps the user's comment, and "back to generated" can restore the old one.
 */
import type { LadderProgram } from '../plc/core/ladder';
import { currentEdits, useEditsStore, type TextEdit } from './useEditsStore';

export const rungKey = (rungId: string) => `rung:${rungId}`;

/** Put the user's comments back into a program the generator or the AI made. */
export function keepRungComments(p: LadderProgram, texts: Record<string, TextEdit> = currentEdits().texts): LadderProgram {
  let changed = false;
  const rungs = p.rungs.map((r) => {
    const e = texts[rungKey(r.id)];
    if (!e || e.value === r.comment) return r;
    changed = true;
    return { ...r, comment: e.value };
  });
  return changed ? { ...p, rungs } : p;
}

/** Record a comment typed in the ladder editor (`before`: the comment it replaces). */
export function recordRungComment(rungId: string, value: string, before: string): void {
  const s = useEditsStore.getState();
  s.setText(rungKey(rungId), value, s.texts[rungKey(rungId)]?.generated ?? before);
}
