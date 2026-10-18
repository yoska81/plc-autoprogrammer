import { IS_PREVIEW } from '../preview/mode';
import type { ParseRequest, ParseResult } from '../workers/parseOps';

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
    worker = new Worker(new URL('../workers/parse.worker.ts', import.meta.url), { type: 'module' });
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

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

/** A DXF file as text for the AI (src/convert/dxf.ts cadToText). */
export async function dxfText(f: File): Promise<string> {
  return parseOffThread({ op: 'dxf-text', key: fileKey(f), text: await f.text(), name: f.name });
}

/** The SVG picture of sheet n of a DXF file, or null when it has no such sheet. */
export async function dxfSheet(f: File, sheet: number): Promise<string | null> {
  return parseOffThread({ op: 'dxf-sheet', key: fileKey(f), text: await f.text(), sheet });
}
