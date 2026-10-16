/**
 * Example conveyor cell, copied from src/preview/sampleProject.ts (which does
 * not export its data), split into two blocks. Used by the simulator tests
 * and preview.
 */
import type { LadderProgram } from '../../plc/ladder';
import type { IOWiring } from '../../electrical/types';
import type { SimIOPoint } from '../machineModel';

export const CONVEYOR_PROGRAM: LadderProgram = {
  blocks: [
    { id: 'conveyor', name: 'Conveyor', description: 'Safety, start/stop and the conveyor motor' },
    { id: 'pusher', name: 'Pusher', description: 'Part-at-end pusher with 3 s timeout fault' },
  ],
  rungs: [
    { id: 'r_safe', block: 'conveyor', comment: 'Safety OK from the E-stop safety relay', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'C1' }] },
    { id: 'r_run', block: 'conveyor', comment: 'Cycle running: Start seals in; Stop (NC button wired), safety loss or fault drops it',
      branches: [[{ type: 'NO', address: 'X002' }, { type: 'NO', address: 'X003' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C10' }],
        [{ type: 'NO', address: 'C2' }, { type: 'NO', address: 'X003' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C10' }]],
      outputs: [{ type: 'OUT', address: 'C2' }] },
    { id: 'r_conv', block: 'conveyor', comment: 'Conveyor runs while cycling and no part is being pushed', branches: [[{ type: 'NO', address: 'C2' }, { type: 'NC', address: 'C3' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'r_push', block: 'pusher', comment: 'Part at end: push it, hold until the pusher is out',
      branches: [[{ type: 'NO', address: 'C2' }, { type: 'RISE', address: 'X004' }], [{ type: 'NO', address: 'C3' }, { type: 'NC', address: 'X005' }, { type: 'NO', address: 'C2' }]],
      outputs: [{ type: 'OUT', address: 'C3' }, { type: 'OUT', address: 'Y002' }] },
    { id: 'r_tmo', block: 'pusher', comment: 'Pusher timeout: 3 s to reach extended', branches: [[{ type: 'NO', address: 'C3' }]],
      outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '3', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'r_flt', block: 'pusher', comment: 'Latch fault on timeout; Start with safety OK resets it', branches: [[{ type: 'NO', address: 'T1' }]], outputs: [{ type: 'SET', address: 'C10' }] },
    { id: 'r_rst', block: 'pusher', comment: 'Fault reset', branches: [[{ type: 'NO', address: 'X002' }, { type: 'NO', address: 'C1' }, { type: 'NC', address: 'C3' }]], outputs: [{ type: 'RST', address: 'C10' }] },
  ],
  tags: [
    { address: 'C1', nickname: 'Safety_OK', comment: 'Safety relay output healthy' },
    { address: 'C2', nickname: 'Cycle_Running', comment: 'Machine running' },
    { address: 'C3', nickname: 'Push_Active', comment: 'Pusher extending' },
    { address: 'C10', nickname: 'Pusher_Fault', comment: 'Pusher did not extend in 3 s' },
    { address: 'T1', nickname: 'Push_Timeout', comment: '3 s pusher timeout' },
  ],
};

export const CONVEYOR_WIRING: IOWiring[] = [
    { address: 'X001', deviceTag: 'SR1', deviceType: 'safety-relay-output', description: 'E-Stop OK (safety relay)' },
    { address: 'X002', deviceTag: 'PB1', deviceType: 'pushbutton-no', description: 'Start PB' },
    { address: 'X003', deviceTag: 'PB2', deviceType: 'pushbutton-nc', description: 'Stop PB' },
    { address: 'X004', deviceTag: 'PE1', deviceType: 'sensor-pnp', description: 'Part at end photo-eye' },
    { address: 'X005', deviceTag: 'LS1', deviceType: 'sensor-pnp', description: 'Pusher extended' },
    { address: 'Y001', deviceTag: 'K1', deviceType: 'contactor-coil', description: 'Conveyor motor contactor' },
    { address: 'Y002', deviceTag: 'SOL1', deviceType: 'solenoid', description: 'Pusher solenoid' },
];

export const CONVEYOR_IO: SimIOPoint[] = [
  { address: 'X001', description: 'E-Stop OK (safety relay)', type: 'input', category: 'Safety' },
  { address: 'X002', description: 'Start Button', type: 'input', category: 'Operator/HMI' },
  { address: 'X003', description: 'Stop Button', type: 'input', category: 'Operator/HMI' },
  { address: 'X004', description: 'Part at end photo-eye', type: 'input', category: 'Product Detection' },
  { address: 'X005', description: 'Pusher extended', type: 'input', category: 'Pneumatic' },
  { address: 'Y001', description: 'Conveyor motor contactor', type: 'output', category: 'Conveyor' },
  { address: 'Y002', description: 'Pusher solenoid', type: 'output', category: 'Pneumatic' },
];
