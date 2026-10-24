import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appPersistStorage } from '../lib/appStorage';

/** Speech languages offered in Settings (BCP-47 tags; the first part is what the transcription services take). */
export const VOICE_LANGUAGES: { value: string; label: string }[] = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'he-IL', label: 'Hebrew — עברית' },
  { value: 'ru-RU', label: 'Russian — Русский' },
  { value: 'es-ES', label: 'Spanish — Español' },
  { value: 'es-MX', label: 'Spanish (Mexico) — Español' },
  { value: 'fr-FR', label: 'French — Français' },
  { value: 'de-DE', label: 'German — Deutsch' },
  { value: 'it-IT', label: 'Italian — Italiano' },
  { value: 'pt-BR', label: 'Portuguese (Brazil) — Português' },
  { value: 'ar-SA', label: 'Arabic — العربية' },
  { value: 'uk-UA', label: 'Ukrainian — Українська' },
  { value: 'pl-PL', label: 'Polish — Polski' },
  { value: 'tr-TR', label: 'Turkish — Türkçe' },
  { value: 'zh-CN', label: 'Chinese — 中文' },
  { value: 'ja-JP', label: 'Japanese — 日本語' },
];

/**
 * Which speech-to-text to use. "auto": the browser's own when it has one (not in the desktop app),
 * else the OpenAI key when one is set, else the speech model on this computer.
 */
export type SpeechEngine = 'auto' | 'browser' | 'openai' | 'local';
/** On-device speech model size: tiny is quicker to download, base understands better. */
export type LocalModel = 'tiny' | 'base';
/** Dictating into a box that already has text: add at the end, or replace it. */
export type DictateMode = 'append' | 'replace';

interface VoiceSettings {
  /** Show the microphone buttons at all. */
  micEnabled: boolean;
  language: string;
  engine: SpeechEngine;
  localModel: LocalModel;
  mode: DictateMode;
  /** Read-aloud speed, 0.5 … 2. */
  rate: number;
  /** speechSynthesis voice (voiceURI); '' = the system's voice for the language. */
  voice: string;
  set: (patch: Partial<Omit<VoiceSettings, 'set'>>) => void;
}

export const useVoiceSettings = create<VoiceSettings>()(
  persist(
    (set) => ({
      micEnabled: true,
      language: 'en-US',
      engine: 'auto',
      localModel: 'base',
      mode: 'append',
      rate: 1,
      voice: '',
      set: (patch) => set(patch),
    }),
    { name: 'isa-voice-settings', storage: appPersistStorage(), partialize: ({ set: _s, ...rest }) => { void _s; return rest; } },
  ),
);
