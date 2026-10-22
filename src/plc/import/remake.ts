/**
 * Remake an imported program for another PLC: how much of it converts, per target, before anything is moved.
 * Each target is worked out the way "Move it to another PLC" does it (choosePlcBrand): its first CPU that holds
 * the I/O list with modules, the I/O renumbered for it and the program following, then the target's checker.
 * Pure: the project's stores are not touched.
 *
 * A rung converts when it has no kept vendor instruction (RAW: the original PLC's own instruction the app could
 * not translate) and the target's checker finds no error in it.
 */
import type { HmiDesign } from '../../hmi/types';
import type { IOPoint } from '../../types/io';
import { ptoPointsFor } from '../../electrical/highSpeedIo';
import { needFromIo } from '../../spec/equipmentRules';
import { rungAddresses, TODO_VENDOR, type LadderProgram, type Rung } from '../core/ladder';
import { logixName } from '../core/profiles/logixExport';
import { servoComment, servoRegister, type ServoRegister } from './mpServo';
import { modulesToFit } from '../core/fit';
import { ioAddresses } from '../core/ioChange';
import { ioRemap } from '../core/ioRemap';
import { getProfile, PLC_PROFILES } from '../core/profiles';
import { remapProgram } from '../core/remapProgram';
import { validateProgram } from '../core/validate';

export interface RemakeCoverage {
  plcId: string;
  /** "Siemens S7-1200 / S7-1500". */
  label: string;
  cpuId: string;
  rungs: number;
  converted: number;
  /** Whole percent of the rungs that convert. */
  percent: number;
  /** Kept vendor instructions, grouped by their first word ("SEE" ×3; "unknown instruction" ×1), with the codes the reader did not know. */
  kept: { what: string; count: number; codes?: string[] }[];
  /** Rungs without kept instructions that the target's checker rejects, with its first message. */
  errors: { rungId: string; message: string }[];
  /** Servo axes whose motion registers rungs use (kept as "servo register"): set the axis up on the target first. */
  motion: { circuit: number; axis: number; rungs: number }[];
}

interface Project { io: IOPoint[]; plcId: string; cpuId: string; modules: string[]; program: LadderProgram; hmi?: HmiDesign | null }

const rawTexts = (r: Rung): string[] => [...r.branches.flat(), ...r.outputs].flatMap((x) => (x.type === 'RAW' ? [x.text] : []));

/** The coverage on one target PLC. */
export function remakeCoverage(p: Project, plcId: string): RemakeCoverage {
  const profile = getProfile(plcId);
  const need = needFromIo(p.io, false, 0);
  const cpuId = (p.io.length ? [profile.defaultCpuId, ...profile.cpuModels.map((c) => c.id)].find((id) => modulesToFit(id, [], need)) : undefined) ?? profile.defaultCpuId;
  const modules = p.io.length ? modulesToFit(cpuId, [], need) ?? [] : [];
  // Leaving a read-only PLC: its I/O registers are not the new PLC's terminals (as withIoRemap).
  const was = getProfile(p.plcId);
  const io = was.readOnly && was.id !== plcId
    ? p.io.map((x) => { const k = x.plcAddress?.trim() ? was.parseAddress(x.plcAddress)?.kind : undefined; if (k !== 'input' && k !== 'output') return x; const q = { ...x }; delete q.plcAddress; delete q.addressNote; return q; })
    : p.io;
  const before = ioAddresses(p.io, { plcId: p.plcId, cpuId: p.cpuId, modules: p.modules });
  const after = ioAddresses(io, { plcId, cpuId, modules });
  const program = remapProgram(p.program, ioRemap(before, after)).program;
  const issues = validateProgram(program, profile, new Set(after.values()), p.hmi ?? undefined, profile.id === 'click' ? { pulseOutputs: ptoPointsFor(cpuId, modules) } : {});

  const kept = new Map<string, number>();
  const codes = new Map<string, Set<string>>();
  const errors: RemakeCoverage['errors'] = [];
  let converted = 0;
  // Yaskawa motion registers kept as memory by the import (nickname OW8008 …): on another PLC they are the axis
  // itself, so their rungs wait for the axis to be set up there (mpServo.ts).
  const servo = new Map(program.tags.flatMap((t) => { const x = servoRegister(t.native ?? t.nickname ?? ''); return x ? [[t.address.toUpperCase(), x] as const] : []; }));
  const axes = new Map<string, { circuit: number; axis: number; rungs: number }>();
  // The app's own notes to complete (servo placeholders) are no rungs of the original: not counted.
  const own = (r: Rung) => r.outputs.length > 0 && r.outputs.every((o) => o.type === 'RAW' && o.vendor === TODO_VENDOR) && !r.branches.length;
  for (const r of program.rungs) {
    if (own(r)) continue;
    const raw = rawTexts(r);
    const moving = [...new Set(rungAddresses(r).map((a) => servo.get(a.trim().toUpperCase())).filter((x): x is ServoRegister => Boolean(x)).map((x) => `${x.circuit}.${x.axis}`))];
    if (moving.length) {
      kept.set('servo register', (kept.get('servo register') ?? 0) + 1);
      for (const k of moving) { const [c, a] = k.split('.').map(Number); const e = axes.get(k) ?? { circuit: c, axis: a, rungs: 0 }; e.rungs++; axes.set(k, e); }
      continue;
    }
    for (const t of raw) {
      const w = /^unknown instruction/i.test(t.trim()) ? 'unknown instruction' : t.trim().split(/\s+/)[0] || 'instruction';
      kept.set(w, (kept.get(w) ?? 0) + 1);
      const code = /\bcode (0x[0-9a-f]+)/i.exec(t)?.[1];
      if (code) codes.set(w, (codes.get(w) ?? new Set()).add(code.toLowerCase()));
    }
    const err = issues.find((i) => i.severity === 'error' && i.rungId === r.id && !/cannot run on|not run, rewrite by hand|not converted/i.test(i.message));
    if (raw.length) continue;
    if (err) errors.push({ rungId: r.id, message: err.message });
    else converted++;
  }
  const rungs = program.rungs.filter((r) => !own(r)).length;
  return {
    plcId, label: `${profile.vendor} ${profile.name}`, cpuId, rungs, converted,
    percent: rungs ? Math.floor((100 * converted) / rungs) : 100,
    kept: [...kept].map(([what, count]) => ({ what, count, ...(codes.has(what) ? { codes: [...codes.get(what)!].sort() } : {}) })).sort((a, b) => b.count - a.count),
    errors,
    motion: [...axes.values()].sort((x, y) => x.circuit - y.circuit || x.axis - y.axis),
  };
}

/** The coverage on every PLC the app can write (not the program's own read-only one). */
export function remakeCoverageAll(p: Project): RemakeCoverage[] {
  return PLC_PROFILES.filter((x) => x.available && x.id !== p.plcId).map((x) => remakeCoverage(p, x.id));
}

/**
 * The coverage as plain text to copy or paste (the owner shares it to get the conversion improved): counts and
 * instruction kinds only. No tag names, register addresses, values, comments or checker messages (they name
 * operands): a kept instruction is named by its instruction word only when that word is no name of the program
 * (an all-capital word of 2 to 6 letters), else "other instruction"; unknown codes are opcodes of the original PLC.
 */
export function remakeCoverageText(p: Project, coverage: RemakeCoverage[] = remakeCoverageAll(p)): string {
  const names = new Set(p.program.tags.flatMap((t) => [t.address, t.nickname]).filter(Boolean).map((x) => x.toUpperCase()));
  const kind = (w: string) => { if (w === 'unknown instruction' || w === 'servo register') return w; const m = /^([A-Z]{2,6})(?=$|\()/.exec(w)?.[1]; return m && !names.has(m) ? m : 'other instruction'; };
  const blocks = new Set(p.program.rungs.map((r) => r.block ?? '')).size;
  const from = getProfile(p.plcId);
  const lines = [
    'ISA Auto Programmer: remake coverage (counts only: no names, addresses, values or comments)',
    `From: ${from.vendor} ${from.name}. ${p.program.rungs.length} rungs in ${blocks} block${blocks === 1 ? '' : 's'}.`,
  ];
  for (const c of coverage) {
    const kept = new Map<string, { count: number; codes: Set<string> }>();
    for (const k of c.kept) { const w = kind(k.what); const e = kept.get(w) ?? { count: 0, codes: new Set<string>() }; e.count += k.count; for (const x of k.codes ?? []) e.codes.add(x); kept.set(w, e); }
    const keptText = [...kept].map(([w, e]) => `${w}${e.codes.size ? ` (codes ${[...e.codes].sort().join(', ')})` : ''} ×${e.count}`).join('; ');
    lines.push(`${c.label}: ${c.converted} of ${c.rungs} rungs convert (${c.percent}%)${keptText ? `; kept: ${keptText}` : ''}${c.errors.length ? `; rejected by its checker: ${c.errors.length} rung${c.errors.length === 1 ? '' : 's'}` : ''}${c.motion.length ? `; servo axes to set up: ${c.motion.map((m) => `circuit ${m.circuit} axis ${m.axis} (${m.rungs} rung${m.rungs === 1 ? '' : 's'})`).join(', ')}` : ''}.`);
  }
  return lines.join('\n');
}

/** Where the target PLC sets a servo axis up (documented names only; the rest said in general words). */
function axisSetup(plcId: string, label: string): string {
  if (plcId === 'siemens-s7') return 'in TIA Portal add a technology object TO_PositioningAxis for its drive, then enable it with MC_Power and move it with MC_MoveAbsolute / MC_MoveVelocity';
  if (plcId === 'logix') return 'in Studio 5000 add the drive with an AXIS_CIP_DRIVE axis in a motion group, then enable it with MSO and move it with MAM / MAJ';
  return `set the drive and its axis up on the ${label} as its manual says, then move it from this block`;
}

/**
 * The remade program with one placeholder block per servo axis its rungs use ("SERVO AXIS 1 — to set up on …"):
 * no logic, only notes to complete by hand (TODO_VENDOR, a comment on every PLC) naming the axis's registers by
 * their new tag names (Axis1_motion_command, was OW8008), so nothing of the original's motion is silently lost.
 * Idempotent: an axis that already has its block gets no second one.
 */
export function withServoPlaceholders(program: LadderProgram, plcId: string, axisName: (circuit: number, axis: number) => string | undefined = () => undefined): LadderProgram {
  const profile = getProfile(plcId);
  const label = `${profile.vendor} ${profile.name}`;
  const used = new Set(program.tags.map((t) => t.nickname.toLowerCase()).filter(Boolean));
  const byAxis = new Map<string, { circuit: number; axis: number; tags: { name: string; reg: ServoRegister }[] }>();
  const tags = program.tags.map((t) => {
    const reg = servoRegister(t.native ?? t.nickname ?? '');
    if (!reg) return t;
    const k = `${reg.circuit}.${reg.axis}`;
    const e = byAxis.get(k) ?? { circuit: reg.circuit, axis: reg.axis, tags: [] };
    byAxis.set(k, e);
    // A register name (OW8008) means nothing on the new PLC: the axis and what it is, as the tag name.
    const name = /^[IO][BWLF][89A-F]/i.test(t.nickname) || !t.nickname
      ? (used.delete(t.nickname.toLowerCase()), logixName(`${reg.circuit > 1 ? `C${reg.circuit}_` : ''}Axis${reg.axis}_${reg.what.replace(/\(.*?\)/g, '')}`, used, `Axis${reg.axis}_${reg.offset}`))
      : t.nickname;
    e.tags.push({ name, reg });
    return { ...t, nickname: name, native: t.native ?? reg.register, comment: t.comment || servoComment(reg) };
  });
  const blocks = [...(program.blocks ?? [])];
  const rungs = [...program.rungs];
  for (const e of [...byAxis.values()].sort((a, b) => a.circuit - b.circuit || a.axis - b.axis)) {
    const id = `b_servo_c${e.circuit}_a${e.axis}`;
    if (blocks.some((b) => b.id === id)) continue;
    const named = axisName(e.circuit, e.axis);
    const title = `SERVO AXIS ${e.axis}${e.circuit > 1 ? ` (circuit ${e.circuit})` : ''}${named ? ` ${named}` : ''}`;
    blocks.push({ id, name: `${title} — to set up on ${label}`, description: `Placeholder, no logic: the original drove this axis through its MECHATROLINK registers. Set the axis up on the ${label} and complete this block.` });
    const list = e.tags.map((x) => `${x.name} (was ${x.reg.register}, ${x.reg.what})`).join('; ');
    rungs.push({ id: `r_servo_c${e.circuit}_a${e.axis}`, block: id, comment: `${title}: to set up on the ${label}.`, branches: [],
      outputs: [{ type: 'RAW', vendor: TODO_VENDOR, text: `${title} — to set up on ${label}: ${axisSetup(plcId, label)}. The program's tags of this axis: ${list}.` }] });
  }
  return { ...program, tags, blocks, rungs };
}
