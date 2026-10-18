/**
 * DXF (CAD export) to text the AI can read: every TEXT, MTEXT and block attribute with its layer and
 * position, in reading order (top to bottom, left to right). Drawings exported from AutoCAD Electrical,
 * EPLAN or Chinese CAD tools keep device tags, part numbers, wire numbers and terminal names as text,
 * which is what the conversion needs. Geometry (lines, symbols) is not read.
 */

export interface DxfText {
  text: string;
  layer: string;
  x: number;
  y: number;
  /** Attribute tag (ATTRIB), e.g. "TAG1", "MFG", "CAT". */
  attr?: string;
}

/** \U+4E2D escapes (older DXF versions store non-ASCII text this way) and MTEXT formatting codes. */
export function cleanDxfText(s: string): string {
  return s
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\P/g, ' ')
    .replace(/\\[ACFHQTW][^;\\]*;/gi, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\S([^;^/#]*)[\^/#]([^;]*);/g, '$1/$2')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text entities of a DXF file. */
export function parseDxfTexts(dxf: string): DxfText[] {
  const lines = dxf.split(/\r?\n/);
  const out: DxfText[] = [];
  let ent: { type: string; layer: string; x: number; y: number; text: string[]; attr?: string } | null = null;
  const flush = () => {
    if (ent && /^(TEXT|MTEXT|ATTRIB|ATTDEF)$/.test(ent.type)) {
      const text = cleanDxfText(ent.text.join(''));
      // ATTDEF is a block definition's placeholder, not drawing text
      if (text && ent.type !== 'ATTDEF') out.push({ text, layer: ent.layer, x: ent.x, y: ent.y, ...(ent.attr ? { attr: ent.attr } : {}) });
    }
    ent = null;
  };
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1];
    if (code === '0') {
      flush();
      ent = { type: value.trim(), layer: '', x: 0, y: 0, text: [] };
      continue;
    }
    if (!ent) continue;
    if (code === '8') ent.layer = value.trim();
    else if (code === '10') ent.x = Number(value) || 0;
    else if (code === '20') ent.y = Number(value) || 0;
    // MTEXT splits long text over code 3 (chunks) then code 1 (the rest)
    else if (code === '3' && ent.type === 'MTEXT') ent.text.push(value);
    else if (code === '1') ent.text.push(value);
    else if (code === '2' && (ent.type === 'ATTRIB' || ent.type === 'ATTDEF')) ent.attr = value.trim();
  }
  flush();
  return out;
}

/** One text listing for the AI: "layer | text" in reading order, rows grouped by height. */
export function dxfToText(dxf: string, name = 'drawing.dxf'): string {
  const texts = parseDxfTexts(dxf);
  if (!texts.length) return `${name}: no text found in this DXF (it may hold only geometry). Export the drawing to PDF instead.`;
  const rowH = 2.5; // drawing units: texts within this height are one row
  const sorted = [...texts].sort((a, b) => (Math.abs(b.y - a.y) > rowH ? b.y - a.y : a.x - b.x));
  const rows: string[] = [];
  let lastY = Infinity;
  let row: string[] = [];
  for (const t of sorted) {
    if (Math.abs(lastY - t.y) > rowH && row.length) { rows.push(row.join('   ')); row = []; }
    row.push(`${t.attr ? `${t.attr}=` : ''}${t.text}${t.layer && t.layer !== '0' ? ` [${t.layer}]` : ''}`);
    lastY = t.y;
  }
  if (row.length) rows.push(row.join('   '));
  return `${name} (DXF export, ${texts.length} text items, top to bottom; [layer]):\n${rows.join('\n')}`;
}
