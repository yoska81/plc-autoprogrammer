/**
 * Download of an upgraded program, without silent loss:
 * - same PLC and the original .L5X kept: the changes are written INTO that file (l5xPatch.ts), so
 *   everything the app did not change stays as it was;
 * - otherwise the app's own export for the chosen PLC, with the list of what the files will not have
 *   (`missing`); the page asks the user to confirm it before downloading.
 */
import type { LadderProgram } from '../core/ladder';
import type { ExportContext } from '../core/profile';
import type { IOPoint } from '../../types/io';
import { patchL5x } from './l5xPatch';
import type { UpgradeOriginal } from './upgrade';

export interface UpgradeExport {
  mode: 'patch' | 'full';
  files: { name: string; content: string }[];
  /** What the files will not have, in plain words (confirmed by the user before downloading). */
  missing: string[];
  /** Patch: routines rewritten / added and controller tags added. */
  changed: string[];
  added: string[];
  newTags: string[];
  warnings: string[];
}

export function exportUpgrade(
  o: UpgradeOriginal,
  originalFile: string | null,
  current: LadderProgram,
  target: { plcId: string; fullFiles: () => { name: string; content: string }[]; ctx: ExportContext },
): UpgradeExport {
  const r = o.report;
  if (target.plcId === o.plcId && o.source.format === 'l5x' && originalFile) {
    const p = patchL5x({ originalXml: originalFile, original: o.program, current, names: o.names, blockOrigin: o.blockOrigin, ctx: target.ctx });
    const changedNames = new Set(p.changed.map((c) => c.split(' / ').pop()!.toLowerCase()));
    // Only what could not be brought in from a routine that is now rewritten is lost.
    const missing = r.notConverted
      .filter((n) => !n.kept && (changedNames.has(n.where.toLowerCase()) || changedNames.has(n.where.split(' / ').pop()!.toLowerCase())))
      .map((n) => `${n.where}: ${n.text}`);
    const name = o.source.fileName.replace(/(\.[^.]+)?$/, (ext) => `_upgraded${ext || '.L5X'}`);
    return { mode: 'patch', files: [{ name, content: p.xml }], missing, changed: p.changed, added: p.added, newTags: p.newTags, warnings: p.warnings };
  }

  const vendor = target.plcId;
  const missing = [
    ...r.notConverted.filter((n) => !n.kept).map((n) => `${n.where}: ${n.text}`),
    ...r.notConverted.filter((n) => n.kept && !sameVendor(vendor, current, n.text)).map((n) => `${n.where}: ${n.text} — written as a TODO comment, not run`),
    ...r.outside.map((x) => `${x} — not in the app's program`),
  ];
  if (o.source.format === 'l5x' || o.source.format === 'l5k') {
    missing.push(vendor === 'logix'
      ? "The original project's module configuration, tasks and controller settings: this is a new project file (keep the original .L5X with the project to write the changes into it instead)"
      : "The original project's module configuration, tasks and controller settings");
    if (vendor === 'logix') {
      const undeclared = current.rungs.flatMap((g) => [...g.branches.flat(), ...g.outputs]).filter((x) => x.type === 'RAW' && x.vendor === 'logix' && !x.decl?.length && !/^JSR\(/i.test(x.text) && /\b[A-Za-z_]\w*\b(?!\s*\()/.test(x.text.replace(/^\w+\(/, '')));
      if (undeclared.length) missing.push(`Definitions of the tags these kept instructions name (the original was an L5K or they were not in the file): ${undeclared.map((x) => (x.type === 'RAW' ? x.text : '')).join(', ')}`);
    }
  }
  return { mode: 'full', files: target.fullFiles(), missing, changed: [], added: [], newTags: [], warnings: [] };
}

/** Is this kept instruction (by its text) in the program for the target PLC's own vendor? */
function sameVendor(vendor: string, current: LadderProgram, text: string): boolean {
  const t = text.replace(/^Rung \d+: /, '');
  return current.rungs.some((r) => [...r.branches.flat(), ...r.outputs].some((x) => x.type === 'RAW' && x.text === t && x.vendor === vendor));
}

export interface UpgradeChanges {
  io: { added: string[]; removed: string[]; renamed: { from: string; to: string }[] };
  tags: { added: string[]; removed: string[]; renamed: { from: string; to: string }[] };
  blocksAdded: string[];
}

/** "Original vs now" beyond the rungs: I/O points, tag names and program parts. */
export function upgradeChanges(o: UpgradeOriginal, io: IOPoint[], current: LadderProgram): UpgradeChanges {
  // Imported points were numbered I001… / Q001… in their order.
  let i = 0, q = 0;
  const origById = new Map(o.ioList.map((p) => [p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++q).padStart(3, '0')}`, p]));
  const nowById = new Map(io.map((p) => [p.id, p]));
  const label = (p: { description: string; type: string }, id: string) => `${id} ${p.description || '(no description)'}`;
  const ioCh: UpgradeChanges['io'] = { added: [], removed: [], renamed: [] };
  for (const [id, p] of origById) {
    const now = nowById.get(id);
    if (!now || now.type !== p.type) ioCh.removed.push(label(p, id));
    else if (now.description.trim() !== p.description.trim()) ioCh.renamed.push({ from: label(p, id), to: label(now, id) });
  }
  for (const p of io) if (!origById.has(p.id) || origById.get(p.id)!.type !== p.type) ioCh.added.push(label(p, p.id));

  const before = new Map(o.program.tags.map((t) => [t.address.toUpperCase(), t.nickname]));
  const after = new Map(current.tags.map((t) => [t.address.toUpperCase(), t.nickname]));
  const tags: UpgradeChanges['tags'] = { added: [], removed: [], renamed: [] };
  for (const [a, n] of before) {
    const now = after.get(a);
    if (now === undefined) tags.removed.push(`${n} (${a})`);
    else if (now !== n) tags.renamed.push({ from: `${n} (${a})`, to: `${now} (${a})` });
  }
  for (const [a, n] of after) if (!before.has(a)) tags.added.push(`${n} (${a})`);

  const origBlocks = new Set((o.program.blocks ?? []).map((b) => b.id));
  const blocksAdded = (current.blocks ?? []).filter((b) => !origBlocks.has(b.id) && current.rungs.some((r) => r.block === b.id)).map((b) => b.name);
  return { io: ioCh, tags, blocksAdded };
}
