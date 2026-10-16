import { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgramStore } from '../store/useProgramStore';
import { useSettingsStore, activeCredentials, ANTHROPIC_MODELS, EFFORT_LEVELS } from '../store/useSettingsStore';
import { useIOStore } from '../store/useIOStore';
import { generatePLCProgram } from '../lib/generateProgram';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export default function ProgramPage() {
  const {
    projectName, setProjectName,
    generatedCode, setGeneratedResult, updateCode,
    reasoning, userPrompt, setUserPrompt,
    isGenerating, setIsGenerating,
    lastGeneratedAt, clearProgram,
  } = useProgramStore();
  const settings = useSettingsStore();
  const { projectIO } = useIOStore();

  const [showReasoning, setShowReasoning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { provider, effort } = settings;
  const { apiKey, model } = activeCredentials(settings);
  const isClaude = provider === 'anthropic';

  const handleGenerate = async () => {
    if (!apiKey || !userPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generatePLCProgram({
        provider, apiKey, model, effort, userPrompt, ioPoints: projectIO,
      });
      setGeneratedResult(result.code, result.reasoning);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const modelLabel = isClaude
    ? `${ANTHROPIC_MODELS.find((m) => m.value === model)?.label.split(' —')[0] ?? model} · thinking: ${
        EFFORT_LEVELS.find((e) => e.value === effort)?.label.split(' —')[0] ?? effort
      }`
    : `OpenAI · ${model}`;

  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          aria-label="Project name"
          className="text-lg font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
        />
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
          {lastGeneratedAt && <span>Last generated: {new Date(lastGeneratedAt).toLocaleString()}</span>}
          <span className="font-mono">{modelLabel}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-2/5 flex flex-col border-r border-gray-200 bg-white p-4 overflow-y-auto gap-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
              Describe your machine logic
            </label>
            <textarea
              id="prompt"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={10}
              placeholder="e.g. When the start button is pressed and all safety inputs are OK, run Conveyor 1, extend Cylinder 1, wait for Cylinder 1 Extended feedback, then activate Vacuum Cup 1..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {projectIO.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Available I/O ({projectIO.length} points)
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {projectIO.map((pt) => (
                  <span
                    key={pt.id}
                    title={pt.description}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${
                      pt.type === 'input'
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}
                  >
                    <span className="font-bold">{pt.id}</span>
                    {pt.description && <span className="opacity-70 max-w-[120px] truncate">{pt.description}</span>}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-600">
              No I/O defined yet. <Link to="/io" className="underline font-medium">Add I/O points</Link> so
              the program uses your real addresses.
            </div>
          )}

          {!apiKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              Add your {isClaude ? 'Anthropic' : 'OpenAI'} API key in{' '}
              <Link to="/settings" className="underline font-medium">Settings</Link> to generate programs.
            </div>
          )}

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              <span className="font-semibold">Generation failed:</span> {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !apiKey || !userPrompt.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? <><Spinner /> {isClaude ? 'Thinking & generating…' : 'Generating…'}</> : 'Generate Program'}
          </button>

          {reasoning && (
            <div className="border border-indigo-200 rounded overflow-hidden text-xs">
              <button
                onClick={() => setShowReasoning((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 transition-colors"
              >
                <span>View Claude's reasoning</span>
                <span>{showReasoning ? '▲' : '▼'}</span>
              </button>
              {showReasoning && (
                <pre className="px-3 py-3 text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto bg-white font-mono leading-relaxed">
                  {reasoning}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Right panel — editor */}
        <div className="flex-1 flex flex-col bg-gray-900">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
            <span className="text-xs text-gray-400 flex-1">Generated PLC Code (IEC 61131-3 ST)</span>
            <button
              onClick={handleCopy}
              disabled={!generatedCode}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => { if (confirm('Clear the generated program?')) clearProgram(); }}
              disabled={!generatedCode}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex-1">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <Spinner className="h-8 w-8 text-blue-400" />
                <p className="text-sm">
                  {isClaude ? 'Claude is reasoning through your machine logic — deep thinking can take several minutes.' : 'Generating PLC code…'}
                </p>
              </div>
            ) : generatedCode ? (
              <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading editor…</div>}>
                <MonacoEditor
                  height="100%"
                  defaultLanguage="pascal"
                  value={generatedCode}
                  onChange={(val) => updateCode(val ?? '')}
                  theme="vs-dark"
                  options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on' }}
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Generated PLC code will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
