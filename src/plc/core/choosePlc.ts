import { PLC_PROFILES } from './profiles';
import { useProjectStore } from '../../store/useProjectStore';
import { useIOStore } from '../../store/useIOStore';
import { withIoRemap } from './ioChange';
import { modulesToFit, platformOf } from './fit';
import { needFromIo } from '../../spec/equipmentRules';

/**
 * A PLC / CPU choice (the PLC page, the Upgrade page's "Move it to another PLC"): the I/O is renumbered for it and
 * the program and the HMI follow (one remap, one Undo). A CPU change keeps the modules of the same rack and adds
 * what the I/O list needs; a new brand starts from an empty rack and takes its first CPU that holds the list.
 * Nothing fits: the CPU is still set (the PLC page shows the shortfall, never applied silently).
 * Returns what to tell the user about the renumbering.
 */
export function choosePlc(plcId: string, cpuId: string): string[] {
  const { plcId: curPlc, cpuId: curCpu, modules, setPlc, setModules } = useProjectStore.getState();
  const io = useIOStore.getState().projectIO;
  const need = needFromIo(io, false, 0);
  const sameRack = plcId === curPlc && platformOf(cpuId)?.id === platformOf(curCpu)?.id;
  const keep = sameRack ? modules : [];
  const next = io.length ? modulesToFit(cpuId, keep, need) ?? keep : keep;
  // The new CPU and its rack in one step: in between, the new CPU with the old rack's modules would leave points
  // without an address there behind, on another point's terminal.
  return withIoRemap(() => { setPlc(plcId, cpuId); setModules(next); }, `PLC change to ${cpuId}`);
}

/** A brand chosen: its first CPU (default first) that holds the I/O list with modules. */
export function choosePlcBrand(plcId: string): string[] {
  const p = PLC_PROFILES.find((x) => x.id === plcId);
  if (!p) return [];
  const need = needFromIo(useIOStore.getState().projectIO, false, 0);
  const first = useIOStore.getState().projectIO.length ? [p.defaultCpuId, ...p.cpuModels.map((c) => c.id)].find((id) => modulesToFit(id, [], need)) : undefined;
  return choosePlc(plcId, first ?? p.defaultCpuId);
}
