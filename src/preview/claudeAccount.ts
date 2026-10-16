/**
 * In the claude.ai preview the page can't reach api.anthropic.com, but the
 * viewer's own Claude account can answer through the artifact runtime
 * (`claude.use("sample")`). The first request asks the viewer to allow it.
 * Files are offered through `claude.use("downloads")`.
 */
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
  if (se && typeof se.code === 'string') return new Error(ERRORS[se.code] ?? `Claude could not answer right now (${se.code}). Try again.`, { cause: e });
  return e instanceof Error ? e : new Error(String(e));
}

/** True when the preview can run AI through the viewer's Claude account. */
export async function accountAvailable(): Promise<boolean> {
  return (await getSample()) !== null;
}

type Block = { type: string; text?: string; source?: { type: string; media_type?: string; data?: string } };

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
}): Promise<{ text: string; reasoning: string | null }> {
  const sample = await getSample();
  if (!sample) {
    throw new Error('AI is not available in this view. Open the preview inside claude.ai (or the Claude app) and allow it to use Claude, or run the app on your PC with an API key.');
  }
  const images: Blob[] = [];
  const turns = opts.messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    const parts: string[] = [];
    for (const b of m.content) {
      if (b.type === 'text' && b.text) parts.push(b.text);
      else if (b.type === 'image' && b.source?.type === 'base64' && b.source.data) {
        images.push(base64ToBlob(b.source.data, b.source.media_type ?? 'image/png'));
        parts.push(`[Image ${images.length} attached]`);
      } else if (b.type === 'document') {
        parts.push('[A PDF was attached but PDFs can\'t be sent from the preview; work from the text and images only.]');
      }
    }
    return { role: m.role, content: parts.join('\n\n') || '(no text)' };
  });
  const format = opts.schema
    ? `\n\nOUTPUT FORMAT: reply with ONLY one JSON value (no prose, no code fence) that conforms exactly to this JSON Schema — every required property present, enum values copied exactly, no extra properties:\n${JSON.stringify(opts.schema)}`
    : '';
  const input = [{ role: 'user' as const, content: `${opts.system}${format}` }, ...turns];
  if (input[input.length - 1].role !== 'user') input.push({ role: 'user', content: 'Continue.' });

  const effort = opts.effort === 'low' ? 'low' : opts.effort === 'medium' ? 'medium' : 'high';
  const options: SampleOptions = {
    modelTier: 'complex',
    model: opts.model.startsWith('claude-') ? opts.model : undefined,
    effort,
    cache: false,
    ...(images.length ? { images } : {}),
  };
  try {
    if (opts.schema) {
      const value = await sample.json(input, options);
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
export async function saveViaAccount(filename: string, data: Blob): Promise<boolean> {
  const dl = await getDownloads();
  if (!dl) return false;
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
    if (code === 'declined') return true;
    throw new Error(code === 'rate_limited' ? 'Another save is waiting for your answer. Try again in a moment.' : `The file could not be saved here (${code ?? 'error'}).`, { cause: e });
  }
  return true;
}
