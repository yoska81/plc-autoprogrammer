/**
 * Studio 5000 / RSLogix 5000 .L5K (the text export): CONTROLLER name (ProcessorType := "…") ›
 * DATATYPE … END_DATATYPE › TAG … END_TAG (Name : TYPE (Description := "…") := value; and aliases
 * Name OF Local:1:I.Data.0 (…);) › PROGRAM … TAG … ROUTINE name  RC: "comment"; N: rung text; END_ROUTINE ›
 * ST_ROUTINE name 'line … END_ST_ROUTINE. Same result as the .L5X reader.
 */
import { convertLogixRung } from './logixText';
import { convertSt } from './st';
import { toRungs } from './cond';
import { fillPresets, logixIoKind, logixType, opsOf, OPERAND_KEYS, slug, rawRepeated, wholeRung } from './l5x';
import type { ForeignProgram, ForeignRoutine, ForeignTag } from './types';

/** Split text into statements ending with ";" outside quotes / brackets / parentheses. */
function statements(s: string): string[] {
  const out: string[] = [];
  let depth = 0, q = false, cur = '';
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; }
    if (ch === ';' && !q && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const unq = (s: string) => s.replace(/^"|"$/g, '').replace(/\$N|\$L/gi, '\n').replace(/\$'/g, "'").replace(/\$"/g, '"').replace(/\$\$/g, '$').replace(/""/g, '"');
const attr = (s: string, name: string) => new RegExp(`\\b${name}\\s*:=\\s*("(?:[^"]|"")*"|[^,)]+)`, 'i').exec(s)?.[1];

function readTags(section: string, comments: Map<string, string>): ForeignTag[] {
  const out: ForeignTag[] = [];
  for (const st of statements(section)) {
    const s = st.replace(/\s+/g, ' ').trim();
    // Module point comments: "Local:1:I : AB:1769_DI16:I:0 (COMMENT.DATA.0 := "Start PB", …)".
    const modTag = /(?:^|\s)([\w]+:\d+:[IO])\s*:\s*[\w:]+\s*\(/.exec(s);
    if (modTag) {
      for (const m of s.matchAll(/COMMENT(\.[\w.[\]]+)\s*:=\s*("(?:[^"]|"")*")/gi)) comments.set(`${modTag[1]}${m[1]}`.toUpperCase(), unq(m[2]));
      continue;
    }
    const alias = /^([A-Za-z_]\w*)\s+OF\s+([^\s(]+)/i.exec(s);
    if (alias) {
      const desc = attr(s, 'Description');
      const io = logixIoKind(alias[2]);
      out.push({ name: alias[1], dataType: 'BOOL', rawType: 'ALIAS', address: alias[2], comment: desc ? unq(desc) : '', ...(io ? { io } : {}), ...(io && !/\.\d+$/.test(alias[2]) ? { analog: true } : {}) });
      continue;
    }
    const base = /^([A-Za-z_]\w*)\s*:\s*([A-Za-z_][\w:]*)(\[[\d,]+\])?/.exec(s);
    if (base) {
      const desc = attr(s, 'Description');
      // TIMER := [control, PRE, ACC]; COUNTER := [control, PRE, ACC].
      const value = /:=\s*\[\s*[^,\]]+,\s*(-?\d+)/.exec(s.slice(s.lastIndexOf(':=')));
      const pre = /^(TIMER|COUNTER)$/i.test(base[2]) && value ? value[1] : undefined;
      out.push({ name: base[1], dataType: base[3] ? 'OTHER' : logixType(base[2]), rawType: base[2] + (base[3] ?? ''), comment: desc ? unq(desc) : '', ...(pre ? { preset: pre } : {}) });
    }
  }
  return out;
}

export function readL5k(src: string): ForeignProgram {
  const text = src.replace(/\r\n?/g, '\n');
  const ctrl = /CONTROLLER\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s*\n/.exec(text);
  if (!ctrl) throw new Error('This is not a Studio 5000 .L5K file (no CONTROLLER).');
  const comments = new Map<string, string>();
  const notes: string[] = [];
  // UDT members.
  const udts = new Map<string, { name: string; type: string }[]>();
  for (const m of text.matchAll(/DATATYPE\s+(\w+)[\s\S]*?\n([\s\S]*?)END_DATATYPE/g)) {
    udts.set(m[1].toLowerCase(), statements(m[2]).map((x) => /^(\w+)\s+(\w+)/.exec(x.trim())).filter((x): x is RegExpExecArray => Boolean(x)).map((x) => ({ type: x[1].toUpperCase() === 'BIT' ? 'BOOL' : x[1], name: x[2] })));
  }
  // Module sections can carry point comments too.
  for (const m of text.matchAll(/MODULE[\s\S]*?END_MODULE/g)) readTags(m[0].replace(/^MODULE[^\n]*\n/, ''), comments);
  const withMembers = (list: ForeignTag[]) => list.flatMap((t) => {
    const members = t.rawType ? udts.get(t.rawType.toLowerCase()) : undefined;
    return members ? [t, ...members.map((m) => ({ name: `${t.name}.${m.name}`, dataType: logixType(m.type), rawType: m.type, comment: t.comment }))] : [t];
  });

  // Controller tags: the TAG block before the first PROGRAM.
  const firstProgram = text.search(/\n\s*PROGRAM\s/);
  const head = firstProgram < 0 ? text : text.slice(0, firstProgram);
  const tags: ForeignTag[] = [];
  for (const m of head.matchAll(/\n\s*TAG\s*\n([\s\S]*?)\n\s*END_TAG/g)) tags.push(...withMembers(readTags(m[1], comments)));
  const known = new Set(tags.map((t) => t.name.toLowerCase()));
  const routines: ForeignRoutine[] = [];
  const ioRefs = new Set<string>();
  const calls: string[] = [];
  const programs = [...text.matchAll(/\n\s*PROGRAM\s+(\w+)[^\n]*\n([\s\S]*?)\n\s*END_PROGRAM/g)];
  for (const pm of programs) {
    const pname = pm[1];
    const body = pm[2];
    const rename = new Map<string, string>();
    for (const tm of body.matchAll(/\n?\s*TAG\s*\n([\s\S]*?)\n\s*END_TAG/g)) {
      for (const t of withMembers(readTags(tm[1], comments))) {
        if (known.has(t.name.toLowerCase())) { rename.set(t.name.toLowerCase(), `${pname}.${t.name}`); t.name = `${pname}.${t.name}`; }
        known.add(t.name.toLowerCase());
        tags.push(t);
      }
    }
    const qualify = (op: string) => (rename.size ? op.replace(/(^|[^\w.:#])([A-Za-z_]\w*)(?!\w*\s*\()/g, (_m, pre: string, n: string) => pre + (rename.get(n.toLowerCase()) ?? n)) : op);
    const mapOps = <T,>(x: T): T => JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && OPERAND_KEYS.includes(k) ? qualify(v) : v));
    const rname = (n: string) => (programs.length > 1 ? `${pname} / ${n}` : n);
    for (const rm of body.matchAll(/\n\s*ROUTINE\s+(\w+)[^\n]*\n([\s\S]*?)\n\s*END_ROUTINE/g)) {
      const name = rname(rm[1]);
      const routine: ForeignRoutine = { name, language: 'ladder', rungs: [], untranslated: [] };
      let comment = '';
      let i = 0;
      for (const st of statements(rm[2])) {
        const s = st.trim();
        const rc = /^RC:\s*("(?:[^"]|"")*")/s.exec(s);
        if (rc) { comment = unq(rc[1]); continue; }
        const n = /^N:\s*([\s\S]*)$/.exec(s);
        if (!n) continue;
        const rung = n[1].replace(/\s*\n\s*/g, ' ').trim();
        const idx = i++;
        if (/^JSR\(\s*\w+\s*(,[^)]*)?\)$/i.test(rung)) { calls.push(rung); comment = ''; continue; }
        try {
          const { driven, untranslated } = convertLogixRung(rung);
          for (const d of driven) for (const op of opsOf(d)) if (logixIoKind(op)) ioRefs.add(op);
          const { rungs, failed } = toRungs(mapOps(driven), comment, `${slug(name)}_${idx}`);
          // A rung the ladder model can't hold is kept whole, as it was.
          const got = failed.length || untranslated.length || rawRepeated(rungs) ? [wholeRung(rung, comment, `${slug(name)}_${idx}`)] : rungs;
          routine.rungs.push(...got);
          for (const g of got) (routine.rungNumbers ??= {})[g.id] = String(idx);
        } catch {
          const g = wholeRung(rung, comment, `${slug(name)}_${idx}`);
          routine.rungs.push(g);
          (routine.rungNumbers ??= {})[g.id] = String(idx);
        }
        comment = '';
      }
      routines.push(routine);
    }
    for (const sm of body.matchAll(/\n\s*ST_ROUTINE\s+(\w+)[^\n]*\n([\s\S]*?)\n\s*END_ST_ROUTINE/g)) {
      const name = rname(sm[1]);
      const code = sm[2].split('\n').map((l) => l.replace(/^\s*'/, '')).join('\n');
      const st = convertSt(code, slug(name), { types: new Map(tags.map((t) => [t.name.toLowerCase(), t.rawType ?? t.dataType])) });
      routines.push({ name, language: 'st', rungs: mapOps(st.rungs), untranslated: st.untranslated });
    }
    for (const fm of body.matchAll(/\n\s*(FBD_ROUTINE|SFC_ROUTINE)\s+(\w+)/g)) {
      routines.push({ name: rname(fm[2]), language: fm[1].startsWith('FBD') ? 'fbd' : 'sfc', rungs: [], untranslated: [`${fm[1].slice(0, 3)} routine: not converted (only ladder and Structured Text are read).`] });
    }
  }
  if (calls.length) notes.push(`${calls.length} subroutine call${calls.length === 1 ? '' : 's'} (JSR): each routine becomes a block of the program; all blocks run every scan.`);
  for (const op of ioRefs) {
    if (known.has(op.toLowerCase())) continue;
    known.add(op.toLowerCase());
    tags.push({ name: op, dataType: /\.\d+$/.test(op) ? 'BOOL' : 'INT', comment: comments.get(op.toUpperCase()) ?? '', address: op, io: logixIoKind(op)!, ...(/\.\d+$/.test(op) ? {} : { analog: true }) });
  }
  // Alias tags without a description take the module point's comment.
  for (const t of tags) if (t.address && !t.comment) t.comment = comments.get(t.address.toUpperCase()) ?? '';
  fillPresets(routines, tags);
  return {
    format: 'l5k', vendor: 'Allen-Bradley', controller: unq(attr(ctrl[2], 'ProcessorType') ?? ''), projectName: ctrl[1],
    tags, routines, notes,
  };
}
