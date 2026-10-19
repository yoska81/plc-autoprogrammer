/**
 * The program and the HMI follow the I/O addresses. After an edit that moves them, one remap (ioRemap.ts) is
 * built from the addresses before and after: an I/O list edit (useIOStore onIoChange), or a PLC / CPU / module
 * change made through `withIoRemap` (the PLC page, the equipment choice, an applied improvement). The program's operands follow their points
 * (remapProgram.ts), and so does every registered participant (the HMI, Dev 5's remapHmiDesign). Anything on a
 * deleted point is flagged, never silently pointed at whatever input took its address.
 * Deleting a point: `ioUsesOf` lists what uses it (for the confirmation), and `deletePointWithUndo` keeps
 * one undo (the I/O list, the program and each participant as they were).
 */
import { create } from 'zustand';
import { useIOStore, onIoChange } from '../../store/useIOStore';
import { IO_LAYOUT_VERSION, useProjectStore } from '../../store/useProjectStore';
import { useProgramStore } from '../../store/useProgramStore';
import type { IOPoint } from '../../types/io';
import { getCpu, getProfile } from './profiles';
import { resolveAddresses } from './profile';
import { moduleSlots } from './modules';
import { rungAddresses } from './ladder';
import { ioRemap, remapIsEmpty, type IoRemap } from './ioRemap';
import { remapProgram } from './remapProgram';
import { legacyClickAddresses, legacyToCurrentAddress } from './profiles/click';
import { ptoPointsFor } from '../../electrical/highSpeedIo';
import { backupActiveProject, onProjectLoaded } from '../../store/useProjectsStore';
import { notify } from '../../store/useNoticeStore';

/** Another design that names I/O addresses (the HMI): it follows a remap, says what uses an address, and can be put back. */
export interface IoParticipant {
  name: string;
  /** Rewrite through the remap; returns what to tell the user. `describe` names an I/O point (by id) as it was. */
  apply: (r: IoRemap, describe: (ioId: string) => string) => string[];
  /** What uses the address, in a few words each ("Screen Main: lamp 'Running'"). */
  usesOf: (address: string) => string[];
  /** Keep the design as it is now; the returned function puts it back. */
  snapshot: () => () => void;
  /** Call the listener on any later change to the design (a pending Undo is then dropped). */
  subscribe?: (listener: () => void) => () => void;
}
const participants: IoParticipant[] = [];
export function registerIoParticipant(p: IoParticipant): () => void {
  participants.push(p);
  const off = p.subscribe?.(() => { if (undo && undoRefs) setUndo(null); });
  return () => { off?.(); const i = participants.indexOf(p); if (i >= 0) participants.splice(i, 1); };
}

type PlcSetup = { plcId: string; cpuId: string; modules: string[] };
const plcSetup = (): PlcSetup => { const { plcId, cpuId, modules } = useProjectStore.getState(); return { plcId, cpuId, modules }; };

/** PLC address of each point (I/O id → address) for a PLC, CPU and modules (default: the project's). */
export function ioAddresses(io: IOPoint[], setup: PlcSetup = plcSetup()): Map<string, string> {
  const profile = getProfile(setup.plcId);
  return resolveAddresses(profile, getCpu(profile, setup.cpuId), io, moduleSlots(setup.modules));
}

/** The program (and its saved versions) and the participants after an address change; returns what to tell the user. */
export function applyIoChange(prev: IOPoint[], next: IOPoint[], prevSetup: PlcSetup = plcSetup(), nextSetup: PlcSetup = plcSetup()): { remap: IoRemap; messages: string[] } {
  const before = ioAddresses(prev, prevSetup), after = ioAddresses(next, nextSetup);
  const remap = ioRemap(before, after);
  const messages = applyRemap(remap, prev);
  // A smaller PLC: points that had an address and now have none (not enough I/O) — said, not only left to the checker.
  const lost = next.filter((p) => before.get(p.id) && !after.get(p.id));
  if (lost.length) messages.push(`${lost.length} I/O point${lost.length === 1 ? ' has' : 's have'} no address on the new PLC (not enough I/O): ${lost.slice(0, 6).map((p) => `${p.id} ${p.description}`.trim()).join(', ')}${lost.length > 6 ? '…' : ''}. Add a module or choose a bigger CPU.`);
  return { remap, messages };
}

/** Rewrite the program, its saved versions and the participants through a remap; returns what to tell the user. */
function applyRemap(remap: IoRemap, prev: IOPoint[]): string[] {
  if (remapIsEmpty(remap)) return [];
  const messages: string[] = [];
  const describe = (id: string) => prev.find((p) => p.id === id)?.description ?? '';
  const { ladder, editLadder, versions } = useProgramStore.getState();
  // Saved versions follow too, so restoring one later does not bring back the old addresses.
  if (versions.length) useProgramStore.setState({ versions: versions.map((v) => ({ ...v, program: remapProgram(v.program, remap).program })) });
  if (ladder.rungs.length) {
    const r = remapProgram(ladder, remap);
    editLadder(r.program);
    if (r.moved) messages.push(`Program: ${r.moved} operand${r.moved === 1 ? '' : 's'} moved with ${r.moved === 1 ? 'its point' : 'their points'}.`);
    const rungs = new Set(r.deleted.map((d) => d.rungId)).size;
    if (rungs) messages.push(`Program: ${rungs} rung${rungs === 1 ? '' : 's'} used ${[...new Set(r.deleted.map((d) => d.address))].join(', ')}, now deleted. The checker marks them until you pick the new I/O.`);
    if (r.raw.length) messages.push(`Program: ${r.raw.length} rung${r.raw.length === 1 ? ' has a kept vendor instruction' : 's have kept vendor instructions'} naming I/O that moved (rung${r.raw.length === 1 ? '' : 's'} ${r.raw.map((id) => ladder.rungs.findIndex((g) => g.id === id) + 1).join(', ')}) — not rewritten: check ${r.raw.length === 1 ? 'it' : 'them'} by hand.`);
  }
  for (const p of participants) messages.push(...p.apply(remap, describe));
  return messages;
}

/**
 * Projects saved before a CLICK PLUS option-slot module became slot 0 numbered its points X101… / Y101… (and
 * placed no pulse outputs first). On load, once, every point is kept on the same physical terminal: an old
 * address is that module's point on the slot it has now. Manual addresses are translated, and a point whose new
 * automatic address would be another terminal gets its old terminal as a fixed address, so a machine wired to
 * the old drawings keeps its wiring. The program, its saved versions and the HMI follow; a backup is kept first,
 * and the notice lists the fixed addresses and any pulse output that still has to move to a pulse-train output.
 */
export function migrateIoLayout(): string[] {
  const project = useProjectStore.getState();
  // Builds of this branch before ioLayoutVersion marked the slot-0 layout with ioLayout: 'click-slot0' (= version 2).
  const marked = (project as { ioLayout?: string }).ioLayout === 'click-slot0' ? 2 : 1;
  if ((project.ioLayoutVersion ?? marked) >= IO_LAYOUT_VERSION) return [];
  const setup = plcSetup();
  const slots = moduleSlots(setup.modules);
  if (setup.plcId !== 'click' || !slots.some((m) => m.optionSlot)) { useProjectStore.setState({ ioLayoutVersion: IO_LAYOUT_VERSION }); return []; }
  // While a project loads, the open-project id is not yet the loaded one: name the backup after the data itself.
  backupActiveProject('Before the CLICK PLUS address migration', useProgramStore.getState().projectName || undefined);
  useProjectStore.setState({ ioLayoutVersion: IO_LAYOUT_VERSION });
  const io = useIOStore.getState().projectIO;
  const cpu = getCpu(getProfile('click'), setup.cpuId);
  const legacy = legacyClickAddresses(io, cpu, slots);
  const want = new Map(io.map((p) => [p.id, legacyToCurrentAddress(legacy.get(p.id) ?? '', cpu, slots)] as const));
  // Manual addresses: the same terminal in today's numbering. Then fix the points whose automatic address moved
  // (fixing one can shift the next: repeat until every point is on its old terminal).
  let next = io.map((p) => (p.plcAddress?.trim() ? { ...p, plcAddress: want.get(p.id) || p.plcAddress } : p));
  // One at a time, in list order: fixing a point changes the automatic addresses of the ones after it, so only the
  // points that really need it get a fixed address.
  for (let k = 0; k <= io.length; k++) {
    const now = ioAddresses(next, setup);
    const off = next.find((p) => want.get(p.id) && now.get(p.id) !== want.get(p.id));
    if (!off) break;
    next = next.map((p) => (p.id === off.id ? { ...p, plcAddress: want.get(p.id), addressNote: 'kept on its wired terminal (migration)' } : p));
  }
  useIOStore.setState({ projectIO: next });
  const after = ioAddresses(next, setup);
  const messages = applyRemap(ioRemap(legacy, after), io);
  const fixed = next.filter((p) => p.plcAddress && !io.find((q) => q.id === p.id)?.plcAddress?.trim());
  if (fixed.length) messages.push(`To keep the wiring, ${fixed.length} point${fixed.length === 1 ? ' has' : 's have'} a fixed address on ${fixed.length === 1 ? 'its' : 'their'} old terminal: ${fixed.map((p) => `${p.id} ${p.description} → ${p.plcAddress}`).join(', ')}.`);
  const pto = new Set(ptoPointsFor(setup.cpuId, setup.modules));
  const pulses = next.filter((p) => p.type === 'output' && /\b(pulse|step|pul)\b/i.test(p.description) && !pto.has(after.get(p.id) ?? ''));
  if (pulses.length && pto.size) messages.push(`Pulse output${pulses.length === 1 ? '' : 's'} not on a pulse-train output (${[...pto].join(' / ')}): ${pulses.map((p) => `${p.id} ${p.description} (${after.get(p.id)})`).join(', ')} — move the wire there and set the address on the I/O list.`);
  if (messages.length) notify(`This project was saved with the older CLICK PLUS addressing (the option-slot module as slot 1). Every point stays on the same terminal; the addresses now start at X001 / Y001 on the option module, and the program and the HMI moved with them (a backup was kept). ${messages.join(' ')}`);
  return messages;
}

// Inside withIoRemap the I/O store's own notifications are skipped: the wrapper remaps once, at the end.
let wrapping = 0;
/**
 * A change that can move addresses in several steps (a PLC / CPU / module choice, maybe with I/O added): the
 * addresses before, the change, then one remap of the program and the HMI. Returns what to tell the user.
 */
export function withIoRemap(change: () => void, undoLabel?: string): string[] {
  const prevIo = useIOStore.getState().projectIO, prevSetup = plcSetup();
  const put = undoLabel ? snapshotAll() : null;
  wrapping++;
  try { change(); } finally { wrapping--; }
  const messages = applyIoChange(prevIo, useIOStore.getState().projectIO, prevSetup, plcSetup()).messages;
  if (put) offerUndo(undoLabel!, put);
  return messages;
}

/** The I/O list, the PLC choice, the program (and versions) and each participant's design as they are now; the returned function puts them back (no remap). */
function snapshotAll(): () => void {
  const io = useIOStore.getState().projectIO, setup = plcSetup();
  const { ladder, versions } = useProgramStore.getState();
  const restores = participants.map((p) => p.snapshot());
  return () => {
    useIOStore.setState({ projectIO: io });
    useProjectStore.setState(setup);
    useProgramStore.getState().editLadder(ladder);
    useProgramStore.setState({ versions });
    for (const r of restores) r();
  };
}
function offerUndo(label: string, restore: () => void) {
  setUndo({ label, restore });
  undoRefs = currentRefs();
}

/** What uses a point's address: program rungs (by number and comment) and the participants (the HMI). */
export function ioUsesOf(id: string): string[] {
  const a = ioAddresses(useIOStore.getState().projectIO).get(id)?.trim().toUpperCase();
  if (!a) return [];
  const { ladder } = useProgramStore.getState();
  const rungs = ladder.rungs.flatMap((g, i) => (rungAddresses(g).some((x) => x.trim().toUpperCase() === a) ? [`Program rung ${i + 1}${g.comment ? `: ${g.comment.slice(0, 60)}` : ''}`] : []));
  const motion = ladder.motion && [...ladder.motion.axes.flatMap((x) => [x.pulse, x.direction, x.limitPos, x.limitNeg]), ...ladder.motion.instructions.map((x) => x.homeSwitch), ...ladder.motion.counters.flatMap((c) => c.channels)].some((x) => x?.trim().toUpperCase() === a) ? ['Program motion setup (pulse axis / high-speed counter)'] : [];
  return [...rungs, ...motion, ...participants.flatMap((p) => p.usesOf(a))];
}

// The messages of the change in progress (deletePointWithUndo returns them).
let lastMessages: string[] | null = null;
let undo: { label: string; restore: () => void } | null = null;
/** The last delete that can still be undone, for the I/O page's Undo button (label, e.g. "Delete I004 Photo eye"). */
export const useIoUndo = create<{ label: string | null }>()(() => ({ label: null }));
export const lastIoUndo = () => (undo ? undo.label : null);
const setUndo = (u: typeof undo) => { undo = u; useIoUndo.setState({ label: u?.label ?? null }); };
// Undo puts back a whole snapshot, so it is offered only until the next change to the I/O list, the program or a
// participant's design: a later edit is never thrown away by it.
let undoRefs: unknown[] | null = null;
const currentRefs = () => { const p = useProjectStore.getState(); return [useIOStore.getState().projectIO, useProgramStore.getState().ladder, p.plcId, p.cpuId, p.modules]; };
const dropUndoOnChange = () => { if (undo && undoRefs && currentRefs().some((x, i) => x !== undoRefs![i])) setUndo(null); };
useIOStore.subscribe(dropUndoOnChange);
useProgramStore.subscribe(dropUndoOnChange);
useProjectStore.subscribe(dropUndoOnChange);

/** Delete a point, keeping one undo; returns what changed in the program / HMI. */
export function deletePointWithUndo(id: string): string[] {
  const io = useIOStore.getState().projectIO;
  const point = io.find((p) => p.id === id);
  if (!point) return [];
  // Undo puts back exactly what was there (no remap: the list, the program and the HMI are restored together).
  const put = snapshotAll();
  const messages: string[] = [];
  lastMessages = messages;
  useIOStore.getState().deletePoint(id);
  lastMessages = null;
  offerUndo(`Delete ${id}${point.description ? ` ${point.description}` : ''}`, put);
  return messages;
}

/** Undo the last delete; false when there is nothing to undo. */
export function undoIoDelete(): boolean {
  if (!undo) return false;
  const u = undo;
  setUndo(null);
  u.restore();
  return true;
}

onIoChange((prev, next) => {
  if (wrapping) return;
  const { messages } = applyIoChange(prev, next);
  lastMessages?.push(...messages);
});

// Saved projects: migrate an older address layout when one is opened, and the one already open at start-up.
onProjectLoaded(() => { migrateIoLayout(); });
// After every module is loaded, so the participants (the HMI) are registered.
queueMicrotask(() => { migrateIoLayout(); });
