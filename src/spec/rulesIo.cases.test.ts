// npx tsx src/spec/rulesIo.cases.test.ts — the side manager's probe cases for the rules' I/O reader: for each
// description, how many inputs / outputs / analog points (no extra points), and the points that must be there.
import assert from 'node:assert/strict';
import { ioFromDescription } from './rulesIo';

interface Case {
  name: string; text: string; noPanel?: boolean;
  /** Inputs, outputs, analog (of them). */
  counts: [number, number, number];
  has?: [RegExp, 'input' | 'output'][];
  not?: RegExp[];
  asks?: RegExp[];
  notAsks?: RegExp[];
}

const CASES: Case[] = [
  {
    name: '1 roll former (cn-rollformer-01)',
    text: 'Roof-panel roll former with a servo flying shear. The forming rolls are driven by a 5.5 kW main roll motor on a VFD with a braking resistor; line speed is set on the touch screen. A 2.2 kW hydraulic pump motor is started direct-on-line. The flying shear carriage is a 1.5 kW servo; a 1000 ppr encoder measuring wheel on the strip is the master for the servo drive\'s flying-shear function, and the drive gives a cut signal. The hydraulic shear has a down valve and an up valve, with an up limit switch and a down limit switch. A photo sensor at the end of the run-out table and an inductive sensor for material present. Two E-stops and a shear guard switch go to a Pilz PNOZ safety relay. Start, stop, reset, jog forward and jog reverse push buttons on the operator station. The operator enters cut length and batch count on the touch screen.',
    counts: [15, 10, 1],
    has: [[/^Safety relay OK/, 'input'], [/^Jog forward button$/, 'input'], [/^Jog reverse button$/, 'input'], [/VFD run$/, 'output'], [/VFD reverse$/, 'output'], [/jog speed/i, 'output'], [/VFD fault$/, 'input'], [/speed reference$/, 'output'],
      [/^Hydraulic pump motor contactor$/, 'output'], [/servo enable$/, 'output'], [/cam engage$/, 'output'], [/alarm reset$/, 'output'], [/servo ready$/, 'input'], [/servo fault$/, 'input'], [/cut command/, 'input'],
      [/^Shear down solenoid$/, 'output'], [/^Shear up solenoid$/, 'output'], [/^Shear up limit switch$/, 'input'], [/^Shear down limit switch$/, 'input'], [/photo/i, 'input'], [/inductive|proximity/i, 'input']],
    not: [/encoder/i, /servo axis [2-9]/i],
    asks: [/encoder/i, /speed reference/i],
  },
  {
    name: '1b roll former, first text',
    text: 'Roll-former line. The main drive is a 5.5 kW motor on a VFD, speed set from the touch screen. A 1.5 kW servo flying shear cuts to length. An encoder measuring wheel measures the strip length. E-stop wired to a safety relay. Start, stop and reset push buttons on the operator station. A hydraulic punch punches holes before the shear. The operator enters length and count on the HMI.',
    counts: [10, 7, 1],
    has: [[/^Main drive VFD run$/, 'output'], [/^Main drive VFD fault$/, 'input'], [/^Main drive speed reference$/, 'output'], [/enable$/, 'output'], [/start move$/, 'output'], [/home$/, 'output'], [/in position$/, 'input'], [/^Encoder channel A$/, 'input'], [/^Encoder channel B$/, 'input'], [/^Punch down solenoid$/, 'output'], [/^Punch up solenoid$/, 'output'], [/^Punch up$/, 'input'], [/^Fault reset button$/, 'input']],
    not: [/^Shear/],
    asks: [/encoder/i, /punch/i],
  },
  {
    name: '2 conveyor with 3 belts',
    text: 'Conveyor system with 3 belts. There is a photo-eye on each belt. The motors are 2-speed motors and reversing (forward and reverse). E-stop and start/stop buttons on the panel.',
    counts: [9, 12, 0],
    has: [[/^Conveyor 1 forward contactor$/, 'output'], [/^Conveyor 3 reverse contactor$/, 'output'], [/^Conveyor 2 low speed contactor$/, 'output'], [/^Conveyor 2 high speed contactor$/, 'output'], [/^Conveyor 3 photo-eye$/, 'input'], [/^Conveyor 1 overload tripped$/, 'input']],
    not: [/^Is /, /2-speed motor/i],
    asks: [/two-speed|2-speed|Dahlander/i],
  },
  {
    name: '3 sealing head',
    text: 'Sealing head with a heater controlled by a thermocouple. A pneumatic cylinder with 2 end sensors pushes the sealing head down. A vacuum holds the bag. Stack light and a horn. E-stop. HMI.',
    counts: [4, 7, 1],
    has: [[/^Vacuum on$/, 'output'], [/thermocouple/, 'input'], [/^Heater on$/, 'output'], [/^Alarm horn$/, 'output']],
    notAsks: [/end positions/],
  },
  {
    name: '4 pump station',
    text: 'Pump station with 3 pumps, each with a Hand-Off-Auto selector. A level transmitter 4-20 mA 0-5 m on the wet well and a pressure transmitter on the discharge header. E-stop. Touch screen.',
    counts: [12, 3, 2],
    has: [[/^Pump 3 motor contactor$/, 'output'], [/^Pump 2 selector in Hand$/, 'input'], [/^Pump 1 selector in Auto$/, 'input'], [/level transmitter$/i, 'input'], [/pressure transmitter$/i, 'input']],
    asks: [/Ranges of pressure/],
    notAsks: [/Ranges of .*level/],
  },
  {
    name: '5 palletizer',
    text: 'Palletizer cell with a robot. Robot handshake: ready, cycle start, cycle complete, fault. Interlock with the upstream case packer and the downstream stretch wrapper. Guard doors with interlocks, E-stop, light curtain at the pallet exit.',
    counts: [8, 3, 0],
    has: [[/^Robot ready$/, 'input'], [/^Robot cycle complete$/, 'input'], [/^Robot fault$/, 'input'], [/^Robot cycle start$/, 'output'], [/^Upstream case packer ready$/, 'input'], [/upstream case packer$/, 'output'], [/^Downstream stretch wrapper ready to receive$/, 'input'], [/downstream stretch wrapper$/, 'output'], [/^Light curtain clear$/, 'input'], [/^Guard doors? closed$/, 'input']],
    asks: [/No start \/ stop buttons/],
  },
  { name: '6 vague', text: 'It is a machine that makes parts. Should be fast and reliable.', counts: [0, 0, 0], asks: [/No E-stop is named/, /start \/ stop/] },
  { name: '7 German', text: 'Förderband mit Motor, Not-Halt, Lichtschranke am Ende, Start- und Stopptaster.', counts: [0, 0, 0], asks: [/English/], notAsks: [/No E-stop/] },
  { name: '8 Spanish', text: 'Transportador con dos motores, paro de emergencia, sensor fotoeléctrico y botón de arranque.', counts: [0, 0, 0], asks: [/English/], notAsks: [/No E-stop/] },
  {
    name: '9 negations',
    text: 'Simple conveyor with one motor. No E-stop on this machine (it is inside a fenced cell). Pick and place without vacuum; it uses a mechanical gripper. No stack light. Start button.',
    counts: [4, 2, 0],
    has: [[/^Start button$/, 'input'], [/^Conveyor motor contactor$/, 'output'], [/^Gripper close solenoid$/, 'output'], [/^Gripper closed$/, 'input'], [/^Gripper open$/, 'input']],
    not: [/Safety relay/, /Stack light/, /Vacuum/],
    asks: [/cell's safety status/, /stop button/i],
  },
  {
    name: '10 numbers in words',
    text: 'Assembly station with two cylinders, three photo-eyes and 2 prox sensors. E-stop. Start button and stop button.',
    counts: [12, 2, 0],
    has: [[/^Cylinder 2 extend solenoid$/, 'output'], [/^Photo-eye 3$/, 'input'], [/^Proximity sensor 1$/, 'input'], [/^Proximity sensor 2$/, 'input']],
    not: [/Photo-ey\b/, /Proximity sensor [3-9]/],
  },
  { name: '11 numbers in digits', text: 'Station with 4 cylinders and 5 photo-eyes. E-stop on the panel.', counts: [14, 4, 0], has: [[/^Cylinder 4 extend solenoid$/, 'output'], [/^Photo-eye 5$/, 'input']], not: [/Stop button/], asks: [/start \/ stop/] },
  {
    name: '12 mentioned twice',
    text: 'Mixer with a 3 kW motor. The mixer motor is started by a contactor. The mixer motor has an overload. A photo-eye detects the bucket. The photo-eye is cleaned weekly. E-stop. Another E-stop at the back. Start button.',
    counts: [4, 1, 0],
    has: [[/^Mixer motor contactor$/, 'output'], [/^Mixer overload tripped$/, 'input'], [/photo-eye$/i, 'input']],
    asks: [/stop button/i],
  },
  {
    name: '13 long',
    text: 'Packaging line. Infeed conveyor driven by a 1 HP motor across the line. Two photo-eyes on the infeed detect gaps. A pusher cylinder transfers products to the sealing station. The sealing bar has a heater with a thermocouple. The sealing head comes down and goes up. A film unwinder motor on a VFD. A vacuum generator holds the film; a vacuum switch confirms. Discharge conveyor on a VFD with speed set from the HMI. A label printer gives a ready signal from the printer. Downstream case packer interlock. E-stop, guard doors, light curtain. Start, stop and reset buttons on the panel. Green running lamp, red fault lamp. Stack light red amber green, buzzer. Air pressure switch. Two servo axes for the flying knife. An encoder on the discharge conveyor. Temperature, pressure transmitters 4-20 mA. A clamp holds the pack. A lift raises it. A stopper gate stops products.',
    counts: [33, 25, 4],
    has: [[/^Infeed conveyor motor contactor$/, 'output'], [/^Discharge conveyor VFD run$/, 'output'], [/^Discharge conveyor speed reference$/, 'output'], [/^Film unwinder VFD run$/, 'output'], [/^Downstream case packer ready to receive$/, 'input'], [/^Printer ready$/, 'input'], [/^Air pressure OK$/, 'input'], [/^Servo axis 2 fault$/, 'input'], [/^Clamp extend solenoid$/, 'output'], [/^Lift extend solenoid$/, 'output'], [/^Stopper gate extend solenoid$/, 'output'], [/^Pusher extend solenoid$/, 'output'], [/^Pusher extended$/, 'input'], [/^Temperature transmitter$/, 'input'], [/^Pressure transmitter$/, 'input']],
    not: [/Film unwinder speed reference/],
  },
  {
    name: '14 tank',
    text: 'Tank with an agitator. Level transmitter 0-10 V. High level float switch and low level float switch. Pump on a VFD holding a level setpoint. E-stop.',
    counts: [6, 3, 2],
    has: [[/^Agitator motor contactor$/, 'output'], [/^Pump VFD run$/, 'output'], [/^Pump speed reference$/, 'output'], [/^High level float switch$/, 'input'], [/^Low level float switch$/, 'input'], [/^Level transmitter$/, 'input']],
    asks: [/Ranges of level/],
  },
  {
    name: '15 hoist (no panel)', noPanel: true,
    text: 'Hoist with up and down limit switches, pendant with up and down buttons, E-stop on the pendant, no touch screen.',
    counts: [6, 2, 0],
    has: [[/^Hoist up button$/, 'input'], [/^Hoist down button$/, 'input'], [/^Hoist up limit switch$/, 'input'], [/^Hoist down limit switch$/, 'input'], [/^Hoist up contactor$/, 'output'], [/^Hoist down contactor$/, 'output'], [/^Hoist overload tripped$/, 'input']],
    notAsks: [/start \/ stop/],
  },
  {
    name: '16 hydraulic press',
    text: 'Hydraulic press with a hydraulic pump motor 7.5 kW star-delta, a pressure transducer 0-250 bar 4-20 mA, two-hand start, light curtain, E-stop.',
    counts: [5, 3, 1],
    has: [[/^Two-hand control OK/, 'input'], [/main contactor$/, 'output'], [/star contactor$/, 'output'], [/delta contactor$/, 'output'], [/overload tripped$/, 'input'], [/^Pressure transducer$|^Pressure transmitter$/, 'input']],
    not: [/Two-hand start button/],
    asks: [/two-hand/i, /valves|press/i],
  },
  { name: '17 fans (no panel)', noPanel: true, text: 'Two fans and a blower. E-stop. No touch screen.', counts: [4, 3, 0], has: [[/^Fan 2 motor contactor$/, 'output'], [/^Blower motor contactor$/, 'output']], asks: [/start \/ stop/] },
  { name: 'P1', text: 'Conveyor with a 1.5 kW motor. E-stop. Start button. No touch screen.', counts: [3, 1, 0], asks: [/stop button/i] },
  { name: 'P2', text: 'A 1.5 kW pump. E-stop.', counts: [2, 1, 0], asks: [/start \/ stop/] },
  { name: 'P3', text: 'Feed roll driven by a servo motor. E-stop.', counts: [3, 3, 0], has: [[/^Feed roll servo enable$/, 'output']] },
  { name: 'P4', text: 'Two pumps. Each pump has a 2.2 kW motor on a VFD with speed from the HMI. E-stop.', counts: [3, 4, 2], has: [[/^Pump 1 speed reference$/, 'output'], [/^Pump 2 speed reference$/, 'output']] },
  { name: 'P5', text: 'Machine with no light curtain and no guard door, E-stop only. Start button.', counts: [2, 0, 0], not: [/Light curtain/, /Guard door/], asks: [/stop button/i] },
  { name: 'P6', text: 'Conveyor with a reversing motor across the line. E-stop. Start button.', counts: [3, 2, 0], has: [[/forward contactor$/, 'output'], [/reverse contactor$/, 'output']] },
  { name: 'P7', text: 'Infeed conveyor and outfeed conveyor, each across the line. E-stop. Start button.', counts: [4, 2, 0], has: [[/^Infeed conveyor motor contactor$/, 'output'], [/^Outfeed conveyor motor contactor$/, 'output']] },
  { name: 'P8', text: 'The heater is not used. E-stop.', counts: [1, 0, 0], not: [/Heater/] },
  {
    name: 'P9', text: 'Pressure transmitter 0-10 bar 4-20 mA and a flow transmitter 0-20 mA. E-stop.', counts: [3, 0, 2],
    asks: [/Ranges of flow/], notAsks: [/Ranges of .*pressure/],
  },
  { name: 'P10', text: 'Robot cell. E-stop. The robot is fenced. Robot ready, robot fault, robot in home position; PLC sends start and abort.', counts: [4, 2, 0], has: [[/^Robot ready$/, 'input'], [/^Robot fault$/, 'input'], [/home/i, 'input'], [/start/i, 'output'], [/abort/i, 'output']] },
  { name: 'P11', text: 'The 5.5 kW conveyor moves boxes. E-stop. Start button.', counts: [3, 1, 0], asks: [/stop button/i] },
  { name: 'P12', noPanel: true, text: 'Hoist with up and down buttons. No touch screen. E-stop.', counts: [4, 2, 0], has: [[/^Hoist up button$/, 'input'], [/^Hoist down contactor$/, 'output']], not: [/limit/] },
  { name: 'P13', text: 'Station with a 0.75 kW blower. E-stop.', counts: [2, 1, 0] },
];

let failed = 0;
for (const k of CASES) {
  const r = ioFromDescription(k.text, { noPanel: k.noPanel });
  const ins = r.points.filter((p) => p.type === 'input').length, outs = r.points.length - ins, an = r.points.filter((p) => p.signal === 'analog').length;
  const problems: string[] = [];
  if (ins !== k.counts[0] || outs !== k.counts[1] || an !== k.counts[2]) problems.push(`counts ${ins}/${outs}/${an}, want ${k.counts.join('/')}`);
  for (const [re, t] of k.has ?? []) if (!r.points.some((p) => re.test(p.description) && p.type === t)) problems.push(`missing ${t} ${re}`);
  for (const re of k.not ?? []) if (r.points.some((p) => re.test(p.description))) problems.push(`has ${re}`);
  for (const re of k.asks ?? []) if (!r.questions.some((q) => re.test(q))) problems.push(`does not ask ${re}`);
  for (const re of k.notAsks ?? []) if (r.questions.some((q) => re.test(q))) problems.push(`asks ${re}`);
  if (problems.length) {
    failed++;
    console.log(`✗ ${k.name}: ${problems.join('; ')}\n    got: ${r.points.map((p) => `${p.type === 'input' ? 'I' : 'O'}${p.signal === 'analog' ? 'A' : ''} ${p.description}`).join(' | ')}\n    asks: ${r.questions.join(' | ')}`);
  }
}
assert.equal(failed, 0, `${failed} of ${CASES.length} cases`);
console.log(`rules I/O cases passed (${CASES.length})`);
