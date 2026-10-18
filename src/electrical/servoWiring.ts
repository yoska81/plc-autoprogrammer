/**
 * Servo axes in the drawings: which components make up each axis, the drive's power wiring (branch
 * protection → EMI filter → R/S/T and L1c/L2c, U/V/W to the motor, regenerative resistor), Safe Torque Off
 * from the safety relay output, and each PLC signal on its drive terminal (pins from src/electrical/motion.ts).
 */
import { isServoDrive, servoPins, type ServoPins, type ServoRole, servoRole } from './motion';
import type { CatalogPart, DesignComponent } from './types';

interface Rc { tag: string; partNumber: string; part?: CatalogPart; comp: DesignComponent; category: string }
export interface ServoWire { wire: string; from: string; to: string; color: string; size: string; function: string }

export interface ServoTerminal { role: ServoRole; address: string; type: 'input' | 'output'; description: string; terminal: string; label: string }

export interface ServoAxisModel {
  axis: string;
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
export function servoAxes(rc: Rc[]): Omit<ServoAxisModel, 'terminals' | 'notes'>[] {
  const out: Omit<ServoAxisModel, 'terminals' | 'notes'>[] = [];
  for (const d of rc.filter((c) => isServoDrive(c.part))) {
    const ax = d.comp.motorTag ?? '';
    const own = ax ? rc.filter((c) => c.comp.motorTag === ax && c !== d) : [];
    const k = (x: Rc) => String(x.part?.ratings.kind ?? '');
    out.push({
      axis: ax.replace(/^AX/, '') || d.tag, drive: d, pins: servoPins(d.part),
      motor: own.find((c) => k(c) === 'servo-motor'), protection: own.find((c) => c.category === 'breaker' || c.category === 'fuse'),
      filter: own.find((c) => k(c) === 'emc-filter'), brakingResistor: own.find((c) => k(c) === 'braking-resistor'),
      cables: own.filter((c) => /cable/.test(k(c))),
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
  axes: Omit<ServoAxisModel, 'terminals' | 'notes'>[],
  io: { address: string; type: 'input' | 'output'; description: string; deviceTag: string; deviceType: string }[],
  outStyle: 'sinking' | 'sourcing' | 'relay', inCommon: '0V' | '24+', stoSupply: string, peTag: string, phases: 1 | 3,
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
      if (P) {
        if (role === 'pulse') terminal = outStyle === 'sinking' ? P.pulse.minus : P.pulse.plus;
        else if (role === 'direction') terminal = outStyle === 'sinking' ? P.direction.minus : P.direction.plus;
        else if (P.di[role]) terminal = P.di[role]!;
        else if (P.do[role]) terminal = inCommon === '0V' ? P.do[role]![1] : P.do[role]![0];
      }
      terminals.push({ role, address: p.address, type: p.type, description: p.description, terminal: terminal || role.toUpperCase(), label: ROLE_LABEL[role] });
      terms.set(p.address, { tag: t, terminal: terminal || role.toUpperCase() });
    }
    if (!P) { notes.push(`${t}: terminal names of ${a.drive.partNumber} are not in the app — wire from the drive manual.`); return { ...a, terminals, notes }; }

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
    P.power.control.forEach((L, k) => w(`${t}-C${k + 1}`, `${t}:${line[k]}`, `${t}:${L}`, `${t} control power ${L} (jumpered from ${line[k]})`, 'BK', '14 AWG'));
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
    } else if (has('pulse') || has('direction')) notes.push(`${t}: sourcing (PNP) pulse outputs — wire PULSE/SIGN per the drive manual's open-collector sourcing diagram (3.5.2) and confirm the polarity.`);
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
    // Safe Torque Off from the safety relay output: both channels switched, returns to 0 V.
    w(stoSupply, `TB1 ${stoSupply}`, `${t}:${P.sto.aPlus}`, `${t} STO_A+ Safe Torque Off channel A (safety relay output)`);
    w('0V', `${t}:${P.sto.aMinus}`, 'TB1 0V', `${t} /STO_A`, 'WH/BU');
    w(stoSupply, `TB1 ${stoSupply}`, `${t}:${P.sto.bPlus}`, `${t} STO_B+ Safe Torque Off channel B (safety relay output)`);
    w('0V', `${t}:${P.sto.bMinus}`, 'TB1 0V', `${t} /STO_B`, 'WH/BU');
    notes.push(`${t}: STO from the safety relay output (${P.sto.aPlus.replace('CN10-', 'CN10 pin ')} / ${P.sto.bPlus.replace('CN10-', 'pin ')}); remove the CN10 bypass plug. FDBK+/- (${P.sto.fbPlus}/${P.sto.fbMinus}) monitors the STO circuit: wire it into the safety relay feedback or a PLC input per the manual's STO section, as the risk assessment requires.`);
    if (!a.motor) notes.push(`${t}: no servo motor chosen — U/V/W and the encoder (CN2) are not drawn.`);
    return { ...a, terminals, notes };
  });
  return { axes: models, wires, terms };
}
