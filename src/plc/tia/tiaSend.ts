/**
 * What "Send to TIA Portal" puts into the TIA Portal project (tools/tia-bridge commands plc and tags), from the
 * project: the CPU by its order number with the local signal modules in their slots, and the PLC tags (the same
 * list as the .sdf tag table export: the program's tags and the wired I/O it does not use yet).
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { buildScl, unusedIoTags } from '../core/profiles/siemens';

export interface TiaPlcRequest {
  orderNumber: string;
  name: string;
  /** Signal modules on the CPU's own rack, slot 2 onwards (S7-1200). */
  modules: { orderNumber: string; slot: number }[];
  /** What is left for the user to add in TIA Portal, in plain words. */
  notes: string[];
}

export interface TiaTagRow { name: string; dataType: string; logicalAddress: string; comment: string }

/** S7-1200 signal modules (SM 122x digital, SM 123x analog) go right of the CPU, slots 2–9. */
const SM_1200 = /^6ES72[23]\d-/;

export function tiaPlcRequest(p: ProjectSnapshot): TiaPlcRequest {
  const notes: string[] = [];
  const modules: TiaPlcRequest['modules'] = [];
  const rackOfCpu = p.cpu.platformId !== 'siemens-s7-1500';
  for (const part of p.modules) {
    if (rackOfCpu && SM_1200.test(part) && modules.length < 8) modules.push({ orderNumber: part, slot: modules.length + 2 });
    else notes.push(rackOfCpu ? `${part}: add it in TIA Portal (Device view) by hand.` : `${part}: ET 200SP I/O is added in TIA Portal by hand for now (Network view › ET 200SP).`);
  }
  return { orderNumber: p.cpu.id, name: 'PLC_1', modules, notes };
}

/** The PLC tags, as the tag table export writes them. */
export function tiaTagRows(p: ProjectSnapshot): TiaTagRow[] {
  const ctx = exportContext(p);
  const used = buildScl(p.ladder, ctx).tags;
  return [...used, ...unusedIoTags(p.ladder, ctx, used)].map((t) => ({ name: t.name, dataType: t.type, logicalAddress: t.address, comment: t.inferred ? `${t.comment} — check against Device configuration` : t.comment }));
}

/** The TIA Portal project's name for a project name (as its files are named). */
export const tiaProjectName = (projectName: string) => projectName.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Machine';
