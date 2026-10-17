import { useMemo, useState } from 'react';
import { useVoiceSettings, VOICE_LANGUAGES, type SpeechEngine } from './useVoiceSettings';
import { currentEngine, engineAvailability, ENGINE_LABEL, prepareLocalModel, useSpeechModel } from './stt';
import { canSpeak, speak, stopSpeaking, useSpeaking, useVoices } from './tts';
import { langCode } from './text';
import { useSettingsStore } from '../store/useSettingsStore';
import MicButton from './MicButton';

const select = 'w-full border border-steel-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

const SAMPLE: Record<string, string> = {
  en: 'The conveyor starts when the guard door is closed.',
  he: 'המסוע מתחיל לפעול כשדלת המגן סגורה.',
  ru: 'Конвейер запускается, когда защитная дверь закрыта.',
  es: 'La cinta arranca cuando la puerta de protección está cerrada.',
  fr: 'Le convoyeur démarre lorsque la porte de protection est fermée.',
  de: 'Das Förderband startet, wenn die Schutztür geschlossen ist.',
};

/** Settings → Voice: speech language, how speech is written down, read-aloud voice and speed. */
export default function VoiceSettingsCard() {
  const v = useVoiceSettings();
  const model = useSpeechModel();
  const voices = useVoices();
  const testing = useSpeaking((s) => s.id === 'voice-test');
  const [trial, setTrial] = useState('');
  // Re-read when the OpenAI key changes.
  const openaiKey = useSettingsStore((s) => s.openaiApiKey);
  const avail = useMemo(() => { void openaiKey; return engineAvailability(); }, [openaiKey]);
  const engineNow = useMemo(() => { void openaiKey; void v.engine; return currentEngine(); }, [openaiKey, v.engine]);
  const forLang = voices.filter((x) => langCode(x.lang) === langCode(v.language));
  const others = voices.filter((x) => langCode(x.lang) !== langCode(v.language));

  const engines: { id: SpeechEngine; label: string }[] = [
    { id: 'auto', label: 'Automatic (recommended)' },
    { id: 'browser', label: "Browser's speech recognition" },
    { id: 'openai', label: 'OpenAI (your API key)' },
    { id: 'local', label: 'Speech model on this computer (free, private)' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4" data-testid="voice-settings">
      <div>
        <p className="text-sm font-semibold text-gray-700">Voice</p>
        <p className="text-xs text-gray-500 mt-0.5">Speak instead of typing: every text box has a microphone button. Speaker buttons read questions, AI answers, review findings and the machine specification aloud.</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={v.micEnabled} onChange={(e) => v.set({ micEnabled: e.target.checked })} /> Show the microphone buttons
      </label>

      <label className="block text-sm text-gray-700">Language you speak (also used to read aloud)
        <select aria-label="Speech language" value={v.language} onChange={(e) => v.set({ language: e.target.value, voice: '' })} className={`${select} mt-1`}>
          {VOICE_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </label>

      <fieldset className="space-y-1.5">
        <legend className="text-sm text-gray-700 mb-1">How speech is written down</legend>
        {engines.map((e) => {
          const a = e.id === 'auto' ? { ok: true, why: `Now: ${ENGINE_LABEL[engineNow]}.` } : avail[e.id];
          return (
            <label key={e.id} className={`flex items-start gap-2 text-sm ${a.ok ? 'text-gray-700' : 'text-gray-400'}`}>
              <input type="radio" name="speech-engine" className="mt-1" checked={v.engine === e.id} disabled={!a.ok && e.id !== 'auto'} onChange={() => v.set({ engine: e.id })} />
              <span>{e.label}<span className="block text-xs text-gray-500">{a.why}</span></span>
            </label>
          );
        })}
      </fieldset>

      {(engineNow === 'local' || v.engine === 'local') && avail.local.ok && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2 text-sm" data-testid="local-model">
          <label className="block text-gray-700">Speech model size
            <select aria-label="Speech model size" value={v.localModel} onChange={(e) => v.set({ localModel: e.target.value as 'tiny' | 'base' })} className={`${select} mt-1`}>
              <option value="base">Base — understands better (about 150 MB, recommended)</option>
              <option value="tiny">Tiny — quicker download (about 80 MB)</option>
            </select>
          </label>
          {model.status === 'downloading' ? (
            <div>
              <p className="text-xs text-gray-600">Downloading the speech model{model.mb.total ? `: ${model.mb.loaded.toFixed(0)} of ${model.mb.total.toFixed(0)} MB` : '…'}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-gray-200"><div className="h-full bg-brand-600" style={{ width: `${Math.round(model.progress * 100)}%` }} /></div>
            </div>
          ) : model.status === 'ready' ? (
            <p className="text-xs text-green-700">The speech model is ready on this computer.</p>
          ) : (
            <>
              {model.error && <p className="text-xs text-red-700">{model.error}</p>}
              <button type="button" onClick={() => void prepareLocalModel().catch(() => undefined)} className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50">
                Download the speech model now
              </button>
              <p className="text-xs text-gray-500">Otherwise it downloads the first time you press a microphone button (once; it is kept on this computer).</p>
            </>
          )}
        </div>
      )}

      <label className="block text-sm text-gray-700">When a box already has text
        <select aria-label="Dictation mode" value={v.mode} onChange={(e) => v.set({ mode: e.target.value as 'append' | 'replace' })} className={`${select} mt-1`}>
          <option value="append">Add what I say at the end</option>
          <option value="replace">Replace the text with what I say</option>
        </select>
        <span className="text-xs text-gray-500">You can switch while speaking.</span>
      </label>

      <div className="text-sm text-gray-700">
        Try the microphone
        <div className="relative mt-1">
          <textarea aria-label="Try the microphone" value={trial} onChange={(e) => setTrial(e.target.value)} rows={2} placeholder="Press the microphone and speak…" className={`${select} pr-9`} />
          <span className="absolute right-1.5 top-1.5"><MicButton value={trial} onChange={setTrial} /></span>
        </div>
      </div>

      {canSpeak() ? (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          <label className="block text-sm text-gray-700">Read-aloud voice
            <select aria-label="Read-aloud voice" value={v.voice} onChange={(e) => v.set({ voice: e.target.value })} className={`${select} mt-1`}>
              <option value="">The system's voice for {VOICE_LANGUAGES.find((l) => l.value === v.language)?.label ?? v.language}</option>
              {forLang.length > 0 && <optgroup label="This language">{forLang.map((x) => <option key={x.voiceURI} value={x.voiceURI}>{x.name} ({x.lang})</option>)}</optgroup>}
              {others.length > 0 && <optgroup label="Other languages">{others.map((x) => <option key={x.voiceURI} value={x.voiceURI}>{x.name} ({x.lang})</option>)}</optgroup>}
            </select>
            {!forLang.length && voices.length > 0 && <span className="text-xs text-amber-700">This computer has no voice for this language. In Windows: Settings → Time &amp; language → Speech → Add voices.</span>}
          </label>
          <label className="block text-sm text-gray-700">Reading speed: {v.rate.toFixed(1)}×
            <input type="range" aria-label="Reading speed" min={0.5} max={2} step={0.1} value={v.rate} onChange={(e) => v.set({ rate: Number(e.target.value) })} className="w-full mt-1" />
          </label>
          <button type="button" onClick={() => (testing ? stopSpeaking() : void speak(SAMPLE[langCode(v.language)] ?? SAMPLE.en, 'voice-test'))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">{testing ? 'Stop' : 'Test the voice'}</button>
        </div>
      ) : <p className="text-xs text-gray-500">Reading aloud is not available in this window.</p>}
    </div>
  );
}
