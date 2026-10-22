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
import type { LadderProgram, Rung } from '../core/ladder';
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
  for (const r of program.rungs) {
    const raw = rawTexts(r);
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
  const rungs = program.rungs.length;
  return {
    plcId, label: `${profile.vendor} ${profile.name}`, cpuId, rungs, converted,
    percent: rungs ? Math.floor((100 * converted) / rungs) : 100,
    kept: [...kept].map(([what, count]) => ({ what, count, ...(codes.has(what) ? { codes: [...codes.get(what)!].sort() } : {}) })).sort((a, b) => b.count - a.count),
    errors,
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
  const kind = (w: string) => { if (w === 'unknown instruction') return w; const m = /^([A-Z]{2,6})(?=$|\()/.exec(w)?.[1]; return m && !names.has(m) ? m : 'other instruction'; };
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
    lines.push(`${c.label}: ${c.converted} of ${c.rungs} rungs convert (${c.percent}%)${keptText ? `; kept: ${keptText}` : ''}${c.errors.length ? `; rejected by its checker: ${c.errors.length} rung${c.errors.length === 1 ? '' : 's'}` : ''}.`);
  }
  return lines.join('\n');
}
