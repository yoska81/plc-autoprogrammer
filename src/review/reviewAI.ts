/**
 * AI design review: a senior controls engineer reads a compact summary of the
 * whole project (plus the deterministic findings) and raises what a checker
 * would raise. Structured output; findings link back to the app's pages.
 */
import { operatorDevices } from '../deliverables/docs/operatorStation';
import { byRegion, regionSpec } from '../standards/regions';
import type { ProjectSnapshot } from '../deliverables/collect';
import { billOfMaterials, wireNumbers } from '../electrical/derive';
import { calculations } from '../deliverables/docs/calcs';
import { clickRungListing } from '../plc/core/clickExport';
import { rungAddresses, rungWrites, type Rung } from '../plc/core/ladder';
import { approxTokens, INPUT_TOKENS, programParts, programSlice } from '../lib/ai/budget';
import { specToText } from '../spec/types';
import { callClaude } from '../lib/ai/anthropic';
import { callOpenAI } from '../lib/ai/openai';
import type { AIConfig } from '../plc/ai/ladderAI';
import type { Finding, ReviewArea, ReviewPage, Severity } from './types';

const AREAS: ReviewArea[] = ['project', 'spec', 'equipment', 'io', 'electrical', 'safety', 'hmi', 'program'];
const PAGES: ReviewPage[] = ['project', 'spec', 'equipment', 'io', 'electrical', 'hmi', 'program', 'simulate'];
const SEVERITIES: Severity[] = ['critical', 'major', 'minor', 'info'];

const str = { type: 'string' } as const;
export const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings'],
  properties: {
    summary: str,
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'area', 'title', 'explanation', 'fix', 'page', 'item'],
        properties: {
          severity: { type: 'string', enum: SEVERITIES },
          area: { type: 'string', enum: AREAS },
          title: str,
          explanation: str,
          fix: str,
          page: { type: 'string', enum: PAGES },
          item: str,
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the senior controls engineer who checks a machine control design before anything is ordered or built. You review the whole project — specification, I/O list, equipment, control panel (bill of materials, wiring, calculations), PLC program and HMI — the way an experienced checker at an engineering firm would, and you write findings the project owner (who is not an engineer) can act on.

Look for, in this order of importance:
1. Safety: stop categories (NFPA 79 9.2.2 / IEC 60204-1), E-stop and safety relay wiring, reset behaviour (manual reset, no automatic restart after a stop or power return), every motion output gated by the safety status, guards/interlocks the machine needs but does not have, stored energy (air, gravity) on a stop.
2. Sequence gaps: states the specification describes that the program does not handle, steps that wait for a signal without a timeout, missing stop/abort paths, what happens on Stop in the middle of a cycle.
3. Failure modes: a sensor that fails ON or OFF, loss of air, loss of power and the restart afterwards, a motor overload trip, communications loss to the HMI — is each detected, alarmed and safe?
4. Missing alarms and operator information: faults without an alarm, alarms without a reset, unclear alarm texts.
5. Maintainability: manual mode for maintenance, diagnostics, documentation, spare I/O, labelling.
6. Code compliance for the region given (US: NFPA 79, UL 508A, NEC; Canada: CSA C22.2 No. 14, CEC; Europe / Israel / other IEC countries: IEC 60204-1, IEC 61439, EN ISO 13849-1 or IEC 62061, CE/UKCA where it applies): disconnect / main switch, branch protection, SCCR or Icc, wire sizing (AWG or mm²) and colours, enclosure rating (NEMA or IP).

Rules:
- Base every finding on the project data you are given. Quote the address, rung, device tag or spec sentence it is about. Do not invent equipment that is not in the data.
- Do not repeat the deterministic findings listed at the end unless you add something new about them.
- The specification's "Questions and answers" hold what the customer already answered and the "Design review decision" entries what was already resolved or accepted: never raise those again in other words, and never ask the customer to confirm an answer already given.
- Severity: critical = can hurt someone or damage the machine; major = the machine will not work as specified or the design cannot be approved; minor = should be improved; info = note for the record.
- "explanation": plain English, what is wrong and why it matters (2–4 sentences). "fix": what to change, specific enough to do.
- "page" and "item": where to fix it in the app — page is one of project, spec, equipment, io, electrical, hmi, program, simulate; item is the rung id, address, device tag or HMI screen id it concerns ("" if none).
- If the design is sound in an area, say nothing about it; 5–20 findings is typical. "summary": 2–3 sentences overall verdict.`;

/**
 * Which part of a big program a summary covers: `rungs` lists only those rungs (with the I/O they use and a
 * `note` on top); `outline` lists no rungs, only the program's size and blocks.
 */
export interface SummaryScope { rungs?: Rung[]; outline?: boolean; note?: string }

/** Most deterministic findings listed (a big imported program can have thousands of checker messages). */
const MAX_DETERMINISTIC = 150;

/** Compact, readable text of the whole project (or of one part of its program) for the reviewer. */
export function projectSummary(p: ProjectSnapshot, deterministic: Finding[], scope: SummaryScope = {}): string {
  const parts: string[] = [];
  if (scope.note) parts.push(scope.note);
  parts.push(`# Project: ${p.projectName}\nRegion: ${byRegion(p.info.region, 'US (NFPA 79, UL 508A, NEC)', 'Canada (CSA C22.2 No. 14, CEC)', `${regionSpec(p.info.region).label} (${regionSpec(p.info.region).codes.short})`)} · Standards: ${(p.info.standards ?? []).join(', ') || '—'}`);
  parts.push(`# Specification\n${specToText(p.spec) || '(empty)'}`);
  const wiring = new Map((p.electrical?.ioWiring ?? []).map((w) => [w.address.toUpperCase(), w]));
  // A part of the program comes with the I/O it uses.
  const usedByPart = scope.rungs && new Set(scope.rungs.flatMap((r) => [...rungAddresses(r), ...rungWrites(r)]).map((a) => a.toUpperCase()));
  const io = usedByPart ? p.io.filter((pt) => usedByPart.has((p.addresses.get(pt.id) ?? '').toUpperCase())) : p.io;
  parts.push(`# I/O list (address, type, category, description, field device)${usedByPart ? ` — only the ${io.length} points this part of the program uses (${p.io.length} in all)` : ''}\n${io.map((pt) => {
    const a = p.addresses.get(pt.id) ?? '';
    const w = wiring.get(a.toUpperCase());
    return `${a || '(unassigned)'}\t${pt.type}\t${pt.category}\t${pt.description}${w ? `\t${w.deviceTag} ${w.deviceType} @ ${w.location}` : ''}`;
  }).join('\n') || '(none)'}`);
  parts.push(`# Equipment\nPLC: ${p.profile.vendor} ${p.profile.name} ${p.cpu.label}${p.equipment?.modules.length ? `; modules: ${p.equipment.modules.join(', ')}` : ''}${p.hmi ? `; HMI: ${p.hmi.hmiPartNumber}` : ''}`);
  if (p.drawingCtx && p.electrical) {
    const bom = billOfMaterials(p.drawingCtx).flatMap((g) => g.lines.map((l) => `${l.qty} × ${l.partNumber || '(select)'} ${l.description} [${l.tags.join(', ')}]`));
    parts.push(`# Control panel\nSupply ${p.electrical.inputs.supply}, enclosure ${p.electrical.inputs.enclosureRating}. Motors: ${p.electrical.inputs.motors.map((m) => `${m.tag} ${m.hp} HP ${m.voltage} ${m.starter}${m.reversing ? ' reversing' : ''}`).join('; ') || 'none'}.\nBill of materials:\n${bom.join('\n')}`);
    const safetyWires = wireNumbers(p.drawingCtx).filter((w) => /^S\d|24\+S|safety|e-?stop/i.test(`${w.wire} ${w.function}`));
    if (safetyWires.length) parts.push(`Safety circuit wiring:\n${safetyWires.map((w) => `${w.wire}: ${w.from} → ${w.to} (${w.function})`).join('\n')}`);
    const calcs = calculations(p);
    parts.push(`Calculations:\n${calcs.map((c) => `${c.title}: ${c.result} ${c.ok ? '(OK)' : '(CHECK)'}`).join('\n')}`);
    if (p.electrical.notes.length) parts.push(`Designer notes:\n${p.electrical.notes.map((n) => `- ${n}`).join('\n')}`);
  } else parts.push('# Control panel\n(no electrical design yet)');
  if (p.profile.language === 'ladder' && p.ladder.rungs.length && scope.outline) {
    const blocks = (p.ladder.blocks ?? []).map((b) => b.name);
    parts.push(`# PLC program\n${p.ladder.rungs.length} rungs in ${blocks.length} blocks${blocks.length ? ` (${blocks.slice(0, 40).join(', ')}${blocks.length > 40 ? `, and ${blocks.length - 40} more` : ''})` : ''}. The rungs are too many to list here; the design review reads them in parts.`);
  } else if (p.profile.language === 'ladder' && p.ladder.rungs.length) {
    const shown = scope.rungs ? programSlice(p.ladder, scope.rungs) : p.ladder;
    const number = new Map(p.ladder.rungs.map((r, i) => [r.id, i + 1]));
    const blocks = (shown.blocks ?? []).map((b) => `${b.id} = ${b.name}`).join(', ');
    const which = scope.rungs ? `${shown.rungs.length} of the program's ${p.ladder.rungs.length} rungs (numbers ${number.get(shown.rungs[0]?.id) ?? 0}–${number.get(shown.rungs[shown.rungs.length - 1]?.id) ?? 0})` : `${p.ladder.rungs.length} rungs`;
    parts.push(`# PLC program (${which}${blocks ? `; blocks: ${blocks}` : ''}; rung ids listed after the rungs)\n${clickRungListing(shown, p.labels, '')}\nRung ids in order: ${shown.rungs.map((r) => `${number.get(r.id)}=${r.id}`).join(', ')}`);
  } else if (p.stCode) parts.push(`# PLC program (Structured Text)\n${p.stCode}`);
  else parts.push('# PLC program\n(none yet)');
  if (p.hmi) {
    parts.push(`# HMI ${p.hmi.hmiPartNumber}: screens ${p.hmi.screens.map((s) => `${s.id} "${s.name}"`).join(', ')}\nTags:\n${p.hmi.tags.map((t) => `${t.address}\t${t.access}\t${t.name}: ${t.description}`).join('\n')}\nAlarms:\n${p.hmi.alarms.map((a) => `${a.address}\t${a.severity}\t${a.message}`).join('\n') || '(none)'}`);
  } else if (p.noHmi) {
    const devices = operatorDevices(p);
    parts.push(`# Operator interface\nNo touch panel, by the customer's choice: the operator uses pushbuttons, selector switches and lamps (operator station). Do not report the missing HMI. Do check that every operator command the program needs (start, stop, reset, mode) has a physical device, and that faults are shown on a lamp.\nOperator station:\n${devices.map((d) => `${d.tag}\t${d.kind}\t${d.description}\t${d.location}\t${d.address || '-'}`).join('\n') || '(no devices in the electrical design yet)'}`);
  } else parts.push('# HMI\n(none)');
  const listed = deterministic.slice(0, MAX_DETERMINISTIC).map((f) => `- [${f.severity}] ${f.title}`);
  if (deterministic.length > MAX_DETERMINISTIC) listed.push(`- … and ${deterministic.length - MAX_DETERMINISTIC} more`);
  parts.push(`# Deterministic findings already reported (do not repeat)\n${listed.join('\n') || '(none)'}`);
  return parts.join('\n\n');
}

export interface AiReview { summary: string; findings: Finding[] }

function uniqueIds(list: Finding[]): Finding[] {
  const seen = new Map<string, number>();
  return list.map((f) => {
    const n = (seen.get(f.id) ?? 0) + 1;
    seen.set(f.id, n);
    return n > 1 ? { ...f, id: `${f.id}-${n}` } : f;
  });
}

/** Most parts of a big program the AI reads in one review (each is a full request). */
export const MAX_REVIEW_PARTS = 6;

/**
 * Ask Claude for the review. AI findings get ids from their content, so a mark carries over when a re-run raises
 * the same finding. A program too big for one request is reviewed in parts (whole blocks together, each part
 * with the I/O it uses), at most MAX_REVIEW_PARTS of them; the summary says so.
 */
export async function runAiReview(ai: AIConfig, p: ProjectSnapshot, deterministic: Finding[]): Promise<AiReview> {
  const whole = projectSummary(p, deterministic);
  if (approxTokens(whole) <= INPUT_TOKENS || p.profile.language !== 'ladder' || !p.ladder.rungs.length) return reviewOnce(ai, whole);
  // Each rung costs about its listing plus the I/O lines it brings; the listing is measured once against the rung data.
  const base = approxTokens(projectSummary(p, deterministic, { rungs: [], note: PART_NOTE(1, 1, '') }));
  const perChar = clickRungListing(p.ladder, p.labels, '').length / Math.max(1, JSON.stringify(p.ladder.rungs).length);
  const cost = (r: Rung) => 1.4 * approxTokens(JSON.stringify(r)) * perChar;
  const queue = programParts(p.ladder, cost, Math.max(10_000, INPUT_TOKENS - base));
  // The estimate does not see how long the I/O lines a part brings are: a part measured over the budget is halved.
  const fits = (rungs: Rung[]) => approxTokens(projectSummary(p, deterministic, { rungs, note: PART_NOTE(1, 1, '') })) <= INPUT_TOKENS;
  const read: Rung[][] = [];
  while (queue.length && read.length < MAX_REVIEW_PARTS) {
    const rungs = queue.shift()!;
    if (rungs.length > 1 && !fits(rungs)) { const h = rungs.length >> 1; queue.unshift(rungs.slice(0, h), rungs.slice(h)); continue; }
    read.push(rungs);
  }
  const total = read.length + queue.length;
  const number = new Map(p.ladder.rungs.map((r, i) => [r.id, i + 1]));
  const span = (rs: Rung[]) => `rungs ${number.get(rs[0].id)}–${number.get(rs[rs.length - 1].id)}`;
  const results: AiReview[] = [];
  for (const [k, rungs] of read.entries()) {
    results.push(await reviewOnce(ai, projectSummary(p, deterministic, { rungs, note: PART_NOTE(k + 1, total, span(rungs)) })));
  }
  const left = queue.flat();
  return {
    summary: [
      `The program (${p.ladder.rungs.length} rungs) is too big to review in one request: the AI read it in ${total} part${total === 1 ? '' : 's'}${left.length ? `, the first ${read.length} of them (${span(read.flat())}); rungs ${number.get(left[0].id)}–${p.ladder.rungs.length} were checked by the rule checks only` : ''}.`,
      ...results.map((r, k) => `Part ${k + 1} (${span(read[k])}): ${r.summary}`),
    ].join('\n'),
    findings: uniqueIds(results.flatMap((r) => r.findings)),
  };
}

const PART_NOTE = (k: number, n: number, span: string) =>
  `This is part ${k} of ${n} of a big program (${span}), reviewed one part at a time: review this part with the rest of the project. Rungs of other parts are not shown, so do not report an address as unused or never written only because this part does not use it.`;

async function reviewOnce(ai: AIConfig, content: string): Promise<AiReview> {
  const messages = [{ role: 'user' as const, content }];
  const text = ai.provider === 'anthropic'
    ? (await callClaude({ ...ai, task: 'review', system: SYSTEM, messages, schema: REVIEW_SCHEMA })).text
    : await callOpenAI({ ...ai, system: SYSTEM, messages, schema: REVIEW_SCHEMA });
  let parsed: { summary: string; findings: { severity: Severity; area: ReviewArea; title: string; explanation: string; fix: string; page: ReviewPage; item: string }[] };
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('The AI returned a review the app could not read. Please try again.', { cause: err }); }
  return {
    summary: parsed.summary,
    findings: uniqueIds(parsed.findings.map((f) => ({
      id: `ai:${f.area}:${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
      source: 'ai' as const,
      severity: SEVERITIES.includes(f.severity) ? f.severity : 'minor',
      area: AREAS.includes(f.area) ? f.area : 'project',
      title: f.title, detail: f.explanation, fix: f.fix,
      page: PAGES.includes(f.page) ? f.page : 'project',
      item: f.item ?? '',
    }))),
  };
}
