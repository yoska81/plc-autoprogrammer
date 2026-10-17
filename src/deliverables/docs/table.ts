/**
 * Table model shared by the Engineering package PDF and the Excel report, so
 * both deliverables print exactly the same rows.
 */

export interface DocColumn {
  header: string;
  /** Width in Excel characters; the PDF scales the widths to fit the page. */
  width: number;
  align?: 'left' | 'center' | 'right';
}

/** A spanning sub-heading row inside a table. */
export interface GroupRow { group: string }

export type DocRow = string[] | GroupRow;

export interface DocTable {
  columns: DocColumn[];
  rows: DocRow[];
  /** Minimum row height in mm (PDF), e.g. for signature / tick columns. */
  minRowMm?: number;
}

export function isGroup(r: DocRow): r is GroupRow {
  return !Array.isArray(r);
}

/** Build a table from [header, width] pairs. */
export function makeTable(cols: [string, number, DocColumn['align']?][], rows: DocRow[], minRowMm?: number): DocTable {
  return { columns: cols.map(([header, width, align]) => ({ header, width, align })), rows, minRowMm };
}

/** Lines of a free-text spec section, bullets stripped. */
export function specLines(t: string | undefined): string[] {
  return (t ?? '').split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
}

export function pad(n: number, w = 3): string {
  return String(n).padStart(w, '0');
}
