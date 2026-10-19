import { cadToText, parseDxfEntities, type CadEntity } from '../convert/dxf';
import { dxfSheetPicture } from '../convert/dxfPicture';
import { importProgramFiles, type ImportedProgram } from '../plc/import';
import { planUpgrade } from '../plc/import/upgrade';

/**
 * The heavy parsing of uploaded files (DXF drawings, PLC programs, and the plan that makes a program the
 * project) as plain functions: run by the parse worker (src/workers/parse.worker.ts) and, where no worker
 * can run (the claude.ai preview, Node tests), on the page by src/lib/parseWorker.ts. A DXF is parsed once per file and kept for its sheet pictures
 * (later requests send only its key).
 */
export type ParseRequest =
  | { op: 'dxf-text'; key: string; text?: string; name: string }
  | { op: 'dxf-sheet'; key: string; text?: string; sheet: number }
  | { op: 'program'; files: { name: string; text: string; bytes?: Uint8Array }[] }
  | { op: 'plan'; imp: ImportedProgram; plcId: string };

export type ParseResult<R extends ParseRequest> =
  R extends { op: 'dxf-text' } ? string : R extends { op: 'dxf-sheet' } ? string | null
  : R extends { op: 'plan' } ? ReturnType<typeof planUpgrade> : ReturnType<typeof importProgramFiles>;

const MAX_DXF = 4;
/** The answer to a DXF request sent by key only (no text) whose file is not (or no longer) kept: send the text. */
export const NOT_PARSED = 'not parsed';
const parsed = new Map<string, CadEntity[]>();

function entities(key: string, text: string | undefined): CadEntity[] {
  let e = parsed.get(key);
  if (!e) {
    if (text === undefined) throw new Error(NOT_PARSED);
    e = parseDxfEntities(text);
    parsed.set(key, e);
    if (parsed.size > MAX_DXF) parsed.delete(parsed.keys().next().value as string);
  }
  return e;
}

export function runParse<R extends ParseRequest>(req: R): ParseResult<R> {
  switch (req.op) {
    case 'dxf-text': return cadToText(entities(req.key, req.text), req.name) as ParseResult<R>;
    case 'dxf-sheet': return dxfSheetPicture(entities(req.key, req.text), req.sheet) as ParseResult<R>;
    case 'program': return importProgramFiles(req.files) as ParseResult<R>;
    case 'plan': return planUpgrade(req.imp, req.plcId) as ParseResult<R>;
  }
  throw new Error('Unknown parse request');
}
