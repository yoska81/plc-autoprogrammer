/**
 * Servo axes in the drawings: which components make up each axis, the drive's power wiring (branch
 * protection → EMI filter → R/S/T and L1c/L2c, U/V/W to the motor, regenerative resistor), Safe Torque Off
 * from the safety relay output, and each PLC signal on its drive terminal (pins from src/electrical/motion.ts).
 */
import { isServoDrive, isServoMotor, servoCableKind, servoPins, type ServoPins, type ServoRole, servoRole } from './motion';
import type { CatalogPart, DesignComponent } from './types';

interface Rc { tag: string; partNumber: string; part?: CatalogPart; comp: DesignComponent; category: string }
export interface ServoWire { wire: string; from: string; to: string; color: string; size: string; function: string }

export interface ServoTerminal { role: ServoRole; address: string; type: 'input' | 'output'; description: string; terminal: string; label: string }

/** Where each STO channel is fed from: its own safety-relay output (null: no safety relay, STO not wired). */
export interface StoFeed { a: { wire: string; from: string }; b: { wire: string; from: string } }

export interface ServoAxisModel {
  axis: string;
  /** STO channel feeds (null: not wired), and the drive's control power ('24V': 24 VDC terminals). */
  sto: StoFeed | null;
  /** Why STO is not wired: no safety relay, or no free safety output on it. */
  stoMissing?: 'no-relay' | 'no-output';
  control: 'ac' | '24V';
  drive: Rc;
  motor?: Rc;
  protection?: Rc;
  filter?: Rc;
  brakingResistor?: Rc;
  cables: Rc[];
  pins: ServoPins | null;
  terminals: ServoTerminal[];
  notes: string[];
}

const ROLE_LABEL: Record<ServoRole, string> = {
  pulse: '/PULSE (pulse)', direction: '/SIGN (direction)', enable: 'DI1 SON (servo on)', reset: 'DI5 ARST (alarm reset)',
  ready: 'DO1 SRDY (servo ready)', alarm: 'DO5 ALRM (servo alarm)', inPosition: 'DO4 TPOS (in position)', homed: 'DO3 HOME (homing done)', zeroSpeed: 'DO2 ZSPD (zero speed)',
};

/** Axes from the design: components grouped by their AX# tag (motion.ts sets it as motorTag). */
type AxisBase = Omit<ServoAxisModel, 'terminals' | 'notes' | 'sto' | 'stoMissing'>;

export function servoAxes(rc: Rc[]): AxisBase[] {
  const out: AxisBase[] = [];
  for (const d of rc.filter((c) => isServoDrive(c.part))) {
    const ax = d.comp.motorTag ?? '';
    const own = ax ? rc.filter((c) => c.comp.motorTag === ax && c !== d) : [];
    const k = (x: Rc) => String(x.part?.ratings.kind ?? '');
    out.push({
      axis: ax.replace(/^AX/, '') || d.tag, drive: d, pins: servoPins(d.part),
      // 460 V SureServo2: control circuit on 24 VDC terminals "24V" / "0V" (manual ch. 3); 230 V: L1C/L2C from the AC supply.
      control: /24\s*V?DC/i.test(String(d.part?.ratings.controlCircuitVolts ?? '')) ? '24V' : 'ac',
      motor: own.find((c) => isServoMotor(c.part)), protection: own.find((c) => c.category === 'breaker' || c.category === 'fuse'),
      filter: own.find((c) => k(c) === 'emc-filter'), brakingResistor: own.find((c) => k(c) === 'braking-resistor'),
      cables: own.filter((c) => servoCableKind(c.part) !== null),
    });
  }
  return out;
}

/**
 * Control terminals and wires of each axis. `outStyle`: the PLC output style driving the drive (sinking =
 * the output pulls the drive input low, COM+ on 24 V); `inCommon`: the PLC input common (0V = sinking inputs,
 * the drive output switches 24 V into them). `stoSupply`: the safety relay's switched 24 V.
 */
export function servoControls(
  axes: AxisBase[],
  io: { address: string; type: 'input' | 'output'; description: string; deviceTag: string; deviceType: string }[],
  outStyle: 'sinking' | 'sourcing' | 'relay', inCommon: '0V' | '24+', sto: StoFeed | null, stoWhy: 'no-relay' | 'no-output', peTag: string, phases: 1 | 3,
): { axes: ServoAxisModel[]; wires: ServoWire[]; terms: Map<string, { tag: string; terminal: string }> } {
  const wires: ServoWire[] = [];
  const terms = new Map<string, { tag: string; terminal: string }>();
  const w = (wire: string, from: string, to: string, fn: string, color = 'BU', size = '18 AWG') => wires.push({ wire, from, to, color, size, function: fn });
  const models: ServoAxisModel[] = axes.map((a) => {
    const t = a.drive.tag;
    const P = a.pins;
    const notes: string[] = [];
    const terminals: ServoTerminal[] = [];
    for (const p of io.filter((x) => x.deviceTag === t && x.deviceType === 'servo-drive')) {
      const role = servoRole(p);
      if (!role) continue;
      let terminal = '';
      // A relay contact cannot make a pulse train: pulse / direction from relay outputs are not wired.
      if (outStyle === 'relay' && (role === 'pulse' || role === 'direction')) {
        notes.push(`${t}: ${p.address} is a relay output — it cannot drive the ${role === 'pulse' ? 'pulse' : 'direction'} input; use transistor outputs (CLICK PLUS C2-14D1 / C2-14D2, pulse on Y001 / Y003 / Y005). Not wired.`);
        terminals.push({ role, address: p.address, type: p.type, description: p.description, terminal: 'NOT WIRED', label: ROLE_LABEL[role] });
        continue;
      }
      if (P) {
        if (role === 'pulse') terminal = outStyle === 'sinking' ? P.pulse.minus : P.pulse.plus;
        else if (role === 'direction') terminal = outStyle === 'sinking' ? P.direction.minus : P.direction.plus;
        else if (P.di[role]) terminal = P.di[role]!;
        else if (P.do[role]) terminal = inCommon === '0V' ? P.do[role]![1] : P.do[role]![0];
      }
      terminals.push({ role, address: p.address, type: p.type, description: p.description, terminal: terminal || role.toUpperCase(), label: ROLE_LABEL[role] });
      terms.set(p.address, { tag: t, terminal: terminal || role.toUpperCase() });
    }
    if (!P) { notes.push(`${t}: terminal names of ${a.drive.partNumber} are not in the app — wire from the drive manual.`); return { ...a, sto, stoMissing: sto ? undefined : stoWhy, terminals, notes }; }

    // Power: protection (→ EMI filter) → R/S/T; control power L1c/L2c from the same protection (230 V drives).
    const src = a.protection?.tag;
    const line = P.power.line.slice(0, phases === 3 ? 3 : 2);
    line.forEach((L, k) => {
      const wire = `${t}-L${k + 1}`;
      if (a.filter) {
        w(wire, src ? `${src}:T${k + 1}` : `BUS L${k + 1}`, `${a.filter.tag}:L${k + 1}`, `${t} EMI filter line`, 'BK', '14 AWG');
        w(`${wire}F`, `${a.filter.tag}:LOAD${k + 1}`, `${t}:${L}`, `${t} main power ${L}`, 'BK', '14 AWG');
      } else w(wire, src ? `${src}:T${k + 1}` : `BUS L${k + 1}`, `${t}:${L}`, `${t} main power ${L}`, 'BK', '14 AWG');
    });
    if (a.control === '24V') {
      // 460 V drives: the control circuit runs on 24 VDC (never on the AC line).
      w('24+', 'TB1 24+', `${t}:24V`, `${t} control power 24 VDC`, 'BU', '18 AWG');
      w('0V', `${t}:0V`, 'TB1 0V', `${t} control power 0 V`, 'WH/BU', '18 AWG');
    } else P.power.control.forEach((L, k) => w(`${t}-C${k + 1}`, `${t}:${line[k]}`, `${t}:${L}`, `${t} control power ${L} (jumpered from ${line[k]})`, 'BK', '14 AWG'));
    w('PE', `${t}:PE`, peTag, `${t} protective earth`, 'GN/YE', '14 AWG');
    if (a.motor) {
      P.power.motor.forEach((U) => w(`${t}-${U}`, `${t}:${U}`, `${a.motor!.tag}:${U}`, `${a.motor!.tag} motor power ${U} (servo power cable)`, 'BK', '16 AWG'));
      w('PE', `${t}:PE`, `${a.motor.tag}:PE`, `${a.motor.tag} motor ground (servo power cable)`, 'GN/YE', '16 AWG');
    }
    if (a.brakingResistor) {
      w(`${t}-P3`, `${t}:${P.power.regen.p}`, `${a.brakingResistor.tag}:1`, `${t} external regenerative resistor (P3-D jumper removed)`, 'BK', '14 AWG');
      w(`${t}-C`, `${t}:${P.power.regen.c}`, `${a.brakingResistor.tag}:2`, `${t} external regenerative resistor`, 'BK', '14 AWG');
    } else notes.push(`${t}: built-in regenerative resistor — keep the factory jumper ${P.power.regen.p}-${P.power.regen.d}.`);

    // Pulse / direction: open-collector PLC outputs with PULL HI to the external 24 V (max ${P.maxPulseKhzOC} kHz).
    const has = (r: ServoRole) => terminals.some((x) => x.role === r);
    if (outStyle === 'sinking') {
      if (has('pulse')) w('24+', 'TB1 24+', `${t}:${P.pulse.pullHi}`, `${t} PULL HI_P: pulse input pull-up to 24 V (open-collector pulses)`);
      if (has('direction')) w('24+', 'TB1 24+', `${t}:${P.direction.pullHi}`, `${t} PULL HI_S: sign input pull-up to 24 V (open-collector)`);
    } else if (outStyle === 'sourcing' && (has('pulse') || has('direction'))) notes.push(`${t}: sourcing (PNP) pulse outputs — wire PULSE/SIGN per the drive manual's open-collector sourcing diagram (3.5.2) and confirm the polarity.`);
    if (has('pulse')) notes.push(`${t}: open-collector pulses, max ${P.maxPulseKhzOC} kHz at the drive — set P1.000 to pulse + direction and the electronic gear to suit.`);
    // Digital inputs: COM+ to 24 V when the PLC outputs sink, to 0 V when they source.
    if (terminals.some((x) => x.type === 'output' && x.role !== 'pulse' && x.role !== 'direction')) {
      if (outStyle === 'sinking') w('24+', 'TB1 24+', `${t}:${P.com}`, `${t} COM+ digital input common (sinking PLC outputs)`);
      else w('0V', `${t}:${P.com}`, 'TB1 0V', `${t} COM+ digital input common (sourcing PLC outputs)`, 'WH/BU');
    }
    // Digital outputs: DO+ to 24 V, DO- to the PLC input (sinking inputs, common at 0 V); the reverse on NPN inputs.
    for (const x of terminals.filter((y) => y.type === 'input' && P.do[y.role])) {
      const [plus, minus] = P.do[x.role]!;
      if (inCommon === '0V') w('24+', 'TB1 24+', `${t}:${plus}`, `${t} ${x.label} supply`);
      else w('0V', `${t}:${minus}`, 'TB1 0V', `${t} ${x.label} return`, 'WH/BU');
    }
    // Safe Torque Off: each channel from its own safety-relay output (manual 3.11.3), returns to 0 V; FDBK is in
    // the relay's S33-S34 feedback loop (wired with the EDM loop) like a contactor's N.C. contact. SureServo2 manual
    // 3.11.7 "STO Feedback Behavior": "During an STO event when both channels A and B are open (AL500) the FDBK
    // signal is closed. … Once the STO circuit is reset to the running state, the FDBK output will open." So the
    // loop is closed while torque is off (reset allowed) and open while running; one failed channel keeps it open.
    if (sto) {
      w(sto.a.wire, sto.a.from, `${t}:${P.sto.aPlus}`, `${t} STO_A+ Safe Torque Off channel A (safety relay output)`);
      w('0V', `${t}:${P.sto.aMinus}`, 'TB1 0V', `${t} /STO_A`, 'WH/BU');
      w(sto.b.wire, sto.b.from, `${t}:${P.sto.bPlus}`, `${t} STO_B+ Safe Torque Off channel B (second safety relay output)`);
      w('0V', `${t}:${P.sto.bMinus}`, 'TB1 0V', `${t} /STO_B`, 'WH/BU');
      notes.push(`${t}: STO_A from ${sto.a.from.replace(/^TB1 /, '')}, STO_B from ${sto.b.from} (two safety-relay outputs); FDBK+ ${P.sto.fbPlus} / FDBK- ${P.sto.fbMinus} in the safety relay's S33-S34 feedback loop, FDBK+ on the S33 side (manual 3.11.3: polarity matters). Remove the CN10 bypass plug.`);
    } else notes.push(stoWhy === 'no-relay'
      ? `${t}: no safety relay in the design — STO is not wired, so the drive cannot run. Add a safety relay with two safety outputs for STO_A / STO_B; never run it on the CN10 bypass plug.`
      : `${t}: the safety relay has no free N.O. safety output for STO_B (13-14 feeds the safety-switched 24 V; 23-24, when there is one, the PLC status input) — STO is not wired, so the drive cannot run. Choose a safety relay with more N.O. safety outputs, or take the PLC status signal from the relay's N.C. auxiliary contact to free 23-24.`);
    if (!a.motor) notes.push(`${t}: no servo motor chosen — U/V/W and the encoder (CN2) are not drawn.`);
    return { ...a, sto, stoMissing: sto ? undefined : stoWhy, terminals, notes };
  });
  return { axes: models, wires, terms };
}
