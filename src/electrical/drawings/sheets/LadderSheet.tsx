/**
 * Relay control ladder (NFPA 79) for relay logic kept from a converted machine: left / right rails (24+ / 0V,
 * or X1 / X2), one rung per circuit with its rung number and description, a parallel branch (a seal-in around
 * the start button) drawn below its rung, a wire number on every net, and a "/line" cross-reference under each
 * relay / timer / overload / safety contact (the coil's contacts are listed in the description column). A rung
 * that starts at an earlier rung's node (shared contacts) or at a drive's input common starts at a labelled node;
 * a rung too long for one line continues on the next one (arrow + wire number). Layout, nets and wire numbers
 * come from relayLogic.ts, the same source as the wire list and the cross-references.
 */
import type { ReactElement } from 'react';
import { AREA, AREA_R, LW_THIN } from '../geometry';
import { CONTROL_PITCH, CONTROL_RUNGS, type DrawingPlan, type PlannedSheet, type SheetSpec } from '../plan';
import { Coil, Contact, Dot, Lamp, Line, Pushbutton, TermPt, Txt, WireNo, XrefArrow } from '../symbols';
import { LineNumbers } from './SchematicSheets';
import { LADDER, type LadderCol, type LadderEl, type LadderRung } from '../../relayLogic';

const Y0 = AREA.y + 8;
const RAIL_L = 34;
const RAIL_R = 288;
const LOAD_X = 262;
const X0 = RAIL_L + 6;

const halfW = (e: LadderEl) => (e.el.t === 'contact' ? (e.el.kind === 'pb' ? 5 : 4) : e.el.kind === 'drive-input' ? 9 : 5);
const XREF_KINDS = new Set(['relay', 'timer', 'ol', 'safety']);
const colW = (c: LadderCol) => (c.kind === 'el' ? LADDER.unit : Math.max(...c.paths.map((p) => p.length)) * LADDER.unit + LADDER.lead);

export function LadderSheet({ plan, sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'ladder' }>;
  const y = (i: number) => Y0 + i * CONTROL_PITCH;
  // the rails run only as far as the rungs that use them (a drive-input rung has no right rail; a shared start no left)
  const leftRows = sp.rungs.filter(({ r }) => r.start.kind === 'rail').flatMap(({ r, idx }) => r.lines.slice(0, 1).map((l) => idx + l.row + l.rows - 1));
  const rightRows = sp.rungs.filter(({ r }) => !r.driveEnd).map(({ r, idx }) => idx + r.lines[r.lines.length - 1].row);
  const [l, rr] = sp.rails;
  return (
    <g>
      <LineNumbers sheet={sheet.n} count={CONTROL_RUNGS + 1} pitch={CONTROL_PITCH} />
      <Txt x={RAIL_L - 3} y={y(0) - 1.5} size={2.8} mono bold>{l}</Txt>
      <Txt x={RAIL_L + 6} y={y(0) - 1.5} size={2.3}>{l === 'X1' ? 'X1 FROM THE CONTROL TRANSFORMER (120VAC)' : '+24VDC CONTROL SUPPLY'}</Txt>
      {leftRows.length > 0 && <Line x1={RAIL_L} y1={y(0)} x2={RAIL_L} y2={y(Math.max(...leftRows))} w={0.5} />}
      {rightRows.length > 0 && (
        <g>
          <Txt x={RAIL_R + 3} y={y(0) - 1.5} size={2.8} mono bold anchor="end">{rr}</Txt>
          <Line x1={RAIL_R} y1={y(0)} x2={RAIL_R} y2={y(Math.max(...rightRows))} w={0.5} />
        </g>
      )}
      <Line x1={RAIL_R + 6} y1={AREA.y} x2={RAIL_R + 6} y2={y(CONTROL_RUNGS) + 6} w={LW_THIN} />
      <Txt x={RAIL_R + 9} y={y(0) - 1.5} size={2.5} bold>RUNG / DESCRIPTION / CROSS-REFERENCE</Txt>
      {sp.rungs.map(({ r: rung, idx }) => <LadderRungView key={rung.n} plan={plan} r={rung} yy={y(idx)} />)}
    </g>
  );
}

function LadderRungView({ plan, r, yy }: { plan: DrawingPlan; r: LadderRung; yy: number }) {
  const pitch = CONTROL_PITCH;
  const parts: ReactElement[] = [];
  let keyN = 0;
  const k = () => `k${keyN++}`;
  const seg = (a: number, b: number, w: string, yv: number, label = true, below = false) => {
    parts.push(<Line key={k()} x1={a} y1={yv} x2={b} y2={yv} />);
    if (label && b - a > 6) parts.push(below ? <Txt key={k()} x={(a + b) / 2} y={yv + 3.4} mono size={2.5} anchor="middle" maxW={b - a - 1}>{w}</Txt> : <WireNo key={k()} x={(a + b) / 2} y={yv} n={w} maxW={b - a - 1} />);
  };
  const el = (e: LadderEl, x: number, yv: number) => parts.push(<LadderElement key={k()} plan={plan} e={e} x={x} y={yv} />);
  const last = r.lines.length - 1;
  r.lines.forEach((line, li) => {
    const ly = yy + line.row * pitch;
    const load = li === last ? line.cols[line.cols.length - 1] : undefined;
    const loadEl = load?.kind === 'el' && load.e.el.t === 'coil' ? load.e : undefined;
    const series = loadEl ? line.cols.slice(0, -1) : line.cols;
    // start of the line: the rail, an earlier rung's node / a drive common (first line), or a continuation arrow
    let wireStart = RAIL_L;
    let nameAbove = false;
    let inWire = series[0] ? (series[0].kind === 'el' ? series[0].e.wIn : series[0].wIn) : loadEl?.wIn ?? '';
    if (li === 0 && r.start.kind === 'rail') parts.push(<Dot key={k()} x={RAIL_L} y={ly} />);
    else {
      wireStart = X0 - 2;
      const label = li === 0 && r.start.kind === 'node' ? r.start.label : '';
      parts.push(<TermPt key={k()} x={wireStart} y={ly} />);
      // the start node is named below it, right of the rail: a drive's input common ("VFD1 DCM"), or the line of the
      // earlier rung whose node it is ("FROM /7.06"); a continuation line starts at an arrow
      if (li > 0) parts.push(<XrefArrow key={k()} x={wireStart - 3} y={ly} />);
      const ref = li === 0 && r.start.kind === 'node' && !label ? plan.xref.get(`net:${r.start.wire}`)?.split(' ')[1] : undefined;
      const under = label || (ref ? `FROM ${ref}` : '');
      // a branch first on the line drops its left vertical right of the node: the name goes above the wire there
      // (and the wire number of the short lead to the branch goes below it)
      nameAbove = Boolean(under) && series[0]?.kind === 'branch' && series[0].paths.length > 1;
      if (under) parts.push(<Txt key={k()} x={wireStart - 0.8} y={nameAbove ? ly - 1.6 : ly + 4.4} size={2.1} mono bold={Boolean(label)}>{under}</Txt>);
      if (li === 0 && r.start.kind === 'node') inWire = r.start.wire;
    }
    let xa = X0;
    series.forEach((c, i) => {
      const xb = xa + colW(c);
      if (c.kind === 'el') {
        const x = (xa + xb) / 2;
        seg(wireStart, x - halfW(c.e), i === 0 ? inWire : c.e.wIn, ly);
        el(c.e, x, ly);
        wireStart = x + halfW(c.e);
      } else {
        const bx0 = xa + LADDER.lead / 2, bx1 = xb - LADDER.lead / 2;
        seg(wireStart, bx0, c.wIn, ly, true, i === 0 && nameAbove);
        const lastY = ly + (c.paths.length - 1) * pitch;
        parts.push(<Line key={k()} x1={bx0} y1={ly} x2={bx0} y2={lastY} />, <Line key={k()} x1={bx1} y1={ly} x2={bx1} y2={lastY} />);
        c.paths.forEach((p, q) => {
          const yv = ly + q * pitch;
          if (q > 0) parts.push(<Dot key={k()} x={bx0} y={ly} />, <Dot key={k()} x={bx1} y={ly} />);
          const step = (bx1 - bx0) / Math.max(1, p.length);
          let from = bx0;
          p.forEach((e, n) => {
            const x = bx0 + (n + 0.5) * step;
            seg(from, x - halfW(e), e.wIn, yv, n > 0);
            el(e, x, yv);
            from = x + halfW(e);
          });
          seg(from, bx1, c.wOut, yv, false);
        });
        wireStart = bx1;
      }
      xa = xb;
    });
    const lastCol = series[series.length - 1];
    const outWire = lastCol ? (lastCol.kind === 'el' ? lastCol.e.wOut : lastCol.wOut) : inWire;
    if (loadEl) {
      seg(wireStart, LOAD_X - halfW(loadEl), loadEl.wIn, ly);
      el(loadEl, LOAD_X, ly);
      if (!r.driveEnd) { seg(LOAD_X + halfW(loadEl), RAIL_R, loadEl.wOut, ly); parts.push(<Dot key={k()} x={RAIL_R} y={ly} />); }
    } else if (li < last) {
      // continued on the next line
      seg(wireStart, RAIL_R - 14, outWire, ly);
      parts.push(<XrefArrow key={k()} x={RAIL_R - 14} y={ly} />);
    } else {
      seg(wireStart, RAIL_R, outWire, ly);
      parts.push(<Dot key={k()} x={RAIL_R} y={ly} />);
    }
  });
  const coil = r.cols[r.cols.length - 1];
  const coilTag = coil?.kind === 'el' && coil.e.el.t === 'coil' && coil.e.el.kind !== 'drive-input' ? coil.e.el.tag : '';
  const desc = [`${r.n}. ${(r.rung.description ?? '').toUpperCase()}`.trim(), ...(coilTag && plan.xref.get(`c:${coilTag}`) ? [`CONTACTS: ${plan.xref.get(`c:${coilTag}`)}`] : [])];
  return (
    <g>
      {parts}
      {desc.map((d, i) => <Txt key={i} x={RAIL_R + 9} y={yy - 0.6 + i * 3.4} size={i === 0 ? 2.5 : 2.2} bold={i === 0} maxW={AREA_R - RAIL_R - 11}>{d}</Txt>)}
    </g>
  );
}

function LadderElement({ plan, e, x, y }: { plan: DrawingPlan; e: LadderEl; x: number; y: number }) {
  const v = e.el;
  const terms = e.pins.filter(Boolean).join('-');
  if (v.t === 'contact') {
    const ref = v.kind && XREF_KINDS.has(v.kind) ? plan.xref.get(`coil:${v.tag}`) : undefined;
    // tag above-left, terminals above-right (a pushbutton's actuator stands in the middle): fits one LADDER.unit
    return (
      <g>
        {v.kind === 'pb' ? <Pushbutton x={x} y={y} nc={v.nc} /> : <Contact x={x} y={y} nc={v.nc} />}
        <Txt x={x - (v.kind === 'pb' ? 3 : 1)} y={y - 4.0} size={2.6} mono bold anchor="end">{v.tag}</Txt>
        <Txt x={x + (v.kind === 'pb' ? 3 : 0.5)} y={y - 4.0} size={2.2} mono maxW={LADDER.unit / 2 - 3}>{terms}</Txt>
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
        <Txt x={x} y={y + 4.4} size={2.2} mono>{`INPUT ${e.pins[0]}`}</Txt>
      </g>
    );
  }
  const what = v.kind === 'timer-on' ? 'TON' : v.kind === 'timer-off' ? 'TOF' : v.kind === 'counter' ? 'CTR' : v.kind === 'solenoid' ? 'SOL' : '';
  return (
    <g>
      <Coil x={x} y={y} />
      <Txt x={x} y={y - 4.2} size={2.6} mono bold anchor="middle">{v.tag}</Txt>
      <Txt x={x - 3.6} y={y + 3.6} size={2.0} mono anchor="end">{e.pins[0]}</Txt>
      <Txt x={x + 3.6} y={y + 3.6} size={2.0} mono>{e.pins[1]}</Txt>
      {/* type and preset below the coil, kept left of the right rail (never into the description column) */}
      {(what || v.preset) && <Txt x={x} y={y + 7.0} size={1.9} mono anchor="middle" maxW={2 * (RAIL_R - x) - 2}>{[what, v.preset].filter(Boolean).join(' ')}</Txt>}
    </g>
  );
}
