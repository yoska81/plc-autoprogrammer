/**
 * Same-PLC upgrade of a Siemens program read from an SCL external source or a TIA Portal PLCopen XML: the
 * changes are written INTO the original file, so every block the user did not change stays exactly as it
 * was (byte for byte), like the .L5X patch (l5xPatch.ts).
 *
 * - A block whose rungs changed gets new code (the statements between BEGIN and END_…, or the PLCopen
 *   <body>), written from the program with the original names: "PLC tags" for globals, #Name for the
 *   block's own variables. Its comments and layout are not kept (said in the warnings). An LD body that
 *   changed becomes Structured Text.
 * - Variables the new code needs that the block doesn't have are added to the block (function blocks), or
 *   listed as PLC tags to add (functions and OBs have no statics).
 * - Blocks the app added become new function blocks with an instance DB, called from the first OB of an SCL
 *   source (in a PLCopen file the call is to add by hand).
 */
import type { LadderProgram, Rung } from '../core/ladder';
import type { ExportContext } from '../core/profile';
import { toIecSt, type StVariable } from '../core/profiles/iecSt';
import { SCL_BLOCKS } from '../core/profiles/siemens';
import { logixName } from '../core/profiles/logixExport';
import { esc } from '../core/profiles/l5x';
import { stVariables } from './stSource';

export interface StPatchInput {
  originalText: string;
  /** The program as imported (on the app's addresses) and as it is now. */
  original: LadderProgram;
  current: LadderProgram;
  /** App address → original name. */
  names: Record<string, string>;
  /** Block id → its block in the original file (routine = the block's name). */
  blockOrigin: Record<string, { program: string; routine: string }>;
  ctx: ExportContext;
}

export interface StPatchResult {
  text: string;
  /** Blocks rewritten (and the OB that now calls an added block). */
  changed: string[];
  added: string[];
  /** Variables added to a block, or PLC tags to add by hand. */
  newTags: string[];
  warnings: string[];
}

const sig = (rs: Rung[]) => JSON.stringify(rs.map((r) => ({ c: r.comment, b: r.branches, o: r.outputs })));
// Variables are written as ⟦name⟧ first, then as the original names; ⟦⟧ is the first-scan bit.
const VAR_MARK = /⟦([^⟧]*)⟧/g;
const FIRST_SCAN = '⟦⟧';

interface Scope {
  /** The block's own variables (lower case): written #Name. */
  locals: Set<string>;
  /** Variables of the other blocks (lower case → block): not reachable from this one. */
  elsewhere: Map<string, string>;
  /** Every name in the file (lower case): new variables get a free name. */
  taken: Set<string>;
  /** New variables can be statics of the block (a function block). */
  statics: boolean;
}

/** SCL statements for the rungs of one block, with the original names; the variables it needs that are new. */
function blockCode(rungs: Rung[], p: StPatchInput, block: string, scope: Scope, warnings: string[]): { code: string; added: StVariable[] } {
  const st = toIecSt({ rungs: rungs.map((r) => ({ ...r, block: undefined })), tags: p.current.tags }, { ...p.ctx, extraTags: [] }, {
    vendor: 'siemens-s7', title: '', ioVar: () => null, ioTodo: () => '', rungsOnly: true,
    ref: (n) => `⟦${n}⟧`, firstScan: FIRST_SCAN, ...SCL_BLOCKS,
  });
  for (const w of st.warnings) if (!warnings.includes(w)) warnings.push(w);
  const added: StVariable[] = [];
  const refs = new Map<string, string>();
  const unreachable: string[] = [];
  for (const v of st.variables) {
    const orig = p.names[v.base];
    if (orig) {
      const [head, ...rest] = orig.split('.');
      const tail = rest.length ? `.${rest.join('.')}` : '';
      if (scope.locals.has(head.toLowerCase())) { refs.set(v.name, `#${orig}`); continue; }
      const other = scope.elsewhere.get(head.toLowerCase());
      if (other) unreachable.push(`${head} (a variable of ${other})`);
      refs.set(v.name, `"${head}"${tail}`);
      continue;
    }
    if (v.base === 'SC7') warnings.push(`${block}: the 1-second clock has no tag in the original program; use a clock memory bit (CPU properties › System and clock memory) for ${v.name}.`);
    let name = v.name;
    for (let i = 2; scope.taken.has(name.toLowerCase()); i++) name = `${v.name}_${i}`;
    scope.taken.add(name.toLowerCase());
    added.push({ ...v, name });
    refs.set(v.name, scope.statics ? `#${name}` : `"${name}"`);
  }
  if (unreachable.length) warnings.push(`${block} uses ${unreachable.join(', ')}: another block's variable is not reachable from here; it is written as a PLC tag. Connect it (a block parameter or a global DB).`);
  const firstScan = st.body.includes(FIRST_SCAN);
  const code = st.body.replace(VAR_MARK, (_, n: string) => (n ? refs.get(n) ?? `"${n}"` : '"FirstScan"'));
  if (firstScan) {
    warnings.push(`${block} uses the first-scan bit: add a PLC tag FirstScan that the startup OB (OB100) sets and the end of OB1 clears.`);
  }
  return { code, added };
}

const decl = (v: StVariable) => `      ${v.name} : ${v.type};   // ${(v.comment || v.base).replace(/[\r\n]+/g, ' ')}`;

/** Blocks of an SCL source: kind, name, [start, end) of the whole block. */
function sclBlocks(text: string): { kind: string; name: string; start: number; end: number }[] {
  const out: { kind: string; name: string; start: number; end: number }[] = [];
  const re = /^[ \t]*(FUNCTION_BLOCK|FUNCTION|ORGANIZATION_BLOCK|DATA_BLOCK|TYPE)\s+("?)([^"\s:]+)\2[^\n]*$/gim;
  for (const m of text.matchAll(re)) {
    const kind = m[1].toUpperCase();
    const end = new RegExp(`^[ \\t]*END_${kind === 'TYPE' ? 'TYPE' : kind}\\b[^\\n]*$`, 'gim');
    end.lastIndex = m.index;
    const e = end.exec(text);
    if (e) out.push({ kind, name: m[3], start: m.index, end: e.index + e[0].length });
  }
  return out;
}

const withLineEnds = (original: string, text: string) => (original.includes('\r\n') && !/(?<!\r)\n/.test(original) ? text.replace(/(?<!\r)\n/g, '\r\n') : text);

function changedBlocks(p: StPatchInput): { changed: string[]; added: string[] } {
  const byBlock = (prog: LadderProgram, id: string) => prog.rungs.filter((r) => (r.block ?? '') === id);
  const ids = new Set([...(p.original.blocks ?? []).map((b) => b.id), ...(p.current.blocks ?? []).map((b) => b.id), ...p.current.rungs.map((r) => r.block ?? '')]);
  const changed: string[] = [], added: string[] = [];
  for (const id of ids) {
    if (sig(byBlock(p.original, id)) === sig(byBlock(p.current, id))) continue;
    if (p.blockOrigin[id]) changed.push(id);
    else if (byBlock(p.current, id).length) added.push(id);
  }
  return { changed, added };
}

/** Write the changed blocks into the original SCL source. */
export function patchScl(p: StPatchInput): StPatchResult {
  let text = p.originalText.replace(/\r\n?/g, '\n');
  const warnings: string[] = [], changed: string[] = [], added: string[] = [], newTags: string[] = [];
  // Each block's own variables, from the original text.
  const blocks = sclBlocks(text).filter((b) => b.kind !== 'DATA_BLOCK' && b.kind !== 'TYPE').map((b) => ({ ...b, vars: stVariables(text.slice(b.start, b.end)).map((v) => v.name.toLowerCase()) }));
  const elsewhereOf = (name: string) => new Map(blocks.filter((b) => b.name !== name).flatMap((b) => b.vars.map((v) => [v, b.name] as const)));
  const taken = new Set([...blocks.map((b) => b.name.toLowerCase()), ...stVariables(text).map((v) => v.name.toLowerCase()), ...Object.values(p.names).map((n) => n.split('.')[0].toLowerCase())]);
  const byBlock = (id: string) => p.current.rungs.filter((r) => (r.block ?? '') === id);
  const plan = changedBlocks(p);

  for (const id of plan.changed) {
    const name = p.blockOrigin[id].routine;
    const b = sclBlocks(text).find((x) => x.name === name && x.kind !== 'DATA_BLOCK' && x.kind !== 'TYPE');
    if (!b) { warnings.push(`Block ${name} was not found in the original file; its changes are not in it.`); continue; }
    const whole = text.slice(b.start, b.end);
    const begin = /^[ \t]*BEGIN[ \t]*$/m.exec(whole);
    const endLine = whole.lastIndexOf('\n') + 1;
    if (!begin) { warnings.push(`Block ${name} has no BEGIN; its changes are not in the file.`); continue; }
    const scope: Scope = { locals: new Set(blocks.find((x) => x.name === name)?.vars), elsewhere: elsewhereOf(name), taken, statics: b.kind === 'FUNCTION_BLOCK' };
    const { code, added: vars } = blockCode(byBlock(id), p, name, scope, warnings);
    let head = whole.slice(0, begin.index);
    if (vars.length && scope.statics) {
      // Into the block's last static section (VAR), or a new one.
      const secs = [...head.matchAll(/^[ \t]*VAR[ \t]*$/gm)];
      const last = secs[secs.length - 1];
      const close = last ? /^[ \t]*END_VAR\b/m.exec(head.slice(last.index)) : null;
      if (last && close) {
        const at = last.index + close.index;
        head = `${head.slice(0, at)}${vars.map(decl).join('\n')}\n${head.slice(at)}`;
      } else head = `${head.replace(/\n*$/, '\n')}   VAR\n${vars.map(decl).join('\n')}\n   END_VAR\n\n`;
      newTags.push(...vars.map((v) => `${name}.${v.name}`));
    } else if (vars.length) {
      warnings.push(`${name} is ${b.kind === 'FUNCTION' ? 'a function' : 'an organization block'} (no static variables): add these PLC tags by hand: ${vars.map((v) => `${v.name} (${v.type})`).join(', ')}.`);
      newTags.push(...vars.map((v) => v.name));
    }
    const body = code.split('\n').map((l) => (l ? `   ${l}` : l)).join('\n');
    const next = `${head}${begin[0]}\n${body}\n${whole.slice(endLine)}`;
    text = text.slice(0, b.start) + next + text.slice(b.end);
    changed.push(name);
  }
  if (plan.changed.length) warnings.push(`Rewritten blocks are written from the program: their comments and layout are not kept (${changed.join(', ')}).`);

  // Blocks the app added: a function block with its instance DB, called from the first OB.
  for (const id of plan.added) {
    const name = logixName((p.current.blocks ?? []).find((x) => x.id === id)?.name || 'App_Logic', taken, 'App_Logic');
    taken.add(name.toLowerCase());
    const db = logixName(`${name}_DB`, taken, `${name}_DB`);
    taken.add(db.toLowerCase());
    const scope: Scope = { locals: new Set(), elsewhere: elsewhereOf(''), taken, statics: true };
    const { code, added: vars } = blockCode(byBlock(id), p, name, scope, warnings);
    newTags.push(...vars.map((v) => `${name}.${v.name}`));
    const body = code.split('\n').map((l) => (l ? `   ${l}` : l)).join('\n');
    text = `${text.replace(/\n*$/, '\n')}\nFUNCTION_BLOCK "${name}"\n{ S7_Optimized_Access := 'TRUE' }\nVERSION : 0.1\n${vars.length ? `   VAR\n${vars.map(decl).join('\n')}\n   END_VAR\n` : ''}\nBEGIN\n${body}\nEND_FUNCTION_BLOCK\n\nDATA_BLOCK "${db}"\n{ S7_Optimized_Access := 'TRUE' }\nVERSION : 0.1\n"${name}"\n\nBEGIN\nEND_DATA_BLOCK\n`;
    added.push(name);
    const ob = sclBlocks(text).find((x) => x.kind === 'ORGANIZATION_BLOCK');
    if (ob) {
      const at = text.lastIndexOf('\n', ob.end - 1) + 1;
      text = `${text.slice(0, at)}   "${db}"();   // added by the upgrade\n${text.slice(at)}`;
      if (!changed.includes(ob.name)) changed.push(ob.name);
    } else warnings.push(`Call the new block from your main OB: "${db}"();`);
  }
  return { text: withLineEnds(p.originalText, text), changed, added, newTags, warnings };
}

/** PLCopen type element of a variable type: elementary types as their element, the rest derived. */
function plcopenType(t: string): string {
  const u = t.toUpperCase();
  return /^(BOOL|SINT|INT|DINT|LINT|USINT|UINT|UDINT|ULINT|REAL|LREAL|TIME|BYTE|WORD|DWORD|LWORD)$/.test(u) ? `<${u} />` : `<derived name="${esc(t)}" />`;
}
const plcopenVar = (v: StVariable) => `<variable name="${esc(v.name)}"><type>${plcopenType(v.type)}</type><documentation><xhtml xmlns="http://www.w3.org/1999/xhtml">${esc(v.comment || v.base)}</xhtml></documentation></variable>`;
/** Code as element text: only & and < > are escaped (SCL "PLC tags" stay readable). */
const stBody = (code: string) => `<body>\n<ST>\n<xhtml xmlns="http://www.w3.org/1999/xhtml">${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</xhtml>\n</ST>\n</body>`;

/** [start, end) of each <pou> with its name and type. */
function pous(xml: string): { name: string; type: string; start: number; end: number }[] {
  const out: { name: string; type: string; start: number; end: number }[] = [];
  for (const m of xml.matchAll(/<pou\s[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(m[0])?.[1] ?? '';
    const close = xml.indexOf('</pou>', m.index);
    if (close > 0) out.push({ name, type: /\bpouType="([^"]*)"/.exec(m[0])?.[1] ?? 'program', start: m.index, end: close + 6 });
  }
  return out;
}
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const pouVars = (pouXml: string) => [...(/<interface>[\s\S]*?<\/interface>/.exec(pouXml)?.[0] ?? '').matchAll(/<variable\s[^>]*\bname="([^"]*)"/g)].map((m) => unesc(m[1]).toLowerCase());

/** Write the changed POUs into the original PLCopen XML (TIA Portal: the code is SCL). */
export function patchPlcopen(p: StPatchInput): StPatchResult {
  let xml = p.originalText.replace(/\r\n?/g, '\n');
  const warnings: string[] = [], changed: string[] = [], added: string[] = [], newTags: string[] = [];
  const all = pous(xml).map((x) => ({ name: unesc(x.name), vars: pouVars(xml.slice(x.start, x.end)) }));
  const elsewhereOf = (name: string) => new Map(all.filter((x) => x.name !== name).flatMap((x) => x.vars.map((v) => [v, x.name] as const)));
  const globals = [...(/<instances>[\s\S]*<\/instances>/.exec(xml)?.[0] ?? '').matchAll(/<variable\s[^>]*\bname="([^"]*)"/g)].map((m) => unesc(m[1]).toLowerCase());
  const taken = new Set([...all.map((x) => x.name.toLowerCase()), ...all.flatMap((x) => x.vars), ...globals, ...Object.values(p.names).map((n) => n.split('.')[0].toLowerCase())]);
  const byBlock = (id: string) => p.current.rungs.filter((r) => (r.block ?? '') === id);
  const plan = changedBlocks(p);

  for (const id of plan.changed) {
    const name = p.blockOrigin[id].routine;
    const pou = pous(xml).find((x) => unesc(x.name) === name);
    if (!pou) { warnings.push(`Block ${name} was not found in the original file; its changes are not in it.`); continue; }
    let px = xml.slice(pou.start, pou.end);
    const statics = pou.type === 'functionBlock' || pou.type === 'program';
    const scope: Scope = { locals: new Set(pouVars(px)), elsewhere: elsewhereOf(name), taken, statics };
    const { code, added: vars } = blockCode(byBlock(id), p, name, scope, warnings);
    const body = /<body>[\s\S]*?<\/body>|<body\s*\/>/.exec(px);
    const was = body ? /<body>\s*<(\w+)/.exec(body[0])?.[1] ?? '' : '';
    if (was && was !== 'ST') warnings.push(`${name} was ${was === 'LD' ? 'ladder' : was}; it is written back as Structured Text.`);
    px = body ? px.slice(0, body.index) + stBody(code) + px.slice(body.index + body[0].length) : px.replace(/<\/pou>$/, `${stBody(code)}\n</pou>`);
    if (vars.length && statics) {
      const lines = vars.map(plcopenVar).join('\n');
      if (/<localVars>/.test(px)) px = px.replace(/(<localVars>[\s\S]*?)(<\/localVars>)/, `$1${lines}\n$2`);
      else if (/<localVars\s*\/>/.test(px)) px = px.replace(/<localVars\s*\/>/, `<localVars>\n${lines}\n</localVars>`);
      else if (/<\/interface>/.test(px)) px = px.replace(/<\/interface>/, `<localVars>\n${lines}\n</localVars>\n</interface>`);
      else px = px.replace(/(<pou\s[^>]*>)/, `$1\n<interface>\n<localVars>\n${lines}\n</localVars>\n</interface>`);
      newTags.push(...vars.map((v) => `${name}.${v.name}`));
    } else if (vars.length) {
      warnings.push(`${name} is a function (no static variables): add these PLC tags by hand: ${vars.map((v) => `${v.name} (${v.type})`).join(', ')}.`);
      newTags.push(...vars.map((v) => v.name));
    }
    xml = xml.slice(0, pou.start) + px + xml.slice(pou.end);
    changed.push(name);
  }
  if (plan.changed.length) warnings.push(`Rewritten blocks are written from the program: their comments and layout are not kept (${changed.join(', ')}).`);

  for (const id of plan.added) {
    const name = logixName((p.current.blocks ?? []).find((x) => x.id === id)?.name || 'App_Logic', taken, 'App_Logic');
    taken.add(name.toLowerCase());
    const scope: Scope = { locals: new Set(), elsewhere: elsewhereOf(''), taken, statics: true };
    const { code, added: vars } = blockCode(byBlock(id), p, name, scope, warnings);
    newTags.push(...vars.map((v) => `${name}.${v.name}`));
    const pouXml = `<pou name="${esc(name)}" pouType="functionBlock">\n<interface>\n${vars.length ? `<localVars>\n${vars.map(plcopenVar).join('\n')}\n</localVars>\n` : ''}</interface>\n${stBody(code)}\n</pou>\n`;
    const at = xml.indexOf('</pous>');
    if (at < 0) { warnings.push(`The file has no program blocks section: the new block ${name} is not in it.`); continue; }
    xml = xml.slice(0, at) + pouXml + xml.slice(at);
    added.push(name);
    warnings.push(`Call the new block ${name} from your main OB (with an instance DB).`);
  }
  return { text: withLineEnds(p.originalText, xml), changed, added, newTags, warnings };
}
