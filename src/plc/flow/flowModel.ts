/**
 * The program as flow diagrams: one diagram per function (the program's blocks), every box linked to the rungs it
 * comes from, so the ladder can be shown beside it and the live values light it up.
 *
 * - A step sequence (a word the rungs compare, `DS1150 == 20`, and set, `COPY 30 → DS1150`; the app's own cycle
 *   and most imported ones) is drawn as squares (the steps, with what they turn on) and diamonds (what each step
 *   waits for), arrows from step to step and loops drawn back.
 * - Every other rung is a diamond (IF its conditions, in plain words) with its actions in a square beside it
 *   (YES →); the rungs follow each other down in scan order.
 *
 * Works on any program (the vendor-neutral ladder model): the app's own, or one imported from another PLC.
 */
import type { CompareElement, LadderElement, LadderOutput, LadderProgram, Rung } from '../core/ladder';

export type FlowNodeKind = 'step' | 'decision' | 'action' | 'any';

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  /** The box's heading: a step's name, "IF", the actions' title. */
  title: string;
  /** Plain-language lines (conditions, actions). */
  lines: string[];
  /** The rungs it comes from (the ladder shown beside it, the live values that light it). */
  rungIds: string[];
  /** A step's value in its register (steps only). */
  step?: number;
  x: number; y: number; w: number; h: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** YES / NO, or none. */
  label?: string;
  /** The polyline, in the diagram's coordinates. */
  points: [number, number][];
  /** A transition that goes back up (a loop). */
  back?: boolean;
}

export interface FlowDiagram {
  /** The block id ("" for rungs without one). */
  id: string;
  name: string;
  description: string;
  /** The step register, when the function is a step sequence. */
  register?: string;
  rungCount: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Placement on the whole map, and size. */
  x: number; y: number; w: number; h: number;
}

export interface FlowMap {
  diagrams: FlowDiagram[];
  w: number;
  h: number;
}

/** The readable name of an address: its label (I/O description, tag nickname), else the address. */
export type NameOf = (address: string) => string;

const isConst = (a: string) => /^-?\d+(\.\d+)?$/.test(a.trim());
const norm = (a: string) => a.trim().toUpperCase();
const MAX_LINE = 34;
const clip = (s: string, n = MAX_LINE) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One input element in plain words ("Start button ON", "NOT Stop", "Count ≥ 10"). */
export function conditionText(el: LadderElement, nameOf: NameOf): string {
  switch (el.type) {
    case 'NO': return `${nameOf(el.address)} ON`;
    case 'NC': return `NOT ${nameOf(el.address)}`;
    case 'RISE': return `${nameOf(el.address)} turns ON`;
    case 'FALL': return `${nameOf(el.address)} turns OFF`;
    case 'CMP': return `${isConst(el.left) ? el.left : nameOf(el.left)} ${OP[el.op]} ${isConst(el.right) ? el.right : nameOf(el.right)}`;
    case 'RAW': return clip(el.text, 40);
  }
}

const OP: Record<CompareElement['op'], string> = { '==': '=', '<>': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' };
const UNIT: Record<string, string> = { ms: 'ms', sec: 's', min: 'min', hour: 'h', day: 'day' };

/** One output in plain words ("Turn ON Motor", "Timer T1: 5 s", "Machine state = 4"). */
export function actionText(o: LadderOutput, nameOf: NameOf): string {
  const v = (a: string) => (isConst(a) ? a : nameOf(a));
  switch (o.type) {
    case 'OUT': return `Turn ON ${nameOf(o.address)}`;
    case 'SET': return `Latch ON ${nameOf(o.address)}`;
    case 'RST': return `Reset OFF ${nameOf(o.address)}`;
    case 'TMR': return `${o.mode === 'OFF_DELAY' ? 'Off-delay' : 'Wait'} ${v(o.preset)} ${UNIT[o.unit] ?? o.unit} (${nameOf(o.address)})`;
    case 'CNT': return `Count ${o.direction === 'DOWN' ? 'down' : 'up'} to ${v(o.preset)} (${nameOf(o.address)})`;
    case 'COPY': return `${nameOf(o.dest)} = ${v(o.source)}`;
    case 'MATH': return `${nameOf(o.dest)} = ${o.expression}`;
    case 'RAW': return clip(o.text, 40);
  }
}

/** A rung's conditions as lines: each branch an AND (one line per condition), branches joined by OR. */
function conditionLines(branches: LadderElement[][], nameOf: NameOf, skip?: (el: LadderElement) => boolean): string[] {
  const lines: string[] = [];
  branches.forEach((br, i) => {
    const els = br.filter((el) => !skip?.(el));
    if (i > 0) lines.push('— OR —');
    if (!els.length) lines.push('always');
    els.forEach((el, k) => lines.push(clip(`${k > 0 ? 'AND ' : ''}${conditionText(el, nameOf)}`)));
  });
  return lines.length ? lines : ['always'];
}

/** A step register: a word compared with constants (`== n`) and set by COPY of constants, with two values or more. */
export function stepRegisters(rungs: Rung[]): string[] {
  const compared = new Map<string, Set<number>>(), set = new Map<string, Set<number>>();
  const add = (m: Map<string, Set<number>>, k: string, n: number) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(n); };
  for (const r of rungs) {
    for (const br of r.branches) for (const el of br) {
      if (el.type === 'CMP' && el.op === '==' && isConst(el.right) && !isConst(el.left)) add(compared, norm(el.left), Number(el.right));
    }
    for (const o of r.outputs) if (o.type === 'COPY' && isConst(o.source)) add(set, norm(o.dest), Number(o.source));
  }
  return [...set.keys()].filter((k) => (set.get(k)?.size ?? 0) >= 2 && (compared.get(k)?.size ?? 0) >= 2
    && [...set.get(k)!].filter((n) => compared.get(k)!.has(n)).length >= 2);
}

/** The step a branch is in (`REG == n`), if any. */
const stepOf = (br: LadderElement[], reg: string): number | null => {
  const el = br.find((e) => e.type === 'CMP' && e.op === '==' && norm(e.left) === reg && isConst(e.right)) as CompareElement | undefined;
  return el ? Number(el.right) : null;
};
const isStepCmp = (reg: string) => (el: LadderElement) => el.type === 'CMP' && norm(el.left) === reg;

// sizes
const STEP_W = 240, STEP_H = 64, DEC_W = 240, DEC_H = 96, ACT_W = 260, GAP = 30, LINE_H = 15;
const boxH = (lines: number, min: number) => Math.max(min, 34 + lines * LINE_H);

interface Transition { from: number | null; to: number; rung: Rung; branch: LadderElement[] }

/** The steps of one register, their transitions and the rungs that act in them. */
function sequenceOf(rungs: Rung[], reg: string) {
  const steps = new Set<number>();
  const transitions: Transition[] = [];
  const acting = new Map<number, Rung[]>();
  const used = new Set<string>();
  for (const r of rungs) {
    const dest = r.outputs.find((o) => o.type === 'COPY' && norm(o.dest) === reg && isConst(o.source));
    if (dest && dest.type === 'COPY') {
      const to = Number(dest.source);
      steps.add(to);
      for (const br of r.branches.length ? r.branches : [[]]) {
        const from = stepOf(br, reg);
        if (from !== null) steps.add(from);
        transitions.push({ from, to, rung: r, branch: br });
      }
      used.add(r.id);
      continue;
    }
    // a rung whose every branch is in a step: what that step does (request bits, step timers)
    const inSteps = r.branches.map((br) => stepOf(br, reg));
    if (r.branches.length && inSteps.every((s) => s !== null)) {
      for (const s of new Set(inSteps as number[])) { steps.add(s); acting.set(s, [...(acting.get(s) ?? []), r]); }
      used.add(r.id);
    }
  }
  return { steps: [...steps].sort((a, b) => a - b), transitions, acting, used };
}

/** A step's name from its transition's comment ("Step 20 — Clamp: done when …" → "Clamp"), else "Step 20". */
function stepName(step: number, transitions: Transition[]): string {
  for (const t of transitions) {
    if (t.from !== step) continue;
    const m = new RegExp(`^Step\\s*${step}\\s*[—:-]\\s*([^:]+?)(?::|$)`).exec(t.rung.comment.trim());
    if (m) return clip(m[1].trim(), 30);
  }
  for (const t of transitions) {
    if (t.to !== step) continue;
    const m = new RegExp(`step\\s*${step}\\s*[—:-]\\s*([^:(]+)`, 'i').exec(t.rung.comment);
    if (m) return clip(m[1].trim(), 30);
  }
  return step === 0 ? 'Idle' : `Step ${step}`;
}

/** One function's diagram, laid out from (0, 0). */
export function diagramOf(id: string, name: string, description: string, rungs: Rung[], nameOf: NameOf): FlowDiagram {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let y = 70;
  const cx = 30 + DEC_W / 2;
  const reg = stepRegisters(rungs)[0];
  let used = new Set<string>();
  let width = 30 + DEC_W + 40 + ACT_W + 30;

  if (reg) {
    const seq = sequenceOf(rungs, reg);
    used = seq.used;
    const stepNode = new Map<number, FlowNode>();
    // from any step (no `REG == n` in the branch): one box above the steps
    const fromAny = seq.transitions.filter((t) => t.from === null);
    for (const t of fromAny) {
      const lines = conditionLines([t.branch], nameOf, isStepCmp(reg));
      const h = boxH(lines.length + 1, DEC_H);
      nodes.push({ id: `${id}:any:${t.rung.id}:${t.to}`, kind: 'any', title: `From any step → ${stepName(t.to, seq.transitions)}`, lines, rungIds: [t.rung.id], x: 30, y, w: DEC_W + 40 + ACT_W, h });
      y += h + GAP;
    }
    // steps top to bottom, each followed by what it waits for
    const decisions: { t: Transition; node: FlowNode }[] = [];
    seq.steps.forEach((s, i) => {
      const acts = (seq.acting.get(s) ?? []).flatMap((r) => r.outputs.map((o) => clip(actionText(o, nameOf))));
      const lines = acts.length ? acts : ['(waits)'];
      const h = boxH(lines.length, STEP_H);
      const node: FlowNode = { id: `${id}:step:${s}`, kind: 'step', title: `${s} · ${stepName(s, seq.transitions)}`, lines, rungIds: (seq.acting.get(s) ?? []).map((r) => r.id), step: s, x: cx - STEP_W / 2, y, w: STEP_W, h };
      nodes.push(node);
      stepNode.set(s, node);
      y += h + GAP;
      const outs = seq.transitions.filter((t) => t.from === s);
      outs.forEach((t, k) => {
        const lines2 = conditionLines([t.branch], nameOf, isStepCmp(reg));
        const dh = boxH(lines2.length, DEC_H);
        const dx = k === 0 ? cx - DEC_W / 2 : 30 + DEC_W + 40 + (k - 1) * (DEC_W + 30);
        const dnode: FlowNode = { id: `${id}:dec:${s}:${k}:${t.rung.id}`, kind: 'decision', title: `→ ${t.to} · ${stepName(t.to, seq.transitions)}`, lines: lines2, rungIds: [t.rung.id], x: dx, y: k === 0 ? y : node.y, w: DEC_W, h: dh };
        nodes.push(dnode);
        decisions.push({ t, node: dnode });
        width = Math.max(width, dx + DEC_W + 30);
        edges.push({ id: `${dnode.id}:in`, from: node.id, to: dnode.id, points: k === 0 ? [[cx, node.y + node.h], [cx, dnode.y]] : [[node.x + node.w, node.y + node.h / 2], [dnode.x, dnode.y + dh / 2]] });
        if (k === 0) y += dh + GAP;
      });
      void i;
    });
    // the transitions' arrows: down to the next step, or a loop drawn back on the left (or on to a later one)
    let lane = 0;
    for (const { t, node } of decisions) {
      const target = stepNode.get(t.to);
      if (!target) continue;
      const fromBottom: [number, number] = [node.x + node.w / 2, node.y + node.h];
      const directlyBelow = target.y > node.y && Math.abs(target.x + target.w / 2 - fromBottom[0]) < 1 && !nodes.some((n) => n !== target && n.y > node.y && n.y < target.y && Math.abs(n.x + n.w / 2 - fromBottom[0]) < 1);
      if (directlyBelow) edges.push({ id: `${node.id}:yes`, from: node.id, to: target.id, label: 'YES', points: [fromBottom, [fromBottom[0], target.y]] });
      else {
        const lx = 12 - (lane++ % 3) * 6;
        const back = target.y <= node.y;
        edges.push({ id: `${node.id}:yes`, from: node.id, to: target.id, label: 'YES', back, points: [[node.x, node.y + node.h / 2], [lx, node.y + node.h / 2], [lx, target.y + target.h / 2], [target.x, target.y + target.h / 2]] });
      }
    }
    for (const t of fromAny) {
      const n = nodes.find((x) => x.id === `${id}:any:${t.rung.id}:${t.to}`)!;
      const target = stepNode.get(t.to);
      if (target) edges.push({ id: `${n.id}:yes`, from: n.id, to: target.id, label: 'YES', points: [[n.x + 20, n.y + n.h], [n.x + 20, target.y + target.h / 2], [target.x, target.y + target.h / 2]] });
    }
    y += 10;
  }

  // every other rung: IF (diamond) → YES → actions (square), down in scan order
  let prev: FlowNode | null = null;
  for (const r of rungs) {
    if (used.has(r.id)) continue;
    const lines = r.branches.length ? conditionLines(r.branches, nameOf) : ['always'];
    const acts = r.outputs.map((o) => clip(actionText(o, nameOf)));
    const h = Math.max(boxH(lines.length, DEC_H), boxH(acts.length, STEP_H));
    const dec: FlowNode = { id: `${id}:if:${r.id}`, kind: 'decision', title: r.comment ? clip(r.comment, 28) : 'IF', lines, rungIds: [r.id], x: cx - DEC_W / 2, y, w: DEC_W, h };
    const act: FlowNode = { id: `${id}:then:${r.id}`, kind: 'action', title: 'THEN', lines: acts.length ? acts : ['(nothing)'], rungIds: [r.id], x: cx + DEC_W / 2 + 40, y: y + (h - boxH(acts.length, STEP_H)) / 2, w: ACT_W, h: boxH(acts.length, STEP_H) };
    nodes.push(dec, act);
    edges.push({ id: `${act.id}:yes`, from: dec.id, to: act.id, label: 'YES', points: [[dec.x + dec.w, dec.y + h / 2], [act.x, dec.y + h / 2]] });
    if (prev) edges.push({ id: `${dec.id}:next`, from: prev.id, to: dec.id, label: prev.kind === 'decision' ? 'NEXT' : undefined, points: [[cx, prev.y + prev.h], [cx, dec.y]] });
    prev = dec;
    y += h + GAP;
  }
  return { id, name, description, register: reg, rungCount: rungs.length, nodes, edges, x: 0, y: 0, w: width, h: Math.max(y + 20, 160) };
}

/** The whole program: one diagram per block, in program order, laid out in rows across the map. */
export function flowMap(program: LadderProgram, nameOf: NameOf, opts: { rowWidth?: number } = {}): FlowMap {
  const groups = new Map<string, Rung[]>();
  for (const r of program.rungs) {
    const k = r.block ?? '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const blocks = program.blocks ?? [];
  const order = [...blocks.map((b) => b.id).filter((id) => groups.has(id)), ...[...groups.keys()].filter((k) => !blocks.some((b) => b.id === k))];
  const diagrams = order.map((k) => {
    const b = blocks.find((x) => x.id === k);
    return diagramOf(k, b?.name ?? (k || 'General'), b?.description ?? '', groups.get(k)!, nameOf);
  });
  // rows: diagrams side by side until the row is full, then the next row below
  const rowWidth = opts.rowWidth ?? 4000;
  let x = 0, y = 0, rowH = 0, w = 0;
  for (const d of diagrams) {
    if (x > 0 && x + d.w > rowWidth) { x = 0; y += rowH + 80; rowH = 0; }
    d.x = x; d.y = y;
    x += d.w + 80; rowH = Math.max(rowH, d.h); w = Math.max(w, x);
  }
  return { diagrams, w, h: y + rowH };
}

/** The nodes that come from a rung (to light the diagram from the ladder side). */
export function nodesOfRung(map: FlowMap, rungId: string): { diagram: FlowDiagram; node: FlowNode }[] {
  return map.diagrams.flatMap((d) => d.nodes.filter((n) => n.rungIds.includes(rungId)).map((node) => ({ diagram: d, node })));
}
