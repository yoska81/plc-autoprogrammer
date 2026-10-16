/**
 * JIC / NFPA 79 style schematic symbols as small SVG components (units: mm).
 * All device symbols are drawn for left-to-right signal flow, centred on (x, y);
 * the caller draws the connecting wires up to x ± half the symbol length
 * (see SYM in geometry.ts). Parent groups set stroke="#000" fill="none".
 */
import type { ReactNode } from 'react';
import { FONT_MONO, FONT_SANS, LW, LW_THIN, textWidth } from './geometry';

type Anchor = 'start' | 'middle' | 'end';

export interface TxtProps {
  x: number;
  y: number;
  children: string | number;
  size?: number;
  anchor?: Anchor;
  mono?: boolean;
  bold?: boolean;
  /** Squeeze the text to this width if the estimate exceeds it. */
  maxW?: number;
  rotate?: number;
  italic?: boolean;
  fill?: string;
}

/** Text with a hard maximum width (never overflows its cell). */
export function Txt({ x, y, children, size = 2.5, anchor = 'start', mono, bold, maxW, rotate, italic, fill = '#000' }: TxtProps) {
  const s = String(children);
  const est = textWidth(s, size, mono) * (bold ? 1.08 : 1);
  const squeeze = maxW !== undefined && est > maxW && s.length > 1;
  return (
    <text
      x={x} y={y} fontSize={size} textAnchor={anchor} fill={fill} stroke="none"
      fontFamily={mono ? FONT_MONO : FONT_SANS} fontWeight={bold ? 700 : 400} fontStyle={italic ? 'italic' : undefined}
      textLength={squeeze ? maxW : undefined} lengthAdjust={squeeze ? 'spacingAndGlyphs' : undefined}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >{s}</text>
  );
}

export function Line({ x1, y1, x2, y2, w = LW, dash }: { x1: number; y1: number; x2: number; y2: number; w?: number; dash?: string }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w} strokeDasharray={dash} />;
}

export function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={0.75} fill="#000" stroke="none" />;
}

/** Wire number centred above a horizontal wire. */
export function WireNo({ x, y, n, maxW }: { x: number; y: number; n: string; maxW?: number }) {
  if (!n) return null;
  return <Txt x={x} y={y - 1} mono size={2.5} anchor="middle" maxW={maxW}>{n}</Txt>;
}

/** Terminal-strip terminal on a horizontal wire: small box with the terminal number. */
export function TermBox({ x, y, n }: { x: number; y: number; n: string | number }) {
  const s = String(n);
  const w = Math.max(5, textWidth(s, 2.2, true) + 1.6);
  return (
    <g>
      <rect x={x - w / 2} y={y - 1.9} width={w} height={3.8} fill="#fff" strokeWidth={LW_THIN} />
      <Txt x={x} y={y + 0.8} size={2.2} mono anchor="middle">{s}</Txt>
    </g>
  );
}

/** Open terminal point (device terminal). */
export function TermPt({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={0.7} fill="#fff" strokeWidth={LW_THIN} />;
}

/** Normally-open / normally-closed relay contact "| |" (8 mm long). */
export function Contact({ x, y, nc }: { x: number; y: number; nc?: boolean }) {
  return (
    <g>
      <Line x1={x - 4} y1={y} x2={x - 1.25} y2={y} />
      <Line x1={x + 1.25} y1={y} x2={x + 4} y2={y} />
      <Line x1={x - 1.25} y1={y - 2.5} x2={x - 1.25} y2={y + 2.5} />
      <Line x1={x + 1.25} y1={y - 2.5} x2={x + 1.25} y2={y + 2.5} />
      {nc && <Line x1={x - 2.8} y1={y + 2.8} x2={x + 2.8} y2={y - 2.8} />}
    </g>
  );
}

/** Pushbutton (10 mm long). NO: bridge above the terminals; NC: bridge under them. mushroom = E-stop head. */
export function Pushbutton({ x, y, nc, mushroom }: { x: number; y: number; nc?: boolean; mushroom?: boolean }) {
  const by = nc ? y + 1.0 : y - 2.0;
  const top = y - 5.2;
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3.7} y2={y} />
      <Line x1={x + 3.7} y1={y} x2={x + 5} y2={y} />
      <TermPt x={x - 3} y={y} />
      <TermPt x={x + 3} y={y} />
      <Line x1={x - 3.8} y1={by} x2={x + 3.8} y2={by} />
      <Line x1={x} y1={by} x2={x} y2={top} />
      {mushroom
        ? <path d={`M ${x - 3} ${top} A 3 2.2 0 0 1 ${x + 3} ${top} Z`} strokeWidth={LW} />
        : <Line x1={x - 2} y1={top} x2={x + 2} y2={top} />}
    </g>
  );
}

/** Limit switch (10 mm). */
export function LimitSwitch({ x, y, nc }: { x: number; y: number; nc?: boolean }) {
  const ey = nc ? y + 1.4 : y - 2.6;
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3.7} y2={y} />
      <Line x1={x + 3.7} y1={y} x2={x + 5} y2={y} />
      <TermPt x={x - 3} y={y} />
      <TermPt x={x + 3} y={y} />
      <Line x1={x - 2.4} y1={y - 0.4} x2={x + 3.4} y2={ey} />
      <path d={`M ${x + 0.4} ${(y + ey) / 2 - 0.2} l -1.2 -2.2 h 2.4 Z`} strokeWidth={LW_THIN} />
    </g>
  );
}

/** Pressure switch (10 mm): contact blade with a diaphragm. */
export function PressureSwitch({ x, y, nc }: { x: number; y: number; nc?: boolean }) {
  const ey = nc ? y + 1.4 : y - 2.6;
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3.7} y2={y} />
      <Line x1={x + 3.7} y1={y} x2={x + 5} y2={y} />
      <TermPt x={x - 3} y={y} />
      <TermPt x={x + 3} y={y} />
      <Line x1={x - 2.4} y1={y - 0.4} x2={x + 3.4} y2={ey} />
      <Line x1={x + 0.5} y1={(y + ey) / 2} x2={x + 0.5} y2={y + 3} />
      <path d={`M ${x - 1.5} ${y + 3} A 2 1.6 0 0 0 ${x + 2.5} ${y + 3} Z`} strokeWidth={LW_THIN} />
    </g>
  );
}

/** Two-position selector switch contact (10 mm). */
export function Selector({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3.7} y2={y} />
      <Line x1={x + 3.7} y1={y} x2={x + 5} y2={y} />
      <TermPt x={x - 3} y={y} />
      <TermPt x={x + 3} y={y} />
      <Line x1={x - 3.8} y1={y - 2} x2={x + 3.8} y2={y - 2} />
      <Line x1={x} y1={y - 2} x2={x} y2={y - 4.2} />
      <path d={`M ${x - 2.4} ${y - 4.2} h 4.8`} strokeWidth={LW} />
      <path d={`M ${x - 2.2} ${y - 5.6} A 2.6 1.2 0 0 1 ${x + 2.2} ${y - 5.6}`} strokeWidth={LW_THIN} />
    </g>
  );
}

/** Relay / contactor coil: circle, 7 mm. */
export function Coil({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3} y2={y} />
      <Line x1={x + 3} y1={y} x2={x + 5} y2={y} />
      <circle cx={x} cy={y} r={3} strokeWidth={LW} />
    </g>
  );
}

/** Solenoid coil (10 mm). */
export function Solenoid({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3.5} y2={y} />
      <Line x1={x + 3.5} y1={y} x2={x + 5} y2={y} />
      <rect x={x - 3.5} y={y - 2.3} width={7} height={4.6} strokeWidth={LW} />
      <Line x1={x - 3.5} y1={y + 2.3} x2={x + 3.5} y2={y - 2.3} w={LW_THIN} />
    </g>
  );
}

/** Pilot lamp with rays and colour letter (10 mm). */
export function Lamp({ x, y, color }: { x: number; y: number; color?: string }) {
  const r = 3;
  const d = 0.7071;
  const letter = (color ?? '').slice(0, 1).toUpperCase();
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - r} y2={y} />
      <Line x1={x + r} y1={y} x2={x + 5} y2={y} />
      <circle cx={x} cy={y} r={r} strokeWidth={LW} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
        <Line key={i} x1={x + sx * r * d * 1.2} y1={y + sy * r * d * 1.2} x2={x + sx * r * d * 1.75} y2={y + sy * r * d * 1.75} w={LW_THIN} />
      ))}
      {letter && <Txt x={x} y={y + 0.9} size={2.4} anchor="middle" bold>{letter}</Txt>}
    </g>
  );
}

/** 3-wire DC sensor body (14 x 8 mm) with BN (left), BK (right) and BU (bottom) leads. */
export function Sensor3W({ x, y, kind }: { x: number; y: number; kind: 'PNP' | 'NPN' }) {
  return (
    <g>
      <rect x={x - 6} y={y - 3.5} width={12} height={7} strokeWidth={LW} fill="#fff" />
      <path d={`M ${x - 6} ${y - 3.5} l -1.6 1.6 v 3.8 l 1.6 1.6`} strokeWidth={LW_THIN} />
      <Txt x={x + 0.6} y={y + 0.9} size={2.3} anchor="middle" bold>{kind}</Txt>
      <Line x1={x - 9} y1={y} x2={x - 7.6} y2={y} />
      <Line x1={x + 6} y1={y} x2={x + 9} y2={y} />
      <Line x1={x} y1={y + 3.5} x2={x} y2={y + 5} />
    </g>
  );
}

/** Generic device box on a wire (e.g. VFD digital input), 12 x 6 mm. */
export function DevBox({ x, y, label, w = 12 }: { x: number; y: number; label: string; w?: number }) {
  return (
    <g>
      <Line x1={x - w / 2 - 1.5} y1={y} x2={x - w / 2} y2={y} />
      <rect x={x - w / 2} y={y - 3} width={w} height={6} strokeWidth={LW} fill="#fff" />
      <Txt x={x} y={y + 0.9} size={2.2} anchor="middle" mono maxW={w - 1}>{label}</Txt>
    </g>
  );
}

// ---------------------------------------------------------------- power (horizontal poles)

/** Circuit-breaker pole (10 mm): two contacts bridged by an arc. */
export function BreakerPole({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3.6} y2={y} />
      <Line x1={x + 3.6} y1={y} x2={x + 5} y2={y} />
      <TermPt x={x - 3} y={y} />
      <TermPt x={x + 3} y={y} />
      <path d={`M ${x - 3} ${y - 0.7} Q ${x} ${y - 5} ${x + 3} ${y - 0.7}`} strokeWidth={LW} />
    </g>
  );
}

/** Disconnect switch pole (10 mm). */
export function SwitchPole({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x - 3.6} y2={y} />
      <Line x1={x + 3.6} y1={y} x2={x + 5} y2={y} />
      <TermPt x={x - 3} y={y} />
      <TermPt x={x + 3} y={y} />
      <Line x1={x - 2.4} y1={y - 0.4} x2={x + 3.2} y2={y - 3.4} />
    </g>
  );
}

/** Fuse (10 mm). */
export function Fuse({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Line x1={x - 5} y1={y} x2={x + 5} y2={y} />
      <rect x={x - 3.5} y={y - 1.3} width={7} height={2.6} strokeWidth={LW} fill="#fff" />
      <Line x1={x - 3.5} y1={y} x2={x + 3.5} y2={y} />
    </g>
  );
}

/** Thermal overload heater element (10 mm). */
export function OverloadHeater({ x, y }: { x: number; y: number }) {
  return (
    <path d={`M ${x - 5} ${y} H ${x - 2.2} V ${y - 2.4} H ${x + 2.2} V ${y} H ${x + 5}`} strokeWidth={LW} />
  );
}

/** Protective-earth symbol hanging below (x, y). */
export function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Line x1={x} y1={y} x2={x} y2={y + 2} />
      <Line x1={x - 2.4} y1={y + 2} x2={x + 2.4} y2={y + 2} />
      <Line x1={x - 1.6} y1={y + 2.9} x2={x + 1.6} y2={y + 2.9} />
      <Line x1={x - 0.8} y1={y + 3.8} x2={x + 0.8} y2={y + 3.8} />
    </g>
  );
}

/** 3-phase (or 1-phase) motor circle with leads arriving from the left. */
export function Motor({ cx, cy, r = 8.5, leadsY }: { cx: number; cy: number; r?: number; leadsY: number[] }) {
  return (
    <g>
      {leadsY.map((ly, i) => {
        const dy = ly - cy;
        const dx = Math.sqrt(Math.max(0, r * r - dy * dy));
        return <Line key={i} x1={cx - dx - 6} y1={ly} x2={cx - dx} y2={ly} />;
      })}
      <circle cx={cx} cy={cy} r={r} strokeWidth={0.5} fill="#fff" />
      <Txt x={cx} y={cy + 1.6} size={4.5} anchor="middle" bold>M</Txt>
    </g>
  );
}

/** Off-page / cross-reference arrow at the end of a wire, pointing in `dir`. */
export function XrefArrow({ x, y, dir = 'right', label }: { x: number; y: number; dir?: 'right' | 'left' | 'down' | 'up'; label?: ReactNode }) {
  const p = dir === 'right' ? `M ${x} ${y - 1.4} L ${x + 2.4} ${y} L ${x} ${y + 1.4} Z`
    : dir === 'left' ? `M ${x} ${y - 1.4} L ${x - 2.4} ${y} L ${x} ${y + 1.4} Z`
      : dir === 'down' ? `M ${x - 1.4} ${y} L ${x} ${y + 2.4} L ${x + 1.4} ${y} Z`
        : `M ${x - 1.4} ${y} L ${x} ${y - 2.4} L ${x + 1.4} ${y} Z`;
  return (
    <g>
      <path d={p} fill="#000" strokeWidth={LW_THIN} />
      {label}
    </g>
  );
}
