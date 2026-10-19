/**
 * The open project's PLC names (src/plc/core/plcNames.ts) for the Program page and the Simulator ladder.
 */
import { useMemo } from 'react';
import type { LadderProgram } from '../../core/ladder';
import { plcNameLookup, type PlcNameOf } from '../../core/plcNames';
import { usePlc } from '../../core/usePlc';
import { useHmiStore } from '../../../store/useHmiStore';
import { useProgramStore } from '../../../store/useProgramStore';

export { plcNameLookup };

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
