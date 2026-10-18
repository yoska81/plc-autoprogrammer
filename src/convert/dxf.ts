/**
 * CAD drawings (DXF exports, or DWG through a plugged-in reader) to text the AI can read: every TEXT,
 * MTEXT and block attribute with its layer, per sheet, in reading order (top to bottom, left to right).
 * Drawings exported from AutoCAD Electrical, EPLAN or Chinese CAD tools keep device tags, part numbers,
 * wire numbers and terminal names as text, which is what the conversion needs. Several sheets drawn side
 * by side in model space are split by their border frames (the largest rectangles), and each sheet's
 * title block (工程名称 / 图名 / 第 x 页) names it. Symbols themselves are not read.
 */

/** One entity of a CAD drawing: text with its position, or a line / polyline (for the sheet frames). */
export type CadEntity =
  | { type: 'TEXT' | 'MTEXT' | 'ATTRIB'; layer: string; x: number; y: number; text: string; attr?: string }
  | { type: 'LINE'; layer: string; points: [number, number][] }
  | { type: 'LWPOLYLINE'; layer: string; points: [number, number][]; closed: boolean };

export type DxfText = Extract<CadEntity, { text: string }>;

/**
 * Reader for DWG files in the browser (none is bundled). In the Windows app a DWG is converted to DXF by the
 * installed ODA File Converter instead (src/convert/derive.ts); otherwise the upload explains how to export
 * DXF or PDF.
 */
export type DwgReader = (dwg: ArrayBuffer) => Promise<CadEntity[]>;
let dwgReader: DwgReader | null = null;
export function setDwgReader(r: DwgReader | null) { dwgReader = r; }
export const hasDwgReader = () => dwgReader !== null;
/** A DWG file's entities, or null when no DWG reader is plugged in. */
export async function dwgToEntities(dwg: ArrayBuffer): Promise<CadEntity[] | null> {
  return dwgReader ? dwgReader(dwg) : null;
}

/** \U+4E2D escapes (older DXF versions store non-ASCII text this way), MTEXT formatting codes, "10平方" = 10 mm². */
export function cleanDxfText(s: string): string {
  return s
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\P/g, ' ')
    .replace(/\\[ACFHQTW][^;\\]*;/gi, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\S([^;^/#]*)[\^/#]([^;]*);/g, '$1/$2')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±')
    .replace(/(\d+(?:\.\d+)?)\s*平方(?!米)/g, '$1平方 ($1 mm²)')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Entities of a DXF file: text, attributes, lines and polylines. */
export function parseDxfEntities(dxf: string): CadEntity[] {
  const lines = dxf.split(/\r?\n/);
  const out: CadEntity[] = [];
  let ent: { type: string; layer: string; x: number; y: number; x2: number; y2: number; text: string[]; attr?: string; pts: [number, number][]; flags: number } | null = null;
  const flush = () => {
    if (!ent) return;
    if (/^(TEXT|MTEXT|ATTRIB)$/.test(ent.type)) {
      const text = cleanDxfText(ent.text.join(''));
      // (ATTDEF is a block definition's placeholder, not drawing text)
      if (text) out.push({ type: ent.type as 'TEXT', layer: ent.layer, x: ent.x, y: ent.y, text, ...(ent.attr ? { attr: ent.attr } : {}) });
    } else if (ent.type === 'LINE') out.push({ type: 'LINE', layer: ent.layer, points: [[ent.x, ent.y], [ent.x2, ent.y2]] });
    else if (ent.type === 'LWPOLYLINE' && ent.pts.length) out.push({ type: 'LWPOLYLINE', layer: ent.layer, points: ent.pts, closed: (ent.flags & 1) === 1 });
    ent = null;
  };
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1];
    if (code === '0') {
      flush();
      ent = { type: value.trim(), layer: '', x: 0, y: 0, x2: 0, y2: 0, text: [], pts: [], flags: 0 };
      continue;
    }
    if (!ent) continue;
    if (code === '8') ent.layer = value.trim();
    else if (code === '10') { ent.x = Number(value) || 0; if (ent.type === 'LWPOLYLINE') ent.pts.push([ent.x, 0]); }
    else if (code === '20') { ent.y = Number(value) || 0; if (ent.type === 'LWPOLYLINE' && ent.pts.length) ent.pts[ent.pts.length - 1][1] = ent.y; }
    else if (code === '11') ent.x2 = Number(value) || 0;
    else if (code === '21') ent.y2 = Number(value) || 0;
    else if (code === '70') ent.flags = Number(value) || 0;
    // MTEXT splits long text over code 3 (chunks) then code 1 (the rest)
    else if (code === '3' && ent.type === 'MTEXT') ent.text.push(value);
    else if (code === '1') ent.text.push(value);
    else if (code === '2' && (ent.type === 'ATTRIB' || ent.type === 'ATTDEF')) ent.attr = value.trim();
  }
  flush();
  return out;
}

/** Text entities of a DXF file. */
export const parseDxfTexts = (dxf: string): DxfText[] => parseDxfEntities(dxf).filter((e): e is DxfText => 'text' in e);

interface Box { x1: number; y1: number; x2: number; y2: number }
const area = (b: Box) => (b.x2 - b.x1) * (b.y2 - b.y1);
const inside = (b: Box, x: number, y: number) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
const holds = (a: Box, b: Box) => a.x1 <= b.x1 && a.y1 <= b.y1 && a.x2 >= b.x2 && a.y2 >= b.y2 && area(a) > area(b);

/** Axis-aligned rectangles drawn as one polyline (a sheet border usually is). */
function rectangles(entities: CadEntity[]): Box[] {
  const out: Box[] = [];
  for (const e of entities) {
    if (e.type !== 'LWPOLYLINE' || e.points.length < 4) continue;
    const pts = e.points.slice(0, 4);
    const xs = [...new Set(pts.map((p) => Math.round(p[0])))], ys = [...new Set(pts.map((p) => Math.round(p[1])))];
    if (xs.length !== 2 || ys.length !== 2 || (!e.closed && e.points.length < 5)) continue;
    out.push({ x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) });
  }
  return out;
}

/**
 * The sheets of a drawing: its largest rectangles (border frames), outermost only, in reading order
 * (rows top to bottom, then left to right). None when there are no frames (the drawing is one sheet).
 */
export function sheetFrames(entities: CadEntity[]): Box[] {
  const rects = rectangles(entities);
  if (!rects.length) return [];
  const big = Math.max(...rects.map(area));
  // a frame is at least a quarter of the largest one and not inside another frame (inner borders, title blocks)
  const frames = rects.filter((r) => area(r) >= big / 4).filter((r, _, all) => !all.some((o) => o !== r && holds(o, r)));
  const h = Math.max(...frames.map((f) => f.y2 - f.y1));
  return frames.sort((a, b) => (Math.abs(b.y2 - a.y2) > h / 2 ? b.y2 - a.y2 : a.x1 - b.x1));
}

/** Rows of text in reading order: "text [layer]" joined left to right, rows top to bottom. */
function textRows(texts: DxfText[], rowH: number): string[] {
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
  return rows;
}

// Title-block labels, alone or bilingual ("图名 Sheet title", "Drawing title / 图名"): never a sheet's name.
const NAME_LABEL = /^(?:(?:图\s*名|图纸名称|(?:sheet|drawing)\s*title|title)\s*[/|:：]?\s*)+/i;
const PROJECT_LABEL = /^(?:(?:工程名称|项目名称|project(?:\s*name)?)\s*[/|:：]?\s*)+/i;
const PAGE_LABEL = /^(?:(?:页|页次|页码|张次|sheet(?:\s*no\.?)?)[\s/|:：]*)+$/i;
// Any other title-block field label, Chinese, English or both ("版本 Rev.", "设计 Designed", "日期 Date", "图号 Dwg No.").
const ZH_LABELS = '版本|版次|修改|设计|制图|绘图|审核|校对|批准|审定|工艺|标准化|日期|比例|图号|编号|材料|重量|数量|单位|公司|客户|共\\s*页|第\\s*页';
const EN_LABELS = 'rev(?:ision)?\\.?|version|designed(?:\\s*by)?|design|drawn(?:\\s*by)?|checked(?:\\s*by)?|check|approved(?:\\s*by)?|approve|date|scale|dwg\\.?\\s*no\\.?|drawing\\s*no\\.?|no\\.|material|weight|qty|unit|company|customer|standard';
const FIELD_LABEL = new RegExp(`^(?:(?:${ZH_LABELS}|${EN_LABELS})[\\s/|:：.]*)+$`, 'i');
const isLabel = (t: string) => !t.replace(NAME_LABEL, '').replace(PROJECT_LABEL, '').trim() || PAGE_LABEL.test(t) || FIELD_LABEL.test(t);

/** A sheet's name from its title block: the text after 图名 / Title (else 工程名称 / Project), skipping the labels themselves. */
function sheetTitle(texts: DxfText[]): string {
  const sorted = [...texts].sort((a, b) => b.y - a.y || a.x - b.x);
  const isValue = (t: string) => !isLabel(t) && !/^\d{1,3}$|第\s*\d+\s*页|共\s*\d+\s*页/.test(t);
  const after = (re: RegExp) => {
    const label = sorted.find((t) => re.test(t.text.trim()));
    if (!label) return '';
    const own = label.text.trim().replace(re, '').trim();
    if (own) return own;
    // the value is its own text (never another label): right of the label on its row, else just below it (or below and right)
    const dist = (t: DxfText) => Math.hypot(t.x - label.x, t.y - label.y);
    const values = sorted.filter((t) => t !== label && isValue(t.text.trim()));
    // a value on the row belongs to the nearest label on its left ("版本 Rev." B is the revision, not the name)
    const ownLabel = (t: DxfText) => !sorted.some((o) => o !== label && Math.abs(o.y - t.y) <= 2 && o.x > label.x && o.x < t.x && isLabel(o.text.trim()));
    const right = values.filter((t) => Math.abs(t.y - label.y) <= 2 && t.x > label.x && ownLabel(t)).sort((a, b) => dist(a) - dist(b))[0];
    const below = values.filter((t) => t.y < label.y - 2 && label.y - t.y <= 15 && t.x > label.x - 20 && t.x < label.x + 150).sort((a, b) => dist(a) - dist(b))[0];
    return (right ?? below)?.text.trim() ?? '';
  };
  const name = after(NAME_LABEL) || after(PROJECT_LABEL);
  const page = sorted.map((t) => t.text).find((t) => /第\s*\d+\s*页/.test(t)) ?? '';
  return [name, page].filter(Boolean).join(' · ');
}

/**
 * A sheet's own number and the set's sheet count, from its title block: "第3页 共8页", "SHEET 3", "3 / 8",
 * "Sheet 3 of 8" (the whole text, so a note mentioning a sheet is not taken), or the value next to a
 * 页 / Sheet label. Null when the sheet doesn't show it.
 */
export function sheetNumber(texts: DxfText[]): { n: number; of: number | null } | null {
  const sorted = [...texts].sort((a, b) => b.y - a.y || a.x - b.x);
  const all = sorted.map((t) => t.text.trim());
  const total = (() => { const m = all.join(' ').match(/共\s*(\d+)\s*页/); return m ? Number(m[1]) : null; })();
  for (const t of all) {
    const m = t.match(/第\s*(\d+)\s*页/) ?? t.match(/^(?:sheet|图号|页)?\s*(\d+)\s*(?:\/|of)\s*(\d+)$/i) ?? t.match(/^sheet\s*(\d+)$/i);
    if (m) return { n: Number(m[1]), of: m[2] ? Number(m[2]) : total };
  }
  // a 页 / Sheet label with its value as its own text (to its right or just below)
  for (const [i, t] of sorted.entries()) {
    if (!PAGE_LABEL.test(t.text.trim())) continue;
    const next = sorted.filter((o, j) => j !== i && /^\d{1,3}$/.test(o.text.trim()) && o.y <= t.y + 1 && o.y >= t.y - 15 && o.x >= t.x - 1)
      .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
    if (next) return { n: Number(next.text.trim()), of: total };
  }
  return null;
}

/** One text listing for the AI: per sheet (split by the border frames), rows in reading order. */
export function cadToText(entities: CadEntity[], name = 'drawing'): string {
  const texts = entities.filter((e): e is DxfText => 'text' in e);
  if (!texts.length) return `${name}: no text found in this drawing (it may hold only geometry). Export the drawing to PDF instead.`;
  const frames = sheetFrames(entities);
  // rows: texts within a small fraction of a sheet's height (or 2.5 units without frames) are one row
  const rowH = frames.length ? (frames[0].y2 - frames[0].y1) / 120 : 2.5;
  if (frames.length < 2) return `${name} (CAD drawing, ${texts.length} text items, top to bottom; [layer]):\n${textRows(texts, rowH).join('\n')}`;
  const used = new Set<DxfText>();
  const sheets = frames.map((f, i) => {
    const mine = texts.filter((t) => !used.has(t) && inside(f, t.x, t.y));
    mine.forEach((t) => used.add(t));
    const title = sheetTitle(mine);
    // the sheet's own number (sheets 2, 3, 5, 6 of an 8-sheet set), else its place in the file
    const no = sheetNumber(mine);
    const label = no ? `Sheet ${no.n}${no.of ? ` of ${no.of}` : ''}${no.of !== frames.length ? ` (frame ${i + 1} of ${frames.length} in this file)` : ''}` : `Sheet ${i + 1} of ${frames.length}`;
    return `--- ${label}${title ? `: ${title}` : ''} ---\n${textRows(mine, rowH).join('\n')}`;
  });
  const rest = texts.filter((t) => !used.has(t));
  return `${name} (CAD drawing, ${frames.length} sheets side by side, split by their border frames; ${texts.length} text items; [layer]):\n${sheets.join('\n')}${rest.length ? `\n--- Outside the sheet frames ---\n${textRows(rest, rowH).join('\n')}` : ''}`;
}

/** A DXF file as text for the AI (see cadToText). */
export const dxfToText = (dxf: string, name = 'drawing.dxf') => cadToText(parseDxfEntities(dxf), name);
