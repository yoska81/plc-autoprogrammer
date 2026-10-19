/**
 * PLC tag of each neutral program address (C1001, DS1001, X001…) exactly as the exported program
 * names it (src/plc/core/tagNames.ts runs the exporters' own naming, HMI nicknames included).
 */
import type { ProjectSnapshot } from './collect';
import { plcTagNames, type PlcTagName } from '../plc/core/tagNames';
import { exportContext } from './exportContext';

export function plcTagNameOf(p: ProjectSnapshot): (address: string) => PlcTagName {
  const names = p.profile.language === 'ladder' ? plcTagNames(p.profile, p.ladder, exportContext(p)) : new Map<string, PlcTagName>();
  const { modules, cpuId } = exportContext(p);
  // Physical I/O names only for the project's real I/O points: a stale tag on X001 (an S7-1500 + ET 200SP whose
  // inputs start at X101) must not borrow %I0.0, which is X101's.
  const points = new Set([...p.addresses.values()].map((a) => a.toUpperCase()).filter(Boolean));
  const real = (a: string, t: PlcTagName): PlcTagName => (t.io && !points.has(a.toUpperCase()) ? { ...t, io: undefined } : t);
  return (a) => {
    const known = names.get(a.toUpperCase());
    if (known) return real(a, known);
    if (p.profile.id === 'click') return { name: a, scope: 'CLICK', dataType: '' };
    return real(a, { name: '', scope: '', dataType: '', io: p.profile.ioTag?.(a, modules ?? [], cpuId) ?? undefined });
  };
}
