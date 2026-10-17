import { useEffect, useRef, useState } from 'react';
import { testAnthropicConnection } from '../lib/ai/anthropic';
import { clearAiCache } from '../lib/ai/cache';
import VoiceSettingsCard from '../voice/VoiceSettingsCard';
import { IS_PREVIEW, PREVIEW_ACCOUNT_KEY } from '../preview/mode';
import {
  useSettingsStore,
  ANTHROPIC_MODELS,
  EFFORT_LEVELS,
  OPENAI_MODEL_SUGGESTIONS,
  SPEEDS,
  SMALL_TASK_MODELS,
  DEFAULT_STAGE_MODES,
  type AIProvider,
  type Effort,
  type ModeStage,
  type Speed,
  type StageMode,
} from '../store/useSettingsStore';

const MODE_STAGES: { stage: ModeStage; label: string; quick: string }[] = [
  { stage: 'equipment', label: 'Equipment', quick: 'CPU and modules from the I/O counts' },
  { stage: 'electrical', label: 'Electrical design', quick: 'motors and safety read from the I/O list' },
  { stage: 'hmi', label: 'HMI screens', quick: 'names and machine states from the I/O list' },
  { stage: 'program', label: 'PLC program', quick: 'default cycle from the I/O list' },
];
const MODE_LABEL: Record<StageMode, string> = { quick: 'Quick (rules only, seconds)', 'quick-then-ai': 'Quick first, then AI', ai: 'With AI' };

const inputClass =
  'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

function ProviderTab({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex-1 py-2.5 text-sm font-medium rounded transition-colors ${
        active ? 'bg-brand-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

function KeyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder={placeholder}
        autoComplete="off"
        className={`${inputClass} font-mono`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="px-3 py-2 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-50"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function ProviderCard({ title, active, children }: { title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={`bg-white rounded-lg border p-5 space-y-4 ${active ? 'border-brand-300' : 'border-gray-200 opacity-60'}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {active && <span className="text-xs bg-brand-100 text-brand-800 px-2 py-0.5 rounded font-medium">Active</span>}
      </div>
      {children}
    </div>
  );
}

type SettingsDraft = Pick<ReturnType<typeof useSettingsStore.getState>, 'provider' | 'anthropicApiKey' | 'anthropicModel' | 'effort' | 'speed' | 'smallTaskModel' | 'stageModes' | 'openaiApiKey' | 'openaiModel'>;

/** Write the edited settings to the store. */
function commit(d: SettingsDraft) {
  const s = useSettingsStore.getState();
  s.setProvider(d.provider);
  s.setAnthropicApiKey(d.anthropicApiKey.trim() || (IS_PREVIEW ? PREVIEW_ACCOUNT_KEY : ''));
  s.setAnthropicModel(d.anthropicModel);
  s.setEffort(d.effort);
  s.setSpeed(d.speed);
  s.setSmallTaskModel(d.smallTaskModel);
  for (const { stage } of MODE_STAGES) s.setStageMode(stage, d.stageModes[stage]);
  s.setOpenaiApiKey(d.openaiApiKey.trim());
  s.setOpenaiModel(d.openaiModel.trim() || 'gpt-4o');
}

export default function SettingsPage() {
  const s = useSettingsStore();

  // Edit locally, commit on Save (so a half-typed key is never used while typing). Leaving the page
  // saves what was typed too: changes are never lost without a word.
  const [draft, setDraft] = useState({
    provider: s.provider,
    anthropicApiKey: s.anthropicApiKey,
    anthropicModel: s.anthropicModel,
    effort: s.effort,
    speed: s.speed,
    smallTaskModel: s.smallTaskModel,
    stageModes: { ...DEFAULT_STAGE_MODES, ...s.stageModes },
    openaiApiKey: s.openaiApiKey,
    openaiModel: s.openaiModel,
  });
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [test, setTest] = useState<{ busy: boolean; ok?: boolean; message?: string }>({ busy: false });
  const runTest = async () => {
    setTest({ busy: true });
    setTest({ busy: false, ...(await testAnthropicConnection(draft.anthropicApiKey, draft.anthropicModel)) });
  };
  const update = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    dirty.current = next;
    setDirty(true);
    setSaved(false);
  };

  const dirty = useRef<typeof draft | null>(null);
  const [isDirty, setDirty] = useState(false);
  const handleSave = () => {
    commit(draft);
    dirty.current = null;
    setDirty(false);
    setSaved(true);
  };

  // Leaving the page (unmount only) keeps what was typed.
  useEffect(() => () => { if (dirty.current) commit(dirty.current); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const providers: { id: AIProvider; label: string }[] = [
    { id: 'anthropic', label: 'Anthropic (Claude)' },
    { id: 'openai', label: 'OpenAI (GPT / Codex)' },
  ];

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Settings</h2>
        <p className="text-xs text-gray-400 mt-0.5">AI provider, API keys, generation quality and voice</p>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-xl space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">AI Provider</p>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              {providers.map((p) => (
                <ProviderTab key={p.id} label={p.label} active={draft.provider === p.id} onSelect={() => update('provider', p.id)} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              The active provider is used for generation. Both keys are kept, so you can switch any time.
            </p>
          </div>

          {IS_PREVIEW && (
            <div className="bg-brand-50 border border-brand-300 p-4 text-sm text-steel-800">
              <span className="font-semibold">In this preview no API key is needed.</span> AI requests run on your own Claude account;
              the first one asks you to allow it. The API key below is only used when the app runs on your PC.
            </div>
          )}
          <ProviderCard title="Anthropic (Claude)" active={draft.provider === 'anthropic'}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <KeyInput value={IS_PREVIEW && draft.anthropicApiKey === PREVIEW_ACCOUNT_KEY ? '' : draft.anthropicApiKey} onChange={(v) => update('anthropicApiKey', v)} placeholder={IS_PREVIEW ? 'Not needed in the preview' : 'sk-ant-...'} />
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={runTest} disabled={test.busy}
                  className="px-3 py-1 text-xs border border-steel-300 rounded-sm bg-white hover:bg-brand-50 disabled:opacity-50">
                  {test.busy ? 'Testing…' : 'Test connection'}
                </button>
                <span className="text-[11px] text-steel-400">Sends one tiny request with the key and model shown (not yet saved).</span>
              </div>
              {test.message && (
                <div role="status" className={`mt-2 px-3 py-2 text-xs border ${test.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  {test.ok ? '✓ ' : '✗ '}{test.message}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <select value={draft.anthropicModel} onChange={(e) => update('anthropicModel', e.target.value)} className={inputClass}>
                {ANTHROPIC_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Thinking depth</label>
              <select value={draft.effort} onChange={(e) => update('effort', e.target.value as Effort)} className={inputClass}>
                {EFFORT_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Claude always reasons before writing the program. Higher depth gives better logic on complex machines
                but takes longer and costs more. Max can take several minutes.
              </p>
            </div>
            <div>
              <label htmlFor="settings-speed" className="block text-xs font-medium text-gray-600 mb-1">Speed</label>
              <select id="settings-speed" value={draft.speed} onChange={(e) => update('speed', e.target.value as Speed)} className={inputClass}>
                {SPEEDS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Fast: small tasks (naming HMI items, choosing equipment) think briefly, the I/O list, cycle and machine model at medium,
                program revisions and the design review at high — never deeper than the thinking depth above. Several times faster
                than Thorough. Thorough: every task at the thinking depth above.
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={!!s.showExperimental} onChange={(e) => s.setShowExperimental(e.target.checked)} className="mt-0.5" />
              <span><span className="font-medium">Show experimental AI buttons</span> — the older "AI full design / AI full program" buttons, where the AI makes everything itself. Slow, and too large for the browser preview; the normal Generate buttons are the recommended way.</span>
            </label>
            <div>
              <label htmlFor="settings-small-model" className="block text-xs font-medium text-gray-600 mb-1">Model for small tasks</label>
              <select id="settings-small-model" value={draft.smallTaskModel} onChange={(e) => update('smallTaskModel', e.target.value)} className={inputClass}>
                {SMALL_TASK_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Used only to name HMI items and choose the equipment. A faster model answers these in a few seconds; the engineering stays with the rules.</p>
            </div>
          </ProviderCard>

          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">AI per stage (Update all)</p>
              <p className="text-xs text-gray-400 mt-0.5">Quick builds the stage from the rules in seconds. Quick first, then AI shows the rules' version at once and replaces it with the AI's when it arrives.</p>
            </div>
            {MODE_STAGES.map(({ stage, label, quick }) => (
              <div key={stage} className="flex items-center gap-3">
                <label htmlFor={`stage-mode-${stage}`} className="w-36 text-xs font-medium text-gray-600">{label}</label>
                <select id={`stage-mode-${stage}`} value={draft.stageModes[stage]} onChange={(e) => update('stageModes', { ...draft.stageModes, [stage]: e.target.value as StageMode })} className={inputClass} title={`Quick: ${quick}`}>
                  {(stage === 'equipment' ? (['quick', 'ai'] as StageMode[]) : (['quick', 'quick-then-ai', 'ai'] as StageMode[])).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                </select>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => { void clearAiCache().then(() => setCleared(true)); }}
                className="px-3 py-1 text-xs border border-steel-300 rounded-sm bg-white hover:bg-brand-50">Clear saved AI answers</button>
              <span className="text-[11px] text-steel-400">{cleared ? 'Cleared: the next update asks the AI again.' : 'Update all reuses an answer when the same question was asked before.'}</span>
            </div>
          </div>

          <ProviderCard title="OpenAI (GPT / Codex)" active={draft.provider === 'openai'}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <KeyInput value={draft.openaiApiKey} onChange={(v) => update('openaiApiKey', v)} placeholder="sk-..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <input
                list="openai-models"
                value={draft.openaiModel}
                onChange={(e) => update('openaiModel', e.target.value)}
                className={`${inputClass} font-mono`}
              />
              <datalist id="openai-models">
                {OPENAI_MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
              </datalist>
              <p className="text-xs text-gray-400 mt-1">Pick a suggestion or type any OpenAI model ID.</p>
            </div>
          </ProviderCard>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
            <span className="font-semibold">Security note:</span> API keys are stored in this browser's local storage
            and sent only to the provider's API. Don't use this app on a shared computer.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 transition-colors"
            >
              Save Settings
            </button>
            {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            {!saved && isDirty && <span className="text-xs text-steel-500">Not saved yet: Save, or leave the page to keep the changes.</span>}
          </div>

          {/* Voice settings apply as they are changed (no API keys in them). */}
          <VoiceSettingsCard />
        </div>
      </div>
    </>
  );
}
