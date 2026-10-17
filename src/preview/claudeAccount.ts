/**
 * In the claude.ai preview the page can't reach api.anthropic.com, but the
 * viewer's own Claude account can answer through the artifact runtime
 * (`claude.use("sample")`). The first request asks the viewer to allow it.
 * Files are offered through `claude.use("downloads")`.
 */
import { loadPdfjs } from '../lib/pdfjs';
import JSZip from 'jszip';

interface SampleError { code: string; message: string; text?: string }
interface SampleOptions {
  onText?: (u: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  images?: Blob[];
  modelTier?: 'default' | 'complex' | 'quick';
  model?: string;
  effort?: 'low' | 'medium' | 'high';
  cache?: boolean;
}
type SampleInput = string | { role: 'user' | 'assistant'; content: string }[];
interface SampleFn {
  (input: SampleInput, options?: SampleOptions): Promise<{ text: string; truncated: boolean; modelApplied?: string }>;
  json: <T = unknown>(input: SampleInput, options?: SampleOptions) => Promise<T>;
}
interface DownloadsNs { save: (r: { filename: string; data: string | Blob | ArrayBuffer }) => Promise<{ status: string }> }
interface ClaudeRuntime { use: (name: string) => Promise<unknown> }

const runtime = (): ClaudeRuntime | null => (window as unknown as { claude?: ClaudeRuntime }).claude ?? null;

let samplePromise: Promise<SampleFn | null> | null = null;
let downloadsPromise: Promise<DownloadsNs | null> | null = null;

function getSample(): Promise<SampleFn | null> {
  samplePromise ??= (runtime()?.use('sample') as Promise<SampleFn | null> | undefined)?.catch(() => null) ?? Promise.resolve(null);
  return samplePromise;
}
function getDownloads(): Promise<DownloadsNs | null> {
  downloadsPromise ??= (runtime()?.use('downloads') as Promise<DownloadsNs | null> | undefined)?.catch(() => null) ?? Promise.resolve(null);
  return downloadsPromise;
}

const ERRORS: Record<string, string> = {
  not_granted: 'Claude was not allowed for this page. Reload the preview and choose Allow when it asks to use Claude.',
  sampling_disabled: 'Claude is not available for your account in this preview.',
  not_declared: 'This preview was published without access to Claude. Ask for it to be republished.',
  capability_disabled: 'Claude is not available in this view of the preview.',
  capability_removed: 'Your Claude app is out of date for this feature. Update or reload it.',
  rate_limited: 'Your Claude usage limit (or too many requests at once) was reached. Wait a little and try again.',
  session_expired: 'Your Claude session expired. Sign in again and reload the preview.',
  refused: 'Claude declined this request. Try rephrasing it.',
  empty_completion: 'Claude returned an empty answer. Try again with more detail.',
  invalid_json: 'Claude\'s answer could not be read as data. Try again.',
  prompt_too_large: 'This request is too large for the preview. Split the machine into smaller parts.',
  images_unavailable: 'Images can\'t be sent to Claude in this view.',
  image_rejected: 'One of the images could not be used. Try a JPEG or PNG.',
  cancelled: 'Stopped.',
};

function friendly(e: unknown): Error {
  const se = e as SampleError;
  // keep the code on the error: callClaude retries 'rate_limited' and treats 'cancelled' as a stop
  if (se && typeof se.code === 'string') return Object.assign(new Error(ERRORS[se.code] ?? `Claude could not answer right now (${se.code}). Try again.`, { cause: e }), { code: se.code });
  return e instanceof Error ? e : new Error(String(e));
}

/** Read a JSON value from a model answer: plain, in a code fence, with text around it or trailing commas. */
export function parseJsonLenient(text: string): unknown {
  const tries: string[] = [];
  const t = text.trim();
  tries.push(t);
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) tries.push(fence[1].trim());
  const start = t.search(/[{[]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) tries.push(t.slice(start, end + 1));
  for (const c of [...tries]) tries.push(c.replace(/,\s*([}\]])/g, '$1'));
  for (const c of tries) {
    try { return JSON.parse(c); } catch { /* next */ }
  }
  return undefined;
}

/** True when the preview can run AI through the viewer's Claude account. */
export async function accountAvailable(): Promise<boolean> {
  return (await getSample()) !== null;
}

type Block = { type: string; text?: string; source?: { type: string; media_type?: string; data?: string } };

/** Plain text of a PDF (base64), page by page; '' when it has no text layer. */
async function pdfText(data: string): Promise<string> {
  try {
    const pdfjs = await loadPdfjs();
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, 40); n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim());
    }
    return pages.filter(Boolean).map((t, i) => `--- page ${i + 1} ---\n${t}`).join('\n').slice(0, 120_000);
  } catch {
    return '';
  }
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Same contract as callClaude: system prompt, turns and an optional JSON
 * schema; returns the answer text (JSON text when a schema is given).
 */
export async function callClaudeAccount(opts: {
  model: string;
  effort: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string | Block[] }[];
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Called whenever streamed text arrives (watchdog, progress), with the characters written so far. */
  onProgress?: (chars?: number) => void;
}): Promise<{ text: string; reasoning: string | null }> {
  const sample = await getSample();
  if (!sample) {
    throw new Error('AI is not available in this view. Open the preview inside claude.ai (or the Claude app) and allow it to use Claude, or run the app on your PC with an API key.');
  }
  const images: Blob[] = [];
  const turns: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of opts.messages) {
    if (typeof m.content === 'string') { turns.push({ role: m.role, content: m.content }); continue; }
    const parts: string[] = [];
    let pdfNo = 0;
    for (const b of m.content) {
      if (b.type === 'text' && b.text) parts.push(b.text);
      else if (b.type === 'image' && b.source?.type === 'base64' && b.source.data) {
        images.push(base64ToBlob(b.source.data, b.source.media_type ?? 'image/png'));
        parts.push(`[Image ${images.length} attached]`);
      } else if (b.type === 'document') {
        // PDFs can't be attached here: their text is read in the browser and sent instead.
        pdfNo++;
        const text = b.source?.type === 'base64' && b.source.data ? await pdfText(b.source.data) : '';
        parts.push(text.trim()
          ? `[Text of attached PDF ${pdfNo} (drawings and pictures in it are not included)]\n${text}`
          : `[PDF ${pdfNo} was attached but has no readable text (scanned or drawing-only); work from the other text and images.]`);
      }
    }
    turns.push({ role: m.role, content: parts.join('\n\n') || '(no text)' });
  }
  const format = opts.schema
    ? `\n\nOUTPUT FORMAT: reply with ONLY one JSON value (no prose, no code fence) that conforms exactly to this JSON Schema — every required property present, enum values copied exactly, no extra properties:\n${JSON.stringify(opts.schema)}`
    : '';
  const input = [{ role: 'user' as const, content: `${opts.system}${format}` }, ...turns];
  if (input[input.length - 1].role !== 'user') input.push({ role: 'user', content: 'Continue.' });

  let written = 0; // characters of earlier parts when an answer is continued
  const effort = opts.effort === 'low' ? 'low' : opts.effort === 'medium' ? 'medium' : 'high';
  const options: SampleOptions = {
    modelTier: 'complex',
    model: opts.model.startsWith('claude-') ? opts.model : undefined,
    effort,
    cache: false,
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.onProgress ? { onText: (u: { text: string }) => opts.onProgress?.(written + u.text.length) } : {}),
    ...(images.length ? { images } : {}),
  };
  try {
    if (opts.schema) {
      // Streamed as text (progress shows), continued when it is cut off by the length limit,
      // then read leniently (code fences, text around the JSON, trailing commas).
      let full = '';
      let turns2 = input;
      for (let part = 0; part < 4; part++) {
        const r = await sample(turns2, options);
        full += r.text;
        written = full.length;
        if (!r.truncated) break;
        turns2 = [...input, { role: 'assistant', content: full }, { role: 'user', content: 'Your answer was cut off. Continue exactly where you stopped: output only the rest of the JSON, no repetition, no prose.' }];
      }
      const value = parseJsonLenient(full);
      if (value === undefined) throw Object.assign(new Error(ERRORS.invalid_json), { code: 'invalid_json' });
      return { text: JSON.stringify(value), reasoning: null };
    }
    const r = await sample(input, options);
    if (r.truncated) throw new Error('The answer was cut off (length limit). Try splitting the machine into smaller parts.');
    return { text: r.text, reasoning: null };
  } catch (e) {
    throw friendly(e);
  }
}

/** File types the viewer's save dialog accepts as-is; anything else is zipped. */
const ALLOWED = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'txt', 'json', 'md', 'docx', 'pptx', 'epub', 'csv', 'ttf', 'html', 'svg', 'pdf', 'xlsx', 'zip']);

/** Offer a file in the preview. Returns false when downloads are unavailable here. */
/** Offer a file through the viewer's Claude app: 'saved', 'declined' (the viewer said no) or 'unavailable' (no downloads here). */
export async function saveViaAccount(filename: string, data: Blob): Promise<'saved' | 'declined' | 'unavailable'> {
  const dl = await getDownloads();
  if (!dl) return 'unavailable';
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  let name = filename;
  let blob = data;
  if (!ALLOWED.has(ext)) {
    // e.g. .dxf / .step: delivered inside a zip with the original name
    const zip = new JSZip();
    zip.file(filename, data);
    blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    name = `${filename}.zip`;
  }
  try {
    await dl.save({ filename: name, data: blob });
  } catch (e) {
    const code = (e as SampleError)?.code;
    if (code === 'declined') return 'declined';
    throw new Error(code === 'rate_limited' ? 'Another save is waiting for your answer. Try again in a moment.' : `The file could not be saved here (${code ?? 'error'}).`, { cause: e });
  }
  return 'saved';
}
