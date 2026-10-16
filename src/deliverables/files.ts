import { IS_PREVIEW } from '../preview/mode';
import { saveViaAccount } from '../preview/claudeAccount';
import { backPanelDxf, doorDxf } from '../electrical/dxf';
import { cabinetStep } from '../electrical/step/cabinetStep';
import { createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectSnapshot } from './collect';
import DrawingSet from '../electrical/drawings/DrawingSet';
import HmiScreenView from '../hmi/HmiScreenView';
import { svgToPngDataUrl } from '../hmi/svgToPng';
import { getHmi } from '../hmi/hmiCatalog';
import { bomCsv, wireListCsv, terminalPlanCsv, cableScheduleCsv } from '../electrical/derive';
import { clickNicknameCsv, clickRungListing } from '../plc/core/clickExport';
import { buildExcelReport } from './excelReport';
import { buildEngineeringPdf } from './engineering';
import { cabinetPng } from '../electrical/render/renderToPng';

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

/** Electrical drawing set as a vector PDF, one ANSI B (17x11) page per sheet. */
export async function buildDrawingsPdf(p: ProjectSnapshot): Promise<Blob | null> {
  if (!p.drawingCtx) return null;
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const W = 431.8, H = 279.4;
  return renderOffscreen(createElement(DrawingSet, { ctx: p.drawingCtx, printMode: true }), async (host) => {
    const sheets = [...host.querySelectorAll<SVGSVGElement>(`svg[viewBox="0 0 ${W} ${H}"]`)];
    if (!sheets.length) throw new Error('No drawing sheets were produced.');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] });
    for (let i = 0; i < sheets.length; i++) {
      if (i > 0) doc.addPage([W, H], 'landscape');
      await doc.svg(sheets[i], { x: 0, y: 0, width: W, height: H });
    }
    return doc.output('blob');
  });
}

/** Every HMI screen as a PNG at the panel's native resolution. */
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
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = 279.4, pageH = 215.9, margin = 15;
  const scale = Math.min((pageW - 2 * margin) / model.widthPx, (pageH - 2 * margin - 12) / model.heightPx);
  images.forEach((img, i) => {
    if (i > 0) doc.addPage('letter', 'landscape');
    const screen = p.hmi!.screens[i];
    doc.setFontSize(14);
    doc.text(`${p.projectName} — HMI ${model.partNumber} — ${screen.name}`, margin, margin);
    doc.setFontSize(9);
    doc.text(screen.purpose.slice(0, 160), margin, margin + 6);
    doc.addImage(img.dataUrl, 'PNG', margin, margin + 10, model.widthPx * scale, model.heightPx * scale, undefined, 'FAST');
  });
  return doc.output('blob');
}

/** PLC program files for the selected PLC. */
export function programFiles(p: ProjectSnapshot): { name: string; content: string }[] {
  if (p.profile.language === 'st') return p.stCode ? [{ name: `${p.fileBase}.st`, content: p.stCode }] : [];
  if (!p.ladder.rungs.length) return [];
  const header = `${p.projectName} — ${p.profile.name} ${p.cpu.id}`;
  return [
    { name: `${p.fileBase}_rungs.txt`, content: clickRungListing(p.ladder, p.labels, header) },
    { name: `${p.fileBase}_nicknames.csv`, content: clickNicknameCsv(p.ladder, p.io, p.addresses, (p.hmi?.tags ?? []).map((t) => ({ address: t.address, nickname: t.name, comment: `HMI: ${t.description}` }))) },
    { name: `${p.fileBase}_program.json`, content: JSON.stringify(p.ladder, null, 2) },
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
    zip.file('electrical/wire_list.csv', wireListCsv(p.drawingCtx));
    zip.file('electrical/terminal_plan.csv', terminalPlanCsv(p.drawingCtx));
    zip.file('electrical/cable_schedule.csv', cableScheduleCsv(p.drawingCtx));
    // 1:1 machining files: inches (default for the shop) and the same geometry in millimetres.
    for (const units of ['in', 'mm'] as const) {
      zip.file(`electrical/machining/back_panel_drilling_1to1_${units}.dxf`, backPanelDxf(p.drawingCtx, { units }));
      zip.file(`electrical/machining/door_cutouts_1to1_${units}.dxf`, doorDxf(p.drawingCtx, { units }));
    }
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
  }
  onProgress?.('Engineering package');
  pre.engineering = await buildEngineeringPdf(p, p.equipment);
  zip.file(`${p.fileBase}_engineering_package.pdf`, pre.engineering);
  for (const f of programFiles(p)) zip.file(`plc/${f.name}`, f.content);
  // Labels and the complete package PDF (reuses the PDFs built above).
  const { addPackageToZip } = await import('./fullPackage');
  await addPackageToZip(zip, p, pre, onProgress);
  zip.file('spec.md', `# ${p.projectName}\n\n${Object.entries(p.spec).filter(([, t]) => t.trim()).map(([k, t]) => `## ${k}\n${t}`).join('\n\n')}\n`);
  onProgress?.('Packing');
  return zip.generateAsync({ type: 'blob' });
}

export function saveBlob(name: string, blob: Blob) {
  // The preview can't download directly: the viewer's Claude app offers the file.
  if (IS_PREVIEW) {
    void saveViaAccount(name, blob).then((ok) => { if (!ok) alert('Saving files is not available in this view. Run the app on your PC to download.'); })
      .catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
