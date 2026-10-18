import { cadToText, parseDxfEntities, type CadEntity } from '../convert/dxf';
import { dxfSheetPicture } from '../convert/dxfPicture';
import { importProgramFiles } from '../plc/import';

/**
 * The heavy parsing of uploaded files (DXF drawings, PLC programs) as plain functions: run by the parse
 * worker (src/workers/parse.worker.ts) and, where no worker can run (the claude.ai preview, Node tests),
 * on the page by src/lib/parseWorker.ts. A DXF is parsed once per file and kept for its sheet pictures.
 */
export type ParseRequest =
  | { op: 'dxf-text'; key: string; text: string; name: string }
  | { op: 'dxf-sheet'; key: string; text: string; sheet: number }
  | { op: 'program'; files: { name: string; text: string }[] };

export type ParseResult<R extends ParseRequest> =
  R extends { op: 'dxf-text' } ? string : R extends { op: 'dxf-sheet' } ? string | null : ReturnType<typeof importProgramFiles>;

const MAX_DXF = 4;
const parsed = new Map<string, CadEntity[]>();

function entities(key: string, text: string): CadEntity[] {
  let e = parsed.get(key);
  if (!e) {
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
  }
  throw new Error('Unknown parse request');
}
