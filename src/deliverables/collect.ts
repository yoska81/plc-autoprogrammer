import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useSpecStore } from '../store/useSpecStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { analogSetup } from '../plc/core/analog';
import { validateProgram } from '../plc/core/validate';
import { getPart } from '../electrical/catalog';
import type { DrawingContext } from '../electrical/derive';
import { docInfo } from './docInfo';
import { checkoutFor } from '../online/useCheckoutStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { useProjectsStore } from '../store/useProjectsStore';

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
    analog: analogSetup(profile, cpu, moduleSlots(modules), io),
  } : null;

  return {
    projectName: program.projectName,
    fileBase: program.projectName.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'plc_project',
    profile, cpu, modules, spec, io, addresses, labels,
    ladder: program.ladder,
    stCode: program.generatedCode,
    issues: profile.language === 'ladder' ? validateProgram(program.ladder, profile, ioAddressSet) : [],
    electrical: electrical.design,
    drawingCtx,
    hmi: hmi.design,
    info,
    /** Commissioning I/O check-out (Online page), by I/O id. */
    checkout: checkoutFor(useProjectsStore.getState().activeId),
    /** Questions and answers (part of the specification). */
    questions: useQuestionStore.getState().byProject[useProjectsStore.getState().activeId ?? 'default'] ?? [],
    equipment: recommendation ? {
      cpu: cpuId,
      why: recommendation.plc.cpuId === cpuId ? recommendation.plc.why : '',
      modules,
      hmi: hmi.design?.hmiPartNumber || hmi.hmiPartNumber || null,
    } : null,
  };
}

export type ProjectSnapshot = ReturnType<typeof collectProject>;
