import { hmiReadme, hmiTagCsv, needsHmiTagList } from './hmiTags';
import { exportContext, hmiExtraTags } from './exportContext';
import { sheetOnPaper } from '../standards/regions';
import { backPanelDxf, doorDxf, enclosureFaceDxfs } from '../electrical/dxf';
import { cabinetStep } from '../electrical/step/cabinetStep';
import { createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ProjectSnapshot } from './collect';
import SheetView from '../electrical/drawings/SheetView';
import { planDrawings } from '../electrical/drawings/plan';
import HmiScreenView from '../hmi/HmiScreenView';
import { svgToPngDataUrl } from '../hmi/svgToPng';
import { drawEachScreen, hmiImagesNote, type HmiImage, type HmiImageFailure } from './hmiImages';
import { LOOK_LABEL, lookOf } from '../hmi/theme';
import { getHmi } from '../hmi/hmiCatalog';
import { bomCsv, terminalPlanCsv, buildModel, type DrawingContext, type DrillingPlan } from '../electrical/derive';
import { driveParamsCsv } from '../electrical/vfd';
import { analogSetup, analogSetupCsv } from '../plc/core/analog';
import { moduleSlots } from '../plc/core/modules';
import { clickNicknameCsv, clickRungListing } from '../plc/core/clickExport';
import { clickEntrySheetHtml } from '../plc/core/clickEntrySheet';
import { buildExcelReport } from './excelReport';
import { buildEngineeringPdf } from './engineering';
import { cabinetPng } from '../electrical/render/renderToPng';
import { cableScheduleCsvWithNotes, wireListCsvWithNotes } from '../edits/lists';
import { MACHINE_SPEC_KEY, textOr } from '../edits/useEditsStore';

/** Render React content off-screen, let the caller read the DOM, then clean up. `sync`: committed at once (no settling wait). */
async function renderOffscreen<T>(el: ReactElement, read: (host: HTMLElement) => Promise<T>, sync = false): Promise<T> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1700px;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    if (sync) flushSync(() => root.render(el));
    else root.render(el);
    await new Promise((r) => setTimeout(r, sync ? 0 : 300)); // let React commit and layout settle
    // a busy page (a big project, other work) may not have committed yet: wait for the content (up to 10 s)
    for (let t = 0; !host.firstElementChild && t < 200; t++) await new Promise((r) => setTimeout(r, 50));
    return await read(host);
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Drawing sheets as a vector PDF, one page per sheet on the project's paper. The sheets are drawn and
 * converted a few at a time, one sheet per task, so the page stays responsive while a 50-sheet set is made.
 */
async function sheetsPdf(ctx: DrawingContext, sheetEls: ReactElement[], title: string): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const on = sheetOnPaper(ctx.sheet);
  const PW = on.paper.w, PH = on.paper.h;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PW, PH] });
  doc.setProperties({ title: `${ctx.projectName} — ${title}`, creator: 'ISA Auto Programmer' });
  const BATCH = 6;
  let pages = 0;
  for (let b = 0; b < sheetEls.length; b += BATCH) {
    await renderOffscreen(createElement('div', null, ...sheetEls.slice(b, b + BATCH)), async (host) => {
      for (const svg of host.querySelectorAll<SVGSVGElement>(`svg[viewBox="0 0 ${PW} ${PH}"]`)) {
        if (pages++ > 0) doc.addPage([PW, PH], 'landscape');
        await doc.svg(svg, { x: on.x, y: on.y, width: on.w, height: on.h });
        await new Promise((r) => setTimeout(r, 0));
      }
    }, true);
  }
  if (!pages) throw new Error('No drawing sheets were produced.');
  return doc.output('blob');
}

/** Electrical drawing set as a vector PDF, one page per sheet on the project's paper (ANSI B 17x11 or A3). */
export async function buildDrawingsPdf(p: ProjectSnapshot): Promise<Blob | null> {
  if (!p.drawingCtx) return null;
  const plan = planDrawings(p.drawingCtx);
  return sheetsPdf(p.drawingCtx, plan.sheets.map((s) => createElement(SheetView, { key: s.n, plan, sheet: s })), 'Electrical drawings');
}

/**
 * Machining drawings as a PDF next to the 1:1 DXFs: the back-panel drilling and / or door cutout
 * sheets of the drawing set (dimensions from the datum, hole table, title block with the sheet
 * scale) on the project's paper. Null when the design has nothing to machine there.
 */
export async function buildMachiningPdf(ctx: DrawingContext, which: DrillingPlan['kind'] | 'walls' | 'all' = 'all'): Promise<Blob | null> {
  const plan = planDrawings(ctx);
  const isWall = (k: DrillingPlan['kind']) => k !== 'backpanel' && k !== 'door';
  const sheets = plan.sheets.filter((s) => s.spec.kind === 'drill' && (which === 'all' || s.spec.drill.kind === which || (which === 'walls' && isWall(s.spec.drill.kind))));
  if (!sheets.length) return null;
  return sheetsPdf(ctx, sheets.map((s) => createElement(SheetView, { key: s.n, plan, sheet: s })), 'Machining drawings');
}

/**
 * Every HMI screen as a PNG at the panel's native resolution, in the design's look. A screen that fails to
 * draw is left out and added to `failed` (when given), so one screen never stops the download.
 */
export async function buildHmiImages(p: ProjectSnapshot, failed?: HmiImageFailure[]): Promise<HmiImage[]> {
  const model = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  if (!p.hmi || !model) return [];
  const design = p.hmi;
  const r = await drawEachScreen(design.screens, (screen) => renderOffscreen(
    createElement(HmiScreenView, { screen, widthPx: model.widthPx, heightPx: model.heightPx, design }),
    async (host) => {
      const svg = host.querySelector('svg');
      if (!svg) throw new Error(`HMI screen "${screen.name}" could not be drawn for its image.`);
      return svgToPngDataUrl(svg, model.widthPx, model.heightPx);
    },
  ));
  failed?.push(...r.failed);
  return r.images;
}

/** HMI screens as one PDF (one page per screen, with the screen name). */
export async function buildHmiPdf(p: ProjectSnapshot, images: HmiImage[]): Promise<Blob | null> {
  const model = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  if (!p.hmi || !model || !images.length) return null;
  const { jsPDF } = await import('jspdf');
  const { docMeta } = await import('./docs/meta');
  const { pdfSafe } = await import('./docs/pdfWriter');
  const m = docMeta(p);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  doc.setProperties({ title: `${p.projectName} — HMI screens`, creator: 'ISA Auto Programmer' });
  const pageW = 279.4, pageH = 215.9, margin = 15;
  // room for the running header (top) and the document-control footer (bottom)
  const top = margin + 6, bottom = pageH - margin - 6;
  const scale = Math.min((pageW - 2 * margin) / model.widthPx, (bottom - top - 12) / model.heightPx);
  // one page per screen (the package's bookmarks count on it); a screen that could not be drawn says so
  const screens = p.hmi.screens;
  screens.forEach((screen, i) => {
    if (i > 0) doc.addPage('letter', 'landscape');
    const img = images.find((x) => x.screen === i);
    doc.setFontSize(14);
    doc.text(pdfSafe(`${screen.name} — HMI ${model.partNumber} — ${LOOK_LABEL[lookOf(p.hmi)]} look`), margin, top);
    doc.setFontSize(9);
    doc.text(pdfSafe(screen.purpose.slice(0, 160)), margin, top + 6);
    if (img) doc.addImage(img.dataUrl, 'PNG', margin, top + 10, model.widthPx * scale, model.heightPx * scale, undefined, 'FAST');
    else doc.text('This screen could not be drawn as an image. It is in the project: open it in the HMI editor.', margin, top + 16);
    // document control on every page: project, revision and date, status, page i of n
    doc.setFontSize(8);
    doc.text(pdfSafe(m.company || ''), margin, margin - 3);
    doc.text(pdfSafe(`${p.projectName} — HMI screens${m.projectNumber ? ` — ${m.projectNumber}` : ''}`), pageW - margin, margin - 3, { align: 'right' });
    doc.setDrawColor(184, 192, 204);
    doc.setLineWidth(0.2);
    doc.line(margin, margin - 1.5, pageW - margin, margin - 1.5);
    doc.line(margin, pageH - margin + 1, pageW - margin, pageH - margin + 1);
    doc.setFontSize(7);
    doc.text(pdfSafe(`${m.status} · Rev ${m.rev.rev} · ${m.rev.date}`), margin, pageH - margin + 5);
    doc.text(`Page ${i + 1} of ${screens.length}`, pageW - margin, pageH - margin + 5, { align: 'right' });
  });
  return doc.output('blob');
}

/** PLC program files for the selected PLC. */
/** Analog channel setup for the PLC software (only when the I/O list has analog points). */
function analogFiles(p: ProjectSnapshot): { name: string; content: string }[] {
  const rows = analogSetup(p.profile, p.cpu, moduleSlots(p.modules), p.io);
  return rows.length ? [{ name: `${p.fileBase}_analog_setup.csv`, content: analogSetupCsv(rows) }] : [];
}

export function programFiles(p: ProjectSnapshot): { name: string; content: string }[] {
  if (p.profile.language === 'st') return p.stCode ? [{ name: `${p.fileBase}.st`, content: p.stCode }] : [];
  // the analog channel setup is PLC configuration: it ships before any program exists
  if (!p.ladder.rungs.length) return analogFiles(p);
  const header = `${p.projectName} — ${p.profile.name} ${p.cpu.id}`;
  const hmiTags = hmiExtraTags(p);
  // Tag-based PLCs (Logix …): the profile's own exporters write the vendor files.
  if (p.profile.id !== 'click' && p.profile.exporters?.length) {
    const ctx = exportContext(p);
    return [
      ...p.profile.exporters.map((e) => ({ name: e.fileName(p.fileBase), content: e.build(p.ladder, ctx) })),
      { name: `${p.fileBase}_program.json`, content: JSON.stringify(p.ladder, null, 2) },
      ...analogFiles(p),
    ];
  }
  return [
    { name: `${p.fileBase}_CLICK_entry_sheet.html`, content: clickEntrySheetHtml(p.ladder, new Map([...p.ladder.tags.map((t) => [t.address.toUpperCase(), t.nickname.replace(/_/g, ' ')] as const), ...p.labels]), header, [`CPU ${p.cpu.id}`, ...p.modules.map((m, k) => `slot ${k + 1}: ${m}`)]) },
    { name: `${p.fileBase}_rungs.txt`, content: clickRungListing(p.ladder, p.labels, header) },
    { name: `${p.fileBase}_nicknames.csv`, content: clickNicknameCsv(p.ladder, p.io, p.addresses, hmiTags) },
    { name: `${p.fileBase}_program.json`, content: JSON.stringify(p.ladder, null, 2) },
    ...analogFiles(p),
  ];
}

export function ioCsv(p: ProjectSnapshot): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return ['ID,PLC Address,Type,Category,Description', ...p.io.map((x) => [x.id, p.addresses.get(x.id) ?? '', x.type, x.category, x.description].map(cell).join(','))].join('\r\n');
}

/** A data: URL as a Blob, decoded here: fetch() of a data URL can be blocked by the preview frame's content policy. */
export async function dataUrlToBlob(url: string): Promise<Blob> {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) return (await fetch(url)).blob();
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: m[1] });
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] || 'application/octet-stream' });
}

/** Everything in one ZIP. */
/** `failed`: filled with the HMI screens that could not be drawn (the ZIP has a note for them, and so can the page). */
export async function buildEverythingZip(p: ProjectSnapshot, onProgress?: (step: string) => void, failed: HmiImageFailure[] = []): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const pre: import('./fullPackage').Prebuilt = {};
  onProgress?.('Excel report');
  zip.file(`${p.fileBase}_report.xlsx`, await buildExcelReport(p));
  zip.file('io_list.csv', ioCsv(p));
  if (p.drawingCtx) {
    onProgress?.('Electrical drawings');
    pre.drawings = await buildDrawingsPdf(p);
    if (pre.drawings) zip.file(`electrical/${p.fileBase}_drawings.pdf`, pre.drawings);
    zip.file('electrical/bom.csv', bomCsv(p.drawingCtx));
    zip.file('electrical/wire_list.csv', wireListCsvWithNotes(p.drawingCtx));
    zip.file('electrical/terminal_plan.csv', terminalPlanCsv(p.drawingCtx));
    zip.file('electrical/cable_schedule.csv', cableScheduleCsvWithNotes(p.drawingCtx));
    const drives = buildModel(p.drawingCtx).drives;
    if (drives.length) zip.file('electrical/drive_parameters.csv', driveParamsCsv(drives));
    // 1:1 machining files: inches (default for the shop) and the same geometry in millimetres.
    for (const units of ['in', 'mm'] as const) {
      zip.file(`electrical/machining/back_panel_drilling_1to1_${units}.dxf`, backPanelDxf(p.drawingCtx, { units }));
      zip.file(`electrical/machining/door_cutouts_1to1_${units}.dxf`, doorDxf(p.drawingCtx, { units }));
      for (const f of enclosureFaceDxfs(p.drawingCtx, { units })) zip.file(`electrical/machining/enclosure_${f.face}_cutouts_1to1_${units}.dxf`, f.dxf);
    }
    // ... and the same parts as dimensioned drawings to print for the shop.
    onProgress?.('Machining drawings');
    const bpPdf = await buildMachiningPdf(p.drawingCtx, 'backpanel');
    if (bpPdf) zip.file(`electrical/machining/${p.fileBase}_back_panel_drilling.pdf`, bpPdf);
    const doorPdf = await buildMachiningPdf(p.drawingCtx, 'door');
    if (doorPdf) zip.file(`electrical/machining/${p.fileBase}_door_cutouts.pdf`, doorPdf);
    const wallsPdf = await buildMachiningPdf(p.drawingCtx, 'walls');
    if (wallsPdf) zip.file(`electrical/machining/${p.fileBase}_enclosure_cutouts.pdf`, wallsPdf);
    zip.file(`electrical/3d/${p.fileBase}_cabinet.step`, cabinetStep(p.drawingCtx));
    onProgress?.('Cabinet pictures');
    const hmiPart = p.hmi?.hmiPartNumber ?? null;
    zip.file('electrical/cabinet_inside.png', await dataUrlToBlob(await cabinetPng(p.drawingCtx, 'inside', hmiPart, 2400)));
    zip.file('electrical/cabinet_door.png', await dataUrlToBlob(await cabinetPng(p.drawingCtx, 'door', hmiPart, 2400)));
  }
  if (p.hmi) {
    onProgress?.('HMI screens');
    const images = await buildHmiImages(p, failed);
    for (const img of images) zip.file(`hmi/${img.name}`, await dataUrlToBlob(img.dataUrl));
    if (failed.length) zip.file('hmi/SCREENS_NOT_DRAWN.txt', hmiImagesNote(failed));
    pre.hmiPdf = await buildHmiPdf(p, images);
    if (pre.hmiPdf) zip.file(`hmi/${p.fileBase}_hmi_screens.pdf`, pre.hmiPdf);
    // Panels of other makers: the tag list bound to the PLC program's tags and how to rebuild the screens.
    if (needsHmiTagList(p)) {
      zip.file(`hmi/${p.fileBase}_hmi_tags.csv`, hmiTagCsv(p));
      zip.file('hmi/README.txt', hmiReadme(p));
    }
  }
  onProgress?.('Engineering package');
  pre.engineering = await buildEngineeringPdf(p, p.equipment);
  zip.file(`${p.fileBase}_engineering_package.pdf`, pre.engineering);
  for (const f of programFiles(p)) zip.file(`plc/${f.name}`, f.content);
  const { buildProgramListingPdf } = await import('./programListingPdf');
  const listing = await buildProgramListingPdf(p);
  if (listing) zip.file(`plc/${p.fileBase}_program_listing.pdf`, listing);
  // Labels and the complete package PDF (reuses the PDFs built above).
  const { addPackageToZip } = await import('./fullPackage');
  await addPackageToZip(zip, p, pre, onProgress);
  // the full machine specification (sections, answered questions, equipment), not the raw intake text
  const { machineSpecText } = await import('./machineSpec');
  // The user's own version of the text when they rewrote it on the Deliverables page.
  zip.file('spec.md', textOr(MACHINE_SPEC_KEY, machineSpecText(p)));
  onProgress?.('Packing');
  return zip.generateAsync({ type: 'blob' });
}

export { saveBlobResult, saveBlob } from './save';
