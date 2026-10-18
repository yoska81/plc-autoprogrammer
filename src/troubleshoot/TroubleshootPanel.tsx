import { useEffect, useMemo, useRef, useState } from 'react';
import { collectProject } from '../deliverables/collect';
import { planDrawings, type DrawingPlan } from '../electrical/drawings/plan';
import SpeakButton from '../voice/SpeakButton';
import { canSpeak, speak, stopSpeaking } from '../voice/tts';
import { micPlaceNow, startDictation, type Dictation } from '../voice/stt';
import { micUsable } from '../voice/micAccess';
import { spokenReply } from '../voice/text';
import { useVoiceSettings } from '../voice/useVoiceSettings';
import { useOnlineStore } from '../online/useOnline';
import { wiringPaths, type WiringPath } from './wiringPath';
import { answer, currentStep, startSession, SYMPTOM_LABEL, type Answer, type Session, type Symptom } from './steps';
import { FlickerWatch } from './watch';
import SheetThumb from './SheetThumb';
import { useUi } from '../store/useUiStore';

const big = 'min-h-14 flex-1 rounded-lg px-4 py-3 text-base font-semibold shadow-sm disabled:opacity-40';
const WIGGLE_MS = 10_000;

/**
 * Guided fault finding at the cabinet: pick the PLC point that misbehaves and what it does, then follow one
 * meter step at a time (big buttons, read aloud, spoken yes / no). With the PLC connected the page shows the
 * point's live value and answers wiggle tests itself. Works with no API key: the steps come from the wiring.
 */
export default function TroubleshootPanel() {
  const [{ paths, plan }] = useState(() => {
    const ctx = collectProject().drawingCtx;
    let p: WiringPath[] = [];
    let pl: DrawingPlan | null = null;
    try { if (ctx) { p = wiringPaths(ctx); pl = planDrawings(ctx); } } catch { /* no design */ }
    return { paths: p, plan: pl };
  });
  const [address, setAddress] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [watching, setWatching] = useState<number | null>(null);
  const online = useOnlineStore();
  const lang = useVoiceSettings((s) => s.language);
  const micOn = useVoiceSettings((s) => s.micEnabled) && micUsable(micPlaceNow());
  const [listening, setListening] = useState(false);
  // Full screen over the page (phones at the cabinet); the Online page stays mounted, so the PLC stays connected.
  const [full, setFull] = useUi('troubleshoot.full', false);
  const dict = useRef<Dictation | null>(null);
  const watch = useRef(new FlickerWatch());
  const sessionRef = useRef<Session | null>(null);
  useEffect(() => () => { dict.current?.cancel(); stopSpeaking(); }, []);

  const path = useMemo(() => paths.find((p) => p.address === address) ?? null, [paths, address]);
  const step = session ? currentStep(session) : null;
  const live = (a: string) => (online.bits.has(a.toUpperCase()) ? (online.bits.get(a.toUpperCase()) ? 'ON' : 'OFF') : online.words.has(a.toUpperCase()) ? String(online.words.get(a.toUpperCase())) : null);
  const connected = online.status === 'connected';

  // Feed the live watch from the Online page's polling.
  const value = path ? online.bits.get(path.address.toUpperCase()) : undefined;
  useEffect(() => { if (path && value !== undefined) watch.current.feed(path.address, value, Date.now()); }, [path, value, online.polls]);
  if (!paths.length) return <p className="text-sm text-steel-500">Fault finding needs the electrical design (Electrical design page): the steps follow its wiring.</p>;

  const reply = (a: Answer) => {
    const cur = sessionRef.current;
    if (!cur) return;
    stopSpeaking();
    const next = answer(cur, a);
    sessionRef.current = next;
    setSession(next);
    const s = currentStep(next);
    if (canSpeak()) void speak(next.verdict ? `${next.verdict.text} ${next.verdict.fix}` : s?.say ?? '', 'troubleshoot');
  };
  const start = (p: WiringPath, symptom: Symptom) => {
    const s = startSession(p, symptom);
    sessionRef.current = s;
    setSession(s);
    watch.current.reset();
    if (canSpeak()) void speak(currentStep(s)?.say ?? '', 'troubleshoot');
  };
  const listen = async () => {
    if (listening) { dict.current?.cancel(); setListening(false); return; }
    setListening(true);
    try {
      const d = await startDictation({ onText: () => {}, onState: () => {} }, { autoStop: true, maxMs: 8000 });
      dict.current = d;
      const said = await d.done;
      const r = spokenReply(said, lang);
      if (r === 'yes' || r === 'no') reply(r);
      else if (r === 'skip') reply('skip');
      else if (r === 'stop') { sessionRef.current = null; setSession(null); }
    } catch { /* mic refused: buttons still work */ } finally { setListening(false); dict.current = null; }
  };

  const symptoms: Symptom[] = path?.type === 'output' ? ['output-dead'] : ['never-on', 'always-on', 'flickers'];

  return (
    <div className={full ? 'fixed inset-0 z-40 overflow-auto bg-steel-50 p-3' : ''}>
    <div className="mx-auto max-w-xl space-y-3" aria-label="Fault finding">
      <div className="flex justify-end">
        <button type="button" className="rounded border border-steel-300 bg-white px-3 py-1.5 text-sm" onClick={() => setFull(!full)}>{full ? 'Back to the page' : 'Full screen'}</button>
      </div>
      {!session ? (
        <div className="space-y-3 rounded-lg border border-steel-200 bg-white p-4">
          <h3 className="text-base font-semibold text-steel-800">What is wrong?</h3>
          <label className="block text-sm text-steel-700">The PLC point
            <select aria-label="Point to troubleshoot" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full rounded border border-steel-300 px-2 py-2 text-base">
              <option value="">choose…</option>
              {paths.map((p) => <option key={p.address} value={p.address}>{p.address} — {p.description}{live(p.address) ? ` (now ${live(p.address)})` : ''}</option>)}
            </select>
          </label>
          {path && (
            <>
              <p className="text-xs text-steel-500">{path.summary}</p>
              <div className="flex flex-col gap-2">
                {symptoms.map((s) => (
                  <button key={s} type="button" className={`${big} border border-brand-300 bg-brand-50 text-left text-brand-900 hover:bg-brand-100`} onClick={() => start(path, s)}>
                    {path.address} {SYMPTOM_LABEL[s]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-steel-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-steel-500">
            <span className="font-mono font-semibold text-steel-800">{session.path.address}</span>
            <span>{session.path.description} · {SYMPTOM_LABEL[session.symptom]}</span>
            {connected && live(session.path.address) !== null && (
              <span className={`ml-auto rounded px-2 py-0.5 font-mono text-sm font-bold ${live(session.path.address) === 'ON' ? 'bg-green-600 text-white' : 'bg-steel-200 text-steel-800'}`} aria-label="Live value">{live(session.path.address)}</span>
            )}
          </div>
          {step ? (
            <>
              <p className="text-xs text-steel-400">Step {session.at + 1} of {session.steps.length}</p>
              <p className="text-lg leading-snug text-steel-900" aria-live="polite">{step.say}</p>
              {step.hop?.measure?.when && <p className="text-sm text-steel-600">{step.hop.measure.when}{step.hop.measure.otherwise ? `; otherwise ${step.hop.measure.otherwise}` : ''}.</p>}
              {step.hop?.note && <p className="text-sm text-amber-800">{step.hop.note}</p>}
              {plan && step.hop?.where && (
                <SheetThumb plan={plan} sheetNo={step.hop.where.sheet} marks={[step.hop.wire ?? '', step.hop.terminal ?? '', step.hop.tag].filter(Boolean)} />
              )}
              {step.wiggle && connected && (
                <button type="button" className={`${big} w-full border border-violet-400 bg-violet-50 text-violet-900`} disabled={watching !== null} onClick={() => {
                  // The wiggle test answers itself: 2+ changes of the point in 10 s = loose connection.
                  const t0 = Date.now();
                  setWatching(t0);
                  setTimeout(() => { setWatching(null); reply(watch.current.changesSince(session.path.address, t0) >= 2 ? 'yes' : 'no'); }, WIGGLE_MS);
                }}>
                  {watching !== null ? 'Watching… keep wiggling' : `Watch ${session.path.address} for 10 s while I wiggle`}
                </button>
              )}
              <div className="flex gap-2">
                <button type="button" className={`${big} bg-green-600 text-white hover:bg-green-700`} onClick={() => reply('yes')}>{step.yes}</button>
                <button type="button" className={`${big} bg-red-600 text-white hover:bg-red-700`} onClick={() => reply('no')}>{step.no}</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="rounded border border-steel-300 px-3 py-2 text-sm" onClick={() => reply('skip')}>Didn't check</button>
                <SpeakButton text={step.say} label="Read the step aloud" />
                {micOn && <button type="button" className="rounded border border-steel-300 px-3 py-2 text-sm" onClick={() => void listen()}>{listening ? 'Listening… say yes or no' : 'Answer by voice'}</button>}
                <button type="button" className="ml-auto rounded border border-steel-300 px-3 py-2 text-sm" onClick={() => { sessionRef.current = null; setSession(null); }}>Stop</button>
              </div>
            </>
          ) : session.verdict && (
            <div className="space-y-2" role="status">
              <p className="text-lg font-semibold text-steel-900">{session.verdict.text}</p>
              <p className="text-base text-steel-700">{session.verdict.fix}</p>
              {plan && session.verdict.hops[0]?.where && (
                <SheetThumb plan={plan} sheetNo={session.verdict.hops[0].where.sheet} marks={[session.verdict.wire ?? '', ...session.verdict.hops.map((h) => h.terminal ?? '')].filter(Boolean)} />
              )}
              <div className="flex gap-2">
                <button type="button" className={`${big} border border-steel-300 bg-white`} onClick={() => start(session.path, session.symptom)}>Check again</button>
                <button type="button" className={`${big} bg-brand-600 text-white`} onClick={() => { sessionRef.current = null; setSession(null); }}>Another problem</button>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-steel-500">Mains voltages (the breaker and disconnect side) are only named, never asked for: those checks are for a qualified electrician with a rated meter.</p>
    </div>
    </div>
  );
}
