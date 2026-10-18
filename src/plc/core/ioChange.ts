/**
 * The program and the HMI follow the I/O list. After an edit that moves addresses (useIOStore onIoChange), one
 * remap (ioRemap.ts) is built from the addresses before and after. The program's operands follow their points
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
  /** Rewrite through the remap; returns what to tell the user (e.g. "2 HMI elements are bound to deleted points"). */
  apply: (r: IoRemap) => string[];
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

/** PLC address of each point (I/O id → address) for the project's PLC, CPU and modules. */
export function ioAddresses(io: IOPoint[]): Map<string, string> {
  const { plcId, cpuId, modules } = useProjectStore.getState();
  const profile = getProfile(plcId);
  return resolveAddresses(profile, getCpu(profile, cpuId), io, moduleSlots(modules));
}

/** The program and the participants after an I/O list change; returns what to tell the user. */
export function applyIoChange(prev: IOPoint[], next: IOPoint[]): { remap: IoRemap; messages: string[] } {
  const remap = ioRemap(ioAddresses(prev), ioAddresses(next));
  if (remapIsEmpty(remap)) return { remap, messages: [] };
  const messages: string[] = [];
  const { ladder, editLadder } = useProgramStore.getState();
  if (ladder.rungs.length) {
    const r = remapProgram(ladder, remap);
    editLadder(r.program);
    if (r.moved) messages.push(`Program: ${r.moved} operand${r.moved === 1 ? '' : 's'} moved with ${r.moved === 1 ? 'its point' : 'their points'}.`);
    const rungs = new Set(r.deleted.map((d) => d.rungId)).size;
    if (rungs) messages.push(`Program: ${rungs} rung${rungs === 1 ? '' : 's'} used ${[...new Set(r.deleted.map((d) => d.address))].join(', ')}, now deleted. The checker marks them until you pick the new I/O.`);
  }
  for (const p of participants) messages.push(...p.apply(remap));
  return { remap, messages };
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
  const ladder = useProgramStore.getState().ladder;
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
  const { messages } = applyIoChange(prev, next);
  lastMessages?.push(...messages);
});
