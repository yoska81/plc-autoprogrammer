/**
 * The AI electrical engineer: judgment on top of the rules. It reads the project summary (with the
 * rule findings) and raises what a panel engineer would, on the electrical design only, naming the
 * device tag so the finding points at the drawing.
 */
import { callClaude } from '../lib/ai/anthropic';
import { projectSummary } from '../review/reviewAI';
import { approxTokens, INPUT_TOKENS } from '../lib/ai/budget';
import type { ProjectSnapshot } from '../deliverables/collect';
import type { Effort } from '../store/useSettingsStore';
import type { ReviewArea, Severity } from '../review/types';
import { drawingRefs, type EngineerFinding } from './checks';
import { getPart } from '../electrical/catalog';

const SEVERITIES: Severity[] = ['critical', 'major', 'minor', 'info'];
const AREAS: ReviewArea[] = ['electrical', 'safety', 'equipment'];
const str = { type: 'string' } as const;
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['summary', 'findings'],
  properties: {
    summary: str,
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['severity', 'area', 'topic', 'title', 'explanation', 'fix', 'tag', 'replaceWith'],
        properties: {
          severity: { type: 'string', enum: SEVERITIES },
          area: { type: 'string', enum: AREAS },
          topic: { type: 'string', enum: ['code', 'wire sizing', 'voltage drop', 'SCCR', 'heat', 'spare I/O', 'space', 'selectivity', 'safety', 'labelling', 'maintainability', 'obsolete parts', 'other'] },
          title: str, explanation: str, fix: str,
          tag: str,
          replaceWith: str,
        },
      },
    },
  },
} as const;

const SYSTEM = `You are a senior electrical engineer checking a machine control panel design before it is ordered and built (UL 508A / NFPA 79 / NEC in the US; CSA / CEC in Canada; IEC 60204-1 / IEC 61439 / ISO 13849-1 elsewhere: use the region given).
Check: code compliance; wire sizing and voltage drop; SCCR and its weakest part; heat load and ventilation; spare I/O and panel space; selectivity of the protective devices; safety performance level / category gaps; labelling (nameplate, warning labels, wire and device marking); maintainability (fuses vs breakers, test points, access); obsolete or hard-to-get parts.
The rule-based findings are listed at the end: do not repeat them unless you add something new.
Rules:
- Base every finding on the data given; quote the device tag, part number or value. Never invent parts or values.
- "tag": the device tag it concerns (as on the drawings), or "".
- "replaceWith": a catalog part number that fixes it by a simple swap only when one appears in the data you were given, else "".
- severity: critical = can hurt someone or damage equipment; major = cannot be approved / will not work; minor = should be improved; info = note.
- explanation: plain English, 2-4 sentences; fix: specific enough to do. 3-15 findings is typical. summary: 2-3 sentences.`;

export async function runEngineerAI(opts: { apiKey: string; model: string; effort: Effort; signal?: AbortSignal }, p: ProjectSnapshot, rules: EngineerFinding[]): Promise<{ summary: string; findings: EngineerFinding[] }> {
  // The electrical review needs the program's outline only when the whole listing is too big for one request.
  const whole = projectSummary(p, rules, { specTask: 'engineer' });
  const content = approxTokens(whole) <= INPUT_TOKENS ? whole : projectSummary(p, rules, { outline: true, specTask: 'engineer' });
  const r = await callClaude({ ...opts, system: SYSTEM, schema: SCHEMA, messages: [{ role: 'user', content }] });
  let parsed: { summary: string; findings: { severity: Severity; area: ReviewArea; topic: string; title: string; explanation: string; fix: string; tag: string; replaceWith: string }[] };
  try { parsed = JSON.parse(r.text); } catch (err) { throw new Error('The engineer review returned an answer the app could not read. Please try again.', { cause: err }); }
  const ref = p.drawingCtx ? drawingRefs(p.drawingCtx) : () => '';
  const pnOf = (tag: string) => p.electrical?.components.find((c) => c.tag === tag)?.partNumber;
  return {
    summary: parsed.summary,
    findings: parsed.findings.map((f) => {
      const from = f.tag ? pnOf(f.tag) : undefined;
      // A swap is offered only between two real catalog parts.
      const swap = from && f.replaceWith && getPart(f.replaceWith) && getPart(from) ? { label: `Use ${f.replaceWith}`, kind: 'swap' as const, from, to: f.replaceWith } : undefined;
      return {
        id: `eng-ai:${f.topic}:${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`,
        source: 'ai' as const, severity: SEVERITIES.includes(f.severity) ? f.severity : 'minor', area: AREAS.includes(f.area) ? f.area : 'electrical',
        title: f.title, detail: f.explanation, fix: f.fix, page: 'electrical' as const, item: f.tag,
        ...(f.tag ? { ref: ref([f.tag]) } : {}), ...(swap ? { oneClick: swap } : {}),
      };
    }),
  };
}
