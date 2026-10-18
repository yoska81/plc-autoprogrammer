/**
 * The program and the HMI follow the I/O addresses. After an edit that moves them, one remap (ioRemap.ts) is
 * built from the addresses before and after: an I/O list edit (useIOStore onIoChange), or a PLC / CPU / module
 * change made through `withIoRemap` (the PLC page, the equipment choice, an applied improvement). The program's operands follow their points
 * (remapProgram.ts), and so does every registered participant (the HMI, Dev 5's remapHmiDesign). Anything on a
 * deleted point is flagged, never silently pointed at whatever input took its address.
 * Deleting a point: `ioUsesOf` lists what uses it (for the confirmation), and `deletePointWithUndo` keeps
 * one undo (the I/O list, the program and each participant as they were).
 */
import { useIOStore, onIoChange } from '../../store/useIOStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useProgramStore } from '../../store/useProgramStore';
import type { IOPoint } from '../../types/io';
import { getCpu, getProfile } from './profiles';
import { resolveAddresses } from './profile';
import { moduleSlots } from './modules';
import { rungAddresses } from './ladder';
import { ioRemap, remapIsEmpty, type IoRemap } from './ioRemap';
import { remapProgram } from './remapProgram';

/** Another design that names I/O addresses (the HMI): it follows a remap, says what uses an address, and can be put back. */
export interface IoParticipant {
  name: string;
  /** Rewrite through the remap; returns what to tell the user. `describe` names an I/O point (by id) as it was. */
  apply: (r: IoRemap, describe: (ioId: string) => string) => string[];
  /** What uses the address, in a few words each ("Screen Main: lamp 'Running'"). */
  usesOf: (address: string) => string[];
  /** Keep the design as it is now; the returned function puts it back. */
  snapshot: () => () => void;
}
const participants: IoParticipant[] = [];
export function registerIoParticipant(p: IoParticipant): () => void {
  participants.push(p);
  return () => { const i = participants.indexOf(p); if (i >= 0) participants.splice(i, 1); };
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
  const remap = ioRemap(ioAddresses(prev, prevSetup), ioAddresses(next, nextSetup));
  if (remapIsEmpty(remap)) return { remap, messages: [] };
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
  }
  for (const p of participants) messages.push(...p.apply(remap, describe));
  return { remap, messages };
}

// Inside withIoRemap the I/O store's own notifications are skipped: the wrapper remaps once, at the end.
let wrapping = 0;
/**
 * A change that can move addresses in several steps (a PLC / CPU / module choice, maybe with I/O added): the
 * addresses before, the change, then one remap of the program and the HMI. Returns what to tell the user.
 */
export function withIoRemap(change: () => void): string[] {
  const prevIo = useIOStore.getState().projectIO, prevSetup = plcSetup();
  wrapping++;
  try { change(); } finally { wrapping--; }
  return applyIoChange(prevIo, useIOStore.getState().projectIO, prevSetup, plcSetup()).messages;
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
/** The last delete that can be undone (its label, e.g. "Delete I004 Photo eye"). */
export const lastIoUndo = () => (undo ? undo.label : null);

/** Delete a point, keeping one undo; returns what changed in the program / HMI. */
export function deletePointWithUndo(id: string): string[] {
  const io = useIOStore.getState().projectIO;
  const point = io.find((p) => p.id === id);
  if (!point) return [];
  const { ladder, versions } = useProgramStore.getState();
  const restores = participants.map((p) => p.snapshot());
  const messages: string[] = [];
  lastMessages = messages;
  useIOStore.getState().deletePoint(id);
  lastMessages = null;
  undo = {
    label: `Delete ${id}${point.description ? ` ${point.description}` : ''}`,
    restore: () => {
      // Put back exactly what was there (no remap: the list, the program and the HMI are restored together).
      useIOStore.setState({ projectIO: io });
      useProgramStore.getState().editLadder(ladder);
      useProgramStore.setState({ versions });
      for (const r of restores) r();
    },
  };
  return messages;
}

/** Undo the last delete; false when there is nothing to undo. */
export function undoIoDelete(): boolean {
  if (!undo) return false;
  undo.restore();
  undo = null;
  return true;
}

onIoChange((prev, next) => {
  if (wrapping) return;
  const { messages } = applyIoChange(prev, next);
  lastMessages?.push(...messages);
});
