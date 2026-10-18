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
 * Reader for DWG files in the browser (none is bundled). In the Windows app a DWG is converted to DXF by GNU
 * LibreDWG's dwg2dxf, shipped with the installer (electron/dwgReader.cjs); in the browser the upload says to
 * use DXF or PDF.
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
    .replace(/\\~/g, ' ')
    .replace(/\\p[^;\\]*;/g, '')
    .replace(/\\[ACFHQTW][^;\\]*;/gi, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\S([^;^/#]*)[\^/#]([^;]*);/g, '$1/$2')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±')
    .replace(/(\d+(?:\.\d+)?)\s*平方(?!米)/g, '$1平方 ($1 mm²)')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One DXF entity as read: its type, layer and group codes (in order; a code may repeat). */
interface RawEnt { type: string; layer: string; codes: [string, string][] }

const num = (e: RawEnt, code: string, def = 0) => { const v = e.codes.find(([c]) => c === code); return v ? Number(v[1]) || 0 : def; };
const str = (e: RawEnt, code: string) => e.codes.find(([c]) => c === code)?.[1].trim() ?? '';

/** The DXF as sections of raw entities; BLOCKS split into named blocks with their base point. */
function readSections(dxf: string): { entities: RawEnt[]; blocks: Map<string, { base: [number, number]; ents: RawEnt[] }> } {
  const lines = dxf.split(/\r?\n/);
  const entities: RawEnt[] = [];
  const blocks = new Map<string, { base: [number, number]; ents: RawEnt[] }>();
  let section = '';
  let block: { name: string; base: [number, number]; ents: RawEnt[] } | null = null;
  let cur: RawEnt | null = null;
  let expectSectionName = false;
  const done = () => {
    if (!cur) return;
    const e = cur;
    cur = null;
    if (e.type === 'BLOCK') { block = { name: str(e, '2'), base: [num(e, '10'), num(e, '20')], ents: [] }; return; }
    if (e.type === 'ENDBLK') { if (block) blocks.set(block.name, { base: block.base, ents: block.ents }); block = null; return; }
    if (section === 'ENTITIES') entities.push(e);
    else if (section === 'BLOCKS' && block) block.ents.push(e);
  };
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1];
    if (code === '0') {
      done();
      const type = value.trim();
      if (type === 'SECTION') { expectSectionName = true; continue; }
      if (type === 'ENDSEC') { section = ''; continue; }
      cur = { type, layer: '', codes: [] };
      continue;
    }
    if (expectSectionName && code === '2') { section = value.trim(); expectSectionName = false; continue; }
    if (!cur) continue;
    if (code === '8') cur.layer = value.trim();
    cur.codes.push([code, value]);
  }
  done();
  // a file with no SECTION markers (a bare entity list) is all entities
  if (!entities.length && !blocks.size && !/\bSECTION\b/.test(dxf)) return readSections(`0\nSECTION\n2\nENTITIES\n${dxf}\n0\nENDSEC`);
  return { entities, blocks };
}

/** A transform from a block's coordinates to the drawing: insertion point, scale, rotation (degrees), block base. */
interface Xf { x: number; y: number; sx: number; sy: number; rot: number; bx: number; by: number }
const apply = (t: Xf[], px: number, py: number): [number, number] => {
  let x = px, y = py;
  for (const f of t) {
    const dx = (x - f.bx) * f.sx, dy = (y - f.by) * f.sy;
    const c = Math.cos(f.rot * Math.PI / 180), s = Math.sin(f.rot * Math.PI / 180);
    x = f.x + dx * c - dy * s;
    y = f.y + dx * s + dy * c;
  }
  return [x, y];
};

/**
 * Entities of a DXF file, in drawing coordinates: text (TEXT, MTEXT, ATTRIB, and DIMENSION text), lines and
 * polylines (LWPOLYLINE and the old POLYLINE / VERTEX). Block definitions are not drawing content by
 * themselves: each INSERT draws its block where it is placed (position, scale, rotation), and a DIMENSION
 * draws its own block (its text). A converter that repeats an entity (LibreDWG's "stale" subentities)
 * gives it once.
 */
export function parseDxfEntities(dxf: string): CadEntity[] {
  const { entities, blocks } = readSections(dxf);
  const out: CadEntity[] = [];
  const seen = new Set<string>();
  const push = (e: CadEntity) => {
    const key = 'text' in e ? `${e.type}|${e.text}|${e.x.toFixed(3)}|${e.y.toFixed(3)}` : `${e.type}|${e.points.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(';')}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };
  const walk = (list: RawEnt[], t: Xf[], depth: number, layerOf: (l: string) => string) => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const layer = layerOf(e.layer);
      if (e.type === 'TEXT' || e.type === 'MTEXT' || e.type === 'ATTRIB') {
        // MTEXT splits long text over code 3 (chunks) then code 1 (the rest)
        const text = cleanDxfText(e.codes.filter(([c]) => c === '1' || (c === '3' && e.type === 'MTEXT')).map(([, v]) => v).join(''));
        if (!text) continue;
        const [x, y] = apply(t, num(e, '10'), num(e, '20'));
        const attr = e.type === 'ATTRIB' ? str(e, '2') : '';
        push({ type: e.type, layer, x, y, text, ...(attr ? { attr } : {}) });
      } else if (e.type === 'LINE') {
        push({ type: 'LINE', layer, points: [apply(t, num(e, '10'), num(e, '20')), apply(t, num(e, '11'), num(e, '21'))] });
      } else if (e.type === 'LWPOLYLINE') {
        const xs = e.codes.filter(([c]) => c === '10').map(([, v]) => Number(v) || 0);
        const ys = e.codes.filter(([c]) => c === '20').map(([, v]) => Number(v) || 0);
        if (xs.length) push({ type: 'LWPOLYLINE', layer, points: xs.map((x, k) => apply(t, x, ys[k] ?? 0)), closed: (num(e, '70') & 1) === 1 });
      } else if (e.type === 'POLYLINE') {
        // the old form: its VERTEX entities follow, up to SEQEND. A 3D polyline (flag 8) is drawn flat; a
        // polygon or polyface mesh (flags 16 / 64) is a surface, not a path: its vertices are skipped.
        const mesh = (num(e, '70') & (16 | 64)) !== 0;
        const pts: [number, number][] = [];
        let j = i + 1;
        for (; j < list.length && list[j].type === 'VERTEX'; j++) {
          if (mesh) continue;
          const p = apply(t, num(list[j], '10'), num(list[j], '20'));
          if (!pts.length || pts[pts.length - 1][0] !== p[0] || pts[pts.length - 1][1] !== p[1]) pts.push(p);
        }
        i = j < list.length && list[j].type === 'SEQEND' ? j : j - 1;
        if (pts.length) push({ type: 'LWPOLYLINE', layer, points: pts, closed: (num(e, '70') & 1) === 1 });
      } else if ((e.type === 'INSERT' || e.type === 'DIMENSION') && depth < 8) {
        const b = blocks.get(str(e, '2'));
        if (e.type === 'DIMENSION') {
          // the dimension's block holds its lines and its text, already in place
          if (b) walk(b.ents, t, depth + 1, (l) => (l === '0' || !l ? layer : l));
          else {
            const over = e.codes.find(([c]) => c === '1')?.[1] ?? '';
            const value = String(Math.round(num(e, '42') * 100) / 100);
            const text = cleanDxfText(!over ? value : over.replace('<>', value));
            const [x, y] = apply(t, num(e, '11'), num(e, '21'));
            if (text) push({ type: 'TEXT', layer, x, y, text });
          }
          continue;
        }
        if (!b) continue;
        // MINSERT: a grid of columns × rows at the given spacing (in the block's rotated frame)
        const cols = Math.max(1, num(e, '70', 1)), rows = Math.max(1, num(e, '71', 1));
        const dx = num(e, '44'), dy = num(e, '45'), rot = num(e, '50');
        const c = Math.cos(rot * Math.PI / 180), sn = Math.sin(rot * Math.PI / 180);
        for (let r = 0; r < Math.min(rows, 100); r++) {
          for (let k = 0; k < Math.min(cols, 100); k++) {
            const ox = k * dx * c - r * dy * sn, oy = k * dx * sn + r * dy * c;
            const f: Xf = { x: num(e, '10') + ox, y: num(e, '20') + oy, sx: num(e, '41', 1) || 1, sy: num(e, '42', 1) || 1, rot, bx: b.base[0], by: b.base[1] };
            // entities on layer 0 inside a block take the INSERT's layer
            walk(b.ents, [f, ...t], depth + 1, (l) => (l === '0' || !l ? layer : l));
          }
        }
      }
      // ATTDEF (a block's placeholder), SEQEND, VERTEX on their own and everything else: not drawing text
    }
  };
  walk(entities, [], 0, (l) => l);
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
    const value = right ?? below;
    if (!value) return '';
    // a bilingual title: the English line just under the Chinese one ("主电源分配" over "Power distribution")
    const under = /[\u4e00-\u9fff]/.test(value.text) && !/[A-Za-z]{3}/.test(value.text)
      ? values.find((t) => t !== value && t.y < value.y && value.y - t.y <= 8 && Math.abs(t.x - value.x) < 30 && /^[A-Za-z]/.test(t.text.trim()) && !/[\u4e00-\u9fff]/.test(t.text))
      : undefined;
    return under ? `${value.text.trim()} / ${under.text.trim()}` : value.text.trim();
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
  const perSheet = frames.map((f, i) => {
    const mine = texts.filter((t) => !used.has(t) && inside(f, t.x, t.y));
    mine.forEach((t) => used.add(t));
    const title = sheetTitle(mine);
    // the sheet's own number (sheets 2, 3, 5, 6 of an 8-sheet set), else its place in the file
    const no = sheetNumber(mine);
    const label = no ? `Sheet ${no.n}${no.of ? ` of ${no.of}` : ''}${no.of !== frames.length ? ` (frame ${i + 1} of ${frames.length} in this file)` : ''}` : `Sheet ${i + 1} of ${frames.length}`;
    return { head: `--- ${label}${title ? `: ${title}` : ''} ---`, rows: textRows(mine, rowH) };
  });
  // Rows repeated word for word on 3+ sheets (the title block's company, drawn-by, project…) are given once,
  // on the first sheet: a big set otherwise repeats them on every sheet (the sheet numbers and titles differ, so they stay).
  const onSheets = new Map<string, number>();
  for (const sh of perSheet) for (const r of new Set(sh.rows)) onSheets.set(r, (onSheets.get(r) ?? 0) + 1);
  const repeated = new Set([...onSheets].filter(([, n]) => n >= 3).map(([r]) => r));
  const seen = new Set<string>();
  const sheets = perSheet.map((sh) => [sh.head, ...sh.rows.filter((r) => !repeated.has(r) || (!seen.has(r) && seen.add(r)))].join('\n'));
  const rest = texts.filter((t) => !used.has(t));
  return `${name} (CAD drawing, ${frames.length} sheets side by side, split by their border frames; ${texts.length} text items; [layer]${repeated.size ? `; ${repeated.size} rows repeated on every sheet (title block) are given on the first sheet only` : ''}):\n${sheets.join('\n')}${rest.length ? `\n--- Outside the sheet frames ---\n${textRows(rest, rowH).join('\n')}` : ''}`;
}

/** A DXF file as text for the AI (see cadToText). */
export const dxfToText = (dxf: string, name = 'drawing.dxf') => cadToText(parseDxfEntities(dxf), name);
