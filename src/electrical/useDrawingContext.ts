import { useMemo } from 'react';
import { usePlc } from '../plc/usePlc';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProgramStore } from '../store/useProgramStore';
import { useProjectStore } from '../store/useProjectStore';
import { useHmiStore } from '../store/useHmiStore';
import { getPart } from './catalog';
import type { DrawingContext } from './derive';
import { docInfo } from '../deliverables/docInfo';

/** Everything the drawing engine needs, or null when there is no design yet. */
export function useDrawingContext(): DrawingContext | null {
  const design = useElectricalStore((s) => s.design);
  const projectName = useProgramStore((s) => s.projectName);
  const { profile, cpu, io, addresses } = usePlc();
  const info = useProjectStore((s) => s.info);
  const hmiPartNumber = useHmiStore((s) => s.design?.hmiPartNumber || s.hmiPartNumber || null);

  return useMemo(() => {
    if (!design) return null;
    return {
      projectName,
      design,
      getPart,
      plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
      io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })),
      region: info.region,
      hmiPartNumber,
      doc: docInfo(info),
    };
  }, [design, projectName, profile, cpu, io, addresses, info, hmiPartNumber]);
}
