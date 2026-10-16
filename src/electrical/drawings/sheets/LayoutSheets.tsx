/** Panel (backplate) layout and door layout, drawn to scale. */
import type { DoorItem, PlacedItem } from '../../derive';
import { AREA, AREA_B, AREA_R, LW, LW_THIN, textWidth } from '../geometry';
import type { DrawingPlan, PlannedSheet } from '../plan';
import { Line, Txt } from '../symbols';
import { doorScale, niceScale, panelScale, scaleText } from '../scale';

function Dim({ x1, y1, x2, y2, text, vertical }: { x1: number; y1: number; x2: number; y2: number; text: string; vertical?: boolean }) {
  const a = 1.2;
  return (
    <g>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} w={LW_THIN} />
      {vertical ? (
        <>
          <path d={`M ${x1} ${y1} l -${a / 2} ${a * 1.6} h ${a} Z`} fill="#000" strokeWidth={0.1} />
          <path d={`M ${x2} ${y2} l -${a / 2} -${a * 1.6} h ${a} Z`} fill="#000" strokeWidth={0.1} />
          <Txt x={x1 - 1.6} y={(y1 + y2) / 2} size={2.5} anchor="middle" rotate={-90}>{text}</Txt>
        </>
      ) : (
        <>
          <path d={`M ${x1} ${y1} l ${a * 1.6} -${a / 2} v ${a} Z`} fill="#000" strokeWidth={0.1} />
          <path d={`M ${x2} ${y2} l -${a * 1.6} -${a / 2} v ${a} Z`} fill="#000" strokeWidth={0.1} />
          <Txt x={(x1 + x2) / 2} y={y1 - 1.4} size={2.5} anchor="middle">{text}</Txt>
        </>
      )}
    </g>
  );
}

const inch = (mm: number) => `${(mm / 25.4).toFixed(1)}"`;

function ItemRect({ it, ox, oy, s }: { it: PlacedItem; ox: number; oy: number; s: number }) {
  const x = ox + it.x * s, y = oy + it.y * s, w = it.w * s, h = it.h * s;
  const parts = it.sub ?? [it];
  const isTb = it.category === 'terminal';
  return (
    <g>
      {parts.map((p, i) => (
        <rect key={i} x={ox + p.x * s} y={oy + p.y * s} width={p.w * s} height={p.h * s} fill="#fff" strokeWidth={LW} strokeDasharray={it.estimated ? '1.2 0.6' : undefined} />
      ))}
      {isTb && Array.from({ length: Math.min(200, Math.floor(it.w / 6)) }, (_, k) => (
        <Line key={k} x1={x + (k + 1) * 6 * s} y1={y + 0.6} x2={x + (k + 1) * 6 * s} y2={y + h - 0.6} w={0.12} />
      ))}
      {it.sub
        ? it.sub.map((p, i) => <ItemLabel key={i} x={ox + p.x * s} y={oy + p.y * s} w={p.w * s} h={p.h * s} label={it.label.split('/')[i] ?? p.tag} pn={p.partNumber} />)
        : <ItemLabel x={x} y={y} w={w} h={h} label={it.label} pn={isTb ? '' : it.partNumber} />}
    </g>
  );
}

function ItemLabel({ x, y, w, h, label, pn }: { x: number; y: number; w: number; h: number; label: string; pn: string }) {
  const size = 2.3;
  const lw = textWidth(label, size, true);
  if (lw + 1 <= w) {
    const pnFits = pn && textWidth(pn, 1.9, true) + 1 <= w && h > 9;
    return (
      <g>
        <rect x={x + w / 2 - lw / 2 - 0.5} y={y + h / 2 - (pnFits ? 3.6 : 1.9)} width={lw + 1} height={3.2} fill="#fff" stroke="none" />
        <Txt x={x + w / 2} y={y + h / 2 + (pnFits ? -1.2 : 0.8)} size={size} mono bold anchor="middle">{label}</Txt>
        {pnFits && <Txt x={x + w / 2} y={y + h / 2 + 2.4} size={1.9} mono anchor="middle">{pn}</Txt>}
      </g>
    );
  }
  // vertical label for narrow parts
  return <Txt x={x + w / 2 + 0.8} y={y + h / 2} size={Math.min(size, w - 0.4)} mono bold anchor="middle" rotate={-90} maxW={h - 1}>{label}</Txt>;
}

export function PanelLayoutSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const L = plan.layout;
  const s = panelScale(plan);
  const e = L.enclosure;
  const ox = AREA.x + 30, oy = AREA.y + 14;
  const bp = L.backplate;
  const pid = `hatch${sheet.n}`;
  const legend = [...L.items].sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  const LX = 300;
  const rowH = 4.4;
  const maxRows = Math.floor((AREA_B - (AREA.y + 14) - 30) / rowH);
  const rows = legend.flatMap((it) => (it.sub ?? [it]).map((p, i) => ({ tag: it.sub ? it.label.split('/')[i] : it.label, pn: p.partNumber, size: `${Math.round(p.w)} x ${Math.round(p.h)}${p.estimated ? '*' : ''}` })));
  return (
    <g>
      <defs>
        <pattern id={pid} width={2} height={2} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={2} stroke="#000" strokeWidth={0.15} />
        </pattern>
      </defs>
      <Txt x={ox} y={AREA.y + 7} size={3.2} bold>{`BACK PANEL LAYOUT — SCALE ${scaleText(s)}`}</Txt>
      {/* enclosure + backplate */}
      <rect x={ox} y={oy} width={e.w * s} height={e.h * s} strokeWidth={0.6} rx={1} />
      <rect x={ox + bp.x * s} y={oy + bp.y * s} width={bp.w * s} height={bp.h * s} strokeWidth={LW} strokeDasharray={bp.estimated ? '2 1' : undefined} />
      {L.ducts.map((d, i) => (
        <rect key={i} x={ox + d.x * s} y={oy + d.y * s} width={d.w * s} height={d.h * s} fill={`url(#${pid})`} strokeWidth={LW_THIN} />
      ))}
      {L.rails.map((r, i) => (
        <g key={i}>
          <rect x={ox + r.x * s} y={oy + r.y * s} width={r.w * s} height={r.h * s} fill="#fff" strokeWidth={LW_THIN} />
          <Line x1={ox + r.x * s} y1={oy + (r.y + 7.5) * s} x2={ox + (r.x + r.w) * s} y2={oy + (r.y + 7.5) * s} w={0.12} />
          <Line x1={ox + r.x * s} y1={oy + (r.y + r.h - 7.5) * s} x2={ox + (r.x + r.w) * s} y2={oy + (r.y + r.h - 7.5) * s} w={0.12} />
        </g>
      ))}
      {L.items.map((it, i) => <ItemRect key={i} it={it} ox={ox} oy={oy} s={s} />)}
      {/* dimensions */}
      <Dim x1={ox} y1={oy + e.h * s + 7} x2={ox + e.w * s} y2={oy + e.h * s + 7} text={`${Math.round(e.w)} mm (${inch(e.w)}) ENCLOSURE WIDTH`} />
      <Line x1={ox} y1={oy + e.h * s + 1} x2={ox} y2={oy + e.h * s + 9} w={0.12} />
      <Line x1={ox + e.w * s} y1={oy + e.h * s + 1} x2={ox + e.w * s} y2={oy + e.h * s + 9} w={0.12} />
      <Dim x1={ox - 8} y1={oy} x2={ox - 8} y2={oy + e.h * s} text={`${Math.round(e.h)} mm (${inch(e.h)})`} vertical />
      <Line x1={ox - 10} y1={oy} x2={ox - 1} y2={oy} w={0.12} />
      <Line x1={ox - 10} y1={oy + e.h * s} x2={ox - 1} y2={oy + e.h * s} w={0.12} />
      <Dim x1={ox + bp.x * s} y1={oy + e.h * s + 14} x2={ox + (bp.x + bp.w) * s} y2={oy + e.h * s + 14} text={`BACK PANEL ${Math.round(bp.w)} x ${Math.round(bp.h)} mm${bp.estimated ? ' (EST.)' : ''}`} />
      {/* notes */}
      <g>
        {[
          `ENCLOSURE: ${e.tag ?? '—'} ${e.partNumber ?? 'NOT SPECIFIED'} ${plan.ctx.design.inputs.enclosureRating}${e.d ? `, DEPTH ${Math.round(e.d)} mm` : ''}${e.estimated ? ' (SIZE ESTIMATED)' : ''}`,
          'HATCHED = SLOTTED WIRE DUCT (40 mm). 35 mm DIN RAIL. DASHED OUTLINE = ESTIMATED DIMENSIONS (*).',
          'KEEP 25 mm (1") MIN. FROM DUCT TO DEVICE TERMINALS; VERIFY VFD/POWER SUPPLY HEAT CLEARANCES.',
          ...(L.unplaced.length ? [`NOT ON BACK PANEL: ${L.unplaced.map((u) => `${u.tag} (${u.reason})`).join(', ')}`] : []),
        ].map((t, i) => <Txt key={i} x={ox + e.w * s + 12} y={AREA_B - 18 + i * 3.6} size={2.3} maxW={LX - (ox + e.w * s + 12) - 4 + 120}>{t}</Txt>)}
        {(L.overflow || L.door.overflow) && (
          <g>
            <rect x={ox + e.w * s + 10} y={oy} width={LX - (ox + e.w * s) - 16} height={14} strokeWidth={0.6} />
            <Txt x={ox + e.w * s + 13} y={oy + 5} size={2.8} bold>WARNING: LAYOUT OVERFLOW</Txt>
            <Txt x={ox + e.w * s + 13} y={oy + 9.5} size={2.2} maxW={LX - (ox + e.w * s) - 22}>COMPONENTS DO NOT FIT — LARGER ENCLOSURE NEEDED</Txt>
          </g>
        )}
      </g>
      {/* legend */}
      <g>
        <Txt x={LX} y={AREA.y + 7} size={3} bold>PARTS LEGEND</Txt>
        <Line x1={LX} y1={AREA.y + 10} x2={AREA_R - 2} y2={AREA.y + 10} w={LW} />
        <Txt x={LX} y={AREA.y + 13.4} size={2.3} bold>TAG</Txt>
        <Txt x={LX + 22} y={AREA.y + 13.4} size={2.3} bold>PART NUMBER</Txt>
        <Txt x={AREA_R - 3} y={AREA.y + 13.4} size={2.3} bold anchor="end">W x H mm</Txt>
        <Line x1={LX} y1={AREA.y + 15} x2={AREA_R - 2} y2={AREA.y + 15} w={LW_THIN} />
        {rows.slice(0, maxRows).map((r, i) => (
          <g key={i}>
            <Txt x={LX} y={AREA.y + 18.6 + i * rowH} size={2.3} mono bold maxW={21}>{r.tag}</Txt>
            <Txt x={LX + 22} y={AREA.y + 18.6 + i * rowH} size={2.3} mono maxW={68}>{r.pn || '—'}</Txt>
            <Txt x={AREA_R - 3} y={AREA.y + 18.6 + i * rowH} size={2.3} mono anchor="end">{r.size}</Txt>
          </g>
        ))}
        {rows.length > maxRows && <Txt x={LX} y={AREA.y + 18.6 + maxRows * rowH} size={2.3} italic>{`+${rows.length - maxRows} MORE — SEE BILL OF MATERIALS`}</Txt>}
        <Txt x={LX} y={AREA_B - 3} size={2.2} italic>* ESTIMATED — CONFIRM WITH DATASHEET</Txt>
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Door
// ---------------------------------------------------------------------------

function DoorDevice({ d, x, y, s, detail }: { d: DoorItem; x: number; y: number; s: number; detail: boolean }) {
  if (d.kind === 'hmi') {
    return (
      <g>
        <rect x={x - (d.w * s) / 2} y={y - (d.h * s) / 2} width={d.w * s} height={d.h * s} strokeWidth={LW} rx={0.8} />
        <rect x={x - (d.w * s) / 2 + 2} y={y - (d.h * s) / 2 + 2} width={d.w * s - 4} height={d.h * s - 4} strokeWidth={LW_THIN} />
        <Txt x={x} y={y + 1} size={2.5} mono bold anchor="middle">{d.tag}</Txt>
      </g>
    );
  }
  const r = (d.w / 2) * s;
  const plateW = (d.kind === 'estop' ? 60 : 30) * s;
  const plateH = (d.kind === 'estop' ? 60 : 12) * s;
  return (
    <g>
      {d.kind === 'estop' && <circle cx={x} cy={y} r={plateW / 2} strokeWidth={LW_THIN} />}
      {d.kind !== 'estop' && detail && (
        <g>
          <rect x={x - plateW / 2} y={y - r - plateH - 1.2 * s * 4} width={plateW} height={plateH} strokeWidth={LW_THIN} fill="#fff" />
          {d.legend.slice(0, 2).map((l, i, arr) => (
            <Txt key={i} x={x} y={y - r - 1.2 * s * 4 - plateH / 2 + 0.9 + (arr.length === 2 ? (i === 0 ? -1.5 : 1.5) : 0)} size={arr.length === 2 ? 2.0 : 2.3} bold anchor="middle" maxW={plateW - 1.2}>{l}</Txt>
          ))}
        </g>
      )}
      <circle cx={x} cy={y} r={r} strokeWidth={LW} fill="#fff" />
      {d.kind === 'estop' && <circle cx={x} cy={y} r={r * 0.62} strokeWidth={LW_THIN} />}
      {d.kind === 'pilot' && <>
        <Line x1={x - r * 0.5} y1={y - r * 0.5} x2={x + r * 0.5} y2={y + r * 0.5} w={LW_THIN} />
        <Line x1={x - r * 0.5} y1={y + r * 0.5} x2={x + r * 0.5} y2={y - r * 0.5} w={LW_THIN} />
      </>}
      {d.kind === 'selector' && <rect x={x - r * 0.18} y={y - r * 0.7} width={r * 0.36} height={r * 1.4} strokeWidth={LW_THIN} />}
      {detail && d.kind === 'estop' && (
        <>
          <Txt x={x} y={y - (plateW / 2 + r) / 2 + 0.8} size={2.2} bold anchor="middle">EMERGENCY</Txt>
          <Txt x={x} y={y + (plateW / 2 + r) / 2 + 0.8} size={2.2} bold anchor="middle">STOP</Txt>
        </>
      )}
      <Txt x={x} y={y + (d.kind === 'estop' ? plateW / 2 + (detail ? 3.4 : 2.8) : r + (detail ? 3.4 : 3.0))} size={detail ? 2.5 : 2.2} mono bold anchor="middle">{d.tag}</Txt>
      {detail && d.color && d.kind !== 'estop' && <Txt x={x} y={y + r + 6.6} size={2.2} anchor="middle">{d.color}</Txt>}
    </g>
  );
}

export function DoorLayoutSheet({ plan }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const D = plan.layout.door;
  const s = doorScale(plan);
  const ox = AREA.x + 30, oy = AREA.y + 14;
  const ops = D.items.filter((d) => d.kind !== 'hmi');
  const dis = plan.model.disconnect;
  // detail of the operator station
  const minX = Math.min(...ops.map((d) => d.cx - 35)), maxX = Math.max(...ops.map((d) => d.cx + 35));
  const minY = Math.min(...ops.map((d) => d.cy - (d.kind === 'estop' ? 40 : 35))), maxY = Math.max(...ops.map((d) => d.cy + (d.kind === 'estop' ? 40 : 30)));
  const DX0 = ox + D.w * s + 24;
  const tableRows = D.items.length;
  const tableH = 12 + tableRows * 4.4;
  const availW = AREA_R - DX0 - 4, availH = AREA_B - oy - tableH - 14;
  const ds = ops.length ? niceScale(Math.min(1, availW / (maxX - minX), availH / (maxY - minY))) : 1;
  const dox = DX0 + (availW - (maxX - minX) * ds) / 2 - minX * ds;
  const doy = oy + 6 - minY * ds;
  const TY = AREA_B - tableH;
  return (
    <g>
      <Txt x={ox} y={AREA.y + 7} size={3.2} bold>{`DOOR LAYOUT (FRONT VIEW) — SCALE ${scaleText(s)}`}</Txt>
      <rect x={ox} y={oy} width={D.w * s} height={D.h * s} strokeWidth={0.6} rx={1.2} />
      <rect x={ox + 3} y={oy + 3} width={D.w * s - 6} height={D.h * s - 6} strokeWidth={LW_THIN} rx={0.8} strokeDasharray="1.5 1" />
      {[0.15, 0.85].map((f) => <rect key={f} x={ox - 1.6} y={oy + D.h * s * f - 4} width={1.6} height={8} strokeWidth={LW_THIN} />)}
      <Txt x={ox - 3} y={oy + D.h * s * 0.5} size={2.2} anchor="middle" rotate={-90}>HINGE SIDE</Txt>
      {/* latch + disconnect handle */}
      <rect x={ox + D.w * s - 6} y={oy + D.h * s * 0.62} width={3} height={10} strokeWidth={LW_THIN} />
      {dis && (
        <g>
          <circle cx={ox + D.w * s - 14} cy={oy + D.h * s * 0.45} r={5} strokeWidth={LW} />
          <rect x={ox + D.w * s - 15} y={oy + D.h * s * 0.45 - 6} width={2} height={12} strokeWidth={LW_THIN} fill="#fff" />
          <Txt x={ox + D.w * s - 14} y={oy + D.h * s * 0.45 + 9} size={2.2} mono bold anchor="middle">{dis.tag}</Txt>
          <Txt x={ox + D.w * s - 14} y={oy + D.h * s * 0.45 + 12} size={2.0} anchor="middle">HANDLE</Txt>
        </g>
      )}
      {D.items.map((d) => <DoorDevice key={d.tag} d={d} x={ox + d.cx * s} y={oy + d.cy * s} s={s} detail={false} />)}
      {ops.length > 0 && (
        <g>
          <rect x={ox + (minX - 5) * s} y={oy + (minY - 5) * s} width={(maxX - minX + 10) * s} height={(maxY - minY + 10) * s} strokeWidth={LW_THIN} strokeDasharray="2 1" />
          <Txt x={ox + (minX - 5) * s} y={oy + (minY - 5) * s - 1.2} size={2.3} bold>DETAIL A</Txt>
        </g>
      )}
      <Dim x1={ox} y1={oy + D.h * s + 7} x2={ox + D.w * s} y2={oy + D.h * s + 7} text={`${Math.round(D.w)} mm (${inch(D.w)})`} />
      <Dim x1={ox - 9} y1={oy} x2={ox - 9} y2={oy + D.h * s} text={`${Math.round(D.h)} mm (${inch(D.h)})`} vertical />

      {ops.length > 0 && (
        <g>
          <Txt x={DX0} y={AREA.y + 7} size={3.2} bold>{`DETAIL A — OPERATOR STATION, SCALE ${scaleText(ds)}`}</Txt>
          {ops.map((d) => <DoorDevice key={d.tag} d={d} x={dox + d.cx * ds} y={doy + d.cy * ds} s={ds} detail />)}
        </g>
      )}

      {/* legend table */}
      <g>
        <Txt x={DX0} y={TY + 3} size={3} bold>LEGEND PLATES & OPERATOR DEVICES</Txt>
        <Line x1={DX0} y1={TY + 5} x2={AREA_R - 2} y2={TY + 5} w={LW} />
        {['TAG', 'LEGEND', 'COLOR', 'PART NUMBER'].map((h, i) => <Txt key={h} x={DX0 + [0, 18, 80, 104][i]} y={TY + 8.6} size={2.3} bold>{h}</Txt>)}
        <Line x1={DX0} y1={TY + 10} x2={AREA_R - 2} y2={TY + 10} w={LW_THIN} />
        {D.items.map((d, i) => (
          <g key={d.tag}>
            <Txt x={DX0} y={TY + 13.6 + i * 4.4} size={2.3} mono bold>{d.tag}</Txt>
            <Txt x={DX0 + 18} y={TY + 13.6 + i * 4.4} size={2.3} maxW={60}>{d.kind === 'hmi' ? 'HMI' : d.legend.join(' ')}</Txt>
            <Txt x={DX0 + 80} y={TY + 13.6 + i * 4.4} size={2.3} maxW={22}>{d.color || '—'}</Txt>
            <Txt x={DX0 + 104} y={TY + 13.6 + i * 4.4} size={2.3} mono maxW={AREA_R - DX0 - 108}>{d.partNumber}</Txt>
          </g>
        ))}
      </g>
      <Txt x={ox} y={AREA_B - 2} size={2.2} italic>22 mm OPERATORS ON 60 x 75 mm GRID; E-STOP WITH YELLOW 60 mm LEGEND (NFPA 79 10.7). VERIFY DOOR CUTOUTS AGAINST DATASHEETS.</Txt>
    </g>
  );
}
