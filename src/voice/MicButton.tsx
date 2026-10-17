import { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { Spinner } from '../components/common';
import { useVoiceSettings, type DictateMode } from './useVoiceSettings';
import { ENGINE_LABEL, micError, micPlaceNow, startDictation, useSpeechModel, type Dictation, type DictationState, type Engine } from './stt';
import { clock, joinDictation } from './text';
import { stopSpeaking } from './tts';
import { micUsable, PREVIEW_NO_MIC } from './micAccess';

interface Session {
  state: DictationState;
  engine: Engine | null;
  started: number;
  level: number;
  error: string | null;
}

/**
 * Microphone button for a text box: speak instead of typing. The words go into the box while you
 * speak (added at the end, or replacing the text), Done keeps them, Cancel puts the text back.
 */
export default function MicButton({ value, onChange, label = 'Speak instead of typing', disabled = false, className = '' }: {
  value: string; onChange: (v: string) => void; label?: string; disabled?: boolean; className?: string;
}) {
  const enabled = useVoiceSettings((s) => s.micEnabled);
  const defaultMode = useVoiceSettings((s) => s.mode);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setModeState] = useState<DictateMode>(defaultMode);
  const [now, setNow] = useState(0);
  const [hadText, setHadText] = useState(false);
  const model = useSpeechModel();
  const dict = useRef<Dictation | null>(null);
  const base = useRef('');
  const heard = useRef('');
  const modeRef = useRef(mode);
  const write = useRef(onChange);
  useEffect(() => { write.current = onChange; });
  const live = session !== null && !session.error;

  // Clock while listening.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [live]);
  // Leaving the page while speaking keeps what was said.
  useEffect(() => () => { void dict.current?.stop().catch(() => ''); }, []);

  if (!enabled) return null;
  // The claude.ai preview frame has no microphone: say so instead of asking for a permission that never comes.
  if (!micUsable(micPlaceNow())) return <NoMicHere className={className} />;

  const put = (spoken: string) => write.current(joinDictation(base.current, spoken, modeRef.current));
  const setMode = (m: DictateMode) => { modeRef.current = m; setModeState(m); put(heard.current); };

  const start = async () => {
    stopSpeaking();
    base.current = value;
    setHadText(Boolean(value.trim()));
    heard.current = '';
    modeRef.current = defaultMode;
    setModeState(defaultMode);
    setSession({ state: 'starting', engine: null, started: Date.now(), level: 0, error: null });
    try {
      const d = await startDictation({
        onText: (t) => { heard.current = t; put(t); },
        onState: (state) => setSession((s) => (s ? { ...s, state } : s)),
        onLevel: (level) => setSession((s) => (s ? { ...s, level } : s)),
      });
      dict.current = d;
      setSession((s) => (s ? { ...s, engine: d.engine, started: Date.now() } : s));
      d.done.then(
        (final) => { if (dict.current === d) { if (final) put(final); dict.current = null; setSession(null); } },
        (e: unknown) => { if (dict.current === d) { dict.current = null; put(heard.current); setSession((s) => ({ ...(s ?? { state: 'listening', engine: d.engine, started: 0, level: 0 }), error: micError(e) })); } },
      );
    } catch (e) {
      setSession((s) => ({ ...(s ?? { state: 'starting', engine: null, started: 0, level: 0 }), error: micError(e) }));
    }
  };
  const done = () => { void dict.current?.stop().catch(() => ''); };
  const cancel = () => { const d = dict.current; dict.current = null; d?.cancel(); write.current(base.current); setSession(null); };

  const downloading = session?.engine === 'local' && model.status === 'downloading';
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        data-testid="mic"
        disabled={disabled}
        aria-label={live ? 'Stop listening' : label}
        title={live ? 'Stop listening (keeps what you said)' : label}
        aria-pressed={live}
        onMouseDown={(e) => e.preventDefault() /* keep the text box focused */}
        onClick={() => (live ? done() : void start())}
        className={`inline-flex items-center justify-center rounded p-1 disabled:opacity-30 ${live ? 'bg-red-600 text-white animate-pulse' : 'text-steel-500 hover:bg-steel-100 hover:text-steel-800'}`}
      >
        <MicrophoneIcon className="h-4 w-4" />
      </button>
      {session && (
        <div role="status" data-testid="dictation" className="absolute right-0 top-full z-30 mt-1 w-72 rounded border border-steel-300 bg-white p-2.5 text-left text-xs text-steel-700 shadow-lg">
          {session.error ? (
            <>
              <p className="text-red-700">{session.error}</p>
              <button type="button" onClick={() => setSession(null)} className="mt-2 rounded border border-steel-300 px-2 py-0.5 hover:bg-steel-50">Close</button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {session.state === 'transcribing' ? <Spinner className="h-3.5 w-3.5" /> : <span className="h-2.5 w-2.5 rounded-full bg-red-600" />}
                <span className="font-semibold text-steel-800">
                  {session.state === 'starting' ? 'Starting the microphone…' : session.state === 'transcribing' ? 'Writing down what you said…' : `Listening… ${clock(Math.max(0, now - session.started))}`}
                </span>
                {session.state === 'listening' && session.engine !== 'browser' && (
                  <span className="ml-auto h-1.5 w-16 overflow-hidden rounded bg-steel-200" aria-hidden><span className="block h-full bg-emerald-500" style={{ width: `${Math.round(session.level * 100)}%` }} /></span>
                )}
              </div>
              {session.engine && <p className="mt-1 text-steel-500">Using {ENGINE_LABEL[session.engine]}.{session.engine !== 'browser' && session.state === 'listening' ? ' Speak, then press Done.' : ''}</p>}
              {downloading && (
                <div className="mt-1.5" data-testid="model-download">
                  <p>Downloading the speech model (first time only){model.mb.total ? `: ${model.mb.loaded.toFixed(0)} of ${model.mb.total.toFixed(0)} MB` : '…'}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-steel-200"><div className="h-full bg-brand-600" style={{ width: `${Math.round(model.progress * 100)}%` }} /></div>
                </div>
              )}
              {hadText && (
                <div className="mt-2 flex gap-1" role="group" aria-label="Where the words go">
                  {(['append', 'replace'] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                      className={`flex-1 rounded border px-1.5 py-0.5 ${mode === m ? 'border-brand-600 bg-brand-600 font-semibold text-brand-950' : 'border-steel-300 hover:bg-steel-50'}`}>
                      {m === 'append' ? 'Add to the text' : 'Replace the text'}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={done} disabled={session.state !== 'listening'} className="flex-1 rounded bg-brand-600 px-2 py-1 font-semibold text-brand-950 hover:bg-brand-700 disabled:opacity-40">Done</button>
                <button type="button" onClick={cancel} className="rounded border border-steel-300 px-2 py-1 hover:bg-steel-50">Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
}

/** Microphone button where voice input cannot work (the preview): muted, explains why when pressed. */
function NoMicHere({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex ${className}`}>
      <button type="button" data-testid="mic" aria-disabled="true" aria-label="Voice input is not available here" title={PREVIEW_NO_MIC}
        onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded p-1 text-steel-300 hover:bg-steel-100">
        <MicrophoneIcon className="h-4 w-4" />
      </button>
      {open && (
        <div role="status" data-testid="dictation" className="absolute right-0 top-full z-30 mt-1 w-72 rounded border border-steel-300 bg-white p-2.5 text-left text-xs text-steel-700 shadow-lg">
          <p>{PREVIEW_NO_MIC}</p>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 rounded border border-steel-300 px-2 py-0.5 hover:bg-steel-50">Close</button>
        </div>
      )}
    </span>
  );
}
