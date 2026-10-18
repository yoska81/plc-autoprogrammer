import { useProjectPanelPart } from '../spec/panelNow';
import { useMemo } from 'react';
import { usePlc } from '../plc/core/usePlc';
import { useElectricalStore } from '../store/useElectricalStore';
import { useProgramStore } from '../store/useProgramStore';
import { useProjectStore } from '../store/useProjectStore';
import { getPart } from './catalog';
import type { DrawingContext } from './derive';
import { docInfo } from '../deliverables/docInfo';
import { useMachineLayout } from './layout/useLayoutStore';
import { layoutForDesign } from './layout/geometry';
import { withDrawingOptions } from '../standards/drawingOptions';

/**
 * Everything the drawing engine needs, or null when there is no design yet. `raw` skips the
 * project's drawing options (IEC designations rename tags), for editors that store tags.
 */
export function useDrawingContext(opts: { raw?: boolean } = {}): DrawingContext | null {
  const raw = Boolean(opts.raw);
  const design = useElectricalStore((s) => s.design);
  const projectName = useProgramStore((s) => s.projectName);
  const { profile, cpu, io, addresses, analog } = usePlc();
  const info = useProjectStore((s) => s.info);
  const hmiPartNumber = useProjectPanelPart();
  const [layout] = useMachineLayout();
  const machineLayout = useMemo(() => layoutForDesign(layout), [layout]);

  return useMemo(() => {
    if (!design) return null;
    const ctx: DrawingContext = {
      projectName,
      design,
      getPart,
      plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
      io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })),
      region: info.region,
      hmiPartNumber,
      doc: docInfo(info),
      machineLayout,
      analog,
    };
    return raw ? ctx : withDrawingOptions(ctx, info);
  }, [design, projectName, profile, cpu, io, addresses, info, hmiPartNumber, machineLayout, analog, raw]);
}
