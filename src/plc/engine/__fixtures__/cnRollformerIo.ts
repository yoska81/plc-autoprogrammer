/**
 * The user's roll former (cn-rollformer-01) as converted from its relay drawings: Debug 1's
 * convertMachine(normalizeMachine(CN_ROLLFORMER_01_READING)).io at claude/isa-debug-app 8250d4f (E-stops and guard on
 * the safety relay, Safety OK into the PLC, the KT1 cut watchdog as "(watchdog 2 s)"). Addresses are the drawn ones;
 * the app reassigns PLC addresses on import, so only description / type / category / deviceType are used.
 */
import type { IOCategory } from '../../../types/io';

export const CN_ROLLFORMER_IO: { address: string; description: string; type: 'input' | 'output'; deviceType: string; category: IOCategory }[] = [
  { address: 'KA0 S33-S34 / U2 DI5', description: 'Reset (复位): safety relay and servo alarm reset', type: 'input', deviceType: 'pushbutton-no', category: 'Safety' },
  { address: 'KM1 coil', description: 'Pump start (油泵启动)', type: 'input', deviceType: 'pushbutton-no', category: 'Operator/HMI' },
  { address: 'KM1 coil', description: 'Pump stop (油泵停止)', type: 'input', deviceType: 'pushbutton-nc', category: 'Operator/HMI' },
  { address: 'KA1 coil', description: 'Line start (运行)', type: 'input', deviceType: 'pushbutton-no', category: 'Operator/HMI' },
  { address: 'KA1 coil', description: 'Line stop (停止)', type: 'input', deviceType: 'pushbutton-nc', category: 'Operator/HMI' },
  { address: 'KA2 coil', description: 'Jog forward (点动正转)', type: 'input', deviceType: 'pushbutton-no', category: 'Operator/HMI' },
  { address: 'KA3 coil', description: 'Jog reverse (点动反转)', type: 'input', deviceType: 'pushbutton-no', category: 'Operator/HMI' },
  { address: 'YV1 (wire 341)', description: 'Manual cut, line stopped only (手动剪切)', type: 'input', deviceType: 'pushbutton-no', category: 'Operator/HMI' },
  { address: 'H7CX RST', description: 'Counter reset (计数复位)', type: 'input', deviceType: 'pushbutton-no', category: 'Operator/HMI' },
  { address: 'KA4 coil', description: 'Servo enable selector (伺服使能)', type: 'input', deviceType: 'selector', category: 'Servo/Axis' },
  { address: 'KA8 coil', description: 'Shear down limit (下限位)', type: 'input', deviceType: 'limit-switch', category: 'Station 1' },
  { address: 'KA8 coil', description: 'Shear up limit (上限位)', type: 'input', deviceType: 'limit-switch', category: 'Station 1' },
  { address: 'KA9 coil', description: 'Run-out end photo eye, NPN (出料到位)', type: 'input', deviceType: 'sensor-npn', category: 'Product Detection' },
  { address: 'KA10 coil', description: 'Entry inductive sensor, NPN (有料检测)', type: 'input', deviceType: 'sensor-npn', category: 'Product Detection' },
  { address: 'U2 CN5', description: 'Measuring-wheel encoder 1000 ppr, line driver', type: 'input', deviceType: 'other', category: 'Servo/Axis' },
  { address: 'U1 RB-RC', description: 'U1 healthy (RB-RC)', type: 'input', deviceType: 'other', category: 'Conveyor' },
  { address: 'U1 RA-RC', description: 'U1 fault (RA-RC)', type: 'input', deviceType: 'other', category: 'Conveyor' },
  { address: 'U2 DO1', description: 'U2 ready (DO1)', type: 'input', deviceType: 'other', category: 'Servo/Axis' },
  { address: 'U2 DO3', description: 'U2 cut (DO3)', type: 'input', deviceType: 'other', category: 'Servo/Axis' },
  { address: 'U2 DO5', description: 'U2 alarm (DO5)', type: 'input', deviceType: 'other', category: 'Servo/Axis' },
  { address: 'H7CX OUT', description: 'Batch counter output: batch complete', type: 'input', deviceType: 'other', category: 'Station 1' },
  { address: 'HL1', description: 'Power on lamp', type: 'output', deviceType: 'pilot-light', category: 'Operator/HMI' },
  { address: 'KM1 63-64', description: 'Pump running lamp', type: 'output', deviceType: 'pilot-light', category: 'Operator/HMI' },
  { address: 'KA1 coil', description: 'Line running lamp', type: 'output', deviceType: 'pilot-light', category: 'Operator/HMI' },
  { address: 'KA6 21-24 / U1 RA-RC', description: 'Fault lamp', type: 'output', deviceType: 'pilot-light', category: 'Operator/HMI' },
  { address: 'H7CX OUT NO', description: 'Batch complete lamp', type: 'output', deviceType: 'pilot-light', category: 'Operator/HMI' },
  { address: 'KA7 / SB7', description: 'Shear down valve (剪切下) (watchdog 2 s)', type: 'output', deviceType: 'solenoid', category: 'Station 1' },
  { address: 'KA8 31-34', description: 'Shear up valve (剪切上)', type: 'output', deviceType: 'solenoid', category: 'Station 1' },
  { address: 'KM1 (was relay logic)', description: 'Pump contactor, AC220V coil', type: 'output', deviceType: 'contactor-coil', category: 'Conveyor' },
  { address: 'U1 MI1', description: 'U1 MI1 VFD forward from line run or jog forward', type: 'output', deviceType: 'vfd-input', category: 'Conveyor' },
  { address: 'U1 MI2', description: 'U1 MI2 VFD reverse from jog reverse', type: 'output', deviceType: 'vfd-input', category: 'Conveyor' },
  { address: 'U1 MI3', description: 'U1 MI3 VFD jog speed from either jog', type: 'output', deviceType: 'vfd-input', category: 'Conveyor' },
  { address: 'U2 DI1', description: 'U2 DI1 SON', type: 'output', deviceType: 'vfd-input', category: 'Servo/Axis' },
  { address: 'U2 DI7', description: 'U2 DI7 CAM engage', type: 'output', deviceType: 'vfd-input', category: 'Servo/Axis' },
  { address: 'MSR1 (Safety OK)', description: 'Safety OK (safety relay MSR1 output)', type: 'input', deviceType: 'safety-relay-output', category: 'Safety' },
];
