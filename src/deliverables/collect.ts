import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useSpecStore } from '../store/useSpecStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { getCpu, getProfile } from '../plc/profiles';
import { resolveAddresses } from '../plc/profile';
import { moduleSlots } from '../plc/modules';
import { validateProgram } from '../plc/validate';
import { getPart } from '../electrical/catalog';
import type { DrawingContext } from '../electrical/derive';
import { docInfo } from './docInfo';

/** Everything the deliverables need, read once from the stores. */
export function collectProject() {
  const program = useProgramStore.getState();
  const io = useIOStore.getState().projectIO;
  const { plcId, cpuId, modules, recommendation, info } = useProjectStore.getState();
  const spec = useSpecStore.getState().sections;
  const electrical = useElectricalStore.getState();
  const hmi = useHmiStore.getState();

  const profile = getProfile(plcId);
  const cpu = getCpu(profile, cpuId);
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(modules));
  const ioAddressSet = new Set([...addresses.values()].filter(Boolean));
  const labels = new Map<string, string>();
  for (const t of program.ladder.tags) labels.set(t.address, t.nickname);
  for (const p of io) {
    const a = addresses.get(p.id);
    if (a && p.description) labels.set(a, p.description);
  }

  const drawingCtx: DrawingContext | null = electrical.design ? {
    projectName: program.projectName,
    design: electrical.design,
    getPart,
    plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
    io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })),
    region: info.region,
    hmiPartNumber: hmi.design?.hmiPartNumber || hmi.hmiPartNumber || null,
    doc: docInfo(info),
  } : null;

  return {
    projectName: program.projectName,
    fileBase: program.projectName.trim().replace(/[^\w-]+/g, '_') || 'plc_project',
    profile, cpu, spec, io, addresses, labels,
    ladder: program.ladder,
    stCode: program.generatedCode,
    issues: profile.language === 'ladder' ? validateProgram(program.ladder, profile, ioAddressSet) : [],
    electrical: electrical.design,
    drawingCtx,
    hmi: hmi.design,
    info,
    equipment: recommendation ? {
      cpu: cpuId,
      why: recommendation.plc.cpuId === cpuId ? recommendation.plc.why : '',
      modules,
      hmi: hmi.design?.hmiPartNumber || hmi.hmiPartNumber || null,
    } : null,
  };
}

export type ProjectSnapshot = ReturnType<typeof collectProject>;
