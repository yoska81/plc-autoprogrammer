import { isIec, regionSpec } from '../standards/regions';
import type { ProjectSnapshot } from './collect';
import { getHmi } from '../hmi/hmiCatalog';
import { supplyText } from '../electrical/derive';
import { cabinetPng } from '../electrical/render/renderToPng';
import { calculations } from './docs/calcs';
import { docMeta, hmiText, referenceDocuments, type DocMeta } from './docs/meta';
import { abbreviationsTable, standardsTable } from './docs/codes';
import { equipmentTable, hmiElementTable, hmiScreenTable, hmiTagTable, ioListTable, operatingModes, sequenceTable, systemDescription } from './docs/fds';
import { alarmTable, blockTable, checkerTable, controllerTable, interlockTable, ioCrossRefTable, programInfo, rungTable, tagTable } from './docs/program';
import { calcTable, cableSummaryTable, cableTotalsTable, conductorTable, enclosureTable, protectiveDeviceTable, sccrTable, supplyTable, voltageDropTable } from './docs/electrical';
import { hazardTable, lotoTable, residualRisks, riskStatement, safetyFunctionTable, safetyFunctions } from './docs/safety';
import { fatProcedure, satChecklist, satTable, testTable } from './docs/fat';
import { pmSchedule, sparePartsTable } from './docs/maintenance';
import { assumptionsTable, bomTable, designReviewTable, operatorManual } from './docs/manual';
import { aiReviewNote } from '../review/report';
import { ACCENT, BRAND, INFO_FILL, INK, MUTED, RED, WARN_FILL, PdfWriter, pdfSafe } from './docs/pdfWriter';
import { makeTable } from './docs/table';
import { qaTable } from '../components/questions/qaTable';

/**
 * The controls engineering package a North American controls firm hands
 * over: a controlled document (cover, approvals, revision history, TOC)
 * with introduction, functional design specification, electrical design
 * basis, safety, PLC and HMI description, FAT / SAT procedures, operator
 * manual, maintenance and appendices. Every table is built in ./docs from the
 * project data and shared with the Excel report.
 */

export { calculations, type CalcLine, type CalcSection } from './docs/calcs';
export { operatorManual, type ManualSection } from './docs/manual';

interface Raster { url: string; w: number; h: number }

/** Re-encode a PNG data URL as JPEG (an uncompressed PNG makes the PDF tens of MB). */
async function toJpeg(src: string, maxW: number): Promise<Raster> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height };
}

/** Cabinet pictures and HMI screens (browser only; skipped where there is no DOM). */
async function pictures(p: ProjectSnapshot): Promise<{ cabinet: { view: string; img: Raster }[]; hmi: { name: string; img: Raster }[] }> {
  const out = { cabinet: [] as { view: string; img: Raster }[], hmi: [] as { name: string; img: Raster }[] };
  if (typeof document === 'undefined' || typeof Image === 'undefined') return out;
  if (p.drawingCtx) {
    for (const view of ['inside', 'door'] as const) {
      try {
        out.cabinet.push({ view, img: await toJpeg(await cabinetPng(p.drawingCtx, view, p.hmi?.hmiPartNumber ?? null, 1600), 1600) });
      } catch { /* picture is optional */ }
    }
  }
  if (p.hmi) {
    try {
      const { buildHmiImages } = await import('./files');
      for (const [i, im] of (await buildHmiImages(p)).entries()) out.hmi.push({ name: p.hmi.screens[i]?.name ?? im.name, img: await toJpeg(im.dataUrl, 900) });
    } catch { /* screens are optional */ }
  }
  return out;
}

function cover(w: PdfWriter, p: ProjectSnapshot, m: DocMeta) {
  const doc = w.doc;
  // Brand band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w.W, 34, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(0, 34, w.W, 2.2, 'F');
  w.font(15, true, [255, 255, 255]);
  if (m.company) doc.text(pdfSafe(m.company), w.M, 15);
  w.font(8.5, false, [214, 218, 190]);
  doc.text('CONTROLS ENGINEERING', w.M, m.company ? 22 : 15);
  w.font(9, true, [255, 255, 255]);
  doc.text(pdfSafe(m.docNo), w.W - w.M, 15, { align: 'right' });
  w.font(8.5, false, [214, 218, 190]);
  doc.text(pdfSafe(`Rev ${m.rev.rev}  ·  ${m.rev.date}`), w.W - w.M, 22, { align: 'right' });

  w.y = 46;
  w.text('Controls Engineering Package', { size: 24, bold: true, color: BRAND, gap: 1 });
  w.text(p.projectName, { size: 16, bold: true, gap: 1 });
  w.text('Functional design specification · electrical design basis · safety · PLC and HMI description · FAT / SAT · operator manual · maintenance', { size: 9, color: MUTED, gap: 4 });

  const d = p.electrical;
  w.keyValue([
    ['Customer', m.customer],
    ['Site', m.site],
    ['Project number', m.projectNumber],
    ['Document number', m.docNo],
    ['Revision / date', `${m.rev.rev} — ${m.rev.date} — ${m.rev.description}`],
    ['Controller', `${p.profile.vendor} ${p.profile.name} ${p.cpu.id}`],
    ['Operator interface', hmiText(m.hmiPart)],
    ['Supply', d ? `${supplyText(d.inputs.supply)}, ${d.inputs.enclosureRating} enclosure` : 'electrical design not generated'],
    ['Code basis', isIec(m.region) ? `${regionSpec(m.region).label} — ${m.codes.short}, ${m.codes.installation}` : `${m.region === 'Canada' ? 'Canada' : 'United States'} — ${m.codes.installation}, ${m.codes.panel}, NFPA 79`],
  ], 26);

  w.callout(m.approved ? `STATUS: ${m.status}` : `STATUS: ${m.status}. Prepared with ISA Auto Programmer (AI-generated). A qualified engineer must check and approve this document before purchase, construction or use.`, m.approved ? BRAND : RED, m.approved ? INFO_FILL : WARN_FILL);

  w.h3('Approvals');
  w.table(makeTable([['Role', 18], ['Name', 34], ['Signature', 34], ['Date', 16]], [
    ['Prepared by', m.preparedBy, '', m.preparedBy ? m.rev.date : ''],
    ['Checked by', m.checkedBy, '', ''],
    ['Approved by', m.approvedBy, '', ''],
  ], 9), { fontSize: 8.5, zebra: false });

  w.h3('Revision history');
  w.table(makeTable([['Rev', 8, 'center'], ['Date', 16], ['Description', 60], ['By', 12, 'center']], m.revisions.map((r) => [r.rev, r.date, r.description, r.by])), { fontSize: 8.2 });

  w.h3('Distribution');
  w.table(makeTable([['Copy', 8, 'center'], ['Recipient', 36], ['Purpose', 56]], [
    ['1', m.customer ? `${m.customer} (customer)` : 'Customer', m.approved ? 'Information / records' : 'Review and approval'],
    ['2', 'Panel builder', m.approved ? 'Construction and FAT' : 'Information only — not for construction'],
    ['3', 'Commissioning / site', 'SAT, training, handover'],
    ['4', 'Project file', 'Master copy (controlled)'],
  ]), { fontSize: 8.2 });
}

function headerFooter(w: PdfWriter, p: ProjectSnapshot, m: DocMeta) {
  const doc = w.doc;
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    if (i > 1) {
      w.font(8, true, BRAND);
      if (m.company) doc.text(pdfSafe(m.company), w.M, 13);
      w.font(8, false, INK);
      const name = pdfSafe(p.projectName);
      doc.text(name.length > 60 ? `${name.slice(0, 57)}...` : name, w.W / 2, 13, { align: 'center' });
      w.font(8, true, INK);
      doc.text(pdfSafe(`${m.docNo}  Rev ${m.rev.rev}`), w.W - w.M, 13, { align: 'right' });
      w.font(7, false, MUTED);
      doc.text('Controls Engineering Package', w.M, 17.5);
      if (m.projectNumber) doc.text(pdfSafe(`Project ${m.projectNumber}`), w.W - w.M, 17.5, { align: 'right' });
      doc.setDrawColor(...BRAND);
      doc.setLineWidth(0.5);
      doc.line(w.M, 19.5, w.W - w.M, 19.5);
      doc.setFillColor(...ACCENT);
      doc.rect(w.M, 19.8, 18, 1, 'F');
    }
    doc.setDrawColor(184, 192, 204);
    doc.setLineWidth(0.2);
    doc.line(w.M, w.H - 14, w.W - w.M, w.H - 14);
    w.font(6.6, true, m.approved ? MUTED : RED);
    doc.text(pdfSafe(m.status), w.M, w.H - 10);
    w.font(6.4, false, MUTED);
    doc.text('Uncontrolled when printed. Verify the current revision before use.', w.M, w.H - 6.8);
    w.font(8, true, INK);
    doc.text(pdfSafe(`Doc ${m.docNo} Rev ${m.rev.rev} — Page ${i} of ${n}`), w.W - w.M, w.H - 8.5, { align: 'right' });
  }
}

/** Insert the table of contents after the cover, with real page numbers and links. */
function tableOfContents(w: PdfWriter) {
  const doc = w.doc;
  const entries = w.headings;
  const lh = 5.0;
  const perFirst = Math.floor((w.bottom - w.top - 14) / lh);
  const perNext = Math.floor((w.bottom - w.top) / lh);
  const pages = entries.length <= perFirst ? 1 : 1 + Math.ceil((entries.length - perFirst) / perNext);
  for (let k = 0; k < pages; k++) doc.insertPage(2 + k);
  for (const e of entries) e.page += pages;
  let page = 2;
  doc.setPage(page);
  w.y = w.top;
  w.font(15, true, BRAND);
  doc.text('Table of contents', w.M, w.y + 5);
  w.y += 7.5;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.6);
  doc.line(w.M, w.y, w.W - w.M, w.y);
  w.y += 6.5;
  for (const e of entries) {
    if (w.y + lh > w.bottom) { page++; doc.setPage(page); w.y = w.top; }
    const x = w.M + (e.level === 1 ? 0 : 7);
    const size = e.level === 1 ? 9.6 : 8.8;
    w.font(size, e.level === 1, e.level === 1 ? BRAND : INK);
    const title = pdfSafe(e.title);
    const pg = String(e.page);
    const tw = doc.getTextWidth(title);
    const pw = doc.getTextWidth(pg);
    const yy = w.y + 3.6;
    doc.text(title, x, yy);
    doc.text(pg, w.W - w.M, yy, { align: 'right' });
    w.font(size, false, MUTED);
    const dotW = doc.getTextWidth('.');
    const from = x + tw + 2, to = w.W - w.M - pw - 2;
    if (to > from) doc.text('.'.repeat(Math.max(0, Math.floor((to - from) / dotW))), from, yy);
    doc.link(x, w.y, w.W - w.M - x, lh, { pageNumber: e.page });
    w.y += lh;
  }
  // PDF bookmarks
  let parent: unknown = null;
  for (const e of entries) {
    if (e.level === 1) parent = doc.outline.add(null, pdfSafe(e.title), { pageNumber: e.page });
    else doc.outline.add(parent, pdfSafe(e.title), { pageNumber: e.page });
  }
}

/** The complete engineering package as one PDF. */
export async function buildEngineeringPdf(p: ProjectSnapshot, equipment: { cpu: string; why: string; modules: string[]; hmi: string | null } | null): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true });
  const m = docMeta(p);
  doc.setProperties({ title: `${m.docNo} — Controls Engineering Package — ${p.projectName}`, subject: 'Controls engineering package', author: m.preparedBy || m.company || 'ISA Auto Programmer', creator: 'ISA Auto Programmer', keywords: `${m.docNo} Rev ${m.rev.rev}` });
  const w = new PdfWriter(doc);
  const pics = await pictures(p);
  const info = programInfo(p);
  const sf = safetyFunctions(p);
  const calcs = calculations(p);
  const ca = m.region === 'Canada';
  const iec = isIec(m.region);
  const hasElec = Boolean(p.drawingCtx && p.electrical);
  const noElec = () => w.callout('The electrical design has not been generated yet. Generate it to complete this section.', RED, WARN_FILL);

  cover(w, p, m);

  // 1. Introduction
  w.h1('1. Introduction');
  w.h2('1.1 Purpose');
  w.para(`This document describes the control system of "${p.projectName}"${m.customer ? ` for ${m.customer}` : ''}${m.site ? `, ${m.site}` : ''}. It is the single reference for how the machine is controlled, how the control panel is designed and protected, how the safety functions work, how the system is tested at the factory (FAT) and on site (SAT), and how it is operated and maintained.`);
  w.h2('1.2 Scope');
  w.h3('Included');
  w.bullets([
    `Control panel design: ${hasElec ? `${p.electrical!.components.length} components, ${p.electrical!.inputs.enclosureRating} enclosure, ${supplyText(p.electrical!.inputs.supply)} supply` : 'to be generated'}; electrical drawings, BOM, wire list, terminal plan and field cable schedule.`,
    `PLC program for ${p.profile.vendor} ${p.profile.name} ${p.cpu.id} (${p.io.filter((x) => x.type === 'input').length} inputs, ${p.io.filter((x) => x.type === 'output').length} outputs).`,
    ...(p.hmi ? [`HMI application for ${hmiText(p.hmi.hmiPartNumber)}: ${p.hmi.screens.length} screens, ${p.hmi.alarms.length} alarm(s).`] : []),
    'Hardwired emergency stop / safety circuit as drawn.',
    'FAT and SAT procedures, operator manual, maintenance schedule and spare parts list.',
  ]);
  w.h3('Excluded (by others unless agreed otherwise)');
  w.bullets([
    'Machine risk assessment and determination of required performance levels (PLr).',
    'Mechanical design, guarding, pneumatic circuit and air preparation.',
    'Supply feeder, upstream protection, available fault current study and arc-flash study.',
    'Field cable installation, cable tray / conduit and junction box mounting.',
    'Motors and field devices supplied with the machine unless listed in the BOM.',
    'Network integration with plant systems beyond the PLC-HMI link.',
  ]);
  w.h2('1.3 Codes and standards');
  w.para(iec ? `The design follows IEC practice (IEC 60204-1, IEC 61439) for ${regionSpec(m.region).label}. ${regionSpec(m.region).marking}. Where editions are not stated, the edition adopted in the country of use applies.` : `The design follows North American practice for ${ca ? 'Canada' : 'the United States'}. Where editions are not stated, the edition adopted by the authority having jurisdiction at the site applies.`);
  w.table(standardsTable(p, m));
  w.h2('1.4 Reference documents');
  w.table(makeTable([['Number', 26], ['Document', 70], ['File', 46]], referenceDocuments(p, m)));
  if (m.drawings) {
    w.h3('Drawing list');
    w.table(makeTable([['Drawing', 16], ['Title', 84]], m.drawings.sheets.map((s) => [s.no, s.title])), { fontSize: 7.4 });
  }
  w.h2('1.5 Abbreviations');
  w.table(abbreviationsTable(p), { fontSize: 7.4 });

  // 2. FDS
  w.h1('2. Functional design specification');
  w.h2('2.1 System description');
  for (const t of systemDescription(p)) w.para(t);
  if (equipment) {
    w.h3('Equipment selection');
    w.keyValue([
      ['PLC CPU', `${p.profile.vendor} ${p.profile.name} ${equipment.cpu}`],
      ['Reason', equipment.why || 'Chosen manually.'],
      ['Expansion modules', equipment.modules.length ? equipment.modules.join(', ') : 'none'],
      ['Operator panel', hmiText(equipment.hmi)],
    ], 22);
  }
  w.h2('2.2 Equipment list');
  w.table(equipmentTable(p), { fontSize: 7.2 });
  w.h2('2.3 Operating modes');
  const om = operatingModes(p);
  w.bullets(om.modes);
  if (om.startup.length) { w.h3('Start-up and homing'); w.bullets(om.startup, { numbered: true }); }
  w.h2('2.4 Sequence of operation');
  const seq = sequenceTable(p);
  if (seq.rows.length) w.table(seq, { fontSize: 8.2 }); else w.para('No sequence of operation in the specification.');
  w.h2('2.5 Interlocks and permissives');
  w.para('Conditions that must be true for each output or machine state, taken from the PLC program, followed by the hardwired interlocks in the electrical design. "Permissives" must all be true; "Initiated by" lists the alternative start conditions.');
  w.table(interlockTable(p, info), { fontSize: 7.1 });
  w.h2('2.6 Alarms');
  w.table(alarmTable(p, info), { fontSize: 7.1 });
  if (p.hmi) {
    w.h2('2.7 HMI screens');
    w.table(hmiScreenTable(p), { fontSize: 7.8 });
  }
  w.h2(p.hmi ? '2.8 I/O list' : '2.7 I/O list');
  w.table(ioListTable(p), { fontSize: 7.2 });

  // 3. Electrical design basis
  if (p.questions.length) {
    w.h2(p.hmi ? '2.9 Questions and answers' : '2.8 Questions and answers');
    w.para('Questions raised during design and the customer\'s answers. They are part of this specification.');
    w.table(qaTable(p.questions), { fontSize: 7.8 });
  }
  w.h1('3. Electrical design basis');
  if (!hasElec) noElec();
  else {
    w.h2('3.1 Supply and control voltages');
    w.table(supplyTable(p), { fontSize: 7.8 });
    w.h2('3.2 Enclosure selection');
    w.table(enclosureTable(p, calcs), { fontSize: 7.8 });
    w.h2('3.3 Protective device schedule');
    w.table(protectiveDeviceTable(p), { fontSize: 6.9 });
    const motorCalcs = calcs.filter((s) => s.title.startsWith('Motor '));
    if (motorCalcs.length) {
      w.h2('3.4 Motor branch circuits');
      for (const s of motorCalcs) {
        w.h3(s.title);
        w.table(calcTable(s), { fontSize: 7.8 });
        w.callout(`${s.ok ? 'OK' : 'CHECK'} — ${s.result}`, s.ok ? BRAND : RED, s.ok ? INFO_FILL : WARN_FILL);
      }
    }
    let k = motorCalcs.length ? 5 : 4;
    w.h2(`3.${k++} Conductor colours and sizes`);
    w.table(conductorTable(p), { fontSize: 7.4 });
    for (const title of ['24 VDC power supply sizing', 'Cabinet temperature rise']) {
      const s = calcs.find((x) => x.title === title);
      if (!s) continue;
      w.h2(`3.${k++} ${title === 'Cabinet temperature rise' ? 'Heat dissipation and cabinet temperature rise' : '24 VDC load and power supply sizing'}`);
      w.table(calcTable(s), { fontSize: 7.6 });
      w.callout(`${s.ok ? 'OK' : 'CHECK'} — ${s.result}`, s.ok ? BRAND : RED, s.ok ? INFO_FILL : WARN_FILL);
    }
    w.h2(`3.${k++} ${iec ? 'Short-circuit rating (Icc)' : 'Short-circuit current rating (SCCR)'}`);
    if (iec) w.para('IEC 61439-1 §5.3: the assembly is rated for a conditional short-circuit current (Icc) that the panel builder verifies by design (tested reference designs, rules or calculation) for the prospective fault current at the site. The component ratings below are the starting point; the UL 508A Supplement SB method is shown for reference.');
    w.para(`Determined by the UL 508A Supplement SB method: the panel SCCR is the lowest rating of the components in the power circuit, raised only by tested combinations or current-limiting devices${ca ? '; the panel is marked per CSA C22.2 No. 14' : ''}.`);
    const sc = sccrTable(p);
    w.table(sc.table, { fontSize: 7.2 });
    w.callout(sc.result, sc.unknown.length ? RED : BRAND, sc.unknown.length ? WARN_FILL : INFO_FILL);
    w.h2(`3.${k} Voltage drop`);
    w.para('Field cable lengths are not known yet ("BY SITE"). The table gives the longest one-way run that keeps the voltage drop within the limit (3% for motor circuits, 5% for 24 VDC circuits) using NEC Chapter 9 Table 8 conductor resistance at 75 °C. Loads marked typical / assumed are estimates.');
    w.table(voltageDropTable(p), { fontSize: 7.1 });
  }

  // 4. Safety
  w.h1('4. Safety');
  w.h2('4.1 Hazard summary');
  w.table(hazardTable(p), { fontSize: 7.4 });
  w.h2('4.2 Safety functions');
  w.para(`Stop categories per NFPA 79 9.2.2 / IEC 60204-1 (0 = immediate removal of power, 1 = controlled stop then removal of power). Architecture and category per ISO 13849-1. ${sf.length ? '' : 'No safety functions were found in the design or the specification.'}`);
  if (sf.length) w.table(safetyFunctionTable(p, sf), { fontSize: 6.9 });
  w.h2('4.3 Lockout / tagout points');
  w.para(`Hazardous energy must be isolated per ${iec ? 'IEC 60204-1 §5.5 (lockable main switch) and EN 1037 / ISO 14118' : ca ? 'CSA Z460' : 'OSHA 29 CFR 1910.147'} and the site lockout procedure before maintenance.`);
  w.table(lotoTable(p), { fontSize: 7.4 });
  w.h2('4.4 Residual risks');
  w.bullets(residualRisks(p));
  w.h2('4.5 Risk assessment');
  w.callout(riskStatement(p), RED, WARN_FILL);

  // 5. PLC program
  w.h1('5. PLC program description');
  w.h2('5.1 Controller and modules');
  w.table(controllerTable(p), { fontSize: 7.8 });
  if (p.profile.language === 'ladder' && p.ladder.rungs.length) {
    w.h2('5.2 Program structure');
    w.table(blockTable(p), { fontSize: 7.8 });
    w.h2('5.3 Rung description');
    w.table(rungTable(p, info), { fontSize: 6.9 });
    w.h2('5.4 Memory map and tag table');
    w.table(tagTable(p, info), { fontSize: 7.1 });
    w.h2('5.5 I/O cross reference');
    w.table(ioCrossRefTable(p, info), { fontSize: 7.4 });
  } else if (p.stCode) {
    w.h2('5.2 Program');
    w.para(`Structured Text program, ${p.stCode.split('\n').length} lines. See the program file listed in the reference documents.`);
  } else {
    w.h2('5.2 Program');
    w.callout('The PLC program has not been generated yet.', RED, WARN_FILL);
  }
  w.h2(p.profile.language === 'ladder' && p.ladder.rungs.length ? '5.6 Communication' : '5.3 Communication');
  w.bullets([
    p.hmi ? `HMI ${p.hmi.hmiPartNumber} <-> PLC ${p.cpu.id}: Ethernet (CLICK Ethernet driver / Modbus TCP), ${p.hmi.tags.length} tags. HMI command bits use internal C memory; the PLC never relies on the HMI for safety.` : 'No HMI communication.',
    'Programming port: Ethernet (or serial) from the engineering laptop.',
    'IP addresses, subnet and gateway: to be assigned by the site; record them on the drawings.',
    'No connection to plant networks is included; if one is added, use a managed switch / firewall and keep the safety circuit hardwired.',
  ]);
  if (p.profile.language === 'ladder' && p.ladder.rungs.length) {
    w.h2('5.7 Program check');
    if (p.issues.length) w.table(checkerTable(p), { fontSize: 7.6 });
    else w.callout(`Program checker: no errors or warnings (${p.ladder.rungs.length} rungs checked against the ${p.profile.name} address rules and the I/O list).`);
  }

  // 6. HMI
  if (p.hmi) {
    const model = getHmi(p.hmi.hmiPartNumber);
    w.h1('6. HMI description');
    w.h2('6.1 Operator panel');
    w.keyValue([
      ['Model', hmiText(p.hmi.hmiPartNumber)],
      ['Description', model?.description ?? ''],
      ['Communication', model ? `${model.ethernet ? 'Ethernet' : 'no Ethernet'}; serial: ${model.serial}` : ''],
      ['Mounting', model?.cutoutMm ? `Panel door, cut-out ${model.cutoutMm.width} x ${model.cutoutMm.height} mm` : 'Panel door'],
      ['Design style', 'ISA-101 style: grey background, colour only for abnormal states (red = alarm, amber = warning, green = running), same navigation bar on every screen.'],
    ], 22);
    w.h2('6.2 Screens');
    w.table(hmiScreenTable(p), { fontSize: 7.8 });
    for (const s of pics.hmi) w.image(s.img.url, 'JPEG', s.img.w, s.img.h, 70, `HMI screen: ${s.name}`);
    w.h2('6.3 Screen elements');
    w.table(hmiElementTable(p), { fontSize: 7.2 });
    w.h2('6.4 HMI tag list');
    w.table(hmiTagTable(p), { fontSize: 7.4 });
    w.h2('6.5 Alarm handling');
    w.bullets([
      `${p.hmi.alarms.length} alarm(s) are configured (see 2.6). Each alarm is a PLC bit; the HMI shows the message in the alarm banner on every screen and on the Alarms screen.`,
      'Alarms latch in the PLC until the cause is removed and the operator resets; the reset conditions are given in the alarm table.',
      'Alarm history: enable the C-more alarm log (date / time, acknowledge) during commissioning if the customer requires it.',
    ]);
  }

  // 7. FAT
  const sec = (n: number) => (p.hmi ? n : n - 1);
  w.h1(`${sec(7)}. Factory acceptance test (FAT) procedure`);
  const fat = fatProcedure(p, m, info, sf);
  w.para(`Perform the tests in order with the panel at the builder's shop. Record Pass (P) or Fail (F) and initials for each test; list every failure on the punch list. ${fat.length} tests.`);
  w.keyValue([['Panel / serial no.', ''], ['Test date', ''], ['Test supply', ''], ['Program / HMI revision', '']], 26);
  w.table(testTable(fat), { fontSize: 7 });
  w.h3('FAT result and sign-off');
  w.table(makeTable([['Role', 26], ['Name', 30], ['Company', 26], ['Signature', 28], ['Date', 14]], [['Tested by (panel builder)', '', '', '', ''], ['Witnessed by (customer)', '', '', '', ''], ['Accepted by (engineer)', '', '', '', '']], 10), { fontSize: 8, zebra: false });
  w.text('Result:  [ ] Accepted     [ ] Accepted with punch list     [ ] Rejected        Open punch-list items: ______', { size: 9 });

  // 8. SAT
  w.h1(`${sec(8)}. Site acceptance test (SAT) and commissioning checklist`);
  const sat = satChecklist(p, sf);
  w.table(satTable(sat), { fontSize: 7 });
  w.h3('SAT sign-off');
  w.table(makeTable([['Role', 26], ['Name', 30], ['Company', 26], ['Signature', 28], ['Date', 14]], [['Commissioned by', '', '', '', ''], ['Accepted by (customer)', '', '', '', '']], 10), { fontSize: 8, zebra: false });

  // 9. Operator manual
  w.h1(`${sec(9)}. Operator manual`);
  for (const s of operatorManual(p, info)) {
    w.h2(s.title, false);
    if (/Normal operation/.test(s.title)) w.bullets(s.paragraphs, { numbered: true });
    else w.bullets(s.paragraphs);
  }

  // 10. Maintenance
  w.h1(`${sec(10)}. Maintenance`);
  w.h2(`${sec(10)}.1 Preventive maintenance schedule`);
  w.para('Perform maintenance only after lockout / tagout (chapter 4.3). Intervals are typical starting points; adjust them to the manufacturers’ manuals and site experience.');
  w.table(pmSchedule(p), { fontSize: 7.6 });
  w.h2(`${sec(10)}.2 Recommended spare parts`);
  w.table(sparePartsTable(p), { fontSize: 7.2 });

  // Appendices
  w.h1('Appendix A — Bill of materials');
  if (hasElec) w.table(bomTable(p), { fontSize: 7 }); else noElec();
  w.h1('Appendix B — Field cable schedule');
  if (hasElec) {
    w.para('Summary, one line per cable. Core-by-core details are in the drawing set and the Excel report.');
    w.table(cableSummaryTable(p), { fontSize: 7 });
    const ml = p.drawingCtx?.machineLayout;
    if (ml) {
      w.h2('Cable lengths from the machine layout');
      w.para(`Lengths are measured along the cable routes drawn on the machine layout (sheet "Machine layout" in the drawing set), plus ${ml.service.pct} % routing slack and ${ml.service.endM} m service loop at each end. Verify on site before cutting. Totals per cable type for purchasing:`);
      w.table(cableTotalsTable(p), { fontSize: 7.4 });
      const extra = [
        ...ml.manifolds.map((m) => `Valve manifold ${m.tag}: ${m.valves.length} stations for ${m.valves.join(', ')} — part to be selected.`),
        ...ml.remoteIo.map((r) => `Remote I/O block ${r.tag} near ${r.devices.join(', ')} — part to be selected; PLC addresses change.`),
      ];
      if (extra.length) w.bullets(extra);
    }
  } else noElec();
  w.h1('Appendix C — Design review items');
  w.para('Items the checking engineer must resolve before the design is approved for construction: the design review findings (consistency checks, electrical design warnings, calculations and the AI review) with how each was resolved or why it was accepted.');
  w.para(aiReviewNote());
  w.table(designReviewTable(p), { fontSize: 7.4 });
  w.h1('Appendix D — Assumptions to confirm');
  w.table(assumptionsTable(p), { fontSize: 7.6 });
  if (pics.cabinet.length) {
    w.h1('Appendix E — Control cabinet arrangement');
    w.para('Pictures drawn to scale from the panel layout. See the drawing set for dimensions.');
    for (const c of pics.cabinet) w.image(c.img.url, 'JPEG', c.img.w, c.img.h, 105, c.view === 'inside' ? 'Back panel (door removed)' : 'Door, front view');
  }

  tableOfContents(w);
  headerFooter(w, p, m);
  return doc.output('blob');
}
