import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProgramStore } from '../store/useProgramStore';
import { useElectricalStore } from '../store/useElectricalStore';
import type { LadderProgram } from '../plc/ladder';
import type { DesignInputs, ElectricalDesign } from '../electrical/types';
import type { HmiDesign, HmiElement } from '../hmi/types';
import { EMPTY_SECTIONS, fingerprint, type SpecSections } from '../spec/types';
import { useSpecStore } from '../store/useSpecStore';
import { useHmiStore } from '../store/useHmiStore';
import { useStageStore } from '../store/useStageStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { ioFingerprint, hmiFingerprint } from '../spec/useStages';
import type { EquipmentRecommendation } from '../lib/ai/equipmentAI';

/** Example project shown in the side-panel preview (only when nothing is saved yet). */

export const SPEC: SpecSections = {
  ...EMPTY_SECTIONS,
  overview: 'Conveyor cell that moves parts to an end station where a pneumatic pusher pushes each part off onto a take-away table. About 10 parts per minute.',
  sequence: '- Start (panel pushbutton or HMI) runs the conveyor.\n- When a part reaches the end photo-eye, stop the conveyor and extend the pusher.\n- When the pusher-extended prox turns on, retract the pusher and restart the conveyor.\n- Count every part that reaches the end.',
  safety: '- One E-stop on the operator station, dual channel into a safety relay. Safety relay output to the PLC as Safety OK.\n- Loss of Safety OK stops the conveyor and retracts the pusher (stop category 0).',
  modes: 'Auto only. Stop button (NC) or HMI Stop ends the cycle.',
  motion: 'M1 conveyor motor, 1 HP, 480 VAC 3-phase, across-the-line contactor and overload.',
  pneumatics: 'Pusher cylinder, single 5/2 solenoid valve (spring return), pusher-extended prox. Retracts when the valve is off.',
  sensing: '- Part-at-end photo-eye, PNP.\n- Pusher extended prox, PNP.',
  operator: '- Operator station: Start (green), Stop (red, NC), E-stop.\n- 7" C-more HMI: Main screen with Start/Stop/Reset, running and fault lamps, part count with reset; Alarms screen; I/O status screen.',
  alarms: '- Pusher fault: pusher not extended within 3 s. Latches; Reset (panel Start or HMI Reset) clears it when the pusher is back.',
  utilities: '480 VAC 3-phase, 60 Hz. NEMA 12 enclosure. Plant air 80 psi.',
};

export const RECOMMENDATION: EquipmentRecommendation = {
  summary: 'A small conveyor cell: 5 inputs and 2 outputs plus a 7-inch operator panel. The smallest CLICK CPU with Ethernet covers it with room to spare, so no expansion modules are needed.',
  estimatedIO: { digitalInputs: 5, digitalOutputs: 2, analogInputs: 0, analogOutputs: 0, motionAxes: 0 },
  plc: { profileId: 'click', cpuId: 'C0-10DD1E-D', why: 'Its 8 inputs and 6 sinking outputs cover the 5 inputs and 2 outputs with 40% spare, and its Ethernet port connects the touch panel.' },
  modules: [],
  hmi: { partNumber: 'CM5-T7W', why: 'Three simple screens (run, alarms, I/O) fit comfortably on 7 inches; the CM5 is the current C-more model and talks to CLICK over Ethernet.' },
  alternatives: [
    { label: 'Lower cost, no touch panel', cpuId: 'C0-10DD1E-D', hmiPartNumber: null, tradeoff: 'Pushbuttons and lights only; no part count or alarm text for the operator.' },
    { label: 'Room to grow', cpuId: 'C0-11DD1E-D', hmiPartNumber: 'CM5-T10W', tradeoff: 'More inputs and a larger 10-inch screen if stations are added later; costs more.' },
  ],
  cautions: ['The photo-eye and prox must be PNP (sourcing) to match the CPU inputs wired sinking; confirm with the sensor part numbers.'],
};

export const LADDER: LadderProgram = {
  blocks: [
    { id: 'safety', name: 'Safety & modes', description: 'Safety OK bit and the cycle start/stop seal-in.' },
    { id: 'conveyor', name: 'Conveyor', description: 'Runs the belt while cycling and counts delivered parts.' },
    { id: 'pusher', name: 'Pusher', description: 'Pushes the part at the end of the belt, with timeout fault and reset.' },
  ],
  rungs: [
    { id: 'r_safe', block: 'safety', comment: 'Safety OK from the E-stop safety relay', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r_run', block: 'safety', comment: 'Cycle running: panel or HMI Start seals in; Stop (NC button), HMI Stop, safety loss or pusher fault drops it',
      branches: [
        [{ type: 'NO', address: 'X002' }, { type: 'NO', address: 'X003' }, { type: 'NC', address: 'C1002' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C1101' }],
        [{ type: 'NO', address: 'C1001' }, { type: 'NO', address: 'X003' }, { type: 'NC', address: 'C1002' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C1101' }],
        [{ type: 'NO', address: 'C2' }, { type: 'NO', address: 'X003' }, { type: 'NC', address: 'C1002' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C1101' }],
      ],
      outputs: [{ type: 'OUT', address: 'C2' }] },
    { id: 'r_conv', block: 'conveyor', comment: 'Conveyor runs while cycling and no part is being pushed', branches: [[{ type: 'NO', address: 'C2' }, { type: 'NC', address: 'C3' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'r_cnt', block: 'conveyor', comment: 'Part counter (shown on the HMI), reset from the HMI', branches: [[{ type: 'NO', address: 'X004' }]],
      outputs: [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '9999', resetAddress: 'C1004' }] },
    { id: 'r_push', block: 'pusher', comment: 'Part at end: push it, hold until the pusher is out',
      branches: [[{ type: 'NO', address: 'C2' }, { type: 'RISE', address: 'X004' }], [{ type: 'NO', address: 'C3' }, { type: 'NC', address: 'X005' }, { type: 'NO', address: 'C2' }]],
      outputs: [{ type: 'OUT', address: 'C3' }, { type: 'OUT', address: 'Y002' }] },
    { id: 'r_tmo', block: 'pusher', comment: 'Pusher timeout: 3 s to reach extended', branches: [[{ type: 'NO', address: 'C3' }]],
      outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '3', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r_flt', block: 'pusher', comment: 'Pusher fault alarm (HMI alarm bit) latches on timeout', branches: [[{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'SET', address: 'C1101' }] },
    { id: 'r_rst', block: 'pusher', comment: 'Fault reset from panel Start or HMI Reset, with safety OK and pusher back',
      branches: [[{ type: 'NO', address: 'X002' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C3' }], [{ type: 'NO', address: 'C1003' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C3' }]],
      outputs: [{ type: 'RST', address: 'C1101' }] },
  ],
  tags: [
    { address: 'C1', nickname: 'Safety_OK', comment: 'Safety relay output healthy' },
    { address: 'C2', nickname: 'Cycle_Running', comment: 'Machine running' },
    { address: 'C3', nickname: 'Push_Active', comment: 'Pusher extending' },
    { address: 'T1', nickname: 'Push_Timeout', comment: '3 s pusher timeout' },
    { address: 'CT1', nickname: 'Part_Count', comment: 'Parts delivered' },
    { address: 'C1001', nickname: 'HMI_Start', comment: 'HMI Start button' },
    { address: 'C1002', nickname: 'HMI_Stop', comment: 'HMI Stop button' },
    { address: 'C1003', nickname: 'HMI_Reset', comment: 'HMI fault reset' },
    { address: 'C1004', nickname: 'HMI_Count_Reset', comment: 'HMI part count reset' },
    { address: 'C1101', nickname: 'ALM_Pusher_Fault', comment: 'Pusher did not extend in 3 s' },
  ],
};

const el = (id: string, kind: HmiElement['kind'], label: string, x: number, y: number, w: number, h: number, more: Partial<HmiElement> = {}): HmiElement => ({
  id, kind, label, x, y, w, h, address: null, action: null, targetScreenId: null, onText: null, offText: null, style: 'normal', units: null, min: null, max: null, note: null, ...more,
});
const navBar = (prefix: string) => [
  el(`${prefix}-nav1`, 'nav', 'Main', 8, 416, 254, 56, { targetScreenId: 'main' }),
  el(`${prefix}-nav2`, 'nav', 'Alarms', 273, 416, 254, 56, { targetScreenId: 'alarms' }),
  el(`${prefix}-nav3`, 'nav', 'I/O Status', 538, 416, 254, 56, { targetScreenId: 'io' }),
];
const banner = (prefix: string) => el(`${prefix}-banner`, 'alarm-banner', 'Alarms', 0, 0, 800, 40);

export const HMI: HmiDesign = {
  hmiPartNumber: 'CM5-T7W',
  screens: [
    { id: 'main', name: 'Main', purpose: 'Run the cell and watch its state.', elements: [
      banner('m'),
      el('m-title', 'text', 'Conveyor Cell', 16, 52, 300, 36),
      el('m-run', 'indicator', 'Running', 16, 100, 240, 44, { address: 'C2', style: 'ok', onText: 'Running', offText: 'Stopped' }),
      el('m-safe', 'indicator', 'Safety OK', 16, 152, 240, 44, { address: 'C1', style: 'normal', onText: 'Safety OK', offText: 'E-stop active' }),
      el('m-flt', 'indicator', 'Pusher fault', 16, 204, 240, 44, { address: 'C1101', style: 'alarm' }),
      el('m-count', 'numeric', 'Parts', 16, 264, 300, 50, { address: 'CTD1' }),
      el('m-start', 'button', 'Start', 452, 100, 160, 72, { address: 'C1001', action: 'momentary' }),
      el('m-stop', 'button', 'Stop', 624, 100, 160, 72, { address: 'C1002', action: 'momentary' }),
      el('m-reset', 'button', 'Reset fault', 452, 184, 160, 72, { address: 'C1003', action: 'momentary' }),
      el('m-creset', 'button', 'Reset count', 624, 184, 160, 72, { address: 'C1004', action: 'momentary', note: 'Hold to reset the part count' }),
      ...navBar('m'),
    ] },
    { id: 'alarms', name: 'Alarms', purpose: 'See active faults and reset them.', elements: [
      banner('a'),
      el('a-title', 'text', 'Alarms', 16, 52, 200, 36),
      el('a-1', 'indicator', 'Pusher did not extend in 3 s', 16, 104, 500, 44, { address: 'C1101', style: 'alarm' }),
      el('a-reset', 'button', 'Reset', 624, 104, 160, 72, { address: 'C1003', action: 'momentary' }),
      ...navBar('a'),
    ] },
    { id: 'io', name: 'I/O Status', purpose: 'Check every input and output.', elements: [
      banner('i'),
      el('i-x1', 'indicator', 'X001 E-stop OK', 16, 56, 360, 40, { address: 'X001' }),
      el('i-x2', 'indicator', 'X002 Start PB', 16, 102, 360, 40, { address: 'X002' }),
      el('i-x3', 'indicator', 'X003 Stop PB (NC)', 16, 148, 360, 40, { address: 'X003' }),
      el('i-x4', 'indicator', 'X004 Part at end', 16, 194, 360, 40, { address: 'X004' }),
      el('i-x5', 'indicator', 'X005 Pusher extended', 16, 240, 360, 40, { address: 'X005' }),
      el('i-y1', 'indicator', 'Y001 Conveyor motor', 420, 56, 360, 40, { address: 'Y001' }),
      el('i-y2', 'indicator', 'Y002 Pusher valve', 420, 102, 360, 40, { address: 'Y002' }),
      ...navBar('i'),
    ] },
  ],
  alarms: [{ address: 'C1101', message: 'Pusher did not extend in 3 s', severity: 'alarm' }],
  tags: [
    { name: 'HMI_Start', address: 'C1001', dataType: 'BIT', access: 'write', description: 'Momentary Start; starts the cycle when safe.' },
    { name: 'HMI_Stop', address: 'C1002', dataType: 'BIT', access: 'write', description: 'Momentary Stop; ends the cycle.' },
    { name: 'HMI_Reset', address: 'C1003', dataType: 'BIT', access: 'write', description: 'Resets the pusher fault.' },
    { name: 'HMI_Count_Reset', address: 'C1004', dataType: 'BIT', access: 'write', description: 'Resets the part counter CT1.' },
    { name: 'ALM_Pusher_Fault', address: 'C1101', dataType: 'BIT', access: 'read', description: 'Set by the PLC when the pusher times out.' },
    { name: 'Cycle_Running', address: 'C2', dataType: 'BIT', access: 'read', description: 'Cycle running status.' },
    { name: 'Safety_OK', address: 'C1', dataType: 'BIT', access: 'read', description: 'Safety relay healthy.' },
    { name: 'Part_Count', address: 'CTD1', dataType: 'INT2', access: 'read', description: 'Parts delivered.' },
  ],
  notes: ['Example HMI design.'],
  generatedAt: new Date().toISOString(),
};

const INPUTS: DesignInputs = {
  supply: '480VAC-3PH',
  enclosureRating: 'NEMA 12',
  notes: 'Example project',
  motors: [{ tag: 'M1', description: 'Conveyor motor', hp: 1, voltage: '480VAC-3PH', starter: 'contactor-overload', reversing: false }],
  requiredParts: [],
};

const c = (tag: string, partNumber: string, quantity: number, fn: string, motorTag: string | null = null) => ({ tag, partNumber, quantity, function: fn, motorTag });

export const DESIGN: ElectricalDesign = {
  inputs: INPUTS,
  components: [
    c('ENC1', 'SCE-24EL2008LP', 1, 'Main enclosure 24x20x8 NEMA 12'),
    c('SP1', 'SCE-24P20', 1, 'Back panel'),
    c('DS1', '22013003', 1, 'Main disconnect 30A'),
    c('DS1H', '14831111', 1, 'Disconnect handle'),
    c('DS1S', '14070520', 1, 'Disconnect shaft'),
    c('CB1', 'GMCBU-3C-5', 1, 'Motor M1 branch protection', 'M1'),
    c('CB2', 'GMCBU-3C-3', 1, '24VDC power supply primary'),
    c('PS1', 'PSR-24-120-3', 1, '24VDC control power supply, 3-phase 480 VAC input'),
    c('K1', 'SC-E02PG-24VDC', 1, 'Conveyor motor contactor', 'M1'),
    c('OL1', 'TK-E02-220', 1, 'Conveyor motor overload', 'M1'),
    c('PLC', 'C0-10DD1E-D', 1, 'PLC CPU'),
    c('SR1', 'LG5925-48-61-24', 1, 'E-stop safety relay'),
    c('ES1', 'GCX1131', 1, 'Emergency stop'),
    c('ES1C', 'ECX1030-2', 1, 'Second NC contact for dual-channel E-stop'),
    c('PB1', 'GCX1102', 1, 'Start'),
    c('PB2', 'GCX1101', 1, 'Stop'),
    c('PE1', 'C18D-0P-1A', 1, 'Part at end photo-eye'),
    c('LS1', 'PNK-AP-3H', 1, 'Pusher extended prox'),
    c('SOL1', '100222015324006', 1, 'Pusher valve'),
    c('TB1', 'DN-T10-A', 30, 'Feed-through terminals'),
    c('TBG', 'DN-G10', 6, 'Ground terminals'),
    c('TBE', 'DN-EB35', 4, 'End brackets'),
    c('DIN', 'DN-R35S1', 3, 'DIN rail'),
    c('WD', 'T1-1530G-1', 4, 'Wire duct'),
    c('GB1', 'SCE-GB10', 1, 'Ground bar'),
  ],
  ioWiring: [
    { address: 'X001', deviceTag: 'SR1', location: 'Cabinet', deviceType: 'safety-relay-output', description: 'E-Stop OK (safety relay)' },
    { address: 'X002', deviceTag: 'PB1', location: 'Cabinet door', deviceType: 'pushbutton-no', description: 'Start PB' },
    { address: 'X003', deviceTag: 'PB2', location: 'Cabinet door', deviceType: 'pushbutton-nc', description: 'Stop PB' },
    { address: 'X004', deviceTag: 'PE1', location: 'Pusher station', deviceType: 'sensor-pnp', description: 'Part at end photo-eye' },
    { address: 'X005', deviceTag: 'LS1', location: 'Pusher station', deviceType: 'sensor-pnp', description: 'Pusher extended' },
    { address: 'Y001', deviceTag: 'K1', location: 'Cabinet', deviceType: 'contactor-coil', description: 'Conveyor motor contactor' },
    { address: 'Y002', deviceTag: 'SOL1', location: 'Pusher station', deviceType: 'solenoid', description: 'Pusher solenoid' },
  ],
  notes: ['Example design. Motor FLA assumed 2.1 A at 460 V (NEC 430.250); confirm the nameplate.'],
  machine: {
    zones: ['Conveyor', 'Pusher station'],
    junctionBoxes: [],
    motorLocations: { M1: 'Conveyor' },
    routing: { PE1: null, LS1: null, SOL1: null },
  },
  generatedAt: new Date().toISOString(),
};

/** Bump when the example changes so returning preview viewers get the new one. */
const SEED_VERSION = '5';

function readSeedVersion(): string | null {
  try { return localStorage.getItem('plc-preview-seed'); } catch { return null; }
}

export function seedSampleProject() {
  // Keep the viewer's own work once they have the current example.
  if (readSeedVersion() === SEED_VERSION && useIOStore.getState().projectIO.length) return;
  try { localStorage.setItem('plc-preview-seed', SEED_VERSION); } catch { /* storage blocked: seed anyway */ }
  useProjectStore.getState().setPlc('click', 'C0-10DD1E-D');
  useIOStore.getState().importPoints([
    { description: 'E-Stop OK (safety relay)', type: 'input', category: 'Safety' },
    { description: 'Start Button', type: 'input', category: 'Operator/HMI' },
    { description: 'Stop Button', type: 'input', category: 'Operator/HMI' },
    { description: 'Part at end photo-eye', type: 'input', category: 'Product Detection' },
    { description: 'Pusher extended', type: 'input', category: 'Pneumatic' },
    { description: 'Conveyor motor contactor', type: 'output', category: 'Conveyor' },
    { description: 'Pusher solenoid', type: 'output', category: 'Pneumatic' },
  ], true);
  const prog = useProgramStore.getState();
  prog.setProjectName('Conveyor Cell (example)');
  prog.setGeneratedLadder(LADDER, 'Example program: safety bit, start/stop seal-in, conveyor, pusher with 3 s timeout fault and reset.', null);
  useElectricalStore.getState().setInputs(INPUTS);
  useSpecStore.getState().setSections(SPEC);
  useHmiStore.getState().setHmiPartNumber(HMI.hmiPartNumber);
  useHmiStore.getState().setDesign(HMI, 'Example HMI for a 7" CM5: Main (run/stop/reset, lamps, part count), Alarms and I/O Status screens with the same navigation bar and alarm banner.');
  // Mark every stage as built from this spec so the example opens fully up to date.
  const src = { specFp: fingerprint(SPEC), spec: SPEC, ioFp: ioFingerprint(useIOStore.getState().projectIO), hmiFp: hmiFingerprint(HMI) };
  useProjectStore.getState().setRecommendation(RECOMMENDATION);
  useProjectStore.getState().setModules([]);
  useProjectStore.getState().setInfo({ customer: 'Example Foods Inc.', site: 'Line 3', standards: ['NFPA 79', 'UL 508A'] });
  for (const stage of ['equipment', 'io', 'electrical', 'hmi', 'program'] as const) useStageStore.getState().markGenerated(stage, src);
  useProjectsStore.getState().renameActive('Conveyor Cell (example)');
  useElectricalStore.getState().setDesign(DESIGN, 'generated', 'Example panel: NEMA 12, 480 VAC in through a 30 A disconnect, one 1 HP conveyor on a contactor and overload, 24 VDC control, CLICK PLC, dual-channel E-stop into a safety relay.');
}
