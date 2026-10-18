/**
 * Siemens TIA Portal block exported with Openness (XML): Document › SW.Blocks.FB / FC / OB › ObjectList ›
 * SW.Blocks.CompileUnit (one per network) › NetworkSource › FlgNet with Parts (Access = an operand,
 * Part = an instruction) and Wires (Powerrail / NameCon UId+pin / IdentCon UId). LAD networks are walked
 * back from every coil and box into rung conditions:
 *   Contact (Negated), PContact / NContact and P_TRIG-style edges, Coil, SCoil, RCoil, TON / TOF / TP /
 *   TONR (instance), CTU / CTD, Eq / Ne / Gt / Ge / Lt / Le compare boxes, Move.
 * A network with any other instruction is kept as a pointer to the original network (RAW 'siemens-lad');
 * SCL / STL / FBD networks, FB / FC calls and box pins wired to tags or to logic are kept the same way.
 * The block interface (Sections › Member) gives the block's own variables; the PLC tag table gives the I/O.
 */
import { all, kid, kids, local, parseXml, textOf, type XNode } from './xml';
import { and, el, not, or, toRungs, TRUE, FALSE, type Cond, type Driven } from './cond';
import { slug } from './l5x';
import { iecIo } from './plcopen';
import { timeMs } from './st';
import { msPreset } from './logixText';
import type { CompareOp, LadderOutput } from '../core/ladder';
import type { ForeignProgram, ForeignRoutine, ForeignTag, ForeignType } from './types';

export const isTiaXml = (text: string) => /<Document>[\s\S]*<SW\.Blocks\.(FB|FC|OB)\b/i.test(text.slice(0, 20000));

const CMP: Record<string, CompareOp> = { Eq: '==', Ne: '<>', Gt: '>', Ge: '>=', Lt: '<', Le: '<=' };

const WIDTH: Record<string, string> = {
  BOOL: 'X', BYTE: 'B', CHAR: 'B', SINT: 'B', USINT: 'B',
  WORD: 'W', INT: 'W', UINT: 'W', S5TIME: 'W', DATE: 'W',
  DWORD: 'D', DINT: 'D', UDINT: 'D', REAL: 'D', TIME: 'D', TOD: 'D', TIME_OF_DAY: 'D',
  LWORD: 'L', LINT: 'L', ULINT: 'L', LREAL: 'L',
};

/** An Access part → operand text: "Motor".Run → Motor.Run, #Local → Local, constants as values. */
function accessText(a: XNode): string {
  const scope = a.attrs.Scope ?? '';
  if (/Constant/i.test(scope)) {
    const v = textOf(kid(kid(a, 'Constant'), 'ConstantValue')).trim();
    const ms = /^(T|TIME|S5T)#/i.test(v) ? timeMs(v.replace(/^S5T#/i, 'T#')) : null;
    return ms !== null ? String(ms) : v;
  }
  if (/Address/i.test(scope)) {
    // Absolute address: the area, the width of its type and the byte (and bit), in the tag table's form
    // (%IX0.0, %MX10.1, %MD20). A type of unknown width keeps the network whole.
    const ad = kid(a, 'Address');
    const pre = { INPUT: '%I', OUTPUT: '%Q', MEMORY: '%M' }[(ad?.attrs.Area ?? '').toUpperCase()];
    const width = WIDTH[(ad?.attrs.Type ?? '').toUpperCase()];
    const off = Number(ad?.attrs.BitOffset);
    if (!pre || !width || !Number.isInteger(off)) return '';
    return width === 'X' ? `${pre}X${Math.floor(off / 8)}.${off % 8}` : `${pre}${width}${Math.floor(off / 8)}`;
  }
  const sym = kid(a, 'Symbol');
  return kids(sym, 'Component').map((c) => c.attrs.Name).join('.');
}

/** What drives an input pin: the power rail, an operand (Access), or output pins of other parts (OR'ed). */
type Feed = { kind: 'rail' } | { kind: 'operand'; uid: string } | { kind: 'pins'; from: { uid: string; pin: string }[] };
const OUT_PINS = /^(out\d*|Q|QU|QD|eno|ENO|ET|CV)$/;
interface Net { parts: Map<string, XNode>; access: Map<string, string>; feeds: Map<string, Feed> }

/** Wires → for each input pin (uid:pin), what drives it; operand pins → the operand text. */
function netOf(flg: XNode): Net {
  const parts = new Map<string, XNode>(), access = new Map<string, string>();
  for (const p of kid(flg, 'Parts')?.children ?? []) {
    if (!p.name) continue;
    if (local(p) === 'Access') access.set(p.attrs.UId, accessText(p));
    else parts.set(p.attrs.UId, p); // Part, Call (FB / FC), anything else
  }
  const feeds = new Map<string, Feed>();
  for (const w of kids(kid(flg, 'Wires'), 'Wire')) {
    const cons = w.children.filter((c) => c.name);
    const rail = cons.some((c) => local(c) === 'Powerrail');
    const ident = cons.find((c) => local(c) === 'IdentCon');
    const names = cons.filter((c) => local(c) === 'NameCon');
    if (ident) { for (const n of names) feeds.set(`${n.attrs.UId}:${n.attrs.Name}`, { kind: 'operand', uid: ident.attrs.UId }); continue; }
    const from = names.filter((n) => OUT_PINS.test(n.attrs.Name)).map((n) => ({ uid: n.attrs.UId, pin: n.attrs.Name }));
    for (const t of names.filter((n) => !OUT_PINS.test(n.attrs.Name))) feeds.set(`${t.attrs.UId}:${t.attrs.Name}`, rail ? { kind: 'rail' } : { kind: 'pins', from });
  }
  return { parts, access, feeds };
}

/** One LAD network → outputs with conditions; null = something the ladder can't hold (kept whole). */
export function ladNetwork(flg: XNode): { driven: Driven[]; unknown: string[] } {
  const net = netOf(flg);
  const driven: Driven[] = [];
  const unknown: string[] = [];
  const partName = (p: XNode) => (local(p) === 'Part' ? p.attrs.Name : local(p) === 'Call' ? `call ${kid(p, 'CallInfo')?.attrs.Name ?? ''}`.trim() : local(p));
  // The tag on a pin. A pin driven by logic, or an address it can't read, keeps the network whole;
  // an optional pin (a counter's reset) may be left open.
  const operand = (uid: string, pin: string, optional = false): string => {
    const f = net.feeds.get(`${uid}:${pin}`);
    const t = f?.kind === 'operand' ? net.access.get(f.uid) : undefined;
    if (t) return t;
    if (f || !optional) unknown.push(`${partName(net.parts.get(uid)!)} ${pin} ${f && f.kind !== 'operand' ? 'from logic' : 'not read'}`);
    return '?';
  };
  const instance = (p: XNode) => {
    const ci = kid(p, 'Instance');
    return ci ? kids(ci, 'Component').map((c) => c.attrs.Name).join('.') : p.attrs.UId;
  };
  const memo = new Map<string, Cond>();
  const pinCond = (uid: string, pin: string, depth = 0): Cond => {
    if (depth > 60) return FALSE;
    const f = net.feeds.get(`${uid}:${pin}`);
    if (!f || f.kind === 'operand') return FALSE;
    if (f.kind === 'rail') return TRUE;
    return or(...f.from.map((s) => outCond(s.uid, s.pin, depth + 1)));
  };
  const outCond = (uid: string, pin: string, depth: number): Cond => {
    const key = `${uid}:${pin}`;
    const hit = memo.get(key);
    if (hit) return hit;
    const p = net.parts.get(uid);
    let c: Cond = FALSE;
    if (p) {
      const name = partName(p);
      const neg = kids(p, 'Negated').some((n) => n.attrs.Name === 'operand');
      if (name === 'Contact') c = and(pinCond(uid, 'in', depth), el({ type: neg ? 'NC' : 'NO', address: operand(uid, 'operand') }));
      else if (name === 'PContact' || name === 'NContact') c = and(pinCond(uid, 'in', depth), el({ type: name === 'PContact' ? 'RISE' : 'FALL', address: operand(uid, 'operand') }));
      else if (/^(TON|TOF|TP|TONR)$/.test(name) && pin === 'Q') c = el({ type: 'NO', address: `${instance(p)}.Q` });
      else if (/^(CTU|CTD)$/.test(name) && pin === 'Q') c = el({ type: 'NO', address: `${instance(p)}.Q` });
      else if (CMP[name] && pin === 'out') {
        c = and(pinCond(uid, 'pre', depth), el({ type: 'CMP', left: operand(uid, 'in1'), op: CMP[name], right: operand(uid, 'in2') }));
      } else if (name === 'Coil' || name === 'SCoil' || name === 'RCoil' || name === 'Move') c = pinCond(uid, name === 'Move' ? 'en' : 'in', depth); // power flows on
      else c = FALSE;
    }
    memo.set(key, c);
    return c;
  };
  // An output pin wired to a tag (TON ET, CTU CV, Move out2, a box's Q…) writes that tag: no ladder form
  // here except Move out1.
  for (const [key, f] of net.feeds) {
    const [uid, pin] = key.split(':');
    const p = net.parts.get(uid);
    if (p && f.kind === 'operand' && OUT_PINS.test(pin) && !(partName(p) === 'Move' && pin === 'out1')) unknown.push(`${partName(p)} ${pin} to a tag`);
  }
  for (const [uid, p] of net.parts) {
    const name = partName(p);
    const neg = kids(p, 'Negated').some((n) => n.attrs.Name === 'operand');
    switch (name) {
      case 'Contact': case 'PContact': case 'NContact': break;
      case 'Coil': driven.push({ cond: neg ? not(pinCond(uid, 'in')) : pinCond(uid, 'in'), out: { type: 'OUT', address: operand(uid, 'operand') } }); break;
      case 'SCoil': driven.push({ cond: pinCond(uid, 'in'), out: { type: 'SET', address: operand(uid, 'operand') } }); break;
      case 'RCoil': driven.push({ cond: pinCond(uid, 'in'), out: { type: 'RST', address: operand(uid, 'operand') } }); break;
      case 'TON': case 'TOF': case 'TP': case 'TONR': {
        if (name === 'TP') { unknown.push('TP (pulse timer)'); break; }
        const pt = operand(uid, 'PT');
        const p2 = /^\d+$/.test(pt) ? msPreset(pt) : { preset: pt, unit: 'ms' as const };
        driven.push({ cond: pinCond(uid, 'IN'), out: { type: 'TMR', address: instance(p), mode: name === 'TOF' ? 'OFF_DELAY' : 'ON_DELAY', preset: p2.preset, unit: p2.unit, accumulate: name === 'TONR', resetAddress: name === 'TONR' ? operand(uid, 'R', true) : null } });
        break;
      }
      case 'CTU': case 'CTD': {
        const r = operand(uid, name === 'CTU' ? 'R' : 'LD', true);
        driven.push({ cond: pinCond(uid, name === 'CTU' ? 'CU' : 'CD'), out: { type: 'CNT', address: instance(p), direction: name === 'CTD' ? 'DOWN' : 'UP', preset: operand(uid, 'PV'), resetAddress: r !== '?' ? r : null } });
        break;
      }
      case 'Move': {
        const dest = operand(uid, 'out1');
        driven.push({ cond: pinCond(uid, 'en'), out: { type: 'COPY', source: operand(uid, 'in'), dest } as LadderOutput });
        break;
      }
      default:
        if (!CMP[name]) unknown.push(name);
    }
  }
  return { driven, unknown };
}

function memberType(dt: string): ForeignType {
  const u = dt.replace(/"/g, '').toUpperCase();
  if (u === 'BOOL') return 'BOOL';
  if (/^(INT|SINT|USINT|UINT|WORD|BYTE)$/.test(u)) return 'INT';
  if (/^(DINT|UDINT|DWORD|TIME)$/.test(u)) return 'DINT';
  if (/^(REAL|LREAL)$/.test(u)) return 'REAL';
  if (/^(TON|TOF|TP|TONR|TON_TIME|TOF_TIME|IEC_TIMER)$/.test(u)) return 'TIMER';
  if (/^(CTU|CTD|CTUD|CTU_INT|IEC_COUNTER)$/.test(u)) return 'COUNTER';
  return 'OTHER';
}

export function readTiaXml(input: string): ForeignProgram {
  // Windows exports are CRLF: read as LF lines.
  const src = input.replace(/\r\n?/g, '\n');
  const doc = parseXml(src);
  const tags: ForeignTag[] = [];
  const routines: ForeignRoutine[] = [];
  const notes: string[] = [];
  const blocks = all(doc, 'SW.Blocks.FB').concat(all(doc, 'SW.Blocks.FC'), all(doc, 'SW.Blocks.OB'));
  for (const b of blocks) {
    const attrs = kid(b, 'AttributeList');
    const name = textOf(kid(attrs, 'Name')).trim() || 'Block';
    for (const m of all(kid(attrs, 'Interface'), 'Member')) {
      if (all(m, 'Member').length) continue;
      tags.push({ name: m.attrs.Name, dataType: memberType(m.attrs.Datatype ?? ''), rawType: (m.attrs.Datatype ?? '').replace(/"/g, ''), comment: textOf(kid(kid(m, 'Comment'), 'MultiLanguageText')).trim() });
    }
    const routine: ForeignRoutine = { name, language: 'ladder', rungs: [], untranslated: [], rungNumbers: {} };
    kids(kid(b, 'ObjectList'), 'SW.Blocks.CompileUnit').forEach((cu, i) => {
      const al = kid(cu, 'AttributeList');
      const lang = textOf(kid(al, 'ProgrammingLanguage')).trim();
      const titleText = kids(kid(cu, 'ObjectList'), 'MultilingualText').find((m) => m.attrs.CompositionName === 'Title');
      const title = textOf(all(titleText, 'Text')[0]).trim();
      const id = `${slug(name)}_${i + 1}`;
      const flg = all(kid(al, 'NetworkSource'), 'FlgNet')[0];
      if (lang !== 'LAD' || !flg) {
        // SCL / STL / FBD network: kept in the program as a pointer to the original network.
        routine.rungs.push({ id, comment: title, branches: [], outputs: [{ type: 'RAW', vendor: 'siemens-lad', text: `${name} network ${i + 1} (${lang || 'unknown'} network): edit it in TIA Portal` }] });
        routine.rungNumbers![id] = String(i + 1);
        return;
      }
      const { driven, unknown } = ladNetwork(flg);
      const { rungs, failed } = toRungs(driven, title, id);
      if (unknown.length || failed.length) {
        const parts = [...new Set(unknown)].join(', ');
        // Not SCL text: on export it is a TODO pointing at the network in the original block.
        routine.rungs.push({ id, comment: title, branches: [], outputs: [{ type: 'RAW', vendor: 'siemens-lad', text: `${name} network ${i + 1}${parts ? ` (${parts})` : ''}: edit it in TIA Portal` }] });
        routine.rungNumbers![id] = String(i + 1);
        return;
      }
      for (const g of rungs) { routine.rungs.push(g); routine.rungNumbers![g.id] = String(i + 1); }
    });
    routines.push(routine);
  }
  // Absolute addresses with the type they are declared with (a Real at %MD20 stays Real); I / Q are I/O.
  for (const a of all(doc, 'Access')) {
    if (!/Address/i.test(a.attrs.Scope ?? '')) continue;
    const o = accessText(a), type = kid(a, 'Address')?.attrs.Type ?? '';
    if (o && !tags.some((t) => t.name === o)) tags.push({ name: o, dataType: memberType(type), rawType: type, comment: '', address: o, ...iecIo(o) });
  }
  if (!tags.some((t) => t.io)) notes.push('The block names PLC tags but not their addresses: add the PLC tag table (PLC tags › Export) to know which are inputs and outputs.');
  return { format: 'siemens-xml', vendor: 'Siemens', controller: '', projectName: routines[0]?.name ?? 'Imported block', tags, routines, notes };
}
