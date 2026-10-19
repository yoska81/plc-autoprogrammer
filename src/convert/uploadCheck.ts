/**
 * A quick look at each drawing file before anything is sent to the AI: an empty file, a file that is not what its
 * name says (a renamed or damaged PDF, image, DXF or DWG) or a DXF with no drawing in it gets a plain message
 * here, instead of an AI request (and its retries) that can only fail.
 */
const latin1 = new TextDecoder('latin1');
const ascii = (b: Uint8Array) => latin1.decode(b);
const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/** What each file type starts with (PDF may have a few bytes before its header). */
const IMAGE_SIGS: Record<string, (b: Uint8Array) => boolean> = {
  png: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  jpeg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  gif: (b) => ascii(b.slice(0, 4)) === 'GIF8',
  webp: (b) => ascii(b.slice(0, 4)) === 'RIFF' && ascii(b.slice(8, 12)) === 'WEBP',
};

/** Entity types that show something on a sheet. */
const DRAWN = /\n\s*0\s*\r?\n\s*(LINE|LWPOLYLINE|POLYLINE|TEXT|MTEXT|INSERT|CIRCLE|ARC|ELLIPSE|SPLINE|DIMENSION|SOLID|HATCH|LEADER|MLEADER|ATTRIB|POINT)\s*\r?\n/;

/** PLC (and touch-panel) program files: read on the Import page's Program tab, not as drawings or spec documents. */
export const PLC_PROGRAM_FILE = /\.(ymw\d?|emtp|l5x|l5k|mwt|zwt|pcwex|jbi|acd|rss|ckp|ccwsln|gx3|gxw|ap\d+|s7p|scl|awl|stl)$/i;
export const PLC_PROGRAM_HINT = 'is a PLC program file: open it on Import an existing machine → Program (project tree: Existing machine → PLC program: read / upgrade).';

/** null when the file looks readable, else what is wrong with it, in plain words. */
export async function checkUploadFile(f: File): Promise<string | null> {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (PLC_PROGRAM_FILE.test(f.name)) return `${f.name} ${PLC_PROGRAM_HINT}`;
  if (f.size === 0) return `${f.name} is empty (0 bytes). Export or copy it again.`;
  const head = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
  if (ext === 'pdf') {
    if (!ascii(head).includes('%PDF-')) return `${f.name} is not a PDF (it doesn't start like one). Print or export the drawings to PDF again.`;
    // the end marker is near the end; signed or linearized files can carry more after it
    const tail = async (n: number) => ascii(new Uint8Array(await f.slice(Math.max(0, f.size - n)).arrayBuffer())).includes('%%EOF');
    if (!(await tail(8192)) && !(await tail(65536))) return `${f.name} is cut off (the end of the PDF is missing). Download or export it again.`;
    return null;
  }
  if (IMAGE_SIGS[ext]) return IMAGE_SIGS[ext](head) ? null : `${f.name} is not a ${ext.toUpperCase()} image (it doesn't start like one). Save the picture again.`;
  if (ext === 'dwg') return /^(AC1\d{3}|AC2\.|MC0\.)/.test(ascii(head.slice(0, 6))) ? null : `${f.name} is not a DWG file (it doesn't start like one). Save it again in AutoCAD, or as DXF.`;
  if (ext === 'dxf') {
    if (ascii(head.slice(0, 18)) === 'AutoCAD Binary DXF') return `${f.name} is a binary DXF, which can't be read. Save it as an ASCII DXF in AutoCAD (File → Save As → DXF, Options: ASCII).`;
    const text = await f.text();
    if (!/(^|\n)\s*0\s*\r?\n\s*SECTION\s*\r?\n/.test(text)) return `${f.name} is not a DXF file (no DXF sections in it). Save it again from the CAD program (File → Save As → DXF).`;
    // a drawn entity in the ENTITIES section (a scan, not a parse: the import parses the file once, after this)
    const at = text.search(/(^|\n)\s*2\s*\r?\n\s*ENTITIES\s*\r?\n/);
    const end = at < 0 ? -1 : text.indexOf('ENDSEC', at + 10);
    if (at < 0 || !DRAWN.test(text.slice(at, end < 0 ? undefined : end))) return `${f.name} has no drawing in it (no lines or text). Check that the right file was exported.`;
    return null;
  }
  return null;
}

/** Every file checked; the problems found, one line each (empty when all look readable). */
export async function checkUploadFiles(files: File[]): Promise<string[]> {
  return (await Promise.all(files.map(checkUploadFile))).filter((x): x is string => Boolean(x));
}
