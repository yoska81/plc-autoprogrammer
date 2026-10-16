import { byRegion, isIec } from '../../standards/regions';
import type { ProjectSnapshot } from '../collect';
import { buildModel, supplyText } from '../../electrical/derive';
import { makeTable, specLines, pad, type DocTable } from './table';

/**
 * Safety chapter: hazards, safety functions, lockout/tagout points and
 * residual risks. Safety functions come from the electrical design (E-stops,
 * safety relay, EDM, safety-switched supply) and from the specification
 * (doors, light curtains...). Required performance levels are never guessed.
 */

export interface SafetyFunction {
  id: string;
  name: string;
  initiating: string;
  stopCategory: string;
  logic: string;
  finals: string;
  architecture: string;
  plr: string;
  /** Short test description for the FAT. */
  test: string;
  expected: string;
}

const PLR = 'To be confirmed by risk assessment';

function stopCategory(p: ProjectSnapshot): string {
  const t = `${p.spec.safety ?? ''}\n${p.spec.guarding ?? ''}`;
  const m = /stop\s*category\s*([012])/i.exec(t) ?? /category\s*([012])\s*stop/i.exec(t);
  return m ? `${m[1]} (specification)` : '0 (assumed — confirm)';
}

const SPEC_FUNCTIONS: { re: RegExp; name: string; dev: RegExp; what: string }[] = [
  { re: /\b(door|gate|guard)\b.*\b(interlock|switch|lock)|\binterlock(ed)?\b.*\b(door|gate|guard)/i, name: 'Guard door interlock', dev: /door|gate|guard|interlock/i, what: 'Opening a guard door stops hazardous motion and prevents start while open' },
  { re: /light curtain/i, name: 'Light curtain (presence sensing)', dev: /light curtain|curtain/i, what: 'Breaking the light curtain stops hazardous motion' },
  { re: /two[- ]hand/i, name: 'Two-hand control', dev: /two[- ]hand/i, what: 'Hazardous motion only while both hands operate the controls' },
  { re: /area scanner|laser scanner|safety mat/i, name: 'Presence sensing (scanner / mat)', dev: /scanner|mat/i, what: 'Presence in the hazard zone stops hazardous motion' },
  { re: /enabling (device|switch)|jog.*hold/i, name: 'Enabling device / hold-to-run', dev: /enabl/i, what: 'Motion in setup only while the enabling device is held' },
];

export function safetyFunctions(p: ProjectSnapshot): SafetyFunction[] {
  const out: SafetyFunction[] = [];
  const cat = stopCategory(p);
  const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;
  let n = 0;
  if (m && (m.safety.estops.length || m.safety.relay)) {
    const s = m.safety;
    const loc = (tag: string) => p.electrical?.ioWiring.find((w) => w.deviceTag === tag)?.location ?? (m.rc.find((c) => c.tag === tag)?.mount === 'door' ? 'cabinet door' : '');
    const outputs = m.io.filter((x) => x.type === 'output');
    const finals: string[] = [];
    if (s.outputSupply === '24+S') finals.push(`24+S supply to PLC outputs (${outputs.map((x) => `${x.address}${x.deviceTag ? ` ${x.deviceTag}` : ''}`).join(', ') || 'none'})`);
    if (s.mcr) finals.push(`${s.mcr.tag} master control relay`);
    const conts = m.motors.flatMap((x) => x.contactors.map((c) => c.tag));
    if (conts.length) finals.push(`Motor contactor(s) ${conts.join(', ')}`);
    const sto = m.drives.filter((c) => c.safetyStop === 'sto').map((c) => c.drive.tag);
    if (sto.length) finals.push(`Safe Torque Off STO1/STO2 of ${sto.join(', ')} (stop category 0)`);
    const noSafeStop = m.drives.filter((c) => c.safetyStop === 'none').map((c) => c.drive.tag);
    if (noSafeStop.length) finals.push(`NOT A SAFETY FUNCTION: ${noSafeStop.join(', ')} stop only by the PLC run signal (STO jumpered, no contactor)`);
    const channels = Number(s.relay?.part?.ratings.channels ?? 0);
    const arch = s.relay
      ? `${channels === 2 ? 'Dual-channel' : 'Single-channel'} E-stop input to ${s.relay.tag}; ${s.edm.length ? `EDM monitoring of ${s.edm.join(', ')}` : 'no EDM'}; ${conts.length <= 1 && !s.mcr ? 'single-channel output stage' : 'output stage per drawings'}. Category / PL to be verified per ISO 13849-1/-2.`
      : 'Hardwired E-stop chain without a safety relay — not monitored. Category / PL to be verified per ISO 13849-1.';
    out.push({
      id: `SF-${pad(++n, 2)}`, name: 'Emergency stop',
      initiating: s.estops.map((t) => `${t}${loc(t) ? ` (${loc(t)})` : ''}`).join(', ') || 'NOT IN DESIGN',
      stopCategory: cat,
      logic: s.relay ? `${s.relay.tag} ${s.relay.partNumber}` : 'Hardwired chain',
      finals: finals.join('; ') || 'NOT DEFINED',
      architecture: arch, plr: PLR,
      test: `With the machine running in automatic, press ${s.estops.join(', then ') || 'each E-stop'} (one at a time).`,
      expected: `All hazardous motion stops (stop category ${cat.split(' ')[0]}); ${s.relay ? `${s.relay.tag} outputs open, ` : ''}${s.outputSupply === '24+S' ? '24+S is removed, ' : ''}${s.statusInput ? `PLC input ${s.statusInput.address} turns OFF, ` : ''}machine cannot restart until the E-stop is released and reset.`,
    });
    out.push({
      id: `SF-${pad(++n, 2)}`, name: 'Manual reset after a safety stop',
      initiating: s.reset ? `${s.reset} reset pushbutton` : 'NOT ASSIGNED — add a reset pushbutton',
      stopCategory: 'n/a', logic: s.relay ? `${s.relay.tag} (monitored manual reset)` : 'Hardwired',
      finals: 'Same as SF-01', architecture: 'Reset is a deliberate action outside the hazard zone and does not start the machine by itself.', plr: PLR,
      test: `Release the E-stop and operate ${s.reset ?? 'the reset device'}; then try to start without the reset.`,
      expected: 'Safety circuit resets only on the deliberate reset action; releasing the E-stop alone does not restart anything; Start is required after reset.',
    });
    if (s.edm.length && s.relay) out.push({
      id: `SF-${pad(++n, 2)}`, name: 'Contactor monitoring (EDM)',
      initiating: `NC mirror contacts of ${s.edm.join(', ')}`, stopCategory: 'n/a', logic: `${s.relay.tag} feedback loop S33–S34`,
      finals: 'Prevents reset', architecture: 'Detects a welded / stuck contactor before each reset.', plr: PLR,
      test: `Open the feedback loop at ${s.edm[0]} (simulating a welded contact) and try to reset.`,
      expected: `${s.relay.tag} cannot be reset while the feedback loop is open.`,
    });
  }
  const specText = `${p.spec.safety ?? ''}\n${p.spec.guarding ?? ''}`;
  for (const f of SPEC_FUNCTIONS) {
    if (!f.re.test(specText)) continue;
    const devs = (p.electrical?.ioWiring ?? []).filter((w) => f.dev.test(`${w.description} ${w.deviceTag}`)).map((w) => `${w.deviceTag} (${w.address})`);
    out.push({
      id: `SF-${pad(++n, 2)}`, name: f.name,
      initiating: devs.join(', ') || 'Required by specification — NOT IN ELECTRICAL DESIGN',
      stopCategory: cat, logic: devs.length ? 'Per drawings' : 'To be designed', finals: 'Same as SF-01', architecture: `${f.what}. Design and wiring to be completed and verified.`, plr: PLR,
      test: `Operate the ${f.name.toLowerCase()} during automatic operation.`, expected: 'Hazardous motion stops; restart only after reset and Start.',
    });
  }
  return out;
}

export function safetyFunctionTable(p: ProjectSnapshot, sf = safetyFunctions(p)): DocTable {
  return makeTable([['SF-ID', 7], ['Safety function', 18], ['Initiating device', 22], ['Stop cat.', 10], ['Logic device', 18], ['Final elements', 30], ['Architecture / category', 34], ['Required PLr', 16]],
    sf.map((s) => [s.id, s.name, s.initiating, s.stopCategory, s.logic, s.finals, s.architecture, s.plr]));
}

export function hazardTable(p: ProjectSnapshot): DocTable {
  const rows: string[][] = [];
  const d = p.electrical;
  const supply = d ? supplyText(d.inputs.supply) : 'mains supply';
  rows.push(['Electric shock', `${supply} inside the control panel`, 'Enclosure closed by tool / latch; lockable main disconnect; PE bonding of all exposed metal; finger-safe terminals', 'Line side of the main disconnect stays live with the handle OFF — label required']);
  rows.push(['Arc flash', 'Work on the energized panel', `Work de-energized; arc-flash / shock warning label (${byRegion(p.info.region, 'NFPA 70E', 'CSA Z462', 'EN 50110-1, ISO 7010 W012')})`, 'Incident energy study by the site (by others)']);
  if (d?.inputs.motors.length) rows.push(['Entanglement / crushing', `Moving parts driven by ${d.inputs.motors.map((m) => `${m.tag} (${m.description || 'motor'})`).join(', ')}`, 'Fixed / interlocked guarding (machine builder); emergency stop SF-01', 'Guarding design is outside this electrical scope']);
  const pneu = (p.spec.pneumatics ?? '').trim() || (d?.ioWiring ?? []).some((w) => w.deviceType === 'solenoid');
  if (pneu) rows.push(['Unexpected pneumatic motion / stored air', 'Cylinders and valves', `${/spring return/i.test(p.spec.pneumatics ?? '') ? 'Spring-return valve(s): cylinders go to the de-energized position on power loss; ' : ''}lockable air dump valve (by machine builder)`, 'Trapped air in cylinders after air is dumped — bleed before work']);
  rows.push(['Unexpected start-up', 'Restart after a stop, power return or reset', 'Start only by a deliberate Start command; safety reset does not start the machine (SF-02); outputs fed through the safety circuit', 'Lockout / tagout required for maintenance']);
  rows.push(['Fire / overheating', 'Overloaded conductors or components', 'Branch protection and overloads sized per code; heat calculation; NEMA-rated enclosure', 'Periodic thermographic inspection']);
  for (const l of [...specLines(p.spec.safety), ...specLines(p.spec.guarding)]) rows.push(['Specification requirement', l, 'Implemented per this document — see safety functions', 'Verify during FAT / SAT']);
  return makeTable([['Hazard', 22], ['Source in this machine', 38], ['Risk reduction in this design', 52], ['Residual risk / note', 38]], rows);
}

export function lotoTable(p: ProjectSnapshot): DocTable {
  const rows: string[][] = [];
  const m = p.drawingCtx ? buildModel(p.drawingCtx) : null;
  const d = p.electrical;
  if (m?.disconnect) rows.push(['E-01', 'Electrical', `${supplyText(m.supply)}`, `${m.disconnect.tag} main disconnect (${m.disconnect.partNumber}) — lockable door handle`, 'Control panel door', 'Try Start; test for absence of voltage on the load side of the disconnect (all phases to each other and to PE)']);
  else rows.push(['E-01', 'Electrical', d ? supplyText(d.inputs.supply) : 'mains', 'Main disconnect — NOT IN DESIGN', 'Control panel', 'Add a lockable disconnect']);
  rows.push(['E-02', 'Electrical (upstream)', 'Feeder to the panel', 'Upstream feeder breaker / disconnect (by site)', 'Plant distribution', 'Needed to work on the line side of the main disconnect']);
  if ((p.spec.pneumatics ?? '').trim() || (d?.ioWiring ?? []).some((w) => w.deviceType === 'solenoid')) {
    const psi = /(\d+)\s*psi/i.exec(`${p.spec.utilities ?? ''} ${p.spec.pneumatics ?? ''}`)?.[1];
    rows.push(['P-01', 'Pneumatic', psi ? `${psi} psi plant air (specification)` : 'Plant air', 'Lockable air shut-off / dump valve — by machine builder (not in electrical scope)', 'Machine air inlet', 'Gauge reads 0 psi; cycle valves manually to bleed trapped air']);
  }
  if (m?.motors.some((x) => x.vfd)) rows.push(['E-03', 'Stored electrical', 'VFD DC bus capacitors', 'Wait time per drive manual after the disconnect is opened', 'VFD', 'Measure DC bus voltage before touching drive terminals']);
  rows.push(['M-01', 'Mechanical / gravity', 'Raised or spring-loaded parts', 'Per the machine risk assessment (blocking, pins)', 'Machine', 'Per site LOTO procedure']);
  return makeTable([['Point', 8], ['Energy type', 18], ['Magnitude', 22], ['Isolation device', 46], ['Location', 18], ['Verification', 46]], rows);
}

export function residualRisks(p: ProjectSnapshot): string[] {
  const out = [
    'The line side of the main disconnect remains energized when the handle is OFF; only qualified persons may open the panel.',
    'The PLC and HMI are not safety-rated. They must never be relied on to perform a safety function; all safety functions are hardwired through the safety circuit.',
    'Guarding of moving parts, pinch points and pneumatic actuators is outside the electrical scope and must be provided and verified by the machine builder.',
    'The required performance levels (PLr) and the achieved PL of each safety function have not been calculated. They must be determined from the risk assessment and verified (ISO 13849-1 / -2) before the machine is put into service.',
  ];
  if (p.drawingCtx && buildModel(p.drawingCtx).motors.some((x) => x.motor.starter !== 'vfd')) out.push('Coast-down: motors stopped by removing power (stop category 0) may coast; confirm stopping time against guard distances.');
  return out;
}

export function riskStatement(p: ProjectSnapshot): string {
  return `A documented risk assessment to ${byRegion(p.info.region, 'ANSI B11.0 / ISO 12100', 'ANSI B11.0 / ISO 12100 and CSA Z432', 'EN ISO 12100')} is required before this design is released for construction. The assessment sets the required performance level (PLr) of every safety function in the table above; the safety circuit design must then be verified against ISO 13849-1 and validated per ISO 13849-2${isIec(p.info.region) ? ' (or designed and validated to IEC 62061)' : ''}. This document does not replace the risk assessment.`;
}
