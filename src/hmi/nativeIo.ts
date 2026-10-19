/**
 * The PLC's own name of a physical I/O point, for what the HMI shows (Diagnostics lamps and their group titles):
 * %I0.0 on an S7, _IO_EM_DI_00 on a Micro800, I 0 on a Unitronics. CLICK names them as the app does. A name too
 * long for a lamp label (Logix Local:1:I.Data.0) keeps the app's address on the screen; the HMI tag list shows it.
 * The saved design keeps the app's addresses (the I/O remap, the checker and other PLCs work on them); the PLC's
 * names are put in when a screen is drawn, so a PLC or module change never leaves them stale.
 */
import { useMemo } from 'react';
import type { CpuModel, ModuleSlot, PlcProfile } from '../plc/core/profile';
import { usePlc } from '../plc/core/usePlc';
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

/** The project's I/O names for drawing screens (undefined on CLICK). */
export function useScreenIoName() {
  const { profile, cpu, modules, ioAddressSet } = usePlc();
  return useMemo(() => screenIoName(profile, cpu, modules, new Set([...ioAddressSet].map((a) => a.toUpperCase()))), [profile, cpu, modules, ioAddressSet]);
}
