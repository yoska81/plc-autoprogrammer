/**
 * Studio 5000 / RSLogix 5000 .L5X (Logix 5000 Controllers Import/Export Reference Manual 1756-RM084):
 * Controller (Name, ProcessorType) › Modules (I/O point comments) › Tags (Base / Alias with AliasFor,
 * Description) › Programs › Tags + Routines (RLL: RLLContent › Rung › Comment / Text; ST: STContent › Line).
 */
import { all, kid, kids, parseXml, textOf, type XNode } from './xml';
import { convertLogixRung, msPreset } from './logixText';
import { convertSt } from './st';
import { toRungs } from './cond';
import type { ForeignProgram, ForeignRoutine, ForeignTag, ForeignType } from './types';
import type { Rung } from '../core/ladder';

export function logixType(raw: string): ForeignType {
  const t = raw.toUpperCase();
  if (t === 'BOOL') return 'BOOL';
  if (t === 'SINT' || t === 'INT') return 'INT';
  if (t === 'DINT' || t === 'LINT') return 'DINT';
  if (t === 'REAL' || t === 'LREAL') return 'REAL';
  if (t === 'TIMER') return 'TIMER';
  if (t === 'COUNTER') return 'COUNTER';
  if (t === 'STRING') return 'STRING';
  return 'OTHER';
}

/** Is a Logix operand a physical I/O point ("Local:1:I.Data.0", "Rack1:3:O.Data.2", "IO_Rack:2:I.Ch0Data")? */
export function logixIoKind(operand: string): 'input' | 'output' | null {
  const m = /^[A-Za-z_][\w]*:\d+:([IO])\./i.exec(operand.trim());
  return m ? (m[1].toUpperCase() === 'I' ? 'input' : 'output') : null;
}

function tagOf(t: XNode, comments: Map<string, string>): ForeignTag {
  const raw = t.attrs.DataType ?? (t.attrs.TagType === 'Alias' ? 'ALIAS' : '');
  const alias = t.attrs.AliasFor;
  let comment = textOf(kid(t, 'Description')).trim();
  // Our own exports write the module point into the description ("… — module point Local:1:I.Data.0").
  const mp = /module point ([\w]+:\d+:[IO]\.[\w.[\]]+)/i.exec(comment);
  const address = alias ?? mp?.[1];
  if (mp) comment = comment.replace(/\s*—\s*module point .*$/i, '').trim();
  if (alias && !comment) comment = comments.get(alias.toUpperCase()) ?? '';
  const io = address ? logixIoKind(address) : null;
  const pre = all(t, 'DataValueMember').find((m) => m.attrs.Name === 'PRE')?.attrs.Value;
  return {
    ...(pre !== undefined ? { preset: pre } : {}),
    name: t.attrs.Name, dataType: alias ? 'BOOL' : logixType(raw), rawType: raw || undefined,
    comment, ...(address ? { address } : {}), ...(io ? { io } : {}),
    ...(io && /ch\d|data\[|Ch\d+Data/i.test(address ?? '') && !/\.\d+$/.test(address ?? '') ? { analog: true } : {}),
  };
}

/** The I/O modules in the controller's own rack (ParentModule="Local", not the controller itself), by slot. */
function localModules(ctrl: XNode): { slot: number; catalog: string }[] {
  return kids(kid(ctrl, 'Modules'), 'Module')
    .filter((m) => m.attrs.ParentModule === 'Local' && m.attrs.Name !== 'Local' && m.attrs.CatalogNumber)
    .map((m) => ({ slot: Number(kids(kid(m, 'Ports'), 'Port').find((p) => p.attrs.Upstream === 'true')?.attrs.Address ?? NaN), catalog: m.attrs.CatalogNumber }))
    .filter((m) => Number.isInteger(m.slot))
    .sort((a, b) => a.slot - b.slot);
}

/** Comments on module I/O points: "Local:1:I.Data.0" → "Start pushbutton". */
function moduleComments(root: XNode): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of all(root, 'Module')) {
    const parent = m.attrs.ParentModule;
    const slot = kids(kid(m, 'Ports'), 'Port').find((p) => p.attrs.Upstream === 'true')?.attrs.Address;
    if (!parent || slot === undefined) continue;
    const base = `${parent}:${slot}`;
    for (const tagKind of ['InputTag', 'OutputTag'] as const) {
      for (const t of all(m, tagKind)) {
        for (const c of all(t, 'Comment')) {
          const op = c.attrs.Operand ?? '';
          out.set(`${base}:${tagKind === 'InputTag' ? 'I' : 'O'}${op}`.toUpperCase(), textOf(c).trim());
        }
      }
    }
  }
  return out;
}

/**
 * Each RAW instruction carries the original definitions it needs (tags it names, their user-defined
 * types, add-on instructions it calls), so an export to Logix can declare them.
 */
function attachDecls(src: string, routines: ForeignRoutine[]): void {
  const slices = (tag: string) => {
    const m = new Map<string, string>();
    const re = new RegExp(`<${tag}\\s[^>]*\\bName="([^"]+)"[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`, 'g');
    for (const x of src.matchAll(re)) if (!m.has(x[1].toLowerCase())) m.set(x[1].toLowerCase(), x[0]);
    return m;
  };
  const tags = slices('Tag'), types = slices('DataType'), aois = slices('AddOnInstructionDefinition');
  const declFor = (text: string): string[] => {
    const out = new Set<string>();
    const addType = (name: string) => {
      const k = name.toLowerCase();
      if (types.has(k)) out.add(types.get(k)!);
      if (aois.has(k)) out.add(aois.get(k)!);
    };
    for (const m of text.matchAll(/(?<![\w.:])([A-Za-z_]\w*)(\s*\()?/g)) {
      if (m[2]) { addType(m[1]); continue; } // an instruction: an add-on instruction's definition
      const t = tags.get(m[1].toLowerCase());
      if (!t || /TagType="Alias"/.test(t)) continue; // aliases point at the original modules
      out.add(t);
      const dt = /\bDataType="([^"]+)"/.exec(t)?.[1];
      if (dt) addType(dt);
    }
    return [...out];
  };
  for (const r of routines) for (const g of r.rungs) for (const x of [...g.branches.flat(), ...g.outputs]) {
    if (x.type !== 'RAW') continue;
    const decl = declFor(x.text);
    if (decl.length) x.decl = decl;
  }
}

/**
 * A kept instruction that the rung's paths would repeat ([XIC(A),XIC(B)]OSR(s,o)…: one OSR in the PLC, one
 * per path in the app): its state (one-shot, call) can't be split, so the rung is kept whole instead.
 */
export function rawRepeated(rungs: Rung[]): boolean {
  return rungs.some((r) => r.branches.length > 1 && r.branches.flat().some((e) => e.type === 'RAW'));
}

/** A rung kept whole as its original text (RAW): it goes back into the PLC as it was. */
export function wholeRung(text: string, comment: string, id: string): Rung {
  return { id, comment, branches: [], outputs: [{ type: 'RAW', vendor: 'logix', text: text.replace(/;\s*$/, '') }] };
}

export function readL5x(input: string): ForeignProgram {
  // Windows exports are CRLF: read as LF lines.
  const src = input.replace(/\r\n?/g, '\n');
  const doc = parseXml(src);
  const content = kid(doc, 'RSLogix5000Content');
  if (!content) throw new Error('This is not a Studio 5000 .L5X file (no RSLogix5000Content).');
  const ctrl = kid(content, 'Controller');
  if (!ctrl) throw new Error('The .L5X has no controller (a routine or rung export alone cannot be imported; export the whole project).');
  const comments = moduleComments(ctrl);
  const notes: string[] = [];
  const tags: ForeignTag[] = kids(kid(ctrl, 'Tags'), 'Tag').map((t) => tagOf(t, comments));
  // Members of user-defined types ("Capper.Torque_SP" is a REAL): a tag each, so they get the right kind of address.
  const udts = new Map<string, { name: string; type: string; comment: string }[]>();
  for (const d of kids(kid(ctrl, 'DataTypes'), 'DataType')) {
    udts.set(d.attrs.Name.toLowerCase(), kids(kid(d, 'Members'), 'Member').filter((m) => m.attrs.Hidden !== 'true').map((m) => ({ name: m.attrs.Name, type: m.attrs.DataType, comment: textOf(kid(m, 'Description')).trim() })));
  }
  const withMembers = (list: ForeignTag[]) => list.flatMap((t) => {
    const members = t.rawType ? udts.get(t.rawType.toLowerCase()) : undefined;
    return members ? [t, ...members.map((m) => ({ name: `${t.name}.${m.name}`, dataType: logixType(m.type), rawType: m.type, comment: [t.comment, m.comment].filter(Boolean).join(' — ') || '' }))] : [t];
  });
  tags.splice(0, tags.length, ...withMembers(tags));
  const known = new Set(tags.map((t) => t.name.toLowerCase()));
  // Module points used directly in rungs: tags of their own, named after the module point, with its comment.
  const ioRefs = new Set<string>();
  const routines: ForeignRoutine[] = [];
  const calls: string[] = [];
  const programs = kids(kid(ctrl, 'Programs'), 'Program');
  // Program-scoped names that exist in more than one program are qualified with the program name.
  const count = new Map<string, number>();
  for (const p of programs) for (const t of kids(kid(p, 'Tags'), 'Tag')) count.set(t.attrs.Name.toLowerCase(), (count.get(t.attrs.Name.toLowerCase()) ?? 0) + 1);

  for (const p of programs) {
    const pname = p.attrs.Name;
    const rename = new Map<string, string>();
    for (const t of kids(kid(p, 'Tags'), 'Tag')) {
      const tag = tagOf(t, comments);
      const clash = (count.get(tag.name.toLowerCase()) ?? 0) > 1 || known.has(tag.name.toLowerCase());
      if (clash) { rename.set(tag.name.toLowerCase(), `${pname}.${tag.name}`); tag.name = `${pname}.${tag.name}`; }
      known.add(tag.name.toLowerCase());
      tags.push(...withMembers([tag]));
    }
    // Names in operands and expressions (not member names after a dot, not instruction names before "(").
    const qualify = (op: string) => (rename.size ? op.replace(/(^|[^\w.:#])([A-Za-z_]\w*)(?!\w*\s*\()/g, (_m, pre: string, n: string) => pre + (rename.get(n.toLowerCase()) ?? n)) : op);
    const mapOps = <T,>(x: T): T => JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && OPERAND_KEYS.includes(k) ? qualify(v) : v));
    if (p.attrs.Disabled === 'true') notes.push(`Program ${pname} is disabled in the controller; imported anyway.`);
    // Which routines run: the main and fault routines, and every routine a JSR names (called below).
    const first = routines.length;
    const runs = new Set([p.attrs.MainRoutineName, p.attrs.FaultRoutineName].filter(Boolean).map((n) => n!.toLowerCase()));
    for (const r of kids(kid(p, 'Routines'), 'Routine')) {
      const rname = programs.length > 1 ? `${pname} / ${r.attrs.Name}` : r.attrs.Name;
      const type = (r.attrs.Type ?? '').toUpperCase();
      const routine: ForeignRoutine = { name: rname, language: type === 'RLL' ? 'ladder' : type === 'ST' ? 'st' : type === 'FBD' ? 'fbd' : type === 'SFC' ? 'sfc' : 'other', rungs: [], untranslated: [], origin: { program: pname, routine: r.attrs.Name } };
      if (type === 'RLL') {
        kids(kid(r, 'RLLContent'), 'Rung').forEach((g, i) => {
          const text = textOf(kid(g, 'Text')).trim();
          const comment = textOf(kid(g, 'Comment')).trim();
          if (!text) return;
          for (const m of text.matchAll(/\bJSR\(\s*(\w+)/gi)) runs.add(m[1].toLowerCase());
          // Unconditional subroutine calls: in the app every routine is a block that runs each scan.
          if (/^JSR\(\s*[\w]+\s*(,[^)]*)?\)\s*;?$/i.test(text)) { calls.push(text); return; }
          try {
            const { driven, untranslated } = convertLogixRung(text);
            for (const d of driven) for (const op of opsOf(d)) if (logixIoKind(op)) ioRefs.add(op);
            const { rungs, failed } = toRungs(mapOps(driven), comment, `${slug(rname)}_${i}`);
            // A rung the ladder model can't hold is kept whole, as it was.
            const got = failed.length || untranslated.length || rawRepeated(rungs) ? [wholeRung(text, comment, `${slug(rname)}_${i}`)] : rungs;
            routine.rungs.push(...got);
            for (const g of got) (routine.rungNumbers ??= {})[g.id] = String(i);
          } catch {
            const g = wholeRung(text, comment, `${slug(rname)}_${i}`);
            routine.rungs.push(g);
            (routine.rungNumbers ??= {})[g.id] = String(i);
          }
        });
      } else if (type === 'ST') {
        const text = kids(kid(r, 'STContent'), 'Line').map((l) => textOf(l)).join('\n');
        const st = convertSt(text, slug(rname), { types: new Map(tags.map((t) => [t.name.toLowerCase(), t.rawType ?? t.dataType])) });
        routine.rungs.push(...mapOps(st.rungs));
        routine.untranslated.push(...st.untranslated);
      } else {
        routine.untranslated.push(`${type || 'Unknown'} routine: not converted (only ladder and Structured Text are read).`);
      }
      routines.push(routine);
    }
    if (p.attrs.MainRoutineName) for (const r of routines.slice(first)) r.called = runs.has((r.origin?.routine ?? r.name).toLowerCase());
  }
  if (calls.length) notes.push(`${calls.length} subroutine call${calls.length === 1 ? '' : 's'} (JSR): each routine becomes a block of the program; all blocks run every scan.`);
  for (const op of ioRefs) {
    const base = op;
    if (known.has(base.toLowerCase())) continue;
    known.add(base.toLowerCase());
    tags.push({ name: base, dataType: /\.\d+$/.test(base) ? 'BOOL' : 'INT', comment: comments.get(base.toUpperCase()) ?? '', address: base, io: logixIoKind(base)!, ...(/\.\d+$/.test(base) ? {} : { analog: true }) });
  }
  fillPresets(routines, tags);
  attachDecls(src, routines);
  const outside = [
    ...kids(kid(ctrl, 'AddOnInstructionDefinitions'), 'AddOnInstructionDefinition').map((d) => `Add-on instruction ${d.attrs.Name}`),
    ...routines.filter((r) => r.language === 'fbd' || r.language === 'sfc').map((r) => `${r.language.toUpperCase()} routine ${r.name}`),
    ...[...kids(kid(ctrl, 'Tags'), 'Tag'), ...programs.flatMap((p) => kids(kid(p, 'Tags'), 'Tag'))]
      .filter((t) => t.attrs.TagType === 'Produced' || t.attrs.TagType === 'Consumed' || /^(MESSAGE|AXIS_|MOTION_|PID)/i.test(t.attrs.DataType ?? ''))
      .map((t) => `${t.attrs.TagType === 'Produced' || t.attrs.TagType === 'Consumed' ? `${t.attrs.TagType} tag` : `${t.attrs.DataType} tag`} ${t.attrs.Name}`),
  ];
  return {
    outside,
    format: 'l5x', vendor: 'Allen-Bradley', controller: ctrl.attrs.ProcessorType ?? '', projectName: ctrl.attrs.Name ?? content.attrs.TargetName ?? 'Imported project',
    modules: localModules(ctrl),
    tags, routines, notes,
  };
}

/** Timers / counters written with "?" as preset (Logix: use the tag's stored value) get the tag's preset. */
export function fillPresets(routines: ForeignRoutine[], tags: ForeignTag[]): void {
  const by = new Map(tags.map((t) => [t.name.toLowerCase(), t]));
  for (const r of routines) for (const g of r.rungs) for (const o of g.outputs) {
    if ((o.type === 'TMR' || o.type === 'CNT') && /^\?$/.test(o.preset.trim())) {
      const pre = by.get(o.address.toLowerCase())?.preset ?? '0';
      if (o.type === 'TMR') { const p = msPreset(pre); o.preset = p.preset; o.unit = p.unit; } else o.preset = pre;
    }
  }
}

/** Keys of the ladder model that hold operands or expressions. */
export const OPERAND_KEYS = ['address', 'left', 'right', 'source', 'dest', 'preset', 'resetAddress', 'expression'];

export const slug = (s: string) => s.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'r';

/** Every operand a driven output and its condition use. */
export function opsOf(d: { cond: unknown; out: unknown }): string[] {
  const out: string[] = [];
  JSON.stringify(d, (k, v) => { if (typeof v === 'string' && ['address', 'left', 'right', 'source', 'dest', 'resetAddress'].includes(k)) out.push(v); return v; });
  return out;
}
