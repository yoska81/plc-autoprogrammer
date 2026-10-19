import { useEffect, useMemo, useRef, useState } from 'react';
import { collectProject } from '../deliverables/collect';
import { plcNameOf } from '../deliverables/plcNames';
import { moduleSlots } from '../plc/core/modules';
import { planDrawings, type DrawingPlan } from '../electrical/drawings/plan';
import SpeakButton from '../voice/SpeakButton';
import { canSpeak, speak, stopSpeaking } from '../voice/tts';
import { micPlaceNow, startDictation, type Dictation } from '../voice/stt';
import { micUsable } from '../voice/micAccess';
import { spokenReply } from '../voice/text';
import { useVoiceSettings } from '../voice/useVoiceSettings';
import { useOnlineStore } from '../online/useOnline';
import { circuitOf, prepareWiring, wiringPaths, type WiringPath } from './wiringPath';
import { answer, back, currentStep, startSession, symptomsFor, SYMPTOM_LABEL, type Answer, type Session, type Symptom } from './steps';
import { FlickerWatch } from './watch';
import SheetThumb from './SheetThumb';
import { useUi } from '../store/useUiStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { oracleFor, verdictNames, type CircuitFault } from './oracle';
import FaultLog from './FaultLog';
import { useFaultLogStore } from './useFaultLogStore';

const big = 'min-h-14 flex-1 rounded-lg px-4 py-3 text-base font-semibold shadow-sm disabled:opacity-40';
const WIGGLE_MS = 10_000;
/** Faster polling while a wiggle test watches the point, so short flickers are caught. */
const WIGGLE_POLL_MS = 100;

/** Practice on the simulator: the wiring fault set there, and the points it affects. */
export interface Practice { fault: CircuitFault; points: string[] }

/**
 * Guided fault finding at the cabinet: pick the PLC point that misbehaves and what it does, then follow one
 * meter step at a time (big buttons, read aloud, spoken yes / no). With the PLC connected the page shows the
 * point's live value and answers wiggle tests itself. Works with no API key: the steps come from the wiring.
 * Every answer found goes into the project's fault log. In practice mode (simulator) the meter readings
 * come from the fault that was set, one tap per step.
 */
export default function TroubleshootPanel({ practice }: { practice?: Practice } = {}) {
  const [{ paths, plan, circ, nativeOf }] = useState(() => {
    const snap = collectProject();
    const ctx = snap.drawingCtx;
    // The point as the PLC's software names it too ("X101 (%I0.0)" on an S7); CLICK keeps its own address.
    const name = plcNameOf(snap);
    // An analog channel by its terminal too (%IW64), not only its tag name.
    const slots = moduleSlots(snap.modules);
    const nativeOf = (a: string) => {
      const n = snap.profile.id !== 'click' && /^DF\d+$/i.test(a) ? snap.profile.ioTag?.(a.toUpperCase(), slots, snap.cpu.id) ?? name(a) : name(a);
      return n && n !== a ? ` (${n})` : '';
    };
    let p: WiringPath[] = [];
    let pl: DrawingPlan | null = null;
    let cc: ReturnType<typeof circuitOf> | null = null;
    try { if (ctx) { const prep = prepareWiring(ctx); p = wiringPaths(prep); cc = circuitOf(prep); pl = planDrawings(ctx); } } catch { /* no design */ }
    return { paths: p, plan: pl, circ: cc, nativeOf };
  });
  // Practice: the meter reads what the circuit gives with the fault that was set.
  const found = (_path: WiringPath, v: Parameters<typeof verdictNames>[1]) => Boolean(practice && circ && verdictNames(circ.circuit, v, practice.fault));
  const practiceReading = (path: WiringPath, st: NonNullable<ReturnType<typeof currentStep>>, sym: Symptom) => (practice && circ ? oracleFor(circ.model, circ.circuit, path, practice.fault, sym)?.answer(st, sym).shows ?? '' : '');
  // Practice opens on the point the fault affects (a hidden fault: the first point, so nothing is given away).
  const [address, setAddress] = useState(practice ? practice.points[0] ?? paths[0]?.address ?? '' : '');
  const [reading, setReading] = useState<string | null>(null);
  const projectId = useProjectsStore((s) => s.activeId);
  const addLog = useFaultLogStore((s) => s.add);
  const removeLog = useFaultLogStore((s) => s.remove);
  // The log entry of the verdict on screen: Back from that verdict takes it out again.
  const logged = useRef<string | null>(null);
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
  // Full screen: the page behind must not scroll sideways (the app shell is wider than a phone).
  useEffect(() => {
    if (!full) return;
    const el = document.documentElement, prev = el.style.overflow;
    el.style.overflow = 'hidden';
    return () => { el.style.overflow = prev; };
  }, [full]);

  const path = useMemo(() => paths.find((p) => p.address === address) ?? null, [paths, address]);
  const step = session ? currentStep(session) : null;
  const live = (a: string) => (online.bits.has(a.toUpperCase()) ? (online.bits.get(a.toUpperCase()) ? 'ON' : 'OFF') : online.words.has(a.toUpperCase()) ? String(online.words.get(a.toUpperCase())) : null);
  const connected = online.status === 'connected';

  // Feed the live watch from the Online page's polling.
  const value = path ? online.bits.get(path.address.toUpperCase()) : undefined;
  useEffect(() => { if (path && value !== undefined) watch.current.feed(path.address, value, Date.now()); }, [path, value, online.polls]);
  if (!paths.length) return <p className="text-sm text-steel-500">Fault finding needs the electrical design (Electrical design page): the steps follow its wiring.</p>;

  const show = (next: Session) => {
    sessionRef.current = next;
    setSession(next);
    setReading(null);
    if (canSpeak()) void speak(next.verdict ? `${next.verdict.text} ${next.verdict.fix}` : currentStep(next)?.say ?? '', 'troubleshoot');
  };
  const reply = (a: Answer, stepId?: string) => {
    const cur = sessionRef.current;
    if (!cur) return;
    // A wiggle watch answers only the step it was started on.
    if (stepId && currentStep(cur)?.id !== stepId) return;
    stopSpeaking();
    const next = answer(cur, a);
    show(next);
    const v = next.verdict;
    if (v && v.text !== 'Stopped.') {
      logged.current = addLog(projectId, {
        address: next.path.address, description: next.path.description, symptom: SYMPTOM_LABEL[next.symptom], found: v.text, fix: v.fix, wire: v.wire,
        readings: next.answers.filter((x, i) => x !== 'skip' && next.steps[i]?.part !== 'prepare').length,
        ...(practice ? { practice: true, note: found(next.path, v) ? 'Practice: found the fault that was set' : `Practice: the fault set was ${practice.fault.label}` } : {}),
      }).id;
    }
  };
  const goBack = (cur: Session) => {
    if (cur.verdict && logged.current) { removeLog(projectId, logged.current); logged.current = null; }
    show(back(cur));
  };
  const start = (p: WiringPath, symptom: Symptom) => {
    const s = startSession(p, symptom);
    sessionRef.current = s;
    setSession(s);
    setReading(null);
    logged.current = null;
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

  const symptoms: Symptom[] = path ? symptomsFor(path) : [];
  const mains = paths.flatMap((p) => p.supply).find((h) => h.measure?.kind === 'VAC')?.measure?.expect.replace(/\s.*$/, '');

  return (
    <div className={full ? 'fixed inset-0 z-40 overflow-auto bg-steel-50 p-3' : ''}>
    <div className="mx-auto max-w-xl space-y-3" aria-label="Fault finding">
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900" title="Fault finding is new: check each verdict with your own judgement before you replace a part.">Beta</span>
        <button type="button" className="rounded border border-steel-300 bg-white px-3 py-1.5 text-sm" onClick={() => setFull(!full)}>{full ? 'Back to the page' : 'Full screen'}</button>
      </div>
      {!session ? (
        <div className="space-y-3 rounded-lg border border-steel-200 bg-white p-4">
          <h3 className="text-base font-semibold text-steel-800">What is wrong?</h3>
          <label className="block text-sm text-steel-700">The PLC point
            <select aria-label="Point to troubleshoot" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full min-w-0 max-w-full rounded border border-steel-300 px-2 py-2 text-base">
              <option value="">choose…</option>
              {paths.map((p) => <option key={p.address} value={p.address}>{p.address}{nativeOf(p.address)} — {p.description}{live(p.address) ? ` (now ${live(p.address)})` : ''}</option>)}
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
              {step.hop?.measure?.otherwise && session.symptom !== 'always-on' && <p className="text-sm text-steel-600">Otherwise: {step.hop.measure.otherwise}.</p>}
              {step.hop?.note && <p className="text-sm text-amber-800">{step.hop.note}</p>}
              {practice && step.part !== 'prepare' && step.part !== 'wiggle' && (
                reading === null
                  ? <button type="button" className={`${big} w-full border border-violet-400 bg-violet-50 text-violet-900`} onClick={() => setReading(practiceReading(session.path, step, session.symptom))}>Take the reading (practice meter)</button>
                  : <p className="rounded-lg bg-violet-600 px-3 py-2 text-center font-mono text-lg font-bold text-white" aria-label="Practice meter">{reading}</p>
              )}
              {plan && step.hop?.where && (
                <SheetThumb plan={plan} sheetNo={step.hop.where.sheet} marks={[step.hop.wire ?? '', step.hop.terminal ?? '', step.hop.tag].filter(Boolean)} />
              )}
              {step.wiggle && connected && (
                <button type="button" className={`${big} w-full border border-violet-400 bg-violet-50 text-violet-900`} disabled={watching !== null} onClick={() => {
                  // The wiggle test answers itself: 2+ changes of the point in 10 s = loose connection.
                  const t0 = Date.now();
                  const id = step.id;
                  const poll = useOnlineStore.getState().settings.pollMs;
                  useOnlineStore.setState((o) => ({ settings: { ...o.settings, pollMs: Math.min(poll, WIGGLE_POLL_MS) } }));
                  setWatching(t0);
                  setTimeout(() => {
                    useOnlineStore.setState((o) => ({ settings: { ...o.settings, pollMs: poll } }));
                    setWatching(null);
                    reply(watch.current.changesSince(session.path.address, t0) >= 2 ? 'yes' : 'no', id);
                  }, WIGGLE_MS);
                }}>
                  {watching !== null ? 'Watching… keep wiggling' : `Watch ${session.path.address} for 10 s while I wiggle`}
                </button>
              )}
              <div className="flex gap-2">
                <button type="button" className={`${big} bg-green-600 text-white hover:bg-green-700`} disabled={watching !== null} onClick={() => reply('yes')}>{step.yes}</button>
                <button type="button" className={`${big} bg-red-600 text-white hover:bg-red-700`} disabled={watching !== null} onClick={() => reply('no')}>{step.no}</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="min-h-11 rounded border border-steel-300 px-3 py-2 text-sm disabled:opacity-40" disabled={!session.answers.length || watching !== null} onClick={() => goBack(session)}>Back</button>
                <button type="button" className="min-h-11 rounded border border-steel-300 px-3 py-2 text-sm disabled:opacity-40" disabled={watching !== null} onClick={() => reply('skip')}>Didn't check</button>
                <SpeakButton text={step.say} label="Read the step aloud" />
                {micOn && <button type="button" className="min-h-11 rounded border border-steel-300 px-3 py-2 text-sm" onClick={() => void listen()}>{listening ? 'Listening… say yes or no' : 'Answer by voice'}</button>}
                <button type="button" className="ml-auto min-h-11 rounded border border-steel-300 px-3 py-2 text-sm" onClick={() => { sessionRef.current = null; setSession(null); }}>Stop</button>
              </div>
            </>
          ) : session.verdict && (
            <div className="space-y-2" role="status">
              <p className="text-lg font-semibold text-steel-900">{session.verdict.text}</p>
              {practice && session.verdict.text !== 'Stopped.' && (
                <p className={`rounded px-3 py-2 text-sm font-semibold ${found(session.path, session.verdict) ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}>
                  {found(session.path, session.verdict) ? `Found it: the fault set was ${practice.fault.label}.` : `Not quite: the fault set was ${practice.fault.label}. Repair it and try another.`}
                </p>
              )}
              {session.verdict.text !== 'Stopped.' && <p className="text-xs text-steel-500">Saved in the fault log below.</p>}
              <p className="text-base text-steel-700">{session.verdict.fix}</p>
              {plan && session.verdict.hops[0]?.where && (
                <SheetThumb plan={plan} sheetNo={session.verdict.hops[0].where.sheet} marks={[session.verdict.wire ?? '', ...session.verdict.hops.map((h) => h.terminal ?? '')].filter(Boolean)} />
              )}
              <div className="flex gap-2">
                <button type="button" className={`${big} border border-steel-300 bg-white`} onClick={() => goBack(session)}>Back</button>
                <button type="button" className={`${big} border border-steel-300 bg-white`} onClick={() => start(session.path, session.symptom)}>Check again</button>
                <button type="button" className={`${big} bg-brand-600 text-white`} onClick={() => { sessionRef.current = null; setSession(null); }}>Another problem</button>
              </div>
            </div>
          )}
        </div>
      )}
      <FaultLog />
      {mains && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="note">{mains} V is live inside this cabinet while you take the 24 V readings: keep hands and probes away from the mains side.</p>}
      <p className="text-xs text-steel-500">Mains voltages (the breaker and disconnect side) are only named, never asked for: those checks are for a qualified electrician with a rated meter.</p>
    </div>
    </div>
  );
}
