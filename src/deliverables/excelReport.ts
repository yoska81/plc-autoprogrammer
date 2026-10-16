import type { Worksheet, Workbook } from 'exceljs';
import type { ProjectSnapshot } from './collect';
import { SPEC_SECTIONS } from '../spec/types';
import { billOfMaterials, cableSchedule, designWarnings, supplyText, terminalPlan, wireNumbers } from '../electrical/derive';
import { describeElement, describeOutput } from '../plc/core/clickExport';
import { getHmi } from '../hmi/hmiCatalog';
import { calcWarnings, calculations } from './docs/calcs';
import { operatorManual } from './docs/manual';
import { docMeta, hmiText } from './docs/meta';
import { alarmTable, interlockTable, programInfo } from './docs/program';
import { protectiveDeviceTable, sccrTable } from './docs/electrical';
import { safetyFunctionTable, safetyFunctions } from './docs/safety';
import { fatProcedure, satChecklist, satTable, testTable } from './docs/fat';
import { pmSchedule, sparePartsTable } from './docs/maintenance';
import { isGroup, type DocTable } from './docs/table';

/** Graphite: title rows (white text) and dark text. */
const BRAND = 'FF24270B';
/** Light lime header fill with dark text. */
const HEAD = 'FFF5FFC4';
const GROUP = 'FFECEEE2';

/** Header row: brand fill, white bold text, frozen. */
function header(ws: Worksheet, cols: { header: string; key: string; width: number }[]) {
  ws.columns = cols;
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: BRAND } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
  row.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/** A sheet from a shared DocTable (same rows as the engineering package PDF). */
function tableSheet(wb: Workbook, name: string, t: DocTable, note?: string): Worksheet {
  const ws = wb.addWorksheet(name);
  header(ws, t.columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: Math.max(8, Math.min(70, Math.round(c.width * 1.1))) })));
  const n = t.columns.length;
  for (const r of t.rows) {
    if (isGroup(r)) {
      const row = ws.addRow([r.group]);
      ws.mergeCells(row.number, 1, row.number, n);
      row.font = { bold: true, color: { argb: BRAND } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP } };
      continue;
    }
    // Centred / right-aligned columns hold quantities, rungs, amps…: store plain numbers as numbers
    // (no leading zeros, so IDs like "001" stay text).
    const row = ws.addRow(r.map((v, i) => (t.columns[i]?.align && t.columns[i].align !== 'left' && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(v.trim()) ? Number(v) : v)));
    row.alignment = { wrapText: true, vertical: 'top' };
    t.columns.forEach((c, i) => { if (c.align && c.align !== 'left') row.getCell(i + 1).alignment = { wrapText: true, vertical: 'top', horizontal: c.align }; });
  }
  if (note) {
    ws.addRow([]);
    const row = ws.addRow([note]);
    ws.mergeCells(row.number, 1, row.number, n);
    row.font = { italic: true, color: { argb: 'FF555555' } };
    row.alignment = { wrapText: true };
    row.height = 30;
  }
  return ws;
}

function documentControl(wb: Workbook, p: ProjectSnapshot) {
  const m = docMeta(p);
  const ws = wb.addWorksheet('Document Control');
  ws.columns = [{ width: 26 }, { width: 34 }, { width: 46 }, { width: 16 }];
  const title = ws.addRow(['Project Report — Document Control']);
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  title.height = 26;
  ws.mergeCells(title.number, 1, title.number, 4);
  const st = ws.addRow([m.status]);
  st.font = { bold: true, color: { argb: m.approved ? BRAND : 'FFB00000' } };
  ws.mergeCells(st.number, 1, st.number, 4);
  ws.addRow([]);
  const section = (t: string) => {
    const r = ws.addRow([t]);
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    ws.mergeCells(r.number, 1, r.number, 4);
  };
  section('Project data');
  const d = p.electrical;
  const kv: [string, string][] = [
    ['Company', m.company], ['Customer', m.customer], ['Site', m.site], ['Project name', p.projectName], ['Project number', m.projectNumber],
    ['Report number', m.reportNo], ['Engineering package', m.docNo], ['Drawing set', m.drawings ? `${m.drawings.first} … ${m.drawings.last} (${m.drawings.sheets.length} sheets)` : 'not generated'],
    ['Current revision', `${m.rev.rev} — ${m.rev.date} — ${m.rev.description}`],
    ['Region / codes', `${m.region} — ${m.codes.installation}, ${m.codes.panel}, NFPA 79`],
    ['PLC', `${p.profile.vendor} ${p.profile.name} ${p.cpu.id}`], ['HMI', hmiText(m.hmiPart)],
    ['Supply', d ? `${supplyText(d.inputs.supply)}, ${d.inputs.enclosureRating}` : 'not designed'],
    ['Report generated', new Date().toLocaleString()],
  ];
  for (const [k, v] of kv) { const r = ws.addRow([k, v]); r.getCell(1).font = { bold: true }; ws.mergeCells(r.number, 2, r.number, 4); }
  ws.addRow([]);
  section('Approvals');
  const ah = ws.addRow(['Role', 'Name', 'Signature', 'Date']);
  ah.font = { bold: true };
  ah.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
  for (const [role, name] of [['Prepared by', m.preparedBy], ['Checked by', m.checkedBy], ['Approved by', m.approvedBy]]) ws.addRow([role, name, '', '']).height = 24;
  ws.addRow([]);
  section('Revision history');
  const rh = ws.addRow(['Rev', 'Date', 'Description', 'By']);
  rh.font = { bold: true };
  rh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
  for (const r of m.revisions) ws.addRow([r.rev, r.date, r.description, r.by]);
  ws.addRow([]);
  const disc = ws.addRow(['Prepared with ISA Auto Programmer (AI-generated). Values marked estimate / assumption must be confirmed. A qualified engineer must check and approve the design before purchase, construction or use.']);
  ws.mergeCells(disc.number, 1, disc.number, 4);
  disc.alignment = { wrapText: true };
  disc.height = 32;
  disc.font = { italic: true, color: { argb: 'FF555555' } };
}

/** Full project report as an .xlsx workbook (one sheet per deliverable). */
export async function buildExcelReport(p: ProjectSnapshot): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const meta = docMeta(p);
  wb.creator = meta.preparedBy || 'ISA Auto Programmer';
  wb.company = meta.company;
  wb.title = `${meta.reportNo} — ${p.projectName}`;
  wb.created = new Date();
  const info = programInfo(p);
  const sf = safetyFunctions(p);

  documentControl(wb, p);

  // Summary
  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 28 }, { width: 90 }];
  const hmiModel = p.hmi ? getHmi(p.hmi.hmiPartNumber) : undefined;
  [
    ['Project', p.projectName],
    ['PLC', `${p.profile.vendor} ${p.profile.name} · ${p.cpu.label}`],
    ['HMI', hmiModel ? `${hmiModel.partNumber} · ${hmiModel.sizeIn}" ${hmiModel.widthPx}x${hmiModel.heightPx}` : 'not designed'],
    ['I/O points', `${p.io.filter((x) => x.type === 'input').length} inputs, ${p.io.filter((x) => x.type === 'output').length} outputs`],
    ['Program', p.profile.language === 'ladder' ? `${p.ladder.rungs.length} rungs` : p.stCode ? 'Structured Text' : 'not generated'],
    ['Electrical design', p.electrical ? `${p.electrical.components.length} components, supply ${p.electrical.inputs.supply}` : 'not designed'],
    ['Report date', new Date().toLocaleString()],
    ['Status', meta.status],
  ].forEach((r) => sum.addRow(r));
  sum.getColumn(1).font = { bold: true };

  // Spec
  const spec = wb.addWorksheet('Specification');
  header(spec, [{ header: 'Section', key: 's', width: 28 }, { header: 'Requirements', key: 't', width: 120 }]);
  for (const d of SPEC_SECTIONS) if (p.spec[d.id]?.trim()) spec.addRow({ s: d.title, t: p.spec[d.id].trim() }).alignment = { wrapText: true, vertical: 'top' };

  // I/O
  const io = wb.addWorksheet('I-O List');
  header(io, [
    { header: 'Address', key: 'a', width: 10 }, { header: 'ID', key: 'id', width: 8 }, { header: 'Type', key: 't', width: 9 },
    { header: 'Category', key: 'c', width: 18 }, { header: 'Description', key: 'd', width: 44 }, { header: 'Field device', key: 'dev', width: 22 },
  ]);
  const wiring = new Map((p.electrical?.ioWiring ?? []).map((w) => [w.address, w]));
  for (const x of p.io) {
    const a = p.addresses.get(x.id) ?? '';
    const w = wiring.get(a);
    io.addRow({ a, id: x.id, t: x.type, c: x.category, d: x.description, dev: w ? `${w.deviceTag} (${w.deviceType})` : x.deviceType ?? '' });
  }

  tableSheet(wb, 'Interlocks', interlockTable(p, info), 'Software interlocks are read from the PLC program; hardwired interlocks from the electrical design.');
  tableSheet(wb, 'Alarm List', alarmTable(p, info));

  // Electrical
  if (p.drawingCtx) {
    const bom = wb.addWorksheet('BOM');
    header(bom, [
      { header: 'Item', key: 'i', width: 6 }, { header: 'Qty', key: 'q', width: 6 }, { header: 'Part number', key: 'pn', width: 22 },
      { header: 'Manufacturer', key: 'm', width: 16 }, { header: 'Description', key: 'd', width: 70 }, { header: 'Tags', key: 'tags', width: 20 }, { header: 'Category', key: 'c', width: 18 },
    ]);
    for (const g of billOfMaterials(p.drawingCtx)) {
      for (const l of g.lines) bom.addRow({ i: l.note ? '' : l.item, q: l.qty, pn: l.partNumber, m: l.manufacturer, d: l.description, tags: l.tags.join(', '), c: g.title });
    }

    tableSheet(wb, 'Protective Devices', protectiveDeviceTable(p));
    const sc = sccrTable(p);
    tableSheet(wb, 'SCCR', sc.table, sc.result);

    const wires = wb.addWorksheet('Wire List');
    header(wires, [
      { header: 'Wire', key: 'w', width: 12 }, { header: 'From', key: 'f', width: 26 }, { header: 'To', key: 't', width: 26 },
      { header: 'Color', key: 'c', width: 8 }, { header: 'Size', key: 's', width: 10 }, { header: 'Function', key: 'fn', width: 40 },
    ]);
    for (const w of wireNumbers(p.drawingCtx)) wires.addRow({ w: w.wire, f: w.from, t: w.to, c: w.color, s: w.size, fn: w.function });

    const cab = wb.addWorksheet('Cable Schedule');
    header(cab, [
      { header: 'Cable', key: 'c', width: 9 }, { header: 'Zone', key: 'z', width: 18 }, { header: 'From', key: 'f', width: 18 }, { header: 'To', key: 't', width: 14 },
      { header: 'Type', key: 'ty', width: 34 }, { header: 'Part number', key: 'pn', width: 18 }, { header: 'Size', key: 's', width: 10 }, { header: 'Length', key: 'l', width: 10 },
      { header: 'Core', key: 'core', width: 8 }, { header: 'Wire', key: 'w', width: 10 }, { header: 'Color', key: 'col', width: 8 },
    ]);
    for (const c of cableSchedule(p.drawingCtx)) {
      cab.addRow({ c: c.tag, z: c.zone, f: c.from, t: c.to, ty: c.type, pn: c.partNumber ?? '', s: c.size, l: c.length }).font = { bold: true };
      for (const k of c.cores) cab.addRow({ core: k.core, w: k.wire, col: k.color, f: k.from, t: k.to });
    }

    const tb = wb.addWorksheet('Terminal Plan');
    header(tb, [
      { header: 'Terminal', key: 'l', width: 10 }, { header: 'Wire', key: 'w', width: 12 }, { header: 'Internal (panel)', key: 'i', width: 30 },
      { header: 'External (field)', key: 'e', width: 34 }, { header: 'Kind', key: 'k', width: 8 },
    ]);
    for (const s of terminalPlan(p.drawingCtx)) {
      tb.addRow({ l: `${s.tag} — ${s.title}` }).font = { bold: true };
      for (const t of s.terminals) tb.addRow({ l: t.label, w: t.wire, i: t.internal, e: t.external, k: t.kind });
    }

    const notes = wb.addWorksheet('Design Review');
    header(notes, [{ header: 'Item to check', key: 'n', width: 140 }]);
    for (const n of [...p.electrical!.notes, ...designWarnings(p.drawingCtx), ...calcWarnings(p)]) notes.addRow({ n }).alignment = { wrapText: true };
  }

  tableSheet(wb, 'Safety Functions', safetyFunctionTable(p, sf), 'Required performance levels (PLr) are set by the machine risk assessment (ANSI B11.0 / ISO 12100) and verified per ISO 13849-1/-2.');

  // HMI
  if (p.hmi) {
    const tags = wb.addWorksheet('HMI Tags');
    header(tags, [
      { header: 'Address', key: 'a', width: 10 }, { header: 'Name', key: 'n', width: 28 }, { header: 'Type', key: 't', width: 8 },
      { header: 'Access', key: 'x', width: 11 }, { header: 'Description', key: 'd', width: 70 },
    ]);
    for (const t of p.hmi.tags) tags.addRow({ a: t.address, n: t.name, t: t.dataType, x: t.access, d: t.description });
    const al = wb.addWorksheet('HMI Alarms');
    header(al, [{ header: 'Address', key: 'a', width: 10 }, { header: 'Severity', key: 's', width: 10 }, { header: 'Message', key: 'm', width: 80 }]);
    for (const a of p.hmi.alarms) al.addRow({ a: a.address, s: a.severity, m: a.message });
    const sc = wb.addWorksheet('HMI Screens');
    header(sc, [{ header: 'Screen', key: 's', width: 20 }, { header: 'Element', key: 'e', width: 30 }, { header: 'Kind', key: 'k', width: 14 }, { header: 'Address', key: 'a', width: 10 }, { header: 'Action', key: 'x', width: 11 }]);
    for (const s of p.hmi.screens) for (const e of s.elements) sc.addRow({ s: s.name, e: e.label, k: e.kind, a: e.address ?? '', x: e.action ?? '' });
  }

  // Program
  if (p.profile.language === 'ladder' && p.ladder.rungs.length) {
    const label = (a: string) => (p.labels.get(a) ? ` (${p.labels.get(a)})` : '');
    const prog = wb.addWorksheet('PLC Program');
    header(prog, [{ header: 'Rung', key: 'r', width: 6 }, { header: 'Comment', key: 'c', width: 40 }, { header: 'Inputs (branches in parallel)', key: 'i', width: 90 }, { header: 'Outputs', key: 'o', width: 60 }]);
    p.ladder.rungs.forEach((r, n) => {
      const inputs = r.branches.map((b, j) => `${r.branches.length > 1 ? `B${j + 1}: ` : ''}${b.map((el) => describeElement(el, label)).join(' → ') || 'wire'}`).join('\n') || 'always true';
      prog.addRow({ r: n + 1, c: r.comment, i: inputs, o: r.outputs.map((o) => describeOutput(o, label)).join('\n') }).alignment = { wrapText: true, vertical: 'top' };
    });
    const tg = wb.addWorksheet('PLC Tags');
    header(tg, [{ header: 'Address', key: 'a', width: 10 }, { header: 'Nickname', key: 'n', width: 26 }, { header: 'Comment', key: 'c', width: 60 }]);
    for (const t of p.ladder.tags) tg.addRow({ a: t.address, n: t.nickname, c: t.comment });
    if (p.issues.length) {
      const iss = wb.addWorksheet('Program Check');
      header(iss, [{ header: 'Rung', key: 'r', width: 8 }, { header: 'Severity', key: 's', width: 10 }, { header: 'Issue', key: 'm', width: 110 }]);
      for (const i of p.issues) iss.addRow({ r: i.rungId ? p.ladder.rungs.findIndex((x) => x.id === i.rungId) + 1 : '', s: i.severity, m: i.message });
    }
  }

  // Engineering package
  const calcs = calculations(p);
  if (calcs.length) {
    const cs = wb.addWorksheet('Calculations');
    header(cs, [{ header: 'Item', key: 'i', width: 50 }, { header: 'Value', key: 'v', width: 22 }, { header: 'Basis', key: 'b', width: 40 }, { header: 'Estimate', key: 'e', width: 10 }]);
    for (const s of calcs) {
      cs.addRow({ i: s.title }).font = { bold: true };
      for (const l of s.lines) cs.addRow({ i: l.item, v: l.value, b: l.basis, e: l.estimate ? 'yes' : '' });
      const r = cs.addRow({ i: `${s.ok ? 'OK' : 'CHECK'}: ${s.result}` });
      r.font = { bold: true, color: { argb: s.ok ? BRAND : 'FFB00000' } };
      r.alignment = { wrapText: true };
    }
  }
  tableSheet(wb, 'FAT Procedure', testTable(fatProcedure(p, meta, info, sf)), 'Tested by: ____________   Witnessed by: ____________   Date: ________');
  tableSheet(wb, 'SAT Checklist', satTable(satChecklist(p, sf)), 'Commissioned by: ____________   Accepted by (customer): ____________   Date: ________');
  const man = wb.addWorksheet('Operator Manual');
  header(man, [{ header: 'Section', key: 's', width: 32 }, { header: 'Text', key: 't', width: 110 }]);
  for (const s of operatorManual(p, info)) for (const para of s.paragraphs) man.addRow({ s: s.title, t: para }).alignment = { wrapText: true, vertical: 'top' };
  tableSheet(wb, 'Maintenance', pmSchedule(p));
  tableSheet(wb, 'Spare Parts', sparePartsTable(p));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
