import { Suspense, lazy } from 'react';
import { useProgramStore } from '../store/useProgramStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useIOStore } from '../store/useIOStore';
import { generatePLCProgram } from '../lib/generateProgram';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export default function ProgramPage() {
  const {
    projectName,
    setProjectName,
    generatedCode,
    setGeneratedCode,
    userPrompt,
    setUserPrompt,
    isGenerating,
    setIsGenerating,
    lastGeneratedAt,
    clearProgram,
  } = useProgramStore();

  const { anthropicApiKey, model } = useSettingsStore();
  const { projectIO } = useIOStore();

  const handleGenerate = async () => {
    if (!anthropicApiKey || !userPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const code = await generatePLCProgram(anthropicApiKey, model, userPrompt, projectIO);
      setGeneratedCode(code);
    } catch (err) {
      alert(`Generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedCode) navigator.clipboard.writeText(generatedCode);
  };

  const formattedDate = lastGeneratedAt
    ? new Date(lastGeneratedAt).toLocaleString()
    : null;

  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center gap-4">
        <div className="flex-1">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-lg font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent"
          />
          {formattedDate && (
            <p className="text-xs text-gray-400 mt-0.5">Last generated: {formattedDate}</p>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-2/5 flex flex-col border-r border-gray-200 bg-white p-4 overflow-y-auto gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Describe your machine logic
            </label>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={10}
              placeholder="e.g. When the start button is pressed and all safety inputs are OK, run Conveyor 1, extend Cylinder 1, wait for Cylinder 1 Extended feedback, then activate Vacuum Cup 1..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* I/O context chips */}
          {projectIO.length > 0 && (
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
                        : 'bg-orange-50 border-orange-200 text-orange-700'
                    }`}
                  >
                    <span className="font-bold">{pt.id}</span>
                    {pt.description && (
                      <span className="text-xs opacity-70 max-w-[120px] truncate">
                        {pt.description}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!anthropicApiKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              Add your Anthropic API key in Settings to use AI generation.
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !anthropicApiKey || !userPrompt.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating...
              </>
            ) : (
              'Generate Program'
            )}
          </button>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col bg-gray-900">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
            <span className="text-xs text-gray-400 flex-1">Generated PLC Code (ST)</span>
            <button
              onClick={handleCopy}
              disabled={!generatedCode}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={clearProgram}
              disabled={!generatedCode}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex-1">
            {generatedCode ? (
              <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading editor...</div>}>
                <MonacoEditor
                  height="100%"
                  defaultLanguage="pascal"
                  value={generatedCode}
                  onChange={(val) => setGeneratedCode(val ?? '')}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
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
