/**
 * AI design review: a senior controls engineer reads a compact summary of the
 * whole project (plus the deterministic findings) and raises what a checker
 * would raise. Structured output; findings link back to the app's pages.
 */
import { byRegion, regionSpec } from '../standards/regions';
import type { ProjectSnapshot } from '../deliverables/collect';
import { billOfMaterials, wireNumbers } from '../electrical/derive';
import { calculations } from '../deliverables/docs/calcs';
import { clickRungListing } from '../plc/core/clickExport';
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

/** Compact, readable text of the whole project for the reviewer. */
export function projectSummary(p: ProjectSnapshot, deterministic: Finding[]): string {
  const parts: string[] = [];
  parts.push(`# Project: ${p.projectName}\nRegion: ${byRegion(p.info.region, 'US (NFPA 79, UL 508A, NEC)', 'Canada (CSA C22.2 No. 14, CEC)', `${regionSpec(p.info.region).label} (${regionSpec(p.info.region).codes.short})`)} · Standards: ${(p.info.standards ?? []).join(', ') || '—'}`);
  parts.push(`# Specification\n${specToText(p.spec) || '(empty)'}`);
  const wiring = new Map((p.electrical?.ioWiring ?? []).map((w) => [w.address.toUpperCase(), w]));
  parts.push(`# I/O list (address, type, category, description, field device)\n${p.io.map((pt) => {
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
  if (p.profile.language === 'ladder' && p.ladder.rungs.length) {
    const blocks = (p.ladder.blocks ?? []).map((b) => `${b.id} = ${b.name}`).join(', ');
    parts.push(`# PLC program (${p.ladder.rungs.length} rungs${blocks ? `; blocks: ${blocks}` : ''}; rung ids listed after the rungs)\n${clickRungListing(p.ladder, p.labels, '')}\nRung ids in order: ${p.ladder.rungs.map((r, i) => `${i + 1}=${r.id}`).join(', ')}`);
  } else if (p.stCode) parts.push(`# PLC program (Structured Text)\n${p.stCode}`);
  else parts.push('# PLC program\n(none yet)');
  if (p.hmi) {
    parts.push(`# HMI ${p.hmi.hmiPartNumber}: screens ${p.hmi.screens.map((s) => `${s.id} "${s.name}"`).join(', ')}\nTags:\n${p.hmi.tags.map((t) => `${t.address}\t${t.access}\t${t.name}: ${t.description}`).join('\n')}\nAlarms:\n${p.hmi.alarms.map((a) => `${a.address}\t${a.severity}\t${a.message}`).join('\n') || '(none)'}`);
  } else parts.push('# HMI\n(none)');
  parts.push(`# Deterministic findings already reported (do not repeat)\n${deterministic.map((f) => `- [${f.severity}] ${f.title}`).join('\n') || '(none)'}`);
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

/** Ask Claude for the review. AI findings get ids from their content, so a mark carries over when a re-run raises the same finding. */
export async function runAiReview(ai: AIConfig, p: ProjectSnapshot, deterministic: Finding[]): Promise<AiReview> {
  const messages = [{ role: 'user' as const, content: projectSummary(p, deterministic) }];
  const text = ai.provider === 'anthropic'
    ? (await callClaude({ ...ai, system: SYSTEM, messages, schema: REVIEW_SCHEMA })).text
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
