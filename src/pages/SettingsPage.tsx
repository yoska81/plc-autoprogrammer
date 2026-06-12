import { useState } from 'react';
import {
  useSettingsStore,
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  type AIProvider,
} from '../store/useSettingsStore';

const THINKING_BUDGETS = [
  { value: 5000, label: '5 000 tokens — Quick' },
  { value: 10000, label: '10 000 tokens — Standard' },
  { value: 20000, label: '20 000 tokens — Deep' },
  { value: 32000, label: '32 000 tokens — Maximum' },
];

// Models that support extended thinking
const THINKING_CAPABLE = ['claude-opus-4-8', 'claude-sonnet-4-6'];

export default function SettingsPage() {
  const {
    provider, setProvider,
    anthropicApiKey, setAnthropicApiKey,
    anthropicModel, setAnthropicModel,
    openaiApiKey, setOpenaiApiKey,
    openaiModel, setOpenaiModel,
    extendedThinking, setExtendedThinking,
    thinkingBudget, setThinkingBudget,
  } = useSettingsStore();

  const [anthropicKeyInput, setAnthropicKeyInput] = useState(anthropicApiKey);
  const [openaiKeyInput, setOpenaiKeyInput] = useState(openaiApiKey);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const thinkingSupported = THINKING_CAPABLE.includes(anthropicModel);

  function handleSave() {
    setAnthropicApiKey(anthropicKeyInput);
    setOpenaiApiKey(openaiKeyInput);
    // If thinking is on but switched to a non-capable model, disable it
    if (!THINKING_CAPABLE.includes(anthropicModel)) {
      setExtendedThinking(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const ProviderTab = ({ id, label, active }: { id: AIProvider; label: string; active: boolean }) => (
    <button
      onClick={() => setProvider(id)}
      className={`flex-1 py-2.5 text-sm font-medium rounded transition-colors ${
        active
          ? 'bg-blue-600 text-white shadow'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
        <p className="text-xs text-gray-400 mt-0.5">Configure AI provider, API keys, and generation preferences</p>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-xl space-y-5">

          {/* Provider selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">AI Provider</p>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <ProviderTab id="anthropic" label="Anthropic (Claude)" active={provider === 'anthropic'} />
              <ProviderTab id="openai" label="OpenAI (GPT / Codex)" active={provider === 'openai'} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Active provider is used for all code generation. Both keys are saved independently.
            </p>
          </div>

          {/* Anthropic settings */}
          <div className={`bg-white rounded-lg border p-5 space-y-4 transition-opacity ${provider === 'anthropic' ? 'border-blue-300' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-700">Anthropic</span>
              {provider === 'anthropic' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Active</span>
              )}
            </div>

            {/* API key */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={anthropicKeyInput}
                  onChange={(e) => setAnthropicKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey((v) => !v)}
                  className="px-3 py-2 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-50"
                >
                  {showAnthropicKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <select
                value={anthropicModel}
                onChange={(e) => setAnthropicModel(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ANTHROPIC_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Extended Thinking */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Extended Thinking</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Claude reasons deeply before generating — significantly improves complex PLC logic quality.
                    {!thinkingSupported && (
                      <span className="text-amber-500 ml-1">Not supported by selected model.</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!thinkingSupported}
                  onClick={() => setExtendedThinking(!extendedThinking)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
                    extendedThinking && thinkingSupported ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      extendedThinking && thinkingSupported ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {extendedThinking && thinkingSupported && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Thinking budget
                  </label>
                  <select
                    value={thinkingBudget}
                    onChange={(e) => setThinkingBudget(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {THINKING_BUDGETS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Higher budget = better code quality, longer wait time, higher cost.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* OpenAI settings */}
          <div className={`bg-white rounded-lg border p-5 space-y-4 transition-opacity ${provider === 'openai' ? 'border-blue-300' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-700">OpenAI</span>
              {provider === 'openai' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Active</span>
              )}
            </div>

            {/* API key */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey((v) => !v)}
                  className="px-3 py-2 text-xs border border-gray-300 rounded text-gray-500 hover:bg-gray-50"
                >
                  {showOpenaiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <select
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {OPENAI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                o3 / o4-mini are reasoning models — they think before responding, similar to extended thinking.
              </p>
            </div>
          </div>

          {/* Security note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
            <span className="font-semibold">Security note:</span> API keys are stored only in your browser's localStorage and are sent directly to the provider's API. They are never transmitted to any other server.
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Save Settings
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">Saved!</span>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
