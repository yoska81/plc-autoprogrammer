/**
 * The electrical drawing set as DXF: one file per sheet, rendered from the same sheet components as the
 * PDF (rendered off-screen in the page → svgToDxf), so the CAD files match the drawings sheet for sheet.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { DrawingContext } from '../derive';
import SheetView from '../drawings/SheetView';
import { planDrawings } from '../drawings/plan';
import { parseSvg } from './svgTree';
import { svgToDxf, type CadDevice, type SheetDxfStats } from './svgToDxf';

export interface SheetDxf { n: number; title: string; drawingNo: string; kind: string; fileName: string; dxf: string; stats: SheetDxfStats }

const slug = (s: string) => s.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

/** Device tag → description / part / manufacturer, for the ISA_DEVICE block attributes. */
export function cadDevices(ctx: DrawingContext): Map<string, CadDevice> {
  const map = new Map<string, CadDevice>();
  for (const c of ctx.design.components) {
    if (!c.tag || map.has(c.tag)) continue;
    map.set(c.tag, { tag: c.tag, desc: c.function ?? '', part: c.partNumber ?? '', mfr: ctx.getPart(c.partNumber)?.manufacturer ?? '' });
  }
  for (const w of ctx.design.ioWiring) {
    if (w.deviceTag && !map.has(w.deviceTag)) map.set(w.deviceTag, { tag: w.deviceTag, desc: w.description, part: '', mfr: '' });
  }
  return map;
}

/** Every sheet of the drawing set as DXF (mm, 1:1 on the sheet's paper size). */
export function drawingSetDxf(ctx: DrawingContext): SheetDxf[] {
  const plan = planDrawings(ctx);
  const devices = cadDevices(ctx);
  // Each sheet is rendered into a hidden container and read back as markup (the same React components as
  // the PDF; no server renderer in the app bundle).
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1200px;height:1200px;overflow:hidden;pointer-events:none;opacity:0;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    return plan.sheets.map((sheet) => {
      flushSync(() => root.render(createElement(SheetView, { plan, sheet })));
      const { dxf, stats } = svgToDxf(parseSvg(host.innerHTML), { devices });
      return { n: sheet.n, title: sheet.title, drawingNo: sheet.drawingNo, kind: sheet.spec.kind, fileName: `${String(sheet.n).padStart(2, '0')}_${slug(sheet.drawingNo || '')}_${slug(sheet.title)}.dxf`.replace(/__+/g, '_'), dxf, stats };
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

export const AUTOCAD_README = (project: string, sheets: SheetDxf[], dwg: boolean) => `${project} — electrical drawings for AutoCAD
${'='.repeat(project.length + 34)}

${sheets.length} sheets, one file per sheet, drawn 1:1 in millimetres on the sheet's paper
(the title block and border included). ${dwg ? 'DWG files (AutoCAD 2018 format, converted with the ODA File Converter) and the source DXF files.' : 'DXF files (AutoCAD DXF, R2007 / AC1021 format; opens directly in AutoCAD 2007 and later, AutoCAD LT and AutoCAD Electrical).'}

Layers
  BORDER    sheet frame, zones, title block
  SYMS      device symbols
  WIRES     wires on the schematic sheets
  WIRENO    wire numbers (block ISA_WIRENO, attribute WIRENO)
  TAGS      device tags (block ISA_DEVICE)
  TEXT      other text
  GRAPHICS  tables, layouts and other graphics

Text styles: ISA_SANS (arial.ttf) and ISA_MONO (cour.ttf).

Blocks with attributes (AutoCAD Electrical attribute names)
  ISA_DEVICE  one reference at every device tag on the drawings:
              TAG1 (visible), DESC1 (description), MFG (manufacturer), CAT (catalogue / part number)
  ISA_WIRENO  one reference at every wire number: WIRENO

Use ATTEXT / DATAEXTRACTION (or EATTEXT) on ISA_DEVICE to list the devices with their parts.
The symbols are plain geometry: in AutoCAD Electrical, swap them for library symbols (or use
the tags and wire numbers with "Copy component" / "Wire number" tools) if you continue the
design there.

Sheets
${sheets.map((s) => `  ${s.fileName}  —  ${s.drawingNo}  ${s.title}`).join('\n')}
`;
