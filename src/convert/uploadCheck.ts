/**
 * A quick look at each drawing file before anything is sent to the AI: an empty file, a file that is not what its
 * name says (a renamed or damaged PDF, image, DXF or DWG) or a DXF with no drawing in it gets a plain message
 * here, instead of an AI request (and its retries) that can only fail.
 */
import { parseDxfEntities } from './dxf';

const ascii = (b: Uint8Array) => String.fromCharCode(...b);
const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/** What each file type starts with (PDF may have a few bytes before its header). */
const IMAGE_SIGS: Record<string, (b: Uint8Array) => boolean> = {
  png: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  jpeg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  gif: (b) => ascii(b.slice(0, 4)) === 'GIF8',
  webp: (b) => ascii(b.slice(0, 4)) === 'RIFF' && ascii(b.slice(8, 12)) === 'WEBP',
};

/** null when the file looks readable, else what is wrong with it, in plain words. */
export async function checkUploadFile(f: File): Promise<string | null> {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (f.size === 0) return `${f.name} is empty (0 bytes). Export or copy it again.`;
  const head = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
  if (ext === 'pdf') {
    if (!ascii(head).includes('%PDF-')) return `${f.name} is not a PDF (it doesn't start like one). Print or export the drawings to PDF again.`;
    const tail = ascii(new Uint8Array(await f.slice(Math.max(0, f.size - 8192)).arrayBuffer()));
    if (!tail.includes('%%EOF')) return `${f.name} is cut off (the end of the PDF is missing). Download or export it again.`;
    return null;
  }
  if (IMAGE_SIGS[ext]) return IMAGE_SIGS[ext](head) ? null : `${f.name} is not a ${ext.toUpperCase()} image (it doesn't start like one). Save the picture again.`;
  if (ext === 'dwg') return /^(AC1\d{3}|AC2\.|MC0\.)/.test(ascii(head.slice(0, 6))) ? null : `${f.name} is not a DWG file (it doesn't start like one). Save it again in AutoCAD, or as DXF.`;
  if (ext === 'dxf') {
    if (ascii(head.slice(0, 18)) === 'AutoCAD Binary DXF') return `${f.name} is a binary DXF, which can't be read. Save it as an ASCII DXF in AutoCAD (File → Save As → DXF, Options: ASCII).`;
    const text = await f.text();
    if (!/(^|\n)\s*0\s*\r?\n\s*SECTION\s*\r?\n/.test(text)) return `${f.name} is not a DXF file (no DXF sections in it). Save it again from the CAD program (File → Save As → DXF).`;
    if (!parseDxfEntities(text).length) return `${f.name} has no drawing in it (no lines or text). Check that the right file was exported.`;
    return null;
  }
  return null;
}

/** Every file checked; the problems found, one line each (empty when all look readable). */
export async function checkUploadFiles(files: File[]): Promise<string[]> {
  return (await Promise.all(files.map(checkUploadFile))).filter((x): x is string => Boolean(x));
}
