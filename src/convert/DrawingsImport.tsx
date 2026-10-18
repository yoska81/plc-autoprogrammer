import { useState } from 'react';
import { create } from 'zustand';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/common';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useDraft } from '../store/useDraftStore';
import { startAiJob, useAiJobError, useAiJobRunning, useTakeResult } from '../lib/ai/jobs';
import { regionSpec, SUPPLY_INFO } from '../standards/regions';
import { deriveFromUpload, MAX_UPLOAD_FILES, UPLOAD_ACCEPT } from './derive';
import { READ_KEY, setReading, type Reading } from './reading';
import { Step } from './ReviewAndConvert';

/** Files chosen for upload, per project and in memory only: they never follow the user into another project. */
const useUploadFiles = create<{ byProject: Record<string, File[]>; set: (projectId: string, files: File[]) => void }>((set) => ({
  byProject: {},
  set: (projectId, files) => set((s) => ({ byProject: { ...s.byProject, [projectId]: files } })),
}));
const NO_FILES: File[] = [];

/**
 * Import → Drawings: upload an existing machine's electrical drawings (PDF, scans, images, DXF; DWG through
 * a plugged-in reader) and have the AI read them. The reading goes to the shared review below the tabs.
 */
export default function DrawingsImport() {
  const settings = useSettingsStore();
  const apiKey = settings.provider === 'anthropic' ? settings.anthropicApiKey : '';
  const info = useProjectStore((s) => s.info);
  const projectId = useProjectsStore((s) => s.activeId) ?? 'default';
  const supply = useElectricalStore((s) => s.inputs.supply);
  const files = useUploadFiles((s) => s.byProject[projectId]) ?? NO_FILES;
  const setFiles = (f: File[]) => useUploadFiles.getState().set(projectId, f);
  const [note, setNote] = useDraft('convert.note', '');
  const [read] = useDraft<Reading | null>(READ_KEY, null);
  const busy = useAiJobRunning('convert');
  const error = useAiJobError('convert');
  useTakeResult<Omit<Reading, 'from'>>('convert', (r) => setReading({ ...r, from: 'drawings' }));
  const [fileError, setFileError] = useState<string | null>(null);

  const pick = (list: FileList | null) => {
    setFileError(null);
    const add = [...(list ?? [])];
    if (files.length + add.length > MAX_UPLOAD_FILES) { setFileError(`At most ${MAX_UPLOAD_FILES} files.`); return; }
    setFiles([...files, ...add]);
  };
  const readDrawings = () => {
    if (!apiKey || !files.length) return;
    const names = files.map((f) => f.name);
    void startAiJob({
      kind: 'convert', label: 'Reading the drawings', keepResult: true,
      run: async (h) => ({ ...(await deriveFromUpload({ apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal }, files, note)), at: new Date().toISOString(), files: names }),
    });
  };

  return (
    <div className="max-w-6xl">
      <Step n={1} title="Upload the drawings" testid="convert-upload">
        <p className="text-xs text-steel-500">PDF (also scans), photos or images of the sheets, and DXF exports from the CAD program. Chinese, IEC and GB drawings are fine.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded border border-steel-300 bg-white px-3 py-1.5 text-sm hover:bg-steel-50">
            Add files…
            <input type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" data-testid="convert-files" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
          </label>
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded bg-steel-100 px-2 py-0.5 text-xs text-steel-700">
              {f.name}<button aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, k) => k !== i))} className="text-steel-400 hover:text-red-600">✕</button>
            </span>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional: anything the drawings don't say (e.g. &quot;sorting conveyor from line 2, runs 2 shifts&quot;)" aria-label="Notes for the AI" className="w-full rounded border border-steel-300 px-3 py-2 text-sm" />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={readDrawings} disabled={!apiKey || !files.length || busy} className="inline-flex items-center gap-2 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40">
            {busy ? <><Spinner /> Reading the drawings…</> : 'Read the drawings'}
          </button>
          {!apiKey && <span className="text-xs text-steel-500">Needs an Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</span>}
          <span className="text-xs text-steel-500">Target: {regionSpec(info.region).label} · {SUPPLY_INFO[supply]?.label ?? supply} (change on <Link to="/project" className="underline">Project data</Link>)</span>
        </div>
        {(fileError || error) && <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{fileError ?? error}</div>}
        {read && <p className="text-xs text-steel-500">Read {read.files.length} file{read.files.length === 1 ? '' : 's'} on {read.at.slice(0, 16).replace('T', ' ')}: {read.files.join(', ')}</p>}
      </Step>
    </div>
  );
}
