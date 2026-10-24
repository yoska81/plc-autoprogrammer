/**
 * "How the program works" as files: a PDF (the deliverables' small controlled document) and a Word .docx (a minimal
 * WordprocessingML package written here: headings, paragraphs and bulleted lines, no other library).
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { MUTED } from '../../deliverables/docs/pdfWriter';
import type { BlockExplanation, ProgramExplanation } from './explain';

/** The sections of one block, in the order they are written. */
export function blockSections(b: BlockExplanation): [string, string[]][] {
  return ([
    ['Reads from the machine', b.inputs],
    ['Drives', b.outputs],
    ['Uses from other blocks', b.uses],
    ['Gives to other blocks', b.gives],
    ['Timers', b.timers],
    ['Counters', b.counters],
    [b.sequence ? `Steps (${b.sequence.register})` : '', b.sequence ? b.sequence.steps.map((s) => `Step ${s.step}: ${s.does.join('; ') || 'waits'}${s.next.length ? `; then ${s.next.join('; or ')}` : ''}`) : []],
    ['Alarms', b.alarms],
    ['Instructions the app cannot read (kept as they were)', b.notRead],
    ['To complete by hand', b.toComplete],
  ] as [string, string[]][]).filter(([t, xs]) => t && xs.length);
}

export async function buildExplanationPdf(p: ProjectSnapshot, x: ProgramExplanation): Promise<Blob> {
  const { simpleDoc } = await import('../../deliverables/programListingPdf');
  return simpleDoc(p, 'How the program works', `${p.profile.vendor} ${p.profile.name} · ${p.ladder.rungs.length} rungs, ${x.blocks.length} blocks · one section per block`, (w) => {
    for (const t of x.overview) w.para(t);
    for (const b of x.blocks) {
      w.h2(`${b.name} (${b.rungs})`, false);
      if (b.aiSummary) w.para(b.aiSummary);
      w.para(b.what);
      for (const [title, items] of blockSections(b)) {
        w.text(title, { size: 9, bold: true, gap: 0.5 });
        w.bullets(items, { size: 8.6 });
      }
    }
    w.text('Made from the program itself (names from the I/O list, the tags and the HMI). A paragraph per block marked by the AI, when asked for, is a summary of the same: check it against the logic.', { size: 7.5, color: MUTED });
  });
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // characters XML 1.0 does not allow
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const para = (t: string, style?: string, indent = false) =>
  `<w:p>${style || indent ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${indent ? '<w:ind w:left="360" w:hanging="200"/>' : ''}</w:pPr>` : ''}<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;

export async function buildExplanationDocx(x: ProgramExplanation): Promise<Blob> {
  const parts: DocPart[] = [{ title: x.title }, ...x.overview.map((t) => ({ p: t }))];
  for (const b of x.blocks) {
    parts.push({ h1: `${b.name} (${b.rungs})` });
    if (b.aiSummary) parts.push({ p: b.aiSummary });
    parts.push({ p: b.what });
    for (const [title, items] of blockSections(b)) {
      parts.push({ h2: title });
      for (const i of items) parts.push({ li: i });
    }
  }
  return docxFrom(parts);
}

/** One piece of a Word document: the title, a heading (two levels), a paragraph or a bulleted line. */
export type DocPart = { title: string } | { h1: string } | { h2: string } | { p: string } | { li: string };

/** A Word .docx from its pieces (a minimal WordprocessingML package: styles for the title and two heading levels). */
export async function docxFrom(parts: DocPart[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const body = parts.map((x) => ('title' in x ? para(x.title, 'Title') : 'h1' in x ? para(x.h1, 'Heading1') : 'h2' in x ? para(x.h2, 'Heading2') : 'li' in x ? para(`• ${x.li}`, undefined, true) : para(x.p)));
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  const style = (id: string, name: string, size: number, bold: boolean, before: number) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="80"/>${id.startsWith('Heading') ? `<w:outlineLvl w:val="${Number(id.slice(-1)) - 1}"/>` : ''}</w:pPr><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="1F3A5F"/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${style('Title', 'Title', 36, true, 0)}${style('Heading1', 'heading 1', 28, true, 280)}${style('Heading2', 'heading 2', 22, true, 120)}</w:styles>`);
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
