/**
 * PLC tag name of a neutral program address (C1001, DS1001, X001…) as the exported program names it.
 * CLICK: the address itself. Other PLCs: physical I/O through the profile's ioTag(); internal
 * memory waits for the PLC profiles' tag-name API (Dev 2) — until then it is marked "pending".
 */
import type { ProjectSnapshot } from './collect';
import { moduleSlots } from '../plc/core/modules';

export function plcTagNameOf(p: ProjectSnapshot): (address: string) => string {
  if (p.profile.id === 'click') return (a) => a;
  const modules = moduleSlots(p.modules);
  return (a) => p.profile.ioTag?.(a, modules) ?? `(pending: name of ${a} in the exported program)`;
}
