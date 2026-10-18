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
];

export function detectFormat(fileName: string, text: string): SourceFormat | null {
  const head = text.slice(0, 4000);
  if (/<RSLogix5000Content\b/.test(head)) return 'l5x';
  if (/plcopen\.org\/xml\/tc6|<project\b[\s\S]*<types>/i.test(head) || (/<project\b/i.test(head) && /\.xml$/i.test(fileName) && /<pou\b/i.test(text))) return 'plcopen';
  if (/<Document>[\s\S]*SW\.Blocks/i.test(head)) return 'siemens-xml';
  if (/^\s*(IE_VER\s*:=|CONTROLLER\s+\w+\s*\()/m.test(head) || /\.l5k$/i.test(fileName)) return 'l5k';
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
  // Binary content (zip, OLE, …).
  // eslint-disable-next-line no-control-regex -- binary files contain control characters
  if (/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 2000))) return 'This file is not a text export. Export the program as text (L5X / L5K, PLCopen XML, SCL / ST source, CSV) or upload a PDF printout of the ladder.';
  return null;
}

function read(format: SourceFormat, text: string): ForeignProgram {
  switch (format) {
    case 'l5x': return readL5x(text);
    case 'l5k': return readL5k(text);
    case 'plcopen': return readPlcopen(text);
    case 'st': return readStSource(text, false);
    case 'siemens-scl': return readStSource(text, true);
    case 'click-csv': return readClickCsv(text);
    default: throw new Error('This file type is not read yet.');
  }
}

/** Read one text file into the app's program (I/O as placeholders until a PLC is chosen). */
export function importProgramText(fileName: string, text: string): ImportedProgram {
  const why = unreadableReason(fileName, text);
  if (why) throw new Error(why);
  const format = detectFormat(fileName, text);
  if (!format) throw new Error('This file was not recognised as a PLC program export. Supported: Studio 5000 .L5X / .L5K, PLCopen XML, Structured Text / SCL source, CLICK address list (CSV). Or upload a PDF printout of the ladder.');
  return convertForeign(read(format, text), fileName);
}
