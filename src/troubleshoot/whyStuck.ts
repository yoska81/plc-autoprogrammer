/**
 * "Why is it stuck?" — from a stuck output or a cycle step that does not advance, walk the ladder back from the
 * coil (or the step's transition rung) through the contacts that are not made, using the live values (Online,
 * Modbus) or the simulator's, down to the points that explain it:
 *   input            an X that is not in the state the logic needs (sensor / button / wiring)
 *   output-no-motion the Y is ON but the feedback that should follow never arrives (wire, fuse, relay, contactor, drive, device)
 *   setting          a preset / setpoint register that is 0, out of range or never reached
 *   logic            a bit nothing can switch on (or off), a compare that can never be true
 *   reset-needed     an alarm latched after its cause went away: Reset clears it
 *   waiting          a timer still timing: nothing is wrong yet
 * Rules only (no AI). Each blocker names the PLC point, so the wiring-path engine (next: 'wiring') takes it from there.
 */
import type { CompareElement, LadderElement, LadderProgram, Rung, TagDefinition } from '../plc/core/ladder';

export interface Values { bit(address: string): boolean; word(address: string): number }

export type BlockerKind = 'input' | 'output-no-motion' | 'setting' | 'logic' | 'reset-needed' | 'waiting';

export interface Blocker {
  kind: BlockerKind;
  /** The PLC point: X004, Y002, DS1105, C21, T3. */
  point: string;
  description?: string;
  expected: boolean | number | string;
  actual: boolean | number;
  /** The rung where the point blocks (1-based number in program order). */
  rungId: string;
  rungNo: number;
  /** From the target down to this point. */
  path: string[];
  explain: string;
  next: 'wiring' | 'setting' | 'logic' | 'operator' | 'none';
  /** Setting findings: the range the program declares for the register (its first-scan "outside min–max → default" rung). */
  limits?: { min: number; max: number; default?: number };
}

export interface WhyStuck {
  target: string;
  state: 'on' | 'off' | 'waiting';
  summary: string;
  /** Most likely cause first. */
  blockers: Blocker[];
}

export interface StuckContext {
  io?: { address: string; description: string; type: string; deviceType?: string }[];
  tags?: TagDefinition[];
}

export type StuckTarget = { output: string } | { step: number; register?: string };

const up = (a: string) => a.trim().toUpperCase();
const isNum = (a: string) => /^[-+]?\d+(\.\d+)?$/.test(a.trim());
const MAX_DEPTH = 12;

export function whyStuck(program: LadderProgram, values: Values, target: StuckTarget, ctx: StuckContext = {}): WhyStuck {
  const rungNo = new Map(program.rungs.map((r, i) => [r.id, i + 1] as const));
  const desc = new Map<string, string>();
  for (const t of program.tags) desc.set(up(t.address), t.comment || t.nickname);
  for (const t of ctx.tags ?? []) desc.set(up(t.address), t.comment || t.nickname);
  for (const p of ctx.io ?? []) desc.set(up(p.address), p.description);
  const name = (a: string) => { const d = desc.get(up(a)); return d ? `${up(a)} (${d})` : up(a); };

  // Who writes what.
  const coilRungs = new Map<string, Rung[]>(), setRungs = new Map<string, Rung[]>(), rstRungs = new Map<string, Rung[]>(), tmrRungs = new Map<string, Rung>(), cntRungs = new Map<string, Rung>(), wordWriters = new Map<string, Rung[]>();
  const push = (m: Map<string, Rung[]>, a: string, r: Rung) => m.set(up(a), [...(m.get(up(a)) ?? []), r]);
  for (const r of program.rungs) for (const o of r.outputs) {
    if (o.type === 'OUT') push(coilRungs, o.address, r);
    else if (o.type === 'SET') push(setRungs, o.address, r);
    else if (o.type === 'RST') push(rstRungs, o.address, r);
    else if (o.type === 'TMR') tmrRungs.set(up(o.address), r);
    else if (o.type === 'CNT') cntRungs.set(up(o.address), r);
    else if (o.type === 'COPY' || o.type === 'MATH') push(wordWriters, o.dest, r);
  }
  const val = (a: string): number => (isNum(a) ? Number(a) : values.word(up(a)));
  const cmpTrue = (e: CompareElement) => {
    const l = val(e.left), r = val(e.right);
    switch (e.op) { case '==': return l === r; case '<>': return l !== r; case '<': return l < r; case '<=': return l <= r; case '>': return l > r; case '>=': return l >= r; }
    return false;
  };
  // A snapshot has no edges: a RISE / FALL contact is "made" only by the next change, so it counts as not made.
  const made = (e: LadderElement): boolean => {
    switch (e.type) {
      case 'NO': return values.bit(up(e.address));
      case 'NC': return !values.bit(up(e.address));
      case 'CMP': return cmpTrue(e);
      default: return false;
    }
  };
  const failing = (b: LadderElement[]) => b.filter((e) => !made(e));
  const isSystem = (a: string) => /^SC\d+$/.test(up(a));
  const isInput = (a: string) => /^X\d+$/.test(up(a));
  const isOutput = (a: string) => /^Y\d+$/.test(up(a));
  // Operator devices (pushbuttons, selectors): not pressed is normal, so they rank after real faults.
  const ioType = new Map((ctx.io ?? []).map((p) => [up(p.address), p.deviceType ?? ''] as const));
  const isOperator = (a: string) => /^(pushbutton|selector)/.test(ioType.get(up(a)) ?? '')
    || (!ioType.get(up(a)) && /\b(start|stop|reset|button|pb|push ?button|selector|jog)\b/i.test(desc.get(up(a)) ?? '') && !/\b(sensor|eye|prox|switch|e-?stop|emergency|safety|relay)\b/i.test(desc.get(up(a)) ?? ''));
  // A register the program never writes except on the first scan (a default) is a setting the operator / HMI owns.
  const isSetting = (a: string) => !isNum(a) && !ioType.has(up(a)) && /^(DS|DD|DF|DH)\d+$/.test(up(a)) && (wordWriters.get(up(a)) ?? []).every((r) => r.branches.some((b) => b.some((e) => e.type === 'NO' && up(e.address) === 'SC2')));

  // The default a first-scan rung loads into a setting register (COPY constant), if any.
  const defaultOf = (a: string): number | undefined => {
    for (const r of wordWriters.get(up(a)) ?? []) for (const o of r.outputs) if (o.type === 'COPY' && up(o.dest) === up(a) && isNum(o.source)) return Number(o.source);
    return undefined;
  };

  // The range a setting register is declared with: a first-scan rung "a < min or a > max → COPY default to a".
  const limitsOf = (a: string): Blocker['limits'] => {
    for (const r of wordWriters.get(up(a)) ?? []) {
      const cmp = r.branches.flatMap((b) => (b.some((e) => e.type === 'NO' && up(e.address) === 'SC2') ? b : [])).filter((e): e is CompareElement => e.type === 'CMP' && up(e.left) === up(a) && isNum(e.right));
      const min = cmp.find((e) => e.op === '<'), max = cmp.find((e) => e.op === '>');
      const def = r.outputs.find((o) => o.type === 'COPY' && up(o.dest) === up(a) && isNum(o.source));
      if (min && max) return { min: Number(min.right), max: Number(max.right), ...(def && def.type === 'COPY' ? { default: Number(def.source) } : {}) };
    }
    return undefined;
  };

  const out: Blocker[] = [];
  const seen = new Set<string>();
  const add = (b: Omit<Blocker, 'rungNo' | 'description'> & { description?: string }) => {
    const key = `${b.kind}:${b.point}`;
    if (seen.has(key)) return;
    seen.add(key);
    const limits = b.kind === 'setting' ? limitsOf(b.point) : undefined;
    out.push({ ...b, description: b.description ?? desc.get(up(b.point)), rungNo: rungNo.get(b.rungId) ?? 0, ...(limits ? { limits } : {}) });
  };

  /** The branch closest to true (fewest contacts not made), its own seal-in left out when `self` is off. */
  const bestBranch = (r: Rung, self?: string) => {
    const cands = r.branches.filter((b) => !self || !b.some((e) => (e.type === 'NO') && up(e.address) === up(self)));
    return (cands.length ? cands : r.branches).map((b) => ({ b, f: failing(b) })).sort((x, y) => x.f.length - y.f.length)[0];
  };

  /** Why an element of `rung` is not made. */
  const explainElement = (e: LadderElement, rung: Rung, path: string[], depth: number) => {
    if (e.type === 'CMP') return explainCompare(e, rung, path);
    if (!('address' in e)) { add({ kind: 'logic', point: '?', expected: true, actual: false, rungId: rung.id, path, explain: `Rung ${rungNo.get(rung.id)} has an instruction the analyzer cannot evaluate: check it by hand.`, next: 'logic' }); return; }
    const a = up(e.address);
    if (e.type === 'NC') return whyOn(a, rung, [...path, `${name(a)} must be OFF`], depth + 1);
    if (e.type === 'RISE' || e.type === 'FALL') {
      if (isInput(a)) {
        add({ kind: 'input', point: a, expected: e.type === 'RISE' ? 'OFF → ON' : 'ON → OFF', actual: values.bit(a), rungId: rung.id, path: [...path, name(a)],
          explain: `Waits for ${name(a)} to ${e.type === 'RISE' ? 'turn ON' : 'turn OFF'} (an edge). If operating it does not change ${a} on the PLC, check its wiring.`, next: 'operator' });
        return;
      }
      if (e.type === 'RISE' && !values.bit(a)) return whyOff(a, rung, [...path, `${name(a)} must turn ON`], depth + 1);
      add({ kind: 'logic', point: a, expected: e.type === 'RISE' ? 'OFF → ON' : 'ON → OFF', actual: values.bit(a), rungId: rung.id, path: [...path, name(a)], explain: `Waits for ${name(a)} to change (an edge): it is ${values.bit(a) ? 'ON' : 'OFF'} and must ${e.type === 'RISE' ? 'go OFF and ON again' : 'turn OFF'}.`, next: 'logic' });
      return;
    }
    return whyOff(a, rung, [...path, `${name(a)} must be ON`], depth + 1);
  };

  const explainCompare = (e: CompareElement, rung: Rung, path: string[]) => {
    const sides = [e.left, e.right];
    const setting = sides.find(isSetting);
    const text = `${e.left} ${e.op} ${e.right} is false (${val(e.left)} ${e.op} ${val(e.right)})`;
    if (setting) {
      const v = val(setting);
      add({ kind: 'setting', point: up(setting), expected: `${e.op} ${setting === e.left ? e.right : e.left}`, actual: v, rungId: rung.id, path: [...path, text],
        explain: `${name(setting)} = ${v}: ${text}.${v === 0 ? ' It is 0 — probably never set.' : ''} Check the setting.`, next: 'setting' });
      return;
    }
    // A live value (step register, a measured value) the compare waits for.
    const live = sides.find((s) => !isNum(s));
    add({ kind: live && !(wordWriters.get(up(live))?.length) && !/^(TD|CTD)\d+$/.test(up(live)) ? 'input' : 'logic', point: up(live ?? e.left), expected: `${e.op} ${live === e.left ? e.right : e.left}`, actual: val(live ?? e.left), rungId: rung.id, path: [...path, text],
      explain: `${text}.`, next: live && /^DF\d+$/.test(up(live)) && !(wordWriters.get(up(live))?.length) ? 'wiring' : 'logic' });
  };

  /** Why bit `a` is OFF when the logic needs it ON. */
  const whyOff = (a: string, from: Rung, path: string[], depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (isSystem(a)) { add({ kind: 'logic', point: a, expected: true, actual: false, rungId: from.id, path, explain: `System bit ${a} is OFF.`, next: 'logic' }); return; }
    if (isInput(a)) {
      if (isOperator(a)) add({ kind: 'input', point: a, expected: true, actual: false, rungId: from.id, path,
        explain: `Waits for ${name(a)} (operator). If operating it does not turn ${a} ON on the PLC, check its wiring.`, next: 'operator' });
      else add({ kind: 'input', point: a, expected: true, actual: false, rungId: from.id, path,
        explain: `Input ${name(a)} is OFF but the logic needs it ON: the device is not made, or its signal does not reach the PLC (wire, fuse, sensor, supply).`, next: 'wiring' });
      return;
    }
    // Timer done bit: still timing, or not enabled.
    const t = /^T(\d+)$/.exec(a);
    if (t && tmrRungs.has(a)) {
      const tr = tmrRungs.get(a)!;
      const o = tr.outputs.find((x) => x.type === 'TMR' && up(x.address) === a);
      const enabled = tr.branches.length === 0 || tr.branches.some((b) => failing(b).length === 0);
      if (enabled && o && o.type === 'TMR') {
        const preset = isNum(o.preset) ? Number(o.preset) : values.word(up(o.preset));
        if (!isNum(o.preset) && isSetting(o.preset) && preset <= 0) {
          add({ kind: 'setting', point: up(o.preset), expected: '> 0', actual: preset, rungId: tr.id, path: [...path, `${name(a)} preset ${o.preset}`], explain: `${name(a)} times to ${name(o.preset)} = ${preset}: a 0 preset never times.`, next: 'setting' });
          return;
        }
        const def = isNum(o.preset) || !isSetting(o.preset) ? undefined : defaultOf(o.preset);
        if (def !== undefined && def > 0 && preset > def * 10) {
          add({ kind: 'setting', point: up(o.preset), expected: def, actual: preset, rungId: tr.id, path: [...path, `${name(a)} preset ${o.preset}`],
            explain: `${name(a)} times to ${name(o.preset)} = ${preset} ${o.unit}, more than 10 times its default ${def}: check the setting.`, next: 'setting' });
          return;
        }
        add({ kind: 'waiting', point: a, expected: preset, actual: values.word(`TD${t[1]}`), rungId: tr.id, path, explain: `${name(a)} is timing: ${values.word(`TD${t[1]}`)} of ${preset} ${o.unit}.`, next: 'none' });
        return;
      }
      const best = bestBranch(tr);
      for (const e of best?.f ?? []) explainElement(e, tr, [...path, `${name(a)} not enabled`], depth);
      return;
    }
    const c = /^CT(\d+)$/.exec(a);
    if (c && cntRungs.has(a)) {
      const cr = cntRungs.get(a)!;
      const o = cr.outputs.find((x) => x.type === 'CNT' && up(x.address) === a);
      const preset = o && o.type === 'CNT' ? val(o.preset) : 0;
      if (o && o.type === 'CNT' && !isNum(o.preset) && isSetting(o.preset) && preset <= 0) add({ kind: 'setting', point: up(o.preset), expected: '> 0', actual: preset, rungId: cr.id, path, explain: `${name(a)} counts to ${name(o.preset)} = ${preset}.`, next: 'setting' });
      else add({ kind: 'waiting', point: a, expected: preset, actual: values.word(`CTD${c[1]}`), rungId: cr.id, path, explain: `${name(a)} has counted ${values.word(`CTD${c[1]}`)} of ${preset}.`, next: 'none' });
      return;
    }
    const coils = coilRungs.get(a) ?? [], sets = setRungs.get(a) ?? [];
    if (!coils.length && !sets.length) {
      add({ kind: 'logic', point: a, expected: true, actual: false, rungId: from.id, path,
        explain: `Nothing in the program switches ${name(a)} ON${/^C1(0\d\d|1\d\d|2\d\d|300)$/.test(a) ? ' — it is a touch-panel command; without the panel, use a pushbutton input' : ''}.`, next: 'logic' });
      return;
    }
    // An OUT coil whose rung is false (the last OUT wins; any SET rung also switches it on).
    for (const r of [...coils.slice(-1), ...sets]) {
      const best = bestBranch(r, a);
      if (!best || !best.f.length) {
        // Rung true but the bit is off: a later RST, or an output that is ON but not seen (double coil).
        const rst = (rstRungs.get(a) ?? []).find((x) => x.branches.some((b) => failing(b).length === 0));
        if (rst) { add({ kind: 'logic', point: a, expected: true, actual: false, rungId: rst.id, path, explain: `${name(a)} is reset by rung ${rungNo.get(rst.id)} while it is being set.`, next: 'logic' }); return; }
        continue;
      }
      for (const e of best.f) explainElement(e, r, [...path, `rung ${rungNo.get(r.id)}`], depth);
      if (out.length) return;
    }
  };

  /** Why bit `a` is ON when the logic needs it OFF. */
  const whyOn = (a: string, from: Rung, path: string[], depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (isInput(a)) {
      add({ kind: 'input', point: a, expected: false, actual: true, rungId: from.id, path,
        explain: `Input ${name(a)} is ON but the logic needs it OFF: the device is made (stuck sensor, held button, guard open / closed the wrong way) or the wire is shorted.`, next: 'wiring' });
      return;
    }
    if (isSystem(a)) return;
    const coil = (coilRungs.get(a) ?? []).slice(-1)[0];
    if (coil) {
      const live = coil.branches.find((b) => failing(b).length === 0);
      for (const e of live ?? []) {
        if (e.type === 'NO' || e.type === 'RISE') whyOn(up(e.address), coil, [...path, `${name(e.address)} is ON`], depth + 1);
        else if (e.type === 'NC') whyOff(up(e.address), coil, [...path, `${name(e.address)} is OFF`], depth + 1);
      }
      return;
    }
    const sets = setRungs.get(a) ?? [];
    if (sets.length) {
      const active = sets.find((r) => r.branches.some((b) => failing(b).length === 0));
      if (active) {
        const b = active.branches.find((x) => failing(x).length === 0)!;
        for (const e of b) if (e.type === 'NO') whyOn(up(e.address), active, [...path, `${name(e.address)} is ON (sets ${a})`], depth + 1);
        else if (e.type === 'NC') whyOff(up(e.address), active, [...path, `${name(e.address)} is OFF (sets ${a})`], depth + 1);
        if (!out.length) add({ kind: 'logic', point: a, expected: false, actual: true, rungId: active.id, path, explain: `${name(a)} is being set by rung ${rungNo.get(active.id)}.`, next: 'logic' });
        return;
      }
      const rst = rstRungs.get(a) ?? [];
      add({ kind: rst.length ? 'reset-needed' : 'logic', point: a, expected: false, actual: true, rungId: (rst[0] ?? sets[0]).id, path,
        explain: rst.length ? `${name(a)} is latched; its cause is gone. Reset clears it (rung ${rungNo.get(rst[0].id)}).` : `${name(a)} is latched and nothing in the program resets it.`, next: rst.length ? 'operator' : 'logic' });
      return;
    }
    add({ kind: 'logic', point: a, expected: false, actual: true, rungId: from.id, path, explain: `${name(a)} is ON and nothing in the program writes it (forced, or written from outside).`, next: 'logic' });
  };

  // ---- Targets
  if ('output' in target) {
    const y = up(target.output);
    const on = values.bit(y);
    const rung = (coilRungs.get(y) ?? setRungs.get(y) ?? [])[0] ?? program.rungs[0];
    if (on) {
      if (isOutput(y)) add({ kind: 'output-no-motion', point: y, expected: 'motion', actual: true, rungId: rung?.id ?? '', path: [name(y)],
        explain: `${name(y)} is ON in the PLC: if the device does not move, the fault is downstream — output fuse / common, wire, interposing relay, contactor or drive, the device itself.`, next: 'wiring' });
      return { target: y, state: 'on', summary: `${name(y)} is ON.`, blockers: out };
    }
    if (rung) whyOff(y, rung, [`${name(y)} is OFF`], 0);
    return { target: y, state: 'off', summary: summary(`${name(y)} is OFF`, ranked(out)), blockers: ranked(out) };
  }

  // A cycle step that does not advance: its transition rung (step register == N, writes the register).
  const S = up(target.register ?? program.sequence?.register ?? 'DS1150');
  const N = String(target.step);
  const at = values.word(S);
  const trans = program.rungs.find((r) => r.outputs.some((o) => o.type === 'COPY' && up(o.dest) === S && o.source !== N)
    && r.branches.some((b) => b.some((e) => e.type === 'CMP' && up(e.left) === S && e.op === '==' && e.right.trim() === N)));
  const label = `Step ${N}`;
  if (!trans) return { target: `${S}=${N}`, state: 'off', summary: `${label}: no rung moves ${S} on from ${N}.`, blockers: [] };
  if (at !== target.step) return { target: `${S}=${N}`, state: 'off', summary: `${label} is not the active step (${S} = ${at}).`, blockers: [] };
  const best = bestBranch(trans)!;
  // Outputs this step drives: request bits whose rung compares the step register with N, and the Y coils they drive.
  const reqBits = new Set(program.rungs.filter((r) => r.outputs.some((o) => o.type === 'OUT') && r.branches.some((b) => b.some((e) => e.type === 'CMP' && up(e.left) === S && e.right.trim() === N)))
    .flatMap((r) => r.outputs.filter((o) => o.type === 'OUT').map((o) => up((o as { address: string }).address))));
  const stepOuts = [...coilRungs].filter(([a, rs]) => isOutput(a) && rs.some((r) => r.branches.some((b) => b.some((e) => e.type === 'NO' && reqBits.has(up(e.address)))))).map(([a]) => a);
  for (const e of best.f) {
    // The step waits for a feedback input while its output is ON: nothing moved (downstream), or the sensor does not see it.
    if (e.type === 'NO' && isInput(e.address)) {
      const onOuts = stepOuts.filter((y) => values.bit(y));
      for (const y of onOuts) add({ kind: 'output-no-motion', point: y, expected: 'motion', actual: true, rungId: trans.id, path: [label, `waits for ${name(e.address)}`, `${name(y)} is ON`],
        explain: `${label} waits for ${name(e.address)} while ${name(y)} is ON: either the device does not move (output fuse / wire / relay / contactor / drive / the device) or it moves and ${up(e.address)} does not see it.`, next: 'wiring' });
      if (!onOuts.length) for (const y of stepOuts) whyOff(y, trans, [label, `${name(y)} should be ON in this step`], 1);
    }
    explainElement(e, trans, [label, `rung ${rungNo.get(trans.id)}`], 0);
  }
  const waiting = out.length > 0 && out.every((b) => b.kind === 'waiting');
  return { target: `${S}=${N}`, state: waiting ? 'waiting' : 'off', summary: summary(`${label} does not advance`, ranked(out)), blockers: ranked(out) };
}

/** Most likely cause first: an output that does not move, a field input, a setting, a latched alarm, logic, then operator actions and timers. */
const RANK = (b: Blocker) => b.kind === 'output-no-motion' ? 0 : b.kind === 'input' && b.next === 'wiring' ? 1 : b.kind === 'setting' ? 2 : b.kind === 'reset-needed' ? 3 : b.kind === 'logic' ? 4 : b.kind === 'input' ? 5 : 6;
const ranked = (bs: Blocker[]) => bs.map((b, i) => ({ b, i })).sort((x, y) => RANK(x.b) - RANK(y.b) || x.i - y.i).map((x) => x.b);

function summary(head: string, bs: Blocker[]): string {
  if (!bs.length) return `${head}: no blocking condition found in the program (check forces and bypassed rungs).`;
  const b = bs[0];
  return `${head}: ${b.explain}`;
}
