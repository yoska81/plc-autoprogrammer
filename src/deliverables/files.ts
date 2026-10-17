import { hmiReadme, hmiTagCsv, needsHmiTagList } from './hmiTags';
import { exportContext, hmiExtraTags } from './exportContext';
import { sheetOnPaper } from '../standards/regions';
import { IS_PREVIEW } from '../preview/mode';
import { saveViaAccount } from '../preview/claudeAccount';
import { notify } from '../store/useNoticeStore';
import { desktopBridge } from '../desktop/bridge';
import { backPanelDxf, doorDxf, enclosureFaceDxfs } from '../electrical/dxf';
import { cabinetStep } from '../electrical/step/cabinetStep';
import { createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectSnapshot } from './collect';
import DrawingSet from '../electrical/drawings/DrawingSet';
import SheetView from '../electrical/drawings/SheetView';
import { planDrawings } from '../electrical/drawings/plan';
import HmiScreenView from '../hmi/HmiScreenView';
import { svgToPngDataUrl } from '../hmi/svgToPng';
import { LOOK_LABEL, lookOf } from '../hmi/theme';
import { getHmi } from '../hmi/hmiCatalog';
import { bomCsv, terminalPlanCsv, buildModel, type DrawingContext, type DrillingPlan } from '../electrical/derive';
import { driveParamsCsv } from '../electrical/vfd';
import { analogSetup, analogSetupCsv } from '../plc/core/analog';
import { moduleSlots } from '../plc/core/modules';
import { clickNicknameCsv, clickRungListing } from '../plc/core/clickExport';
import { buildExcelReport } from './excelReport';
import { buildEngineeringPdf } from './engineering';
import { cabinetPng } from '../electrical/render/renderToPng';
import { cableScheduleCsvWithNotes, wireListCsvWithNotes } from '../edits/lists';
import { MACHINE_SPEC_KEY, textOr } from '../edits/useEditsStore';

/** Render React content off-screen, let the caller read the DOM, then clean up. */
async function renderOffscreen<T>(el: ReactElement, read: (host: HTMLElement) => Promise<T>): Promise<T> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1700px;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(el);
    await new Promise((r) => setTimeout(r, 300)); // let React commit and layout settle
    return await read(host);
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Drawing sheets rendered by `el` as a vector PDF, one page per sheet on the project's paper. */
async function sheetsPdf(ctx: DrawingContext, el: ReactElement, title: string): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const on = sheetOnPaper(ctx.sheet);
  const PW = on.paper.w, PH = on.paper.h;
  return renderOffscreen(el, async (host) => {
    const sheets = [...host.querySelectorAll<SVGSVGElement>(`svg[viewBox="0 0 ${PW} ${PH}"]`)];
    if (!sheets.length) throw new Error('No drawing sheets were produced.');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PW, PH] });
    doc.setProperties({ title: `${ctx.projectName} — ${title}`, creator: 'ISA Auto Programmer' });
    for (let i = 0; i < sheets.length; i++) {
      if (i > 0) doc.addPage([PW, PH], 'landscape');
      await doc.svg(sheets[i], { x: on.x, y: on.y, width: on.w, height: on.h });
    }
    return doc.output('blob');
  });
}

/** Electrical drawing set as a vector PDF, one page per sheet on the project's paper (ANSI B 17x11 or A3). */
export async function buildDrawingsPdf(p: ProjectSnapshot): Promise<Blob | null> {
  if (!p.drawingCtx) return null;
  return sheetsPdf(p.drawingCtx, createElement(DrawingSet, { ctx: p.drawingCtx, printMode: true }), 'Electrical drawings');
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
  return sheetsPdf(ctx, createElement('div', null, ...sheets.map((s) => createElement(SheetView, { key: s.n, plan, sheet: s }))), 'Machining drawings');
}

/** Every HMI screen as a PNG at the panel's native resolution, in the design's look. */
export async function buildHmiImages(p: ProjectSnapshot): Promise<{ name: string; dataUrl: string }[]> {
  const model = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  if (!p.hmi || !model) return [];
  const out: { name: string; dataUrl: string }[] = [];
  for (const [i, screen] of p.hmi.screens.entries()) {
    const dataUrl = await renderOffscreen(
      createElement(HmiScreenView, { screen, widthPx: model.widthPx, heightPx: model.heightPx, design: p.hmi }),
      async (host) => svgToPngDataUrl(host.querySelector('svg')!, model.widthPx, model.heightPx),
    );
    out.push({ name: `${String(i + 1).padStart(2, '0')}_${screen.name.replace(/[^\w-]+/g, '_')}.png`, dataUrl });
  }
  return out;
}

/** HMI screens as one PDF (one page per screen, with the screen name). */
export async function buildHmiPdf(p: ProjectSnapshot, images: { name: string; dataUrl: string }[]): Promise<Blob | null> {
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
  images.forEach((img, i) => {
    if (i > 0) doc.addPage('letter', 'landscape');
    const screen = p.hmi!.screens[i];
    doc.setFontSize(14);
    doc.text(pdfSafe(`${screen.name} — HMI ${model.partNumber} — ${LOOK_LABEL[lookOf(p.hmi)]} look`), margin, top);
    doc.setFontSize(9);
    doc.text(pdfSafe(screen.purpose.slice(0, 160)), margin, top + 6);
    doc.addImage(img.dataUrl, 'PNG', margin, top + 10, model.widthPx * scale, model.heightPx * scale, undefined, 'FAST');
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
    doc.text(`Page ${i + 1} of ${images.length}`, pageW - margin, pageH - margin + 5, { align: 'right' });
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

const dataUrlToBlob = async (url: string) => (await fetch(url)).blob();

/** Everything in one ZIP. */
export async function buildEverythingZip(p: ProjectSnapshot, onProgress?: (step: string) => void): Promise<Blob> {
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
    const images = await buildHmiImages(p);
    for (const img of images) zip.file(`hmi/${img.name}`, await dataUrlToBlob(img.dataUrl));
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

/** Save a file: download in the browser, Save dialog in the Windows app, the account's save in the preview. */
export function saveBlobResult(name: string, blob: Blob): Promise<{ ok: boolean; path?: string }> {
  // The preview can't download directly: the viewer's Claude app offers the file.
  if (IS_PREVIEW) {
    return saveViaAccount(name, blob).then((ok) => { if (!ok) notify('Saving files is not available in this view. Run the app on your PC to download.'); return { ok }; })
      .catch((e: unknown) => { notify(e instanceof Error ? e.message : String(e)); return { ok: false }; });
  }
  // Windows app: native Save dialog.
  const save = desktopBridge()?.saveFile;
  if (save) {
    return blob.arrayBuffer().then((buf) => save(name, new Uint8Array(buf)))
      .then((r) => { if (r.ok) notify(`Saved: ${r.path ?? name}`); else if (!r.cancelled) notify(`The file could not be saved: ${r.error ?? 'unknown error'}`); return { ok: r.ok, path: r.path }; })
      .catch((e: unknown) => { notify(e instanceof Error ? e.message : String(e)); return { ok: false }; });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return Promise.resolve({ ok: true });
}

export function saveBlob(name: string, blob: Blob): void {
  void saveBlobResult(name, blob);
}
