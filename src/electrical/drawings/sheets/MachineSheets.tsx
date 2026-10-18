/** Machine (field) wiring sheets: zone overview, cable schedule, junction box wiring. */
import type { MachineDevice } from '../../derive';
import { AREA, AREA_B, AREA_R, LW, LW_HEAVY, LW_THIN, wrapText } from '../geometry';
import {
  CABLE_ROWS, OV_ROW_H, OV_ZONE_HEAD, type DrawingPlan, type PlannedSheet, type SheetSpec, type ZonePlan, type ZoneRow,
} from '../plan';
import { Dot, Ground, Line, TermBox, Txt } from '../symbols';
import { powerText } from '../../../standards/regions';

const TYPE_SHORT: Record<string, string> = {
  'sensor-pnp': 'PNP SENSOR', 'sensor-npn': 'NPN SENSOR', 'limit-switch': 'LIMIT SWITCH', 'pressure-switch': 'PRESSURE SW.',
  'pushbutton-no': 'PUSHBUTTON', 'pushbutton-nc': 'PUSHBUTTON', selector: 'SELECTOR', 'estop-contact': 'E-STOP',
  solenoid: 'SOLENOID', 'pilot-light': 'PILOT LIGHT', 'stack-light': 'STACK LIGHT', 'contactor-coil': 'COIL', 'relay-coil': 'COIL',
  'vfd-input': 'VFD INPUT', 'safety-relay-output': 'SAFETY', 'servo-drive': 'SERVO', encoder: 'ENCODER', ultrasonic: 'ULTRASONIC', other: 'DEVICE', motor: 'MOTOR',
};

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

const CAB_X0 = AREA.x + 6, CAB_X1 = AREA.x + 58;
const ZONE_X0 = AREA.x + 76, ZONE_X1 = AREA_R - 4;
const JB_X = ZONE_X0 + 8, JB_W = 22;
const DEV_X0 = ZONE_X0 + 50, DEV_PITCH = 32, DEV_W = 26, DEV_H = 13;

export function MachineOverviewSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'machine' }>;
  const m = plan.model;
  const top = AREA.y + 14;
  const enc = m.rc.find((c) => c.category === 'enclosure' && c.part?.ratings.kind !== 'subpanel');
  // everything on the door (operators, E-stop, HMI, lamps), not only the PLC-wired ones
  const door = [...plan.layout.door.items.filter((d) => d.kind !== 'other').map((d) => d.tag), ...m.io.filter((p) => p.location === 'door').map((p) => p.deviceTag)]
    .filter((t, i, a) => t && a.indexOf(t) === i).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const cabLines = [
    ...(enc ? [`${enc.tag} ${enc.partNumber}`] : []),
    ...m.strips.map((s) => `${s.tag}: ${s.title.replace(/\s*\(FIELD\)/, '')}`),
  ];
  const doorLines = wrapText(`DOOR: ${door.join(', ') || '—'}`, CAB_X1 - CAB_X0 - 4, 2.2);
  const placed = sp.zones.map((z, i) => ({ z, at: top + sp.zones.slice(0, i).reduce((h, x) => h + x.height + 5, 0) }));
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>MACHINE WIRING — ZONES, JUNCTION BOXES AND FIELD CABLES</Txt>
      <Txt x={AREA_R - 4} y={AREA.y + 7} size={2.3} anchor="end" italic>CABLE TAGS Wnnn — SEE CABLE SCHEDULE. DASHED DEVICE = LOCATION GUESSED. NOT TO SCALE.</Txt>
      {/* cabinet */}
      <rect x={CAB_X0} y={top} width={CAB_X1 - CAB_X0} height={AREA_B - 6 - top} strokeWidth={LW_HEAVY} fill="#fff" />
      <Txt x={(CAB_X0 + CAB_X1) / 2} y={top + 6} size={3} bold anchor="middle">CONTROL</Txt>
      <Txt x={(CAB_X0 + CAB_X1) / 2} y={top + 10} size={3} bold anchor="middle">CABINET</Txt>
      {cabLines.map((l, i) => <Txt key={i} x={CAB_X0 + 2} y={top + 17 + i * 3.6} size={2.2} mono maxW={CAB_X1 - CAB_X0 - 4}>{l}</Txt>)}
      {doorLines.map((l, i) => <Txt key={`d${i}`} x={CAB_X0 + 2} y={top + 19 + cabLines.length * 3.6 + i * 3.2} size={2.2} maxW={CAB_X1 - CAB_X0 - 4}>{l}</Txt>)}
      {placed.map(({ z, at }) => <ZoneBlock key={z.zone} z={z} y0={at} region={plan.ctx.region} />)}
    </g>
  );
}

function ZoneBlock({ z, y0, region }: { z: ZonePlan; y0: number; region?: string }) {
  return (
    <g>
      <rect x={ZONE_X0} y={y0} width={ZONE_X1 - ZONE_X0} height={z.height} strokeWidth={LW} strokeDasharray="3 1.5" rx={2} fill="#fff" />
      <rect x={ZONE_X0} y={y0} width={Math.min(140, 8 + z.zone.length * 2.2)} height={7} fill="#e8e8e8" stroke="none" />
      <Txt x={ZONE_X0 + 3} y={y0 + 5} size={2.8} bold maxW={135}>{`ZONE: ${z.zone.toUpperCase()}`}</Txt>
      {z.rows.map((r, i) => <ZoneRowView key={i} r={r} region={region} rowTop={y0 + OV_ZONE_HEAD + i * OV_ROW_H} prevJbBus={i > 0 && !r.firstOfJb && r.jb ? y0 + OV_ZONE_HEAD + (i - 1) * OV_ROW_H + 5 : undefined} />)}
    </g>
  );
}

function ZoneRowView({ r, rowTop, prevJbBus, region }: { r: ZoneRow; rowTop: number; prevJbBus?: number; region?: string }) {
  const busY = rowTop + 5;
  const lastX = DEV_X0 + (r.devices.length - 1) * DEV_PITCH;
  const jbR = JB_X + JB_W;
  return (
    <g>
      {r.jb ? (
        <g>
          {r.firstOfJb && (
            <g>
              <Line x1={CAB_X1} y1={busY} x2={JB_X} y2={busY} w={0.6} />
              <Txt x={(CAB_X1 + ZONE_X0) / 2 + 2} y={busY - 1.2} size={2.4} mono bold anchor="middle">{r.trunk?.tag ?? ''}</Txt>
              <Txt x={(CAB_X1 + ZONE_X0) / 2 + 2} y={busY + 3.4} size={2.0} anchor="middle">{r.trunk ? `${r.trunk.cores.length + r.trunk.spareCores}C TRUNK` : ''}</Txt>
              <rect x={JB_X} y={busY - 5} width={JB_W} height={10} strokeWidth={0.5} fill="#fff" />
              <Line x1={JB_X} y1={busY - 5} x2={JB_X + 4} y2={busY - 1} w={LW_THIN} />
              <Txt x={JB_X + JB_W / 2 + 1.5} y={busY + 1} size={2.6} mono bold anchor="middle">{r.jb.tag}</Txt>
              <Txt x={JB_X + JB_W / 2} y={busY + 8.5} size={2.0} anchor="middle">{`${r.jb.terminals.length} TERMINALS`}</Txt>
            </g>
          )}
          {!r.firstOfJb && prevJbBus !== undefined && <Line x1={jbR + 3} y1={prevJbBus} x2={jbR + 3} y2={busY} w={0.5} />}
          <Line x1={r.firstOfJb ? jbR : jbR + 3} y1={busY} x2={lastX} y2={busY} w={0.5} />
          {!r.firstOfJb && <Dot x={jbR + 3} y={prevJbBus ?? busY} />}
        </g>
      ) : (
        <g>
          <Line x1={CAB_X1} y1={busY} x2={lastX} y2={busY} w={0.5} dash="2.5 1.2" />
          <Txt x={ZONE_X0 + 4} y={busY - 1.2} size={2.1} italic>HOME-RUN CABLES (CABLE TRAY)</Txt>
        </g>
      )}
      {r.devices.map((d, k) => <DeviceNode key={d.tag} d={d} cx={DEV_X0 + k * DEV_PITCH} busY={busY} region={region} />)}
    </g>
  );
}

function DeviceNode({ d, cx, busY, region }: { d: MachineDevice; cx: number; busY: number; region?: string }) {
  const top = busY + 8;
  return (
    <g>
      <Dot x={cx} y={busY} />
      <Line x1={cx} y1={busY} x2={cx} y2={top} w={LW} />
      <Txt x={cx + 1} y={busY + 5.4} size={2.1} mono>{d.cable ?? ''}</Txt>
      {d.kind === 'motor' ? (
        <g>
          <circle cx={cx} cy={top + 6.5} r={6.5} strokeWidth={0.5} fill="#fff" />
          <Txt x={cx} y={top + 8} size={3.6} bold anchor="middle">M</Txt>
          <Txt x={cx + 8} y={top + 5} size={2.5} mono bold>{d.tag}</Txt>
          <Txt x={cx + 8} y={top + 8.6} size={2.0}>{d.motor ? powerText(d.motor.motor.hp, region).toUpperCase() : ''}</Txt>
          <Txt x={cx + 8} y={top + 11.8} size={2.0}>{d.motor?.vfd ? 'VFD' : 'DOL'}</Txt>
        </g>
      ) : (
        <g>
          <rect x={cx - DEV_W / 2} y={top} width={DEV_W} height={DEV_H} strokeWidth={LW} fill="#fff" strokeDasharray={d.guessed ? '1.2 0.6' : undefined} />
          <Txt x={cx} y={top + 4.6} size={2.6} mono bold anchor="middle">{d.tag}</Txt>
          <Txt x={cx} y={top + 8.2} size={1.9} anchor="middle" maxW={DEV_W - 1.5}>{TYPE_SHORT[d.deviceType] ?? 'DEVICE'}</Txt>
          <Txt x={cx} y={top + 11.4} size={1.9} anchor="middle" maxW={DEV_W - 1.5}>{d.points.map((p) => p.address).join(' ')}</Txt>
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Cable schedule
// ---------------------------------------------------------------------------

export function CableScheduleSheet({ sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'cables' }>;
  const colW = (AREA.w - 24) / 2;
  const rowH = 5;
  const cols = [0, 14, 30, 52, 122];
  const heads = ['CORE', 'COLOR', 'WIRE', 'FROM', 'TO'];
  return (
    <g>
      {sp.columns.map((col, ci) => {
        const x = AREA.x + 8 + ci * (colW + 8);
        const y0 = AREA.y + 8;
        const bottom = y0 - 4.5 + (CABLE_ROWS + 1) * rowH + 1;
        return (
          <g key={ci}>
            <rect x={x} y={y0 - 4.5} width={colW} height={bottom - (y0 - 4.5)} strokeWidth={LW_HEAVY} />
            {heads.map((h, i) => <Txt key={h} x={x + cols[i] + 1.5} y={y0} size={2.3} bold>{h}</Txt>)}
            <Line x1={x} y1={y0 + 1.6} x2={x + colW} y2={y0 + 1.6} w={LW} />
            {col.map((r, ri) => {
              const yy = y0 + 1.6 + (ri + 1) * rowH;
              const c = r.cable;
              if (r.kind === 'head') {
                return (
                  <g key={ri}>
                    <rect x={x} y={yy - rowH} width={colW} height={rowH} fill="#e8e8e8" stroke="none" />
                    <Line x1={x} y1={yy - rowH} x2={x + colW} y2={yy - rowH} w={LW} />
                    <Txt x={x + 1.5} y={yy - 1.4} size={2.6} mono bold>{c.tag}</Txt>
                    <Txt x={x + 14} y={yy - 1.4} size={2.4} mono bold maxW={colW - 16}>{`${c.from} TO ${c.to}${r.cont ? '  (CONTINUED)' : `   ${c.zone.toUpperCase()}`}`}</Txt>
                  </g>
                );
              }
              if (r.kind === 'head2') {
                return (
                  <g key={ri}>
                    <rect x={x} y={yy - rowH} width={colW} height={rowH} fill="#f3f3f3" stroke="none" />
                    <Txt x={x + 14} y={yy - 1.4} size={2.2} maxW={colW - 16}>{`${c.type}${c.partNumber ? ` — P/N ${c.partNumber}` : ''} — LENGTH ${c.length}${c.spareCores ? ` — ${c.spareCores} SPARE` : ''}`}</Txt>
                    <Line x1={x} y1={yy} x2={x + colW} y2={yy} w={LW_THIN} />
                  </g>
                );
              }
              const k = r.core;
              return (
                <g key={ri}>
                  {cols.slice(1).map((cx) => <Line key={cx} x1={x + cx} y1={yy - rowH} x2={x + cx} y2={yy} w={LW_THIN} />)}
                  <Txt x={x + cols[0] + 7} y={yy - 1.4} size={2.3} mono anchor="middle">{k.core}</Txt>
                  <Txt x={x + cols[1] + 1.5} y={yy - 1.4} size={2.3} mono>{k.color}</Txt>
                  <Txt x={x + cols[2] + 1.5} y={yy - 1.4} size={2.3} mono bold maxW={cols[3] - cols[2] - 3}>{k.wire}</Txt>
                  <Txt x={x + cols[3] + 1.5} y={yy - 1.4} size={2.3} mono maxW={cols[4] - cols[3] - 3}>{k.from}</Txt>
                  <Txt x={x + cols[4] + 1.5} y={yy - 1.4} size={2.3} mono maxW={colW - cols[4] - 3}>{k.to}</Txt>
                  <Line x1={x} y1={yy} x2={x + colW} y2={yy} w={0.12} />
                </g>
              );
            })}
          </g>
        );
      })}
      <Txt x={AREA.x + 8} y={AREA_B - 2} size={2.3} italic>CORE COLORS: M12 CORDSETS BN/WH/BU/BK; MULTI-CORE CABLES WITH NUMBERED CORES — SLEEVE EACH CORE WITH ITS WIRE NUMBER. LENGTHS BY SITE.</Txt>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Junction box wiring
// ---------------------------------------------------------------------------

const J = { IN: 30, TB: 170, OUT: 260, DEV: 300 };

export function JunctionBoxSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'jb' }>;
  const pitch = 6.8;
  const y0 = AREA.y + 30;
  const ys = sp.terminals.map((_, i) => y0 + i * pitch);
  const jumpCols = new Map<string, number>();
  const tr = sp.trunk;
  const devOf = (tag: string) => plan.model.machine.devices.find((d) => d.tag === tag);
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>{`JUNCTION BOX ${sp.jb.tag} — ZONE: ${sp.jb.zone.toUpperCase()}${sp.pages > 1 ? ` (PART ${sp.page} OF ${sp.pages})` : ''}`}</Txt>
      <Txt x={AREA.x + 6} y={AREA.y + 12} size={2.4} maxW={AREA.w - 12}>{`ENCLOSURE: ${sp.jb.partNumber ?? 'TO BE SELECTED (NEMA 4/12, SIZE FOR TERMINALS + GLANDS)'}   •   TRUNK ${tr ? `${tr.tag}: ${tr.type}, FROM CABINET ${tr.from}` : '—'}`}</Txt>
      <Txt x={J.IN} y={y0 - 9} size={2.5} bold>INCOMING TRUNK (CABINET)</Txt>
      <Txt x={J.TB} y={y0 - 9} size={2.5} bold anchor="middle">{`${sp.jb.tag} TERMINALS`}</Txt>
      <Txt x={J.OUT - 20} y={y0 - 9} size={2.5} bold>OUTGOING CABLE / CORE</Txt>
      <Txt x={J.DEV + 12} y={y0 - 9} size={2.5} bold>FIELD DEVICE</Txt>
      <Line x1={AREA.x + 14} y1={y0 - 6.5} x2={AREA_R - 4} y2={y0 - 6.5} w={LW_THIN} />
      {sp.terminals.map((t, i) => {
        const y = ys[i];
        const jumper = t.incoming.startsWith('JUMPER');
        const first = jumper ? t.incoming.replace('JUMPER ', '') : '';
        let jx = 0;
        if (jumper) {
          if (!jumpCols.has(first)) jumpCols.set(first, J.TB - 10 - jumpCols.size * 4);
          jx = jumpCols.get(first)!;
        }
        const firstIdx = jumper ? sp.terminals.findIndex((x) => x.label === first) : -1;
        const d = devOf(t.device);
        const outCable = t.outgoing.split('/')[0];
        return (
          <g key={t.label}>
            {!jumper && t.incoming && (
              <g>
                <Txt x={J.IN} y={y + 0.9} size={2.4} mono bold>{t.incoming}</Txt>
                <Line x1={J.IN + 22} y1={y} x2={J.TB - 3} y2={y} />
                <Txt x={(J.IN + 22 + J.TB - 3) / 2} y={y - 1} size={2.4} mono anchor="middle">{t.wire}</Txt>
              </g>
            )}
            {jumper && (
              <g>
                <Line x1={jx} y1={y} x2={J.TB - 3} y2={y} />
                {firstIdx >= 0 ? <Line x1={jx} y1={ys[firstIdx]} x2={jx} y2={y} /> : <Txt x={jx - 1} y={y + 0.9} size={2.0} anchor="end">{`FROM ${first}`}</Txt>}
                {firstIdx >= 0 && <Dot x={jx} y={ys[firstIdx]} />}
                <Dot x={jx} y={y} />
              </g>
            )}
            {t.kind === 'ground' ? <TermBox x={J.TB} y={y} n={`${t.number} PE`} /> : <TermBox x={J.TB} y={y} n={t.number} />}
            {t.outgoing && (
              <g>
                <Line x1={J.TB + 3.5} y1={y} x2={J.OUT + 2} y2={y} />
                <Txt x={(J.TB + J.OUT) / 2} y={y - 1} size={2.4} mono anchor="middle">{t.wire}</Txt>
                <Txt x={J.OUT + 4} y={y + 0.9} size={2.4} mono maxW={J.DEV - J.OUT - 2}>{t.outgoing.length > 22 ? `${t.outgoing.split(',').length} DEVICE PE` : t.outgoing}</Txt>
                {outCable && t.kind !== 'ground' && <Txt x={J.DEV + 12} y={y + 0.9} size={2.4} mono bold>{t.device}</Txt>}
                {d && t.kind !== 'ground' && (i === 0 || sp.terminals[i - 1].device !== t.device) && <Txt x={J.DEV + 26} y={y + 0.9} size={2.2} maxW={AREA_R - J.DEV - 30}>{`${d.description.toUpperCase()} — ${TYPE_SHORT[d.deviceType] ?? ''}`}</Txt>}
              </g>
            )}
            {t.kind === 'ground' && <Ground x={J.TB} y={y + 1.9} />}
          </g>
        );
      })}
      <Txt x={AREA.x + 6} y={AREA_B - 2} size={2.3} italic>COMMONED 24+ / 0V TERMINALS ARE JUMPERED INSIDE THE BOX. LAND ALL CABLE SHIELDS/PE ON THE PE TERMINAL. USE LIQUID-TIGHT GLANDS SIZED TO EACH CABLE.</Txt>
    </g>
  );
}
