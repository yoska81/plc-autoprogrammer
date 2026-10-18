/**
 * Browser-side harness (loaded through the Vite dev server by tools/gen-outputs.cjs).
 * Seeds the stores with the example project or a variant, then builds every deliverable
 * exactly like the Export page does, plus extra DXF options and JSON dumps of the derived
 * data so the Python checkers can cross-check the files.
 */
import { SERVO_IO } from '../../src/electrical/motion.fixture';
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
import { autocadZip, eplanZip } from '../../src/deliverables/cadExport';
import { drawingSetDxf } from '../../src/electrical/cad/drawingsDxf';
import { drillingDxf } from '../../src/electrical/dxf';
import { enclosureFaceDrilling } from '../../src/electrical/enclosureFaces';
import {
  backPanelDrilling, billOfMaterials, cableSchedule, designWarnings, doorDrilling, motorFla, panelLayout,
  panelNameplate, revisionState, spareSpace, terminalPlan, wireNumbers, buildModel,
} from '../../src/electrical/derive';
import { buildLabels, labelsCsv } from '../../src/electrical/labels';
import { cabinetStepSummary } from '../../src/electrical/step/cabinetStep';
import { calculations } from '../../src/deliverables/docs/calcs';
import { alarmRows, programInfo } from '../../src/deliverables/docs/program';
import { getHmi } from '../../src/hmi/hmiCatalog';
import { ALLOWED_RISE_C, cabinetHeat } from '../../src/electrical/thermal';
import { coolingCover } from '../../src/electrical/cooling';
import { coilMatchesRail, relayLadder } from '../../src/electrical/relayLogic';
import { runCodeRules } from '../../src/review/codeRules';
import { sccrTable } from '../../src/deliverables/docs/electrical';
import type { DesignComponent, ElectricalDesign, FieldDeviceType, IOWiring, MotorSpec, RelayLogic } from '../../src/electrical/types';
import type { AnalogSpec, IOCategory } from '../../src/types/io';
import { generateRuleBasedDesign } from '../../src/lib/ai/machineModelAI';
import { getPart } from '../../src/electrical/catalog';
import { vendorPreference } from '../../src/store/useProjectStore';
import { specToText } from '../../src/spec/types';
import { buildHmi } from '../../src/hmi/engine';
import { projectHmiContent } from '../../src/lib/ai/hmiContentAI';
import { programWithCycle } from '../../src/plc/engine/sequence';
import { missingOperatorIo } from '../../src/spec/operatorIo';
import { generatedToPoint } from '../../src/lib/ai/ioAI';
import { useStageStore } from '../../src/store/useStageStore';
import { fingerprint } from '../../src/spec/types';

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
        c('ENC1', 'SCE-30EL2410LP', 1, 'Main enclosure 30x24x10'), c('SP1', 'SCE-30P24', 1, 'Back panel'),
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
        c('ENC1', 'SCE-24EL2008LP', 1, 'Main enclosure 24x20x8'), c('SP1', 'SCE-24P20', 1, 'Back panel'),
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
    c(`VFD${i + 1}`, 'GS23-45P0', 1, `Belt ${i + 1} drive${i === 0 ? ', STO from safety relay' : ''}`, `M${n}`),
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
/**
 * Rule-based engine variants ("rules", "rules-big", "rules-eu"): the example / big / EU project with
 * its design replaced by the engine's (no AI: the same path as Generate without an API key).
 */
/** The user's "Sealing Head": two-hand start, light curtain, heater with thermocouple, unwinder on a VFD. */
const SEALING_SPEC = 'Sealing head: a pneumatic heat-sealing head closes on a pouch, holds for the dwell time at the set temperature, then opens. Two-hand start, light curtain, heater with thermocouple. The film comes off an unwinder driven by a 0.5 HP motor on a VFD. CLICK PLC with a C-more 7" touch panel; the operator sets the seal temperature and the dwell time on the HMI. 480 V 3-phase supply.';
const SEALING_IO: [string, 'input' | 'output', IOCategory, string, AnalogSpec?][] = [
  ['Safety relay OK (E-stop and light curtain)', 'input', 'Safety', 'safety-relay-output'], ['Two-hand start button left', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Two-hand start button right', 'input', 'Operator/HMI', 'pushbutton-no'], ['Light curtain clear (OSSD)', 'input', 'Safety', 'other'],
  ['Stop button', 'input', 'Operator/HMI', 'pushbutton-nc'], ['Fault reset button', 'input', 'Operator/HMI', 'pushbutton-no'],
  ['Sealing head up (retracted)', 'input', 'Pneumatic', 'sensor-pnp'], ['Sealing head down (sealing position)', 'input', 'Pneumatic', 'sensor-pnp'],
  ['Air pressure OK', 'input', 'Pneumatic', 'pressure-switch'], ['Heater over-temperature limit tripped', 'input', 'Analog/Process', 'other'],
  ['Unwinder VFD fault', 'input', 'Conveyor', 'vfd-input'], ['Film roll low sensor', 'input', 'Product Detection', 'sensor-pnp'],
  ['Rear guard door closed', 'input', 'Safety', 'limit-switch'],
  ['Seal heater temperature (thermocouple transmitter)', 'input', 'Analog/Process', 'other', { range: '4-20mA', min: 0, max: 300, units: '°C' }],
  ['Sealing head down solenoid', 'output', 'Pneumatic', 'solenoid'], ['Sealing head up solenoid', 'output', 'Pneumatic', 'solenoid'],
  ['Seal heater on (SSR)', 'output', 'Analog/Process', 'other'], ['Unwinder VFD run', 'output', 'Conveyor', 'vfd-input'],
  ['Machine running light', 'output', 'Operator/HMI', 'pilot-light'], ['Fault light', 'output', 'Operator/HMI', 'pilot-light'],
  ['Unwinder speed reference', 'output', 'Conveyor', 'other', { range: '4-20mA', min: 0, max: 100, units: '%' }],
];

/**
 * "rules-stress": the sealing head, IEC (EU), with I/O descriptions and component functions as long as an
 * AI writes them (60-120 characters) and two input modules — for the drawing text-overlap check.
 */
const STRESS_EXTRA: [string, 'input' | 'output', IOCategory, string][] = Array.from({ length: 12 }, (_, i) => [
  `Pouch present at sealing station ${i + 1}, diffuse photo-eye on the infeed guide rail, left-hand side, mounted 40 mm above the belt`,
  'input', 'Product Detection', 'sensor-pnp',
]);

const SERVO_SPEC = 'Cup filler: a servo axis (axis 1) indexes the cup carrier by pulse and direction from the PLC; a line encoder on the infeed conveyor measures its speed; an ultrasonic sensor reads the hopper level (4-20 mA). E-stop on the door into a safety relay; the servo stops by Safe Torque Off.';

async function setupRules(v: string) {
  setupVariant(v === 'rules-big' || v === 'rules-floor' ? 'big' : 'us480');
  if (v === 'rules-sealing' || v === 'rules-sealing-long' || v === 'rules-stress' || v === 'rules-sealing-4x' || v === 'rules-sealing-thm' || v === 'rules-sealing-npn') {
    // Only the sealing head's own description: the example's other sections (its conveyor) must not leak in.
    const sections = useSpecStore.getState().sections;
    useSpecStore.getState().setSections({ ...(Object.fromEntries(Object.keys(sections).map((k) => [k, ''])) as typeof sections), overview: SEALING_SPEC });
    // "-long": descriptions as long as the AI I/O step writes them (location, function and device in one line)
    const long = v === 'rules-sealing-long' || v === 'rules-stress';
    const LONG_TAIL = [' — operator station at the sealing head, front side', ' (wired to the PLC through junction box at the sealing station)', ', monitored by the PLC for the cycle interlocks and alarms'];
    const io = [...SEALING_IO, ...(v === 'rules-stress' ? STRESS_EXTRA : [])];
    useIOStore.setState({ projectIO: io.map(([description, type, category, deviceType, analog], i) => ({ id: `seal${i + 1}`, description: long ? description + LONG_TAIL[i % 3] : description, type, category, deviceType, ...(analog ? { signal: 'analog' as const, analog } : {}) })) });
    useProjectStore.setState({ plcId: 'click', cpuId: 'C0-12DD1E-D', modules: v === 'rules-stress' ? ['C0-16ND3', 'C0-16ND3', 'C0-08TD1'] : ['C0-16ND3', 'C0-08TD1'] });
    useHmiStore.getState().setHmiPartNumber('CM5-T7W');
    useProgramStore.setState({ ladder: { rungs: [], tags: [] } });
    useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, motors: [], requiredParts: [{ partNumber: 'C0-12DD1E-D', quantity: 1 }, { partNumber: 'C0-16ND3', quantity: v === 'rules-stress' ? 2 : 1 }, { partNumber: 'C0-08TD1', quantity: 1 }] });
  }
  // "rules-sealing-4x": the user's Sealing Head — NEMA 4X (stainless), a C0-10DD1E-D with input / output / analog
  // modules, and the CPU changed on the PLC page after the equipment choice (C0-10DD2E-D still in the required parts).
  if (v === 'rules-sealing-4x') {
    const modules = ['C0-08ND3', 'C0-08TD1', 'C0-04AD-1', 'C0-04DA-1'];
    useProjectStore.setState({ plcId: 'click', cpuId: 'C0-10DD1E-D', modules });
    useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, enclosureRating: 'NEMA 4X', motors: [], requiredParts: [{ partNumber: 'C0-10DD2E-D', quantity: 1 }, ...modules.map((partNumber) => ({ partNumber, quantity: 1 }))] });
  }
  // "rules-nopanel": the sealing head with no touch panel — the I/O list gets the door pushbuttons, the Auto/Manual
  // selector and the lamps it lacks; no HMI design; the program runs from the door devices alone.
  const noPanel = v === 'rules-nopanel';
  if (noPanel) {
    const sections = useSpecStore.getState().sections;
    const spec = { ...(Object.fromEntries(Object.keys(sections).map((k) => [k, ''])) as typeof sections), overview: SEALING_SPEC.replace(/CLICK PLC with a C-more 7" touch panel;[^.]*\./, 'CLICK PLC, no touch panel: pushbuttons, a selector and lamps on the cabinet door; the seal temperature and time are set in the program.') };
    useSpecStore.getState().setSections(spec);
    const io = SEALING_IO.map(([description, type, category, deviceType, analog], i) => ({ id: `seal${i + 1}`, description, type, category, deviceType, ...(analog ? { signal: 'analog' as const, analog } : {}) }));
    useIOStore.setState({ projectIO: [...io, ...missingOperatorIo(io).map((g, i) => ({ id: `op${i + 1}`, ...generatedToPoint(g) }))] });
    useProjectStore.setState({ plcId: 'click', cpuId: 'C0-12DD1E-D', modules: ['C0-16ND3', 'C0-08TD1'] });
    useHmiStore.getState().setHmiPartNumber('');
    useHmiStore.getState().setDesign(null, null);
    useStageStore.getState().markGenerated('equipment', { specFp: fingerprint(spec), spec });
    useProgramStore.setState({ ladder: { rungs: [], tags: [] } });
    useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, motors: [], requiredParts: [{ partNumber: 'C0-12DD1E-D', quantity: 1 }, { partNumber: 'C0-16ND3', quantity: 1 }, { partNumber: 'C0-08TD1', quantity: 1 }] });
  }
  // "rules-sealing-npn": the sealing head with NPN sensors — their input commons go to +24V, so the buttons, limit /
  // pressure switches and relay contacts on the same modules must switch 0V (check_consistency: every input can turn ON).
  if (v === 'rules-sealing-npn') useIOStore.setState({ projectIO: useIOStore.getState().projectIO.map((p) => (p.deviceType === 'sensor-pnp' ? { ...p, deviceType: 'sensor-npn' } : p)) });
  // "rules-sealing-thm": the user's Sealing Head as built — C0-11DD2E-D + C0-08ND3 + C0-04THM, NEMA 4X, the seal bar's
  // type J thermocouple read straight by the THM (no transmitter, no analog output). The point comes in through the
  // store's import at the list's 4-20 mA default: the import must make it a 'thermocouple' range, or it gets no channel.
  if (v === 'rules-sealing-thm') {
    const io = SEALING_IO.filter(([, type, , , a]) => !(type === 'output' && a))
      .map(([description, type, category, deviceType, a]) => (a ? ['Seal bar temperature (type J thermocouple)', type, category, deviceType, { range: '4-20mA' as const, min: 0, max: 300, units: '°C' }] as const : [description, type, category, deviceType, a] as const));
    useIOStore.getState().importPoints(io.map(([description, type, category, deviceType, analog]) => ({ description, type, category, deviceType, ...(analog ? { signal: 'analog' as const, analog } : {}) })), true);
    const modules = ['C0-08ND3', 'C0-04THM'];
    useProjectStore.setState({ plcId: 'click', cpuId: 'C0-11DD2E-D', modules });
    useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, enclosureRating: 'NEMA 4X', motors: [], requiredParts: ['C0-11DD2E-D', ...modules].map((partNumber) => ({ partNumber, quantity: 1 })) });
  }
  // "rules-servo": motion — one SureServo2 axis (pulse/direction, STO), a line encoder on the high-speed inputs and a
  // 4-20 mA ultrasonic level sensor on a 240 V machine (src/electrical/motion.fixture.ts).
  if (v === 'rules-servo') {
    const sections = useSpecStore.getState().sections;
    useSpecStore.getState().setSections({ ...(Object.fromEntries(Object.keys(sections).map((k) => [k, ''])) as typeof sections), overview: SERVO_SPEC });
    useIOStore.setState({ projectIO: SERVO_IO.map(([description, type, category, signal], i) => ({ id: `servo${i + 1}`, description, type, category: category as IOCategory, ...(signal ? { signal, analog: { range: '4-20mA' as const, min: 0, max: 100, units: '%' } } : {}) })) });
    const modules = ['C0-04AD-1', 'C0-16TD1'];
    useProjectStore.setState({ plcId: 'click', cpuId: 'C0-10DD1E-D', modules });
    useHmiStore.getState().setHmiPartNumber('CM5-T7W');
    useProgramStore.setState({ ladder: { rungs: [], tags: [] } });
    useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, supply: '240VAC-3PH', motors: [], requiredParts: ['C0-10DD1E-D', ...modules].map((partNumber) => ({ partNumber, quantity: 1 })) });
  }
  // Unitronics all-in-ones (the screen is the PLC's own): the sealing head on a Vision V700 + snap-in (VisiLogic) or a
  // UniStream US10 + Uni-I/O (UniLogic); the rules build the HMI and the program too, so the exporters run.
  const uni = v === 'rules-unitronics' ? { plcId: 'unitronics-vision', cpu: 'V700-T20BJ', modules: ['V200-18-E3XB'] }
    : v === 'rules-unistream' ? { plcId: 'unitronics-unistream', cpu: 'US10-B10-TR22', modules: ['UID-1600', 'UIA-0402N'] } : null;
  if (uni) {
    const sections = useSpecStore.getState().sections;
    useSpecStore.getState().setSections({ ...(Object.fromEntries(Object.keys(sections).map((k) => [k, ''])) as typeof sections), overview: SEALING_SPEC.replace('CLICK PLC with a C-more 7" touch panel', `Unitronics ${uni.cpu} PLC with its built-in touch screen`) });
    useIOStore.setState({ projectIO: SEALING_IO.map(([description, type, category, deviceType, analog], i) => ({ id: `seal${i + 1}`, description, type, category, deviceType, ...(analog ? { signal: 'analog' as const, analog } : {}) })) });
    useProjectStore.setState({ plcId: uni.plcId, cpuId: uni.cpu, modules: uni.modules });
    useHmiStore.getState().setHmiPartNumber(uni.cpu);
    useHmiStore.getState().setDesign(null, null);
    useProgramStore.setState({ ladder: { rungs: [], tags: [] } });
    useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, motors: [], requiredParts: [uni.cpu, ...uni.modules].map((partNumber) => ({ partNumber, quantity: 1 })) });
  }
  const el = useElectricalStore.getState();
  let inputs = v === 'rules-sealing' || v === 'rules-sealing-4x' || v === 'rules-sealing-thm' || v === 'rules-sealing-npn' || v === 'rules-servo' || uni || noPanel ? el.inputs : el.design?.inputs ?? el.inputs;
  // "rules-relay": the example plus the relay logic the converter kept from a Chinese roll former (22 circuits, the
  // converter's fixture): the engine adds its devices as parts and draws the NFPA 79 ladder sheets.
  if (v === 'rules-relay') {
    const res = await fetch('/e2e/fixtures/convert/cn-rollformer-01.relayLogic.json');
    if (!res.ok) throw new Error('rules-relay: e2e/fixtures/convert/cn-rollformer-01.relayLogic.json not served');
    inputs = { ...inputs, relayLogic: (await res.json()) as RelayLogic };
  }
  if (v === 'rules-eu' || v === 'rules-stress') {
    useProjectStore.getState().setInfo({ region: 'EU', standards: ['IEC 60204-1', 'IEC 61439-1'] });
    inputs = { ...inputs, supply: '400VAC-3PH', motors: inputs.motors.map((m) => ({ ...m, voltage: '400VAC-3PH' as const })) };
  }
  const p = collectProject();
  const r = await generateRuleBasedDesign({
    spec: specToText(p.spec), io: p.io, addresses: p.addresses, inputs, region: p.info.region, pref: vendorPreference(), getPart,
    modules: p.modules, analog: p.drawingCtx?.analog, hmiPartNumber: p.drawingCtx?.hmiPartNumber ?? null, projectName: p.projectName,
    plc: { vendor: p.profile.vendor, name: p.profile.name, cpuPartNumber: p.cpu.id, cpuLabel: p.cpu.label },
  });
  el.setInputs(r.design.inputs);
  // AI-length component functions: the device list, legend and cross-reference columns must wrap or cut, never overlap
  let design = v !== 'rules-stress' ? r.design : { ...r.design, components: r.design.components.map((x) => ({ ...x, function: `${x.function} — supplied and wired by the panel builder, see the schematic and terminal plan for its connections`.slice(0, 120) })) };
  // "rules-floor": the big machine in a floor-standing double-door enclosure on 12in stands (two leaves, stands, floor heights).
  if (v === 'rules-floor') {
    const enc = design.components.find((x) => x.tag === 'ENC1');
    const sub = enc && getPart(enc.partNumber)?.ratings.subpanel;
    design = { ...design, components: design.components.map((x) => (x.tag === 'ENC1' ? { ...x, partNumber: 'SCE-72EL7218LPPL', function: 'Main enclosure 72x72x18 NEMA 12, floor-standing, two doors' }
      : sub && x.partNumber === sub ? { ...x, partNumber: 'SCE-72P72', function: 'Subpanel for ENC1' } : x)) };
  }
  el.setDesign(design, 'generated', r.explanation);
  if (uni) {
    const q = collectProject();
    const model = getHmi(uni.cpu)!;
    const content = projectHmiContent({ io: q.io, addresses: q.addresses, machineName: 'Sealing Head', spec: specToText(q.spec), electrical: design, panel: model });
    const hmi = buildHmi(content, { ...model, plcText: `${q.profile.vendor} ${q.cpu.label}`, now: '2026-10-17T00:00:00.000Z' });
    useHmiStore.getState().setDesign(hmi, 'rules');
    const prog = programWithCycle({ content, hmiTags: hmi.tags, hmiScreens: hmi.screens, hmiAlarms: hmi.alarms, spec: specToText(q.spec) });
    useProgramStore.setState({ ladder: prog.program });
  }
  if (noPanel) {
    const q = collectProject();
    const content = projectHmiContent({ io: q.io, addresses: q.addresses, machineName: 'Sealing Head', spec: specToText(q.spec), electrical: design, panel: { partNumber: '', widthPx: 800, heightPx: 480 } });
    useProgramStore.setState({ ladder: programWithCycle({ content, spec: specToText(q.spec), panel: false }).program });
  }
}

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

/** Load a variant into the stores (no outputs built). */
export async function setup(v: Variant | `ai-${string}` | `rules${string}`): Promise<void> {
  if (v.startsWith('ai-')) await loadAiProject(v.slice(3));
  else if (v.startsWith('rules')) await setupRules(v);
  else setupVariant(v as Variant);
}

export async function build(v: Variant | `ai-${string}` | `rules${string}`): Promise<Record<string, string>> {
  await setup(v);
  const p = collectProject();
  const ctx = p.drawingCtx!;
  const out: Record<string, string> = {};
  out['everything.zip'] = await b64(await buildEverythingZip(p));
  const bpPlan = backPanelDrilling(ctx), doorPlan = doorDrilling(ctx);
  const facePlans = enclosureFaceDrilling(ctx);
  for (const [k, plan] of [['back_panel', bpPlan], ['door', doorPlan], ...facePlans.map((f) => [`enclosure_${f.kind}`, f] as const)] as const) {
    out[`dxf/${k}_mm.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'mm' }));
    out[`dxf/${k}_in.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'in' }));
    out[`dxf/${k}_mm_cut.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'mm', cutOnly: true }));
    out[`dxf/${k}_in_cut.dxf`] = text(drillingDxf(plan, ctx.projectName, { units: 'in', cutOnly: true }));
  }
  // CAD exports (Electrical page "Save as AutoCAD" / "Save as EPLAN"), as the app builds them.
  const sheets = drawingSetDxf(ctx);
  out['cad/autocad.zip'] = await b64(await autocadZip(p, sheets));
  out['cad/eplan.zip'] = await b64(await eplanZip(p, sheets, { now: '2026-01-01T00:00:00Z' }));
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
    layout: { enclosure: layout.enclosure, backplate: layout.backplate, door: { w: layout.door.w, h: layout.door.h, items: layout.door.items, handle: layout.door.handle, leaves: layout.door.leaves, leaf: layout.door.leaf, plinth: layout.door.plinth, overflow: layout.door.overflow }, overflow: layout.overflow, notFit: layout.notFit, warnings: layout.warnings, items: layout.items.map(({ tag, label, category, x, y, w, h }) => ({ tag, label, category, x, y, w, h })), rails: layout.rails, ducts: layout.ducts },
    drilling: { backpanel: bpPlan, door: doorPlan, faces: facePlans },
    hmiModel: p.hmi ? getHmi(p.hmi.hmiPartNumber) ?? null : null,
    labels,
    calcs: calculations(p),
    alarms: alarmRows(p, info),
    motors: m.motors.map((x) => ({ tag: x.motor.tag, hp: x.motor.hp, voltage: x.motor.voltage, fla: x.fla, tableFla: motorFla(x.motor.hp, x.motor.voltage) })),
    // drive branch protection against the drive's listed fuses (check_consistency: Class T fuses or the review finding)
    // cabinet heat and its cooling (check_consistency: a hot cabinet has a fan / heat exchanger / air conditioner, or the review says so)
    cooling: (() => {
      const hm = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
      const h = cabinetHeat(ctx.design.components, getPart, hm && getPart(hm.partNumber)?.category !== 'plc' ? { partNumber: hm.partNumber, sizeIn: hm.sizeIn } : undefined);
      return { watts: h.watts, rise: h.rise, ventilation: h.ventilation,
        parts: m.rc.filter((c) => ['filter fan', 'exhaust filter', 'thermostat', 'heat exchanger', 'air conditioner'].includes(String(c.part?.ratings.kind ?? ''))).map((c) => ({ tag: c.tag, partNumber: c.partNumber, kind: c.part?.ratings.kind })),
        fan: m.fan ?? null, cover: h.ventilation ? coolingCover(ctx.design.components, getPart, h.ventilation, ALLOWED_RISE_C) : null };
    })(),
    // relay logic (check_consistency: one terminal = one wire number; every coil rated for its rung's rail)
    relay: ctx.design.inputs.relayLogic ? (() => {
      const logic = ctx.design.inputs.relayLogic!;
      const lad = relayLadder(logic);
      const coils = [...new Set(lad.rungs.flatMap((r) => r.cols).flatMap((c) => (c.kind === 'el' ? [c.e] : c.paths.flat())).filter((e) => e.el.t === 'coil' && e.el.kind !== 'drive-input').map((e) => e.el.tag))];
      return {
        supply: logic.supply, wires: lad.wires, questions: lad.questions,
        coils: coils.map((tag) => { const c = ctx.design.components.find((x) => x.tag === tag); const pt = c ? getPart(c.partNumber) : undefined; return { tag, partNumber: c?.partNumber ?? null, rating: String(pt?.ratings.coilVoltage ?? pt?.ratings.volts ?? ''), ok: pt ? coilMatchesRail(logic.supply, String(pt.ratings.coilVoltage ?? pt.ratings.volts ?? '')) : null }; }),
      };
    })() : null,
    // input commons (check_consistency: every input can turn ON — on a +24V common (NPN) a dry contact is fed 0V)
    inputCommons: m.groups.filter((g) => g.type === 'input').map((g) => ({
      group: g.label, commonTo: g.commonTo,
      points: g.points.map((q) => {
        // the wire landing on the input's feed terminal as derive wired it (C, 23, R1, BN…): every input is checked
        const feed = q.feedTo ? m.wires.filter((w) => w.to === q.feedTo && w.wire !== q.address).map((w) => w.wire) : [];
        return { address: q.address, tag: q.deviceTag, deviceType: q.deviceType, feedTo: q.feedTo ?? null, feed: [...new Set(feed)] };
      }),
    })),
    drives: m.motors.filter((x) => x.vfd).map((x) => ({ motor: x.motor.tag, tag: x.vfd!.tag, partNumber: x.vfd!.partNumber, fuseClass: x.vfd!.part?.ratings.fuseClass ?? null, fusePart: x.vfd!.part?.ratings.fusePart ?? null,
      protection: x.protection ? { tag: x.protection.tag, partNumber: x.protection.partNumber, category: x.protection.category, fuseClass: x.protection.fuse?.ratings.fuseClass ?? null, fuse: x.protection.fuse?.partNumber ?? null } : null })),
    nameplate: panelNameplate(ctx),
    step: cabinetStepSummary(ctx),
    spare: spareSpace(ctx),
    codeRules: runCodeRules({ ctx, spec: p.spec, sccr: (({ unknown, lowest }) => ({ unknown, lowest }))(sccrTable(p)) }),
  };
  out['data.json'] = text(JSON.stringify(data, null, 1));
  return out;
}
