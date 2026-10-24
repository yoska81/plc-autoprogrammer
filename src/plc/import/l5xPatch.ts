/**
 * Same-PLC upgrade of a Studio 5000 project: the changes are written INTO the original .L5X, so module
 * configuration, add-on instructions, data types, other programs and tasks, motion, produced / consumed
 * tags and every routine the user did not change stay exactly as they were (byte for byte).
 *
 * - A routine whose rungs changed gets new rung text (RLLContent); everything else in the file is copied.
 *   A Structured Text routine that changed becomes a ladder routine (said in the warnings).
 * - Tag names in the new rungs are the original names (Spin_Tmr, Local:1:I.Data.7, Capper.Running).
 * - Tags the new rungs need that the project doesn't have are added to the controller tags.
 * - Blocks the app added become new routines of the main program, called from its main routine.
 */
import type { LadderProgram, Rung } from '../core/ladder';
import type { ExportContext } from '../core/profile';
import { logixIoTag } from '../core/profiles/logix';
import { logixName, toLogix, type LogixRung, type LogixTag } from '../core/profiles/logixExport';
import { cdata, esc, tagXml } from '../core/profiles/l5x';

export interface L5xPatchInput {
  originalXml: string;
  /** The program as imported (on the app's addresses) and as it is now. */
  original: LadderProgram;
  current: LadderProgram;
  /** App address → original tag name ("Program.Tag" for program tags whose names clash). */
  names: Record<string, string>;
  /** Block id → its routine in the original file. */
  blockOrigin: Record<string, { program: string; routine: string }>;
  /** App rung id → number of the original rung it came from. */
  rungOrigin: Record<string, string>;
  ctx: ExportContext;
}

export interface L5xPatchResult {
  xml: string;
  /** "Program / Routine" of each routine rewritten or added. */
  changed: string[];
  added: string[];
  newTags: string[];
  warnings: string[];
}

const sig = (rs: Rung[]) => JSON.stringify(rs.map((r) => ({ c: r.comment, b: r.branches, o: r.outputs })));
const logicSig = (r: Rung) => JSON.stringify({ b: r.branches, o: r.outputs });
/** An original <Rung> element with its comment replaced (or added, or removed). */
function withComment(rungXml: string, comment: string): string {
  const c = comment.trim() ? `<Comment>\n${cdata(comment)}\n</Comment>` : '';
  if (/<Comment>[\s\S]*?<\/Comment>\s*/.test(rungXml)) return rungXml.replace(/<Comment>[\s\S]*?<\/Comment>(\s*)/, c ? `${c}$1` : '');
  return c ? rungXml.replace(/(<Rung\s[^>]*>\s*)/, `$1${c}\n`) : rungXml;
}
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** [start, end) of the first element `<tag … Name="name" …>…</tag>` at or after `from` (and before `to`). */
function element(xml: string, tag: string, name: string, from = 0, to = xml.length): [number, number] | null {
  const open = new RegExp(`<${tag}\\s[^>]*\\bName="${reEsc(esc(name))}"[^>]*?(/?)>`, 'g');
  open.lastIndex = from;
  const m = open.exec(xml);
  if (!m || m.index >= to) return null;
  if (m[1] === '/') return [m.index, m.index + m[0].length];
  const close = xml.indexOf(`</${tag}>`, m.index);
  return close < 0 || close > to ? null : [m.index, close + tag.length + 3];
}

function rungsXml(rungs: LogixRung[], startNumber = 0): string {
  return rungs.map((g, i) => [
    `<Rung Number="${startNumber + i}" Type="N">`,
    ...(g.comment ? [`<Comment>\n${cdata(g.comment)}\n</Comment>`] : []),
    `<Text>\n${cdata(g.text)}\n</Text>`,
    '</Rung>',
  ].join('\n')).join('\n');
}

export function patchL5x(p: L5xPatchInput): L5xPatchResult {
  const warnings: string[] = [];
  const blocks = p.current.blocks ?? [];
  const byBlock = (prog: LadderProgram, id: string) => prog.rungs.filter((r) => (r.block ?? '') === id);

  // Routines whose rungs changed (blocks of the original), and blocks the app added.
  const changedIds = new Set<string>();
  const ids = new Set([...(p.original.blocks ?? []).map((b) => b.id), ...blocks.map((b) => b.id), ...p.current.rungs.map((r) => r.block ?? '')]);
  for (const id of ids) if (sig(byBlock(p.original, id)) !== sig(byBlock(p.current, id))) changedIds.add(id);

  // New rung text, one rung at a time, with the original tag names; tags with no original are new.
  const existing = new Set([...p.originalXml.matchAll(/<Tag\s[^>]*\bName="([^"]+)"/g)].map((m) => m[1].toLowerCase()));
  const newByBase = new Map<string, LogixTag>();
  const needed = new Set<LogixTag>();
  let call = 0;
  const generate = (rung: Rung, program: string): LogixRung[] => {
    const lx = toLogix({ rungs: [{ ...rung, block: undefined }], tags: p.current.tags }, p.ctx, logixIoTag);
    for (const w of lx.warnings) if (!/without a description/.test(w) && !warnings.includes(w)) warnings.push(w);
    call++;
    const rename = new Map<string, string>();
    for (const t of lx.tags) {
      const orig = t.base ? p.names[t.base] : undefined;
      if (orig) { rename.set(t.name, orig.startsWith(`${program}.`) ? orig.slice(program.length + 1) : orig); continue; }
      // One-shot storage bits belong to their rung; other new tags (a new timer…) are shared by address.
      const key = /^ONS_/.test(t.base ?? '') ? `${call}:${t.base}` : t.base ?? t.name;
      let tag = newByBase.get(key);
      if (!tag) {
        let name = t.name;
        for (let i = 2; existing.has(name.toLowerCase()); i++) name = `${t.name}_${i}`;
        existing.add(name.toLowerCase());
        tag = { ...t, name, aliasFor: undefined };
        newByBase.set(key, tag);
      }
      rename.set(t.name, tag.name);
    }
    const routine = lx.routines.find((r) => r.name !== 'MainRoutine');
    return (routine?.rungs ?? []).map((g) => ({
      comment: g.comment,
      text: g.text.replace(/(?<![\w.:\]])([A-Za-z_]\w*)(?![\w(])/g, (n) => {
        const to = rename.get(n);
        if (to === undefined) return n;
        const t = [...newByBase.values()].find((x) => x.name === to);
        if (t) needed.add(t);
        return to;
      }),
    }));
  };

  let xml = p.originalXml;
  const changed: string[] = [];
  const added: string[] = [];
  const programs = [...xml.matchAll(/<Program\s[^>]*\bName="([^"]+)"[^>]*\bMainRoutineName="([^"]*)"/g)].map((m) => ({ name: m[1], main: m[2] }));
  const mainProgram = programs[0];

  for (const id of changedIds) {
    const origin = p.blockOrigin[id];
    if (!origin) continue;
    const prog = element(xml, 'Program', origin.program);
    const rout = prog && element(xml, 'Routine', origin.routine, prog[0], prog[1]);
    if (!prog || !rout) { warnings.push(`Routine ${origin.program} / ${origin.routine} was not found in the original file; its changes are not in it.`); continue; }
    const old = xml.slice(rout[0], rout[1]);
    // The original rungs, by number: an original rung whose app rungs are all unchanged is copied as it was.
    const origRungs = new Map<string, string>();
    for (const m of old.matchAll(/<Rung\s[^>]*\bNumber="(\d+)"[^>]*>[\s\S]*?<\/Rung>/g)) origRungs.set(m[1], m[0]);
    const origApp = new Map<string, Rung[]>();
    for (const r of byBlock(p.original, id)) { const n = p.rungOrigin[r.id]; if (n !== undefined) origApp.set(n, [...(origApp.get(n) ?? []), r]); }
    const now = byBlock(p.current, id);
    const parts: string[] = [];
    for (let k = 0; k < now.length;) {
      const n = p.rungOrigin[now[k].id] ?? null;
      const orig = n !== null ? origApp.get(n) : undefined;
      const group = orig ? now.slice(k, k + orig.length) : [];
      if (orig && origRungs.has(n!) && group.length === orig.length && sig(group) === sig(orig)) {
        parts.push(origRungs.get(n!)!.replace(/\bNumber="\d+"/, `Number="${parts.length}"`));
        k += orig.length;
        continue;
      }
      // Only the comment changed: the original rung with the new comment.
      if (orig && origRungs.has(n!) && orig.length === 1 && logicSig(now[k]) === logicSig(orig[0])) {
        parts.push(withComment(origRungs.get(n!)!, now[k].comment).replace(/\bNumber="\d+"/, `Number="${parts.length}"`));
        k++;
        continue;
      }
      for (const g of generate(now[k], origin.program)) parts.push(rungsXml([g], parts.length));
      k++;
    }
    const content = `<RLLContent>\n${parts.join('\n')}\n</RLLContent>`;
    const openEnd = old.indexOf('>') + 1;
    let open = old.slice(0, openEnd);
    const wasType = /\bType="([^"]*)"/.exec(open)?.[1] ?? '';
    if (wasType !== 'RLL') {
      warnings.push(`${origin.program} / ${origin.routine} was ${wasType === 'ST' ? 'Structured Text' : wasType}; it is written back as ladder.`);
      open = open.replace(/\bType="[^"]*"/, 'Type="RLL"');
    }
    if (open.endsWith('/>')) open = `${open.slice(0, -2)}>`;
    const body = old.endsWith('/>') ? '' : old.slice(openEnd, old.length - '</Routine>'.length);
    const desc = /<Description>[\s\S]*?<\/Description>/.exec(body)?.[0];
    xml = xml.slice(0, rout[0]) + `${open}\n${desc ? `${desc}\n` : ''}${content}\n</Routine>` + xml.slice(rout[1]);
    changed.push(`${origin.program} / ${origin.routine}`);
  }

  // Blocks the app added: new routines in the main program, called from its main routine.
  const newBlocks = [...changedIds].filter((id) => !p.blockOrigin[id] && byBlock(p.current, id).length);
  if (newBlocks.length && mainProgram) {
    const routineNames = new Set([...xml.matchAll(/<Routine\s[^>]*\bName="([^"]+)"/g)].map((m) => m[1].toLowerCase()));
    const calls: string[] = [];
    let routinesXml = '';
    for (const id of newBlocks) {
      const name = logixName(blocks.find((b) => b.id === id)?.name || 'App_Logic', routineNames, 'App_Logic');
      const rungs = byBlock(p.current, id).flatMap((r) => generate(r, mainProgram.name));
      routinesXml += `<Routine Name="${esc(name)}" Type="RLL">\n<RLLContent>\n${rungsXml(rungs)}\n</RLLContent>\n</Routine>\n`;
      calls.push(`JSR(${name},0)`);
      added.push(`${mainProgram.name} / ${name}`);
    }
    const prog = element(xml, 'Program', mainProgram.name)!;
    const routinesEnd = xml.lastIndexOf('</Routines>', prog[1]);
    xml = xml.slice(0, routinesEnd) + routinesXml + xml.slice(routinesEnd);
    const prog2 = element(xml, 'Program', mainProgram.name)!;
    const main = element(xml, 'Routine', mainProgram.main, prog2[0], prog2[1]);
    const end = main ? xml.lastIndexOf('</RLLContent>', main[1]) : -1;
    if (main && end > main[0]) {
      const count = (xml.slice(main[0], end).match(/<Rung\s/g) ?? []).length;
      xml = xml.slice(0, end) + rungsXml(calls.map((c) => ({ comment: 'Added by the upgrade', text: `${c};` })), count) + '\n' + xml.slice(end);
      changed.push(`${mainProgram.name} / ${mainProgram.main}`);
    } else warnings.push(`Call the new routine${calls.length > 1 ? 's' : ''} from your main routine: ${calls.join(', ')}.`);
  }

  // New controller tags (only those the new rungs use).
  const add = [...needed];
  if (add.length) {
    const programsAt = xml.indexOf('<Programs');
    const tagsXml = add.map((t) => tagXml({ ...t, description: t.description === t.base ? 'Added by the upgrade' : t.description }, '')).join('\n');
    const selfClosing = xml.lastIndexOf('<Tags/>', programsAt);
    const closeAt = xml.lastIndexOf('</Tags>', programsAt);
    const controllerAt = xml.indexOf('<Controller');
    if (closeAt > controllerAt && closeAt > selfClosing) xml = `${xml.slice(0, closeAt)}${tagsXml}\n${xml.slice(closeAt)}`;
    else if (selfClosing > controllerAt) xml = `${xml.slice(0, selfClosing)}<Tags>\n${tagsXml}\n</Tags>${xml.slice(selfClosing + '<Tags/>'.length)}`;
    else warnings.push(`Add these tags by hand: ${add.map((t) => `${t.name} (${t.dataType})`).join(', ')}.`);
  }
  // Keep the file's own line ends: a CRLF file stays CRLF (the copied parts already are; the new ones get it).
  if (p.originalXml.includes('\r\n') && !/(?<!\r)\n/.test(p.originalXml)) xml = xml.replace(/(?<!\r)\n/g, '\r\n');
  return { xml, changed, added, newTags: add.map((t) => t.name), warnings };
}
