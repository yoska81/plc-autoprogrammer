/**
 * "Upgrade existing program": read a PLC program file, recognise its format and convert it.
 *   detectFormat(name, text) → which reader; importProgramText(name, text) → ImportedProgram;
 *   materialize(imported, profile, cpu, modules) (convert.ts) → program + I/O list for the chosen PLC.
 */
import { readL5x } from './l5x';
import { readL5k } from './l5k';
import { readPlcopen } from './plcopen';
import { readStSource } from './stSource';
import { readClickCsv } from './clickCsv';
import { convertForeign } from './convert';
import { decodeCsv, isGxComments, isGxProgram, isIlComments, isIlText, readGxCsv, readIlText } from './gxCsv';
import { isSiemensTagTable, mergeSiemensTags, readSiemensTags } from './siemensTags';
import { isStlSource, readStlSource } from './stl';
import { readTiaXml } from './tiaXml';
import { isYmw7, readYmw7 } from './mpe720';
import { isEmtp, readEmtp } from './emtp';
import type { ForeignProgram, ImportedProgram, SourceFormat } from './types';

export { materialize } from './convert';
export * from './types';

/** Native project files a browser cannot read, and what to export instead. */
export const NATIVE_FILES: { ext: RegExp; product: string; howTo: string }[] = [
  { ext: /\.acd$/i, product: 'Studio 5000 project (.ACD)', howTo: 'In Studio 5000: File › Save As… › type "Logix Designer XML File (*.L5X)", then upload the .L5X.' },
  { ext: /\.rss$|\.rsp$/i, product: 'RSLogix 500 / 5 project', howTo: 'Print the program to PDF (File › Report Options › Print to PDF) and upload the PDF; the AI reads the rungs.' },
  { ext: /\.ckp$/i, product: 'CLICK project (.ckp)', howTo: 'In CLICK Programming Software: Address Picker › Export (CSV) for the names, and File › Print › "Microsoft Print to PDF" for the ladder. Upload both.' },
  { ext: /\.ap\d+$|\.zap\d+$/i, product: 'TIA Portal project', howTo: 'In TIA Portal: right-click the blocks › "Generate source from blocks" (SCL/STL source) and PLC tags › Export (tag table). Upload both. For ladder (LAD) blocks, print them to PDF.' },
  { ext: /\.s7p$/i, product: 'STEP 7 Classic project', howTo: 'In SIMATIC Manager: open the blocks in LAD/STL/FBD, File › Generate Source, and Symbol Table › Export. Upload the .AWL and the symbol file.' },
  { ext: /\.gx\w*$|\.gxw$/i, product: 'Mitsubishi GX Works project', howTo: 'In GX Works: Project › Export to File › CSV (instruction list) for the program and the device comments. Upload both.' },
  { ext: /\.isp$|\.dvp$/i, product: 'Delta ISPSoft / WPLSoft project', howTo: 'In ISPSoft / WPLSoft: open the program in Instruction List view and export it as text (File › Export), plus the device comments. Upload them.' },
  { ext: /\.vlp$|\.ulpr$|\.vlpx$/i, product: 'Unitronics project', howTo: 'Unitronics projects cannot be exported as text: print the ladder to PDF (File › Print) and upload the PDF.' },
  { ext: /\.ccwsln$|\.ccwarc$/i, product: 'Connected Components Workbench project', howTo: 'In CCW: export the programs as PLCopen XML (right-click the program › Export) and upload the .xml.' },
  { ext: /\.project$|\.projectarchive$/i, product: 'CODESYS project', howTo: 'In CODESYS: Project › Export PLCopenXML… and upload the .xml.' },
  { ext: /\.mwt$|\.zwt$/i, product: 'Yaskawa MotionWorks IEC project', howTo: 'In MotionWorks IEC: open the project, then File › Export › PLCopen XML for the whole project, and upload the .xml.' },
  { ext: /\.pcwex$/i, product: 'Yaskawa iCube Engineer / PLCnext Engineer project', howTo: 'In iCube Engineer: export the programs as PLCopen XML and upload the .xml. A printout of the ladder (PDF) also works, under "Or a printout of the program" below.' },
  { ext: /\.jbi$/i, product: 'Yaskawa Motoman robot job (.JBI)', howTo: 'A robot job holds the robot\'s moves, not the machine\'s PLC program, and is not read here. Upload the PLC program that runs with the robot (with MotoLogix, the Studio 5000 .L5X or the Siemens project export).' },
];

export function detectFormat(fileName: string, text: string): SourceFormat | null {
  const head = text.slice(0, 4000);
  if (/<RSLogix5000Content\b/.test(head)) return 'l5x';
  if (/plcopen\.org\/xml\/tc6|<project\b[\s\S]*<types>/i.test(head) || (/<project\b/i.test(head) && /\.xml$/i.test(fileName) && /<pou\b/i.test(text))) return 'plcopen';
  if (/<Document>[\s\S]*SW\.Blocks/i.test(head)) return 'siemens-xml';
  if (/^\s*(IE_VER\s*:=|CONTROLLER\s+\w+\s*\()/m.test(head) || /\.l5k$/i.test(fileName)) return 'l5k';
  if (isGxProgram(head)) return 'mitsubishi-csv';
  if (isIlText(text)) return 'il-text';
  if (isStlSource(text) || /\.awl$|\.stl$/i.test(fileName)) return 'siemens-stl';
  const first = head.split(/\r?\n/)[0] ?? '';
  if (/address/i.test(first) && /nickname/i.test(first)) return 'click-csv';
  if (/\b(ORGANIZATION_BLOCK|DATA_BLOCK)\b/.test(head) || /FUNCTION_BLOCK\s+"/.test(head) || (/\bBEGIN\b/.test(text) && /\bEND_FUNCTION_BLOCK\b|\bEND_ORGANIZATION_BLOCK\b/.test(text)) || /\.scl$/i.test(fileName)) return 'siemens-scl';
  if (/\b(PROGRAM|FUNCTION_BLOCK)\b[\s\S]*\bEND_(PROGRAM|FUNCTION_BLOCK)\b/.test(text) || /\.st$/i.test(fileName)) return 'st';
  return null;
}

/** Plain-words reason a file cannot be read, with what to do instead; null when it can be read. */
export function unreadableReason(fileName: string, text: string): string | null {
  const native = NATIVE_FILES.find((n) => n.ext.test(fileName));
  if (native) return `${native.product}: this file is in the maker's own format and cannot be read here. ${native.howTo}`;
  // A PDF is a printout: it is read by the printout reader on the same page, not here.
  if (/\.pdf$/i.test(fileName) || text.startsWith('%PDF')) return 'This is a PDF. A printout of the ladder (PDF or pictures) is read under "Or a printout of the program" below; this box takes the program exported as text.';
  // Binary content (zip, OLE, …).
  // eslint-disable-next-line no-control-regex -- binary files contain control characters
  if (/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 2000))) return 'This file is not a text export. Export the program as text (L5X / L5K, PLCopen XML, SCL / ST source, CSV). A printout of the ladder (PDF or pictures) goes under "Or a printout of the program" below.';
  return null;
}

function read(format: SourceFormat, text: string): ForeignProgram {
  switch (format) {
    case 'l5x': return readL5x(text);
    case 'l5k': return readL5k(text);
    // Windows exports use CRLF: the statement readers work on plain LF lines.
    case 'plcopen': return readPlcopen(text.replace(/\r\n?/g, '\n'));
    case 'st': return readStSource(text.replace(/\r\n?/g, '\n'), false);
    case 'siemens-scl': return readStSource(text.replace(/\r\n?/g, '\n'), true);
    case 'click-csv': return readClickCsv(text);
    case 'mitsubishi-csv': return readGxCsv(text);
    case 'il-text': return readIlText(text);
    case 'siemens-stl': return readStlSource(text);
    case 'siemens-xml': return readTiaXml(text);
    default: throw new Error('This file type is not read yet.');
  }
}

/** Read one text file into the app's program (I/O as placeholders until a PLC is chosen). */
export function importProgramText(fileName: string, text: string): ImportedProgram {
  const why = unreadableReason(fileName, text);
  if (why) throw new Error(why);
  const format = detectFormat(fileName, text);
  if (!format) throw new Error(NOT_RECOGNISED);
  return convertForeign(read(format, text), fileName);
}

const NOT_RECOGNISED = 'This file was not recognised as a PLC program export. Supported: Studio 5000 .L5X / .L5K, PLCopen XML, Structured Text / SCL source, Mitsubishi GX Works CSV (program + device comments), CLICK address list (CSV), Yaskawa MPE720 project (.YMW7). Or upload a PDF printout of the ladder.';

/** File bytes as text: UTF-16 exports (GX Works) are decoded by their byte order mark. */
export function fileText(name: string, bytes: Uint8Array): string {
  return /\.csv$|\.txt$/i.test(name) || (bytes[0] === 0xff && bytes[1] === 0xfe) ? decodeCsv(bytes) : new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

/**
 * Read the files of one program: the program file plus companions (GX Works device comments).
 * Returns the program and the name of the main file.
 */
export function importProgramFiles(files: { name: string; text: string; bytes?: Uint8Array }[]): { program: ImportedProgram; main: { name: string; text: string } } {
  // Yaskawa MPE720 project (binary), with the Weintek touch-panel project when it came along.
  const ymw = files.find((f) => f.bytes && isYmw7(f.name, f.bytes));
  const panel = files.find((f) => f.bytes && isEmtp(f.name, f.bytes));
  if (ymw) {
    const fp = readYmw7(ymw.bytes!, ymw.name, panel ? readEmtp(panel.bytes!) : undefined);
    return { program: convertForeign(fp, ymw.name), main: { name: ymw.name, text: '' } };
  }
  if (panel) throw new Error(`${panel.name}: this is the touch-panel project (Weintek EasyBuilder Pro). Add the PLC project with it (Yaskawa MPE720: the .YMW7 file).`);
  for (const f of files) { const why = unreadableReason(f.name, f.text); if (why) throw new Error(`${f.name}: ${why}`); }
  const gx = files.find((f) => isGxProgram(f.text));
  if (gx) {
    const comments = files.find((f) => f !== gx && isGxComments(f.text));
    return { program: convertForeign(readGxCsv(gx.text, comments?.text ?? ''), gx.name), main: gx };
  }
  if (files.length === 1 || files.every((f) => isGxComments(f.text))) {
    if (files.every((f) => isGxComments(f.text))) throw new Error('This is a GX Works device comment file: add the program CSV (Project › Export to CSV) with it.');
  }
  const main = files.find((f) => detectFormat(f.name, f.text) && detectFormat(f.name, f.text) !== 'click-csv') ?? files.find((f) => detectFormat(f.name, f.text));
  if (!main) throw new Error(files.some((f) => isSiemensTagTable(f.text)) ? 'This is a PLC tag table: add the program (SCL source or PLCopen XML) with it.' : NOT_RECOGNISED);
  const format = detectFormat(main.name, main.text)!;
  // Delta / Inovance / Xinje instruction list with its device comment list.
  if (format === 'il-text') {
    const comments = files.find((f) => f !== main && isIlComments(f.text));
    return { program: convertForeign(readIlText(main.text, comments?.text ?? ''), main.name), main };
  }
  // Siemens: the PLC tag table gives the addresses the SCL source does not have.
  const table = files.find((f) => f !== main && isSiemensTagTable(f.text));
  if (table && (format === 'siemens-scl' || format === 'siemens-stl' || format === 'siemens-xml' || format === 'st' || format === 'plcopen')) {
    const fp = read(format, main.text);
    mergeSiemensTags(fp, readSiemensTags(table.text));
    return { program: convertForeign(fp, main.name), main };
  }
  return { program: importProgramText(main.name, main.text), main };
}
