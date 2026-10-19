/**
 * The PLC's own names for the app's operands, for the Program page and the Simulator ladder: what the engineer
 * sees in TIA Portal / Studio 5000 after the export. Siemens: an I/O tag "E_Stop_OK" (at %I0.0) and the program
 * block's members #Safety_OK, #Push_Timeout.Q, #FirstScan; Logix: Start_PB, Push_Timeout.DN, S:FS. Built with
 * the exporters' own naming (src/plc/core/tagNames.ts), so the ladder matches the exported files. CLICK and
 * PLCs that are programmed in their own text get none: their operands are shown as they are.
 */
import { useMemo } from 'react';
import type { LadderProgram } from '../../core/ladder';
import type { ExportContext, PlcProfile } from '../../core/profile';
import { plcTagNames } from '../../core/tagNames';
import type { PlcNameOf } from './mnemonics';
import { usePlc } from '../../core/usePlc';
import { useHmiStore } from '../../../store/useHmiStore';
import { useProgramStore } from '../../../store/useProgramStore';

/** System bits as each PLC writes them (the exporters translate SC1 / SC2 / SC7 the same way). */
const SYSTEM: Record<string, Record<string, string>> = {
  'siemens-s7': { SC1: 'TRUE', SC2: '#FirstScan', SC7: '1 s clock' },
  logix: { SC1: 'always on', SC2: 'S:FS', SC7: '1 s clock' },
};

/** The lookup for a program on a PLC (undefined: show the app's operands — CLICK, or no ladder export). */
export function plcNameLookup(profile: PlcProfile, program: LadderProgram, ctx: ExportContext): PlcNameOf | undefined {
  if (profile.id === 'click' || profile.language !== 'ladder') return undefined;
  let names: ReturnType<typeof plcTagNames>;
  try { names = plcTagNames(profile, program, ctx); } catch { return undefined; }
  const system = SYSTEM[profile.id] ?? {};
  return (address) => {
    const a = address.trim().toUpperCase();
    if (!a) return null;
    if (system[a]) return { name: system[a] };
    const t = names.get(a);
    if (!t?.name) return t?.io ? { name: t.io } : null;
    if (profile.id === 'siemens-s7') {
      // TIA Portal: an I/O point is its PLC tag "Name" at %I / %Q; anything else a member of the program block, #Name.
      const member = t.name.replace(/^"Machine_DB"\./, '');
      return t.io ? { name: `"${member}"`, io: t.io } : { name: `#${member}` };
    }
    return { name: t.name, ...(t.io ? { io: t.io } : {}) };
  };
}

/** The open project's lookup for a ladder program (the Program page's or the simulator's). */
export function usePlcNames(program: LadderProgram): PlcNameOf | undefined {
  const plc = usePlc();
  const hmiTags = useHmiStore((s) => s.design?.tags);
  const projectName = useProgramStore((s) => s.projectName);
  return useMemo(() => plcNameLookup(plc.profile, program, {
    io: plc.io, addresses: plc.addresses, labels: plc.labels, header: '', cpuId: plc.cpu.id, modules: plc.modules, projectName,
    // The HMI's tag names become the PLC's tag names in the export: the same here.
    extraTags: (hmiTags ?? []).map((t) => ({ address: t.address, nickname: t.name, comment: `HMI: ${t.description}` })),
  }), [plc, program, hmiTags, projectName]);
}
