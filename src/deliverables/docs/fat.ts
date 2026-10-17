import { byRegion } from '../../standards/regions';
import type { ProjectSnapshot } from '../collect';
import { buildModel, cableSchedule, supplyText, wireNumbers, terminalPlan } from '../../electrical/derive';
import { alarmRows, programInfo, type ProgramInfo } from './program';
import { safetyFunctions, type SafetyFunction } from './safety';
import { sccrTable } from './electrical';
import type { DocMeta } from './meta';
import { makeTable, specLines, pad, type DocRow, type DocTable } from './table';

/** Factory acceptance test procedure and site acceptance / commissioning checklist. */

export interface TestRow { id: string; section: string; description: string; procedure: string; expected: string; /** Recorded result (e.g. from the I/O check-out). */ result?: string }

export function fatProcedure(p: ProjectSnapshot, meta: DocMeta, info: ProgramInfo = programInfo(p), sf: SafetyFunction[] = safetyFunctions(p)): TestRow[] {
  const rows: TestRow[] = [];
  let n = 0;
  const add = (section: string, description: string, procedure: string, expected: string) => rows.push({ id: `FAT-${pad(++n)}`, section, description, procedure, expected });
  const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;

  // 1. Documentation and visual inspection
  const S1 = '1. Documentation and visual inspection';
  add(S1, 'Drawings and revision', `Confirm the panel is built to drawing set ${meta.drawings ? `${meta.drawings.first} … ${meta.drawings.last}` : '(not generated)'} at the revision issued for the FAT.`, 'Drawing numbers and revisions match the issued set; red-line any deviation.');
  if (p.drawingCtx) {
    add(S1, 'Bill of materials', 'Check every installed device part number against the BOM (Appendix A).', 'All part numbers match; no substitutions without an approved change.');
    add(S1, 'Device tags and labels', 'Check device tags, wire markers (both ends) and terminal markers against the drawings.', 'Every device, wire and terminal is labelled as drawn.');
    add(S1, 'Nameplate and warning labels', `Check the panel nameplate: ${m ? supplyText(m.supply) : 'supply'}, full-load current, SCCR, ${byRegion(p.info.region, 'UL 508A mark', 'CSA mark', 'IEC 61439 rating plate and CE / conformity marking')}; shock / arc-flash warning labels.`, 'Nameplate data complete; SCCR marked equals the value in the SCCR table; labels fitted.');
    add(S1, 'Workmanship', 'Inspect wire routing, bend radius, duct fill, ferrules, cable glands and enclosure type rating integrity (gaskets, unused holes plugged).', 'Neat, secure workmanship; enclosure type rating not compromised.');
  }
  // 2. Pre-power
  const S2 = '2. Pre-power checks (panel de-energized)';
  if (p.drawingCtx) {
    const nw = wireNumbers(p.drawingCtx).length, nt = terminalPlan(p.drawingCtx).reduce((s, t) => s + t.terminals.length, 0);
    add(S2, 'Point-to-point wiring check', `Ring out every wire against the wire list (${nw} wire segments) and the terminal plan (${nt} terminals).`, 'All connections as listed; no missing or extra wires.');
    add(S2, 'Terminal tightness', 'Check torque of power terminals (disconnect, breakers, contactor, overload) to the manufacturer values; tug-test control terminals.', 'All terminations tight; torque marks applied.');
  }
  add(S2, 'Protective earth continuity', 'Measure resistance from the PE bar to the door, back panel, every PE terminal and every device ground point.', `Continuity on every point, < 0.1 ohm (NFPA 79 18.2).`);
  add(S2, 'Insulation resistance', 'Disconnect / isolate the PLC, HMI, power supply and electronic devices. Test the power circuits at 500 VDC between conductors and PE.', '>= 1 Mohm (NFPA 79 18.3).');
  if (m) for (const mm of m.motors) if (mm.overload) add(S2, `${mm.motor.tag} overload setting`, `Set ${mm.overload.tag} dial to the motor FLA.`, `${mm.overload.tag} set to ${mm.fla} A (or the nameplate FLA if different); reset mode as specified.`);
  // 3. Power-up
  const S3 = '3. Power-up and communication';
  if (m) {
    add(S3, 'Incoming supply', `Connect the test supply; measure voltage at the line side of ${m.disconnect?.tag ?? 'the disconnect'} with the handle OFF.`, `${supplyText(m.supply)} within ±10% on all phases; phase rotation recorded.`);
    for (const b of m.psBranches) add(S3, `${b.ps.tag} 24 VDC supply`, `Close ${b.protection?.tag ?? 'its protection'}; measure ${b.ps.tag} output at TB1 24+ / 0V.`, '24 VDC ±5%; 0V bonded to PE as drawn.');
    for (const b of m.auxBranches) add(S3, `${b.protection.tag} circuit`, `Close ${b.protection.tag}; check the load (${b.protection.comp.function}).`, 'Correct voltage at the load.');
  }
  add(S3, 'PLC program', `Download the PLC program (${p.profile.name} ${p.cpu.id}); switch to RUN.`, 'PLC in RUN, no error indication; program revision recorded.');
  if (p.hmi) add(S3, 'HMI project and communication', `Download the HMI project to ${p.hmi.hmiPartNumber}; check the Ethernet link to the PLC.`, 'HMI shows live data; no communication error; start-up screen correct.');
  // 4. Safety
  const S4 = '4. Safety functions';
  for (const s of sf) add(S4, `${s.id} ${s.name}`, s.test, s.expected);
  if (m?.safety.relay && Number(m.safety.relay.part?.ratings.channels ?? 0) === 2) {
    add(S4, 'E-stop channel fault detection', `With ${m.safety.relay.tag} reset, open channel 1 (S11–S12) only, restore it, then try to reset; repeat for channel 2 (S21–S22).`, `${m.safety.relay.tag} trips on a single-channel fault and cannot be reset until both channels are cycled.`);
  }
  // 5. Inputs
  const S5 = '5. Inputs';
  for (const x of p.io.filter((i) => i.type === 'input')) {
    const a = p.addresses.get(x.id) || x.id;
    const dev = info.device(a);
    add(S5, `${a} ${x.description}`, `Operate ${dev || 'the field device'} (or simulate at the terminal).`, `PLC input ${a} and HMI I/O screen follow the device; OFF when released.`);
  }
  // 6. Outputs
  const S6 = '6. Outputs';
  for (const y of p.io.filter((i) => i.type === 'output')) {
    const a = p.addresses.get(y.id) || y.id;
    const dev = info.device(a);
    add(S6, `${a} ${y.description}`, `With motion areas clear, force ${a} ON from the programming software (or run the rung that drives it).`, `${dev || 'Device'} operates; output LED ON; returns OFF when released.`);
  }
  // 7. Alarms
  const S7 = '7. Alarms';
  for (const a of alarmRows(p, info)) add(S7, `${a.id} ${a.message}`, `Create the condition: ${a.cause.split('\n')[0]}`, `HMI shows "${a.message}" (${a.address}); ${a.effect.toLowerCase().startsWith('blocks') ? `${a.effect.toLowerCase()}; ` : ''}${a.action}`);
  // 8. HMI
  const S8 = '8. HMI screens';
  for (const s of p.hmi?.screens ?? []) {
    const btn = s.elements.filter((e) => e.kind === 'button').map((e) => e.label);
    add(S8, `Screen: ${s.name}`, `Open ${s.name}${btn.length ? `; press ${btn.join(', ')}` : ''}; check every indicator and value against the machine state.`, `${s.purpose} Every button writes the right bit; indicators and values are live; navigation works.`);
  }
  // 9. Sequence
  const S9 = '9. Sequence and operation';
  const startup = specLines(p.spec.homing);
  if (startup.length) add(S9, 'Start-up / homing', startup.join(' '), 'Completes in the specified order; automatic only possible afterwards.');
  specLines(p.spec.modes).forEach((l) => add(S9, 'Operating mode', l, 'Behaves as specified.'));
  specLines(p.spec.sequence).forEach((l, i) => add(S9, `Sequence step ${i + 1}`, l, 'Happens as described, in order, with no faults.'));
  add(S9, 'Stop / restart', 'Stop the cycle mid-sequence with Stop, then restart.', 'Machine stops in a safe state and restarts cleanly.');
  add(S9, 'Power loss', 'Switch the main disconnect OFF during the cycle, then ON again.', 'Nothing restarts by itself; a Start command is required.');
  // 10. Run test
  const S10 = '10. Run test and documentation';
  add(S10, 'Endurance run', 'Run automatic for at least 30 minutes (or the agreed number of cycles).', 'No faults; record cycle time and throughput.');
  add(S10, 'Backups and red-lines', 'Save PLC program and HMI project backups; collect red-lined drawings and the punch list.', 'Backups stored with this record; punch list agreed and signed.');
  return rows;
}

export function testTable(rows: TestRow[]): DocTable {
  const out: DocRow[] = [];
  let last = '';
  for (const r of rows) {
    if (r.section !== last) { out.push({ group: r.section }); last = r.section; }
    out.push([r.id, r.description, r.procedure, r.expected, r.result ?? '', '']);
  }
  return makeTable([['Test ID', 9], ['Description', 24], ['Procedure', 44], ['Expected result', 44], ['Pass/Fail', 9, 'center'], ['Initials', 8, 'center']], out, 9);
}

/** Site acceptance / commissioning checklist. */
export function satChecklist(p: ProjectSnapshot, sf: SafetyFunction[] = safetyFunctions(p)): TestRow[] {
  const rows: TestRow[] = [];
  let n = 0;
  const add = (section: string, description: string, procedure: string, expected: string) => rows.push({ id: `SAT-${pad(++n)}`, section, description, procedure, expected });
  const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;
  const A = '1. Site checks';
  add(A, 'FAT punch list', 'Confirm all FAT punch-list items are closed.', 'Punch list signed off.');
  add(A, 'Panel installation', 'Check mounting, clearances in front of the panel, enclosure integrity and gland sealing after transport.', `Working clearance per ${byRegion(p.info.region, 'NEC 110.26', 'CEC 2-308', 'IEC 60364-7-729 / local rules')}; no transport damage.`);
  if (m) add(A, 'Supply and grounding', `Measure the feeder voltage (${supplyText(m.supply)}) and check the feeder grounding conductor to the PE bar.`, 'Voltage within ±10%; equipment grounding conductor connected.');
  if (p.drawingCtx) {
    const sc = sccrTable(p);
    add(A, 'Available fault current vs SCCR', 'Obtain the available fault current at the panel feeder from the site electrical study.', `Available fault current <= marked panel SCCR${sc.lowest !== null ? ` (preliminary ${sc.lowest} kA)` : ''}.`);
  }
  add(A, 'Ambient conditions', 'Check ambient temperature, humidity, dust / wash-down conditions at the panel location.', 'Within the design basis (0–40 °C, enclosure type suitable).');
  const B = '2. Field wiring';
  if (p.drawingCtx) {
    const cables = cableSchedule(p.drawingCtx);
    add(B, 'Cable installation', `Check all ${cables.length} field cables against the cable schedule (tags, type, route, glands, strain relief).`, 'Cables installed and tagged as scheduled; lengths recorded.');
    add(B, 'Field terminations', 'Check every field termination at the panel terminals, junction boxes and devices against the drawings.', 'All terminations correct and tight.');
    add(B, 'Field insulation test', 'With the PLC and electronics isolated, megger motor cables at 500 VDC (motor disconnected) and check control cables for shorts to PE.', '>= 1 Mohm; no shorts.');
    add(B, 'Shields and PE', 'Check cable shields and PE cores are terminated as drawn (one end unless noted).', 'As drawn.');
  }
  const C = '3. Motor rotation';
  for (const mm of m?.motors ?? []) add(C, `${mm.motor.tag} ${mm.motor.description}`, `Bump ${mm.motor.tag} from the PLC (motion area clear, guards on).`, 'Rotation correct for the machine; if wrong, swap two motor leads at the motor (not the supply). Record running current.');
  const D = '4. I/O loop check (from the field device)';
  for (const x of p.io) {
    const a = p.addresses.get(x.id) || x.id;
    add(D, `${a} ${x.description}`, x.type === 'input' ? 'Operate the field device at its installed location.' : 'Force the output with the machine safe.', x.type === 'input' ? `PLC ${a} and HMI follow the device.` : 'Device operates at its installed location.');
    const c = p.checkout?.[x.id];
    if (c?.verified) rows[rows.length - 1].result = `OK — I/O check-out ${c.date}${c.by ? ` (${c.by})` : ''}${c.note ? `: ${c.note}` : ''}`;
  }
  const E = '5. Safety validation';
  for (const s of sf) add(E, `${s.id} ${s.name}`, `${s.test} Measure stopping time where relevant.`, s.expected);
  add(E, 'Risk assessment', `Confirm the risk assessment (${byRegion(p.info.region, 'ANSI B11.0 / ISO 12100', 'ANSI B11.0 / ISO 12100 / CSA Z432', 'EN ISO 12100')}) is complete and the PLr of each safety function is achieved (ISO 13849-1/-2).`, 'Safety validation report signed by the responsible person.');
  const F = '6. Operation and handover';
  add(F, 'Production run', 'Run with product at rated speed for the agreed time.', 'Rated throughput reached; no faults.');
  add(F, 'Operator and maintenance training', 'Train operators (Operator manual) and maintenance staff (maintenance chapter, LOTO points).', 'Attendance list signed.');
  add(F, 'Handover documents', 'Hand over as-built drawings, final program / HMI backups, this package, spare parts list.', 'Received by the customer.');
  add(F, 'Acceptance', 'Customer sign-off of the SAT.', 'Signed below.');
  return rows;
}

export function satTable(rows: TestRow[]): DocTable {
  const out: DocRow[] = [];
  let last = '';
  for (const r of rows) {
    if (r.section !== last) { out.push({ group: r.section }); last = r.section; }
    out.push([r.id, r.description, r.procedure, r.expected, r.result ?? '', '']);
  }
  return makeTable([['Item', 9], ['Check', 26], ['Method', 44], ['Acceptance', 40], ['Done', 8, 'center'], ['Initials', 8, 'center']], out, 9);
}
