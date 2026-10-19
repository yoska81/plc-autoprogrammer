/**
 * The PLC's own name of a physical I/O address, for what the HMI shows the operator (Diagnostics lamps and their
 * group titles): %I0.0 on an S7, _IO_EM_DI_00 on a Micro800, I 0 on a Unitronics. CLICK names them as the app does
 * (null). A name too long for a lamp label (Logix Local:1:I.Data.0) keeps the app's address on the screen; the HMI
 * tag list shows the full name.
 */
import type { CpuModel, ModuleSlot, PlcProfile } from '../plc/core/profile';

const MAX = 12;

export function screenIoName(profile: PlcProfile, cpu: CpuModel, modules: ModuleSlot[]): ((address: string) => string | null) | undefined {
  if (profile.id === 'click' || !profile.ioTag) return undefined;
  return (a) => {
    const t = profile.ioTag!(a, modules, cpu.id);
    return t && t.length <= MAX && t.toUpperCase() !== a.toUpperCase() ? t : null;
  };
}
