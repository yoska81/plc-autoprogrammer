/**
 * The on-device speech model (Whisper, run in the app with @huggingface/transformers). Loaded only
 * when first needed; the model files are downloaded once and kept in the browser cache.
 * The preview build replaces this file with src/preview/localWhisperStub.ts.
 */
import { pipeline, env } from '@huggingface/transformers';
import type { LocalModel } from './useVoiceSettings';

export interface ModelProgress { loaded: number; total: number; file: string }

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;

const REPO: Record<LocalModel, string> = { tiny: 'onnx-community/whisper-tiny', base: 'onnx-community/whisper-base' };
const loading = new Map<LocalModel, Promise<Asr>>();

/** Load (download the first time) the model; `onProgress` gets the bytes so far over all files. */
export function loadModel(size: LocalModel, onProgress: (p: ModelProgress) => void): Promise<Asr> {
  const cur = loading.get(size);
  if (cur) return cur;
  env.allowLocalModels = false;
  const files = new Map<string, { loaded: number; total: number }>();
  const p = pipeline('automatic-speech-recognition', REPO[size], {
    progress_callback: (e: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (e.status !== 'progress' || !e.file) return;
      files.set(e.file, { loaded: e.loaded ?? 0, total: e.total ?? 0 });
      let loaded = 0; let total = 0;
      for (const f of files.values()) { loaded += f.loaded; total += f.total; }
      onProgress({ loaded, total, file: e.file });
    },
  }).then((asr) => asr as unknown as Asr);
  loading.set(size, p);
  p.catch(() => loading.delete(size));
  return p;
}

/** 16 kHz mono samples → text. */
export async function runModel(asr: Asr, audio: Float32Array, lang: string): Promise<string> {
  const out = await asr(audio, { language: lang, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
  return (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text).trim();
}
