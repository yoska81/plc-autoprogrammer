/**
 * The PLC's own name of a physical I/O point, for what the HMI shows (Diagnostics lamps and their group titles):
 * %I0.0 on an S7, _IO_EM_DI_00 on a Micro800, I 0 on a Unitronics. CLICK names them as the app does. A name too
 * long for a lamp label (Logix Local:1:I.Data.0) keeps the app's address on the screen; the HMI tag list shows it.
 * The saved design keeps the app's addresses (the I/O remap, the checker and other PLCs work on them); the PLC's
 * names are put in when a screen is drawn, so a PLC or module change never leaves them stale.
 */
import { useMemo } from 'react';
import type { CpuModel, ModuleSlot, PlcProfile } from '../plc/core/profile';
import { useProjectStore } from '../store/useProjectStore';
import { useIOStore } from '../store/useIOStore';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import type { IOPoint } from '../types/io';
import type { HmiScreen } from './types';

const MAX = 12;

/** Only addresses of the project's real I/O points get a name: a stale tag on X001 never borrows another point's %I0.0. */
export function screenIoName(profile: PlcProfile, cpu: CpuModel, modules: ModuleSlot[], io: Set<string>): ((address: string) => string | null) | undefined {
  if (profile.id === 'click' || !profile.ioTag) return undefined;
  return (a) => {
    const up = a.toUpperCase();
    if (!io.has(up)) return null;
    const t = profile.ioTag!(up, modules, cpu.id);
    return t && t.length <= MAX && t.toUpperCase() !== up ? t : null;
  };
}

/** A label with each I/O address that has a PLC name shown by that name ("X001 E-stop OK" → "%I0.0 E-stop OK"). */
export function nativeIoLabel(label: string, ioName: ((address: string) => string | null) | undefined): string {
  return ioName && label ? label.replace(/\b[XY]\d+\b/gi, (a) => ioName(a) ?? a) : label;
}

/** A screen as drawn: its labels with the PLC's I/O names. */
export function nativeScreen(screen: HmiScreen, ioName: ((address: string) => string | null) | undefined): HmiScreen {
  if (!ioName) return screen;
  return { ...screen, elements: screen.elements.map((e) => (e.label ? { ...e, label: nativeIoLabel(e.label, ioName) } : e)) };
}

type IoName = ((address: string) => string | null) | undefined;
// One result for all screens drawn at once (thumbnails, editor, images): recomputed only when the PLC, CPU, modules
// or I/O list change.
let last: { key: readonly unknown[]; fn: IoName } | null = null;

/** The project's I/O names, for these store values (undefined on CLICK). */
export function ioNameFor(plcId: string, cpuId: string, modules: string[], io: IOPoint[]): IoName {
  const key = [plcId, cpuId, modules, io] as const;
  if (last && last.key.every((k, i) => k === key[i])) return last.fn;
  const profile = getProfile(plcId);
  const cpu = getCpu(profile, cpuId);
  const slots = moduleSlots(modules);
  const points = new Set([...resolveAddresses(profile, cpu, io, slots).values()].map((a) => a.toUpperCase()).filter(Boolean));
  last = { key, fn: screenIoName(profile, cpu, slots, points) };
  return last.fn;
}

/** The project's I/O names for drawing screens (undefined on CLICK); narrow store reads, one shared result. */
export function useScreenIoName(): IoName {
  const plcId = useProjectStore((st) => st.plcId), cpuId = useProjectStore((st) => st.cpuId), modules = useProjectStore((st) => st.modules);
  const io = useIOStore((st) => st.projectIO);
  return useMemo(() => ioNameFor(plcId, cpuId, modules, io), [plcId, cpuId, modules, io]);
}
