import type { AccessLevel, HmiStyle } from './types';

// Minimal dark console style (Tesla / SpaceX look): near-black world, thin
// lines, one accent; colour only carries meaning (ok / warning / alarm), which
// also follows ISA-101 high-performance practice.
export const C = {
  screen: '#0a0c0f',
  header: '#101317',
  panel: '#0f1216',
  surface: '#15181d',
  surfaceUp: '#1d2128',
  line: '#2b3038',
  lineSoft: '#20242b',
  text: '#eef0f3',
  dim: '#8b929d',
  faint: '#5a616c',
  accent: '#1f7bff',
  /** Text on an accent fill. */
  onAccent: '#ffffff',
  /** Pressed (momentary) button fill: dark blue tint. */
  pressed: '#10264a',
  ok: '#33c47a',
  warning: '#f2a93b',
  alarm: '#e5484d',
  select: '#7aa2ff',
};
export const FONT = "Barlow, 'D-DIN', 'Segoe UI', Arial, sans-serif";
export const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace";

export const styleColor = (style: HmiStyle | undefined) =>
  style === 'alarm' ? C.alarm : style === 'warning' ? C.warning : style === 'ok' ? C.ok : C.accent;

/** Text colour for a state: abnormal states are coloured, normal ones stay white (ISA-101). */
export const stateTextColor = (style: HmiStyle | undefined) =>
  style === 'alarm' ? C.alarm : style === 'warning' ? C.warning : style === 'ok' ? C.ok : C.text;

export const caps = (s: string) => s.toUpperCase();

/** Rough rendered width of a capitalised label (no DOM measuring, works off-screen and in PDF export). */
export function textWidth(text: string, fontSize: number, letterSpacing = 0): number {
  let w = 0;
  for (const ch of text) w += /[MW]/.test(ch) ? 0.86 : /[A-Z0-9]/.test(ch) ? 0.62 : /[ .,:;'|!il1]/.test(ch) ? 0.3 : 0.55;
  return w * fontSize + text.length * letterSpacing;
}

/** Largest font size (down to `min`) at which `text` fits `maxW`. */
export function fitSize(text: string, maxW: number, size: number, min: number, letterSpacing = 0): number {
  let fs = size;
  while (fs > min && textWidth(text, fs, letterSpacing) > maxW) fs -= 0.5;
  return fs;
}

/** Shorten text with an ellipsis so it fits `maxW`. */
export function fitText(text: string, maxW: number, fontSize: number, letterSpacing = 0): string {
  if (textWidth(text, fontSize, letterSpacing) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, fontSize, letterSpacing) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export const LEVEL_LABEL: Record<AccessLevel, string> = { operator: 'Operator', maintenance: 'Maintenance', engineer: 'Engineer' };
export const LEVEL_SHORT: Record<AccessLevel, string> = { operator: '', maintenance: 'M', engineer: 'E' };

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const fmtTime = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
export const fmtDate = (ms: number) => { const d = new Date(ms); return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
