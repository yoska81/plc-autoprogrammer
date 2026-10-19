/// <reference types="node" />
/**
 * Scores the importer against the answer keys of the real fixture programs (fixtures/import/*: the
 * expected.json of each): I/O found with their tags and in/out, and every known issue found by the app.
 * Run with:  npx tsx src/plc/import/fixtures.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileText, importProgramFiles } from './index';
import { planUpgrade } from './upgrade';
import { importedCategory } from './convert';
import { programFindings } from './findings';
import { validateProgram } from '../core/validate';
import { getProfile } from '../core/profiles';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'import');
const file = (dir: string, n: string) => ({ name: n, text: fileText(n, new Uint8Array(readFileSync(join(root, dir, n)))) });
interface Expected { io: { address: string; tag: string; type: 'input' | 'output' }[]; knownIssues: { id: string }[] }
const expected = (dir: string) => JSON.parse(readFileSync(join(root, dir, 'expected.json'), 'utf8')) as Expected;

/** Every expected I/O point found, by tag name, with the right direction. */
function scoreIo(dir: string, io: { name: string; type: string }[]) {
  const exp = expected(dir).io;
  const got = new Map(io.map((p) => [p.name.toLowerCase(), p.type]));
  const missing = exp.filter((e) => got.get(e.tag.toLowerCase()) !== e.type).map((e) => `${e.tag} (${e.type})`);
  assert.deepEqual(missing, [], `${dir}: I/O not found`);
  console.log(`  ${dir}: I/O ${exp.length}/${exp.length}`);
}

// ── AB palletizer: AB-1 (missing seal-in), AB-2 (pusher on the infeed eye) ──
{
  const dir = 'ab-palletizer-01';
  const { program } = importProgramFiles([file(dir, 'Palletizer_PL01.L5X')]);
  scoreIo(dir, program.io);
  const plan = planUpgrade(program, 'click');
  const f = programFindings(plan.program);
  const ab1 = f.find((x) => x.kind === 'seal-in' && /^Machine_Running /.test(x.message));
  const ab2 = f.find((x) => x.kind === 'interlock' && /^Pusher_Extend_Sol waits for Infeed_Case_PE/.test(x.message));
  assert.ok(ab1, 'AB-1 found');
  assert.ok(ab2, 'AB-2 found');
  assert.match(ab2!.message, /Should it check Pallet_Present_PE\?/, 'only the pallet eye offered (comment match), not a routine-name-only match');
  assert.equal(f.length, 2, `no other findings: ${f.map((x) => x.message).join(' | ')}`);
  console.log(`  ${dir}: AB-1, AB-2 found`);
}

// ── Siemens mixer (PLCopen + tag table): S7-1 (NORM_X MAX 32767) ──
{
  const dir = 'siemens-mixer-01';
  const { program } = importProgramFiles([file(dir, 'MixTank_MT01.xml'), file(dir, 'PLC_Tags_MT01.csv')]);
  scoreIo(dir, program.io);
  const plan = planUpgrade(program, 'click');
  assert.equal(plan.plcId, 'siemens-s7');
  const s71 = validateProgram(plan.program, getProfile('siemens-s7'), new Set()).find((i) => /NORM_X MAX := 32767/.test(i.message));
  assert.ok(s71, 'S7-1 found');
  assert.deepEqual(programFindings(plan.program), [], 'no false findings on the mixer');
  console.log(`  ${dir}: S7-1 found`);
}

// ── Mitsubishi capper (GX Works3 CSV + device comments): MEL-1 (double coil on Y4) ──
{
  const dir = 'mitsubishi-capper-01';
  const { program } = importProgramFiles([file(dir, 'CAPPER_MAIN.csv'), file(dir, 'CAPPER_DeviceComment.csv')]);
  scoreIo(dir, program.io);
  assert.equal(program.report.notConverted.filter((n) => !n.kept).length, 0);
  const mel1 = program.report.notes.find((n) => /^Double coil: .*\(Y4\).*steps 138 and 169/.test(n));
  assert.ok(mel1, `MEL-1 found with both rung steps: ${program.report.notes.join(' | ')}`);
  assert.deepEqual(programFindings(planUpgrade(program, 'click').program), [], 'no false findings on the capper');
  console.log(`  ${dir}: MEL-1 found`);
}

// Every point of the 3 real fixtures lands in the right I/O list category (a stop blade is not an E-stop, a clamp
// is not a lamp, a photo-eye on a conveyor is product detection, a level switch is not analog).
{
  const CATEGORIES: Record<string, Record<string, string[]>> = {
    'ab-palletizer-01': {
      'Safety': ['E_Stop_OK', 'Guard_Door_Closed'],
      'Operator/HMI': ['Start_PB', 'Stop_PB', 'Reset_PB', 'Auto_Sel', 'Light_Green', 'Light_Amber', 'Light_Red', 'Horn'],
      'Product Detection': ['Infeed_Case_PE', 'Infeed_Count_PE', 'Elev_Up_LS', 'Elev_Down_LS', 'Pallet_Present_PE', 'Case_Stop_Up_PX'],
      'Pneumatic': ['Pusher_Retracted_PX', 'Pusher_Extended_PX', 'Air_Pressure_OK', 'Case_Stop_Sol', 'Pusher_Extend_Sol'],
      'Conveyor': ['Infeed_OL_OK', 'Infeed_Conv_Run', 'Layer_Conv_Run', 'Pallet_Conv_Run'],
      'Station 1': ['Elev_Up_Mtr', 'Elev_Down_Mtr'],
      'Analog/Process': ['Elev_Position'],
    },
    'siemens-mixer-01': {
      'Analog/Process': ['Level_Raw', 'Temp_Raw'],
      'Operator/HMI': ['Start_PB', 'Stop_PB', 'Reset_PB', 'Lamp_Running', 'Lamp_Fault', 'Lamp_Batch_Done'],
      'Safety': ['EStop_OK', 'Heater_OT_OK'],
      'Station 1': ['Agitator_Running', 'Agitator_OL_OK', 'LSHH_OK', 'Lid_Closed', 'Agitator_Run', 'Heater_On'],
      'Pneumatic': ['Outlet_Valve_Closed', 'Inlet_Valve_A', 'Inlet_Valve_B', 'Outlet_Valve'],
    },
    'mitsubishi-capper-01': {
      'Operator/HMI': ['Start_PB', 'Stop_PB', 'Reset_PB', 'Jog_Spindle_PB', 'Lamp_Green', 'Lamp_Red', 'Buzzer'],
      'Safety': ['EStop_OK', 'Guard_Closed'],
      'Product Detection': ['Bottle_At_Station_PE', 'Cap_In_Chuck_PE', 'Head_Up_LS', 'Head_Down_LS', 'Cap_Chute_Full_PE'],
      'Pneumatic': ['Clamp_Closed_LS', 'Air_OK', 'Bottle_Gate_Sol', 'Clamp_Close_Sol', 'Head_Down_Sol', 'Cap_Feed_Sol', 'Reject_Sol'],
      'Station 1': ['Torque_Reached', 'Spindle_Run'],
      'Conveyor': ['Conveyor_Run'],
    },
  };
  const FILES: Record<string, string[]> = {
    'ab-palletizer-01': ['Palletizer_PL01.L5X'],
    'siemens-mixer-01': ['MixTank_MT01.xml', 'PLC_Tags_MT01.csv'],
    'mitsubishi-capper-01': ['CAPPER_MAIN.csv', 'CAPPER_DeviceComment.csv'],
  };
  for (const [dir, byCategory] of Object.entries(CATEGORIES)) {
    const { program } = importProgramFiles(FILES[dir].map((n) => file(dir, n)));
    const want = new Map(Object.entries(byCategory).flatMap(([c, names]) => names.map((n) => [n, c] as const)));
    assert.equal(want.size, program.io.length, `${dir}: every point has an expected category`);
    for (const p of program.io) assert.equal(importedCategory(`${p.name} ${p.description}`, p.analog, p.name, p.type), want.get(p.name), `${dir}: ${p.name}`);
    console.log(`  ${dir}: categories ${program.io.length}/${program.io.length}`);
  }
}

// A tag that is only a command word is the operator's button, whatever its comment says; a stop gate is not.
for (const n of ['Start', 'Stop', 'Reset', 'Fault_Reset', 'Cycle_Start', 'CycleStart', 'STOP']) assert.equal(importedCategory(`${n} `, false, n, 'input'), 'Operator/HMI', n);
assert.equal(importedCategory('Stop_Gate_Sol Bottle stop gate solenoid', false, 'Stop_Gate_Sol', 'output'), 'Pneumatic');
// From another machine: a handshake, not a button; an output named Stop is not a button either.
assert.equal(importedCategory('Start Line start from upstream', false, 'Start', 'input'), 'External Machine');
assert.equal(importedCategory('Stop Interlock from the filler', false, 'Stop', 'input'), 'External Machine');
assert.notEqual(importedCategory('Stop Stop signal to the next machine', false, 'Stop', 'output'), 'Operator/HMI');

console.log('fixtures.test: all passed');
