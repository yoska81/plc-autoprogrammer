import type { ReactNode } from 'react';
import {
  BORDER, FRAME, LW, LW_HEAVY, LW_THIN, SHEET_H, SHEET_W, TITLE_H, ZONE_COLS, ZONE_ROWS, wrapText,
} from './geometry';
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
}

const DRAWN_BY = 'Drawn by: PLC Autoprogrammer (AI-generated — must be checked and approved by a qualified engineer before use)';

/** ANSI B (17" x 11") sheet: trim frame, border with zone grid, title block. Units: mm. */
export default function SheetFrame({ info, children, width, height }: { info: FrameInfo; children: ReactNode; width?: string; height?: string }) {
  const iw = SHEET_W - 2 * BORDER;
  const ih = SHEET_H - 2 * BORDER;
  const zw = iw / ZONE_COLS;
  const zh = ih / ZONE_ROWS;
  const ty = SHEET_H - BORDER - TITLE_H;
  const tx = BORDER;
  const titleLines = wrapText(info.title, 134, 3.2).slice(0, 2);
  const drawnLines = wrapText(DRAWN_BY, 124, 2.3);
  // title block cell grid (right part)
  const cx = 282;
  const cw = (SHEET_W - BORDER - cx) / 3;
  const ch = TITLE_H / 3;
  const cells: [string, string, boolean?][] = [
    ['DRAWING NO.', info.drawingNo, true], ['SHEET', `${info.n} OF ${info.total}`, true], ['REV', 'A', true],
    ['DATE', info.date], ['SCALE', info.scale], ['SIZE', 'ANSI B (17" x 11")'],
    ['CHECKED BY', ''], ['APPROVED BY', ''], ['PLC', info.cpu],
  ];
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
        <rect x={tx} y={ty} width={iw} height={TITLE_H} strokeWidth={LW_HEAVY} fill="#fff" />
        <Line x1={142} y1={ty} x2={142} y2={ty + TITLE_H} w={LW} />
        <Line x1={cx} y1={ty} x2={cx} y2={ty + TITLE_H} w={LW} />
        <Txt x={tx + 3} y={ty + 6.2} size={3.6} bold>PLC AUTOPROGRAMMER</Txt>
        <Txt x={tx + 3} y={ty + 10.2} size={2.2}>{`ELECTRICAL CONTROL PANEL DRAWINGS — ${info.codes ?? 'NFPA 79 / UL 508A'}`}</Txt>
        <rect x={tx + 2} y={ty + 12.5} width={126} height={drawnLines.length * 3.1 + 2.6} strokeWidth={LW_THIN} />
        {drawnLines.map((l, i) => <Txt key={i} x={tx + 4} y={ty + 16 + i * 3.1} size={2.3} bold={i === 0} maxW={122}>{l}</Txt>)}
        <Txt x={tx + 3} y={ty + TITLE_H - 2.2} size={2.0} italic>NOT FOR CONSTRUCTION UNTIL CHECKED, SIGNED AND RELEASED</Txt>

        <Txt x={145} y={ty + 3.6} size={2.0}>PROJECT</Txt>
        <Txt x={145} y={ty + 9.4} size={3.6} bold maxW={134}>{info.projectName.toUpperCase() || 'UNTITLED PROJECT'}</Txt>
        <Line x1={142} y1={ty + 12.5} x2={cx} y2={ty + 12.5} w={LW_THIN} />
        <Txt x={145} y={ty + 16} size={2.0}>SHEET TITLE</Txt>
        {titleLines.map((l, i) => <Txt key={i} x={145} y={ty + 21.4 + i * 4.4} size={3.2} bold maxW={134}>{l}</Txt>)}

        {cells.map(([cap, val, strong], i) => {
          const c = i % 3, r = Math.floor(i / 3);
          const x = cx + c * cw, y = ty + r * ch;
          return (
            <g key={cap}>
              {c > 0 && <Line x1={x} y1={y} x2={x} y2={y + ch} w={LW_THIN} />}
              {r > 0 && c === 0 && <Line x1={cx} y1={y} x2={SHEET_W - BORDER} y2={y} w={LW_THIN} />}
              <Txt x={x + 1.5} y={y + 2.9} size={2.0}>{cap}</Txt>
              <Txt x={x + cw / 2} y={y + 8.6} size={strong ? 3.2 : 2.5} bold={strong} anchor="middle" mono={cap === 'DRAWING NO.' || cap === 'PLC'} maxW={cw - 3}>{val}</Txt>
            </g>
          );
        })}
      </g>

      <g>{children}</g>
    </svg>
  );
}
