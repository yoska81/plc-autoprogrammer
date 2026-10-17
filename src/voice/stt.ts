/**
 * Speech to text. Three engines, picked by pickEngine():
 *  - browser: the browser's SpeechRecognition (Chrome / Edge), live words while speaking;
 *  - openai:  record with MediaRecorder, the user's OpenAI key writes it down;
 *  - local:   record, a Whisper model running on this computer writes it down (downloaded once).
 * In the desktop app Chromium's SpeechRecognition has no speech service, so it records instead.
 */
import { create } from 'zustand';
import { IS_PREVIEW } from '../preview/mode';
import { desktopBridge } from '../desktop/bridge';
import { useSettingsStore } from '../store/useSettingsStore';
import { useVoiceSettings } from './useVoiceSettings';
import { langCode, pickEngine } from './text';
import { transcribeOpenAI } from './openaiTranscribe';

export type Engine = 'browser' | 'openai' | 'local';
export type DictationState = 'starting' | 'listening' | 'transcribing';

export const ENGINE_LABEL: Record<Engine, string> = {
  browser: "the browser's speech recognition",
  openai: 'OpenAI (your API key)',
  local: 'the speech model on this computer',
};

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const isDesktop = () => Boolean(desktopBridge()) || (typeof navigator !== 'undefined' && /\bElectron\//.test(navigator.userAgent));
/** Set when the browser's recognition failed with no speech service: auto mode records from then on. */
let browserBroken = false;

export function canRecord(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

/** The engine dictation will use now. */
export function currentEngine(): Engine {
  const v = useVoiceSettings.getState();
  const s = useSettingsStore.getState();
  return pickEngine({
    engine: v.engine, browserSpeech: Boolean(recognitionClass()) && !browserBroken, desktop: isDesktop(),
    openaiKey: Boolean(s.openaiApiKey.trim()), preview: IS_PREVIEW,
  });
}

/** What each engine needs, for Settings. */
export function engineAvailability(): Record<Engine, { ok: boolean; why: string }> {
  const s = useSettingsStore.getState();
  return {
    browser: recognitionClass() && !isDesktop()
      ? { ok: true, why: 'Words appear while you speak. Needs the internet (Chrome and Edge send the sound to their speech service).' }
      : { ok: false, why: isDesktop() ? 'Not available in the desktop app.' : 'This browser has no speech recognition (use Chrome or Edge).' },
    openai: IS_PREVIEW ? { ok: false, why: 'Not available in the preview.' }
      : s.openaiApiKey.trim() ? { ok: true, why: 'Very accurate, many languages. Uses your OpenAI API key (a small cost per minute).' }
        : { ok: false, why: 'Add an OpenAI API key above to use it.' },
    local: IS_PREVIEW ? { ok: false, why: 'Not available in the preview.' }
      : { ok: canRecord(), why: 'Free and private: runs on this computer. The speech model is downloaded once (about 70 MB tiny, 140 MB base).' },
  };
}

// ── On-device model: lazy, with download progress ──

interface ModelState {
  status: 'idle' | 'downloading' | 'ready' | 'error';
  /** 0..1 while downloading. */
  progress: number;
  mb: { loaded: number; total: number };
  error: string | null;
}
export const useSpeechModel = create<ModelState>(() => ({ status: 'idle', progress: 0, mb: { loaded: 0, total: 0 }, error: null }));

let model: { size: string; asr: Promise<unknown> } | null = null;

/** Start (or reuse) loading the on-device model; the first time it is downloaded. */
export function prepareLocalModel(): Promise<unknown> {
  const size = useVoiceSettings.getState().localModel;
  if (model?.size === size) return model.asr;
  useSpeechModel.setState({ status: 'downloading', progress: 0, error: null });
  const asr = import('./localWhisperModel')
    .then((m) => m.loadModel(size, (p) => useSpeechModel.setState({
      status: 'downloading', progress: p.total ? Math.min(1, p.loaded / p.total) : 0,
      mb: { loaded: p.loaded / 1e6, total: p.total / 1e6 },
    })))
    .then((a) => { useSpeechModel.setState({ status: 'ready', progress: 1 }); return a; })
    .catch((e: unknown) => {
      model = null;
      const msg = e instanceof Error ? e.message : String(e);
      const plain = /fetch|network|Failed to|load/i.test(msg) ? 'The speech model could not be downloaded. Check the internet connection and try again.' : `The speech model could not be started: ${msg}`;
      useSpeechModel.setState({ status: 'error', error: plain });
      throw new Error(plain, { cause: e });
    });
  model = { size, asr };
  return asr;
}

/** Recorded audio → 16 kHz mono samples (what Whisper takes). */
async function toSamples(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const a = buf.getChannelData(0); const b = buf.getChannelData(1);
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
    return out;
  } finally { void ctx.close(); }
}

async function transcribe(engine: 'openai' | 'local', blob: Blob, lang: string, signal?: AbortSignal): Promise<string> {
  if (engine === 'openai') return transcribeOpenAI(blob, { apiKey: useSettingsStore.getState().openaiApiKey.trim(), lang, signal });
  const [asr, m] = await Promise.all([prepareLocalModel(), import('./localWhisperModel')]);
  return m.runModel(asr as never, await toSamples(blob), langCode(lang));
}

/** Turn a recorded clip into text with the engine in use (hands-free mode records its own clips). */
export function transcribeClip(blob: Blob, lang: string): Promise<string> {
  const e = currentEngine();
  return transcribe(e === 'browser' ? 'local' : e, blob, lang);
}

// ── One dictation session ──

export interface DictationHandlers {
  /** Everything heard so far (final words plus the words still being recognised). */
  onText: (text: string) => void;
  onState: (s: DictationState) => void;
  /** Microphone loudness 0..1 (recording engines). */
  onLevel?: (v: number) => void;
}

export interface DictationOptions {
  /** Stop by itself after a pause in speech (hands-free answers). */
  autoStop?: boolean;
  /** Longest recording, ms. */
  maxMs?: number;
}

export interface Dictation {
  engine: Engine;
  /** Finish: resolves with the final text. */
  stop: () => Promise<string>;
  /** Throw away what was said. */
  cancel: () => void;
  /** Resolves with the final text when the session ends by itself or by stop(). */
  done: Promise<string>;
}

/** Plain words for microphone errors. */
export function micError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (name === 'NotAllowedError' || /not-allowed|service-not-allowed|Permission/i.test(msg)) {
    return isDesktop()
      ? 'The microphone is blocked. In Windows Settings → Privacy & security → Microphone, allow desktop apps to use the microphone.'
      : 'The microphone is blocked. Allow it for this page (the camera/microphone icon in the address bar) and try again.';
  }
  if (name === 'NotFoundError' || /audio-capture|Requested device not found/i.test(msg)) return 'No microphone was found. Plug one in (or turn it on) and try again.';
  return msg || 'Speech input stopped unexpectedly.';
}

let active: Dictation | null = null;

/** Start listening. Only one dictation runs at a time: starting a new one finishes the previous. */
export async function startDictation(h: DictationHandlers, o: DictationOptions = {}): Promise<Dictation> {
  if (active) await active.stop().catch(() => '');
  const lang = useVoiceSettings.getState().language;
  const engine = currentEngine();
  const d = engine === 'browser' ? browserDictation(lang, h, o) : await recorderDictation(engine, lang, h, o);
  active = d;
  void d.done.finally(() => { if (active === d) active = null; }).catch(() => undefined);
  return d;
}

function browserDictation(lang: string, h: DictationHandlers, o: DictationOptions): Dictation {
  const R = recognitionClass()!;
  const rec = new R();
  rec.lang = lang;
  rec.continuous = !o.autoStop;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let finals = '';
  let interim = '';
  let cancelled = false;
  let resolve!: (t: string) => void;
  let reject!: (e: unknown) => void;
  const done = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  const text = () => `${finals} ${interim}`.replace(/\s+/g, ' ').trim();
  h.onState('starting');
  rec.onstart = () => h.onState('listening');
  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finals = `${finals} ${r[0].transcript}`; else interim += r[0].transcript;
    }
    h.onText(text());
  };
  let error: unknown = null;
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    // No speech service (e.g. a Chromium without one): record with another engine from now on.
    if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') browserBroken = true;
    error = new Error(e.error === 'network'
      ? 'The browser could not reach its speech service. Try again; next time the app records and writes it down another way.'
      : e.error === 'language-not-supported' ? 'The browser cannot recognise this language. Pick another speech engine in Settings → Voice.' : micError(new Error(e.error)));
  };
  rec.onend = () => {
    if (cancelled) resolve('');
    else if (error && !finals.trim() && !interim.trim()) reject(error);
    else resolve(text());
  };
  const timer = setTimeout(() => rec.stop(), o.maxMs ?? 5 * 60_000);
  void done.finally(() => clearTimeout(timer)).catch(() => undefined);
  try { rec.start(); } catch (e) { reject(e); }
  return {
    engine: 'browser',
    stop: () => { rec.stop(); return done; },
    cancel: () => { cancelled = true; rec.abort(); },
    done,
  };
}

async function recorderDictation(engine: 'openai' | 'local', lang: string, h: DictationHandlers, o: DictationOptions): Promise<Dictation> {
  if (!canRecord()) throw new Error('This window cannot record sound.');
  h.onState('starting');
  // Download the speech model while the user is speaking.
  if (engine === 'local') void prepareLocalModel().catch(() => undefined);
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); }
  catch (e) { throw new Error(micError(e), { cause: e }); }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  const blob = () => new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
  const ctrl = new AbortController();
  let cancelled = false;
  let resolve!: (t: string) => void;
  let reject!: (e: unknown) => void;
  const done = new Promise<string>((res, rej) => { resolve = res; reject = rej; });

  // Loudness meter and pause detection.
  const audio = new AudioContext();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  audio.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  const started = Date.now();
  let heard = false;
  let quietSince = Date.now();
  const meter = setInterval(() => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
    h.onLevel?.(level);
    if (level > 0.08) { heard = true; quietSince = Date.now(); }
    const elapsed = Date.now() - started;
    if (rec.state === 'recording' && ((o.autoStop && heard && Date.now() - quietSince > 1600) || (o.autoStop && !heard && elapsed > 8000) || elapsed > (o.maxMs ?? 5 * 60_000))) rec.stop();
  }, 100);

  // Words so far while recording: the clip is written down again every few seconds.
  let interimBusy = false;
  let lastInterim = 0;
  const interimEvery = engine === 'local' ? 4000 : 8000;
  const interim = setInterval(() => {
    if (interimBusy || rec.state !== 'recording' || !heard || Date.now() - lastInterim < interimEvery) return;
    if (engine === 'openai' && Date.now() - started > 120_000) return; // long recordings: only the final pass (cost)
    if (engine === 'local' && useSpeechModel.getState().status !== 'ready') return;
    interimBusy = true;
    lastInterim = Date.now();
    transcribe(engine, blob(), lang, ctrl.signal).then((t) => { if (rec.state === 'recording' && t) h.onText(t); }).catch(() => undefined).finally(() => { interimBusy = false; });
  }, 500);

  const cleanup = () => {
    clearInterval(meter); clearInterval(interim);
    for (const t of stream.getTracks()) t.stop();
    void audio.close();
  };
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    cleanup();
    if (cancelled) { resolve(''); return; }
    // Nothing said (hands-free waits ~8 s): no clip to write down (Whisper invents words for silence).
    if (!chunks.length || (o.autoStop && !heard)) { resolve(''); return; }
    h.onState('transcribing');
    transcribe(engine, blob(), lang, ctrl.signal).then(resolve, (e) => reject(e instanceof Error ? e : new Error(String(e))));
  };
  rec.start(1000);
  h.onState('listening');
  return {
    engine,
    stop: () => { if (rec.state === 'recording') rec.stop(); return done; },
    cancel: () => { cancelled = true; ctrl.abort(); if (rec.state === 'recording') rec.stop(); else resolve(''); },
    done,
  };
}
