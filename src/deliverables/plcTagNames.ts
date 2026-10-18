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
  return (a) => names.get(a.toUpperCase())
    ?? (p.profile.id === 'click' ? { name: a, scope: 'CLICK', dataType: '' } : { name: '', scope: '', dataType: '', io: p.profile.ioTag?.(a, modules ?? [], cpuId) ?? undefined });
}
