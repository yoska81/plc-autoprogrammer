/** Read aloud with the system voices (speechSynthesis: works in browsers and in the Windows app). */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useVoiceSettings } from './useVoiceSettings';
import { langCode, speakable, speechChunks } from './text';

/** Id of what is being read now ('' = nothing). */
export const useSpeaking = create<{ id: string }>(() => ({ id: '' }));

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** The chosen voice, else the system's first voice for the speech language. */
export function voiceFor(lang: string, uri: string): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.voiceURI === uri)
    ?? voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase())
    ?? voices.find((v) => langCode(v.lang) === langCode(lang))
    ?? null;
}

let run = 0;

/** Read `text`; resolves when it has been read (or was stopped). `id` marks which button shows "Stop". */
export function speak(text: string, id = 'speech'): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  stopSpeaking();
  const mine = ++run;
  const { language, rate, voice } = useVoiceSettings.getState();
  const v = voiceFor(language, voice);
  const chunks = speechChunks(speakable(text));
  if (!chunks.length) return Promise.resolve();
  useSpeaking.setState({ id });
  return new Promise<void>((resolve) => {
    let i = 0;
    const next = () => {
      if (mine !== run || i >= chunks.length) {
        if (mine === run) useSpeaking.setState({ id: '' });
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.lang = v?.lang ?? language;
      if (v) u.voice = v;
      u.rate = rate;
      u.onend = next;
      u.onerror = next;
      speechSynthesis.speak(u);
    };
    next();
  });
}

export function stopSpeaking(): void {
  if (!canSpeak()) return;
  run++;
  speechSynthesis.cancel();
  useSpeaking.setState({ id: '' });
}

/** The system voices (they load asynchronously in Chromium). */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (canSpeak() ? speechSynthesis.getVoices() : []));
  useEffect(() => {
    if (!canSpeak()) return;
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  return voices;
}
