/**
 * HMI for an upgraded (imported) program: the screens bind to the addresses the program already has
 * (roles read from its ladder by src/plc/import/hmiRoles.ts), and whatever the HMI needs that the program
 * lacks becomes a list of PLC changes, shown once on the review page instead of a finding per tag.
 */
import type { HmiDesign, HmiTag, PlcChange } from '../types';
import { rungWrites, type LadderProgram } from '../../plc/core/ladder';
import { rungReads } from '../../plc/sim/blocks';
import type { ProgramRoles, Role } from '../../plc/import/hmiRoles';

/** The imported program's addresses for HMI roles. */
export interface UpgradeRoles {
  /** Existing addresses, by HMI role (cmd:start, sts:running, alarm:fault:X003 …). */
  tags: HmiTag[];
  /** Commands the program takes from a wired input: the HMI gets its own bit, added beside that input. */
  parallelTo?: { role: string; address: string; nickname: string }[];
  /** What the program has no address for at all, in plain words. */
  missing?: string[];
}

/** What a ladder program writes and reads; a timer or counter writes its current value (TDn / CTDn). */
export function programUse(ladder: LadderProgram) {
  const writes = new Set<string>(), sets = new Set<string>(), resets = new Set<string>();
  for (const r of ladder.rungs) {
    for (const w of rungWrites(r)) writes.add(w.trim().toUpperCase());
    for (const o of r.outputs) {
      if (o.type === 'TMR') writes.add(`TD${o.address.trim().toUpperCase().slice(1)}`);
      if (o.type === 'CNT') writes.add(`CTD${o.address.trim().toUpperCase().slice(2)}`);
      if (o.type === 'SET') sets.add(o.address.trim().toUpperCase());
      if (o.type === 'RST') resets.add(o.address.trim().toUpperCase());
    }
  }
  const reads = new Set(ladder.rungs.flatMap((r) => rungReads(r).map((x) => x.address.trim().toUpperCase())));
  return { writes, reads, sets, resets };
}

/** Whether the program does its part for a tag: writes what the HMI shows, reads what the HMI writes. */
export function implemented(t: Pick<HmiTag, 'address' | 'access'>, use: ReturnType<typeof programUse>): boolean {
  const a = t.address.trim().toUpperCase();
  if (/^[XY]\d/.test(a)) return true;
  return t.access === 'read' ? use.writes.has(a) : use.reads.has(a);
}

/**
 * The changes the imported program needs so every tag and alarm of the design works. `filled`: registers no
 * rung writes because the hardware does (analog inputs, filled by the module's analog setup).
 */
export function plcChangesFor(design: HmiDesign, ladder: LadderProgram, roles: UpgradeRoles, filled: Set<string> = new Set()): PlcChange[] {
  const use = programUse(ladder);
  const parallel = new Map((roles.parallelTo ?? []).map((p) => [p.role, p] as const));
  const alarms = new Map(design.alarms.map((a) => [a.address.trim().toUpperCase(), a] as const));
  const out = new Map<string, PlcChange>();
  for (const t of design.tags) {
    const a = t.address.trim().toUpperCase();
    if (out.has(a) || filled.has(a) || implemented(t, use)) continue;
    const p = t.role ? parallel.get(t.role) : undefined;
    const alarm = alarms.get(a);
    const change = p
      ? t.role === 'cmd:stop'
        ? `Add a normally-closed contact of ${t.name} (${a}) in series with ${p.nickname} (${p.address}), so the HMI Stop stops the machine like the Stop button.`
        : `Add ${t.name} (${a}) in parallel with ${p.nickname} (${p.address}), so the HMI button does what the wired button does.`
      : alarm
        ? `Set ${t.name} (${a}) when "${alarm.message}" happens, and clear it with Reset once the cause is gone.`
        : t.access === 'read'
          ? `Write ${t.name} (${a}): ${t.description}`
          : `Use ${t.name} (${a}) in the program: ${t.description}`;
    out.set(a, { address: a, name: t.name, change });
  }
  return [...out.values()];
}

/** Those of a design's PLC changes the program still lacks (the user may have made some already). */
export function openPlcChanges(design: HmiDesign, ladder: LadderProgram): PlcChange[] {
  if (!design.plcChanges?.length) return [];
  const use = programUse(ladder);
  const byAddr = new Map(design.tags.map((t) => [t.address.trim().toUpperCase(), t] as const));
  const alarm = new Set(design.alarms.map((a) => a.address.trim().toUpperCase()));
  return design.plcChanges.filter((c) => {
    const t = byAddr.get(c.address);
    if (alarm.has(c.address)) return !use.writes.has(c.address);
    return t ? !implemented(t, use) : !use.writes.has(c.address) && !use.reads.has(c.address);
  });
}

/**
 * The HMI roles of an imported program (src/plc/import/hmiRoles.ts) as the tags the HMI build reuses:
 * panel bits the program reads become the panel's own commands, wired buttons get an HMI bit beside them,
 * the sealed running coil, fault inputs, the safety fault, the first counter and its preset register.
 */
export function upgradeRolesFrom(pr: ProgramRoles): UpgradeRoles {
  const tags: HmiTag[] = [];
  const parallelTo: NonNullable<UpgradeRoles['parallelTo']> = [];
  const tag = (role: string, r: Role, dataType: HmiTag['dataType'], access: HmiTag['access'], address = r.address) =>
    tags.push({ role, address, name: r.nickname.replace(/[^A-Za-z0-9]+/g, '_'), dataType, access, description: `From the upgraded program: ${r.why}.` });
  const cmd = (role: string, rs: Role[]) => {
    const bit = rs.find((r) => !/^X\d/i.test(r.address));
    if (bit) tag(role, bit, 'BIT', 'write');
    else if (rs[0]) parallelTo.push({ role, address: rs[0].address, nickname: rs[0].nickname });
  };
  cmd('cmd:start', pr.start);
  cmd('cmd:stop', pr.stop);
  cmd('cmd:reset', pr.reset);
  if (pr.running[0]) tag('sts:running', pr.running[0], 'BIT', 'read');
  for (const f of pr.faults) {
    if (/^X\d/i.test(f.address)) tag(`alarm:fault:${f.address}`, f, 'BIT', 'read');
    else if (/safety|e-?stop|guard/i.test(f.nickname) && !tags.some((t) => t.role === 'alarm:safety')) tag('alarm:safety', f, 'BIT', 'read');
  }
  const ct = pr.counters[0];
  if (ct) {
    const n = /^CT(\d+)$/i.exec(ct.address)?.[1];
    if (n) tag('word:count', ct, 'INT2', 'read', `CTD${n}`);
    if (ct.preset && /^(DS|DD)\d+$/i.test(ct.preset)) tag('sp:batch', { ...ct, nickname: `${ct.nickname}_Preset`, why: `the preset of ${ct.nickname}` }, 'INT', 'read-write', ct.preset.toUpperCase());
  }
  // The exact panel Start / Stop changes are in the PLC change list; the rest is said as the importer found it.
  const missing = pr.missing.filter((m) => !(parallelTo.length && /in parallel with/i.test(m)));
  return { tags, parallelTo, missing };
}
