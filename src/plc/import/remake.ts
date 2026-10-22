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
  /** Kept vendor instructions, grouped by their first word ("SEE" ×3; "unknown instruction" ×1). */
  kept: { what: string; count: number }[];
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
  const errors: RemakeCoverage['errors'] = [];
  let converted = 0;
  for (const r of program.rungs) {
    const raw = rawTexts(r);
    for (const t of raw) { const w = /^unknown instruction/i.test(t.trim()) ? 'unknown instruction' : t.trim().split(/\s+/)[0] || 'instruction'; kept.set(w, (kept.get(w) ?? 0) + 1); }
    const err = issues.find((i) => i.severity === 'error' && i.rungId === r.id && !/cannot run on|not run, rewrite by hand|not converted/i.test(i.message));
    if (raw.length) continue;
    if (err) errors.push({ rungId: r.id, message: err.message });
    else converted++;
  }
  const rungs = program.rungs.length;
  return {
    plcId, label: `${profile.vendor} ${profile.name}`, cpuId, rungs, converted,
    percent: rungs ? Math.floor((100 * converted) / rungs) : 100,
    kept: [...kept].map(([what, count]) => ({ what, count })).sort((a, b) => b.count - a.count),
    errors,
  };
}

/** The coverage on every PLC the app can write (not the program's own read-only one). */
export function remakeCoverageAll(p: Project): RemakeCoverage[] {
  return PLC_PROFILES.filter((x) => x.available && x.id !== p.plcId).map((x) => remakeCoverage(p, x.id));
}
