/**
 * IEC 61131-3 PLCopen XML (TC6 v2.01: CODESYS, Beckhoff, Schneider Machine Expert, Omron Sysmac,
 * Phoenix PLCnext, Kinco …): pous › pou (interface variables, body ST / LD) and the configuration's
 * global variables with their %I / %Q addresses. ST bodies go through st.ts; the LD body is a graph
 * (leftPowerRail, contact, coil, block, inVariable, outVariable linked by connectionPointIn/refLocalId)
 * that is walked back from every coil and block into rung conditions.
 */
import { all, kid, kids, local, parseXml, textOf, type XNode } from './xml';
import { convertSt } from './st';
import { and, el, not, or, toRungs, TRUE, type Cond, type Driven } from './cond';
import { msPreset } from './logixText';
import { timeMs } from './st';
import { slug } from './l5x';
import { blockRung } from './stSource';
import type { ForeignProgram, ForeignRoutine, ForeignTag, ForeignType } from './types';

function iecType(typeNode: XNode | undefined): { type: ForeignType; raw: string } {
  const t = typeNode?.children[0];
  if (!t) return { type: 'OTHER', raw: '' };
  const name = local(t) === 'derived' ? t.attrs.name ?? '' : local(t);
  const u = name.toUpperCase();
  const type: ForeignType = u === 'BOOL' ? 'BOOL' : /^(SINT|INT|USINT|UINT|BYTE|WORD)$/.test(u) ? 'INT' : /^(DINT|UDINT|DWORD|LINT|ULINT|TIME)$/.test(u) ? 'DINT' : /^(REAL|LREAL)$/.test(u) ? 'REAL' : /^(TON|TOF|TP)$/.test(u) ? 'TIMER' : /^(CTU|CTD|CTUD)$/.test(u) ? 'COUNTER' : u === 'STRING' ? 'STRING' : 'OTHER';
  return { type, raw: name };
}

/** "%IX0.3" → input, "%QX1.0" → output, "%IW2" analog input. */
export function iecIo(address: string | undefined): { io?: 'input' | 'output'; analog?: boolean } {
  const m = /^%([IQ])([XBWDL]?)/i.exec(address ?? '');
  if (!m) return {};
  return { io: m[1].toUpperCase() === 'I' ? 'input' : 'output', ...(m[2] && m[2].toUpperCase() !== 'X' ? { analog: true } : {}) };
}

function variables(n: XNode | undefined): ForeignTag[] {
  const out: ForeignTag[] = [];
  for (const v of all(n, 'variable')) {
    const { type, raw } = iecType(kid(v, 'type'));
    const address = v.attrs.address;
    out.push({ name: v.attrs.name, dataType: type, rawType: raw, comment: textOf(kid(v, 'documentation')).trim(), ...(address ? { address } : {}), ...iecIo(address) });
  }
  return out;
}

/**
 * A POU written back as source text: Siemens SCL (`FUNCTION "Name" : Real … BEGIN … END_FUNCTION`) for a
 * TIA Portal export, IEC Structured Text otherwise.
 */
function pouSource(pou: XNode, body: string, siemens: boolean): string {
  const kind = pou.attrs.pouType === 'function' ? 'FUNCTION' : pou.attrs.pouType === 'functionBlock' ? 'FUNCTION_BLOCK' : 'PROGRAM';
  const iface = kid(pou, 'interface');
  const ret = iecType(kid(iface, 'returnType')).raw;
  const name = siemens ? `"${pou.attrs.name}"` : pou.attrs.name;
  const SECTIONS: [string, string][] = [['inputVars', 'VAR_INPUT'], ['outputVars', 'VAR_OUTPUT'], ['inOutVars', 'VAR_IN_OUT'], ['localVars', siemens && kind === 'FUNCTION' ? 'VAR_TEMP' : 'VAR'], ['tempVars', 'VAR_TEMP']];
  const vars = SECTIONS.map(([tag, kw]) => {
    const vs = kids(kid(iface, tag), 'variable');
    if (!vs.length) return '';
    const lines = vs.map((v) => {
      const doc = textOf(kid(v, 'documentation')).trim();
      return `      ${v.attrs.name} : ${iecType(kid(v, 'type')).raw};${doc ? `   // ${doc}` : ''}`;
    });
    return `   ${kw}\n${lines.join('\n')}\n   END_VAR\n`;
  }).join('');
  return `${kind} ${name}${kind === 'FUNCTION' && ret ? ` : ${ret}` : ''}\n${vars}${siemens ? 'BEGIN\n' : ''}${body.trim()}\nEND_${kind}`;
}

/** Ladder diagram body → outputs with conditions. `vendor`: a call to a block the ladder model has no form for is kept as a RAW statement of that PLC. */
function ldBody(body: XNode, untranslated: string[], vendor = 'iec'): Driven[] {
  const nodes = new Map<string, XNode>();
  const order: XNode[] = [];
  const walkAll = (x: XNode) => { for (const c of x.children) { if (c.attrs.localId) { nodes.set(c.attrs.localId, c); order.push(c); } walkAll(c); } };
  walkAll(body);
  const memo = new Map<string, Cond>();
  const driven: Driven[] = [];
  const varOf = (x: XNode) => textOf(kid(x, 'variable')).trim() || textOf(kid(x, 'expression')).trim();

  /** Condition arriving at a connectionPointIn (several connections = wired OR). */
  function into(cp: XNode | undefined): Cond {
    if (!cp) return TRUE;
    const cs = kids(cp, 'connection');
    if (!cs.length) return TRUE;
    return or(...cs.map((c) => outOf(c.attrs.refLocalId, c.attrs.formalParameter)));
  }
  /** Value leaving an element (formal = the block output's name). */
  function outOf(id: string, formal?: string): Cond {
    const k = `${id}:${formal ?? ''}`;
    const hit = memo.get(k);
    if (hit) return hit;
    const n = nodes.get(id);
    let c: Cond = TRUE;
    if (n) switch (local(n)) {
      case 'leftPowerRail': c = TRUE; break;
      case 'contact': {
        const v = varOf(n);
        const edge = n.attrs.edge;
        const e = edge === 'rising' ? el({ type: 'RISE', address: v }) : edge === 'falling' ? el({ type: 'FALL', address: v }) : el({ type: n.attrs.negated === 'true' ? 'NC' : 'NO', address: v });
        c = and(into(kid(n, 'connectionPointIn')), e);
        break;
      }
      case 'coil': c = into(kid(n, 'connectionPointIn')); break;
      case 'inVariable': {
        const v = varOf(n);
        c = el({ type: n.attrs.negated === 'true' ? 'NC' : 'NO', address: v });
        break;
      }
      case 'block': {
        const type = (n.attrs.typeName ?? '').toUpperCase();
        const inst = n.attrs.instanceName ?? '';
        const out = (formal ?? '').toUpperCase();
        const ins = new Map(kids(kid(n, 'inputVariables'), 'variable').map((v) => [v.attrs.formalParameter.toUpperCase(), v]));
        const inCond = (p: string) => into(kid(ins.get(p), 'connectionPointIn'));
        const inVal = (p: string): string | null => {
          const conn = kids(kid(ins.get(p), 'connectionPointIn'), 'connection')[0];
          const src = conn ? nodes.get(conn.attrs.refLocalId) : undefined;
          if (!src || local(src) !== 'inVariable') return null;
          const e = varOf(src);
          const ms = /^(T|TIME)#/i.test(e) ? timeMs(e) : null;
          return ms !== null ? String(ms) : e;
        };
        if ((type === 'TON' || type === 'TOF') && (out === 'Q' || out === '')) c = el({ type: 'NO', address: `${inst}.Q` });
        else if ((type === 'CTU' || type === 'CTD') && (out === 'Q' || out === '')) c = el({ type: 'NO', address: `${inst}.Q` });
        else if (type === 'R_TRIG' || type === 'F_TRIG') {
          const clk = ins.get('CLK');
          const conn = kids(kid(clk, 'connectionPointIn'), 'connection')[0];
          const src = conn ? nodes.get(conn.attrs.refLocalId) : undefined;
          const v = src ? varOf(src) : '';
          c = v ? el({ type: type === 'R_TRIG' ? 'RISE' : 'FALL', address: v }) : TRUE;
        } else if (['GT', 'GE', 'EQ', 'NE', 'LE', 'LT'].includes(type)) {
          const a = inVal('IN1'), b = inVal('IN2');
          const op = ({ GT: '>', GE: '>=', EQ: '==', NE: '<>', LE: '<=', LT: '<' } as const)[type as 'GT'];
          c = a && b ? and(inCond('EN'), el({ type: 'CMP', left: a, op, right: b })) : TRUE;
          if (!a || !b) untranslated.push(`${type} block with computed inputs`);
        } else if (out === 'ENO') c = inCond('EN');
        else c = TRUE;
        break;
      }
      default: c = TRUE;
    }
    memo.set(k, c);
    return c;
  }

  for (const n of order) {
    const kind = local(n);
    if (kind === 'coil') {
      const v = varOf(n);
      const c = into(kid(n, 'connectionPointIn'));
      const storage = n.attrs.storage;
      if (n.attrs.negated === 'true') driven.push({ cond: not(c), out: { type: 'OUT', address: v } });
      else driven.push({ cond: c, out: { type: storage === 'set' ? 'SET' : storage === 'reset' ? 'RST' : 'OUT', address: v } });
    } else if (kind === 'block') {
      const type = (n.attrs.typeName ?? '').toUpperCase();
      const inst = n.attrs.instanceName ?? '';
      const ins = new Map(kids(kid(n, 'inputVariables'), 'variable').map((v) => [v.attrs.formalParameter.toUpperCase(), v]));
      const inCond = (p: string) => into(kid(ins.get(p), 'connectionPointIn'));
      const inVal = (p: string): string | null => {
        const conn = kids(kid(ins.get(p), 'connectionPointIn'), 'connection')[0];
        const src = conn ? nodes.get(conn.attrs.refLocalId) : undefined;
        if (!src || local(src) !== 'inVariable') return null;
        const e = varOf(src);
        const ms = /^(T|TIME)#/i.test(e) ? timeMs(e) : null;
        return ms !== null ? String(ms) : e;
      };
      /** Output variables wired from this block's output `p`. */
      const outVars = (p: string) => order.filter((x) => local(x) === 'outVariable' && kids(kid(x, 'connectionPointIn'), 'connection').some((c) => c.attrs.refLocalId === n.attrs.localId && (c.attrs.formalParameter ?? '').toUpperCase() === p)).map(varOf);
      if (type === 'TON' || type === 'TOF') {
        const pt = inVal('PT') ?? '0';
        const p = /^\d+$/.test(pt) ? msPreset(pt) : { preset: pt, unit: 'ms' as const };
        driven.push({ cond: inCond('IN'), out: { type: 'TMR', address: inst, mode: type === 'TOF' ? 'OFF_DELAY' : 'ON_DELAY', preset: p.preset, unit: p.unit, accumulate: false, resetAddress: null } });
      } else if (type === 'CTU' || type === 'CTD') {
        const r = ins.get(type === 'CTU' ? 'R' : 'LD');
        const conn = kids(kid(r, 'connectionPointIn'), 'connection')[0];
        const rsrc = conn ? nodes.get(conn.attrs.refLocalId) : undefined;
        const rv = rsrc && local(rsrc) === 'inVariable' ? varOf(rsrc) : null;
        driven.push({ cond: inCond(type === 'CTU' ? 'CU' : 'CD'), out: { type: 'CNT', address: inst, direction: type === 'CTD' ? 'DOWN' : 'UP', preset: inVal('PV') ?? '0', resetAddress: rv } });
        if (r && !rv) driven.push({ cond: inCond(type === 'CTU' ? 'R' : 'LD'), out: { type: 'RST', address: inst } });
      } else if (type === 'MOVE') {
        const src = inVal('IN');
        for (const d of outVars('OUT')) if (src) driven.push({ cond: inCond('EN'), out: { type: 'COPY', source: src, dest: d } });
      } else if (['ADD', 'SUB', 'MUL', 'DIV'].includes(type)) {
        const a = inVal('IN1'), b = inVal('IN2');
        const op = ({ ADD: '+', SUB: '-', MUL: '*', DIV: '/' } as const)[type as 'ADD'];
        for (const d of outVars('OUT')) if (a && b) driven.push({ cond: inCond('EN'), out: { type: 'MATH', dest: d, expression: `${a} ${op} ${b}` } });
      } else if (!['R_TRIG', 'F_TRIG', 'GT', 'GE', 'EQ', 'NE', 'LE', 'LT'].includes(type)) {
        // A call the ladder can't draw (a user function, a library block): kept as the call statement, in place.
        const params = [...ins.entries()].filter(([p]) => p !== 'EN').map(([p, node]) => {
          const v = inVal(p);
          return v === null ? null : `${node.attrs.formalParameter} := ${v}`;
        });
        if (params.some((x) => x === null)) { untranslated.push(`${n.attrs.typeName} block${inst ? ` ${inst}` : ''}: not converted (an input is wired from logic)`); continue; }
        const q = (s: string) => (vendor === 'siemens-s7' ? `"${s}"` : s);
        const outs = order.filter((x) => local(x) === 'outVariable' && kids(kid(x, 'connectionPointIn'), 'connection').some((c) => c.attrs.refLocalId === n.attrs.localId)).map((x) => ({ v: varOf(x), p: (kids(kid(x, 'connectionPointIn'), 'connection')[0].attrs.formalParameter ?? '').toUpperCase() }));
        const ret = outs.find((o) => !o.p || o.p === 'OUT' || o.p === 'RET_VAL' || o.p === n.attrs.typeName?.toUpperCase());
        const outArgs = outs.filter((o) => o !== ret).map((o) => `${o.p} => ${o.v}`);
        const calleeName = n.attrs.typeName ?? type;
        const callee = inst ? q(inst) : q(calleeName);
        const text = `${ret ? `${ret.v} := ` : ''}${callee}(${[...params, ...outArgs].join(', ')});`;
        driven.push({ cond: ins.has('EN') ? inCond('EN') : TRUE, out: { type: 'RAW', vendor, text } });
      }
    }
  }
  return driven;
}

export function readPlcopen(src: string): ForeignProgram {
  const doc = parseXml(src);
  const project = doc.children.find((c) => local(c) === 'project');
  if (!project) throw new Error('This is not a PLCopen XML file (no <project>).');
  const header = kid(project, 'fileHeader');
  const content = kid(project, 'contentHeader');
  const tags: ForeignTag[] = [];
  // Global variables of the configuration / resource (the I/O usually lives here).
  for (const g of all(kid(project, 'instances'), 'globalVars')) tags.push(...variables(g));
  const routines: ForeignRoutine[] = [];
  const notes: string[] = [];
  const pous = all(kid(project, 'types'), 'pou');
  for (const pou of pous) {
    const iface = kid(pou, 'interface');
    const local_ = variables(iface);
    for (const v of local_) if (!tags.some((t) => t.name.toLowerCase() === v.name.toLowerCase())) tags.push(v);
  }
  const types = new Map(tags.map((t) => [t.name.toLowerCase(), t.rawType || t.dataType]));
  const siemens = /siemens|tia portal/i.test(`${header?.attrs.companyName ?? ''} ${header?.attrs.productName ?? ''}`);
  const vendor = siemens ? 'siemens-s7' : /codesys|3s-smart/i.test(header?.attrs.companyName ?? '') ? 'codesys' : 'iec';
  for (const pou of pous) {
    const name = pou.attrs.name;
    const type = pou.attrs.pouType ?? 'program';
    const body = kid(pou, 'body');
    const lang = body?.children[0];
    const routine: ForeignRoutine = { name, language: 'other', rungs: [], untranslated: [] };
    if (type === 'function') notes.push(`Function ${name}: kept as written (the ladder has no functions); its calls are kept in place.`);
    if (!lang) { routines.push({ ...routine, untranslated: ['Empty body'] }); continue; }
    switch (local(lang)) {
      case 'ST': {
        routine.language = 'st';
        const code = textOf(lang);
        const st = convertSt(code, slug(name), { types });
        // A function (the ladder model has none), or Siemens code with statements the converter can't draw
        // (it goes back to the S7 as written): the whole POU kept as written.
        if (type === 'function' || (siemens && st.untranslated.length)) {
          routine.rungs = [blockRung(pouSource(pou, code, siemens), name, vendor)];
          break;
        }
        routine.rungs = st.rungs;
        routine.untranslated = st.untranslated;
        break;
      }
      case 'LD': {
        routine.language = 'ladder';
        const driven = ldBody(lang, routine.untranslated, vendor);
        const { rungs, failed } = toRungs(driven, '', slug(name));
        routine.rungs = rungs.map((r, i) => ({ ...r, id: `${slug(name)}_ld${i + 1}` }));
        for (const f of failed) routine.untranslated.push(`${f.out.type} ${'address' in f.out ? f.out.address : ''}: condition too complex`);
        break;
      }
      default:
        routine.language = local(lang) === 'FBD' ? 'fbd' : local(lang) === 'SFC' ? 'sfc' : local(lang) === 'IL' ? 'il' : 'other';
        routine.untranslated.push(`${local(lang)} body of ${name}: not converted (ST and LD are read).`);
    }
    routines.push(routine);
  }
  return {
    format: 'plcopen', vendor: [header?.attrs.companyName, header?.attrs.productName].filter(Boolean).join(' ') || 'IEC 61131-3',
    controller: header?.attrs.productName ?? '', projectName: content?.attrs.name ?? header?.attrs.contentDescription ?? 'Imported project',
    tags, routines, notes,
  };
}
