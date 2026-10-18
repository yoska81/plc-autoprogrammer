/**
 * A printout of a ladder program (PDF from the PLC software's Print, or photos / screenshots of the screen),
 * read by the AI: every printed rung is transcribed into the app's ladder model with the program's own
 * names, the page it is on and how sure the AI is. The user reviews the reading (ui/PrintoutReview.tsx)
 * before it is used; rungs that were hard to read become questions on the Machine description page.
 * Instructions the ladder model has no form for are kept as printed (RAW).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { callClaude } from '../../lib/ai/anthropic';
import { RUNG_SCHEMA } from '../core/schema';
import type { Effort } from '../../store/useSettingsStore';
import type { CompareOp, LadderElement, LadderOutput, Rung, TimeUnit } from '../core/ladder';
import type { ForeignProgram, ForeignTag } from './types';
import { slug } from './l5x';

export type ReadConfidence = 'high' | 'medium' | 'low';

export interface PrintoutRung extends Rung {
  /** Rung number as printed. */
  number: string;
  /** Page of the printout (1-based, across the files in order). */
  page: number;
  confidence: ReadConfidence;
  /** What was hard to read (empty when sure). */
  doubt: string;
}

export interface PrintoutReading {
  plc: { maker: string; model: string; profileId: string };
  projectName: string;
  tags: { name: string; address: string; description: string; io: 'input' | 'output' | 'internal'; analog: boolean }[];
  routines: { name: string; rungs: PrintoutRung[] }[];
  notes: string[];
}

const str = { type: 'string' } as const;
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const rungProps = (RUNG_SCHEMA as { properties: Record<string, unknown> }).properties;

export const PRINTOUT_SCHEMA = obj({
  plc: obj({ maker: str, model: str, profileId: { type: 'string', enum: ['click', 'logix', 'micro800', 'siemens-s7', 'unitronics-vision', 'unitronics-unistream', 'mitsubishi-fx', 'other'] } }),
  projectName: str,
  tags: { type: 'array', items: obj({ name: str, address: str, description: str, io: { type: 'string', enum: ['input', 'output', 'internal'] }, analog: { type: 'boolean' } }) },
  routines: {
    type: 'array',
    items: obj({
      name: str,
      rungs: {
        type: 'array',
        items: obj({
          number: str, page: { type: 'integer' }, comment: str,
          branches: rungProps.branches, outputs: rungProps.outputs,
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, doubt: str,
        }),
      },
    }),
  },
  notes: { type: 'array', items: str },
});

export const PRINTOUT_SYSTEM = `You read printouts of PLC ladder programs (PDF prints from the PLC software, screenshots, photos of a screen) and transcribe them rung by rung, exactly as printed. You never invent logic.

- Every printed rung becomes one rung, in printed order, in the routine / program block it is printed under. "number": the rung number as printed; "page": the page (1-based, counting all attached files in order) it is on; "comment": the rung comment as printed ("" if none).
- Operands: write each one exactly as printed — the tag name when the printout shows names (Start_PB), else the address (X001, I:1/0, %I0.0, Local:1:I.Data.0). Use the same spelling every time.
- Rung logic: "branches" is the OR of series paths (each path an AND of elements): expand parallel branches into paths. Contacts: NO (XIC, -| |-), NC (XIO, -|/|-), RISE / FALL (one-shot / edge contacts). Compares (EQU, GRT, LES, NEQ, GEQ, LEQ, compare boxes): CMP with left, op, right. Outputs: OUT (OTE, -( )-), SET (OTL, latch, (S)), RST (OTU, unlatch, (R), RES on a timer / counter), TMR (TON / TOF / RTO / timer boxes: preset and its unit as printed, e.g. 5 sec or 500 ms), CNT (CTU / CTD), COPY (MOV), MATH (CPT / ADD / math boxes, as a formula).
- Any instruction you cannot express with those (MSG, PID, JSR, function blocks, shift registers, …): a RAW element or output with "text" = the instruction exactly as printed and "vendor" = the PLC's profileId. Never drop an instruction.
- "confidence": high = every symbol and operand clearly readable; medium = small doubt; low = part of the rung is unreadable or ambiguous. "doubt": say exactly what is unclear ("" when high). Never guess silently: an unreadable operand is written as "?" with confidence low.
- "tags": every operand the printout names, with its address and description when shown (cross reference, nickname / symbol tables, address comments under contacts). "io": input / output for physical I/O points (CLICK X / Y, Logix Local:…:I / :O or I: / O:, S7 %I / %Q, Mitsubishi X / Y), else internal. "analog": true for analog channels.
- "plc": maker and model as printed; "profileId": the matching family (click, logix for ControlLogix / CompactLogix / RSLogix 5000, micro800, siemens-s7, mitsubishi-fx, unitronics-…), else "other".
- "notes": anything the engineer should know (missing pages, pages cut off, rungs continued on another page).`;

/** Ask the AI to read one batch of pages (images, page numbers counted across the whole printout). */
export async function readPrintoutPages(opts: {
  apiKey: string; model: string; effort: Effort; signal?: AbortSignal;
  pages: { number: number; file: string; data: string }[]; total: number; note: string;
}): Promise<{ reading: PrintoutReading; reasoning: string | null }> {
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const p of opts.pages) {
    content.push({ type: 'text', text: `Page ${p.number} of ${opts.total} (${p.file}):` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.data } });
  }
  const first = opts.pages[0]?.number ?? 1, last = opts.pages[opts.pages.length - 1]?.number ?? first;
  content.push({ type: 'text', text: `${opts.note ? `Notes from the engineer:\n${opts.note}\n\n` : ''}Transcribe every rung on pages ${first}–${last} of this ladder program. Use the page numbers given above.${first > 1 ? ' Earlier pages are read separately: a rung continued from the previous page starts at the top of the first page here.' : ''}` });
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, task: 'import',
    system: PRINTOUT_SYSTEM, messages: [{ role: 'user', content }], schema: PRINTOUT_SCHEMA,
  });
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (err) { throw new Error('The AI returned a reading the app could not use. Please try again.', { cause: err }); }
  return { reading: normalizeReading(raw), reasoning };
}

/** Batches of pages read one after the other, as one reading (routines continued across batches joined). */
export function mergeReadings(parts: PrintoutReading[]): PrintoutReading {
  const out: PrintoutReading = { plc: parts.find((p) => p.plc.maker || p.plc.model)?.plc ?? { maker: '', model: '', profileId: 'other' }, projectName: parts.find((p) => p.projectName)?.projectName ?? '', tags: [], routines: [], notes: [] };
  const tagNames = new Set<string>();
  for (const p of parts) {
    for (const t of p.tags) if (!tagNames.has(t.name.toLowerCase())) { tagNames.add(t.name.toLowerCase()); out.tags.push(t); }
    for (const r of p.routines) {
      const last = out.routines[out.routines.length - 1];
      if (last && last.name === r.name) last.rungs.push(...r.rungs);
      else out.routines.push({ name: r.name, rungs: [...r.rungs] });
    }
    out.notes.push(...p.notes);
  }
  return normalizeReading(out);
}

const ELEMENT_TYPES = ['NO', 'NC', 'RISE', 'FALL'];
const OUTPUT_COILS = ['OUT', 'SET', 'RST'];
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const strOr = (x: unknown, d = '') => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : d);

/**
 * A reading the app can rely on: every rung with the shape the ladder model needs (a malformed element or
 * output is replaced by "?" and makes the rung "hard to read"), unique ids, page numbers ≥ 1.
 */
export function normalizeReading(input: unknown): PrintoutReading {
  const r = isObj(input) ? input : {};
  const plc = isObj(r.plc) ? r.plc : {};
  const seen = new Set<string>();
  const routines = (Array.isArray(r.routines) ? r.routines : []).filter(isObj).map((rt, ri) => {
    const name = strOr(rt.name) || (ri ? `Part ${ri + 1}` : 'Main');
    const rungs = (Array.isArray(rt.rungs) ? rt.rungs : []).filter(isObj).map((g, i): PrintoutRung => {
      const doubts: string[] = [strOr(g.doubt)].filter(Boolean);
      const fixEl = (e: unknown): LadderElement => {
        if (isObj(e) && e.type === 'CMP') return { type: 'CMP', left: strOr(e.left, '?') || '?', op: (['==', '<>', '>', '>=', '<', '<='].includes(strOr(e.op)) ? e.op : '==') as CompareOp, right: strOr(e.right, '?') || '?' };
        if (isObj(e) && e.type === 'RAW' && strOr(e.text)) return { type: 'RAW', vendor: strOr(e.vendor, 'other'), text: strOr(e.text) };
        if (isObj(e) && ELEMENT_TYPES.includes(strOr(e.type)) && strOr(e.address)) return { type: e.type as 'NO', address: strOr(e.address) };
        doubts.push('a contact could not be read');
        return { type: 'NO', address: '?' };
      };
      const fixOut = (o: unknown): LadderOutput | null => {
        if (!isObj(o)) return null;
        const t = strOr(o.type), a = strOr(o.address);
        if (OUTPUT_COILS.includes(t) && a) return { type: t as 'OUT', address: a };
        if (t === 'TMR' && a) return { type: 'TMR', address: a, mode: o.mode === 'OFF_DELAY' ? 'OFF_DELAY' : 'ON_DELAY', preset: strOr(o.preset, '?') || '?', unit: (['ms', 'sec', 'min', 'hour', 'day'].includes(strOr(o.unit)) ? o.unit : 'sec') as TimeUnit, accumulate: o.accumulate === true, resetAddress: strOr(o.resetAddress) || null };
        if (t === 'CNT' && a) return { type: 'CNT', address: a, direction: o.direction === 'DOWN' ? 'DOWN' : 'UP', preset: strOr(o.preset, '?') || '?', resetAddress: strOr(o.resetAddress) || null };
        if (t === 'COPY' && strOr(o.dest)) return { type: 'COPY', source: strOr(o.source, '?') || '?', dest: strOr(o.dest) };
        if (t === 'MATH' && strOr(o.dest)) return { type: 'MATH', dest: strOr(o.dest), expression: strOr(o.expression, '?') || '?' };
        if (t === 'RAW' && strOr(o.text)) return { type: 'RAW', vendor: strOr(o.vendor, 'other'), text: strOr(o.text) };
        return null;
      };
      const branches = (Array.isArray(g.branches) ? g.branches : []).map((b) => (Array.isArray(b) ? b.map(fixEl) : [fixEl(b)]));
      const rawOuts = Array.isArray(g.outputs) ? g.outputs : [];
      const outputs = rawOuts.map(fixOut).filter((o): o is LadderOutput => o !== null);
      if (outputs.length < rawOuts.length || !outputs.length) doubts.push(outputs.length ? 'an output could not be read' : 'no output could be read');
      const number = strOr(g.number) || String(i);
      let id = `${slug(name)}_${number.replace(/\D/g, '') || i}`;
      while (seen.has(id)) id += '_';
      seen.add(id);
      const page = Math.max(1, Math.round(Number(g.page)) || 1);
      const fixed = doubts.length > (strOr(g.doubt) ? 1 : 0);
      const conf: ReadConfidence = fixed ? 'low' : (['high', 'medium', 'low'].includes(strOr(g.confidence)) ? g.confidence : 'low') as ReadConfidence;
      return { id, number, page, comment: strOr(g.comment), branches, outputs, confidence: conf, doubt: [...new Set(doubts)].join('; ') };
    });
    return { name, rungs };
  });
  const tags = (Array.isArray(r.tags) ? r.tags : []).filter(isObj).filter((t) => strOr(t.name) || strOr(t.address)).map((t) => ({
    name: strOr(t.name) || strOr(t.address), address: strOr(t.address), description: strOr(t.description),
    io: (['input', 'output'].includes(strOr(t.io)) ? t.io : 'internal') as 'input' | 'output' | 'internal', analog: t.analog === true,
  }));
  return {
    plc: { maker: strOr(plc.maker), model: strOr(plc.model), profileId: strOr(plc.profileId, 'other') },
    projectName: strOr(r.projectName), tags, routines,
    notes: (Array.isArray(r.notes) ? r.notes : []).map((n) => strOr(n)).filter(Boolean),
  };
}

/** Physical I/O from an address as printed (CLICK X001 / Y001, PLC-5/SLC I:1/0 / O:2/3, Logix Local:1:I…, IEC %I / %Q, Mitsubishi X0 / Y0). */
export function ioOfAddress(a: string): 'input' | 'output' | null {
  const s = a.trim();
  // Siemens also without "%" (I0.0, IW96) and in German (E0.0 / A0.0, EW / AW).
  if (/^X\d+$/i.test(s) || /^I:\d/i.test(s) || /:\d+:I\b/i.test(s) || /^%I[XBWD]?\d/i.test(s) || /^[IE]\d+\.[0-7]$/i.test(s) || /^[IE][BWD]\d+$/i.test(s)) return 'input';
  if (/^Y\d+$/i.test(s) || /^O:\d/i.test(s) || /:\d+:O\b/i.test(s) || /^%Q[XBWD]?\d/i.test(s) || /^[QA]\d+\.[0-7]$/i.test(s) || /^[QA][BWD]\d+$/i.test(s)) return 'output';
  return null;
}

/** The reviewed reading as a program of the PLC it was printed from (the shared converter takes it from here). */
export function printoutToForeign(r: PrintoutReading): ForeignProgram {
  const tags: ForeignTag[] = r.tags.map((t) => {
    const io = t.io !== 'internal' ? t.io : ioOfAddress(t.address) ?? ioOfAddress(t.name);
    return {
      name: t.name || t.address, dataType: t.analog ? 'INT' : 'BOOL', comment: t.description,
      ...(t.address ? { address: t.address } : {}), ...(io ? { io } : {}), ...(t.analog ? { analog: true } : {}),
    };
  });
  const known = new Set(tags.map((t) => t.name.toLowerCase()));
  const notes = [...r.notes];
  for (const rt of r.routines) {
    for (const g of rt.rungs) {
      // Operands: "?" (unreadable) or a name the printout's tag list doesn't have are asked about, whatever the confidence.
      const ops = [...g.branches.flat(), ...g.outputs].flatMap((x) => (x.type === 'CMP' ? [x.left, x.right] : x.type === 'RAW' ? [] : 'address' in x ? [x.address] : 'dest' in x ? [x.dest] : []));
      const unknown = [...new Set(ops.filter((o) => o.includes('?') || (!/^-?[\d.]+$/.test(o) && tags.length > 0 && !known.has(o.toLowerCase()) && !ioOfAddress(o) && !/^[A-Z]{1,3}\d+$/.test(o))))];
      // Printed addresses that are physical I/O are I/O, also without a tag list.
      for (const o of ops) {
        const io = ioOfAddress(o);
        if (io && !known.has(o.toLowerCase())) { tags.push({ name: o, dataType: 'BOOL', comment: '', address: o, io }); known.add(o.toLowerCase()); }
      }
      const why = [g.confidence === 'low' ? g.doubt || 'part of it was unclear' : '', unknown.length ? `${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not in the printout's tag list or unreadable` : ''].filter(Boolean).join('; ');
      if (why) notes.push(`Hard to read: rung ${g.number} on page ${g.page} (${rt.name}): ${why}.`);
    }
  }
  return {
    format: 'printout', vendor: r.plc.maker || 'Printout', controller: r.plc.model, projectName: r.projectName || 'Program from printout',
    tags,
    routines: r.routines.map((rt) => ({
      name: rt.name || 'Main', language: 'ladder', untranslated: [],
      rungs: rt.rungs.map(({ id, comment, branches, outputs }) => ({ id, comment, branches, outputs })),
    })),
    notes,
  };
}
