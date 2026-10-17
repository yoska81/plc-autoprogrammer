import { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { Spinner } from '../components/common';
import { useActiveProjectId, useQuestionStore, type Question } from '../components/questions/useQuestionStore';
import { micError, micPlaceNow, startDictation, type Dictation } from './stt';
import { micUsable } from './micAccess';
import { speak, stopSpeaking } from './tts';
import { spokenReply } from './text';
import { useVoiceSettings } from './useVoiceSettings';

type Phase = 'asking' | 'listening' | 'transcribing' | 'confirm' | 'confirm-listen' | 'done';

/**
 * Hands-free answers: reads each open question aloud, listens for the answer, reads it back and
 * saves it when the user says "yes" (or presses Save). "No" answers again, "skip" goes to the next
 * question, "stop" ends. Every step also has a button.
 */
export default function HandsFreeQuestions({ questions }: { questions: Question[] }) {
  const projectId = useActiveProjectId();
  const lang = useVoiceSettings((s) => s.language);
  const enabled = useVoiceSettings((s) => s.micEnabled);
  const [run, setRun] = useState<{ ids: string[]; i: number; saved: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('asking');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);
  const dict = useRef<Dictation | null>(null);
  const textRef = useRef('');
  useEffect(() => () => { token.current++; dict.current?.cancel(); stopSpeaking(); }, []);

  const open = questions.filter((q) => q.status === 'open');
  // No microphone in the preview frame: no hands-free mode there (questions still have speaker buttons).
  if (!enabled || !micUsable(micPlaceNow()) || (!run && !open.length)) return null;
  const current = run ? questions.find((q) => q.id === run.ids[run.i]) ?? null : null;

  const put = (t: string) => { textRef.current = t; setText(t); };
  const alive = (t: number) => token.current === t;

  /** Listen once; '' when nothing was heard. */
  const listen = async (t: number, short: boolean, onText: (s: string) => void): Promise<string> => {
    const d = await startDictation({ onText, onState: (s) => { if (alive(t) && s === 'transcribing') setPhase(short ? 'confirm-listen' : 'transcribing'); } }, { autoStop: true, maxMs: short ? 8000 : 90_000 });
    dict.current = d;
    try { return await d.done; } finally { if (dict.current === d) dict.current = null; }
  };

  const ask = async (ids: string[], i: number, saved: number) => {
    const t = ++token.current;
    dict.current?.cancel();
    setError(null);
    if (i >= ids.length) {
      setRun({ ids, i, saved });
      setPhase('done');
      await speak(saved ? `Done. ${saved} answer${saved === 1 ? '' : 's'} saved.` : 'Done.', 'handsfree');
      return;
    }
    const q = useQuestionStore.getState().byProject[projectId ?? 'default']?.find((x) => x.id === ids[i]);
    setRun({ ids, i, saved });
    put('');
    if (!q) { void ask(ids, i + 1, saved); return; }
    setPhase('asking');
    await speak(`Question ${i + 1} of ${ids.length}. ${q.text}`, 'handsfree');
    if (!alive(t)) return;
    await answerRound(t, ids, i, saved);
  };

  const answerRound = async (t: number, ids: string[], i: number, saved: number) => {
    try {
      setPhase('listening');
      let said = await listen(t, false, (s) => alive(t) && put(s));
      if (!alive(t)) return;
      if (!said.trim()) {
        await speak("I didn't hear an answer. Please say it again, or press Skip.", 'handsfree');
        if (!alive(t)) return;
        setPhase('listening');
        said = await listen(t, false, (s) => alive(t) && put(s));
        if (!alive(t)) return;
      }
      put(said.trim() || textRef.current);
      await confirmRound(t, ids, i, saved);
    } catch (e) {
      if (alive(t)) { setError(micError(e)); setPhase('confirm'); }
    }
  };

  const confirmRound = async (t: number, ids: string[], i: number, saved: number) => {
    setPhase('confirm');
    if (!textRef.current.trim()) return; // nothing to confirm: the buttons are there
    await speak(`You said: ${textRef.current}. Say yes to save it, no to answer again, or skip.`, 'handsfree');
    if (!alive(t)) return;
    setPhase('confirm-listen');
    const reply = await listen(t, true, () => undefined).then((said) => spokenReply(said, lang), () => null);
    if (!alive(t)) return;
    setPhase('confirm');
    if (reply === 'yes') save(ids, i, saved);
    else if (reply === 'no') { put(''); void answerRound(++token.current, ids, i, saved); }
    else if (reply === 'skip') void ask(ids, i + 1, saved);
    else if (reply === 'stop') end();
    // Not understood: the buttons wait.
  };

  const save = (ids: string[], i: number, saved: number) => {
    const q = ids[i];
    const answer = textRef.current.trim();
    if (q && answer) useQuestionStore.getState().answer(projectId, q, answer, 'answered');
    void ask(ids, i + 1, saved + (answer ? 1 : 0));
  };

  const end = () => {
    token.current++;
    dict.current?.cancel();
    stopSpeaking();
    setRun(null);
  };

  if (!run) {
    return (
      <button type="button" data-testid="hands-free" onClick={() => void ask(open.map((q) => q.id), 0, 0)}
        title="The app reads each open question aloud and listens for your answer"
        className="inline-flex items-center gap-1 rounded border border-steel-300 bg-white px-2 py-0.5 text-xs font-medium text-steel-700 hover:bg-steel-50">
        <MicrophoneIcon className="h-3.5 w-3.5" /> Answer by voice
      </button>
    );
  }

  const r = run;
  const busy = phase === 'asking' || phase === 'listening' || phase === 'transcribing' || phase === 'confirm-listen';
  return (
    <div className="basis-full rounded border border-brand-600 bg-white p-3 space-y-2 text-sm" data-testid="hands-free-panel" role="region" aria-label="Answer by voice">
      {phase === 'done' ? (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-steel-800">Done: {run.saved} answer{run.saved === 1 ? '' : 's'} saved.</span>
          <button type="button" onClick={end} className="ml-auto rounded border border-steel-300 px-2 py-0.5 text-xs hover:bg-steel-50">Close</button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <span className="text-xs font-semibold text-steel-500 whitespace-nowrap pt-0.5">Question {run.i + 1} of {run.ids.length}</span>
            <p className="flex-1 font-medium text-steel-900">{current?.text}</p>
          </div>
          <p className="flex items-center gap-2 text-xs text-steel-600" role="status">
            {busy && (phase === 'listening' ? <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" /> : <Spinner className="h-3.5 w-3.5" />)}
            {phase === 'asking' ? 'Reading the question…' : phase === 'listening' ? 'Listening for your answer… (pause when you have finished)'
              : phase === 'transcribing' ? 'Writing down your answer…' : phase === 'confirm-listen' ? 'Say "yes" to save, "no" to answer again, or "skip".' : 'Check the answer, then save it.'}
          </p>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <textarea value={text} onChange={(e) => put(e.target.value)} rows={2} aria-label="Your spoken answer"
            className="w-full rounded border border-steel-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Your answer appears here; you can correct it" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!text.trim()} onClick={() => { token.current++; dict.current?.cancel(); stopSpeaking(); save(r.ids, r.i, r.saved); }}
              className="rounded bg-brand-600 px-3 py-1 text-sm font-semibold text-brand-950 hover:bg-brand-700 disabled:opacity-40">Save answer</button>
            <button type="button" onClick={() => { const t = ++token.current; dict.current?.cancel(); stopSpeaking(); put(''); void answerRound(t, r.ids, r.i, r.saved); }}
              className="rounded border border-steel-300 px-3 py-1 text-sm hover:bg-steel-50">Answer again</button>
            <button type="button" onClick={() => void ask(r.ids, r.i + 1, r.saved)} className="rounded border border-steel-300 px-3 py-1 text-sm hover:bg-steel-50">Skip</button>
            <button type="button" onClick={end} className="ml-auto rounded border border-steel-300 px-3 py-1 text-sm hover:bg-steel-50">Stop</button>
          </div>
        </>
      )}
    </div>
  );
}
