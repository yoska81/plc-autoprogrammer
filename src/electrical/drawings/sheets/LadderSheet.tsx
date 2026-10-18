/**
 * Relay control ladder (NFPA 79) for relay logic kept from a converted machine: left / right rails (24+ / 0V,
 * or X1 / X2), one rung per circuit with its rung number and description, a parallel branch (a seal-in around
 * the start button) drawn below its rung, a wire number on every node, the coil's contact mirror and a
 * "/line" cross-reference under each relay / timer / overload / safety contact. Layout and numbers come from
 * relayLogic.ts, the same source as the wire list.
 */
import type { ReactElement } from 'react';
import { AREA, AREA_R, LW_THIN } from '../geometry';
import { CONTROL_PITCH, CONTROL_RUNGS, type DrawingPlan, type PlannedSheet, type SheetSpec } from '../plan';
import { Coil, Contact, Dot, Lamp, Line, Pushbutton, Txt, WireNo, XrefArrow } from '../symbols';
import { ContactMirror, LineNumbers } from './SchematicSheets';
import type { LadderEl, LadderRung } from '../../relayLogic';

const Y0 = AREA.y + 8;
const RAIL_L = 34;
const RAIL_R = 288;
const LOAD_X = 262;
/** Room left of a branch's vertical joins for the wire number coming in / going out. */
const LEAD = 9;

const halfW = (e: LadderEl) => (e.el.t === 'contact' ? (e.el.kind === 'pb' ? 5 : 4) : e.el.kind === 'drive-input' ? 9 : 5);
const XREF_KINDS = new Set(['relay', 'timer', 'ol', 'safety']);

export function LadderSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'ladder' }>;
  const y = (i: number) => Y0 + i * CONTROL_PITCH;
  const lastRow = Math.max(1, ...sp.rungs.map(({ r, idx }) => idx + r.rows - 1));
  const lastR = Math.max(1, ...sp.rungs.filter(({ r }) => !r.driveEnd).map(({ idx }) => idx));
  const [l, r] = sp.rails;
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={CONTROL_RUNGS + 1} pitch={CONTROL_PITCH} />
      <Txt x={RAIL_L - 3} y={y(0) - 1.5} size={2.8} mono bold>{l}</Txt>
      <Txt x={RAIL_R + 3} y={y(0) - 1.5} size={2.8} mono bold anchor="end">{r}</Txt>
      <Txt x={RAIL_L + 6} y={y(0) - 1.5} size={2.3}>{l === 'X1' ? 'X1 FROM THE CONTROL TRANSFORMER (120VAC)' : '+24VDC CONTROL SUPPLY'}</Txt>
      <Line x1={RAIL_L} y1={y(0)} x2={RAIL_L} y2={y(lastRow)} w={0.5} />
      <Line x1={RAIL_R} y1={y(0)} x2={RAIL_R} y2={y(lastR)} w={0.5} />
      <Line x1={RAIL_R + 6} y1={AREA.y} x2={RAIL_R + 6} y2={y(CONTROL_RUNGS) + 6} w={LW_THIN} />
      <Txt x={RAIL_R + 9} y={y(0) - 1.5} size={2.5} bold>RUNG / DESCRIPTION / CROSS-REFERENCE</Txt>
      {sp.rungs.map(({ r: rung, idx }) => <LadderRungView key={rung.n} plan={plan} r={rung} yy={y(idx)} pitch={CONTROL_PITCH} />)}
    </g>
  );
}

function LadderRungView({ plan, r, yy, pitch }: { plan: DrawingPlan; r: LadderRung; yy: number; pitch: number }) {
  // columns before the load share the room up to the load; the load (coil, lamp, drive input) sits at LOAD_X
  const load = r.cols[r.cols.length - 1];
  const loadEl = load?.kind === 'el' && load.e.el.t === 'coil' ? load.e : undefined;
  const series = loadEl ? r.cols.slice(0, -1) : r.cols;
  const units = series.map((c) => (c.kind === 'el' ? 1 : Math.max(...c.paths.map((p) => p.length)) + 0.6));
  const total = units.reduce((a, b) => a + b, 0) || 1;
  const x0 = RAIL_L + 6;
  const xEnd = loadEl ? LOAD_X - halfW(loadEl) - 8 : RAIL_R - 6;
  const slot = Math.min(34, (xEnd - x0) / total);
  const parts: ReactElement[] = [];
  let xa = x0;
  let wireStart = RAIL_L;
  const seg = (a: number, b: number, w: string, yv: number, label = true) => {
    parts.push(<Line key={`s${parts.length}`} x1={a} y1={yv} x2={b} y2={yv} />);
    if (label && b - a > 6) parts.push(<WireNo key={`w${parts.length}`} x={(a + b) / 2} y={yv} n={w} maxW={b - a - 1} />);
  };
  const el = (e: LadderEl, x: number, yv: number) => parts.push(<LadderElement key={`e${parts.length}`} plan={plan} e={e} x={x} y={yv} />);
  series.forEach((c, i) => {
    const xb = xa + units[i] * slot;
    if (c.kind === 'el') {
      const x = (xa + xb) / 2;
      seg(wireStart, x - halfW(c.e), c.e.wIn, yy);
      el(c.e, x, yy);
      wireStart = x + halfW(c.e);
    } else {
      // branch: joins at bx0 / bx1, each path on its own row, elements spread evenly between the joins
      const bx0 = xa + LEAD / 2, bx1 = xb - LEAD / 2;
      seg(wireStart, bx0, c.wIn, yy);
      const lastY = yy + (c.paths.length - 1) * pitch;
      parts.push(<Line key={`v${parts.length}`} x1={bx0} y1={yy} x2={bx0} y2={lastY} />, <Line key={`v${parts.length + 1}`} x1={bx1} y1={yy} x2={bx1} y2={lastY} />);
      c.paths.forEach((p, k) => {
        const yv = yy + k * pitch;
        if (k > 0) parts.push(<Dot key={`d${parts.length}`} x={bx0} y={yy} />, <Dot key={`d${parts.length + 1}`} x={bx1} y={yy} />);
        const step = (bx1 - bx0) / Math.max(1, p.length);
        let from = bx0;
        p.forEach((e, q) => {
          const x = bx0 + (q + 0.5) * step;
          // the first segment carries the branch's incoming number, already labelled on the main row
          seg(from, x - halfW(e), e.wIn, yv, q > 0);
          el(e, x, yv);
          from = x + halfW(e);
        });
        seg(from, bx1, c.wOut, yv, false);
      });
      wireStart = bx1;
    }
    xa = xb;
  });
  if (loadEl) {
    seg(wireStart, LOAD_X - halfW(loadEl), loadEl.wIn, yy);
    el(loadEl, LOAD_X, yy);
    if (!r.driveEnd) seg(LOAD_X + halfW(loadEl), RAIL_R, loadEl.wOut, yy);
  } else {
    const lastCol = series[series.length - 1];
    seg(wireStart, RAIL_R, lastCol ? (lastCol.kind === 'el' ? lastCol.e.wOut : lastCol.wOut) : '', yy);
  }
  const desc = [`${r.n}. ${(r.rung.description ?? '').toUpperCase()}`.trim(), ...(loadEl && loadEl.el.t === 'coil' && plan.xref.get(`c:${loadEl.el.tag}`) ? [`CONTACTS: ${plan.xref.get(`c:${loadEl.el.tag}`)}`] : [])];
  return (
    <g>
      <Dot x={RAIL_L} y={yy} />
      {!r.driveEnd && <Dot x={RAIL_R} y={yy} />}
      {parts}
      {desc.map((d, i) => <Txt key={i} x={RAIL_R + 9} y={yy - 0.6 + i * 3.4} size={i === 0 ? 2.5 : 2.2} bold={i === 0} maxW={AREA_R - RAIL_R - 11}>{d}</Txt>)}
    </g>
  );
}

function LadderElement({ plan, e, x, y }: { plan: DrawingPlan; e: LadderEl; x: number; y: number }) {
  const v = e.el;
  if (v.t === 'contact') {
    const ref = v.kind && XREF_KINDS.has(v.kind) ? plan.xref.get(`coil:${v.tag}`) : undefined;
    return (
      <g>
        {v.kind === 'pb' ? <Pushbutton x={x} y={y} nc={v.nc} /> : <Contact x={x} y={y} nc={v.nc} />}
        {v.kind === 'pb' ? (
          // a pushbutton's actuator stands above it: tag and terminals to its right (as on the control sheet)
          <>
            <Txt x={x + 4} y={y - 3.4} size={2.6} mono bold>{v.tag}</Txt>
            <Txt x={x + 4.6 + v.tag.length * 1.56} y={y - 3.4} size={2.2} mono>{e.pins.join('-')}</Txt>
          </>
        ) : (
          <>
            <Txt x={x - 1} y={y - 4.0} size={2.6} mono bold anchor="end">{v.tag}</Txt>
            <Txt x={x + 0.5} y={y - 4.0} size={2.2} mono>{e.pins.join('-')}</Txt>
          </>
        )}
        {ref && <Txt x={x} y={y + 5.2} size={1.9} mono anchor="middle">{`/${ref}`}</Txt>}
      </g>
    );
  }
  if (v.kind === 'light') {
    return (
      <g>
        <Lamp x={x} y={y} />
        <Txt x={x} y={y - 4.6} size={2.6} mono bold anchor="middle">{v.tag}</Txt>
      </g>
    );
  }
  if (v.kind === 'drive-input') {
    // the rung ends in the drive's input: an arrow to the drive terminal, no right-rail connection
    return (
      <g>
        <Line x1={x - 9} y1={y} x2={x - 3} y2={y} />
        <XrefArrow x={x - 3} y={y} />
        <Txt x={x} y={y + 0.9} size={2.5} mono bold>{v.tag}</Txt>
        <Txt x={x} y={y + 4.4} size={2.2} mono>{`INPUT ${v.terms ?? ''}`.trim()}</Txt>
      </g>
    );
  }
  const what = v.kind === 'timer-on' ? 'TON' : v.kind === 'timer-off' ? 'TOF' : v.kind === 'counter' ? 'CTR' : v.kind === 'solenoid' ? 'SOL' : '';
  return (
    <g>
      <Coil x={x} y={y} />
      <Txt x={x} y={y - 4.2} size={2.6} mono bold anchor="middle">{v.tag}</Txt>
      <Txt x={x - 3.6} y={y + 3.6} size={2.0} mono anchor="end">A1</Txt>
      <Txt x={x + 3.6} y={y + 3.6} size={2.0} mono>A2</Txt>
      {(what || v.preset) && <Txt x={x + 6} y={y - 4.2} size={2.0} mono>{[what, v.preset].filter(Boolean).join(' ')}</Txt>}
      <ContactMirror plan={plan} tag={v.tag} x={x} y={y + 0.4} />
    </g>
  );
}
