/**
 * "Ask a human engineer": everything a checking engineer needs in one zip (drawings PDF, BOM, I/O
 * list, machine specification and the review findings), and an e-mail draft to send it with.
 * There is no marketplace: the user sends it to an engineer they choose.
 */
import type { ProjectSnapshot } from '../deliverables/collect';
import { bomCsv } from '../electrical/derive';
import { SEVERITY_LABEL, sortFindings } from '../review/types';
import type { EngineerFinding } from './checks';

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function findingsCsv(findings: EngineerFinding[]): string {
  const rows = [['Severity', 'Area', 'Title', 'Detail', 'Fix', 'Device', 'Drawing', 'Source']];
  for (const f of sortFindings(findings) as EngineerFinding[]) rows.push([SEVERITY_LABEL[f.severity], f.area, f.title, f.detail, f.fix, f.item, f.ref ?? '', f.source === 'ai' ? 'AI engineer' : 'Rule check']);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function findingsMarkdown(p: ProjectSnapshot, findings: EngineerFinding[], summary: string | null): string {
  const lines = [`# Engineer review — ${p.projectName}`, '', `Generated ${new Date().toISOString().slice(0, 10)} by ISA Auto Programmer (AI-assisted; to be checked by a qualified engineer).`, ''];
  if (summary) lines.push(summary, '');
  for (const f of sortFindings(findings) as EngineerFinding[]) {
    lines.push(`## ${SEVERITY_LABEL[f.severity]}: ${f.title}`, '', f.detail, '', `**Fix:** ${f.fix}`);
    if (f.ref || f.item) lines.push('', `Device ${f.item || '—'}${f.ref ? ` · drawings ${f.ref}` : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** The review package as a zip, and its file name. */
export async function buildReviewPackage(p: ProjectSnapshot, findings: EngineerFinding[], summary: string | null): Promise<{ name: string; blob: Blob }> {
  const [{ default: JSZip }, files, { machineSpecText }] = await Promise.all([import('jszip'), import('../deliverables/files'), import('../deliverables/machineSpec')]);
  const zip = new JSZip();
  const drawings = await files.buildDrawingsPdf(p);
  if (drawings) zip.file(`${p.fileBase}_drawings.pdf`, drawings);
  if (p.drawingCtx) zip.file('bom.csv', bomCsv(p.drawingCtx));
  zip.file('io_list.csv', files.ioCsv(p));
  zip.file('machine_specification.md', machineSpecText(p));
  zip.file('engineer_findings.csv', findingsCsv(findings));
  zip.file('engineer_review.md', findingsMarkdown(p, findings, summary));
  zip.file('README.txt', [
    `Review package: ${p.projectName}`, '',
    'Please check this machine control design:',
    `- ${p.fileBase}_drawings.pdf: the electrical drawing set`,
    '- bom.csv: bill of materials', '- io_list.csv: PLC inputs and outputs', '- machine_specification.md: what the machine does',
    '- engineer_review.md / engineer_findings.csv: findings already raised (rule checks and an AI engineer)', '',
    'The design was produced with an AI-assisted tool and has not yet been approved by a qualified engineer.',
  ].join('\r\n'));
  return { name: `${p.fileBase}_review_package.zip`, blob: await zip.generateAsync({ type: 'blob' }) };
}

/** mailto: link with a ready subject and body (attachments can't ride on mailto: the user attaches the zip). */
export function reviewMailto(p: ProjectSnapshot, findings: EngineerFinding[], fileName: string, to = ''): string {
  const count = (s: string) => findings.filter((f) => f.severity === s).length;
  const subject = `Design review request: ${p.projectName}`;
  const body = [
    'Hello,', '',
    `Could you review the electrical design of "${p.projectName}" (${p.drawingCtx?.design.inputs.supply ?? ''}, ${p.info.region}) before we order parts and build the panel?`, '',
    `Attached: ${fileName} (drawings PDF, BOM, I/O list, machine specification and the findings raised so far: ${count('critical')} critical, ${count('major')} major, ${count('minor')} minor).`, '',
    'Please let us know your fee and when you could look at it.', '', 'Thank you,',
  ].join('\n');
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
