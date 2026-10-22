/**
 * The Change report: what happened to an uploaded program in this session, in plain words, as a PDF and a Word
 * .docx. Converted (moved to another PLC: how much converts, what was kept to redo by hand, the servo axes to set
 * up), Deleted (each part Reorganize took out and why, and what it kept back), Changed (merges, simpler conditions,
 * self-holding rungs, splits, names, order, the AI's simpler blocks, comments). Each change says whether the
 * behaviour check passed or was not run.
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import type { ChangeEntry } from './changeLog';
import { docxFrom, type DocPart } from './explainExport';

export interface ChangeReport {
  title: string;
  header: [string, string][];
  /** One line per change: the behaviour check passed, found differences, or was not run. */
  checks: string[];
  sections: { title: string; parts: DocPart[] }[];
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const n = (k: number, one: string, many = `${one}s`) => `${k.toLocaleString('en-US')} ${k === 1 ? one : many}`;

/** A kept instruction in plain words ("1 call to another drawing"). */
function kept(what: string, k: number): string {
  const w = what.toUpperCase();
  const [one, many] = w === 'SEE' ? ['call to another drawing', 'calls to other drawings']
    : w === 'UNKNOWN INSTRUCTION' ? ["instruction the app can't read", "instructions the app can't read"]
      : w === 'SERVO REGISTER' ? ['rung that moves a servo axis', 'rungs that move a servo axis']
        : w === 'JSR' || w === 'CALL' ? ['subroutine call', 'subroutine calls']
          : [`${what} instruction`, `${what} instructions`];
  return `${k} ${k === 1 ? one : many}`;
}

const label = (e: ChangeEntry) => ({ convert: 'Move to another PLC', reorganize: 'Reorganize', simplify: 'Simplify blocks with AI', comments: 'Add comments' })[e.kind];

/** The report from this session's changes (oldest first). `source`: where the program came from ("capper.L5X, Allen-Bradley 1769-L33ER"). */
export function buildChangeReport(p: ProjectSnapshot, entries: ChangeEntry[], source?: string): ChangeReport {
  const converted: DocPart[] = [], deleted: DocPart[] = [], changed: DocPart[] = [];
  let removedTotal = 0, keptTotal = 0, changedTotal = 0, commentTotal = 0;
  for (const e of entries) {
    const when = time(e.at);
    if (e.kind === 'convert') {
      converted.push({ h2: `${e.from} → ${e.to}${e.cpu ? ` (${e.cpu})` : ''} at ${when}` });
      const c = e.coverage;
      if (c) {
        converted.push({ p: `${c.converted} of ${c.rungs} rungs convert (${c.percent}%).` });
        if (c.kept.length) { converted.push({ p: 'Kept as they were, to redo by hand:' }); for (const k of c.kept) converted.push({ li: kept(k.what, k.count) }); }
        if (c.errors.length) { converted.push({ p: `${n(c.errors.length, 'rung')} the ${e.to} checker rejects:` }); for (const x of c.errors) converted.push({ li: x.message }); }
        if (c.motion?.length) { converted.push({ p: 'Servo axes to set up by hand on the new PLC:' }); for (const m of c.motion) converted.push({ li: `circuit ${m.circuit}, axis ${m.axis} (${n(m.rungs, 'rung')} move it)` }); }
      } else converted.push({ p: 'There was no program to convert.' });
      if (e.notes.length) { converted.push({ p: 'What the move did:' }); for (const x of e.notes) converted.push({ li: x }); }
    } else if (e.kind === 'reorganize') {
      if (e.removed.length || e.keptBack.length) deleted.push({ h2: `Reorganize at ${when}` });
      const bySection = new Map<string, typeof e.removed>();
      for (const r of e.removed) bySection.set(r.section, [...(bySection.get(r.section) ?? []), r]);
      for (const [section, rs] of bySection) {
        deleted.push({ p: `${section}:` });
        for (const r of rs) deleted.push({ li: `${r.rung ? `Rung ${r.rung}: ` : ''}${r.what} — ${r.reason}` });
      }
      if (e.keptBack.length) { deleted.push({ p: 'Kept, although offered for removal:' }); for (const k of e.keptBack) deleted.push({ li: `Rung ${k.rung}: ${k.what} — ${k.why}` }); }
      removedTotal += e.removed.length; keptTotal += e.keptBack.length;
      if (e.changed.length) {
        changed.push({ h2: `Reorganize at ${when} (${e.rungsBefore.toLocaleString('en-US')} rungs → ${e.rungsAfter.toLocaleString('en-US')})` });
        for (const c of e.changed) { changed.push({ p: c.section }); for (const i of c.items) changed.push({ li: i }); changedTotal++; }
      }
    } else if (e.kind === 'simplify') {
      changed.push({ h2: `Simplify blocks with AI at ${when}` });
      for (const k of e.kept) { changed.push({ li: `${k.name}: ${k.rungsBefore} → ${k.rungsAfter} rungs (${k.partsBefore} → ${k.partsAfter} parts). ${k.check.split(' Details:')[0]}` }); changedTotal++; }
      if (e.dropped.length) { changed.push({ p: 'Not changed:' }); for (const d of e.dropped) changed.push({ li: `${d.name}: ${d.why}` }); }
    } else {
      changed.push({ h2: `Add comments at ${when}` });
      changed.push({ p: `${n(e.total, 'comment')} written${e.byAi ? ` (${e.byAi} by the AI, the rest from the program's names)` : ' from the program\'s names'}.` });
      for (const b of e.perBlock) changed.push({ li: `${b.block}: ${n(b.count, 'rung comment')}` });
      commentTotal += e.total;
    }
  }
  const none = (what: string): DocPart[] => [{ p: `Nothing was ${what} in this session.` }];
  const checks = entries.map((e) => {
    const head = `${time(e.at)} ${label(e)}: `;
    if (e.kind === 'convert') return `${head}equivalence check not run (a move to another PLC is checked by that PLC's checker${e.coverage?.errors.length ? `: ${n(e.coverage.errors.length, 'rung')} rejected` : ': no rung rejected'}).`;
    if (e.kind === 'comments') return `${head}equivalence check not needed (only comments changed; the logic was compared and is the same).`;
    return `${head}equivalence check ${e.check.passed === true ? 'passed' : e.check.passed === false ? 'found differences' : 'not run'}${e.check.passed !== null ? ` — ${e.check.text.split(' Details:')[0]}` : ''}`;
  });
  const conversions = entries.filter((e) => e.kind === 'convert').length;
  return {
    title: `Change report: ${p.projectName || 'machine'}`,
    header: [
      ['Project', p.projectName || '—'],
      ['Program from', source || 'made in this app'],
      ['Now on', `${p.profile.vendor} ${p.profile.name} (${p.cpu.id})`],
      ['Date', new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })],
      ['Totals', `${n(conversions, 'conversion')}; ${n(removedTotal, 'part')} deleted${keptTotal ? ` (${keptTotal} kept back)` : ''}; ${n(changedTotal, 'change')}; ${n(commentTotal, 'comment')} added; ${p.ladder.rungs.length.toLocaleString('en-US')} rungs now`],
    ],
    checks: checks.length ? checks : ['No change in this session.'],
    sections: [
      { title: 'Converted', parts: converted.length ? converted : none('converted') },
      { title: 'Deleted', parts: deleted.length ? deleted : none('deleted') },
      { title: 'Changed', parts: changed.length ? changed : none('changed') },
    ],
  };
}

/** The report as a PDF (the deliverables' small document: title block, running header, page numbers). */
export async function changeReportPdf(p: ProjectSnapshot, r: ChangeReport): Promise<Blob> {
  const { simpleDoc } = await import('../../deliverables/programListingPdf');
  return simpleDoc(p, 'Change report', `${p.profile.vendor} ${p.profile.name} · what changed in the program, and how it was checked`, (w) => {
    w.keyValue(r.header, 32);
    w.h2('Behaviour check per change', false);
    w.bullets(r.checks, { size: 8.6 });
    for (const s of r.sections) {
      w.h2(s.title, false);
      let list: string[] = [];
      const flush = () => { if (list.length) w.bullets(list, { size: 8.6 }); list = []; };
      for (const x of s.parts) {
        if ('li' in x) { list.push(x.li); continue; }
        flush();
        if ('h2' in x) w.text(x.h2, { size: 9.5, bold: true, gap: 0.5 });
        else if ('p' in x) w.para(x.p);
      }
      flush();
    }
  });
}

/** The report as a Word .docx. */
export function changeReportDocx(r: ChangeReport): Promise<Blob> {
  return docxFrom([
    { title: r.title },
    ...r.header.map(([k, v]) => ({ p: `${k}: ${v}` })),
    { h1: 'Behaviour check per change' },
    ...r.checks.map((c) => ({ li: c })),
    ...r.sections.flatMap((s) => [{ h1: s.title } as DocPart, ...s.parts]),
  ]);
}
