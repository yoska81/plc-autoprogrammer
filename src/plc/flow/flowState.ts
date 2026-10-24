/**
 * What the diagram shows from the machine's values (the simulator's last scan, or values read from the real PLC):
 * the step each sequence is in (green), the arrow it leaves by, what that step waits for (amber, with the
 * conditions still OFF named), and red where it is stuck (longer in the step than its timeout, or than a limit).
 * The rungs elsewhere: green when true. Read only: nothing here writes to the PLC.
 */
import type { LadderElement, LadderProgram } from '../core/ladder';
import type { RungPower } from '../sim/engine';
import { conditionText, type FlowMap, type NameOf } from './flowModel';

export type NodeState = 'active' | 'true' | 'false' | 'waiting' | 'broken';

export interface FlowState {
  nodes: Map<string, NodeState>;
  /** Edges drawn as moving (the step's way out, a true rung's YES). */
  edges: Set<string>;
  /** Why a node is waiting or red, in plain words. */
  why: Map<string, string>;
  /** Each sequence's current step (diagram id → step value). */
  steps: Map<string, number>;
}

/** When each sequence entered its current step (diagram id → { step, since ms }): kept by the caller between reads. */
export type StepClock = Map<string, { step: number; since: number }>;

const norm = (a: string) => a.trim().toUpperCase();

/**
 * The diagram's state. `power`: each rung's power flow (rungPowerFromValues for the real PLC, the simulator's
 * own); `words`: register values; `now`: ms (the simulator's time or the clock); `clock`: updated in place.
 * `stuckSec`: red after this long in one step when the step has no timeout of its own (default 30 s).
 */
export function flowState(map: FlowMap, program: LadderProgram, power: Map<string, RungPower>, words: Map<string, number>,
  now: number, clock: StepClock, nameOf: NameOf, opts: { stuckSec?: number; timeouts?: Map<string, number> } = {}): FlowState {
  const nodes = new Map<string, NodeState>(), edges = new Set<string>(), why = new Map<string, string>(), steps = new Map<string, number>();
  const rungs = new Map(program.rungs.map((r) => [r.id, r]));
  for (const d of map.diagrams) {
    const reg = d.register;
    const cur = reg ? words.get(norm(reg)) : undefined;
    if (reg && cur !== undefined) {
      steps.set(d.id, cur);
      const c = clock.get(d.id);
      if (!c || c.step !== cur) clock.set(d.id, { step: cur, since: now });
    }
    const since = clock.get(d.id)?.since ?? now;
    const inStepSec = (now - since) / 1000;
    for (const n of d.nodes) {
      if (n.kind === 'step') {
        nodes.set(n.id, n.step === cur ? 'active' : 'false');
        continue;
      }
      const p = n.rungIds.map((id) => power.get(id));
      const isTrue = p.some((x) => x?.rungTrue);
      if (n.kind === 'decision' && reg && n.id.startsWith(`${d.id}:dec:`)) {
        // a step's way out: waiting while its step is active and the rung is not yet true
        const from = Number(n.id.split(':')[2]);
        if (from !== cur) { nodes.set(n.id, 'false'); continue; }
        if (isTrue) { nodes.set(n.id, 'true'); edges.add(`${n.id}:yes`); continue; }
        const rung = rungs.get(n.rungIds[0]);
        const off = rung ? offConditions(rung.branches, p[0], reg, nameOf) : [];
        const limit = opts.timeouts?.get(`${d.id}:${from}`) ?? opts.stuckSec ?? 30;
        const stuck = inStepSec > limit;
        nodes.set(n.id, stuck ? 'broken' : 'waiting');
        edges.add(`${n.id}:in`);
        why.set(n.id, `${stuck ? 'Stuck' : 'Waiting'} ${inStepSec.toFixed(1)} s in step ${from}${off.length ? ` for: ${off.join(', ')}` : ''}${stuck ? ` (more than ${limit} s)` : ''}`);
        continue;
      }
      nodes.set(n.id, isTrue ? 'true' : 'false');
      if (isTrue && n.kind === 'decision') edges.add(`${n.id.replace(':if:', ':then:')}:yes`);
    }
    // a red way out makes its step red too: the place where the machine stopped
    for (const n of d.nodes) {
      if (n.kind === 'step' && n.step === cur && d.nodes.some((x) => x.id.startsWith(`${d.id}:dec:${cur}:`) && nodes.get(x.id) === 'broken')) {
        nodes.set(n.id, 'broken');
        why.set(n.id, `The machine stopped in this step: ${[...why.entries()].find(([k]) => k.startsWith(`${d.id}:dec:${cur}:`))?.[1] ?? ''}`);
      }
    }
  }
  return { nodes, edges, why, steps };
}

/** The conditions of a rung not met now (each branch's first open one, the step compare left out), in plain words. */
export function offConditions(branches: LadderElement[][], p: RungPower | undefined, reg: string | undefined, nameOf: NameOf): string[] {
  const out: string[] = [];
  branches.forEach((br, b) => {
    br.forEach((el, i) => {
      if (reg && el.type === 'CMP' && norm(el.left) === norm(reg)) return;
      if (!(p?.closed[b]?.[i] ?? false)) out.push(conditionText(el, nameOf));
    });
  });
  return [...new Set(out)].slice(0, 4);
}
