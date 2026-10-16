import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSpecStore } from '../store/useSpecStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProjectStore } from '../store/useProjectStore';
import { PLC_PROFILES } from '../plc/profiles';
import { usePlc } from '../plc/usePlc';
import { SPEC_SECTIONS, type SpecSections } from '../spec/types';
import { organizeSpec } from '../lib/ai/specAI';
import { Spinner, ReasoningPanel } from '../components/program/common';

const ACCEPT = '.pdf,.docx,.txt,.md,.csv,image/*';

export default function SpecPage() {
  const navigate = useNavigate();
  const spec = useSpecStore();
  const settings = useSettingsStore();
  const setPlc = useProjectStore((s) => s.setPlc);
  const { profile, cpu } = usePlc();

  const [newText, setNewText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [undo, setUndo] = useState<SpecSections | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const apiKey = settings.anthropicApiKey;
  const filled = SPEC_SECTIONS.filter((s) => spec.sections[s.id]?.trim()).length;

  const organize = async () => {
    if (!apiKey || (!newText.trim() && !files.length)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await organizeSpec({
        apiKey, model: settings.anthropicModel, effort: settings.effort,
        current: spec.sections, newText, files,
      });
      setUndo(spec.sections);
      spec.setSections(r.sections);
      spec.setQuestions(r.questions);
      files.forEach((f) => spec.addDocument(f.name));
      setSummary(r.summary);
      setReasoning(r.reasoning);
      setNewText('');
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const answer = (q: string) => setNewText((t) => `${t}${t ? '\n' : ''}Q: ${q}\nA: `);

  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">1 · Describe the machine</h2>
          <p className="text-xs text-gray-400 mt-0.5">The spec drives every stage. Change it any time; the stages after it are marked out of date and can be updated in one click.</p>
        </div>
        <button onClick={() => navigate('/io')} disabled={!filled}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap">
          Next: I/O →
        </button>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-4xl space-y-5">
          {/* Controller */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-wrap items-end gap-4">
            <label className="text-sm text-gray-700">PLC
              <select value={profile.id} onChange={(e) => { const p = PLC_PROFILES.find((x) => x.id === e.target.value)!; setPlc(p.id, p.defaultCpuId); }}
                className="block mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm">
                {PLC_PROFILES.map((p) => <option key={p.id} value={p.id} disabled={!p.available}>{p.vendor} {p.name}{p.available ? '' : ' (coming soon)'}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-700 flex-1 min-w-64">CPU
              <select value={cpu.id} onChange={(e) => setPlc(profile.id, e.target.value)} className="block w-full mt-1 border border-gray-300 rounded px-2 py-1.5 text-sm">
                {profile.cpuModels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <Link to="/plc" className="text-xs text-gray-500 underline pb-2">Addressing details</Link>
          </div>

          {/* Add information */}
          <div className="bg-white rounded-lg border border-blue-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Add to the spec</h3>
            <p className="text-xs text-gray-500">Describe the machine in your own words, paste notes, or upload a spec document. The AI sorts it into the sections below and keeps everything already there.</p>
            <textarea value={newText} onChange={(e) => setNewText(e.target.value)} rows={6}
              placeholder="e.g. Pick and place cell. Operator loads trays at the front. Two guard doors with locking switches; opening a door during Auto stops all motion (category 1 stop) and the robot gripper holds the part. Homing: Z axis up first to its home switch, then X to home. Modes: Auto, Manual jog from the HMI, Setup with doors open at low speed..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); setFiles((f) => [...f, ...e.dataTransfer.files]); }}
              className={`flex items-center justify-center border-2 border-dashed rounded py-4 text-sm cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
            >
              Drop spec documents here or click to choose (PDF, Word .docx, text)
              <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { setFiles((f) => [...f, ...(e.target.files ?? [])]); e.target.value = ''; }} />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li key={i} className="text-xs bg-gray-100 rounded px-2 py-1 flex gap-2">
                    {f.name}
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600" aria-label={`Remove ${f.name}`}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-3">
              <button onClick={organize} disabled={busy || !apiKey || (!newText.trim() && !files.length)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {busy ? <><Spinner /> Organizing the spec…</> : 'Add to spec'}
              </button>
              {undo && !busy && (
                <button onClick={() => { spec.setSections(undo); setUndo(null); setSummary(null); }} className="text-sm text-gray-600 underline">Undo</button>
              )}
              {!apiKey && <span className="text-sm text-yellow-800">Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>, or type directly into the sections.</span>}
            </div>
            {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
            {summary && <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">{summary}</div>}
            {reasoning && <ReasoningPanel reasoning={reasoning} />}
            {spec.documents.length > 0 && (
              <p className="text-xs text-gray-400">Documents added: {spec.documents.map((d) => d.name).join(', ')}</p>
            )}
          </div>

          {spec.questions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">Open questions</h3>
              <p className="text-xs text-amber-800 mb-2">Answering these makes the design more accurate. Click one to answer it in the box above.</p>
              <ul className="space-y-1">
                {spec.questions.map((q, i) => (
                  <li key={i}><button onClick={() => answer(q)} className="text-left text-sm text-amber-900 hover:underline">• {q}</button></li>
                ))}
              </ul>
            </div>
          )}

          {/* Sections */}
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            <div className="px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Specification</h3>
              <span className="text-xs text-gray-400">{filled} of {SPEC_SECTIONS.length} sections filled</span>
            </div>
            {SPEC_SECTIONS.map((s) => (
              <div key={s.id} className="px-5 py-3">
                <label htmlFor={`spec-${s.id}`} className="block text-sm font-medium text-gray-700">{s.title}</label>
                <textarea
                  id={`spec-${s.id}`}
                  value={spec.sections[s.id] ?? ''}
                  onChange={(e) => spec.setSection(s.id, e.target.value)}
                  placeholder={s.hint}
                  rows={Math.min(12, Math.max(2, (spec.sections[s.id] ?? '').split('\n').length + 1))}
                  className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
