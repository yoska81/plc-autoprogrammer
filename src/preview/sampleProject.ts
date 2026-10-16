import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProgramStore } from '../store/useProgramStore';
import { useElectricalStore } from '../store/useElectricalStore';
import type { CompareOp, LadderElement, LadderOutput, LadderProgram, Rung } from '../plc/ladder';
import type { DesignInputs, ElectricalDesign } from '../electrical/types';
import type { HmiDesign, HmiElement, HmiState } from '../hmi/types';
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
  modes: '- Auto: Start (panel or HMI) runs the cycle; Stop button (NC) or HMI Stop ends it. Optional batch target stops the cycle after the last part.\n- Manual (HMI, Maintenance password): selectable only while the cycle is stopped; hold-to-run Jog Conveyor and Pusher Extend, each with an interlock (Safety OK, and the other actuator off).',
  motion: 'M1 conveyor motor, 1 HP, 480 VAC 3-phase, across-the-line contactor and overload.',
  pneumatics: 'Pusher cylinder, single 5/2 solenoid valve (spring return), pusher-extended prox. Retracts when the valve is off.',
  sensing: '- Part-at-end photo-eye, PNP.\n- Pusher extended prox, PNP.',
  operator: '- Operator station: Start (green), Stop (red, NC), E-stop.\n- 7" C-more HMI: Main screen with Start/Stop/Reset, running and fault lamps, part count with reset; Alarms screen; I/O status screen.',
  alarms: '- Pusher fault: pusher not extended within the timeout (HMI setpoint, default 3 s). Latches; Reset (panel Start or HMI Reset) clears it when the pusher is back.\n- Safety circuit open while Safety OK is off.\n- Service due warning when the run hours since the last service reach the service interval.',
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

const NO = (address: string): LadderElement => ({ type: 'NO', address });
const NC = (address: string): LadderElement => ({ type: 'NC', address });
const RISE = (address: string): LadderElement => ({ type: 'RISE', address });
const CMP = (left: string, op: CompareOp, right: string): LadderElement => ({ type: 'CMP', left, op, right });
const OUT = (address: string): LadderOutput => ({ type: 'OUT', address });
const COPY = (source: string, dest: string): LadderOutput => ({ type: 'COPY', source, dest });
const MATH = (dest: string, expression: string): LadderOutput => ({ type: 'MATH', dest, expression });
const R = (id: string, block: string, comment: string, branches: LadderElement[][], outputs: LadderOutput[]): Rung => ({ id, block, comment, branches, outputs });

/**
 * Example CLICK program. Implements every tag the example HMI uses:
 * modes and permissives (C1201-C1205), alarms (C1101-C1103), setpoints
 * (DS1001-DS1003) and status words (DS1101-DS1104).
 */
export const LADDER: LadderProgram = {
  blocks: [
    { id: 'safety', name: 'Safety & modes', description: 'First-scan defaults, Safety OK, Auto/Manual mode and the cycle start/stop seal-in.' },
    { id: 'alarms', name: 'Alarms', description: 'Pusher fault latch and reset, safety-open alarm and the service-due warning.' },
    { id: 'conveyor', name: 'Conveyor', description: 'Automatic conveyor run request, part counter and batch complete.' },
    { id: 'pusher', name: 'Pusher', description: 'Pushes the part at the end of the belt, timeout timer and end-of-batch stop.' },
    { id: 'manual', name: 'Manual', description: 'Manual-mode permissives and hold-to-run jog / extend requests from the HMI.' },
    { id: 'outputs', name: 'Outputs', description: 'One coil per output: combines the automatic and manual requests.' },
    { id: 'status', name: 'HMI & status', description: 'Heartbeat, machine state word, pusher cycle counter, run hours, service hours and parts per minute.' },
  ],
  rungs: [
    // ---- Safety & modes
    R('r_init_tmo', 'safety', 'First scan: pusher timeout setpoint outside 1-10 s is loaded with the 3 s default',
      [[NO('SC2'), CMP('DS1001', '<', '1')], [NO('SC2'), CMP('DS1001', '>', '10')]], [COPY('3', 'DS1001')]),
    R('r_init_batch', 'safety', 'First scan: batch target outside 0-9999 is set to 0 (no batch limit)',
      [[NO('SC2'), CMP('DS1002', '<', '0')], [NO('SC2'), CMP('DS1002', '>', '9999')]], [COPY('0', 'DS1002')]),
    R('r_init_svc', 'safety', 'First scan: service interval outside 50-2000 h is set to the 500 h default',
      [[NO('SC2'), CMP('DS1003', '<', '50')], [NO('SC2'), CMP('DS1003', '>', '2000')]], [COPY('500', 'DS1003')]),
    R('r_safe', 'safety', 'Safety OK from the E-stop safety relay output', [[NO('X001')]], [OUT('C1')]),
    R('r_man_reject', 'safety', 'Manual mode request is refused while the cycle runs: the HMI toggle is reset',
      [[NO('C2'), NO('C1005')]], [{ type: 'RST', address: 'C1005' }]),
    R('r_man_mode', 'safety', 'Manual mode active: HMI Manual selected and the cycle stopped',
      [[NO('C1005'), NC('C2')]], [OUT('C1201')]),
    R('r_run', 'safety', 'Cycle running: panel or HMI Start seals in. Stop (NC button), HMI Stop, safety loss, pusher fault, Manual mode or batch complete drops it',
      [
        [RISE('X002'), NO('X003'), NC('C1002'), NO('C1'), NC('C1101'), NC('C1201'), NC('C5')],
        [RISE('C1001'), NO('X003'), NC('C1002'), NO('C1'), NC('C1101'), NC('C1201'), NC('C5')],
        [NO('C2'), NO('X003'), NC('C1002'), NO('C1'), NC('C1101'), NC('C1201'), NC('C5')],
      ],
      [OUT('C2')]),

    // ---- Alarms
    R('r_alm_push', 'alarms', 'Pusher fault alarm latches when the pusher is not extended within the timeout', [[NO('T1')]], [{ type: 'SET', address: 'C1101' }]),
    R('r_alm_reset', 'alarms', 'Fault reset from panel Start or HMI Reset, with Safety OK and the pusher request off',
      [[NO('X002'), NO('C1'), NC('C3')], [NO('C1003'), NO('C1'), NC('C3')]], [{ type: 'RST', address: 'C1101' }]),
    R('r_alm_safe', 'alarms', 'Safety circuit open alarm while Safety OK is off', [[NC('C1')]], [OUT('C1102')]),
    R('r_wrn_svc', 'alarms', 'Service due warning: hours since service reached the service interval',
      [[CMP('DS1104', '>=', 'DS1003'), CMP('DS1003', '>', '0')]], [OUT('C1103')]),

    // ---- Conveyor
    R('r_conv_auto', 'conveyor', 'Automatic conveyor request: cycle running and no part being pushed', [[NO('C2'), NC('C3')]], [OUT('C10')]),
    R('r_cnt', 'conveyor', 'Part counter: each part reaching the end photo-eye (shown on the HMI), reset from the HMI',
      [[NO('X004')]], [{ type: 'CNT', address: 'CT1', direction: 'UP', preset: '9999', resetAddress: 'C1004' }]),
    R('r_batch', 'conveyor', 'Batch complete: a batch target is set and the part count reached it',
      [[CMP('DS1002', '>', '0'), CMP('CTD1', '>=', 'DS1002')]], [OUT('C4')]),

    // ---- Pusher
    R('r_push', 'pusher', 'Automatic push request: a new part at the end starts it, held until the pusher is extended',
      [[NO('C2'), RISE('X004')], [NO('C3'), NC('X005'), NO('C2')]], [OUT('C3')]),
    R('r_tmo', 'pusher', 'Pusher timeout: preset is the HMI setpoint DS1001 (seconds)', [[NO('C3')]],
      [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: 'DS1001', unit: 'sec', accumulate: false, resetAddress: null }]),
    R('r_batch_stop', 'pusher', 'End of batch: stop the cycle once the last part has been pushed', [[NO('C4'), NC('C3')]], [OUT('C5')]),

    // ---- Manual
    R('r_jog_perm', 'manual', 'Jog permitted: Manual mode, Safety OK and the pusher valve off', [[NO('C1201'), NO('C1'), NC('Y002')]], [OUT('C1204')]),
    R('r_ext_perm', 'manual', 'Extend permitted: Manual mode, Safety OK and the conveyor off', [[NO('C1201'), NO('C1'), NC('Y001')]], [OUT('C1205')]),
    R('r_jog_req', 'manual', 'Manual jog request: HMI Jog Conveyor held while permitted', [[NO('C1006'), NO('C1204')]], [OUT('C21')]),
    R('r_ext_req', 'manual', 'Manual extend request: HMI Extend held while permitted; a jog request has priority',
      [[NO('C1007'), NO('C1205'), NC('C21')]], [OUT('C22')]),

    // ---- Outputs
    R('r_y1', 'outputs', 'Conveyor motor contactor K1: automatic run or manual jog', [[NO('C10')], [NO('C21')]], [OUT('Y001')]),
    R('r_y2', 'outputs', 'Pusher solenoid SOL1: automatic push or manual extend (spring return when off)', [[NO('C3')], [NO('C22')]], [OUT('Y002')]),

    // ---- HMI & status
    R('r_hb_pulse', 'status', 'One-scan pulse on each rising edge of the 1 s system clock SC7', [[RISE('SC7')]], [OUT('C12')]),
    R('r_hb', 'status', 'PLC heartbeat for the HMI: changes state every second', [[NO('C12'), NC('C1203')], [NC('C12'), NO('C1203')]], [OUT('C1203')]),
    R('r_st0', 'status', 'Machine state DS1101: 0 Stopped (default, overwritten below by higher states)', [[NO('SC1')]], [COPY('0', 'DS1101')]),
    R('r_st1', 'status', 'Machine state 1 Running', [[NO('C2')]], [COPY('1', 'DS1101')]),
    R('r_st2', 'status', 'Machine state 2 Pushing part', [[NO('C3')]], [COPY('2', 'DS1101')]),
    R('r_st4', 'status', 'Machine state 4 Manual (outranks Running and Pushing)', [[NO('C1201')]], [COPY('4', 'DS1101')]),
    R('r_st3', 'status', 'Machine state 3 Faulted (outranks Manual)', [[NO('C1101')]], [COPY('3', 'DS1101')]),
    R('r_st5', 'status', 'Machine state 5 Safety stop (highest)', [[NC('C1')]], [COPY('5', 'DS1101')]),
    R('r_cyc', 'status', 'Pusher cycle counter: every time the pusher valve turns on, reset from the HMI Maintenance screen',
      [[NO('Y002')]], [{ type: 'CNT', address: 'CT2', direction: 'UP', preset: '32767', resetAddress: 'C1008' }]),
    R('r_hr_tmr', 'status', 'Run-hour timer: accumulates while the conveyor runs, restarts after each full hour',
      [[NO('Y001')]], [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: '3600', unit: 'sec', accumulate: true, resetAddress: 'C11' }]),
    R('r_hr_pulse', 'status', 'One full run hour reached', [[NO('T2')]], [OUT('C11')]),
    R('r_hr_add', 'status', 'Add the hour to the retentive run hours and hours since service', [[NO('C11')]],
      [MATH('DS1102', 'DS1102 + 1'), MATH('DS1104', 'DS1104 + 1')]),
    R('r_svc_done', 'status', 'HMI Service Done clears the hours since service', [[NO('C1009')]], [COPY('0', 'DS1104')]),
    R('r_rate_tmr', 'status', 'Rate window timer: 10 s, restarts itself (T3 is ON for one scan)', [[NC('T3')]],
      [{ type: 'TMR', address: 'T3', mode: 'ON_DELAY', preset: '10', unit: 'sec', accumulate: false, resetAddress: null }]),
    R('r_rate_shift', 'status', 'Every 10 s: shift the six 10 s buckets and store the parts counted in the last 10 s', [[NO('T3')]],
      [COPY('DS1125', 'DS1126'), COPY('DS1124', 'DS1125'), COPY('DS1123', 'DS1124'), COPY('DS1122', 'DS1123'), COPY('DS1121', 'DS1122'),
        MATH('DS1121', 'CTD1 - DS1119'), COPY('CTD1', 'DS1119')]),
    R('r_rate_clamp', 'status', 'A part count reset makes the newest bucket negative: count it as 0', [[NO('T3'), CMP('DS1121', '<', '0')]], [COPY('0', 'DS1121')]),
    R('r_rate', 'status', 'Parts per minute DS1103: parts counted in the last 60 s (six 10 s buckets)', [[NO('T3')]],
      [MATH('DS1103', 'DS1121 + DS1122 + DS1123 + DS1124 + DS1125 + DS1126')]),
  ],
  tags: [
    { address: 'C1', nickname: 'Safety_OK', comment: 'Safety relay output healthy' },
    { address: 'C2', nickname: 'Cycle_Running', comment: 'Automatic cycle running' },
    { address: 'C3', nickname: 'Push_Request', comment: 'Automatic push in progress' },
    { address: 'C4', nickname: 'Batch_Complete', comment: 'Part count reached the batch target DS1002' },
    { address: 'C5', nickname: 'Batch_Stop', comment: 'Batch complete and last part pushed: cycle stops' },
    { address: 'C10', nickname: 'Conv_Auto_Req', comment: 'Conveyor run request from the automatic cycle' },
    { address: 'C11', nickname: 'Run_Hour_Pulse', comment: 'One scan each full run hour' },
    { address: 'C12', nickname: 'Clock_1s_Pulse', comment: 'One scan on each SC7 rising edge' },
    { address: 'C21', nickname: 'Man_Jog_Req', comment: 'Manual jog conveyor request (permitted)' },
    { address: 'C22', nickname: 'Man_Extend_Req', comment: 'Manual pusher extend request (permitted)' },
    { address: 'T1', nickname: 'Push_Timeout', comment: 'Pusher timeout, preset DS1001 s' },
    { address: 'T2', nickname: 'Run_Hour_Timer', comment: 'Accumulates conveyor run time, 3600 s' },
    { address: 'T3', nickname: 'Rate_Window', comment: '10 s parts-per-minute window' },
    { address: 'TD1', nickname: 'Push_Timer_Value', comment: 'T1 elapsed seconds' },
    { address: 'TD2', nickname: 'Run_Hour_Seconds', comment: 'T2 elapsed seconds in the current hour' },
    { address: 'TD3', nickname: 'Rate_Window_Value', comment: 'T3 elapsed seconds' },
    { address: 'CT1', nickname: 'Part_Count', comment: 'Parts delivered' },
    { address: 'CT2', nickname: 'Pusher_Cycles', comment: 'Pusher valve operations' },
    { address: 'CTD1', nickname: 'Part_Count_Value', comment: 'Parts delivered (HMI)' },
    { address: 'CTD2', nickname: 'Pusher_Cycles_Value', comment: 'Pusher cycles (HMI)' },
    { address: 'SC1', nickname: '_Always_ON', comment: 'CLICK system bit: always ON' },
    { address: 'SC2', nickname: '_1st_SCAN', comment: 'CLICK system bit: ON for the first scan only' },
    { address: 'SC7', nickname: '_1sec_Clock', comment: 'CLICK system bit: 1 s clock (0.5 s ON / 0.5 s OFF)' },
    { address: 'C1001', nickname: 'HMI_Start', comment: 'HMI Start button' },
    { address: 'C1002', nickname: 'HMI_Stop', comment: 'HMI Stop button' },
    { address: 'C1003', nickname: 'HMI_Reset', comment: 'HMI fault reset' },
    { address: 'C1004', nickname: 'HMI_Count_Reset', comment: 'HMI part count reset' },
    { address: 'C1005', nickname: 'HMI_Manual_Select', comment: 'HMI Manual mode toggle (refused while running)' },
    { address: 'C1006', nickname: 'HMI_Jog_Conveyor', comment: 'HMI hold-to-run jog conveyor' },
    { address: 'C1007', nickname: 'HMI_Pusher_Extend', comment: 'HMI hold-to-run pusher extend' },
    { address: 'C1008', nickname: 'HMI_Pusher_Cycles_Reset', comment: 'HMI reset of pusher cycle counter CT2' },
    { address: 'C1009', nickname: 'HMI_Service_Done', comment: 'HMI service done: clears DS1104' },
    { address: 'C1101', nickname: 'ALM_Pusher_Fault', comment: 'Pusher not extended within DS1001 s' },
    { address: 'C1102', nickname: 'ALM_Safety_Open', comment: 'Safety circuit open (E-stop)' },
    { address: 'C1103', nickname: 'WRN_Service_Due', comment: 'Hours since service reached the interval' },
    { address: 'C1201', nickname: 'STS_Manual_Mode', comment: 'Manual mode active' },
    { address: 'C1203', nickname: 'STS_Heartbeat', comment: 'Changes state every second' },
    { address: 'C1204', nickname: 'STS_Jog_Permit', comment: 'Manual jog conveyor permitted' },
    { address: 'C1205', nickname: 'STS_Extend_Permit', comment: 'Manual pusher extend permitted' },
    { address: 'DS1001', nickname: 'SP_Pusher_Timeout', comment: 'Pusher timeout s (1-10, default 3)' },
    { address: 'DS1002', nickname: 'SP_Batch_Target', comment: 'Batch size in parts (0 = off)' },
    { address: 'DS1003', nickname: 'SP_Service_Interval', comment: 'Run hours between services (50-2000, default 500)' },
    { address: 'DS1101', nickname: 'Machine_State', comment: '0 Stopped 1 Running 2 Pushing 3 Faulted 4 Manual 5 Safety stop' },
    { address: 'DS1102', nickname: 'Run_Hours', comment: 'Retentive conveyor run hours' },
    { address: 'DS1103', nickname: 'Parts_Per_Min', comment: 'Parts counted in the last 60 s' },
    { address: 'DS1104', nickname: 'Hours_Since_Service', comment: 'Retentive run hours since Service Done' },
    { address: 'DS1119', nickname: 'Rate_Count_Snapshot', comment: 'CTD1 at the start of the current 10 s window' },
    { address: 'DS1121', nickname: 'Rate_Bucket_1', comment: 'Parts in the newest 10 s window' },
    { address: 'DS1122', nickname: 'Rate_Bucket_2', comment: 'Parts 10-20 s ago' },
    { address: 'DS1123', nickname: 'Rate_Bucket_3', comment: 'Parts 20-30 s ago' },
    { address: 'DS1124', nickname: 'Rate_Bucket_4', comment: 'Parts 30-40 s ago' },
    { address: 'DS1125', nickname: 'Rate_Bucket_5', comment: 'Parts 40-50 s ago' },
    { address: 'DS1126', nickname: 'Rate_Bucket_6', comment: 'Parts 50-60 s ago' },
  ],
};

const el = (id: string, kind: HmiElement['kind'], label: string, x: number, y: number, w: number, h: number, more: Partial<HmiElement> = {}): HmiElement => ({
  id, kind, label, x, y, w, h, address: null, action: null, targetScreenId: null, onText: null, offText: null, style: 'normal', units: null, min: null, max: null, note: null, ...more,
});
// 800x480 CM5-T7W: header 0-44, content 52-416, navigation 428-476 (same on every screen).
const NAV: [string, string][] = [['main', 'Main'], ['manual', 'Manual'], ['setup', 'Setup'], ['alarms', 'Alarms'], ['diag', 'Diagnostics'], ['maint', 'Maintenance']];
const frame = (p: string) => [
  el(`${p}-hdr`, 'header', 'Conveyor Cell', 0, 0, 800, 44, {
    address: 'C1201', targetScreenId: 'alarms',
    states: [{ value: 0, text: 'Auto', style: 'normal' }, { value: 1, text: 'Manual', style: 'warning' }],
  }),
  ...NAV.map(([id, name], i) => el(`${p}-nav-${id}`, 'nav', name, 8 + i * 132, 428, 124, 48, { targetScreenId: id })),
];
const MACHINE_STATES: HmiState[] = [
  { value: 0, text: 'Stopped', style: 'normal' },
  { value: 1, text: 'Running', style: 'ok' },
  { value: 2, text: 'Pushing Part', style: 'ok' },
  { value: 3, text: 'Faulted', style: 'alarm' },
  { value: 4, text: 'Manual', style: 'warning' },
  { value: 5, text: 'Safety Stop', style: 'alarm' },
];

export const HMI: HmiDesign = {
  hmiPartNumber: 'CM5-T7W',
  machineName: 'Conveyor Cell',
  screens: [
    { id: 'main', name: 'Main', purpose: 'Overview: machine schematic, state, production counts and the run controls.', elements: [
      ...frame('m'),
      el('m-mach', 'machine', 'Conveyor Cell · Top View', 16, 52, 480, 196, { symbols: [
        { kind: 'motor', label: 'M1', address: 'Y001', x: 24, y: 34, w: 36, h: 36 },
        { kind: 'sensor', label: 'PE1', address: 'X004', x: 356, y: 104, w: 44, h: 12 },
        { kind: 'cylinder', label: 'Pusher', address: 'Y002', x: 300, y: 28, w: 24, h: 60 },
        { kind: 'light', label: 'Ext', address: 'X005', x: 392, y: 40, w: 14, h: 14 },
        { kind: 'conveyor', label: 'Conveyor', address: 'Y001', x: 20, y: 92, w: 330, h: 36 },
        { kind: 'part', label: '', address: 'X004', x: 300, y: 98, w: 24, h: 24 },
        { kind: 'station', label: 'Take-away', address: null, x: 290, y: 140, w: 170, h: 48 },
      ] }),
      el('m-state', 'multistate', 'Machine State', 504, 52, 280, 64, { address: 'DS1101', states: MACHINE_STATES }),
      el('m-start', 'button', 'Start', 504, 124, 136, 64, { address: 'C1001', action: 'momentary', style: 'ok', note: 'Starts the cycle when safety is OK, no fault and Auto mode' }),
      el('m-stop', 'button', 'Stop', 648, 124, 136, 64, { address: 'C1002', action: 'momentary', style: 'alarm' }),
      el('m-reset', 'button', 'Reset Fault', 504, 196, 136, 52, { address: 'C1003', action: 'momentary' }),
      el('m-safe', 'indicator', 'Safety OK', 648, 196, 136, 52, { address: 'C1', style: 'ok', onText: 'Safety OK', offText: 'E-stop' }),
      el('m-count', 'numeric', 'Parts', 16, 256, 152, 56, { address: 'CTD1' }),
      el('m-rate', 'numeric', 'Rate', 176, 256, 152, 56, { address: 'DS1103', units: '/min' }),
      el('m-creset', 'button', 'Reset Count', 336, 256, 160, 56, { address: 'C1004', action: 'momentary', note: 'Hold to reset the part count' }),
      el('m-run', 'indicator', 'Running', 16, 320, 152, 56, { address: 'C2', style: 'ok', onText: 'Running', offText: 'Stopped' }),
      el('m-flt', 'indicator', 'Pusher Fault', 176, 320, 152, 56, { address: 'C1101', style: 'alarm', onText: 'Pusher Fault', offText: 'Pusher OK' }),
      el('m-batch', 'numeric', 'Batch', 336, 320, 160, 56, { address: 'DS1002', units: 'pcs' }),
      el('m-trend', 'trend', 'Parts · Last 60 s', 504, 256, 280, 120, { address: 'CTD1', style: 'normal' }),
      el('m-banner', 'alarm-banner', 'Alarms', 16, 384, 768, 32),
    ] },
    { id: 'manual', name: 'Manual', purpose: 'Jog each actuator by hand in Manual mode; every button shows its interlock.', level: 'maintenance', elements: [
      ...frame('n'),
      el('n-mode', 'panel', 'Mode', 16, 52, 768, 84),
      el('n-sel', 'button', 'Manual Mode', 32, 78, 160, 50, { address: 'C1005', action: 'toggle', onText: 'Manual On', offText: 'Select Manual', level: 'maintenance', note: 'Accepted by the PLC only while the cycle is stopped' }),
      el('n-man', 'indicator', 'Manual Active', 208, 80, 184, 46, { address: 'C1201', style: 'warning', onText: 'Manual Active', offText: 'Auto Mode' }),
      el('n-safe', 'indicator', 'Safety OK', 408, 80, 176, 46, { address: 'C1', style: 'ok', onText: 'Safety OK', offText: 'E-stop' }),
      el('n-hint', 'text', 'Hold-to-run buttons', 600, 93, 168, 20, { style: 'warning' }),
      el('n-conv', 'panel', 'Conveyor M1', 16, 144, 768, 128),
      el('n-jog', 'button', 'Jog Conveyor', 32, 176, 160, 80, { address: 'C1006', action: 'momentary', interlock: 'C1204', level: 'maintenance', note: 'Hold to run' }),
      el('n-y1', 'indicator', 'Motor', 208, 180, 184, 44, { address: 'Y001', style: 'ok', onText: 'Motor On', offText: 'Motor Off' }),
      el('n-p1', 'indicator', 'Jog Permitted', 408, 180, 176, 44, { address: 'C1204', style: 'ok', onText: 'Jog Permitted', offText: 'Not Permitted' }),
      el('n-x4', 'indicator', 'Part at End', 600, 180, 168, 44, { address: 'X004', onText: 'Part at End', offText: 'No Part' }),
      el('n-c1', 'text', 'Needs Manual mode, Safety OK and pusher retracted', 208, 236, 560, 20),
      el('n-push', 'panel', 'Pusher Cylinder', 16, 280, 768, 128),
      el('n-ext', 'button', 'Extend', 32, 312, 160, 80, { address: 'C1007', action: 'momentary', interlock: 'C1205', level: 'maintenance', note: 'Hold to extend; spring return retracts on release' }),
      el('n-y2', 'indicator', 'Valve', 208, 316, 184, 44, { address: 'Y002', style: 'ok', onText: 'Valve On', offText: 'Valve Off' }),
      el('n-x5', 'indicator', 'Position', 408, 316, 176, 44, { address: 'X005', onText: 'Extended', offText: 'Retracted' }),
      el('n-p2', 'indicator', 'Extend Permitted', 600, 316, 168, 44, { address: 'C1205', style: 'ok', onText: 'Permitted', offText: 'Not Permitted' }),
      el('n-c2', 'text', 'Spring return: retracts on release · needs conveyor stopped', 208, 372, 560, 20),
    ] },
    { id: 'setup', name: 'Setup', purpose: 'Machine setpoints with units and limits (Maintenance password).', level: 'maintenance', elements: [
      ...frame('s'),
      el('s-pg', 'panel', 'Pusher', 16, 52, 376, 172),
      el('s-tmo', 'numeric-entry', 'Pusher Timeout', 32, 84, 344, 60, { address: 'DS1001', units: 's', min: 1, max: 10, level: 'maintenance', note: 'Fault if the pusher is not extended within this time (default 3 s)' }),
      el('s-td1', 'numeric', 'Timer Now', 32, 152, 344, 56, { address: 'TD1', units: 's' }),
      el('s-prod', 'panel', 'Production', 408, 52, 376, 172),
      el('s-batch', 'numeric-entry', 'Batch Target', 424, 84, 344, 60, { address: 'DS1002', units: 'pcs', min: 0, max: 9999, level: 'maintenance', note: '0 = no batch limit' }),
      el('s-parts', 'numeric', 'Parts Done', 424, 152, 344, 56, { address: 'CTD1', units: 'pcs' }),
      el('s-mg', 'panel', 'Service', 16, 232, 376, 112),
      el('s-svc', 'numeric-entry', 'Service Interval', 32, 264, 344, 64, { address: 'DS1003', units: 'h', min: 50, max: 2000, level: 'engineer', note: 'Run hours between pusher/conveyor services' }),
      el('s-acc', 'panel', 'Access', 408, 232, 376, 112),
      el('s-n1', 'text', 'Maintenance password to change values', 424, 266, 344, 20),
      el('s-n2', 'text', 'Service interval: Engineer password', 424, 292, 344, 20),
      el('s-n3', 'text', 'Changes apply on the next cycle', 424, 318, 344, 20),
    ] },
    { id: 'alarms', name: 'Alarms', purpose: 'Active alarms with time stamps and the alarm history; reset once the cause is cleared.', elements: [
      ...frame('a'),
      el('a-list', 'alarm-list', 'Message', 16, 52, 560, 356),
      el('a-reset', 'button', 'Reset', 592, 52, 192, 72, { address: 'C1003', action: 'momentary', note: 'Clears latched faults once the cause is gone' }),
      el('a-1', 'indicator', 'Pusher Fault', 592, 140, 192, 48, { address: 'C1101', style: 'alarm' }),
      el('a-2', 'indicator', 'Safety Open', 592, 196, 192, 48, { address: 'C1102', style: 'alarm' }),
      el('a-3', 'indicator', 'Service Due', 592, 252, 192, 48, { address: 'C1103', style: 'warning' }),
      el('a-n', 'text', 'Latched until reset', 592, 316, 192, 20),
    ] },
    { id: 'diag', name: 'Diagnostics', purpose: 'Every input and output by module, plus PLC communication status.', elements: [
      ...frame('d'),
      el('d-in', 'panel', 'CPU Inputs  X001–X008', 16, 52, 376, 290),
      el('d-x1', 'indicator', 'X001 E-stop OK', 32, 84, 344, 40, { address: 'X001' }),
      el('d-x2', 'indicator', 'X002 Start PB', 32, 132, 344, 40, { address: 'X002' }),
      el('d-x3', 'indicator', 'X003 Stop PB (NC)', 32, 180, 344, 40, { address: 'X003' }),
      el('d-x4', 'indicator', 'X004 Part at End', 32, 228, 344, 40, { address: 'X004' }),
      el('d-x5', 'indicator', 'X005 Pusher Extended', 32, 276, 344, 40, { address: 'X005' }),
      el('d-out', 'panel', 'CPU Outputs  Y001–Y006', 408, 52, 376, 136),
      el('d-y1', 'indicator', 'Y001 Conveyor Motor', 424, 84, 344, 40, { address: 'Y001' }),
      el('d-y2', 'indicator', 'Y002 Pusher Valve', 424, 132, 344, 40, { address: 'Y002' }),
      el('d-com', 'panel', 'Communications', 408, 196, 376, 146),
      el('d-hb', 'indicator', 'PLC Heartbeat', 424, 228, 344, 40, { address: 'C1203', style: 'ok', note: 'Blinks once a second while the PLC runs and the link is up' }),
      el('d-c1', 'text', 'CLICK Ethernet · Modbus TCP port 502', 424, 280, 344, 20),
      el('d-c2', 'text', 'PLC C0-10DD1E-D · HMI CM5-T7W', 424, 306, 344, 20),
      el('d-state', 'multistate', 'Machine State', 16, 352, 376, 56, { address: 'DS1101', states: MACHINE_STATES }),
      el('d-safe', 'indicator', 'Safety OK', 408, 352, 376, 56, { address: 'C1', style: 'ok', onText: 'Safety OK', offText: 'Safety Open' }),
    ] },
    { id: 'maint', name: 'Maintenance', purpose: 'Cycle counters, run hours and service reminder; counter resets need the Maintenance password.', elements: [
      ...frame('t'),
      el('t-cg', 'panel', 'Counters', 16, 52, 376, 228),
      el('t-cyc', 'numeric', 'Pusher Cycles', 32, 84, 344, 56, { address: 'CTD2' }),
      el('t-rcyc', 'button', 'Reset Cycles', 32, 148, 168, 56, { address: 'C1008', action: 'momentary', level: 'maintenance' }),
      el('t-rpart', 'button', 'Reset Parts', 208, 148, 168, 56, { address: 'C1004', action: 'momentary', level: 'maintenance' }),
      el('t-parts', 'numeric', 'Parts', 32, 212, 344, 56, { address: 'CTD1' }),
      el('t-rg', 'panel', 'Run Time', 408, 52, 376, 228),
      el('t-hrs', 'numeric', 'Run Hours', 424, 84, 344, 56, { address: 'DS1102', units: 'h' }),
      el('t-svc', 'numeric', 'Since Service', 424, 148, 344, 56, { address: 'DS1104', units: 'h' }),
      el('t-done', 'button', 'Service Done', 424, 212, 168, 56, { address: 'C1009', action: 'momentary', level: 'maintenance', note: 'Resets the hours since service' }),
      el('t-due', 'indicator', 'Service Due', 600, 212, 168, 56, { address: 'C1103', style: 'warning', onText: 'Service Due', offText: 'Service OK' }),
      el('t-clock', 'datetime', 'Date / Time', 16, 288, 376, 56),
      el('t-int', 'numeric', 'Service Interval', 408, 288, 376, 56, { address: 'DS1003', units: 'h' }),
      el('t-note', 'text', 'Counters and hours are retentive in the PLC', 16, 360, 768, 20),
    ] },
  ],
  alarms: [
    { address: 'C1101', message: 'Pusher did not extend in time', severity: 'alarm' },
    { address: 'C1102', message: 'Safety circuit open (E-stop)', severity: 'alarm' },
    { address: 'C1103', message: 'Service due: run hours reached', severity: 'warning' },
  ],
  tags: [
    { name: 'HMI_Start', address: 'C1001', dataType: 'BIT', access: 'write', description: 'Momentary Start; starts the cycle when safe.' },
    { name: 'HMI_Stop', address: 'C1002', dataType: 'BIT', access: 'write', description: 'Momentary Stop; ends the cycle.' },
    { name: 'HMI_Reset', address: 'C1003', dataType: 'BIT', access: 'write', description: 'Resets the pusher fault.' },
    { name: 'HMI_Count_Reset', address: 'C1004', dataType: 'BIT', access: 'write', description: 'Resets the part counter CT1.' },
    { name: 'HMI_Manual_Select', address: 'C1005', dataType: 'BIT', access: 'read-write', description: 'Toggle from the HMI: ON requests Manual mode. PLC accepts it only while the cycle is stopped (C2 OFF).' },
    { name: 'HMI_Jog_Conveyor', address: 'C1006', dataType: 'BIT', access: 'write', description: 'Hold-to-run: PLC runs Y001 while ON and C1204 (jog permitted) is ON.' },
    { name: 'HMI_Pusher_Extend', address: 'C1007', dataType: 'BIT', access: 'write', description: 'Hold-to-run: PLC energizes Y002 while ON and C1205 (extend permitted) is ON.' },
    { name: 'HMI_Pusher_Cycles_Reset', address: 'C1008', dataType: 'BIT', access: 'write', description: 'Resets the pusher cycle counter CT2.' },
    { name: 'HMI_Service_Done', address: 'C1009', dataType: 'BIT', access: 'write', description: 'Resets the hours-since-service register DS1104 to 0.' },
    { name: 'ALM_Pusher_Fault', address: 'C1101', dataType: 'BIT', access: 'read', description: 'Set by the PLC when the pusher times out.' },
    { name: 'ALM_Safety_Open', address: 'C1102', dataType: 'BIT', access: 'read', description: 'PLC sets ON while Safety OK (C1) is OFF.' },
    { name: 'WRN_Service_Due', address: 'C1103', dataType: 'BIT', access: 'read', description: 'PLC sets ON when DS1104 (hours since service) ≥ DS1003 (service interval).' },
    { name: 'STS_Manual_Mode', address: 'C1201', dataType: 'BIT', access: 'read', description: 'PLC sets ON when Manual mode is active (C1005 ON and cycle stopped); Start is blocked while ON.' },
    { name: 'STS_Heartbeat', address: 'C1203', dataType: 'BIT', access: 'read', description: 'PLC toggles every second (comms watchdog shown on Diagnostics).' },
    { name: 'STS_Jog_Permit', address: 'C1204', dataType: 'BIT', access: 'read', description: 'PLC sets ON when C1201 Manual, C1 Safety OK and Y002 pusher valve OFF.' },
    { name: 'STS_Extend_Permit', address: 'C1205', dataType: 'BIT', access: 'read', description: 'PLC sets ON when C1201 Manual, C1 Safety OK and Y001 conveyor OFF.' },
    { name: 'SP_Pusher_Timeout', address: 'DS1001', dataType: 'INT', access: 'read-write', description: 'Pusher timeout in seconds (1–10, default 3); preset of timer T1.' },
    { name: 'SP_Batch_Target', address: 'DS1002', dataType: 'INT', access: 'read-write', description: 'Batch size in parts (0 = off); PLC stops the cycle when CTD1 reaches it.' },
    { name: 'SP_Service_Interval', address: 'DS1003', dataType: 'INT', access: 'read-write', description: 'Run hours between services (50–2000).' },
    { name: 'Machine_State', address: 'DS1101', dataType: 'INT', access: 'read', description: 'PLC writes 0 Stopped, 1 Running, 2 Pushing, 3 Faulted, 4 Manual, 5 Safety stop (highest applicable).' },
    { name: 'Run_Hours', address: 'DS1102', dataType: 'INT', access: 'read', description: 'Retentive conveyor run hours (count while Y001 is ON).' },
    { name: 'Parts_Per_Min', address: 'DS1103', dataType: 'INT', access: 'read', description: 'Parts counted in the last 60 s.' },
    { name: 'Hours_Since_Service', address: 'DS1104', dataType: 'INT', access: 'read', description: 'Retentive run hours since the last Service Done.' },
    { name: 'Cycle_Running', address: 'C2', dataType: 'BIT', access: 'read', description: 'Cycle running status.' },
    { name: 'Safety_OK', address: 'C1', dataType: 'BIT', access: 'read', description: 'Safety relay healthy.' },
    { name: 'Part_Count', address: 'CTD1', dataType: 'INT2', access: 'read', description: 'Parts delivered.' },
    { name: 'Pusher_Cycles', address: 'CTD2', dataType: 'INT2', access: 'read', description: 'Counter CT2 counts each Y002 rising edge; reset by C1008.' },
    { name: 'Push_Timer', address: 'TD1', dataType: 'INT', access: 'read', description: 'Pusher timeout timer T1 current value (s).' },
  ],
  notes: [
    'Example HMI design: Main, Manual, Setup, Alarms, Diagnostics and Maintenance screens with a common header and navigation bar.',
    'Passwords: Maintenance (C-more group 2) for Manual, Setup and counter resets; Engineer (group 3) for the service interval. Confirm the numbers with the customer.',
  ],
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
const SEED_VERSION = '8';

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
  prog.setGeneratedLadder(LADDER, 'Example program in 7 blocks: safety and Auto/Manual modes, alarms, conveyor with part and batch counting, pusher with an adjustable timeout fault, manual jog with permissives, one coil per output, and HMI status (machine state, heartbeat, run hours, service hours, parts per minute).', null);
  useElectricalStore.getState().setInputs(INPUTS);
  useSpecStore.getState().setSections(SPEC);
  useHmiStore.getState().setHmiPartNumber(HMI.hmiPartNumber);
  useHmiStore.getState().setDesign(HMI, 'Example HMI for a 7" CM5: Main (run/stop/reset, lamps, part count), Alarms and I/O Status screens with the same navigation bar and alarm banner.');
  // Mark every stage as built from this spec so the example opens fully up to date.
  const src = { specFp: fingerprint(SPEC), spec: SPEC, ioFp: ioFingerprint(useIOStore.getState().projectIO), hmiFp: hmiFingerprint(HMI) };
  useProjectStore.getState().setRecommendation(RECOMMENDATION);
  useProjectStore.getState().setModules([]);
  useProjectStore.getState().setInfo({
    customer: 'Example Foods Inc.', site: 'Line 3', standards: ['NFPA 79', 'UL 508A', 'NEC'],
    company: 'ISA', projectNumber: '24-117', drawingPrefix: 'CNV', preparedBy: 'AI', checkedBy: '', approvedBy: '',
    revisions: [{ rev: 'A', date: new Date().toISOString().slice(0, 10), description: 'Issued for review', by: 'AI' }],
  });
  for (const stage of ['equipment', 'io', 'electrical', 'hmi', 'program'] as const) useStageStore.getState().markGenerated(stage, src);
  useProjectsStore.getState().renameActive('Conveyor Cell (example)');
  useElectricalStore.getState().setDesign(DESIGN, 'generated', 'Example panel: NEMA 12, 480 VAC in through a 30 A disconnect, one 1 HP conveyor on a contactor and overload, 24 VDC control, CLICK PLC, dual-channel E-stop into a safety relay.');
}
