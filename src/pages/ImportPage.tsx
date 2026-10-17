import { useState } from 'react';
import { create } from 'zustand';
import { Link, useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import { useElectricalStore, DEFAULT_INPUTS } from '../store/useElectricalStore';
import { analyzeExistingSystem, type Confidence, type ImportResult } from '../lib/ai/importAI';
import { PLC_PROFILES } from '../plc/core/profiles';
import { Spinner, ReasoningPanel } from '../components/common';
import { useUi } from '../store/useUiStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { startAiJob, useAiJobError, useAiJobRunning } from '../lib/ai/jobs';

interface ImportSlice { files: File[]; note: string; result: ImportResult | null; reasoning: string | null; included: boolean[] }
const EMPTY: ImportSlice = { files: [], note: '', result: null, reasoning: null, included: [] };

/**
 * Kept in memory (not persisted) so switching pages doesn't lose an analysis; per project, so an
 * analysis never follows the user into another project (where "Apply" would overwrite it).
 */
const useImportStore = create<{ byProject: Record<string, ImportSlice>; set: (projectId: string, s: Partial<ImportSlice>) => void }>((set) => ({
  byProject: {},
  set: (projectId, patch) => set((st) => ({ byProject: { ...st.byProject, [projectId]: { ...(st.byProject[projectId] ?? EMPTY), ...patch } } })),
}));

/** The open project's import state. */
function useImportState() {
  const projectId = useProjectsStore((s) => s.activeId) ?? 'default';
  const slice = useImportStore((s) => s.byProject[projectId]) ?? EMPTY;
  return { ...slice, projectId, set: (patch: Partial<ImportSlice>) => useImportStore.getState().set(projectId, patch) };
}

const CONF_STYLE: Record<Confidence, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-red-100 text-red-800',
};

const MAX_FILES = 20;

/** Match a detected CPU part number to a supported PLC profile + CPU. */
function matchPlc(result: ImportResult): { plcId: string; cpuId: string; label: string } | null {
  const part = result.plc?.cpuPartNumber?.trim().toUpperCase();
  if (!part) return null;
  for (const p of PLC_PROFILES) {
    if (!p.available) continue;
    const cpu = p.cpuModels.find((c) => part.startsWith(c.id.toUpperCase()));
    if (cpu) return { plcId: p.id, cpuId: cpu.id, label: `${p.vendor} ${p.name} · ${cpu.id}` };
  }
  return null;
}

export default function ImportPage() {
  const navigate = useNavigate();
  const st = useImportState();
  const settings = useSettingsStore();
  const importPoints = useIOStore((s) => s.importPoints);
  const setPlc = useProjectStore((s) => s.setPlc);
  const electrical = useElectricalStore();

  // Global AI job: the analysis keeps running when the user leaves this page.
  const busy = useAiJobRunning('import');
  const jobError = useAiJobError('import');
  const [fileError, setError] = useState<string | null>(null);
  const error = fileError ?? jobError;
  const [replaceIO, setReplaceIO] = useUi('import.replaceIO', true);
  const [dragOver, setDragOver] = useState(false);

  const apiKey = settings.anthropicApiKey;
  const { result } = st;
  const plcMatch = result ? matchPlc(result) : null;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok = [...list].filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/'));
    st.set({ files: [...st.files, ...ok].slice(0, MAX_FILES) });
    if (ok.length < list.length) setError('Only PDF and image files can be read.');
  };

  const analyze = () => {
    if (!apiKey || !st.files.length) return;
    setError(null);
    const files = st.files, note = st.note, projectId = st.projectId;
    void startAiJob({
      kind: 'import', label: 'Reading the existing system',
      run: (h) => analyzeExistingSystem({ apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal, files, note }),
      // Into the project the analysis was started for, even if another one is open now.
      apply: ({ result, reasoning }) => useImportStore.getState().set(projectId, { result, reasoning, included: result.io.map((p) => p.confidence !== 'low') }),
    });
  };

  const updateIO = (i: number, patch: Partial<ImportResult['io'][number]>) => {
    if (!result) return;
    st.set({ result: { ...result, io: result.io.map((p, j) => (j === i ? { ...p, ...patch } : p)) } });
  };

  const apply = () => {
    if (!result) return;
    const chosen = result.io.filter((_, i) => st.included[i]);
    if (replaceIO && !confirm(`Replace the current I/O list with ${chosen.length} imported points?`)) return;
    importPoints(
      chosen.map((p) => ({ description: p.description, type: p.type, category: p.category, plcAddress: p.address })),
      replaceIO,
    );
    if (plcMatch) setPlc(plcMatch.plcId, plcMatch.cpuId);
    // Record the existing panel as the electrical design so drawings/BOM reflect what's built.
    const inputs = {
      ...DEFAULT_INPUTS,
      supply: result.supply ?? DEFAULT_INPUTS.supply,
      notes: `Imported from existing system. ${result.summary}`,
      motors: result.motors.map((m) => ({
        tag: m.tag, description: m.description, hp: m.hp ?? 0,
        voltage: result.supply ?? DEFAULT_INPUTS.supply, starter: m.starter ?? 'contactor-overload', reversing: false,
      })),
    };
    electrical.setInputs(inputs);
    electrical.setDesign({
      inputs,
      components: result.components.map((c) => ({ tag: c.tag, partNumber: c.partNumber ?? '', quantity: 1, function: c.description, motorTag: null })),
      ioWiring: chosen.map((p) => ({ address: p.address, deviceTag: p.deviceTag ?? '', deviceType: p.deviceType, description: p.description })),
      notes: result.uncertainties,
      generatedAt: new Date().toISOString(),
    }, 'imported', result.summary);
    navigate('/io');
  };

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Import Existing System</h2>
        <p className="text-xs text-gray-400 mt-0.5">Upload the electrical schematics or photos of the built cabinet. The AI reads them and sets up the project so you can program the machine as it is.</p>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-5xl space-y-5">
          {!apiKey && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              Reading drawings and photos uses Claude. Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.
            </div>
          )}

          {/* Upload */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-8 cursor-pointer transition-colors ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-blue-400'}`}
            >
              <span className="text-sm font-medium text-gray-700">Drop schematic PDFs or cabinet photos here, or click to choose</span>
              <span className="text-xs text-gray-400 mt-1">PDF, JPG, PNG · up to {MAX_FILES} files · clear, straight-on photos of labels and terminal strips work best</span>
              <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>

            {st.files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {st.files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs bg-gray-100 rounded px-2 py-1">
                    <span>{f.type === 'application/pdf' ? '📄' : '🖼'} {f.name}</span>
                    <button onClick={() => st.set({ files: st.files.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>✕</button>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              value={st.note}
              onChange={(e) => st.set({ note: e.target.value })}
              rows={2}
              placeholder="Optional notes, e.g. 'Palletizer on line 3. Sheet 7 is the I/O list. The photo shows the left door open.'"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={analyze}
              disabled={busy || !apiKey || !st.files.length}
              className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <><Spinner /> Reading drawings… this can take a few minutes</> : result ? 'Analyze again' : 'Analyze'}
            </button>
            {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
          </div>

          {/* Review */}
          {result && (
            <>
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
                <h3 className="text-sm font-semibold text-gray-800">What the AI found</h3>
                <p className="text-sm text-gray-700">{result.summary}</p>
                <div className="text-sm text-gray-600">
                  PLC: {result.plc ? `${result.plc.vendor} ${result.plc.model}${result.plc.cpuPartNumber ? ` (${result.plc.cpuPartNumber})` : ''}` : 'not identified'}
                  {result.plc && (plcMatch
                    ? <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Supported: {plcMatch.label}</span>
                    : <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Not matched to a supported PLC; choose it in PLC Setup</span>)}
                </div>
                {result.modules.length > 0 && <div className="text-xs text-gray-500">Modules: {result.modules.map((m) => `${m.slot != null ? `slot ${m.slot}: ` : ''}${m.partNumber}`).join(', ')}</div>}
                <div className="text-xs text-gray-500">Supply: {result.supply ?? 'not identified'} · {result.components.length} components · {result.motors.length} motors</div>
                {st.reasoning && <ReasoningPanel reasoning={st.reasoning} />}
              </div>

              {result.uncertainties.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-amber-900 mb-1">Check these on the machine</h3>
                  <ul className="list-disc pl-5 text-sm text-amber-800 space-y-0.5">{result.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">I/O points ({st.included.filter(Boolean).length} of {result.io.length} selected)</h3>
                  <span className="text-xs text-gray-500">Low-confidence points are unticked. Edit anything that's wrong.</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>{['', 'Address', 'Description', 'Type', 'Device', 'Confidence', 'Read from'].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.io.map((p, i) => (
                        <tr key={i} className={st.included[i] ? '' : 'opacity-50'}>
                          <td className="px-3 py-1.5">
                            <input type="checkbox" checked={st.included[i] ?? false} aria-label={`Include ${p.address}`}
                              onChange={(e) => st.set({ included: st.included.map((v, j) => (j === i ? e.target.checked : v)) })} />
                          </td>
                          <td className="px-3 py-1.5">
                            <input value={p.address} onChange={(e) => updateIO(i, { address: e.target.value.toUpperCase() })} className="w-20 font-mono border border-gray-200 rounded px-1.5 py-0.5" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input value={p.description} onChange={(e) => updateIO(i, { description: e.target.value })} className="w-full min-w-48 border border-gray-200 rounded px-1.5 py-0.5" />
                          </td>
                          <td className="px-3 py-1.5">
                            <select value={p.type} onChange={(e) => updateIO(i, { type: e.target.value as 'input' | 'output' })} className="border border-gray-200 rounded px-1 py-0.5 text-xs">
                              <option value="input">Input</option><option value="output">Output</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-600 whitespace-nowrap">{p.deviceTag ? `${p.deviceTag} · ` : ''}{p.deviceType}</td>
                          <td className="px-3 py-1.5"><span className={`text-xs px-2 py-0.5 rounded ${CONF_STYLE[p.confidence]}`}>{p.confidence}</span></td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">{p.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.components.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Components</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm">
                    {result.components.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="font-mono text-xs w-14">{c.tag}</span>
                        <span className="text-gray-700 flex-1">{c.description}{c.partNumber ? <span className="text-gray-400"> · {c.partNumber}</span> : ''}</span>
                        <span className={`text-xs px-1.5 rounded ${CONF_STYLE[c.confidence]}`}>{c.confidence}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-white rounded-lg border border-brand-200 p-5 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={replaceIO} onChange={() => setReplaceIO(true)} /> Replace my I/O list
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={!replaceIO} onChange={() => setReplaceIO(false)} /> Add to my I/O list
                </label>
                <button onClick={apply} className="ml-auto px-5 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700">
                  Apply to project
                </button>
                <p className="w-full text-xs text-gray-500">
                  Sets the PLC{plcMatch ? '' : ' (if supported)'}, loads the I/O with the addresses as built, and records the existing panel in Electrical. Then describe what the machine should do on the Program page.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
