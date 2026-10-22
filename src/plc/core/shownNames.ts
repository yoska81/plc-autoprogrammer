/**
 * How an operand is shown to the user on the project's PLC (Explain, Reorganize, Add comments, the documents):
 * the app's operand, or on Yaskawa its MPE720 register (DS2 → MW00011, X001 → IB00000). And the comments that
 * quote them follow when the operands move (a PLC change, a remake): the same old → new names, whole tokens only.
 */
import type { LadderProgram } from './ladder';
import type { ExportContext } from './profile';
import { plcNameLookup } from './plcNames';
import { getProfile } from './profiles';
import { layoutFor, yaskawaName } from './profiles/yaskawa';

const NUM = /^-?\d+(\.\d+)?$/;

/** The shown name of each operand on a PLC (identity everywhere but Yaskawa). */
export function shownNamer(profileId: string, program: LadderProgram, ctx: ExportContext): (a: string) => string {
  if (profileId !== 'yaskawa-mp') return (a) => a;
  const lookup = plcNameLookup(getProfile(profileId), program, ctx);
  const at = { cpuId: ctx.cpuId, modules: ctx.modules, tags: program.tags, layout: layoutFor(program, ctx.yaskawaMemory) };
  // A bit a change is about to add (Split's new internal bits) is not in the program yet: its register from the layout.
  return (a) => (NUM.test(a.trim()) ? a : lookup?.(a)?.name ?? yaskawaName(a, at) ?? a);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Rung comments, block descriptions and tag comments with each old name replaced by its new one (whole tokens,
 * all at once, so "X001 → X002, X002 → X003" never chains); the rest of the text as written.
 */
export function renameInComments(program: LadderProgram, names: Map<string, string>): LadderProgram {
  const pairs = [...names].filter(([a, b]) => a && b && a !== b);
  if (!pairs.length) return program;
  const to = new Map(pairs.map(([a, b]) => [a.toUpperCase(), b]));
  const re = new RegExp(`(?<![A-Za-z0-9_#.])(${pairs.map(([a]) => a).sort((x, y) => y.length - x.length).map(esc).join('|')})(?![A-Za-z0-9_])`, 'gi');
  const fix = (t: string) => (t ? t.replace(re, (m) => to.get(m.toUpperCase()) ?? m) : t);
  let changed = false;
  const keep = <T>(before: T, after: T): T => { if (after !== before) changed = true; return after; };
  const rungs = program.rungs.map((r) => { const c = keep(r.comment, fix(r.comment)); return c === r.comment ? r : { ...r, comment: c }; });
  const tags = program.tags.map((t) => { const c = keep(t.comment, fix(t.comment)); return c === t.comment ? t : { ...t, comment: c }; });
  const blocks = program.blocks?.map((b) => { const d = keep(b.description, fix(b.description)); return d === b.description ? b : { ...b, description: d }; });
  return changed ? { ...program, rungs, tags, ...(blocks ? { blocks } : {}) } : program;
}
