import { useState } from 'react';
import {
  useSettingsStore,
  ANTHROPIC_MODELS,
  EFFORT_LEVELS,
  OPENAI_MODEL_SUGGESTIONS,
  type AIProvider,
  type Effort,
} from '../store/useSettingsStore';

const inputClass =
  'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

function ProviderTab({ label, active, onSelect }: { label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex-1 py-2.5 text-sm font-medium rounded transition-colors ${
        active ? 'bg-brand-600 text-brand-950 shadow' : 'text-gray-600 hover:bg-gray-200'
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

export default function SettingsPage() {
  const s = useSettingsStore();

  // Edit locally, commit on Save, so a half-typed key never gets used.
  const [draft, setDraft] = useState({
    provider: s.provider,
    anthropicApiKey: s.anthropicApiKey,
    anthropicModel: s.anthropicModel,
    effort: s.effort,
    openaiApiKey: s.openaiApiKey,
    openaiModel: s.openaiModel,
  });
  const [saved, setSaved] = useState(false);
  const update = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  const handleSave = () => {
    s.setProvider(draft.provider);
    s.setAnthropicApiKey(draft.anthropicApiKey);
    s.setAnthropicModel(draft.anthropicModel);
    s.setEffort(draft.effort);
    s.setOpenaiApiKey(draft.openaiApiKey);
    s.setOpenaiModel(draft.openaiModel.trim() || 'gpt-4o');
    setSaved(true);
  };

  const providers: { id: AIProvider; label: string }[] = [
    { id: 'anthropic', label: 'Anthropic (Claude)' },
    { id: 'openai', label: 'OpenAI (GPT / Codex)' },
  ];

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Settings</h2>
        <p className="text-xs text-gray-400 mt-0.5">AI provider, API keys, and generation quality</p>
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

          <ProviderCard title="Anthropic (Claude)" active={draft.provider === 'anthropic'}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <KeyInput value={draft.anthropicApiKey} onChange={(v) => update('anthropicApiKey', v)} placeholder="sk-ant-..." />
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
          </ProviderCard>

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
              className="px-5 py-2 bg-brand-600 text-brand-950 text-sm font-medium rounded hover:bg-brand-700 transition-colors"
            >
              Save Settings
            </button>
            {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
          </div>
        </div>
      </div>
    </>
  );
}
