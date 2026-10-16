/** Sheet geometry (ANSI B landscape, mm) and text helpers shared by all sheets. */

export const SHEET_W = 431.8;
export const SHEET_H = 279.4;
/** Outer trim frame and inner drawing border offsets from the paper edge. */
export const FRAME = 6;
export const BORDER = 12;
export const TITLE_H = 32;
export const ZONE_COLS = 8;
export const ZONE_ROWS = 6;

/** Drawing area inside the border and above the title block. */
export const AREA = { x: BORDER, y: BORDER, w: SHEET_W - 2 * BORDER, h: SHEET_H - 2 * BORDER - TITLE_H };
export const AREA_R = AREA.x + AREA.w;
export const AREA_B = AREA.y + AREA.h;

export const LW = 0.35;
export const LW_THIN = 0.25;
export const LW_HEAVY = 0.5;

export const FONT_SANS = 'Arial, "Liberation Sans", Helvetica, sans-serif';
export const FONT_MONO = '"DejaVu Sans Mono", Consolas, "Liberation Mono", Menlo, monospace';

/** Estimated rendered width of a string (mm). */
export function textWidth(s: string, size: number, mono = false): number {
  if (mono) return s.length * size * 0.6;
  let w = 0;
  for (const ch of s) {
    if (/[A-Z0-9#%&@MW]/.test(ch)) w += /[MW@%]/.test(ch) ? 0.85 : 0.68;
    else if (/[il.,:;'|!I1 ()\-/]/.test(ch)) w += 0.32;
    else w += 0.56;
  }
  return w * size;
}

/** Wraps text to fit a width (mm) at a font size. */
export function wrapText(text: string, maxW: number, size: number, mono = false): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (!cur || textWidth(t, size, mono) <= maxW) cur = t;
      else { out.push(cur); cur = w; }
    }
    out.push(cur);
  }
  return out;
}

/** Schematic line reference "sheet.line", e.g. sheet 3 line 12 -> "3.12". */
export const lineNo = (sheet: number, idx: number): string => `${sheet}.${String(idx).padStart(2, '0')}`;

/** Standard text heights (mm) used across the set. */
export const TXT = { title: 3.2, head: 2.6, body: 2.3, small: 2.0, tiny: 1.7 } as const;
