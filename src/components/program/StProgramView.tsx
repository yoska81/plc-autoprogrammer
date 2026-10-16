import { Suspense, lazy, useState } from 'react';
import { useProgramStore } from '../../store/useProgramStore';
import { generatePLCProgram } from '../../lib/generateProgram';
import type { AIConfig } from '../../lib/ai/ladderAI';
import type { IOPoint } from '../../types/io';
import { Spinner, ReasoningPanel } from './common';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

/** Structured Text workspace for text-language PLC profiles. */
export default function StProgramView({ ai, io, ready }: { ai: AIConfig; io: IOPoint[]; ready: boolean }) {
  const {
    generatedCode, setGeneratedResult, updateCode, reasoning,
    userPrompt, setUserPrompt, isGenerating, setIsGenerating, clearProgram,
  } = useProgramStore();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!ready || !userPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generatePLCProgram(ai, userPrompt, io);
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

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-2/5 flex flex-col border-r border-gray-200 bg-white p-4 overflow-y-auto gap-4">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">Describe your machine logic</label>
          <textarea
            id="prompt"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={10}
            placeholder="e.g. When the start button is pressed and all safety inputs are OK, run Conveyor 1..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
        {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800"><span className="font-semibold">Generation failed:</span> {error}</div>}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !ready || !userPrompt.trim()}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? <><Spinner /> Thinking & generating…</> : 'Generate Program'}
        </button>
        {reasoning && <ReasoningPanel reasoning={reasoning} />}
      </div>

      <div className="flex-1 flex flex-col bg-gray-900">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-xs text-gray-400 flex-1">Structured Text (IEC 61131-3) — editable</span>
          <button onClick={handleCopy} disabled={!generatedCode} className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-40">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => { if (confirm('Clear the generated program?')) clearProgram(); }}
            disabled={!generatedCode}
            className="px-3 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        <div className="flex-1">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <Spinner className="h-8 w-8 text-blue-400" />
              <p className="text-sm">Reasoning through your machine logic — deep thinking can take several minutes.</p>
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
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">Generated PLC code will appear here</div>
          )}
        </div>
      </div>
    </div>
  );
}
