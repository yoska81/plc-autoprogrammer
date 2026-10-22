/**
 * "Read from TIA Portal" (Upgrade page): what the TIA bridge's readBack gives (every block of the open project as
 * SimaticML, every PLC tag) as the files the program import already reads: one SimaticML document holding all the
 * blocks (readTiaXml takes every FB / FC / OB of a document) and the tag table as CSV (readSiemensTags).
 */

export interface TiaReadBack {
  plc: { name: string; orderNumber: string; firmware: string } | null;
  blocks: { name: string; xml: string }[];
  failed: { name: string; error: string }[];
  tags: { name: string; dataType: string; address: string; comment: string }[];
}

const csvCell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** The blocks of one SimaticML document each, as one document (the first Engineering version kept). */
export function oneDocument(xmls: string[]): string {
  let engineering = '';
  const parts = xmls.map((x) => {
    const inner = x.replace(/^\uFEFF/, '').replace(/<\?xml[^>]*\?>/, '').replace(/^\s*<Document>\s*/, '').replace(/\s*<\/Document>\s*$/, '');
    return inner.replace(/<Engineering\b[^>]*\/>\s*/, (e) => { engineering ||= e.trim(); return ''; }).trim();
  });
  return ['<?xml version="1.0" encoding="utf-8"?>', '<Document>', ...(engineering ? [`  ${engineering}`] : []), ...parts, '</Document>', ''].join('\n');
}

/** The read back as files for the program import; the name says where it came from. */
export function readBackFiles(r: TiaReadBack, projectName: string): { name: string; text: string }[] {
  const base = (projectName.replace(/^.*[\\/]/, '').replace(/\.\w+$/, '') || 'TIA').replace(/[^\w-]+/g, '_');
  const files = [{ name: `${base}_blocks.xml`, text: oneDocument(r.blocks.map((b) => b.xml)) }];
  const io = r.tags.filter((t) => t.address);
  if (io.length) files.push({ name: `${base}_PLC_tags.csv`, text: ['Name,Data Type,Logical Address,Comment', ...io.map((t) => [t.name, t.dataType, t.address, t.comment].map(csvCell).join(','))].join('\r\n') });
  return files;
}
