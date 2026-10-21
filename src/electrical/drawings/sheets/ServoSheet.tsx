/**
 * Servo axis sheet, one axis per sheet (data: model.servos, electrical/servoWiring.ts).
 * Left: PLC signals on the drive's CN1 terminals, the STO channels from the safety relay output.
 * Right: the power path (branch protection → EMI filter → drive → motor), regenerative resistor, cables.
 */
import { AREA, AREA_B, AREA_R, LW_THIN } from '../geometry';
import type { DrawingPlan, PlannedSheet, SheetSpec } from '../plan';
import { ioLabel } from '../../ioNames';
import { Line, TermPt, Txt, WireNo } from '../symbols';
import { stripTag } from '../../../standards/designations';

export function ServoSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'servo' }>;
  const a = plan.model.servos[sp.index];
  if (!a) return null;
  const P = a.pins;
  const d = a.drive;
  const X = { plc: AREA.x + 16, drv: AREA.x + 110, fn: AREA.x + 150 };
  const right = AREA.x + 230;
  const y0 = AREA.y + 24;
  const pitch = 10;
  const tb = stripTag(plan.ctx.designations, 1);
  // Rows: drive terminal, wire number, function, and where the wire comes from (its real source).
  const tbOf = (wire: string) => `${tb} ${wire}`;
  // Pull-ups and COM+ only as wired (sinking pulse outputs; COM+ on the one supply it uses).
  const wireTo = (term: string) => plan.model.wires.find((w) => w.to === `${d.tag}:${term}`);
  const wireFrom = (term: string) => plan.model.wires.find((w) => w.from === `${d.tag}:${term}`);
  const pulled = (term: string) => wireTo(term) ? [[term, wireTo(term)!.wire, '', wireTo(term)!.from]] : [];
  const com = P && (wireTo(P.com) ?? wireFrom(P.com));
  const pullUps: string[][] = P ? [
    ...pulled(P.pulse.pullHi).map(([t, w, , f]) => [t, w, 'PULL HI_P — PULSE INPUT PULL-UP (OPEN COLLECTOR)', f]),
    ...pulled(P.direction.pullHi).map(([t, w, , f]) => [t, w, 'PULL HI_S — SIGN INPUT PULL-UP (OPEN COLLECTOR)', f]),
    ...(com ? [[P.com, com.wire, `COM+ — DIGITAL INPUT COMMON (${com.wire})`, com.to === `${d.tag}:${P.com}` ? com.from : com.to]] : []),
  ] : [];
  // STO channels from their own safety-relay outputs; FDBK in the relay's S33-S34 feedback loop.
  const relayTag = plan.model.safety.relay?.tag ?? 'SR';
  const fbIn = P && plan.model.wires.find((w) => w.to === `${d.tag}:${P.sto.fbPlus}`);
  const fbOut = P && plan.model.wires.find((w) => w.from === `${d.tag}:${P.sto.fbMinus}`);
  // the maker's signal names (SureServo2 STO_A / STO_B / FDBK; Yaskawa /HWBB1 / /HWBB2 / EDM1)
  const n = P?.stoNames ? { a: P.stoNames.a, b: P.stoNames.b, fb: P.stoNames.fb, what: 'HARD WIRE BASE BLOCK (STO)' } : { a: 'STO_A', b: 'STO_B', fb: 'FDBK', what: 'SAFE TORQUE OFF' };
  const sto: string[][] = P && a.sto ? [
    [P.sto.aPlus, a.sto.a.wire, `${n.a}+ — ${n.what} CH 1 (${a.sto.a.from.replace(/^TB1 /, '')})`, a.sto.a.from], [P.sto.aMinus, '0V', `${n.a}-`, tbOf('0V')],
    [P.sto.bPlus, a.sto.b.wire, `${n.b}+ — ${n.what} CH 2 (${a.sto.b.from})`, a.sto.b.from], [P.sto.bMinus, '0V', `${n.b}-`, tbOf('0V')],
    // the feedback loop's own wire numbers on FDBK+ / FDBK- (wire list), and the devices they come from / go to
    [P.sto.fbPlus, fbIn?.wire ?? 'S33', `${n.fb}+ — STO FEEDBACK IN ${relayTag} S33-S34 LOOP (S33 SIDE)`, fbIn?.from ?? `${relayTag}:S33`],
    [P.sto.fbMinus, fbOut?.wire ?? 'S34', `${n.fb}- — TOWARD ${relayTag} S34`, fbOut?.to ?? `${relayTag}:S34`],
  ] : [];
  // MECHATROLINK-III: in from the CPU / previous drive, out to the next one (the last stays open: no terminator)
  const net: string[][] = P?.network && a.link ? [
    [P.network.in, a.link.cable?.tag ?? 'NW', `${P.network.name} IN${a.link.cable ? ` — CABLE ${a.link.cable.partNumber}` : ''}`, a.link.in.replace(/^PLC:/, 'PLC ')],
    [P.network.out, a.link.out ? 'NW' : '—', a.link.out ? `${P.network.name} OUT TO NEXT STATION` : `${P.network.name} OUT — OPEN (LAST STATION, NO TERMINATOR)`, a.link.out ?? ''],
  ] : [];
  const ctl: string[][] = P && a.control === '24V' ? [['24V', '24+', 'CONTROL POWER 24 VDC (460 V DRIVE)', tbOf('24+')], ['0V', '0V', 'CONTROL POWER 0 V', tbOf('0V')]] : [];
  const fixed = [...net, ...pullUps, ...ctl, ...sto];
  const boxH = Math.max(40, (a.terminals.length + fixed.length) * pitch + 14);
  // Each device with its tag as its own text (the CAD export turns a text equal to a tag into a device reference).
  const motors = a.motors?.length ? a.motors : a.motor ? [a.motor] : [];
  const chain = [a.protection && [a.protection.tag, a.protection.partNumber], a.filter && [a.filter.tag, `EMI FILTER ${a.filter.partNumber}`], [d.tag, d.partNumber],
    ...motors.map((m, i) => [m.tag, `MOTOR ${m.partNumber}${motors.length > 1 ? ` (AXIS ${i ? 'B' : 'A'}: ${(i ? P?.motorB : P?.power.motor)?.join(' / ') ?? ''})` : ''}`])].filter(Boolean) as [string, string][];
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>{`AXIS ${a.axis} — SERVO ${d.tag} ${d.partNumber}${P ? ` (${P.family.toUpperCase()})` : ''}${motors.length ? ` · MOTOR ${motors.map((m) => `${m.tag} ${m.partNumber}`).join(', ')}` : ''}`}</Txt>
      <Txt x={AREA.x + 6} y={AREA.y + 12} size={2.3}>{`${d.comp.function.toUpperCase()}`}</Txt>
      <Txt x={X.plc + 10} y={y0 - 4} size={2.4} bold anchor="middle">PLC</Txt>
      <Txt x={X.drv + 15} y={y0 - 4} size={2.4} bold anchor="middle">{P?.network ? `${d.tag} ${P.network.in} / ${P.stoNames?.connector ?? 'CN8'}` : `${d.tag} CN1 / CN10`}</Txt>
      <rect x={X.drv} y={y0} width={30} height={boxH} strokeWidth={0.45} fill="#fff" />
      {a.terminals.map((t, i) => {
        const y = y0 + 8 + i * pitch;
        return (
          <g key={t.address}>
            <Txt x={X.plc} y={y + 0.9} size={2.5} mono bold>{ioLabel(plan.model.ioNames, t.address)}</Txt>
            <TermPt x={X.plc + 20} y={y} />
            <Line x1={X.plc + 20.7} y1={y} x2={X.drv} y2={y} />
            <WireNo x={(X.plc + X.drv) / 2 + 6} y={y} n={t.address} />
            <Txt x={(X.plc + X.drv) / 2 + 6} y={y + 4} size={1.8} anchor="middle">{t.type === 'output' ? 'PLC TO DRIVE' : 'DRIVE TO PLC'}</Txt>
            <Txt x={X.drv + 2} y={y + 0.9} size={2.4} mono bold>{t.terminal}</Txt>
            <Txt x={X.fn} y={y - 0.6} size={2.3} bold maxW={right - X.fn - 6}>{t.label.toUpperCase()}</Txt>
            <Txt x={X.fn} y={y + 3} size={2.0} maxW={right - X.fn - 6}>{t.description.toUpperCase()}</Txt>
          </g>
        );
      })}
      {fixed.map(([term, wire, fn, from], i) => {
        const y = y0 + 8 + (a.terminals.length + i) * pitch;
        return (
          <g key={term}>
            <Txt x={X.plc} y={y + 0.9} size={2.3} mono bold>{from}</Txt>
            <Line x1={X.plc + 20.7} y1={y} x2={X.drv} y2={y} />
            <WireNo x={(X.plc + X.drv) / 2 + 6} y={y} n={wire.split(' ')[0]} />
            <Txt x={X.drv + 2} y={y + 0.9} size={2.4} mono bold>{term}</Txt>
            <Txt x={X.fn} y={y + 0.9} size={2.2} bold maxW={right - X.fn - 6}>{fn}</Txt>
          </g>
        );
      })}
      <Txt x={X.drv + 15} y={y0 + boxH + 4} size={2.0} anchor="middle" bold>{a.sto ? 'SAFETY STOP: STO, TWO CHANNELS + FEEDBACK' : a.stoMissing === 'no-output' ? 'STO NOT WIRED — NO FREE SAFETY OUTPUT' : 'STO NOT WIRED — NO SAFETY RELAY'}</Txt>
      {/* power path */}
      <Txt x={right} y={AREA.y + 20} size={2.6} bold>POWER</Txt>
      {chain.map(([ctag, ctext], i) => {
        const y = y0 + 6 + i * 14;
        return (
          <g key={ctag}>
            <rect x={right} y={y - 4} width={AREA_R - right - 4} height={9} strokeWidth={0.35} fill="#fff" />
            <Txt x={right + 2} y={y + 1.5} size={2.1} bold>{ctag}</Txt>
            <Txt x={right + 16} y={y + 1.5} size={2.1} maxW={AREA_R - right - 22}>{ctext}</Txt>
            {i < chain.length - 1 && <Line x1={right + 12} y1={y + 5} x2={right + 12} y2={y + 10} w={LW_THIN} />}
            {i < chain.length - 1 && <Txt x={right + 15} y={y + 8.5} size={1.8}>{i >= chain.length - 1 - motors.length && motors.length ? `${(i === chain.length - 2 && motors.length > 1 ? P?.motorB : P?.power.motor)?.join(' / ') ?? 'U / V / W'} + PE · SERVO POWER CABLE` : `${P ? P.power.line.join(' / ') : 'L1 / L2 / L3'}${P && i === chain.length - 2 - Math.max(0, motors.length - 1) && a.control === 'ac' ? ` + ${P.power.control.join(' / ')} (CONTROL)` : ''}`}</Txt>}
          </g>
        );
      })}
      <Txt x={right} y={y0 + 8 + chain.length * 14} size={2.0} maxW={AREA_R - right - 4}>{P?.network ? (/^no/i.test(String(d.part?.ratings.builtInRegen ?? '')) ? 'NO BUILT-IN REGEN RESISTOR: B2-B3 NOT CONNECTED (EXTERNAL RESISTOR ON B1/+ - B2 IF NEEDED)' : 'BUILT-IN REGEN RESISTOR: SHORT BAR B2-B3 IN PLACE') : a.brakingResistor ? `EXTERNAL REGEN RESISTOR ${a.brakingResistor.tag} ON ${P?.power.regen.p}-${P?.power.regen.c}, JUMPER ${P?.power.regen.p}-${P?.power.regen.d} REMOVED` : `BUILT-IN REGEN RESISTOR: JUMPER ${P?.power.regen.p ?? 'P'}-${P?.power.regen.d ?? 'D'} IN PLACE`}</Txt>
      {/* power wire numbers of this axis (wire list: protection → drive, control power jumpers, drive → motor) */}
      {(() => {
        const ws = plan.model.wires.filter((w) => w.wire.startsWith(`${d.tag}-`));
        const y = y0 + 22 + chain.length * 14 + a.cables.length * 4.5;
        return ws.length ? (
          <g>
            <Txt x={right} y={y} size={2.1} bold>POWER WIRES</Txt>
            {ws.map((w, i) => <Txt key={`${w.wire}-${i}`} x={right + (i % 2) * ((AREA_R - right) / 2)} y={y + 4.5 + Math.floor(i / 2) * 4} size={1.9} mono maxW={(AREA_R - right) / 2 - 2}>{`${w.wire}  ${w.from} TO ${w.to}`}</Txt>)}
          </g>
        ) : null;
      })()}
      {a.cables.map((c, i) => (
        <g key={c.tag}>
          <Txt x={right} y={y0 + 14 + chain.length * 14 + i * 4.5} size={2.0} bold>{c.tag}</Txt>
          <Txt x={right + 14} y={y0 + 14 + chain.length * 14 + i * 4.5} size={2.0} maxW={AREA_R - right - 18}>{`${c.partNumber}: ${c.comp.function.replace(/^Axis \d+ /, '').toUpperCase()}`}</Txt>
        </g>
      ))}
      {/* notes */}
      {a.notes.map((n, i) => (
        <Txt key={i} x={AREA.x + 6} y={y0 + boxH + 12 + i * 5} size={2.0} maxW={right - AREA.x - 14}>{`${i + 1}. ${n.toUpperCase()}`}</Txt>
      ))}
      <Txt x={AREA.x + 6} y={AREA_B - 5} size={2.1} maxW={AREA.w - 12}>
        {`${P ? `TERMINALS PER ${P.source.toUpperCase()}. ` : ''}${P?.network ? `${P.network.name}: NO TERMINATOR REQUIRED — THE LAST STATION'S ${P.network.out} STAYS OPEN. ` : ''}CONTROL WIRING 18 AWG; ${P?.network ? `${P.network.name} CABLES ARE THE MAKER'S (MAX 50 M BETWEEN STATIONS), ROUTED AWAY FROM MOTOR POWER` : 'PULSE / DIRECTION IN A SHIELDED CABLE AWAY FROM MOTOR POWER'}; MOTOR POWER AND ENCODER CABLES ARE THE MAKER'S, PLUGGED BOTH ENDS.`}
      </Txt>
    </g>
  );
}
