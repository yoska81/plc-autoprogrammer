/**
 * Servo axis sheet, one axis per sheet (data: model.servos, electrical/servoWiring.ts).
 * Left: PLC signals on the drive's CN1 terminals, the STO channels from the safety relay output.
 * Right: the power path (branch protection → EMI filter → drive → motor), regenerative resistor, cables.
 */
import { AREA, AREA_B, AREA_R, LW_THIN } from '../geometry';
import type { DrawingPlan, PlannedSheet, SheetSpec } from '../plan';
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
  const pullUps = P ? [
    ...(a.terminals.some((t) => t.role === 'pulse') ? [[P.pulse.pullHi, '24+', 'PULL HI_P — PULSE INPUT PULL-UP (OPEN COLLECTOR)']] : []),
    ...(a.terminals.some((t) => t.role === 'direction') ? [[P.direction.pullHi, '24+', 'PULL HI_S — SIGN INPUT PULL-UP (OPEN COLLECTOR)']] : []),
    [P.com, '24+ / 0V', 'COM+ — DIGITAL INPUT COMMON'],
  ] : [];
  const sto = P ? [[P.sto.aPlus, '24+S', 'STO_A+ — SAFE TORQUE OFF CH A (SAFETY RELAY OUTPUT)'], [P.sto.aMinus, '0V', '/STO_A'], [P.sto.bPlus, '24+S', 'STO_B+ — SAFE TORQUE OFF CH B (SAFETY RELAY OUTPUT)'], [P.sto.bMinus, '0V', '/STO_B']] : [];
  const fixed = [...pullUps, ...sto];
  const boxH = Math.max(40, (a.terminals.length + fixed.length) * pitch + 14);
  const chain = [a.protection && `${a.protection.tag} ${a.protection.partNumber}`, a.filter && `${a.filter.tag} EMI FILTER ${a.filter.partNumber}`, `${d.tag} ${d.partNumber}`, a.motor && `${a.motor.tag} MOTOR ${a.motor.partNumber}`].filter(Boolean) as string[];
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>{`AXIS ${a.axis} — SERVO ${d.tag} ${d.partNumber}${P ? ` (${P.family.toUpperCase()})` : ''}${a.motor ? ` · MOTOR ${a.motor.tag} ${a.motor.partNumber}` : ''}`}</Txt>
      <Txt x={AREA.x + 6} y={AREA.y + 12} size={2.3}>{`${d.comp.function.toUpperCase()}`}</Txt>
      <Txt x={X.plc + 10} y={y0 - 4} size={2.4} bold anchor="middle">PLC</Txt>
      <Txt x={X.drv + 15} y={y0 - 4} size={2.4} bold anchor="middle">{`${d.tag} CN1 / CN10`}</Txt>
      <rect x={X.drv} y={y0} width={30} height={boxH} strokeWidth={0.45} fill="#fff" />
      {a.terminals.map((t, i) => {
        const y = y0 + 8 + i * pitch;
        return (
          <g key={t.address}>
            <Txt x={X.plc} y={y + 0.9} size={2.5} mono bold>{t.address}</Txt>
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
      {fixed.map(([term, wire, fn], i) => {
        const y = y0 + 8 + (a.terminals.length + i) * pitch;
        return (
          <g key={term}>
            <Txt x={X.plc} y={y + 0.9} size={2.3} mono bold>{`${tb} ${wire}`}</Txt>
            <Line x1={X.plc + 20.7} y1={y} x2={X.drv} y2={y} />
            <WireNo x={(X.plc + X.drv) / 2 + 6} y={y} n={wire.split(' ')[0]} />
            <Txt x={X.drv + 2} y={y + 0.9} size={2.4} mono bold>{term}</Txt>
            <Txt x={X.fn} y={y + 0.9} size={2.2} bold maxW={right - X.fn - 6}>{fn}</Txt>
          </g>
        );
      })}
      <Txt x={X.drv + 15} y={y0 + boxH + 4} size={2.0} anchor="middle" bold>SAFETY STOP: STO (BOTH CHANNELS)</Txt>
      {/* power path */}
      <Txt x={right} y={AREA.y + 20} size={2.6} bold>POWER</Txt>
      {chain.map((c, i) => {
        const y = y0 + 6 + i * 14;
        return (
          <g key={c}>
            <rect x={right} y={y - 4} width={AREA_R - right - 4} height={9} strokeWidth={0.35} fill="#fff" />
            <Txt x={right + 2} y={y + 1.5} size={2.1} bold maxW={AREA_R - right - 8}>{c}</Txt>
            {i < chain.length - 1 && <Line x1={right + 12} y1={y + 5} x2={right + 12} y2={y + 10} w={LW_THIN} />}
            {i < chain.length - 1 && <Txt x={right + 15} y={y + 8.5} size={1.8}>{i === chain.length - 2 && a.motor ? `${P?.power.motor.join(' / ') ?? 'U / V / W'} + PE · SERVO POWER CABLE` : `${P ? P.power.line.join(' / ') : 'L1 / L2 / L3'}${P && i === chain.length - 2 ? ` + ${P.power.control.join(' / ')} (CONTROL)` : ''}`}</Txt>}
          </g>
        );
      })}
      <Txt x={right} y={y0 + 8 + chain.length * 14} size={2.0} maxW={AREA_R - right - 4}>{a.brakingResistor ? `EXTERNAL REGEN RESISTOR ${a.brakingResistor.tag} ON ${P?.power.regen.p}-${P?.power.regen.c}, JUMPER ${P?.power.regen.p}-${P?.power.regen.d} REMOVED` : `BUILT-IN REGEN RESISTOR: JUMPER ${P?.power.regen.p ?? 'P'}-${P?.power.regen.d ?? 'D'} IN PLACE`}</Txt>
      {a.cables.map((c, i) => <Txt key={c.tag} x={right} y={y0 + 14 + chain.length * 14 + i * 4.5} size={2.0} maxW={AREA_R - right - 4}>{`${c.tag} ${c.partNumber}: ${c.comp.function.replace(/^Axis \d+ /, '').toUpperCase()}`}</Txt>)}
      {/* notes */}
      {a.notes.map((n, i) => (
        <Txt key={i} x={AREA.x + 6} y={y0 + boxH + 12 + i * 5} size={2.0} maxW={right - AREA.x - 14}>{`${i + 1}. ${n.toUpperCase()}`}</Txt>
      ))}
      <Txt x={AREA.x + 6} y={AREA_B - 5} size={2.1} maxW={AREA.w - 12}>
        {`${P ? `TERMINALS PER ${P.source.toUpperCase()}. ` : ''}CONTROL WIRING 18 AWG; PULSE / DIRECTION IN A SHIELDED CABLE AWAY FROM MOTOR POWER; MOTOR POWER AND ENCODER CABLES ARE THE MAKER'S, PLUGGED BOTH ENDS.`}
      </Txt>
    </g>
  );
}
