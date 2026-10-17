import type { ReactNode } from 'react';
import type { RevisionEntry } from '../derive';
import {
  BORDER, FRAME, LW, LW_HEAVY, LW_THIN, TITLE_H, ZONE_COLS, ZONE_ROWS, wrapText,
} from './geometry';
import type { DocState } from './plan';
import { sheetOnPaper, type SheetFormat } from '../../standards/regions';
import { Line, Txt } from './symbols';

export interface FrameInfo {
  projectName: string;
  title: string;
  n: number;
  total: number;
  drawingNo: string;
  date: string;
  scale: string;
  cpu: string;
  /** Code references for the project region, e.g. "NFPA 79 / UL 508A / NEC". */
  codes?: string;
  /** Document control (company, names, revisions). */
  doc?: DocState;
  /** Revision of this sheet. */
  rev?: string;
  /** Short supply text for the title block, e.g. "480VAC 3PH 60Hz". */
  supply?: string;
}

/** Title-block column edges (mm). */
const C1 = 104, C2 = 196, C3 = 300;

/**
 * Drawing sheet on its paper (ANSI B 17" x 11", or A3): trim frame, border with zone grid, title
 * block with revision table. The content is laid out for ANSI B and scaled into an A3 sheet's
 * drawing area. Units: mm.
 */
export default function SheetFrame({ info, children, width, height, sheet }: { info: FrameInfo; children: ReactNode; width?: string; height?: string; sheet?: SheetFormat }) {
  const on = sheetOnPaper(sheet);
  const SHEET_W = on.paper.w, SHEET_H = on.paper.h;
  const iw = SHEET_W - 2 * BORDER;
  const ih = SHEET_H - 2 * BORDER;
  const zw = iw / ZONE_COLS;
  const zh = ih / ZONE_ROWS;
  const ty = SHEET_H - BORDER - TITLE_H;
  const R = SHEET_W - BORDER;
  const doc = info.doc;
  const rs = doc?.rs;
  const rev = info.rev ?? rs?.rev ?? 'A';
  const preliminary = rs ? rs.preliminary : true;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} width={width} height={height}
      style={{ background: '#fff', display: 'block' }} stroke="#000" fill="none" strokeLinecap="round"
    >
      <rect x={0} y={0} width={SHEET_W} height={SHEET_H} fill="#fff" stroke="none" />
      <rect x={FRAME} y={FRAME} width={SHEET_W - 2 * FRAME} height={SHEET_H - 2 * FRAME} strokeWidth={LW_THIN} />
      <rect x={BORDER} y={BORDER} width={iw} height={ih} strokeWidth={0.7} />
      {/* zones */}
      {Array.from({ length: ZONE_COLS }, (_, i) => {
        const x = BORDER + i * zw;
        const label = String(ZONE_COLS - i);
        return (
          <g key={`c${i}`}>
            {i > 0 && <><Line x1={x} y1={FRAME} x2={x} y2={BORDER} w={LW_THIN} /><Line x1={x} y1={SHEET_H - BORDER} x2={x} y2={SHEET_H - FRAME} w={LW_THIN} /></>}
            <Txt x={x + zw / 2} y={FRAME + 4.2} size={2.8} anchor="middle">{label}</Txt>
            <Txt x={x + zw / 2} y={SHEET_H - FRAME - 1.8} size={2.8} anchor="middle">{label}</Txt>
          </g>
        );
      })}
      {Array.from({ length: ZONE_ROWS }, (_, i) => {
        const y = BORDER + i * zh;
        const label = String.fromCharCode(65 + ZONE_ROWS - 1 - i);
        return (
          <g key={`r${i}`}>
            {i > 0 && <><Line x1={FRAME} y1={y} x2={BORDER} y2={y} w={LW_THIN} /><Line x1={SHEET_W - BORDER} y1={y} x2={SHEET_W - FRAME} y2={y} w={LW_THIN} /></>}
            <Txt x={FRAME + 3} y={y + zh / 2 + 1} size={2.8} anchor="middle">{label}</Txt>
            <Txt x={SHEET_W - FRAME - 3} y={y + zh / 2 + 1} size={2.8} anchor="middle">{label}</Txt>
          </g>
        );
      })}

      {/* title block */}
      <g>
        <rect x={BORDER} y={ty} width={iw} height={TITLE_H} strokeWidth={LW_HEAVY} fill="#fff" />
        {[C1, C2, C3].map((x) => <Line key={x} x1={x} y1={ty} x2={x} y2={ty + TITLE_H} w={LW} />)}
        <CompanyBlock info={info} ty={ty} preliminary={preliminary} status={rs?.status ?? 'PRELIMINARY — NOT FOR CONSTRUCTION'} />
        <RevisionTable ty={ty} revisions={rs?.revisions ?? []} />
        <ProjectBlock info={info} ty={ty} />
        <NumberBlock info={info} ty={ty} rev={rev} R={R} size={on.paper.size} />
      </g>

      <g transform={on.factor === 1 && !on.tx && !on.ty ? undefined : `translate(${on.tx.toFixed(3)} ${on.ty.toFixed(3)}) scale(${on.factor.toFixed(5)})`}>{children}</g>
    </svg>
  );
}

function CompanyBlock({ info, ty, preliminary, status }: { info: FrameInfo; ty: number; preliminary: boolean; status: string }) {
  const x = BORDER + 2.5, w = C1 - BORDER - 5;
  const company = info.doc?.company?.toUpperCase() || 'ISA AUTO PROGRAMMER';
  const disclaimer = wrapText('AI-GENERATED (ISA AUTO PROGRAMMER). MUST BE CHECKED AND APPROVED BY A QUALIFIED ENGINEER BEFORE USE.', w, 1.7);
  return (
    <g>
      <Txt x={x} y={ty + 5.6} size={3.4} bold maxW={w}>{company}</Txt>
      <Txt x={x} y={ty + 9.4} size={2.0} maxW={w}>ELECTRICAL CONTROL PANEL DRAWINGS</Txt>
      <Txt x={x} y={ty + 12.4} size={2.0} maxW={w}>{info.codes ?? 'NFPA 79 / UL 508A'}</Txt>
      <rect x={x} y={ty + 14.4} width={w} height={7.2} strokeWidth={preliminary ? 0.6 : LW} fill={preliminary ? '#fff' : '#fff'} />
      {preliminary && <rect x={x + 0.8} y={ty + 15.2} width={w - 1.6} height={5.6} strokeWidth={LW_THIN} />}
      <Txt x={x + w / 2} y={ty + 19.0} size={2.6} bold anchor="middle" maxW={w - 3}>{status}</Txt>
      {disclaimer.slice(0, 3).map((l, i) => <Txt key={i} x={x} y={ty + 24.6 + i * 2.4} size={1.7} italic maxW={w}>{l}</Txt>)}
    </g>
  );
}

/** Last four revisions (oldest at the top), as on every sheet of a released set. */
function RevisionTable({ ty, revisions }: { ty: number; revisions: RevisionEntry[] }) {
  const x0 = C1, w = C2 - C1;
  const cols = [0, 8, 25, 81];
  const rows = revisions.slice(-4);
  const head = ty + 4.4, colHead = head + 3.8;
  const rowH = (TITLE_H - (colHead - ty)) / 4;
  return (
    <g>
      <Txt x={x0 + w / 2} y={ty + 3.3} size={2.0} bold anchor="middle">REVISIONS</Txt>
      <Line x1={x0} y1={head} x2={C2} y2={head} w={LW_THIN} />
      {['REV', 'DATE', 'DESCRIPTION', 'BY'].map((h, i) => <Txt key={h} x={x0 + cols[i] + 1} y={head + 2.9} size={1.7} bold>{h}</Txt>)}
      <Line x1={x0} y1={colHead} x2={C2} y2={colHead} w={LW_THIN} />
      {cols.slice(1).map((c) => <Line key={c} x1={x0 + c} y1={head} x2={x0 + c} y2={ty + TITLE_H} w={LW_THIN} />)}
      {[1, 2, 3].map((k) => <Line key={k} x1={x0} y1={colHead + k * rowH} x2={C2} y2={colHead + k * rowH} w={0.12} />)}
      {rows.map((r, i) => {
        const y = colHead + i * rowH + rowH / 2 + 0.8;
        return (
          <g key={i}>
            <Txt x={x0 + cols[1] / 2} y={y} size={2.2} bold mono anchor="middle">{r.rev}</Txt>
            <Txt x={x0 + cols[1] + 1} y={y} size={1.9} mono maxW={cols[2] - cols[1] - 2}>{r.date}</Txt>
            <Txt x={x0 + cols[2] + 1} y={y} size={1.9} maxW={cols[3] - cols[2] - 2}>{(r.description ?? '').toUpperCase()}</Txt>
            <Txt x={x0 + cols[3] + 1} y={y} size={1.9} maxW={w - cols[3] - 2}>{(r.by ?? '').toUpperCase()}</Txt>
          </g>
        );
      })}
      {!rows.length && <Txt x={x0 + cols[2] + 1} y={colHead + rowH / 2 + 0.8} size={1.9} italic>NOT YET ISSUED (PRELIMINARY)</Txt>}
    </g>
  );
}

function Cell({ x, y, w, h, cap, val, size = 2.6, bold, mono, center = true, right }: { x: number; y: number; w: number; h: number; cap: string; val: string; size?: number; bold?: boolean; mono?: boolean; center?: boolean; right?: string }) {
  return (
    <g>
      <Txt x={x + 1.2} y={y + 2.5} size={1.7}>{cap}</Txt>
      {right && <Txt x={x + w - 1.2} y={y + 2.5} size={1.7} mono anchor="end">{right}</Txt>}
      <Txt x={center ? x + w / 2 : x + 1.5} y={y + h - 1.8} size={size} bold={bold} mono={mono} anchor={center ? 'middle' : 'start'} maxW={w - 2.5}>{val}</Txt>
    </g>
  );
}

function ProjectBlock({ info, ty }: { info: FrameInfo; ty: number }) {
  const doc = info.doc;
  const w = C3 - C2;
  const titleLines = wrapText(info.title, w - 4, 3.0).slice(0, 2);
  const r1 = 8, r2 = 8;
  return (
    <g>
      <Line x1={C2} y1={ty + r1} x2={C3} y2={ty + r1} w={LW_THIN} />
      <Line x1={C2} y1={ty + r1 + r2} x2={C3} y2={ty + r1 + r2} w={LW_THIN} />
      <Line x1={C2 + 58} y1={ty} x2={C2 + 58} y2={ty + r1} w={LW_THIN} />
      <Line x1={C2 + 72} y1={ty + r1} x2={C2 + 72} y2={ty + r1 + r2} w={LW_THIN} />
      <Cell x={C2} y={ty} w={58} h={r1} cap="CUSTOMER" val={doc?.customer.toUpperCase() ?? ''} size={2.4} bold center={false} />
      <Cell x={C2 + 58} y={ty} w={w - 58} h={r1} cap="SITE" val={doc?.site.toUpperCase() ?? ''} size={2.4} center={false} />
      <Cell x={C2} y={ty + r1} w={72} h={r2} cap="PROJECT" val={info.projectName.toUpperCase() || 'UNTITLED PROJECT'} size={2.6} bold center={false} />
      <Cell x={C2 + 72} y={ty + r1} w={w - 72} h={r2} cap="PROJECT NO." val={doc?.projectNumber.toUpperCase() ?? ''} size={2.4} mono center={false} />
      <Txt x={C2 + 1.2} y={ty + r1 + r2 + 2.5} size={1.7}>SHEET TITLE</Txt>
      {titleLines.map((l, i) => <Txt key={i} x={C2 + 2} y={ty + r1 + r2 + 7.4 + i * 4.2} size={3.0} bold maxW={w - 4}>{l}</Txt>)}
    </g>
  );
}

function NumberBlock({ info, ty, rev, R, size }: { info: FrameInfo; ty: number; rev: string; R: number; size: string }) {
  const doc = info.doc;
  const w = R - C3;
  const cw = [48, 36, w - 84];
  const xs = [C3, C3 + cw[0], C3 + cw[0] + cw[1]];
  const rh = TITLE_H / 4;
  const signed = (name: string | undefined) => (name ? doc?.rs.date || '' : '');
  const cells: { cap: string; val: string; size?: number; bold?: boolean; mono?: boolean; right?: string }[] = [
    { cap: 'DRAWING NO.', val: info.drawingNo, size: 3.0, bold: true, mono: true },
    { cap: 'SHEET', val: `${info.n} OF ${info.total}`, size: 3.0, bold: true },
    { cap: 'REV', val: rev, size: 3.4, bold: true, mono: true },
    { cap: 'DRAWN', val: (doc?.preparedBy ?? '').toUpperCase(), size: 2.3, right: doc ? doc.drawnDate : info.date },
    { cap: 'CHECKED', val: (doc?.checkedBy ?? '').toUpperCase(), size: 2.3, right: signed(doc?.checkedBy) },
    { cap: 'APPROVED', val: (doc?.approvedBy ?? '').toUpperCase(), size: 2.3, right: signed(doc?.approvedBy) },
    { cap: 'DATE', val: info.date, size: 2.4, mono: true },
    { cap: 'SCALE', val: info.scale, size: 2.4 },
    { cap: 'SIZE', val: size, size: 2.2 },
    { cap: 'PLC', val: info.cpu, size: 2.2, mono: true },
    { cap: 'SUPPLY', val: info.supply ?? '', size: 2.2 },
    { cap: 'DWG STATUS', val: doc?.rs.preliminary === false ? 'ISSUED' : 'PRELIMINARY', size: 2.2, bold: true },
  ];
  return (
    <g>
      {[1, 2, 3].map((k) => <Line key={k} x1={C3} y1={ty + k * rh} x2={R} y2={ty + k * rh} w={LW_THIN} />)}
      {xs.slice(1).map((x) => <Line key={x} x1={x} y1={ty} x2={x} y2={ty + TITLE_H} w={LW_THIN} />)}
      {cells.map((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        return <Cell key={c.cap} x={xs[col]} y={ty + row * rh} w={cw[col]} h={rh} cap={c.cap} val={c.val} size={c.size} bold={c.bold} mono={c.mono} right={c.right} />;
      })}
    </g>
  );
}
