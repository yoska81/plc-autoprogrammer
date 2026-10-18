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
import type { Rung } from '../core/ladder';
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

/** Ask the AI to read the printout (PDF / image content blocks, in order). */
export async function readPrintout(opts: {
  apiKey: string; model: string; effort: Effort; signal?: AbortSignal;
  blocks: Anthropic.Beta.Messages.BetaContentBlockParam[]; names: string[]; note: string;
}): Promise<{ reading: PrintoutReading; reasoning: string | null }> {
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    ...opts.blocks,
    { type: 'text', text: `Files (in the order attached):\n${opts.names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n${opts.note ? `Notes from the engineer:\n${opts.note}\n\n` : ''}Transcribe every rung of this ladder program.` },
  ];
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, task: 'import',
    system: PRINTOUT_SYSTEM, messages: [{ role: 'user', content }], schema: PRINTOUT_SCHEMA,
  });
  try {
    return { reading: normalizeReading(JSON.parse(text) as PrintoutReading), reasoning };
  } catch (err) {
    throw new Error('The AI returned a reading the app could not use. Please try again.', { cause: err });
  }
}

/** Ids for the rungs (routine + printed number), trimmed operands. */
export function normalizeReading(r: PrintoutReading): PrintoutReading {
  const seen = new Set<string>();
  return {
    ...r,
    routines: r.routines.map((rt) => ({
      ...rt,
      rungs: rt.rungs.map((g, i) => {
        let id = `${slug(rt.name || 'main')}_${String(g.number || i).replace(/\D/g, '') || i}`;
        while (seen.has(id)) id += '_';
        seen.add(id);
        return { ...g, id, comment: g.comment ?? '', doubt: g.doubt ?? '' };
      }),
    })),
  };
}

/** The reviewed reading as a program of the PLC it was printed from (the shared converter takes it from here). */
export function printoutToForeign(r: PrintoutReading): ForeignProgram {
  const tags: ForeignTag[] = r.tags.map((t) => ({
    name: t.name || t.address, dataType: t.analog ? 'INT' : 'BOOL', comment: t.description,
    ...(t.address ? { address: t.address } : {}),
    ...(t.io !== 'internal' ? { io: t.io } : {}), ...(t.analog ? { analog: true } : {}),
  }));
  const notes = [...r.notes];
  for (const rt of r.routines) {
    for (const g of rt.rungs) {
      if (g.confidence === 'low') notes.push(`Hard to read: rung ${g.number} on page ${g.page} (${rt.name})${g.doubt ? `: ${g.doubt}` : ''}.`);
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
