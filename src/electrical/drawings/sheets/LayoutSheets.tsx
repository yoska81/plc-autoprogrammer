/** Panel (backplate) layout and door layout, drawn to scale. */
import type { DoorItem, PlacedItem } from '../../derive';
import { AREA, AREA_B, AREA_R, LW, LW_THIN, textWidth, wrapText } from '../geometry';
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
const mmIn = (mm: number) => `${Math.round(mm)} (${inch(mm)})`;

/** BOM item balloon. */
function Balloon({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={2.1} fill="#fff" strokeWidth={LW_THIN} />
      <Txt x={x} y={y + 0.7} size={n > 99 ? 1.5 : 1.9} anchor="middle" bold>{n}</Txt>
    </g>
  );
}

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
        : <ItemLabel x={x} y={y} w={w} h={h} label={it.label} pn={isTb ? '' : it.partNumber} strip={isTb} />}
    </g>
  );
}

function ItemLabel({ x, y, w, h, label, pn, strip }: { x: number; y: number; w: number; h: number; label: string; pn: string; strip?: boolean }) {
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
  // a short terminal strip: across the terminals a turned label would cross every terminal line, so it
  // goes just below the strip (its balloon is above)
  if (strip) {
    const sw = textWidth(label, 2.0, true);
    return (
      <g>
        <rect x={x + w / 2 - sw / 2 - 0.4} y={y + h + 0.3} width={sw + 0.8} height={2.6} fill="#fff" stroke="none" />
        <Txt x={x + w / 2} y={y + h + 2.4} size={2.0} mono bold anchor="middle">{label}</Txt>
      </g>
    );
  }
  // vertical label for narrow parts, centred on the part by its own size; none when it would be
  // unreadably small (slim relays at a small scale — the balloon and the callout table name them)
  const fs = Math.min(size, w - 0.4);
  if (fs < 0.9) return null;
  return <Txt x={x + w / 2 + fs * 0.35} y={y + h / 2} size={fs} mono bold anchor="middle" rotate={-90} maxW={h - 1}>{label}</Txt>;
}

function PanelNotes({ plan, x, w, y }: { plan: DrawingPlan; x: number; w: number; y: number }) {
  const L = plan.layout;
  const e = L.enclosure, bp = L.backplate;
  const duct = plan.model.rc.find((c) => c.category === 'wireDuct');
  const blocks: { title: string; lines: string[]; box?: boolean }[] = [
    { title: 'ENCLOSURE', lines: [`${e.tag ?? '—'} ${e.partNumber ?? '(NOT SPECIFIED)'} — ${plan.ctx.design.inputs.enclosureRating}`, `${inch(e.w)} W x ${inch(e.h)} H${e.d ? ` x ${inch(e.d)} D` : ''} (${Math.round(e.w)} x ${Math.round(e.h)}${e.d ? ` x ${Math.round(e.d)}` : ''} mm)${e.estimated ? ' — SIZE ESTIMATED' : ''}`] },
    { title: 'BACK PANEL', lines: [`${bp.tag ? `${bp.tag} ${bp.partNumber}` : 'PER ENCLOSURE DATA'}${bp.estimated ? ' (SIZE ESTIMATED)' : ''}`, `${inch(bp.w)} x ${inch(bp.h)} (${Math.round(bp.w)} x ${Math.round(bp.h)} mm)`] },
    { title: 'NOTES', lines: [
      `HATCHED = SLOTTED WIRE DUCT${duct ? ` ${duct.partNumber}` : ''}. 35 mm DIN RAIL. DASHED OUTLINE / * = ESTIMATED DIMENSIONS.`,
      'KEEP 25 mm (1") MIN. FROM DUCT TO DEVICE TERMINALS; VERIFY VFD / POWER SUPPLY HEAT CLEARANCES.',
      'GROUND BAR BOLTED TO BACK PANEL; BOND BACK PANEL AND DOOR TO ENCLOSURE.',
      ...(L.unplaced.length ? [`NOT ON BACK PANEL: ${L.unplaced.map((u) => `${u.tag} (${u.reason})`).join(', ')}`] : []),
    ] },
  ];
  if (L.notFit.length) blocks.push({ title: 'DOES NOT FIT — NOT DRAWN', box: true, lines: [...L.notFit.map((n) => `${n.tag}  ${n.partNumber}  ${Math.round(n.w)} x ${Math.round(n.h)} mm`), 'USE A LARGER ENCLOSURE OR REARRANGE.'] });
  let yy = y;
  return (
    <g>
      {blocks.map((b) => {
        const lines = b.lines.flatMap((l) => wrapText(l, w - (b.box ? 4 : 0), 2.3));
        const y0 = yy;
        yy += 4.4 + lines.length * 3.3 + 4;
        return (
          <g key={b.title}>
            {b.box && <rect x={x - 1.5} y={y0 - 4} width={w} height={lines.length * 3.3 + 7.5} strokeWidth={0.6} />}
            <Txt x={x} y={y0} size={2.6} bold>{b.title}</Txt>
            {lines.map((l, i) => <Txt key={i} x={x} y={y0 + 4.2 + i * 3.3} size={2.3} maxW={w - (b.box ? 4 : 0)}>{l}</Txt>)}
          </g>
        );
      })}
    </g>
  );
}

export function PanelLayoutSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const L = plan.layout;
  const s = panelScale(plan);
  const e = L.enclosure;
  const ox = AREA.x + 30, oy = AREA.y + 14;
  const bp = L.backplate;
  const pid = `hatch${sheet.n}`;
  const legend = [...L.items].sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  const LX = 304;
  const CHX = ox + e.w * s + 3;
  const NX = Math.max(CHX + 26, 150);
  const rowH = 4.2;
  const maxRows = Math.floor((AREA_B - (AREA.y + 14) - 12) / rowH);
  const itemOf = (tag: string, pn?: string) => plan.bomItem.get(tag) ?? plan.bomItem.get(tag.replace(/\.\d+$/, '').replace(/\s*\(.*$/, '')) ?? (pn ? plan.bomItem.get(`pn:${pn}`) : undefined);
  // callout balloons above each part, staggered upward when neighbours are too close (leader to the part)
  const side = L.items.flatMap((it) => (it.sub ?? []).slice(1).map((p, k) => ({ n: itemOf(it.label.split('/')[k + 1] ?? p.tag, p.partNumber), ax: ox + p.x * s, top: oy + (p.y + p.h / 2) * s })))
    .filter((r): r is { n: number; ax: number; top: number } => r.n !== undefined)
    .map((r) => ({ ...r, bx: r.ax - 2.3, by: r.top }));
  const reqs = L.items.flatMap((it) => (it.sub ?? [it]).slice(0, 1).map((p, i) => ({ n: itemOf(it.sub ? it.label.split('/')[i] ?? p.tag : it.tag, p.partNumber), ax: ox + (p.x + p.w / 2) * s, top: oy + it.y * s })))
    .filter((r): r is { n: number; ax: number; top: number } => r.n !== undefined)
    .sort((a, b) => a.top - b.top || a.ax - b.ax);
  const balloons: { n: number; ax: number; top: number; bx: number; by: number }[] = [...side];
  for (const r of reqs) {
    let lvl = 0;
    const bx = r.ax;
    while (balloons.some((b) => !side.includes(b) && Math.abs(b.top - r.top) < 1 && Math.abs(b.bx - bx) < 4.5 && Math.abs(b.by - (r.top - 2.4 - lvl * 4.6)) < 1)) lvl++;
    balloons.push({ ...r, bx, by: r.top - 2.4 - lvl * 4.6 });
  }
  const rows = legend.flatMap((it) => (it.sub ?? [it]).map((p, i) => {
    const tag = it.sub ? it.label.split('/')[i] : it.label;
    return { tag, item: itemOf(it.sub ? tag : it.tag, p.partNumber), pn: p.partNumber, size: `${Math.round(p.w)} x ${Math.round(p.h)}${p.estimated ? '*' : ''}` };
  }));
  // rails & ducts schedule (positions from the top-left corner of the back panel)
  const sched = [
    ...L.rails.map((r, i) => ({ id: `R${i + 1}`, type: '35 mm DIN RAIL', len: r.w, pos: `Y ${mmIn(r.y + r.h / 2 - bp.y)}`, x: r.x, y: r.y + r.h / 2 })),
    ...L.ducts.map((d, i) => ({ id: `D${i + 1}`, type: `DUCT ${Math.round(Math.min(d.w, d.h))} mm ${d.orientation === 'h' ? 'HORIZ.' : 'VERT.'}`, len: Math.max(d.w, d.h), pos: d.orientation === 'h' ? `Y ${mmIn(d.y + d.h / 2 - bp.y)}` : `X ${mmIn(d.x + d.w / 2 - bp.x)}`, x: d.x, y: d.y + (d.orientation === 'h' ? d.h / 2 : 6) })),
  ];
  const SY = AREA_B - 6 - sched.length * 3.4;
  const chain = [...L.rails.map((r, i) => ({ id: `R${i + 1}`, y: r.y + r.h / 2 })), ...L.ducts.filter((d) => d.orientation === 'h').map((d) => ({ id: `D${L.ducts.indexOf(d) + 1}`, y: d.y + d.h / 2 }))].sort((a, b) => a.y - b.y);
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
      {balloons.map((b, i) => (
        <g key={`bl${i}`}>
          {b.by < b.top - 2.2 && <Line x1={b.ax} y1={b.top} x2={b.bx} y2={b.by + 2.1} w={0.12} />}
          <Balloon x={b.bx} y={b.by} n={b.n} />
        </g>
      ))}
      {/* rail / duct identifiers */}
      {sched.map((r) => {
        // rail tags sit just left of the rail (over the vertical duct): devices start at the rail's left end
        const w = r.id.length * 1.3 + 1;
        const x = r.id.startsWith('R') ? ox + r.x * s - w - 0.4 : ox + r.x * s + 0.3;
        return (
          <g key={r.id}>
            <rect x={x} y={oy + r.y * s - 1.3} width={w} height={2.6} fill="#fff" strokeWidth={0.1} />
            <Txt x={x + 0.5} y={oy + r.y * s + 0.7} size={1.8} mono bold>{r.id}</Txt>
          </g>
        );
      })}
      {/* ordinate dimensions of rail / duct centrelines from the top of the back panel */}
      <Line x1={CHX} y1={oy + bp.y * s} x2={CHX + 4} y2={oy + bp.y * s} w={0.12} />
      <Txt x={CHX + 5} y={oy + bp.y * s + 0.7} size={1.8} mono>0</Txt>
      {chain.map((c, i) => {
        const yy = oy + c.y * s;
        const prev = i > 0 ? oy + chain[i - 1].y * s : -99;
        const ty = Math.max(yy + 0.7, prev + 3.0 + 0.7);
        return (
          <g key={c.id}>
            <Line x1={ox + (bp.x + bp.w) * s} y1={yy} x2={CHX + 4} y2={yy} w={0.1} dash="0.6 0.6" />
            <Txt x={CHX + 5} y={ty} size={1.8} mono>{`${c.id} ${mmIn(c.y - bp.y)}`}</Txt>
          </g>
        );
      })}
      {/* dimensions */}
      <Dim x1={ox} y1={oy + e.h * s + 7} x2={ox + e.w * s} y2={oy + e.h * s + 7} text={`ENCLOSURE ${inch(e.w)} (${Math.round(e.w)} mm)`} />
      <Line x1={ox} y1={oy + e.h * s + 1} x2={ox} y2={oy + e.h * s + 9} w={0.12} />
      <Line x1={ox + e.w * s} y1={oy + e.h * s + 1} x2={ox + e.w * s} y2={oy + e.h * s + 9} w={0.12} />
      <Dim x1={ox - 8} y1={oy} x2={ox - 8} y2={oy + e.h * s} text={`${inch(e.h)} (${Math.round(e.h)} mm)`} vertical />
      <Line x1={ox - 10} y1={oy} x2={ox - 1} y2={oy} w={0.12} />
      <Line x1={ox - 10} y1={oy + e.h * s} x2={ox - 1} y2={oy + e.h * s} w={0.12} />
      <Dim x1={ox + bp.x * s} y1={oy + e.h * s + 15} x2={ox + (bp.x + bp.w) * s} y2={oy + e.h * s + 15} text={`BACK PANEL ${inch(bp.w)} x ${inch(bp.h)} (${Math.round(bp.w)} x ${Math.round(bp.h)} mm)${bp.estimated ? ' EST.' : ''}`} />
      <Line x1={ox + bp.x * s} y1={oy + (bp.y + bp.h) * s + 1} x2={ox + bp.x * s} y2={oy + e.h * s + 17} w={0.12} />
      <Line x1={ox + (bp.x + bp.w) * s} y1={oy + (bp.y + bp.h) * s + 1} x2={ox + (bp.x + bp.w) * s} y2={oy + e.h * s + 17} w={0.12} />
      <PanelNotes plan={plan} x={NX} w={LX - NX - 6} y={oy + 2} />
      {/* DIN rail & duct schedule */}
      <g>
        <Txt x={NX} y={SY - 8} size={2.6} bold>DIN RAIL & WIRE DUCT SCHEDULE</Txt>
        {['ID', 'TYPE', 'LENGTH mm (in)', 'CENTRELINE mm (in)'].map((h, i) => <Txt key={h} x={NX + [0, 8, 40, 64][i]} y={SY - 3.6} size={1.9} bold>{h}</Txt>)}
        <Line x1={NX} y1={SY - 2.4} x2={LX - 6} y2={SY - 2.4} w={LW_THIN} />
        {sched.map((r, i) => (
          <g key={r.id}>
            <Txt x={NX} y={SY + 0.8 + i * 3.4} size={1.9} mono bold>{r.id}</Txt>
            <Txt x={NX + 8} y={SY + 0.8 + i * 3.4} size={1.9} maxW={31}>{r.type}</Txt>
            <Txt x={NX + 40} y={SY + 0.8 + i * 3.4} size={1.9} mono maxW={23}>{mmIn(r.len)}</Txt>
            <Txt x={NX + 64} y={SY + 0.8 + i * 3.4} size={1.9} mono maxW={LX - NX - 70}>{r.pos}</Txt>
          </g>
        ))}
      </g>
      {/* legend */}
      <g>
        <Txt x={LX} y={AREA.y + 7} size={3} bold>COMPONENT CALLOUTS</Txt>
        <Line x1={LX} y1={AREA.y + 10} x2={AREA_R - 2} y2={AREA.y + 10} w={LW} />
        <Txt x={LX} y={AREA.y + 13.4} size={2.1} bold>ITEM</Txt>
        <Txt x={LX + 10} y={AREA.y + 13.4} size={2.3} bold>TAG</Txt>
        <Txt x={LX + 30} y={AREA.y + 13.4} size={2.3} bold>PART NUMBER</Txt>
        <Txt x={AREA_R - 3} y={AREA.y + 13.4} size={2.3} bold anchor="end">W x H mm</Txt>
        <Line x1={LX} y1={AREA.y + 15} x2={AREA_R - 2} y2={AREA.y + 15} w={LW_THIN} />
        {rows.slice(0, maxRows).map((r, i) => (
          <g key={i}>
            {r.item !== undefined && <Balloon x={LX + 3} y={AREA.y + 17.9 + i * rowH} n={r.item} />}
            <Txt x={LX + 10} y={AREA.y + 18.6 + i * rowH} size={2.3} mono bold maxW={19}>{r.tag}</Txt>
            <Txt x={LX + 30} y={AREA.y + 18.6 + i * rowH} size={2.3} mono maxW={58}>{r.pn || '—'}</Txt>
            <Txt x={AREA_R - 3} y={AREA.y + 18.6 + i * rowH} size={2.3} mono anchor="end">{r.size}</Txt>
          </g>
        ))}
        {rows.length > maxRows && <Txt x={LX} y={AREA.y + 18.6 + maxRows * rowH} size={2.3} italic>{`+${rows.length - maxRows} MORE — SEE BILL OF MATERIALS`}</Txt>}
        <Txt x={LX} y={AREA_B - 3} size={2.0} italic maxW={AREA_R - LX - 3}>BALLOON = BILL OF MATERIALS ITEM. * ESTIMATED — CONFIRM WITH DATASHEET</Txt>
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
            // line spacing and size follow the plate height (small detail scales give a 4–6 mm plate)
            <Txt key={i} x={x} y={y - r - 1.2 * s * 4 - plateH / 2 + (arr.length === 2 ? (i === 0 ? -0.08 : 0.42) * plateH : 0.3 * Math.min(2.3, plateH * 0.55))} size={arr.length === 2 ? Math.min(2.0, plateH * 0.36) : Math.min(2.3, plateH * 0.55)} bold anchor="middle" maxW={plateW - 1.2}>{l}</Txt>
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
  const hd = plan.layout.door.handle;
  // detail of the operator station
  const minX = Math.min(...ops.map((d) => d.cx - 35)), maxX = Math.max(...ops.map((d) => d.cx + 35));
  const minY = Math.min(...ops.map((d) => d.cy - (d.kind === 'estop' ? 40 : 35))), maxY = Math.max(...ops.map((d) => d.cy + (d.kind === 'estop' ? 40 : 30)));
  const DX0 = ox + D.w * s + 24;
  const tableRows = D.items.length;
  const tableH = 15 + tableRows * 4.4;
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
      {hd && (
        <g>
          <circle cx={ox + hd.cx * s} cy={oy + hd.cy * s} r={Math.max(4, 30 * s)} strokeWidth={LW} />
          <rect x={ox + hd.cx * s - 1} y={oy + hd.cy * s - Math.max(5, 36 * s)} width={2} height={2 * Math.max(5, 36 * s)} strokeWidth={LW_THIN} fill="#fff" />
          {/* below the end of the handle bar (it is longer than the escutcheon radius at large scales) */}
          <Txt x={ox + hd.cx * s} y={oy + hd.cy * s + Math.max(5, 36 * s, 30 * s + 1) + 2.6} size={2.2} mono bold anchor="middle">{hd.tag}</Txt>
          <Txt x={ox + hd.cx * s} y={oy + hd.cy * s + Math.max(5, 36 * s, 30 * s + 1) + 5.6} size={2.0} anchor="middle">HANDLE</Txt>
        </g>
      )}
      {D.items.map((d) => <DoorDevice key={d.tag} d={d} x={ox + d.cx * s} y={oy + d.cy * s} s={s} detail={false} />)}
      {ops.length > 0 && (
        <g>
          {/* down past the tags printed under the lowest devices */}
          <rect x={ox + (minX - 5) * s} y={oy + (minY - 5) * s} width={(maxX - minX + 10) * s} height={(maxY - minY + 10) * s + 3.5} strokeWidth={LW_THIN} strokeDasharray="2 1" />
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
        {['TAG', 'LEGEND', 'COLOR', 'CENTRE X / Y FROM LOWER-LEFT, mm (in)', 'PART NUMBER'].map((h, i) => <Txt key={h} x={DX0 + [0, 16, 60, 80, 152][i]} y={TY + 8.6} size={2.1} bold>{h}</Txt>)}
        <Line x1={DX0} y1={TY + 10} x2={AREA_R - 2} y2={TY + 10} w={LW_THIN} />
        {D.items.map((d, i) => (
          <g key={d.tag}>
            <Txt x={DX0} y={TY + 13.6 + i * 4.4} size={2.3} mono bold>{d.tag}</Txt>
            <Txt x={DX0 + 16} y={TY + 13.6 + i * 4.4} size={2.2} maxW={42}>{d.kind === 'hmi' ? 'HMI' : d.legend.join(' ')}</Txt>
            <Txt x={DX0 + 60} y={TY + 13.6 + i * 4.4} size={2.2} maxW={18}>{d.color || '—'}</Txt>
            <Txt x={DX0 + 80} y={TY + 13.6 + i * 4.4} size={2.1} mono maxW={70}>{`X ${mmIn(d.cx)}  Y ${mmIn(D.h - d.cy)}`}</Txt>
            <Txt x={DX0 + 152} y={TY + 13.6 + i * 4.4} size={2.2} mono maxW={AREA_R - DX0 - 155}>{d.partNumber}</Txt>
          </g>
        ))}
      </g>
      {wrapText('22 mm OPERATORS ON 60 x 75 mm GRID; E-STOP WITH YELLOW 60 mm LEGEND (NFPA 79 10.7). VERIFY DOOR CUTOUTS AGAINST DATASHEETS.', DX0 - ox - 8, 2.2).map((l, i, arr) => (
        <Txt key={i} x={ox} y={AREA_B - 2 - (arr.length - 1 - i) * 3} size={2.2} italic>{l}</Txt>
      ))}
    </g>
  );
}
