/**
 * Every AI request the app makes for one project, answered by a stub that records how big each request is
 * (system prompt + messages + answer schema, in characters). The project is the made-up big Yaskawa line
 * (bigYaskawa.ts), opened the way the Upgrade page opens a program. For the prompt-size tests.
 */
import { setClaudeInterceptor, type ClaudeOptions } from '../anthropic';
import { applyUpgrade } from '../../../plc/import/ui/applyUpgrade';
import { collectProject } from '../../../deliverables/collect';
import { useSpecStore } from '../../../store/useSpecStore';
import { specToText } from '../../../spec/types';
import { bigYaskawaImport, bigYaskawaSpec } from './bigYaskawa';
import { recommendEquipment } from '../equipmentAI';
import { generateIOFromSpec } from '../ioAI';
import { machineModelFromSpec } from '../machineModelAI';
import { hmiContentFromSpec, projectHmiContent } from '../hmiContentAI';
import { generateHmiDesign } from '../hmiAI';
import { generateElectricalDesign } from '../electricalAI';
import { changeScope, generateLadder, reviseLadder, type AIConfig } from '../../../plc/ai/ladderAI';
import { validateProgram } from '../../../plc/core/validate';
import { runAiReview } from '../../../review/reviewAI';
import { checksFor } from '../../../review/actions';
import { runEngineerAI } from '../../../engineer/engineerAI';
import { engineerChecksFor } from '../../../engineer/checks';
import { getHmi } from '../../../hmi/hmiCatalog';
import type { ChatTurn } from '../anthropic';
import type { DesignInputs } from '../../../electrical/types';

export interface Request { chars: number; cached: number; maxTokens?: number }
export type Measured = Record<string, Request[]>;

/** Characters of one request; `cached`: of them, the blocks marked for the prompt cache (read at a tenth of the price after the first). */
function size(o: ClaudeOptions): Request {
  const blocks = o.messages.flatMap((m) => (typeof m.content === 'string' ? [{ text: m.content, cache: false }] : (m.content as { type: string; text?: string; cache_control?: unknown }[]).map((b) => ({ text: b.text ?? JSON.stringify(b), cache: Boolean(b.cache_control) }))));
  const lastCached = blocks.map((b) => b.cache).lastIndexOf(true);
  const chars = o.system.length + blocks.reduce((n, b) => n + b.text.length, 0) + (o.schema ? JSON.stringify(o.schema).length : 0);
  const cached = lastCached < 0 ? 0 : blocks.slice(0, lastCached + 1).reduce((n, b) => n + b.text.length, 0);
  return { chars, cached, ...(o.maxTokens ? { maxTokens: o.maxTokens } : {}) };
}

/** The fix-it chat's first turn as the Program page writes it, from the machine description text. */
export type Opening = (specText: string) => ChatTurn;

export async function measureCalls(opening: Opening): Promise<Measured> {
  const imp = bigYaskawaImport();
  applyUpgrade(imp, '');
  useSpecStore.getState().setSections(bigYaskawaSpec());
  const p = collectProject();
  const out: Measured = {};
  let label = '';
  setClaudeInterceptor(async (o: ClaudeOptions) => {
    (out[label] ??= []).push(size(o));
    o.onStarted?.();
    return { text: '{"summary":"","findings":[]}', reasoning: null };
  });
  const run = async (name: string, fn: () => Promise<unknown>) => { label = name; await fn().catch(() => undefined); };
  const ai = { apiKey: 'k', model: 'm', effort: 'low' as const };
  const cfg: AIConfig = { provider: 'anthropic', ...ai };
  const specText = specToText(p.spec);
  const inputs: DesignInputs = p.electrical?.inputs ?? { supply: '480VAC-3PH', enclosureRating: 'NEMA 12', notes: '', motors: [], requiredParts: [] };
  const ctx = { profile: p.profile, cpu: p.cpu, io: p.io, addresses: p.addresses };

  await run('equipment', () => recommendEquipment({ ...ai, spec: p.spec }));
  await run('io', () => generateIOFromSpec({ ...ai, spec: p.spec, existing: p.io, profile: p.profile, cpu: p.cpu }));
  await run('machine model', () => machineModelFromSpec({ ...ai, spec: specText, io: p.io, inputs }));
  const base = projectHmiContent({ io: p.io, addresses: p.addresses, machineName: 'Line', spec: specText, panel: { partNumber: '', widthPx: 800, heightPx: 480 } });
  await run('HMI names', () => hmiContentFromSpec({ ...ai, spec: specText, base }));
  await run('full-AI HMI', () => generateHmiDesign({ ...ai, hmi: getHmi('cMT2078X')!, guidelines: '', comms: '', spec: p.spec, io: p.io, addresses: p.addresses, profile: p.profile, cpu: p.cpu }));
  await run('full-AI program', () => generateLadder(cfg, ctx, specText));
  await run('full-AI electrical', () => generateElectricalDesign({ ...ai, profile: p.profile, cpu: p.cpu, io: p.io, addresses: p.addresses, machineDescription: specText, inputs, hmiPartNumber: p.hmi?.hmiPartNumber }));
  // Fix-it on one block (a big program sends only the chosen block), as the Program page asks it.
  const ioSet = new Set([...p.addresses.values()].map((a) => a.toUpperCase()));
  const issues = validateProgram(p.ladder, p.profile, ioSet);
  for (const b of (p.ladder.blocks ?? []).slice(0, 40)) {
    const scope = changeScope(p.ladder, ctx, b.id, b.name);
    if ('tooBig' in scope) continue;
    const ids = new Set(scope.program.rungs.map((r) => r.id));
    const sent = scope.part ? issues.filter((i) => !i.rungId || ids.has(i.rungId)) : issues;
    await run('fix-it (per block)', () => reviseLadder(cfg, scope.ctx, scope.program, sent, [opening(specText)], `[Block: ${b.name} (id "${b.id}")] Add a comment to every rung.`));
  }
  await run('design review', () => runAiReview(cfg, p, checksFor(p)));
  await run('engineer review', () => runEngineerAI(ai, p, engineerChecksFor(p)));
  setClaudeInterceptor(null);
  return out;
}

/** Tokens (characters / 3.5, as budget.ts counts them). */
export const tokens = (chars: number) => Math.ceil(chars / 3.5);

/** One line per call: requests, tokens in all, the biggest request. */
export function table(m: Measured): string {
  return Object.entries(m).map(([k, rs]) => {
    const all = rs.reduce((n, r) => n + r.chars, 0);
    const sorted = rs.map((r) => r.chars).sort((a, b) => a - b);
    return `${k.padEnd(20)} ${String(rs.length).padStart(3)} req  ${String(tokens(all)).padStart(8)} tok  median ${String(tokens(sorted[sorted.length >> 1])).padStart(7)}  max ${String(tokens(sorted[sorted.length - 1])).padStart(7)}`;
  }).join('\n');
}
