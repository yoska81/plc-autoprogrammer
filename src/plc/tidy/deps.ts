/**
 * What each rung reads and writes, and the order the scan needs: a rung that writes an address stays before the rungs
 * after it that read or write it, and after the ones before it that read or write it (read-before-write in the same
 * scan is behaviour). Rungs with an instruction the simulator cannot run (RAW) are barriers: nothing moves across.
 */
import { elementAddresses, type LadderOutput, type Rung } from '../core/ladder';

export interface RungDeps { reads: Set<string>; writes: Set<string>; barrier: boolean }

const norm = (a: string) => a.trim().toUpperCase();
const isAddress = (a: string) => /^[A-Z_][A-Z0-9_.[\]:]*$/i.test(a.trim()) && !/^-?\d/.test(a.trim());

/** What one output reads and writes (a timer writes its done bit and its time, a counter its done bit and its count). */
function outputDeps(o: LadderOutput, reads: Set<string>, writes: Set<string>) {
  const r = (a?: string | null) => { if (a && isAddress(a)) reads.add(norm(a)); };
  const w = (a: string) => writes.add(norm(a));
  switch (o.type) {
    case 'OUT': case 'SET': case 'RST': {
      w(o.address);
      const t = /^(T|CT)(\d+)$/i.exec(o.address.trim());
      if (o.type === 'RST' && t) w(`${t[1].toUpperCase() === 'T' ? 'TD' : 'CTD'}${t[2]}`);
      // A coil keeps its own value when the rung is false only for SET / RST: OUT always writes.
      break;
    }
    case 'TMR': { const n = o.address.trim().slice(1); w(o.address); w(`TD${n}`); r(o.preset); r(o.resetAddress); reads.add(norm(`TD${n}`)); break; }
    case 'CNT': { const n = o.address.trim().slice(2); w(o.address); w(`CTD${n}`); r(o.preset); r(o.resetAddress); reads.add(norm(`CTD${n}`)); break; }
    case 'COPY': r(o.source); w(o.dest); break;
    case 'MATH': for (const tok of o.expression.match(/[A-Za-z]+\d+/g) ?? []) r(tok); w(o.dest); break;
    case 'RAW': break;
  }
}

/** Indexed or indirect addressing (DS[DS1], an @pointer): what it touches is known only at run time. */
const INDIRECT = /[[\]@]|\bINDEX\b/i;

/**
 * Conservative on purpose: an edge contact (one-shot) keeps state of its address, and every operand of an output
 * instruction (SET / RESET, timer and counter instances, moves and math) counts as read and written. Indexed or
 * indirect addressing and kept instructions of another PLC (jumps, loops, calls are among them) are barriers.
 */
export function rungDeps(r: Rung): RungDeps {
  const reads = new Set<string>(), writes = new Set<string>();
  let barrier = false;
  for (const b of r.branches) for (const el of b) {
    if (el.type === 'RAW') barrier = true;
    for (const a of elementAddresses(el)) {
      if (INDIRECT.test(a)) barrier = true;
      if (!isAddress(a)) continue;
      reads.add(norm(a));
      if (el.type === 'RISE' || el.type === 'FALL') writes.add(norm(a));
    }
  }
  for (const o of r.outputs) {
    if (o.type === 'RAW') { barrier = true; continue; }
    const rr = new Set<string>(), ww = new Set<string>();
    outputDeps(o, rr, ww);
    for (const a of [...rr, ...ww]) { if (INDIRECT.test(a)) barrier = true; reads.add(a); writes.add(a); }
  }
  return { reads, writes, barrier };
}

/**
 * The rungs in a new order that keeps every dependency: Kahn's algorithm, taking among the rungs free to go next
 * the one with the smallest `key` (then the original order). With equal keys the order does not change.
 */
export function reorder(rungs: Rung[], key: (r: Rung, i: number) => number): Rung[] {
  const n = rungs.length;
  const deps = rungs.map(rungDeps);
  const after = Array.from({ length: n }, () => new Set<number>());
  const edge = (i: number, j: number) => { if (i !== j) after[i].add(j); };
  // Per address: each write stays after the reads and the write before it, and before the reads and the write after it.
  const lastWrite = new Map<string, number>();
  const readsSince = new Map<string, number[]>();
  let lastBarrier = -1;
  const sinceBarrier: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = deps[i];
    if (d.barrier) { for (const k of sinceBarrier) edge(k, i); if (lastBarrier >= 0) edge(lastBarrier, i); lastBarrier = i; sinceBarrier.length = 0; }
    else { if (lastBarrier >= 0) edge(lastBarrier, i); sinceBarrier.push(i); }
    for (const a of d.reads) {
      const w = lastWrite.get(a);
      if (w !== undefined) edge(w, i);
      (readsSince.get(a) ?? readsSince.set(a, []).get(a)!).push(i);
    }
    for (const a of d.writes) {
      const w = lastWrite.get(a);
      if (w !== undefined) edge(w, i);
      for (const k of readsSince.get(a) ?? []) edge(k, i);
      readsSince.set(a, d.reads.has(a) ? [i] : []);
      lastWrite.set(a, i);
    }
  }
  const indeg = new Array<number>(n).fill(0);
  for (const s of after) for (const j of s) indeg[j]++;
  const keys = rungs.map((r, i) => key(r, i));
  const ready: number[] = [];
  for (let i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
  const better = (a: number, b: number) => keys[a] - keys[b] || a - b;
  const out: Rung[] = [];
  while (ready.length) {
    let best = 0;
    for (let k = 1; k < ready.length; k++) if (better(ready[k], ready[best]) < 0) best = k;
    const i = ready.splice(best, 1)[0];
    out.push(rungs[i]);
    for (const j of after[i]) if (--indeg[j] === 0) ready.push(j);
  }
  return out.length === n ? out : rungs;
}
