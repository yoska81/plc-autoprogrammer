import { withDrawingOptions } from '../standards/drawingOptions';
import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useSpecStore } from '../store/useSpecStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useHmiStore } from '../store/useHmiStore';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { ptoPointsFor } from '../electrical/highSpeedIo';
import { analogSetup } from '../plc/core/analog';
import { validateProgram } from '../plc/core/validate';
import { getPart } from '../electrical/catalog';
import type { DrawingContext } from '../electrical/derive';
import { docInfo } from './docInfo';
import { layoutFor } from '../electrical/layout/useLayoutStore';
import { layoutForDesign } from '../electrical/layout/geometry';
import { checkoutFor } from '../online/useCheckoutStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { noTouchPanelNow } from '../hmi/projectPanel';

/** Everything the deliverables need, read once from the stores. */
export function collectProject() {
  const program = useProgramStore.getState();
  const io = useIOStore.getState().projectIO;
  const { plcId, cpuId, modules, recommendation, info } = useProjectStore.getState();
  const spec = useSpecStore.getState().sections;
  const electrical = useElectricalStore.getState();
  const hmiState = useHmiStore.getState();
  // No touch panel: screens left from an earlier panel are ignored everywhere (src/hmi/projectPanel.ts).
  const noHmi = noTouchPanelNow();
  const hmi = noHmi ? { ...hmiState, design: null } : hmiState;
  const hmiPart = noHmi ? null : hmi.design?.hmiPartNumber || hmi.hmiPartNumber || null;

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

  const drawingCtx: DrawingContext | null = electrical.design ? withDrawingOptions({
    projectName: program.projectName,
    design: electrical.design,
    getPart,
    plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
    io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })),
    region: info.region,
    hmiPartNumber: hmiPart,
    doc: docInfo(info),
    machineLayout: layoutForDesign(layoutFor(useProjectsStore.getState().activeId)),
    analog: analogSetup(profile, cpu, moduleSlots(modules), io),
  }, info) : null;

  return {
    projectName: program.projectName,
    fileBase: program.projectName.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'plc_project',
    profile, cpu, modules, spec, io, addresses, labels,
    ladder: program.ladder,
    stCode: program.generatedCode,
    // The neutral ladder is checked against the selected PLC (every vendor exports from it) and the project's HMI.
    issues: program.ladder.rungs.length ? validateProgram(program.ladder, profile, ioAddressSet, hmi.design ?? undefined, { noPanel: noHmi, ...(profile.id === 'click' ? { pulseOutputs: ptoPointsFor(cpu.id, modules) } : {}) }) : [],
    electrical: electrical.design,
    drawingCtx,
    hmi: hmi.design,
    /** Built without a touch panel: the operator uses pushbuttons, a selector and lamps (the operator station). */
    noHmi,
    info,
    /** Commissioning I/O check-out (Online page), by I/O id. */
    checkout: checkoutFor(useProjectsStore.getState().activeId),
    /** Questions and answers (part of the specification). */
    questions: useQuestionStore.getState().byProject[useProjectsStore.getState().activeId ?? 'default'] ?? [],
    equipment: recommendation ? {
      cpu: cpuId,
      why: recommendation.plc.cpuId === cpuId ? recommendation.plc.why : '',
      modules,
      hmi: hmiPart,
    } : null,
  };
}

export type ProjectSnapshot = ReturnType<typeof collectProject>;
