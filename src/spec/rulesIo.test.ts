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

// ── Side manager's probe: counts, names, negation, missing equipment ──
const d = (r: ReturnType<typeof list>) => r.points.map((p) => p.description);
// Power figures are not counts; ungrouped alternatives keep their count; one group per qualifier.
assert.equal(count(list('A 1.5 kW servo drives the flying shear. E-stop.'), /enable$/), 1, '1.5 kW servo: one axis');
assert.equal(count(list('3 belts carry the boxes. E-stop.'), /^Conveyor \d motor contactor$/), 3, '"3 belts": three');
{
  const r = list('Infeed and outfeed conveyors. E-stop.');
  assert.ok(has(r, 'Infeed conveyor motor contactor', 'output') && has(r, 'Outfeed conveyor motor contactor', 'output'), d(r).join(' | '));
  const r2 = list('An infeed conveyor feeds the machine; an outfeed conveyor takes the parts away. E-stop.');
  assert.ok(has(r2, 'Infeed conveyor motor contactor', 'output') && has(r2, 'Outfeed conveyor motor contactor', 'output'), d(r2).join(' | '));
}
// Actuator counts.
assert.equal(count(list('Two cylinders clamp the part. E-stop.'), /^Cylinder [12] extend solenoid$/), 2);
assert.equal(count(list('4 cylinders lift the tray. E-stop.'), /^Cylinder [1-4] extend solenoid$/), 4);
// Names and numbering per kind.
{
  const r = list('Two photo-eyes and two prox sensors watch the part. There is a photo-eye at the reject chute. E-stop.');
  assert.ok(has(r, 'Photo-eye 1', 'input') && has(r, 'Photo-eye 2', 'input'), d(r).join(' | '));
  assert.ok(has(r, 'Proximity sensor 1', 'input') && has(r, 'Proximity sensor 2', 'input'), 'prox numbered from 1');
  assert.ok(!d(r).some((x) => /photo-ey\b|^Is /i.test(x)), d(r).join(' | '));
}
// Every transmitter of a sentence.
{
  const r = list('A level transmitter and a pressure transmitter, 4-20 mA. E-stop.');
  assert.ok(has(r, 'Level transmitter', 'input') && has(r, 'Pressure transmitter', 'input'), d(r).join(' | '));
}
// Negation: nothing invented.
{
  const r = list('Conveyor with a start button. No E-stop. No stack light, no horn. No light curtain and no guard door. The heater is not used.');
  assert.ok(!r.points.some((p) => /Safety relay|Stack light|horn|Light curtain|Guard door|Heater/i.test(p.description)), d(r).join(' | '));
  assert.ok(r.questions.some((q) => /No E-stop on this machine: is the cell's safety status/.test(q)), 'a said "No E-stop" asks for the cell safety');
  assert.ok(!list('Bench press with no touch screen.', false).questions.every((q) => !/start \/ stop buttons/.test(q)), '"no touch screen" is no panel');
}
// Equipment the first version missed.
{
  const r = list('The 5.5 kW main roll motor runs on a VFD with speed set from the screen. E-stop.');
  assert.ok(has(r, 'Main roll VFD run', 'output') && has(r, 'Main roll VFD fault', 'input') && r.points.some((p) => p.description === 'Main roll speed reference'), d(r).join(' | '));
  assert.ok(has(list('The main drive is on a VFD. E-stop.'), 'Main drive VFD run', 'output'));
  assert.ok(has(list('A reversing conveyor. E-stop.'), 'Conveyor forward contactor', 'output') && has(list('A reversing conveyor. E-stop.'), 'Conveyor reverse contactor', 'output'));
  assert.ok(has(list('A two-speed fan. E-stop.'), 'Fan high speed contactor', 'output'));
  assert.equal(count(list('A star-delta pump. E-stop.'), /^Pump (main|star|delta) contactor$/), 3);
  const punch = list('A hydraulic punch with up and down limit switches. A dump valve. E-stop.');
  assert.ok(has(punch, 'Punch down solenoid', 'output') && has(punch, 'Punch up limit switch', 'input') && has(punch, 'Dump valve solenoid', 'output'), d(punch).join(' | '));
  assert.ok(has(list('Parts are picked by vacuum. E-stop.'), 'Vacuum on', 'output'));
  const robot = list('A robot loads the press. E-stop.');
  assert.ok(has(robot, 'Robot cycle done', 'input') && has(robot, 'Robot fault', 'input'));
  const line = list('Parts come from the upstream filler and go to the downstream capper. E-stop.');
  assert.ok(has(line, 'Ready to receive from upstream filler', 'output') && has(line, 'Part ready for downstream capper', 'output'), d(line).join(' | '));
  const hoist = list('An electric hoist lifts the basket. E-stop.');
  assert.ok(has(hoist, 'Hoist up contactor', 'output') && has(hoist, 'Hoist down contactor', 'output'), d(hoist).join(' | '));
  assert.ok(!hoist.points.some((p) => /limit|lift/i.test(p.description)), `no limit switch invented, "lifts" is a verb: ${d(hoist).join(' | ')}`);
}
// Should-fixes.
{
  const lvl = list('A tank level transmitter 0-5 m and a pressure transmitter 0-250 bar. E-stop.');
  const t = lvl.points.find((p) => p.description === 'Tank level transmitter');
  const pr = lvl.points.find((p) => p.description === 'Pressure transmitter');
  assert.deepEqual([t?.analog?.max, t?.analog?.units, pr?.analog?.max, pr?.analog?.units], [5, 'm', 250, 'bar'], 'stated ranges used');
  assert.ok(!lvl.questions.some((q) => /Ranges of/.test(q)), 'stated ranges are not asked');
  assert.ok(has(list('A ready signal from the case packer. E-stop.'), 'Case packer ready', 'input'), 'full machine name');
  assert.ok(list('Two conveyors. Each conveyor runs on a VFD with speed from the screen. E-stop.').points.some((p) => p.description === 'Conveyor 1 speed reference'), 'speed reference in an "each" sentence');
  const cyc = list('A cycle start button on the door, no touch screen. E-stop.', true);
  assert.ok(has(cyc, 'Cycle start button', 'input') && !cyc.questions.some((q) => /start \/ stop buttons/.test(q)));
  assert.ok(!list('A cylinder with 2 end sensors. E-stop.').questions.some((q) => /both end positions/.test(q)), '"2 end sensors" in digits');
  const air = list('An air pressure switch. E-stop.').points.find((p) => /pressure OK/.test(p.description));
  assert.equal(air?.category, 'Pneumatic');
  assert.equal(list('A limit switch at the end of travel. E-stop.').points.find((p) => /limit switch/i.test(p.description))?.category, 'Station 1');
  const de = list('Die Maschine hat einen Not-Halt und zwei Förderbänder mit Lichtschranken.');
  assert.deepEqual(de.points, []);
  assert.ok(de.questions.some((q) => /English descriptions only/.test(q)) && !de.questions.some((q) => /No E-stop/.test(q)));
  assert.ok(list('Two-hand start. E-stop.').questions.some((q) => /two-hand safety module/.test(q)));
  assert.equal(list('E-stop.').reasoning, null);
}

// The roll former (cn-rollformer-01): main drive on a VFD, servo flying shear, encoder, hydraulic punch, pump, safety relay.
{
  const r = list('Roll forming machine for roof panels. The 5.5 kW main roll motor runs on a VFD with speed set from the touch screen. A 1.5 kW servo drives the flying shear, following a 1000 ppr measuring-wheel encoder. The hydraulic punch has up and down limit switches. The 2.2 kW hydraulic pump motor is started across the line. A run-out end photo-eye and a material present proximity sensor. Two E-stops and the shear guard go to a safety relay. Start, stop and reset buttons on the panel.');
  for (const [x, t] of [['Main roll VFD run', 'output'], ['Main roll VFD fault', 'input'], ['Main roll speed reference', 'output'], ['Flying shear servo enable', 'output'], ['Flying shear servo in position', 'input'], ['Punch down solenoid', 'output'], ['Punch up limit switch', 'input'], ['Punch down limit switch', 'input'], ['Hydraulic pump motor contactor', 'output'], ['Hydraulic pump overload tripped', 'input'], ['Run-out end photo-eye', 'input'], ['Material present proximity sensor', 'input'], ['Safety relay OK (E-stop, guard door)', 'input'], ['Start button', 'input'], ['Stop button', 'input'], ['Fault reset button', 'input']] as const) {
    assert.ok(has(r, x, t), `${x} (${t}) — got: ${d(r).join(' | ')}`);
  }
  assert.equal(count(r, /enable$/), 1, 'one servo axis');
  assert.equal(count(r, /VFD run$/), 1, 'one VFD');
  assert.ok(!r.points.some((p) => /encoder/i.test(p.description)) && r.questions.some((q) => /encoder/i.test(q)), 'the servo follows the encoder: it is the drive\'s master, asked, not read by the PLC');
}

console.log('rules I/O tests passed');
