/** Machine layout sheet: plan view with the cabinet, junction boxes, devices, manifolds and cable routes, to scale. */
import { AREA, AREA_B, AREA_R, LW, LW_HEAVY, LW_THIN } from '../geometry';
import type { DrawingPlan, PlannedSheet } from '../plan';
import { Txt } from '../symbols';
import { LAYOUT_DH as DH, LAYOUT_DW, machineLayoutScale } from '../scale';
import { CABINET, AIR } from '../../layout/types';

const X0 = AREA.x + 6, Y0 = AREA.y + 12;
const TX = X0 + LAYOUT_DW + 8, TW = AREA_R - 4 - TX;
const ROW = 4.2;

const ROUTE: Record<string, { dash?: string; label: string }> = { tray: { label: 'CABLE TRAY' }, conduit: { dash: '3 1.5', label: 'CONDUIT' }, chain: { dash: '1 1', label: 'DRAG CHAIN' } };

export function MachineLayoutSheet({ plan }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const ml = plan.ctx.machineLayout;
  const denom = machineLayoutScale(plan);
  if (!ml || !denom) return null;
  const k = 1000 / denom; // mm on the sheet per metre
  const P = (x: number, y: number): [number, number] => [X0 + x * k, Y0 + y * k];
  const cables = plan.model.machine.cables;
  const jbs = new Set(plan.model.machine.jbs.map((j) => j.tag));
  const motors = new Set(plan.model.machine.devices.filter((d) => d.kind === 'motor').map((d) => d.tag));
  const items = Object.entries(ml.pos);
  const labelOf = (tag: string) => (tag === CABINET ? 'CONTROL CABINET' : tag === AIR ? 'AIR SUPPLY' : tag);
  // label above the symbol, else below, else further out: no two labels on top of each other
  const labelY = new Map<string, number>();
  const boxes = items.map(([tag, p]) => { const [x, y] = P(p.x, p.y); const r = tag === CABINET ? 5 : 2.4; return { x0: x - r, x1: x + r, y0: y - r, y1: y + r }; });
  for (const [tag, p] of [...items].sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x)) {
    const [x, y] = P(p.x, p.y);
    const w = labelOf(tag).length * 1.45 + 1, h = 3;
    const off = tag === CABINET ? 4.2 : 3;
    const cands = [y - off, y + off + 2, y - off - 3, y + off + 5, y - off - 6, y + off + 8];
    const fits = (ly: number) => !boxes.some((b) => x - w / 2 < b.x1 && x + w / 2 > b.x0 && ly - h < b.y1 && ly > b.y0);
    const ly = cands.find(fits) ?? cands[0];
    boxes.push({ x0: x - w / 2, x1: x + w / 2, y0: ly - h, y1: ly });
    labelY.set(tag, ly);
  }
  // scale bar: a round length close to a fifth of the drawing width
  const barM = [0.5, 1, 2, 5, 10, 20, 50].reduce((b, v) => (v * k <= LAYOUT_DW / 8 ? v : b), 0.5);
  const sy = Y0 + Math.min(DH, ml.sizeM.h * k) + 7;
  const rows = cables.slice(0, Math.floor((AREA_B - 30 - Y0) / ROW) - 1);
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>MACHINE LAYOUT — CABINET, JUNCTION BOXES, DEVICES AND CABLE ROUTES (PLAN VIEW)</Txt>
      <Txt x={AREA_R - 4} y={AREA.y + 7} size={2.3} anchor="end" italic>{`SCALE 1:${denom}. CABLE LENGTHS INCLUDE +${ml.service.pct}% SLACK AND ${ml.service.endM} m AT EACH END. VERIFY ON SITE.`}</Txt>
      <rect x={X0} y={Y0} width={ml.sizeM.w * k} height={ml.sizeM.h * k} fill="#fff" strokeWidth={LW_THIN} />
      {ml.background && <image href={ml.background.dataUrl} x={X0} y={Y0} width={ml.background.wM * k} height={ml.background.hM * k} opacity={0.55} preserveAspectRatio="none" />}
      {ml.routes.map((r, i) => {
        const pts = r.pts.map(([x, y]) => P(x, y));
        const mid = pts[Math.floor((pts.length - 1) / 2)];
        return (
          <g key={i}>
            <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#000" strokeWidth={1.4} strokeDasharray={ROUTE[r.kind]?.dash} strokeLinejoin="round" opacity={0.45} />
            <Txt x={mid[0] + 1.5} y={mid[1] - 1.5} size={1.9} italic>{`R${i + 1} ${ROUTE[r.kind]?.label ?? r.kind}`}</Txt>
          </g>
        );
      })}
      {ml.manifolds.map((m) => {
        const [x, y] = P(m.x, m.y);
        return (
          <g key={m.tag}>
            {m.valves.map((v) => { const p = ml.pos[v]; if (!p) return null; const [vx, vy] = P(p.x, p.y); return <line key={v} x1={x} y1={y} x2={vx} y2={vy} strokeWidth={LW_THIN} strokeDasharray="1 1" />; })}
            <rect x={x - 3} y={y - 1.6} width={6} height={3.2} fill="#ddd" strokeWidth={LW} />
            <Txt x={x} y={y + 4.6} size={2} bold anchor="middle">{`${m.tag} (${m.valves.length})`}</Txt>
          </g>
        );
      })}
      {ml.remoteIo.map((m) => { const [x, y] = P(m.x, m.y); return (
        <g key={m.tag}><rect x={x - 2.2} y={y - 2.2} width={4.4} height={4.4} fill="#bbb" strokeWidth={LW} /><Txt x={x} y={y + 5.4} size={2} bold anchor="middle">{m.tag}</Txt></g>
      ); })}
      {items.map(([tag, p]) => {
        const [x, y] = P(p.x, p.y);
        const ly = labelY.get(tag) ?? y - 3;
        const shape = tag === CABINET ? <rect x={x - 5} y={y - 3} width={10} height={6} fill="#333" strokeWidth={LW_HEAVY} />
          : jbs.has(tag) ? <rect x={x - 2} y={y - 2} width={4} height={4} fill="#fff" strokeWidth={LW_HEAVY} />
          : motors.has(tag) ? <circle cx={x} cy={y} r={2.4} fill="#fff" strokeWidth={LW_HEAVY} />
          : tag === AIR ? <path d={`M ${x - 2} ${y + 1.6} L ${x} ${y - 2} L ${x + 2} ${y + 1.6} Z`} fill="#fff" strokeWidth={LW} />
          : <circle cx={x} cy={y} r={1.3} fill="#000" />;
        return <g key={tag}>{shape}<Txt x={x} y={ly} size={2.1} bold anchor="middle">{labelOf(tag)}</Txt></g>;
      })}
      {/* scale bar */}
      <g>
        {[0, 1, 2].map((i) => <rect key={i} x={X0 + i * barM * k} y={sy} width={barM * k} height={1.6} fill={i % 2 ? '#fff' : '#000'} strokeWidth={LW_THIN} />)}
        {[0, 1, 2, 3].map((i) => <Txt key={i} x={X0 + i * barM * k} y={sy + 4.6} size={2} anchor="middle">{`${+(i * barM).toFixed(1)} m`}</Txt>)}
        <Txt x={X0 + 3 * barM * k + 4} y={sy + 1.8} size={2}>{`(${+(3 * barM / 0.3048).toFixed(1)} ft)`}</Txt>
      </g>
      {/* cable lengths */}
      <Txt x={TX} y={Y0 + 2} size={2.6} bold>FIELD CABLE LENGTHS</Txt>
      {['CABLE', 'FROM', 'TO', 'LENGTH'].map((h, i) => <Txt key={h} x={TX + [0, 14, 52, 74][i]} y={Y0 + 2 + ROW * 1.4} size={2.1} bold>{h}</Txt>)}
      <line x1={TX} y1={Y0 + 2 + ROW * 1.7} x2={TX + TW} y2={Y0 + 2 + ROW * 1.7} strokeWidth={LW_THIN} />
      {rows.map((c, i) => {
        const y = Y0 + 2 + ROW * (2.6 + i);
        return (
          <g key={c.tag}>
            <Txt x={TX} y={y} size={2.1} mono>{c.tag}</Txt>
            <Txt x={TX + 14} y={y} size={2.1} maxW={36}>{c.from}</Txt>
            <Txt x={TX + 52} y={y} size={2.1} maxW={20}>{c.to}</Txt>
            <Txt x={TX + 74} y={y} size={2.1} maxW={TW - 74}>{c.length}</Txt>
          </g>
        );
      })}
      {cables.length > rows.length && <Txt x={TX} y={Y0 + 2 + ROW * (2.6 + rows.length)} size={2.1} italic>{`+ ${cables.length - rows.length} more — see CABLE SCHEDULE`}</Txt>}
      {ml.manifolds.length > 0 && (
        <g>
          {ml.manifolds.map((m, i) => <Txt key={m.tag} x={TX} y={AREA_B - 14 + i * 3.4 - (ml.manifolds.length - 1) * 3.4} size={2.1} maxW={TW}>{`${m.tag}: VALVE MANIFOLD, ${m.valves.length} STATIONS (${m.valves.join(', ')}) — PART TO BE SELECTED`}</Txt>)}
        </g>
      )}
      <Txt x={TX} y={AREA_B - 6} size={2} italic maxW={TW}>LENGTHS ALONG THE DRAWN ROUTES; SHORT HOPS POINT TO POINT.</Txt>
    </g>
  );
}
