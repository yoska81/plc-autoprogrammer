// npx tsx src/spec/rulesIo.test.ts — the rules' I/O list from a machine description (no AI, no key).
import assert from 'node:assert/strict';
import { ioFromDescription } from './rulesIo';

const list = (text: string, noPanel = false) => ioFromDescription(text, { noPanel });
const has = (r: ReturnType<typeof list>, d: string, type: 'input' | 'output') => r.points.some((p) => p.description === d && p.type === type);
const count = (r: ReturnType<typeof list>, re: RegExp) => r.points.filter((p) => re.test(p.description)).length;

// Three conveyors across the line, a photo-eye at the end of each, buttons, stack light, a handshake.
{
  const r = list('Three belt conveyors in a row carry boxes to a palletizer. Each belt has a 2 HP motor started across the line, with a photo-eye at its end. Belts start from the last one backwards. Start, stop and E-stop on the panel, a stack light, and a ready signal from the palletizer.');
  for (const n of [1, 2, 3]) {
    assert.ok(has(r, `Conveyor ${n} motor contactor`, 'output'), `conveyor ${n} contactor`);
    assert.ok(has(r, `Conveyor ${n} overload tripped`, 'input'), `conveyor ${n} overload`);
    assert.ok(has(r, `Conveyor ${n} end photo-eye`, 'input'), `conveyor ${n} photo-eye`);
  }
  for (const d of ['Start button', 'Stop button', 'Safety relay OK (E-stop)', 'Palletizer ready']) assert.ok(has(r, d, 'input'), d);
  assert.equal(count(r, /^Stack light (green|amber|red)$/), 3);
  assert.equal(r.points.length, 16);
}

// Two pumps on VFDs holding a setpoint: run, fault, speed reference each; H-O-A per pump; four 4-20 mA transmitters.
{
  const r = list('Water pump skid with two 10 HP pumps on VFDs (duty and standby) holding a pressure setpoint. Discharge pressure, flow, tank level and water temperature transmitters, all 4-20 mA. Low-level float switch stops the pumps. Hand-off-auto selector per pump. E-stop. Touch screen with trends.');
  for (const n of [1, 2]) {
    assert.ok(has(r, `Pump ${n} VFD run`, 'output') && has(r, `Pump ${n} VFD fault`, 'input'));
    assert.ok(r.points.some((p) => p.description === `Pump ${n} speed reference` && p.signal === 'analog'));
    assert.ok(has(r, `Pump ${n} selector in Hand`, 'input') && has(r, `Pump ${n} selector in Auto`, 'input'));
  }
  const tx = r.points.filter((p) => p.signal === 'analog' && p.type === 'input');
  assert.deepEqual(tx.map((p) => p.description), ['Discharge pressure transmitter', 'Flow transmitter', 'Tank level transmitter', 'Water temperature transmitter']);
  assert.ok(tx.every((p) => p.analog?.range === '4-20mA'));
  assert.ok(has(r, 'Low-level float switch', 'input'));
  assert.ok(r.questions.some((q) => /Ranges of .* are assumed/.test(q)), 'assumed ranges are asked');
  assert.ok(!r.points.some((p) => /^(Start|Stop) button$/.test(p.description)), 'no buttons named: none made (the touch screen has them)');
}

// Pneumatic slides with end sensors and a vacuum gripper.
{
  const r = list('Pneumatic pick-and-place: an X slide and a Z slide with a vacuum gripper move parts from an infeed nest to an outfeed tray. Each slide has two end sensors, the vacuum has a vacuum switch. Guard with an interlocked door. Start/stop on the panel, E-stop.');
  for (const a of ['X slide', 'Z slide']) {
    assert.ok(has(r, `${a} extend solenoid`, 'output') && has(r, `${a} extended`, 'input') && has(r, `${a} retracted`, 'input'), a);
  }
  assert.ok(!r.points.some((p) => /^Slide /.test(p.description)), '"Each slide" adds no third slide');
  assert.ok(has(r, 'Vacuum on', 'output') && has(r, 'Vacuum OK', 'input'));
  assert.ok(has(r, 'Safety relay OK (E-stop, guard door)', 'input') && has(r, 'Guard door closed', 'input'));
  assert.ok(has(r, 'Start button', 'input') && has(r, 'Stop button', 'input'));
}

// Sealing head: two-hand start, light curtain, heater with a thermocouple, unwinder on a VFD. "E-stop on the panel" is not a Stop button.
{
  const r = list('Pouch sealing head. The operator puts a pouch in, presses two-hand start, the heated sealing head comes down, holds for the dwell time, goes up. The seal bar has a heater with a thermocouple and an over-temperature limit. Film unwinder motor 0.5 HP on a VFD. Light curtain at the front and an interlocked guard door at the back. E-stop on the panel. 7 inch touch screen to set temperature and dwell.');
  assert.ok(has(r, 'Two-hand start button left', 'input') && has(r, 'Two-hand start button right', 'input'));
  assert.ok(!has(r, 'Stop button', 'input'), 'E-stop is not a stop button');
  assert.ok(has(r, 'Sealing head down solenoid', 'output') && has(r, 'Sealing head up', 'input') && has(r, 'Sealing head down', 'input'));
  assert.ok(has(r, 'Film unwinder VFD run', 'output') && has(r, 'Film unwinder VFD fault', 'input'));
  assert.equal(count(r, /heater on$/i), 1, 'one heater output');
  assert.ok(r.points.some((p) => p.analog?.range === 'thermocouple'), 'thermocouple input');
  assert.ok(has(r, 'Heater over-temperature limit tripped', 'input'));
  assert.ok(has(r, 'Light curtain clear', 'input') && has(r, 'Safety relay OK (E-stop, guard door, light curtain)', 'input'));
}

// A press with no touch screen: buttons, selector, lamps, cylinder up/down, air pressure switch.
{
  const r = list('Small pneumatic bench press with no touch screen: the operator uses a start button, a stop button, a reset button, a run/setup selector switch and a green running lamp and red fault lamp. Two-hand start, E-stop, guard door. Press cylinder with up and down sensors, a pressure switch for the air supply.', true);
  for (const d of ['Start button', 'Stop button', 'Fault reset button', 'Setup mode selected', 'Press cylinder up', 'Press cylinder down', 'Air pressure OK']) assert.ok(has(r, d, 'input'), d);
  for (const d of ['Running lamp (green)', 'Fault lamp (red)', 'Press cylinder down solenoid', 'Press cylinder up solenoid']) assert.ok(has(r, d, 'output'), d);
}

// Servos, an encoder, a robot.
{
  const r = list('Two servo axes position a gantry; an encoder on the infeed belt measures length. A robot loads the parts. E-stop.');
  assert.equal(count(r, /^Servo axis [12] enable$/), 2);
  assert.ok(has(r, 'Servo axis 1 in position', 'input') && has(r, 'Encoder channel A', 'input'));
  assert.ok(has(r, 'Robot ready', 'input') && has(r, 'Robot start cycle', 'output'));
}

// Nothing to read: said, never a made-up list.
assert.deepEqual(list('').points, []);
assert.ok(list('A machine.').questions.some((q) => /No E-stop is named/.test(q)), 'missing E-stop asked');
// Same description, same list (a later AI run keeps the descriptions).
assert.deepEqual(list('Three belt conveyors. E-stop.'), list('Three belt conveyors. E-stop.'));

console.log('rules I/O tests passed');
