import { useEffect, useMemo, useState } from 'react';
import VoiceTextarea from '../voice/VoiceTextarea';
import SpeakButton from '../voice/SpeakButton';
import { useVoiceSettings } from '../voice/useVoiceSettings';
import { aiMatchSymptom, aiPlainStep, aiRankCauses, matchSymptom, rankCauses, type AssistLogEntry, type AssistPath, type Cause, type Symptom, type SymptomMatch } from './assist';
import { troubleshootAsk } from './assistAI';

/** A stable empty log (a new [] each render would ask the AI again every render). */
const NO_LOG: AssistLogEntry[] = [];

const SYMPTOM_WORDS: Record<Symptom, string> = {
  'never-on': 'never comes ON',
  'always-on': 'is ON all the time',
  flickers: 'flickers / drops out',
  'output-dead': 'the PLC turns it ON but nothing happens',
  'analog-wrong': 'reads wrong or out of range',
};

/**
 * "Describe the problem": typed or spoken, the points it most likely means, one tap to start the checks.
 * Works with no API key (rules); with a key the AI may pick among the points instead.
 */
export function DescribeProblem({ paths, onPick }: { paths: AssistPath[]; onPick: (address: string, symptom: Symptom) => void }) {
  const [text, setText] = useState('');
  const [matches, setMatches] = useState<SymptomMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const find = async () => {
    const rules = matchSymptom(text, paths);
    setMatches(rules);
    const ask = troubleshootAsk();
    if (!ask || (rules[0]?.score ?? 0) >= 0.8) return;
    setBusy(true);
    try { setMatches(await aiMatchSymptom(ask, text, paths, rules)); } finally { setBusy(false); }
  };
  const label = (a: string) => paths.find((p) => p.address === a)?.description || a;
  return (
    <div className="space-y-2" data-testid="describe-problem">
      <label className="block text-sm font-semibold text-steel-700">What is the machine doing wrong?</label>
      <VoiceTextarea value={text} onValueChange={(v) => { setText(v); setMatches(null); }} rows={2} placeholder='For example: "the box stop eye never comes on" or "conveyor motor won&apos;t start"' className="w-full rounded-lg border border-steel-300 px-3 py-2 text-base" data-testid="describe-text" />
      <button onClick={() => void find()} disabled={!text.trim() || busy} className="min-h-11 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" data-testid="describe-find">{busy ? 'Looking…' : 'Find the point'}</button>
      {matches && (matches.length ? (
        <ul className="space-y-1.5">
          {matches.slice(0, 3).map((m) => (
            <li key={m.address}>
              <button onClick={() => onPick(m.address, m.symptom)} className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2 text-left hover:bg-steel-50" data-testid="describe-match">
                <span className="font-semibold">{m.address} {label(m.address)}</span> <span className="text-steel-600">— {SYMPTOM_WORDS[m.symptom]}</span>
                <span className="block text-xs text-steel-500">{m.why}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-steel-500">No point of this machine matches. Pick the point from the list instead.</p>)}
    </div>
  );
}

/**
 * Likely causes for the point and symptom, most likely first: from its wiring path and the project's fault log
 * (rules), reordered by the AI when there is a key. The guided checks below still decide.
 */
export function LikelyCauses({ path, symptom, log = NO_LOG, said = '' }: { path: AssistPath; symptom: Symptom; log?: AssistLogEntry[]; said?: string }) {
  const rules = useMemo(() => rankCauses(path, symptom, log), [path, symptom, log]);
  // The AI's order, for the rule list it was asked about (a new point or symptom shows the rules again).
  const [ai, setAi] = useState<{ for: Cause[]; order: Cause[] } | null>(null);
  useEffect(() => {
    const ask = troubleshootAsk();
    if (!ask) return;
    let live = true;
    void aiRankCauses(ask, path, symptom, rules, said).then((order) => { if (live && order !== rules) setAi({ for: rules, order }); });
    return () => { live = false; };
  }, [path, symptom, rules, said]);
  const byAi = ai?.for === rules;
  const causes = byAi ? ai.order : rules;
  const spoken = `Most likely: ${causes.slice(0, 3).map((c) => c.text).join('. Then: ')}.`;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="likely-causes">
      <div className="flex items-center gap-2">
        <h4 className="flex-1 text-sm font-semibold text-amber-900">Likely causes{byAi ? ' (ordered by the AI)' : ''}</h4>
        <SpeakButton text={spoken} />
      </div>
      <ol className="ml-5 mt-1 list-decimal space-y-1 text-sm text-amber-900">
        {causes.slice(0, 5).map((c) => <li key={c.id}>{c.text}<span className="block text-xs text-amber-800">{c.why}</span></li>)}
      </ol>
      <p className="mt-1 text-xs text-amber-800">The checks below find which one it is; a skipped check proves nothing.</p>
    </div>
  );
}

/** "Say it simpler": the step reworded by the AI (only with a key), kept only when no reading, terminal or warning is lost. */
export function PlainWordsButton({ say, onPlain }: { say: string; onPlain: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const lang = useVoiceSettings((s) => s.language);
  const ask = troubleshootAsk();
  if (!ask) return null;
  const go = async () => {
    setBusy(true);
    try { onPlain(await aiPlainStep(ask, say, lang.split('-')[0] || 'en')); } finally { setBusy(false); }
  };
  return <button onClick={() => void go()} disabled={busy} className="text-xs text-brand-700 underline disabled:opacity-40" data-testid="plain-words">{busy ? 'Rewording…' : 'Say it simpler'}</button>;
}
