import type { AccessLevel, HmiLook, HmiStyle } from './types';

/** Colours of one HMI look. Both looks have the same keys. */
export interface HmiPalette {
  screen: string;
  /** Top of the soft glow behind the screen (equal to `screen` for a flat background). */
  glow: string;
  header: string;
  /** Text, secondary text and divider lines on the header bar. */
  headerText: string;
  headerDim: string;
  headerLine: string;
  panel: string;
  surface: string;
  surfaceUp: string;
  line: string;
  lineSoft: string;
  /** Raised-button bottom edge (3D look). */
  bevel: string;
  /** Entry / display field (numeric values, trend plot). */
  field: string;
  text: string;
  dim: string;
  faint: string;
  accent: string;
  /** Text on an accent fill. */
  onAccent: string;
  /** Pressed (momentary) button fill. */
  pressed: string;
  ok: string;
  warning: string;
  alarm: string;
  /** State colours readable as text on the screen and panel backgrounds. */
  okText: string;
  warningText: string;
  alarmText: string;
  select: string;
}

// Minimal dark console style (Tesla / SpaceX look): near-black world, thin
// lines, one accent; colour only carries meaning (ok / warning / alarm), which
// also follows ISA-101 high-performance practice.
export const C: HmiPalette = {
  screen: '#0a0c0f',
  glow: '#1c1f24',
  header: '#101317',
  headerText: '#eef0f3',
  headerDim: '#8b929d',
  headerLine: '#2b3038',
  panel: '#0f1216',
  surface: '#15181d',
  surfaceUp: '#1d2128',
  line: '#2b3038',
  lineSoft: '#20242b',
  bevel: '#2b3038',
  field: '#15181d',
  text: '#eef0f3',
  dim: '#8b929d',
  faint: '#5a616c',
  accent: '#1f7bff',
  onAccent: '#ffffff',
  pressed: '#10264a',
  ok: '#33c47a',
  warning: '#f2a93b',
  alarm: '#e5484d',
  okText: '#33c47a',
  warningText: '#f2a93b',
  alarmText: '#e5484d',
  select: '#7aa2ff',
};

// Siemens WinCC Comfort / Unified operator panel in the app's blue: light grey
// screen, raised light buttons, a deep blue header bar, colour for state only
// (ISA-101). Text colours keep at least 4.5:1 on the screen and the panels.
export const SIEMENS: HmiPalette = {
  screen: '#e6e9ed',
  glow: '#e6e9ed',
  header: '#0b2a5c',
  headerText: '#ffffff',
  headerDim: '#c3d2ea',
  headerLine: '#2d4f86',
  panel: '#f4f6f8',
  surface: '#f4f6f8',
  surfaceUp: '#e9edf1',
  line: '#b9c1ca',
  lineSoft: '#d3d9df',
  bevel: '#8c96a0',
  field: '#ffffff',
  text: '#1d2327',
  dim: '#55646c',
  faint: '#5b6770',
  accent: '#0d6efd',
  onAccent: '#ffffff',
  pressed: '#d5dbe1',
  ok: '#1a7f43',
  warning: '#e69a00',
  alarm: '#d42f2f',
  okText: '#136d36',
  warningText: '#8a5700',
  alarmText: '#b42323',
  select: '#0d6efd',
};

export const DEFAULT_LOOK: HmiLook = 'dark';
/** The look a design renders with: missing (new designs and designs saved before looks existed) means Siemens. */
export const lookOf = (design: { look?: HmiLook } | undefined | null): HmiLook => (design?.look === 'siemens' ? 'siemens' : DEFAULT_LOOK);
export const palette = (look: HmiLook = DEFAULT_LOOK): HmiPalette => (look === 'dark' ? C : SIEMENS);
export const LOOK_LABEL: Record<HmiLook, string> = { siemens: 'Siemens (light)', dark: 'Dark console' };

export const FONT = "Barlow, 'D-DIN', 'Segoe UI', Arial, sans-serif";
export const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace";
/** Siemens panels use Arial-like fonts. */
export const SIEMENS_FONT = "Arial, 'Segoe UI', Helvetica, sans-serif";

/** Everything the renderer needs to draw in one look. */
export interface HmiTheme extends HmiPalette {
  look: HmiLook;
  font: string;
  mono: string;
  /** Upper-case labels (dark console) or text as written (Siemens). */
  caps: (s: string) => string;
  /** Letter spacing: as given on the dark console, none on Siemens. */
  ls: (n: number) => number;
  /** Weight of big values and titles (light on the console, regular on Siemens). */
  thin: number;
  /** Date under the clock. */
  date: (ms: number) => string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const fmtTime = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
export const fmtDate = (ms: number) => { const d = new Date(ms); return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
/** Numeric date as on a WinCC panel: 16.10.2026. */
export const fmtDateNum = (ms: number) => { const d = new Date(ms); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };

const THEMES: Record<HmiLook, HmiTheme> = {
  dark: { ...C, look: 'dark', font: FONT, mono: MONO, caps: (s) => s.toUpperCase(), ls: (n) => n, thin: 300, date: fmtDate },
  siemens: { ...SIEMENS, look: 'siemens', font: SIEMENS_FONT, mono: SIEMENS_FONT, caps: (s) => s, ls: () => 0, thin: 400, date: fmtDateNum },
};
/** The renderer's theme for a look (defaults to Siemens). */
export const hmiTheme = (look: HmiLook = DEFAULT_LOOK): HmiTheme => THEMES[look] ?? THEMES[DEFAULT_LOOK];

export const styleColor = (style: HmiStyle | undefined, p: HmiPalette = C) =>
  style === 'alarm' ? p.alarm : style === 'warning' ? p.warning : style === 'ok' ? p.ok : p.accent;

/** Text colour for a state: abnormal states are coloured, normal ones stay plain (ISA-101). */
export const stateTextColor = (style: HmiStyle | undefined, p: HmiPalette = C) =>
  style === 'alarm' ? p.alarmText : style === 'warning' ? p.warningText : style === 'ok' ? p.okText : p.text;

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export const caps = (s: string) => s.toUpperCase();

/** Rough rendered width of a label (no DOM measuring, works off-screen and in PDF export). */
export function textWidth(text: string, fontSize: number, letterSpacing = 0): number {
  let w = 0;
  for (const ch of text) w += /[MW]/.test(ch) ? 0.86 : /[A-Z0-9]/.test(ch) ? 0.62 : /[mw]/.test(ch) ? 0.8 : /[ .,:;'|!il1jtf]/.test(ch) ? 0.3 : 0.55;
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
