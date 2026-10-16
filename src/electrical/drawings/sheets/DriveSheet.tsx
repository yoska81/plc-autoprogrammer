/**
 * VFD control & parameter sheet, one drive per sheet (data: model.drives, electrical/vfd.ts).
 * Left: control terminals of the drive with the PLC point, wire number and function on each.
 * Right: the drive parameters the wiring needs, with where each value comes from; values that
 * must come from the motor nameplate or be set on site are printed as such, never guessed.
 */
import { AREA, AREA_B, AREA_R, LW_THIN } from '../geometry';
import type { DrawingPlan, PlannedSheet, SheetSpec } from '../plan';
import { Line, TermPt, Txt, WireNo } from '../symbols';

const ROLE_TEXT: Record<string, string> = {
  run: 'RUN FORWARD', reverse: 'RUN REVERSE', preset: 'PRESET SPEED', fault: 'DRIVE FAULT (R1O CLOSES)', running: 'DRIVE RUNNING', speed: 'SPEED REFERENCE',
};
const SOURCE_TEXT: Record<string, string> = { design: 'DESIGN', default: 'DRIVE DEFAULT', nameplate: 'NAMEPLATE', 'on site': 'SET ON SITE' };

export function DriveSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'drive' }>;
  const c = plan.model.drives[sp.index];
  if (!c) return null;
  const d = c.drive;
  const X = { plc: AREA.x + 16, drv: AREA.x + 110, fn: AREA.x + 150 };
  const tableX = AREA.x + 215;
  const y0 = AREA.y + 24;
  const pitch = 11;
  const rows = c.terminals;
  const sto = c.safetyStop === 'sto' ? [['STO1', '24+S', 'SAFE TORQUE OFF CH 1 (SAFETY RELAY OUTPUT)'], ['STO2', '24+S', 'SAFE TORQUE OFF CH 2 (SAFETY RELAY OUTPUT)'], ['SCM', '0V', 'STO COMMON']] : [];
  const boxH = Math.max(40, (rows.length + sto.length) * pitch + 14);
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>{`${d.tag} — ${d.partNumber} (${c.series === 'other' ? 'DRIVE' : `DURAPULSE ${c.series}`}) · MOTOR ${d.motorTag}: ${d.motorDescription.toUpperCase()}`}</Txt>
      <Txt x={AREA.x + 6} y={AREA.y + 12} size={2.3}>{`${d.motorHp} HP · ${d.motorVolts} V · FLA ${d.fla.toFixed(1)} A${d.outputAmps ? ` · DRIVE OUTPUT ${d.outputAmps} A` : ''}${d.reversing ? ' · REVERSING' : ''} · SPEED: ${c.speedSource === 'analog' ? `ANALOG 0–${c.maxHz} HZ` : c.speedSource === 'presets' ? 'PRESET SPEEDS' : 'KEYPAD'}`}</Txt>
      {/* control terminals */}
      <Txt x={X.plc + 10} y={y0 - 4} size={2.4} bold anchor="middle">PLC</Txt>
      <Txt x={X.drv + 15} y={y0 - 4} size={2.4} bold anchor="middle">{d.tag}</Txt>
      <rect x={X.drv} y={y0} width={30} height={boxH} strokeWidth={0.45} fill="#fff" />
      {rows.map((t, i) => {
        const y = y0 + 8 + i * pitch;
        const out = t.role === 'run' || t.role === 'reverse' || t.role === 'preset' || t.role === 'speed';
        return (
          <g key={t.address}>
            <Txt x={X.plc} y={y + 0.9} size={2.5} mono bold>{t.address}</Txt>
            <TermPt x={X.plc + 20} y={y} />
            <Line x1={X.plc + 20.7} y1={y} x2={X.drv} y2={y} />
            <WireNo x={(X.plc + X.drv) / 2 + 6} y={y} n={t.role === 'speed' ? `${t.address}+` : t.address} />
            <Txt x={(X.plc + X.drv) / 2 + 6} y={y + 4} size={1.8} anchor="middle">{out ? 'PLC TO DRIVE' : 'DRIVE TO PLC'}</Txt>
            <Txt x={X.drv + 2} y={y + 0.9} size={2.4} mono bold>{t.terminal}</Txt>
            <Txt x={X.drv + 28} y={y + 0.9} size={1.9} mono anchor="end">{t.common.split(' ')[0]}</Txt>
            <Txt x={X.fn} y={y - 0.6} size={2.3} bold maxW={tableX - X.fn - 4}>{ROLE_TEXT[t.role]}</Txt>
            <Txt x={X.fn} y={y + 3} size={2.0} maxW={tableX - X.fn - 4}>{`${t.description.toUpperCase()} · COMMON ${t.common.toUpperCase()}`}</Txt>
          </g>
        );
      })}
      {sto.map(([term, wire, fn], i) => {
        const y = y0 + 8 + (rows.length + i) * pitch;
        return (
          <g key={term}>
            <Txt x={X.plc} y={y + 0.9} size={2.3} mono bold>{`TB1 ${wire}`}</Txt>
            <Line x1={X.plc + 20.7} y1={y} x2={X.drv} y2={y} />
            <WireNo x={(X.plc + X.drv) / 2 + 6} y={y} n={wire} />
            <Txt x={X.drv + 2} y={y + 0.9} size={2.4} mono bold>{term}</Txt>
            <Txt x={X.fn} y={y + 0.9} size={2.3} bold maxW={tableX - X.fn - 4}>{fn}</Txt>
          </g>
        );
      })}
      {!rows.length && !sto.length && <Txt x={X.drv + 15} y={y0 + 20} size={2.2} anchor="middle">NO PLC I/O</Txt>}
      <Txt x={X.drv + 15} y={y0 + boxH + 4} size={2.0} anchor="middle" bold>{c.safetyStop === 'sto' ? 'SAFETY STOP: STO' : c.safetyStop === 'contactor' ? 'SAFETY STOP: MOTOR CONTACTOR' : 'NO SAFE STOP (STO JUMPERED)'}</Txt>
      {/* notes */}
      {c.notes.map((n, i) => (
        <Txt key={i} x={AREA.x + 6} y={y0 + boxH + 12 + i * 5} size={2.0} maxW={tableX - AREA.x - 14}>{`${i + 1}. ${n.toUpperCase()}`}</Txt>
      ))}
      {/* parameter table */}
      <Txt x={tableX} y={AREA.y + 20} size={2.6} bold>DRIVE PARAMETERS</Txt>
      {[['PARAM', 0], ['NAME', 18], ['VALUE', 72], ['SOURCE', 118], ['NOTE', 140]].map(([t, dx]) => (
        <Txt key={String(t)} x={tableX + Number(dx)} y={y0 + 1} size={2.1} bold>{String(t)}</Txt>
      ))}
      <Line x1={tableX} y1={y0 + 3} x2={AREA_R - 2} y2={y0 + 3} w={LW_THIN} />
      {c.params.map((p, i) => {
        const y = y0 + 8 + i * 5.2;
        const flag = p.source === 'nameplate' || p.source === 'on site';
        return (
          <g key={`${p.param}-${i}`}>
            <Txt x={tableX} y={y} size={2.1} mono bold>{p.param}</Txt>
            <Txt x={tableX + 18} y={y} size={2.0} maxW={52}>{p.name.toUpperCase()}</Txt>
            <Txt x={tableX + 72} y={y} size={2.0} mono bold={flag} maxW={44}>{p.value.toUpperCase()}</Txt>
            <Txt x={tableX + 118} y={y} size={1.9} bold={flag}>{SOURCE_TEXT[p.source]}</Txt>
            <Txt x={tableX + 140} y={y} size={1.8} maxW={AREA_R - tableX - 142}>{(p.note ?? '').toUpperCase()}</Txt>
          </g>
        );
      })}
      <Txt x={AREA.x + 6} y={AREA_B - 5} size={2.1} maxW={AREA.w - 12}>
        PARAMETER NUMBERS PER THE DURAPULSE GS10 / GS20 USER MANUALS, CH. 4. VALUES MARKED NAMEPLATE OR SET ON SITE MUST BE ENTERED AT COMMISSIONING. CONTROL WIRING 18 AWG; ANALOG SPEED REFERENCE IN A SHIELDED PAIR.
      </Txt>
    </g>
  );
}
