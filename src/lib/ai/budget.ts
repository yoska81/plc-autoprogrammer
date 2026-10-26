import type { LadderProgram, Rung } from '../../plc/core/ladder';
import { rungAddresses, rungWrites } from '../../plc/core/ladder';

/**
 * How much the AI is given in one request. A model reads about 200,000 tokens and writes at most 64,000
 * (anthropic.ts max_tokens); a big imported program (thousands of rungs) is far more than that, so the steps
 * that send the program check its size first and send it in parts (or ask for a smaller part).
 */

/** Tokens of a text this many characters long. */
export const tokensOfLength = (chars: number) => Math.ceil(chars / 3.5);
/** About how many tokens a text is (program listings and JSON run near 3.5 characters a token). */
export const approxTokens = (text: string) => tokensOfLength(text.length);

/** Most tokens the app's own part of a request may take (the rest is the system prompt and the answer). */
export const INPUT_TOKENS = 120_000;

/** Most tokens of program JSON the AI can be asked to write back (well under the 64,000-token answer). */
export const PROGRAM_OUT_TOKENS = 40_000;

/** The program with only these rungs, the blocks they are in and the tags they use. */
export function programSlice(program: LadderProgram, rungs: Rung[]): LadderProgram {
  const used = new Set(rungs.flatMap((r) => [...rungAddresses(r), ...rungWrites(r)]).map((a) => a.toUpperCase()));
  const blocks = new Set(rungs.map((r) => r.block));
  return {
    ...program,
    rungs,
    tags: program.tags.filter((t) => used.has(t.address.toUpperCase())),
    ...(program.blocks ? { blocks: program.blocks.filter((b) => blocks.has(b.id)) } : {}),
  };
}

/**
 * The program's rungs in parts, in program order: whole blocks together while the summed `cost` of a part stays
 * under `max`; a block that costs more than that is split by rungs (a single rung always goes).
 */
export function programParts(program: LadderProgram, cost: (r: Rung) => number, max: number): Rung[][] {
  const parts: Rung[][] = [];
  let cur: Rung[] = [], curCost = 0;
  const flush = () => { if (cur.length) parts.push(cur); cur = []; curCost = 0; };
  let i = 0;
  while (i < program.rungs.length) {
    // one run of rungs of the same block
    let j = i, runCost = 0;
    while (j < program.rungs.length && program.rungs[j].block === program.rungs[i].block) runCost += cost(program.rungs[j++]);
    const run = program.rungs.slice(i, j);
    i = j;
    if (curCost + runCost <= max) { cur.push(...run); curCost += runCost; continue; }
    flush();
    if (runCost <= max) { cur = [...run]; curCost = runCost; continue; }
    for (const r of run) {
      const c = cost(r);
      if (cur.length && curCost + c > max) flush();
      cur.push(r); curCost += c;
    }
  }
  flush();
  return parts;
}
