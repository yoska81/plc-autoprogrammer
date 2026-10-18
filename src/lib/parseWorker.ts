import { IS_PREVIEW } from '../preview/mode';
import { spawnParseWorker } from './parseWorkerSpawn';
import { NOT_PARSED, type ParseRequest, type ParseResult } from '../workers/parseOps';

/**
 * Parse uploaded files off the main thread: big DXF sets and long PLC programs take seconds and would
 * freeze the page. One worker, kept for the session (it keeps the parsed DXFs for their sheet pictures).
 * Where no worker can run — the claude.ai preview is a single file, Node has no Worker — the same code
 * runs on the page.
 */
let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (IS_PREVIEW || typeof Worker === 'undefined') return null;
  try {
    worker = spawnParseWorker();
    worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.error !== undefined) w.reject(new Error(e.data.error)); else w.resolve(e.data.result);
    };
    // the worker could not start or crashed: answer what is waiting on the page instead
    worker.onerror = () => { worker = null; for (const [, w] of waiting) w.reject(new Error('worker failed')); waiting.clear(); };
  } catch {
    worker = null;
  }
  return worker;
}

async function onPage<R extends ParseRequest>(req: R): Promise<ParseResult<R>> {
  const { runParse } = await import('../workers/parseOps');
  return runParse(req);
}

export async function parseOffThread<R extends ParseRequest>(req: R): Promise<ParseResult<R>> {
  const w = getWorker();
  if (!w) return onPage(req);
  const id = ++nextId;
  try {
    return await new Promise<ParseResult<R>>((resolve, reject) => {
      waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ id, req });
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'worker failed') return onPage(req);
    throw err;
  }
}

/**
 * A DXF's key: its name, size and a hash of its bytes (an edited file saved within the same second, at
 * the same size, is still a different drawing). Worked out once per File.
 */
const keys = new WeakMap<File, Promise<string>>();
function fileKey(f: File): Promise<string> {
  let k = keys.get(f);
  if (!k) {
    k = f.arrayBuffer().then(async (buf) => {
      const subtle = globalThis.crypto?.subtle;
      if (subtle) return [...new Uint8Array(await subtle.digest('SHA-1', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const bytes = new Uint8Array(buf);
      let h = 0x811c9dc5;
      for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
      return (h >>> 0).toString(16);
    }).then((hash) => `${f.name}|${f.size}|${hash}`);
    keys.set(f, k);
  }
  return k;
}

/** A DXF request by key; the file's text is sent only when the worker does not keep it parsed. */
async function dxfRequest<R extends Extract<ParseRequest, { key: string }>>(f: File, req: Omit<R, 'key' | 'text'>): Promise<ParseResult<R>> {
  const key = await fileKey(f);
  try {
    return await parseOffThread({ ...req, key } as R);
  } catch (err) {
    if (!(err instanceof Error && err.message === NOT_PARSED)) throw err;
    return parseOffThread({ ...req, key, text: await f.text() } as R);
  }
}

/** A DXF file as text for the AI (src/convert/dxf.ts cadToText). */
export function dxfText(f: File): Promise<string> {
  return dxfRequest<Extract<ParseRequest, { op: 'dxf-text' }>>(f, { op: 'dxf-text', name: f.name });
}

/** The SVG picture of sheet n of a DXF file, or null when it has no such sheet. */
export function dxfSheet(f: File, sheet: number): Promise<string | null> {
  return dxfRequest<Extract<ParseRequest, { op: 'dxf-sheet' }>>(f, { op: 'dxf-sheet', sheet });
}
