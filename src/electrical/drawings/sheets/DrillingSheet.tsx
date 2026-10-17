/** Machining sheets: back-panel drilling and door cutouts (lower-left datum, ordinate dimensions in inch [mm]). */
import { dualDim, dualSize, type DrillCutout, type DrillHole } from '../../derive';
import { AREA, AREA_B, AREA_R, LW, LW_HEAVY, LW_THIN, textWidth, wrapText } from '../geometry';
import { DRILL_ROWS_CONT, type DrawingPlan, type DrillRow, type PlannedSheet, type SheetSpec } from '../plan';
import { drillSheetScale, scaleText } from '../scale';
import { Line, Txt } from '../symbols';

const TX = 296; // table x
const ROW = 3.35;

export function DrillingSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'drill' }>;
  return sp.drawing ? <DrillDrawing plan={plan} sp={sp} /> : <DrillTables sp={sp} />;
}

function DrillDrawing({ plan, sp }: { plan: DrawingPlan; sp: Extract<SheetSpec, { kind: 'drill' }> }) {
  const d = sp.drill;
  const s = drillSheetScale(d);
  const ox = AREA.x + 30;
  const top = AREA.y + 14;
  const oyB = top + d.h * s; // paper y of the datum (Y = 0)
  const px = (x: number) => ox + x * s;
  const py = (y: number) => oyB - y * s;
  // ordinate values (skip labels that would collide on paper)
  const xs = [...new Set([0, d.w, ...d.holes.map((h) => h.x), ...d.cutouts.map((c) => c.x)])].sort((a, b) => a - b);
  const ys = [...new Set([0, d.h, ...d.holes.map((h) => h.y), ...d.cutouts.map((c) => c.y)])].sort((a, b) => a - b);
  const thin = (vals: number[], gap: number) => vals.filter((v, i, a) => i === 0 || i === a.length - 1 || (v - a[i - 1]) * s >= gap);
  const xsShown = thin(xs, 2.7), ysShown = thin(ys, 2.9);
  const yb = oyB + 3;
  // back-panel context: ducts and rails (reference only)
  const L = plan.layout;
  const bp = L.backplate;
  const ref = d.kind === 'backpanel';
  const notes = d.notes.flatMap((n) => wrapText(n, TX - ox - 10, 2.2));
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>{`${d.title} — ${d.part} — SCALE ${scaleText(s)} — DIMENSIONS IN INCHES [mm] FROM LOWER-LEFT DATUM`}</Txt>
      {ref && L.ducts.map((u, i) => <rect key={`d${i}`} x={px(u.x - bp.x)} y={py(bp.y + bp.h - u.y)} width={u.w * s} height={u.h * s} strokeWidth={0.12} strokeDasharray="1 0.8" />)}
      {ref && L.rails.map((r, i) => <rect key={`r${i}`} x={px(r.x - bp.x)} y={py(bp.y + bp.h - r.y)} width={r.w * s} height={r.h * s} strokeWidth={0.12} strokeDasharray="0.4 0.6" />)}
      {d.kind === 'door' && <rect x={px(0) + 3} y={py(d.h) + 3} width={d.w * s - 6} height={d.h * s - 6} strokeWidth={0.12} strokeDasharray="1 0.8" />}
      <rect x={px(0)} y={py(d.h)} width={d.w * s} height={d.h * s} strokeWidth={0.6} />
      {/* datum */}
      <circle cx={px(0)} cy={py(0)} r={1.4} strokeWidth={LW_THIN} />
      <path d={`M ${px(0)} ${py(0)} L ${px(0) + 1.4} ${py(0)} A 1.4 1.4 0 0 0 ${px(0)} ${py(0) - 1.4} Z`} fill="#000" stroke="none" />
      {placeHoleLabels(d.holes, px, py, s).map(({ h, corner }) => <HoleMark key={h.id} h={h} x={px(h.x)} y={py(h.y)} s={s} corner={corner} />)}
      {d.cutouts.map((c) => {
        const pl = c.template ? templateLabelPlace(c, d.cutouts, px, py, s, { x0: px(0) + 4.5, y0: py(d.h) + 4.5, x1: px(d.w) - 4.5, y1: py(0) - 4.5 }) : {};
        return <CutoutMark key={c.id} c={c} x={px(c.x)} y={py(c.y)} s={s} {...pl} />;
      })}
      {/* ordinate dimensions: X along the bottom, Y along the left */}
      {xsShown.map((v) => (
        <g key={`x${v}`}>
          <Line x1={px(v)} y1={oyB + 0.6} x2={px(v)} y2={yb + 1.5} w={0.12} />
          <Txt x={px(v) + 0.8} y={yb + 18.5} size={2.0} mono rotate={-90}>{dualDim(v)}</Txt>
        </g>
      ))}
      {ysShown.map((v) => (
        <g key={`y${v}`}>
          <Line x1={px(0) - 0.6} y1={py(v)} x2={px(0) - 3} y2={py(v)} w={0.12} />
          <Txt x={px(0) - 3.6} y={py(v) + 0.7} size={2.0} mono anchor="end">{dualDim(v)}</Txt>
        </g>
      ))}
      <Txt x={px(d.w) + 2} y={yb + 4} size={2.0}>X</Txt>
      <Txt x={px(0) - 3} y={py(d.h) - 2.5} size={2.0}>Y</Txt>
      {notes.map((n, i) => <Txt key={i} x={AREA.x + 6} y={AREA_B - 2 - (notes.length - 1 - i) * 3} size={2.2} maxW={TX - AREA.x - 14}>{n}</Txt>)}
      {/* code legend + hole table */}
      <CodeLegend sp={sp} />
    </g>
  );
}

/**
 * Where the two label lines of a template mark go: above or below it, left- or right-aligned to it —
 * the first placement inside the part (clear of the edge band) that touches no other cutout.
 */
function templateLabelPlace(c: DrillCutout, all: DrillCutout[], px: (v: number) => number, py: (v: number) => number, s: number, inner: { x0: number; y0: number; x1: number; y1: number }) {
  const x = px(c.x), y = py(c.y), rw = (c.w / 2) * s, rh = (c.h / 2) * s;
  const w = Math.max(textWidth(`${c.id} ${c.tag}`, 2.0, true) * 1.08, textWidth(c.template ?? '', 1.8));
  const others = all.filter((o) => o !== c).map((o) => ({ x0: px(o.x) - (o.w / 2) * s - 1, x1: px(o.x) + (o.w / 2) * s + 1, y0: py(o.y) - (o.h / 2) * s - 1, y1: py(o.y) + (o.h / 2) * s + 4 }));
  for (const labelBelow of [false, true]) for (const labelRight of [false, true]) {
    const b = { x0: labelRight ? x + rw - w : x - rw, x1: labelRight ? x + rw : x - rw + w, y0: labelBelow ? y + rh + 2.4 : y - rh - 6.8, y1: labelBelow ? y + rh + 7.2 : y - rh - 2.0 };
    const inside = b.x0 >= inner.x0 && b.x1 <= inner.x1 && b.y0 >= inner.y0 && b.y1 <= inner.y1;
    if (inside && !others.some((o) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1)) return { labelBelow, labelRight };
  }
  // nowhere free: above, shrunk to the room left before the edge band
  return { labelBelow: false, labelRight: false, labelMaxW: Math.max(8, inner.x1 - (x - rw)) };
}

type Corner = 'ne' | 'nw' | 'se' | 'sw';
const LABEL_H = 1.9;
/** Label box of a hole mark for a corner: right/left of the mark, above/below it. */
function labelBox(id: string, x: number, y: number, r: number, c: Corner) {
  const w = textWidth(id, 1.8, true) + 0.4;
  const x0 = c === 'ne' || c === 'se' ? x + r + 0.4 : x - r - 0.4 - w;
  const y0 = c === 'ne' || c === 'nw' ? y - r - LABEL_H + 0.1 : y + r + 0.1;
  return { x0, y0, x1: x0 + w, y1: y0 + LABEL_H };
}

/** Each hole's label at the first corner where it overlaps no label placed before it (close hole patterns). */
function placeHoleLabels(holes: DrillHole[], px: (v: number) => number, py: (v: number) => number, s: number): { h: DrillHole; corner: Corner }[] {
  const placed: ReturnType<typeof labelBox>[] = [];
  return holes.map((h) => {
    const r = Math.max(0.7, (h.dia / 2) * s);
    const boxes = (['ne', 'nw', 'se', 'sw'] as Corner[]).map((c) => ({ c, b: labelBox(h.id, px(h.x), py(h.y), r, c) }));
    const free = boxes.find(({ b }) => !placed.some((q) => b.x0 < q.x1 && q.x0 < b.x1 && b.y0 < q.y1 && q.y0 < b.y1)) ?? boxes[0];
    placed.push(free.b);
    return { h, corner: free.c };
  });
}

function HoleMark({ h, x, y, s, corner = 'ne' }: { h: DrillHole; x: number; y: number; s: number; corner?: Corner }) {
  const r = Math.max(0.7, (h.dia / 2) * s);
  const lb = labelBox(h.id, x, y, r, corner);
  return (
    <g>
      <circle cx={x} cy={y} r={r} strokeWidth={LW_THIN} strokeDasharray={h.verified ? undefined : '0.5 0.4'} />
      <Line x1={x - r - 0.8} y1={y} x2={x + r + 0.8} y2={y} w={0.1} />
      <Line x1={x} y1={y - r - 0.8} x2={x} y2={y + r + 0.8} w={0.1} />
      {/* the reference duct / rail outlines break at the label */}
      <rect x={lb.x0} y={lb.y0} width={lb.x1 - lb.x0} height={LABEL_H} fill="#fff" stroke="none" />
      <Txt x={lb.x0 + 0.2} y={lb.y1 - 0.4} size={1.8} mono>{h.id}</Txt>
    </g>
  );
}

function CutoutMark({ c, x, y, s, labelBelow, labelRight, labelMaxW }: { c: DrillCutout; x: number; y: number; s: number; labelBelow?: boolean; labelRight?: boolean; labelMaxW?: number }) {
  if (c.template) {
    // size not from the catalog: dashed outline and centre mark, machined per the part's template
    const rw = (c.w / 2) * s, rh = (c.h / 2) * s;
    return (
      <g>
        {c.kind === 'rect'
          ? <rect x={x - rw} y={y - rh} width={rw * 2} height={rh * 2} strokeWidth={LW_THIN} strokeDasharray="0.8 0.6" />
          : <circle cx={x} cy={y} r={rw} strokeWidth={LW_THIN} strokeDasharray="0.8 0.6" />}
        <Line x1={x - rw - 2} y1={y} x2={x + rw + 2} y2={y} w={0.12} />
        <Line x1={x} y1={y - rh - 2} x2={x} y2={y + rh + 2} w={0.12} />
        {/* above the shape (below it when the part edge is too close): clear of its centre lines and the outline */}
        <Txt x={labelRight ? x + rw : x - rw} anchor={labelRight ? 'end' : 'start'} y={labelBelow ? y + rh + 4.2 : y - rh - 5.0} size={2.0} mono bold maxW={labelMaxW}>{`${c.id} ${c.tag}`}</Txt>
        <Txt x={labelRight ? x + rw : x - rw} anchor={labelRight ? 'end' : 'start'} y={labelBelow ? y + rh + 6.6 : y - rh - 2.6} size={1.8} maxW={labelMaxW}>{c.template}</Txt>
      </g>
    );
  }
  if (c.kind === 'rect') {
    return (
      <g>
        <rect x={x - (c.w / 2) * s} y={y - (c.h / 2) * s} width={c.w * s} height={c.h * s} strokeWidth={LW} strokeDasharray={c.verified ? undefined : '1 0.6'} />
        <Line x1={x - 2} y1={y} x2={x + 2} y2={y} w={0.12} />
        <Line x1={x} y1={y - 2} x2={x} y2={y + 2} w={0.12} />
        <Txt x={x} y={y + 4} size={2.0} mono bold anchor="middle">{`${c.id} ${c.tag}`}</Txt>
        {/* font size shrinks to fit the cutout (svg2pdf cannot squeeze text with textLength) */}
        <Txt x={x} y={y + 6.6} size={Math.min(1.7, (c.w * s - 2) / (dualSize(c.w, c.h).length * 0.62))} mono anchor="middle">{dualSize(c.w, c.h)}</Txt>
      </g>
    );
  }
  const r = (c.w / 2) * s;
  return (
    <g>
      <circle cx={x} cy={y} r={r} strokeWidth={LW} />
      {c.notch && <rect x={x - (c.notch.w / 2) * s} y={y - r - c.notch.d * s} width={c.notch.w * s} height={c.notch.d * s + 0.1} strokeWidth={0.1} strokeDasharray="0.3 0.3" />}
      <Line x1={x - r - 0.8} y1={y} x2={x + r + 0.8} y2={y} w={0.1} />
      <Line x1={x} y1={y - r - 0.8} x2={x} y2={y + r + 0.8} w={0.1} />
      <Txt x={x} y={y + r + 2.6} size={1.9} mono anchor="middle">{`${c.id} ${c.tag}`}</Txt>
    </g>
  );
}

function CodeLegend({ sp }: { sp: Extract<SheetSpec, { kind: 'drill' }> }) {
  const d = sp.drill;
  const w = AREA_R - TX - 3;
  const lines = d.codes.flatMap((c) => wrapText(`${c.code} — ${c.count}x ${c.spec}${c.verified ? '' : ' — VERIFY WITH DATASHEET'}`, w - 2, 2.1).map((l, i) => ({ l, first: i === 0 })));
  const y0 = AREA.y + 7;
  const tableTop = y0 + 5 + lines.length * 2.9 + 4;
  return (
    <g>
      <Txt x={TX} y={y0} size={2.8} bold>HOLE CODES</Txt>
      {lines.map((x, i) => <Txt key={i} x={TX + (x.first ? 0 : 3)} y={y0 + 5 + i * 2.9} size={2.1} bold={x.first} maxW={w - 2}>{x.l}</Txt>)}
      <HoleTable x={TX} y={tableTop} w={w} rows={sp.rows} max={Math.floor((AREA_B - 4 - tableTop) / ROW) - 1} more={sp.pages > 1} />
    </g>
  );
}

function HoleTable({ x, y, w, rows, max, more }: { x: number; y: number; w: number; rows: DrillRow[]; max: number; more?: boolean }) {
  const cols = [0, 9, 27, 51, 75];
  const shown = rows.slice(0, max);
  return (
    <g>
      <rect x={x} y={y - 3.6} width={w} height={(shown.length + 1) * ROW + 1.6} strokeWidth={LW_HEAVY} />
      {['ID', 'FEATURE', 'X', 'Y', 'SIZE'].map((h, i) => <Txt key={h} x={x + cols[i] + 1} y={y} size={2.1} bold>{h}</Txt>)}
      <Line x1={x} y1={y + 1} x2={x + w} y2={y + 1} w={LW} />
      {shown.map((r, i) => {
        const yy = y + 1 + (i + 1) * ROW;
        return (
          <g key={r.id}>
            <Txt x={x + cols[0] + 1} y={yy - 0.8} size={2.0} mono bold>{r.id}</Txt>
            <Txt x={x + cols[1] + 1} y={yy - 0.8} size={2.0} mono maxW={cols[2] - cols[1] - 2}>{r.tag}</Txt>
            <Txt x={x + cols[3] - 2} y={yy - 0.8} size={2.0} mono anchor="end">{dualDim(r.x)}</Txt>
            <Txt x={x + cols[4] - 2} y={yy - 0.8} size={2.0} mono anchor="end">{dualDim(r.y)}</Txt>
            <Txt x={x + cols[4] + 1} y={yy - 0.8} size={2.0} mono maxW={w - cols[4] - 2}>{`${r.size}${r.verified ? '' : ' *'}`}</Txt>
            <Line x1={x} y1={yy + 0.3} x2={x + w} y2={yy + 0.3} w={0.08} />
          </g>
        );
      })}
      {(rows.length > shown.length || more) && <Txt x={x} y={y + 1 + (shown.length + 1) * ROW + 3} size={2.0} italic>{rows.length > shown.length ? `+${rows.length - shown.length} MORE — SEE NEXT SHEET` : 'CONTINUED ON NEXT SHEET'}</Txt>}
    </g>
  );
}

function DrillTables({ sp }: { sp: Extract<SheetSpec, { kind: 'drill' }> }) {
  const colW = (AREA.w - 30) / 2;
  return (
    <g>
      <Txt x={AREA.x + 6} y={AREA.y + 7} size={3.2} bold>{`${sp.drill.title} — HOLE TABLE (CONTINUED) — * = VERIFY WITH DATASHEET`}</Txt>
      {[0, 1].map((k) => {
        const rows = sp.rows.slice(k * DRILL_ROWS_CONT, (k + 1) * DRILL_ROWS_CONT);
        return rows.length ? <HoleTable key={k} x={AREA.x + 8 + k * (colW + 10)} y={AREA.y + 18} w={colW} rows={rows} max={DRILL_ROWS_CONT} /> : null;
      })}
    </g>
  );
}
