/**
 * HMI for an upgraded (imported) program: the screens bind to the addresses the program already has
 * (roles read from its ladder by src/plc/import/hmiRoles.ts), and whatever the HMI needs that the program
 * lacks becomes a list of PLC changes, shown once on the review page instead of a finding per tag.
 */
import type { HmiDesign, HmiTag, PlcChange } from '../types';
import { rungWrites, type LadderProgram } from '../../plc/core/ladder';
import { rungReads } from '../../plc/sim/blocks';
import type { HmiContent } from './content';

/** The imported program's addresses for HMI roles. */
export interface UpgradeRoles {
  /** Existing addresses, by HMI role (cmd:start, sts:running, alarm:fault:X003 …). */
  tags: HmiTag[];
  /** Commands the program takes from a wired input: the HMI gets its own bit, added beside that input. */
  parallelTo?: { role: string; address: string; nickname: string }[];
  /** Counter presets written as constants in the rung: the HMI batch setpoint replaces the constant. */
  constPresets?: { address: string; nickname: string; preset: string }[];
  /** The program's own fault / alarm bits with a short text: they go on the HMI alarm list as they are. */
  alarms?: { address: string; nickname: string; why: string; text: string }[];
  /** What the program has no address for at all, in plain words. */
  missing?: string[];
}

/**
 * The HMI's alarms the program already has: an alarm bit of the program whose rung reads the same input as
 * the HMI's safety / fault / alarm-input alarm takes that role, so the HMI shows the program's bit instead of
 * asking for a second one.
 */
export function programAlarmRoles(roles: UpgradeRoles, ladder: LadderProgram, c: HmiContent): HmiTag[] {
  const readsOf = new Map<string, Set<string>>();
  for (const r of ladder.rungs) {
    const contacts = r.branches.flat().flatMap((e) => ('address' in e ? [e.address.trim().toUpperCase()] : []));
    for (const o of r.outputs) {
      if ((o.type === 'OUT' || o.type === 'SET') && 'address' in o) {
        const a = o.address.trim().toUpperCase();
        readsOf.set(a, new Set([...(readsOf.get(a) ?? []), ...contacts]));
      }
    }
  }
  const wanted: [string, string][] = [
    ...(c.safetyOk ? [['alarm:safety', c.safetyOk.address] as [string, string]] : []),
    ...c.actuators.flatMap((a) => (a.fault ? [[`alarm:fault:${a.fault.address}`, a.fault.address] as [string, string]] : [])),
    ...(c.alarmInputs ?? []).map((ai) => [`alarm:input:${ai.point.address}`, ai.point.address] as [string, string]),
  ];
  const out: HmiTag[] = [];
  const taken = new Set<string>();
  for (const [role, input] of wanted) {
    const al = (roles.alarms ?? []).find((x) => !taken.has(x.address.toUpperCase()) && readsOf.get(x.address.toUpperCase())?.has(input.toUpperCase()));
    if (!al) continue;
    taken.add(al.address.toUpperCase());
    out.push({ role, address: al.address.toUpperCase(), name: al.nickname.replace(/[^A-Za-z0-9]+/g, '_'), dataType: 'BIT', access: 'read', description: `From the upgraded program: ${al.why}.` });
  }
  return out;
}

/** Puts the program's own alarm bits on the design's alarm list (each once, with its text and a read tag). */
export function addProgramAlarms(design: HmiDesign, roles: UpgradeRoles): void {
  for (const al of roles.alarms ?? []) {
    const a = al.address.trim().toUpperCase();
    const bound = design.alarms.find((x) => x.address.trim().toUpperCase() === a);
    // An HMI alarm bound to the program's bit says what the program says.
    if (bound) { bound.message = al.text; continue; }
    design.alarms.push({ address: a, message: al.text, severity: 'alarm' });
    if (!design.tags.some((t) => t.address.trim().toUpperCase() === a)) {
      design.tags.push({ name: al.nickname.replace(/[^A-Za-z0-9]+/g, '_'), address: a, dataType: 'BIT', access: 'read', description: `From the upgraded program: ${al.why}.`, role: `alarm:program:${a}` });
    }
  }
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
  // An imported word's bits ("Alm[0].3" of "Alm[0]"): a MOV / COPY / math into the word clears them all.
  const nick = new Map(ladder.tags.map((t) => [t.address.trim().toUpperCase(), t.nickname] as const));
  const cleared = ladder.rungs.flatMap((r) => r.outputs).flatMap((o) => (o.type === 'COPY' || o.type === 'MATH' ? [nick.get(o.dest.trim().toUpperCase())] : [])).filter((n): n is string => !!n);
  if (cleared.length) for (const t of ladder.tags) if (cleared.some((w) => t.nickname.startsWith(`${w}.`))) resets.add(t.address.trim().toUpperCase());
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
 * The HMI Stop is wired in only when its bit is a normally-closed contact in the run latch (the rung that
 * writes the running bit; any coil rung when that is not known): a plain read of it stops nothing.
 */
function stopWired(address: string, ladder: LadderProgram, running?: string): boolean {
  const a = address.trim().toUpperCase(), run = running?.trim().toUpperCase();
  return ladder.rungs.some((r) => r.outputs.some((o) => (o.type === 'OUT' || o.type === 'SET') && (!run || o.address.trim().toUpperCase() === run))
    && r.branches.some((b) => b.some((e) => e.type === 'NC' && e.address.trim().toUpperCase() === a)));
}
const runningOf = (design: HmiDesign) => design.tags.find((t) => t.role === 'sts:running')?.address;

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
    if (out.has(a) || filled.has(a)) continue;
    if (t.role === 'cmd:stop' ? stopWired(a, ladder, runningOf(design)) : implemented(t, use)) continue;
    const p = t.role ? parallel.get(t.role) : undefined;
    const alarm = alarms.get(a);
    const constPreset = t.role === 'sp:batch' ? roles.constPresets?.[0] : undefined;
    const change = constPreset
      ? `Use ${t.name} (${a}) as the preset of ${constPreset.nickname} (${constPreset.address}) instead of the fixed ${constPreset.preset}, so the operator sets the batch on the HMI.`
      : p
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
    if (t?.role === 'cmd:stop') return !stopWired(c.address, ladder, runningOf(design));
    if (alarm.has(c.address)) return !use.writes.has(c.address);
    return t ? !implemented(t, use) : !use.writes.has(c.address) && !use.reads.has(c.address);
  });
}


const ADDR = '(?:X|Y|C|DS|DD|DF|DH|CTD|CT|TD|T)\\d+';
const PAIR_OR_BARE = new RegExp(`([A-Za-z_][\\w.]*) \\((${ADDR})\\)|\\b(${ADDR})\\b`, 'g');

/**
 * A change text in the PLC's own tag names, so it can be typed straight into the programming software:
 * "HMI_Start (C1001) in parallel with Start_PB (X102)" reads "HMI_Start in parallel with Start_PB" on Logix,
 * '"Machine_DB".HMI_Start … Start_PB (%I0.0)' on TIA; CLICK addresses are already its own.
 */
export function inPlcNames(text: string, nameOf: (address: string) => { name: string; io?: string }): string {
  return text.replace(PAIR_OR_BARE, (all, word: string | undefined, pairAddr: string | undefined, bare: string | undefined) => {
    const a = (pairAddr ?? bare)!;
    const raw = nameOf(a);
    // A counter / timer by itself (CT3, T2) is the instruction, not its done bit: "Pallet_Count", not "Pallet_Count.DN".
    const n = /^(CT|T)\d+$/i.test(a) ? { ...raw, name: raw.name.replace(/\.(DN|Q|QU|QD|CU|CD|EN|TT)$/i, '') } : raw;
    if (bare) return n.name || n.io || bare;
    if (n.io && n.name && !n.name.endsWith(word!)) return `${word} (${n.io})`;
    if (n.io && /^%/.test(n.io)) return `${word} (${n.io})`;
    if (n.name) return n.name.endsWith(word!) ? n.name : `${word} (${n.name})`;
    return n.io ? `${word} (${n.io})` : all;
  });
}
