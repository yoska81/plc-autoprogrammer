import { useMemo } from 'react';
import { usePlc } from '../plc/usePlc';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProgramStore } from '../store/useProgramStore';
import { getPart } from './catalog';
import type { DrawingContext } from './derive';

/** Everything the drawing engine needs, or null when there is no design yet. */
export function useDrawingContext(): DrawingContext | null {
  const design = useElectricalStore((s) => s.design);
  const projectName = useProgramStore((s) => s.projectName);
  const { profile, cpu, io, addresses } = usePlc();

  return useMemo(() => {
    if (!design) return null;
    return {
      projectName,
      design,
      getPart,
      plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
      io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })),
    };
  }, [design, projectName, profile, cpu, io, addresses]);
}
