import { regionSpec, type Region } from '../../standards/regions';
import type { ProjectSnapshot } from '../collect';
import { currentRevision, type Revision } from '../../store/useProjectStore';
import { codeRefs, type DrawingContext } from '../../electrical/derive';
import { planDrawings } from '../../electrical/drawings/plan';
import { getHmi } from '../../hmi/hmiCatalog';

/** Document control data for the engineering documents (cover, headers, footers). */
export interface DocMeta {
  company: string;
  customer: string;
  site: string;
  projectNumber: string;
  projectName: string;
  /** Number prefix chosen by the user, or "" when not set. */
  prefix: string;
  /** Engineering package document number, e.g. "WCC-EP-001". */
  docNo: string;
  /** Excel report reference number. */
  reportNo: string;
  rev: Revision;
  /** Oldest first; when the user has not issued anything yet this holds the implicit preliminary revision. */
  revisions: Revision[];
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  /** True when the current revision is an approved / for-construction issue with an approver named. */
  approved: boolean;
  status: string;
  region: Region;
  codes: ReturnType<typeof codeRefs>;
  /** Drawing set reference: number range and sheet list (when an electrical design exists). */
  drawings: { first: string; last: string; sheets: { no: string; title: string }[] } | null;
  hmiPart: string | null;
}

export const PRELIMINARY = 'PRELIMINARY — AI-GENERATED — NOT FOR CONSTRUCTION UNTIL CHECKED AND APPROVED';

export function docMeta(p: ProjectSnapshot): DocMeta {
  const info = p.info;
  const prefix = (info.drawingPrefix ?? '').trim().toUpperCase();
  const base = prefix || 'PRJ';
  const rev = currentRevision(info);
  const revisions = info.revisions?.length ? info.revisions : [rev];
  const approved = Boolean(info.approvedBy?.trim()) && /approv|construction|\bIFC\b|as[- ]built|final/i.test(rev.description);
  const ctx = p.drawingCtx ?? ({ region: info.region } as DrawingContext);
  let drawings: DocMeta['drawings'] = null;
  if (p.drawingCtx) {
    try {
      const sheets = planDrawings(p.drawingCtx).sheets.map((s) => ({ no: s.drawingNo, title: s.title }));
      if (sheets.length) drawings = { first: sheets[0].no, last: sheets[sheets.length - 1].no, sheets };
    } catch {
      drawings = null;
    }
  }
  return {
    company: info.company?.trim() ?? '',
    customer: info.customer?.trim() ?? '',
    site: info.site?.trim() ?? '',
    projectNumber: info.projectNumber?.trim() ?? '',
    projectName: p.projectName,
    prefix,
    docNo: `${base}-EP-001`,
    reportNo: `${base}-RPT-001`,
    rev,
    revisions,
    preparedBy: info.preparedBy?.trim() ?? '',
    checkedBy: info.checkedBy?.trim() ?? '',
    approvedBy: info.approvedBy?.trim() ?? '',
    approved,
    status: approved ? `ISSUED — Rev ${rev.rev}: ${rev.description}` : PRELIMINARY,
    region: regionSpec(info.region).value,
    codes: codeRefs(ctx),
    drawings,
    hmiPart: p.hmi?.hmiPartNumber ?? p.equipment?.hmi ?? null,
  };
}

/** "C-more CM5-T7W (7 in, 800x480)" or the bare part number. */
export function hmiText(partNumber: string | null): string {
  if (!partNumber) return 'none';
  const m = getHmi(partNumber);
  return m ? `${m.family} ${m.partNumber} (${m.sizeIn} in, ${m.widthPx}x${m.heightPx})` : partNumber;
}

/** The other deliverables this document refers to. */
export function referenceDocuments(p: ProjectSnapshot, m: DocMeta): string[][] {
  const rows: string[][] = [];
  if (m.drawings) rows.push([`${m.drawings.first} … ${m.drawings.last}`, `Electrical drawing set (${m.drawings.sheets.length} sheets, ANSI B)`, `${p.fileBase}_drawings.pdf`]);
  else rows.push(['—', 'Electrical drawing set', 'not generated yet']);
  rows.push([m.reportNo, 'Project report workbook (I/O list, BOM, wire list, cable schedule, terminal plan, alarm list, FAT/SAT, maintenance)', `${p.fileBase}_report.xlsx`]);
  if (p.drawingCtx) {
    rows.push(['—', 'Bill of materials, wire list, terminal plan, cable schedule (CSV)', 'electrical/*.csv']);
    rows.push(['—', 'Back panel drilling and door cut-out drawings (DXF), 3D cabinet model (STEP)', 'electrical/machining/*.dxf, electrical/3d/*.step']);
  }
  if (p.profile.language === 'ladder' && p.ladder.rungs.length) rows.push(['—', `${p.profile.vendor} ${p.profile.name} PLC program: rung listing, nickname (tag) import file, program data`, `plc/${p.fileBase}_rungs.txt, _nicknames.csv, _program.json`]);
  else if (p.stCode) rows.push(['—', 'PLC program (IEC 61131-3 Structured Text)', `plc/${p.fileBase}.st`]);
  if (p.hmi) rows.push(['—', `HMI screen images and screen PDF (${p.hmi.hmiPartNumber})`, `hmi/${p.fileBase}_hmi_screens.pdf`]);
  rows.push(['—', 'Machine specification (source of all requirements)', 'spec.md']);
  return rows;
}
