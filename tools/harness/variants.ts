/**
 * Browser-side harness (loaded through the Vite dev server by tools/gen-outputs.cjs).
 * Seeds the stores with the example project or a variant, then builds every deliverable
 * exactly like the Export page does, plus extra DXF options and JSON dumps of the derived
 * data so the Python checkers can cross-check the files.
 */
import { seedSampleProject, DESIGN, HMI, EXAMPLE_ID } from '../../src/preview/sampleProject';
import { useLayoutStore } from '../../src/electrical/layout/useLayoutStore';
import { EMPTY_LAYOUT, type LayoutItem, type LayoutItemKind } from '../../src/electrical/layout/types';
import { useProjectsStore } from '../../src/store/useProjectsStore';
import { useIOStore } from '../../src/store/useIOStore';
import { useProjectStore } from '../../src/store/useProjectStore';
import { useElectricalStore } from '../../src/store/useElectricalStore';
import { useHmiStore } from '../../src/store/useHmiStore';
import { useProgramStore } from '../../src/store/useProgramStore';
import { useSpecStore } from '../../src/store/useSpecStore';
import { collectProject } from '../../src/deliverables/collect';
import { buildEverythingZip } from '../../src/deliverables/files';
import { drillingDxf } from '../../src/electrical/dxf';
import {
  backPanelDrilling, billOfMaterials, cableSchedule, designWarnings, doorDrilling, motorFla, panelLayout,
  panelNameplate, revisionState, spareSpace, terminalPlan, wireNumbers, buildModel,
} from '../../src/electrical/derive';
import { buildLabels, labelsCsv } from '../../src/electrical/labels';
import { cabinetStepSummary } from '../../src/electrical/step/cabinetStep';
import { calculations } from '../../src/deliverables/docs/calcs';
import { alarmRows, programInfo } from '../../src/deliverables/docs/program';
import { getHmi } from '../../src/hmi/hmiCatalog';
import { runCodeRules } from '../../src/review/codeRules';
import { sccrTable } from '../../src/deliverables/docs/electrical';
import type { DesignComponent, ElectricalDesign, FieldDeviceType, IOWiring, MotorSpec } from '../../src/electrical/types';
import type { AnalogSpec, IOCategory } from '../../src/types/io';

type Point = { description: string; type: 'input' | 'output'; category: IOCategory; tag: string; deviceType: FieldDeviceType; location: string; part?: string; signal?: 'analog'; analog?: AnalogSpec };

const c = (tag: string, partNumber: string, quantity: number, fn: string, motorTag: string | null = null): DesignComponent => ({ tag, partNumber, quantity, function: fn, motorTag });

/** Seed I/O, then build ioWiring from the addresses the app resolves (so they always agree). */
function applyIo(points: Point[], modules: string[]): IOWiring[] {
  useIOStore.getState().importPoints(points.map(({ description, type, category, deviceType, signal, analog }) => ({ description, type, category, deviceType, ...(signal ? { signal, analog } : {}) })), true);
  useProjectStore.getState().setModules(modules);
  const p = collectProject();
  return p.io.map((io, i) => ({ address: p.addresses.get(io.id) ?? '', deviceTag: points[i].tag, deviceType: points[i].deviceType, description: points[i].description, location: points[i].location }));
}

function design(over: Partial<ElectricalDesign> & { components: DesignComponent[]; ioWiring: IOWiring[]; motors: MotorSpec[]; supply: ElectricalDesign['inputs']['supply'] }): ElectricalDesign {
  const { motors, supply, ...rest } = over;
  return {
    ...DESIGN,
    inputs: { ...DESIGN.inputs, supply, motors },
    machine: undefined,
    notes: [],
    ...rest,
  };
}

const SAMPLE_POINTS: Point[] = [
  { description: 'E-Stop OK (safety relay)', type: 'input', category: 'Safety', tag: 'SR1', deviceType: 'safety-relay-output', location: 'Cabinet' },
  { description: 'Start PB', type: 'input', category: 'Operator/HMI', tag: 'PB1', deviceType: 'pushbutton-no', location: 'Cabinet door' },
  { description: 'Stop PB', type: 'input', category: 'Operator/HMI', tag: 'PB2', deviceType: 'pushbutton-nc', location: 'Cabinet door' },
  { description: 'Part at end photo-eye', type: 'input', category: 'Product Detection', tag: 'PE1', deviceType: 'sensor-pnp', location: 'Pusher station' },
  { description: 'Pusher extended', type: 'input', category: 'Pneumatic', tag: 'LS1', deviceType: 'sensor-pnp', location: 'Pusher station' },
  { description: 'Conveyor motor contactor', type: 'output', category: 'Conveyor', tag: 'K1', deviceType: 'contactor-coil', location: 'Cabinet' },
  { description: 'Pusher solenoid', type: 'output', category: 'Pneumatic', tag: 'SOL1', deviceType: 'solenoid', location: 'Pusher station' },
];

const COMMON_DOOR = [
  c('SR1', 'LG5925-48-61-24', 1, 'E-stop safety relay'),
  c('ES1', 'GCX1131', 1, 'Emergency stop'),
  c('ES1C', 'ECX1030-2', 1, 'Second NC contact for dual-channel E-stop'),
  c('PB1', 'GCX1102', 1, 'Start'),
  c('PB2', 'GCX1101', 1, 'Stop'),
  c('PB4', 'GCX1104', 1, 'Safety Reset'),
  c('PE1', 'C18D-0P-1A', 1, 'Part at end photo-eye'),
  c('LS1', 'PNK-AP-3H', 1, 'Pusher extended prox'),
  c('SOL1', '100222015324006', 1, 'Pusher valve'),
];
const COMMON_ACC = [
  c('TB1', 'DN-T10-A', 30, 'Feed-through terminals'),
  c('TBG', 'DN-G10', 6, 'Ground terminals'),
  c('TBE', 'DN-EB35', 4, 'End brackets'),
  c('DIN', 'DN-R35S1', 3, 'DIN rail'),
  c('WD', 'T1-1530G-1', 4, 'Wire duct'),
  c('GB1', 'SCE-GB10', 1, 'Ground bar'),
];

export const VARIANTS = ['us480', 'ca600', 'us120', 'big', 'analog'] as const;
export type Variant = typeof VARIANTS[number];

export function setupVariant(v: Variant) {
  try { localStorage.clear(); } catch { /* ignore */ }
  useLayoutStore.setState({ byProject: {} });
  seedSampleProject();
  // The example lives in its own project now; make sure it is the open one.
  if (useProjectsStore.getState().activeId !== EXAMPLE_ID) useProjectsStore.getState().openProject(EXAMPLE_ID);
  const elec = useElectricalStore.getState();
  if (v === 'us480') return;
  if (v === 'analog') {
    // The example plus a tank: 4-20 mA level and temperature transmitters on a C0-04AD-1, pump speed reference on a C0-04DA-1.
    useIOStore.getState().importPoints([
      { description: 'Tank level', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } },
      { description: 'Tank temperature', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 150, units: '°C' } },
      { description: 'Pump speed reference', type: 'output', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 60, units: 'Hz' } },
    ], false);
    useProjectStore.getState().setModules(['C0-04AD-1', 'C0-04DA-1']);
    const d = useElectricalStore.getState().design!;
    elec.setDesign({ ...d, components: [...d.components, c('AI1', 'C0-04AD-1', 1, 'Analog input module'), c('AO1', 'C0-04DA-1', 1, 'Analog output module')] }, 'generated', 'variant analog');
    return;
  }
  if (v === 'ca600') {
    useProjectStore.getState().setInfo({ region: 'Canada', standards: ['NFPA 79', 'CSA C22.2 No. 14', 'CEC'], revisions: [{ rev: 'A', date: '2026-01-10', description: 'Issued for review', by: 'AI' }, { rev: 'B', date: '2026-02-01', description: 'Fuses, 600 V', by: 'AI' }] });
    const io = applyIo(SAMPLE_POINTS, []);
    const motors: MotorSpec[] = [{ tag: 'M1', description: 'Conveyor motor', hp: 2, voltage: '600VAC-3PH', starter: 'contactor-overload', reversing: false }];
    elec.setDesign(design({
      supply: '600VAC-3PH', motors, ioWiring: io,
      components: [
        c('ENC1', 'SCE-24EL2008LP', 1, 'Main enclosure 24x20x8'), c('SP1', 'SCE-24P20', 1, 'Back panel'),
        c('DS1', '22013003', 1, 'Main disconnect 30A'), c('DS1H', '14831111', 1, 'Disconnect handle'), c('DS1S', '14070520', 1, 'Disconnect shaft'),
        c('FU1', 'EHCC3DU', 1, 'Motor M1 branch fuses', 'M1'), c('FU1F', 'EDCC5', 3, 'Class CC fuses 5A for FU1', 'M1'),
        c('T1', 'CT-050-060-12-1', 1, 'Control transformer 600:120 V'),
        c('PS1', 'PSR-24-120', 1, '24VDC power supply'),
        c('K1', 'SC-E02PG-24VDC', 1, 'Conveyor motor contactor', 'M1'), c('OL1', 'TK-E02-340', 1, 'Conveyor motor overload', 'M1'),
        c('PLC', 'C0-10DD1E-D', 1, 'PLC CPU'),
        ...COMMON_DOOR, ...COMMON_ACC,
      ],
    }), 'generated', 'variant ca600');
    return;
  }
  if (v === 'us120') {
    const io = applyIo(SAMPLE_POINTS, []);
    const motors: MotorSpec[] = [{ tag: 'M1', description: 'Conveyor motor', hp: 0.5, voltage: '120VAC-1PH', starter: 'contactor-overload', reversing: false }];
    useHmiStore.getState().setDesign(null, null);
    useHmiStore.getState().setHmiPartNumber('');
    elec.setDesign(design({
      supply: '120VAC-1PH', motors, ioWiring: io, enclosureRating: undefined,
      components: [
        c('ENC1', 'SCE-16EL1206LP', 1, 'Main enclosure 16x12x6'), c('SP1', 'SCE-16P12', 1, 'Back panel'),
        c('DS1', '22013003', 1, 'Main disconnect 30A'), c('DS1H', '14831111', 1, 'Disconnect handle'), c('DS1S', '14070520', 1, 'Disconnect shaft'),
        c('CB1', 'GMCBU-1C-20', 1, 'Motor M1 branch protection', 'M1'), c('CB2', 'GMCBU-1C-5', 1, '24VDC power supply primary'),
        c('PS1', 'PSL-24-060', 1, '24VDC power supply'),
        c('K1', 'SC-E04PG-24VDC', 1, 'Conveyor motor contactor', 'M1'), c('OL1', 'TK-E02-1300', 1, 'Conveyor motor overload', 'M1'),
        c('PLC', 'C0-10DD1E-D', 1, 'PLC CPU'),
        ...COMMON_DOOR, ...COMMON_ACC.map((x) => x.tag === 'TB1' ? { ...x, quantity: 20 } : x),
      ],
    } as never), 'generated', 'variant us120');
    return;
  }
  // big: 4 VFDs + 2 DOL motors, 2 input modules + 1 output module, stack light, pilot lights, selector, 10" HMI
  useProjectStore.getState().setPlc('click', 'C0-11DD1E-D');
  useHmiStore.getState().setHmiPartNumber('CM5-T10W');
  useHmiStore.getState().setDesign({ ...HMI, hmiPartNumber: 'CM5-T10W' }, null);
  const pts: Point[] = [...SAMPLE_POINTS.filter((p) => p.type === 'input')];
  pts.push({ description: 'Auto/Manual selector', type: 'input', category: 'Operator/HMI', tag: 'SS1', deviceType: 'selector', location: 'Cabinet door' });
  pts.push({ description: 'Reset PB', type: 'input', category: 'Operator/HMI', tag: 'PB3', deviceType: 'pushbutton-no', location: 'Cabinet door' });
  for (let i = 1; i <= 24; i++) pts.push({ description: `Zone ${Math.ceil(i / 8)} part present ${i}`, type: 'input', category: 'Product Detection', tag: `PX${i}`, deviceType: 'sensor-pnp', location: i <= 12 ? 'Infeed' : 'Outfeed' });
  for (let i = 1; i <= 4; i++) pts.push({ description: `VFD${i} fault`, type: 'input', category: 'Conveyor', tag: `VFD${i}`, deviceType: 'vfd-input', location: 'Cabinet' });
  pts.push(...SAMPLE_POINTS.filter((p) => p.type === 'output'));
  pts.push({ description: 'Pump motor contactor', type: 'output', category: 'Conveyor', tag: 'K2', deviceType: 'contactor-coil', location: 'Cabinet' });
  for (let i = 1; i <= 4; i++) pts.push({ description: `VFD${i} run`, type: 'output', category: 'Conveyor', tag: `VFD${i}`, deviceType: 'vfd-input', location: 'Cabinet' });
  for (let i = 2; i <= 9; i++) pts.push({ description: `Diverter ${i} solenoid`, type: 'output', category: 'Pneumatic', tag: `SOL${i}`, deviceType: 'solenoid', location: i <= 5 ? 'Infeed' : 'Outfeed' });
  pts.push({ description: 'Running light', type: 'output', category: 'Operator/HMI', tag: 'PL1', deviceType: 'pilot-light', location: 'Cabinet door' });
  pts.push({ description: 'Fault light', type: 'output', category: 'Operator/HMI', tag: 'PL2', deviceType: 'pilot-light', location: 'Cabinet door' });
  pts.push({ description: 'Stack light red', type: 'output', category: 'Operator/HMI', tag: 'STK1', deviceType: 'stack-light', location: 'Outfeed' });
  pts.push({ description: 'Stack light green', type: 'output', category: 'Operator/HMI', tag: 'STK1', deviceType: 'stack-light', location: 'Outfeed' });
  // Belt 1 speed set from the HMI: 4-20 mA speed reference from a C0-04DA-1 to VFD1 AI2.
  pts.push({ description: 'Belt 1 speed reference', type: 'output', category: 'Analog/Process', tag: 'VFD1', deviceType: 'other', location: 'Cabinet', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 60, units: 'Hz' } });
  const io = applyIo(pts, ['C0-16ND3', 'C0-16ND3', 'C0-16TD1', 'C0-04DA-1']);
  const motors: MotorSpec[] = [
    { tag: 'M1', description: 'Conveyor motor', hp: 1, voltage: '480VAC-3PH', starter: 'contactor-overload', reversing: false },
    { tag: 'M2', description: 'Pump motor', hp: 3, voltage: '480VAC-3PH', starter: 'contactor-overload', reversing: false },
    ...[3, 4, 5, 6].map((n): MotorSpec => ({ tag: `M${n}`, description: `Belt ${n - 2} motor`, hp: 5, voltage: '480VAC-3PH', starter: 'vfd', reversing: false })),
  ];
  const vfd = [3, 4, 5, 6].flatMap((n, i) => [
    c(`CB${n}`, 'GMCBU-3C-15', 1, `Motor M${n} branch protection`, `M${n}`),
    c(`VFD${i + 1}`, 'GS23-45P0', 1, `Belt ${i + 1} drive`, `M${n}`),
  ]);
  elec.setDesign(design({
    supply: '480VAC-3PH', motors, ioWiring: io,
    machine: { zones: ['Infeed', 'Outfeed', 'Pusher station'], junctionBoxes: [{ tag: 'JB1', location: 'Infeed' }, { tag: 'JB2', location: 'Outfeed' }], motorLocations: { M1: 'Infeed', M2: 'Outfeed', M3: 'Infeed', M4: 'Infeed', M5: 'Outfeed', M6: 'Outfeed' }, routing: Object.fromEntries(pts.filter((p) => /^(PX|SOL)/.test(p.tag)).map((p) => [p.tag, p.location === 'Infeed' ? 'JB1' : p.location === 'Outfeed' ? 'JB2' : null])) },
    components: [
      c('ENC1', 'SCE-36EL3012LP', 1, 'Main enclosure 36x30x12'), c('SP1', 'SCE-36P30', 1, 'Back panel'),
      c('DS1', '22013006', 1, 'Main disconnect 60A'), c('DS1H', '14831111', 1, 'Disconnect handle'), c('DS1S', '14070532', 1, 'Disconnect shaft'),
      c('CB1', 'GMCBU-3C-5', 1, 'Motor M1 branch protection', 'M1'), c('CB2', 'GMCBU-3C-10', 1, 'Motor M2 branch protection', 'M2'),
      c('CB7', 'GMCBU-3C-5', 1, '24VDC power supply primary'),
      c('PS1', 'PSR-24-240-3', 1, '24VDC control power supply'),
      c('K1', 'SC-E02PG-24VDC', 1, 'Conveyor motor contactor', 'M1'), c('OL1', 'TK-E02-220', 1, 'Conveyor motor overload', 'M1'),
      c('K2', 'SC-E02PG-24VDC', 1, 'Pump motor contactor', 'M2'), c('OL2', 'TK-E02-600', 1, 'Pump motor overload', 'M2'),
      ...vfd,
      c('PLC', 'C0-11DD1E-D', 1, 'PLC CPU'), c('IO1', 'C0-16ND3', 2, 'Input modules'), c('IO2', 'C0-16TD1', 1, 'Output module'), c('AO1', 'C0-04DA-1', 1, 'Analog output module (VFD1 speed)'),
      c('CR1', 'KPR-SCS-24VACDC-1', 4, 'Interposing relays'),
      ...COMMON_DOOR,
      c('PB3', 'GCX1104', 1, 'Reset'), c('SS1', 'GCX1300', 1, 'Auto/Manual'),
      c('PL1', 'GCX1232-24L', 1, 'Running'), c('PL2', 'GCX1231-24L', 1, 'Fault'),
      c('STK1', 'LR4-302WJNW-RYG', 1, 'Stack light'),
      ...Array.from({ length: 24 }, (_, i) => c(`PX${i + 1}`, 'C18D-0P-1A', 1, `Part present ${i + 1}`)),
      ...Array.from({ length: 8 }, (_, i) => c(`SOL${i + 2}`, '100222015324006', 1, `Diverter ${i + 2} valve`)),
      c('TB1', 'DN-T10-A', 120, 'Feed-through terminals'), c('TBG', 'DN-G10', 20, 'Ground terminals'), c('TBE', 'DN-EB35', 10, 'End brackets'),
      c('DIN', 'DN-R35S1', 5, 'DIN rail'), c('WD', 'T1-2240G-1', 6, 'Wire duct'), c('GB1', 'SCE-GB10', 2, 'Ground bar'),
    ],
  }), 'generated', 'variant big');
  useProgramStore.getState().setProjectName('Sorter Line (big test)');
  // machine layout: 30 x 12 m plan, 100 units per metre, one cable tray along the line, a manifold for SOL2..SOL5
  const item = (tag: string, kind: LayoutItemKind, x: number, y: number): LayoutItem => ({ id: tag, tag, kind, x, y });
  useLayoutStore.getState().update(EXAMPLE_ID, () => ({
    ...EMPTY_LAYOUT,
    canvas: { w: 3000, h: 1200 },
    scale: { unitsPerMeter: 100, a: [0, 1100], b: [1000, 1100], value: 10, unit: 'm' },
    items: [
      item('CABINET', 'cabinet', 200, 1000), item('AIR', 'air', 300, 1000), item('JB1', 'jb', 800, 600), item('JB2', 'jb', 2200, 600),
      ...Array.from({ length: 24 }, (_, i) => item(`PX${i + 1}`, 'device', i < 12 ? 500 + i * 50 : 1900 + (i - 12) * 50, 500)),
      ...Array.from({ length: 8 }, (_, i) => item(`SOL${i + 2}`, 'device', i < 4 ? 700 + i * 50 : 2100 + (i - 4) * 50, 400)),
      ...['M1', 'M2', 'M3', 'M4', 'M5', 'M6'].map((t, i) => item(t, 'motor', [600, 2300, 900, 1200, 2500, 2800][i], 700)),
    ],
    routes: [{ id: 'r1', kind: 'tray', points: [[200, 900], [2900, 900]] }, { id: 'r2', kind: 'chain', points: [[1200, 900], [1200, 650]] }],
    manifolds: [{ tag: 'MV1', valves: ['SOL2', 'SOL3', 'SOL4', 'SOL5'], x: 775, y: 350 }],
  }));
}

const b64 = async (blob: Blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};
const text = (s: string) => btoa(unescape(encodeURIComponent(s)));

/** Build all outputs for one variant. Returns { relativePath: base64 }. */
/**
 * A project generated by the AI quality harness (tools/ai-quality): variant "ai-<machine>"
 * loads tools/ai-quality/out/<machine>/project.json into the stores.
 */
async function loadAiProject(machine: string) {
  try { localStorage.clear(); } catch { /* ignore */ }
  seedSampleProject();
  if (useProjectsStore.getState().activeId !== EXAMPLE_ID) useProjectsStore.getState().openProject(EXAMPLE_ID);
  const res = await fetch(`/tools/ai-quality/out/${machine}/project.json`);
  if (!res.ok) throw new Error(`No AI quality project for ${machine} (run tools/ai-quality/run.ts first)`);
  const d = await res.json();
  useSpecStore.getState().setSections(d.spec);
  useIOStore.setState({ projectIO: d.io });
  useProjectStore.setState({ plcId: d.project.plcId, cpuId: d.project.cpuId, modules: d.project.modules, recommendation: d.project.recommendation, info: d.project.info });
  if (d.electrical) { useElectricalStore.getState().setInputs(d.electrical.inputs); useElectricalStore.getState().setDesign(d.electrical, 'generated', 'AI quality harness'); }
  if (d.hmi) useHmiStore.getState().setDesign(d.hmi, 'AI quality harness');
  useProgramStore.setState({ ladder: d.ladder });
}

export async function build(v: Variant | `ai-${string}`): Promise<Record<string, string>> {
  if (v.startsWith('ai-')) await loadAiProject(v.slice(3)); else setupVariant(v as Variant);
  const p = collectProject();
  const ctx = p.drawingCtx!;
  const out: Record<string, string> = {};
  out['everything.zip'] = await b64(await buildEverythingZip(p));
  const bpPlan = backPanelDrilling(ctx), doorPlan = doorDrilling(ctx);
  for (const [k, plan] of [['back_panel', bpPlan], ['door', doorPlan]] as const) {
    out[`dxf/${k}_mm.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'mm' }));
    out[`dxf/${k}_in.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'in' }));
    out[`dxf/${k}_mm_cut.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'mm', cutOnly: true }));
    out[`dxf/${k}_in_cut.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'in', cutOnly: true }));
  }
  const labels = buildLabels(ctx);
  out['labels.csv'] = text(labelsCsv(labels, 'code+description', false));
  const layout = panelLayout(ctx);
  const m = buildModel(ctx);
  const info = programInfo(p);
  const data = {
    variant: v,
    projectName: p.projectName,
    fileBase: p.fileBase,
    region: p.info.region,
    supply: ctx.design.inputs.supply,
    revision: revisionState(ctx.doc),
    io: p.io.map((x) => ({ id: x.id, address: p.addresses.get(x.id) ?? '', type: x.type, description: x.description })),
    bom: billOfMaterials(ctx),
    wires: wireNumbers(ctx),
    terminals: terminalPlan(ctx),
    cables: cableSchedule(ctx),
    warnings: designWarnings(ctx),
    layout: { enclosure: layout.enclosure, backplate: layout.backplate, door: { w: layout.door.w, h: layout.door.h, items: layout.door.items, handle: layout.door.handle }, overflow: layout.overflow, notFit: layout.notFit, warnings: layout.warnings, items: layout.items.map(({ tag, label, category, x, y, w, h }) => ({ tag, label, category, x, y, w, h })), rails: layout.rails, ducts: layout.ducts },
    drilling: { backpanel: bpPlan, door: doorPlan },
    hmiModel: p.hmi ? getHmi(p.hmi.hmiPartNumber) ?? null : null,
    labels,
    calcs: calculations(p),
    alarms: alarmRows(p, info),
    motors: m.motors.map((x) => ({ tag: x.motor.tag, hp: x.motor.hp, voltage: x.motor.voltage, fla: x.fla, tableFla: motorFla(x.motor.hp, x.motor.voltage) })),
    nameplate: panelNameplate(ctx),
    step: cabinetStepSummary(ctx),
    spare: spareSpace(ctx),
    codeRules: runCodeRules({ ctx, spec: p.spec, sccr: (({ unknown, lowest }) => ({ unknown, lowest }))(sccrTable(p)) }),
  };
  out['data.json'] = text(JSON.stringify(data, null, 1));
  return out;
}
