import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProgramStore } from '../store/useProgramStore';
import { useElectricalStore } from '../store/useElectricalStore';
import type { LadderProgram } from '../plc/ladder';
import type { DesignInputs, ElectricalDesign } from '../electrical/types';

/** Example project shown in the side-panel preview (only when nothing is saved yet). */

const DESCRIPTION = 'Conveyor cell: Start runs the conveyor while the E-stop circuit is healthy. When a part reaches the end photo-eye, stop the conveyor, extend the pusher, wait for the pusher-extended prox (fault after 3 s), retract and restart. Stop button stops everything.';

const LADDER: LadderProgram = {
  rungs: [
    { id: 'r_safe', comment: 'Safety OK from the E-stop safety relay', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r_run', comment: 'Cycle running: Start seals in; Stop (NC button wired), safety loss or fault drops it',
      branches: [[{ type: 'NO', address: 'X002' }, { type: 'NO', address: 'X003' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C10' }],
        [{ type: 'NO', address: 'C2' }, { type: 'NO', address: 'X003' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C10' }]],
      outputs: [{ type: 'OUT', address: 'C2' }] },
    { id: 'r_conv', comment: 'Conveyor runs while cycling and no part is being pushed', branches: [[{ type: 'NO', address: 'C2' }, { type: 'NC', address: 'C3' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'r_push', comment: 'Part at end: push it, hold until the pusher is out',
      branches: [[{ type: 'NO', address: 'C2' }, { type: 'RISE', address: 'X004' }], [{ type: 'NO', address: 'C3' }, { type: 'NC', address: 'X005' }, { type: 'NO', address: 'C2' }]],
      outputs: [{ type: 'OUT', address: 'C3' }, { type: 'OUT', address: 'Y002' }] },
    { id: 'r_tmo', comment: 'Pusher timeout: 3 s to reach extended', branches: [[{ type: 'NO', address: 'C3' }]],
      outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '3', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r_flt', comment: 'Latch fault on timeout; Start with safety OK resets it', branches: [[{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'SET', address: 'C10' }] },
    { id: 'r_rst', comment: 'Fault reset', branches: [[{ type: 'NO', address: 'X002' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C3' }]], outputs: [{ type: 'RST', address: 'C10' }] },
  ],
  tags: [
    { address: 'C1', nickname: 'Safety_OK', comment: 'Safety relay output healthy' },
    { address: 'C2', nickname: 'Cycle_Running', comment: 'Machine running' },
    { address: 'C3', nickname: 'Push_Active', comment: 'Pusher extending' },
    { address: 'C10', nickname: 'Pusher_Fault', comment: 'Pusher did not extend in 3 s' },
    { address: 'T1', nickname: 'Push_Timeout', comment: '3 s pusher timeout' },
  ],
};

const INPUTS: DesignInputs = {
  supply: '480VAC-3PH',
  enclosureRating: 'NEMA 12',
  notes: 'Example project',
  motors: [{ tag: 'M1', description: 'Conveyor motor', hp: 1, voltage: '480VAC-3PH', starter: 'contactor-overload', reversing: false }],
  requiredParts: [],
};

const c = (tag: string, partNumber: string, quantity: number, fn: string, motorTag: string | null = null) => ({ tag, partNumber, quantity, function: fn, motorTag });

const DESIGN: ElectricalDesign = {
  inputs: INPUTS,
  components: [
    c('ENC1', 'SCE-24EL2008LP', 1, 'Main enclosure 24x20x8 NEMA 12'),
    c('SP1', 'SCE-24P20', 1, 'Back panel'),
    c('DS1', '22013003', 1, 'Main disconnect 30A'),
    c('DS1H', '14831111', 1, 'Disconnect handle'),
    c('DS1S', '14070520', 1, 'Disconnect shaft'),
    c('CB1', 'GMCBU-3C-5', 1, 'Motor M1 branch protection', 'M1'),
    c('CB2', 'GMCBU-2C-10', 1, '24VDC power supply primary'),
    c('PS1', 'PSR-24-120', 1, '24VDC control power supply'),
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
    { address: 'X001', deviceTag: 'SR1', deviceType: 'safety-relay-output', description: 'E-Stop OK (safety relay)' },
    { address: 'X002', deviceTag: 'PB1', deviceType: 'pushbutton-no', description: 'Start PB' },
    { address: 'X003', deviceTag: 'PB2', deviceType: 'pushbutton-nc', description: 'Stop PB' },
    { address: 'X004', deviceTag: 'PE1', deviceType: 'sensor-pnp', description: 'Part at end photo-eye' },
    { address: 'X005', deviceTag: 'LS1', deviceType: 'sensor-pnp', description: 'Pusher extended' },
    { address: 'Y001', deviceTag: 'K1', deviceType: 'contactor-coil', description: 'Conveyor motor contactor' },
    { address: 'Y002', deviceTag: 'SOL1', deviceType: 'solenoid', description: 'Pusher solenoid' },
  ],
  notes: ['Example design. Motor FLA assumed 2.1 A at 460 V (NEC 430.250); confirm the nameplate.'],
  generatedAt: new Date().toISOString(),
};

export function seedSampleProject() {
  if (useIOStore.getState().projectIO.length) return; // keep anything the viewer already made
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
  prog.setUserPrompt(DESCRIPTION);
  prog.setGeneratedLadder(LADDER, 'Example program: safety bit, start/stop seal-in, conveyor, pusher with 3 s timeout fault and reset.', null);
  useElectricalStore.getState().setInputs(INPUTS);
  useElectricalStore.getState().setDesign(DESIGN, 'generated', 'Example panel: NEMA 12, 480 VAC in through a 30 A disconnect, one 1 HP conveyor on a contactor and overload, 24 VDC control, CLICK PLC, dual-channel E-stop into a safety relay.');
}
