import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/common';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProjectStore } from '../store/useProjectStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useIOStore } from '../store/useIOStore';
import { useSpecStore } from '../store/useSpecStore';
import { useDraft } from '../store/useDraftStore';
import { startAiJob, useAiJobError, useAiJobRunning, useTakeResult } from '../lib/ai/jobs';
import { useQuestions } from '../components/questions/useQuestionStore';
import { collectProject } from '../deliverables/collect';
import { runStages } from '../spec/updateRun';
import { SPEC_SECTIONS } from '../spec/types';
import { regionSpec, SUPPLY_INFO } from '../standards/regions';
import { deriveFromUpload, MAX_UPLOAD_FILES, UPLOAD_ACCEPT } from '../convert/derive';
import { convertMachine, type ConvertTarget, type PartMatch } from '../convert/convert';
import { applyExistingMachine, MACHINE_KEY } from '../convert/apply';
import { functionKept, type KeptStatus } from '../convert/functionKept';
import type { ExistingMachine } from '../convert/types';

interface ReadResult { machine: ExistingMachine; reasoning: string | null; at: string; files: string[] }

const th = 'text-left py-1.5 pr-3 font-medium text-steel-500';
const card = 'rounded-sm border border-steel-200 bg-white p-4 space-y-3';
const CONF = { high: 'bg-green-100 text-green-800', medium: 'bg-amber-100 text-amber-800', low: 'bg-red-100 text-red-800' } as const;
const KEPT: Record<KeptStatus, string> = { kept: 'text-emerald-700', missing: 'text-red-700 font-semibold', check: 'text-amber-700' };
const KEPT_LABEL: Record<KeptStatus, string> = { kept: '✓ Kept', missing: '✗ Missing', check: '? Check' };
const STATUS_LABEL: Record<PartMatch['status'], string> = { matched: 'Equivalent', engine: 'Chosen by the design', 'to-select': 'To select' };

function Step({ n, title, children, testid }: { n: number; title: string; children: React.ReactNode; testid: string }) {
  return (
    <section className={card} data-testid={testid}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-steel-800"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{n}</span>{title}</h3>
      {children}
    </section>
  );
}

/**
 * Convert existing drawings: the user uploads an existing machine's electrical drawings; the app reads
 * them, writes the machine description, converts every part to the target standard, rebuilds the design
 * with the existing engine and checks that every original function is kept.
 */
export default function ConvertPage() {
  const settings = useSettingsStore();
  const apiKey = settings.provider === 'anthropic' ? settings.anthropicApiKey : '';
  const info = useProjectStore((s) => s.info);
  const supply = useElectricalStore((s) => s.inputs.supply);
  const design = useElectricalStore((s) => s.design);
  const io = useIOStore((s) => s.projectIO);
  const sections = useSpecStore((s) => s.sections);
  const specQuestions = useQuestions('spec').filter((q) => q.status === 'open');
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useDraft('convert.note', '');
  const [read, setRead] = useDraft<ReadResult | null>('convert.read', null);
  const [applied] = useDraft<ExistingMachine | null>(MACHINE_KEY, null);
  const busy = useAiJobRunning('convert');
  const error = useAiJobError('convert');
  useTakeResult<ReadResult>('convert', setRead);
  const [fileError, setFileError] = useState<string | null>(null);

  const target: ConvertTarget = { region: info.region, supply, controlVolts: '24VDC' };
  const machine = read?.machine ?? applied;
  const conv = useMemo(() => (machine ? convertMachine(machine, target) : null), [machine, target.region, target.supply]); // eslint-disable-line react-hooks/exhaustive-deps
  // Recomputed when the design, the I/O or the description change.
  const kept = useMemo(() => (applied && conv ? functionKept(applied, conv, collectProject()) : []), [applied, conv, design, io, sections]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const build = () => {
    if (!machine || !conv) return;
    applyExistingMachine(machine, conv);
    // The original I/O stays as read: the engine builds equipment, panel, HMI and program around it.
    void runStages(['equipment', 'electrical', 'hmi', 'program'], 'Building the converted design');
  };

  const filled = machine ? SPEC_SECTIONS.filter((s) => machine.spec[s.id]) : [];
  const counts = conv ? { matched: conv.parts.filter((p) => p.status === 'matched').length, engine: conv.parts.filter((p) => p.status === 'engine').length, select: conv.parts.filter((p) => p.status === 'to-select').length } : null;
  const keptBad = kept.filter((k) => k.status !== 'kept').length;

  return (
    <>
      <header className="border-b border-steel-200 bg-white px-4 py-2.5">
        <h2 className="text-base font-semibold text-steel-800">Convert existing drawings</h2>
        <p className="mt-0.5 text-xs text-steel-500">Upload the electrical drawings of an existing machine. The app reads them, writes the machine description, converts every part to {regionSpec(info.region).label} ({regionSpec(info.region).codes.short}) and rebuilds the design, keeping everything the machine does.</p>
      </header>
      <div className="flex-1 overflow-y-auto bg-steel-50 p-4">
        <div className="max-w-6xl space-y-4">
          <Step n={1} title="Upload the drawings" testid="convert-upload">
            <p className="text-xs text-steel-500">PDF (also scans), photos or images of the sheets, and DXF exports from the CAD program. DWG: export to DXF or PDF first. Chinese, IEC and GB drawings are fine.</p>
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

          {machine && conv && (
            <>
              <Step n={2} title="What the drawings show" testid="convert-recognised">
                <p className="text-sm text-steel-700">{machine.summary}</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
                  <div><dt className="text-xs text-steel-500">Drawings</dt><dd>{machine.drawingStandard} · {machine.language || '—'}</dd></div>
                  <div><dt className="text-xs text-steel-500">Supply as drawn</dt><dd>{machine.supplyDrawn.text || '—'}</dd></div>
                  <div><dt className="text-xs text-steel-500">PLC</dt><dd>{machine.plc ? `${machine.plc.vendor} ${machine.plc.model}` : '—'}</dd></div>
                  <div><dt className="text-xs text-steel-500">Found</dt><dd>{machine.io.length} I/O · {machine.components.length} parts · {machine.motors.length} motors</dd></div>
                </dl>
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-brand-700">I/O list as drawn ({machine.io.length})</summary>
                  <table className="mt-2 w-full text-xs">
                    <thead><tr>{['Address', 'Function', 'Device', 'Read from', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-steel-100">
                      {machine.io.map((p) => (
                        <tr key={`${p.address}-${p.description}`}><td className="py-1 pr-3 font-mono">{p.address}</td><td className="pr-3">{p.description}</td><td className="pr-3">{p.deviceTag ?? ''} {p.deviceType}</td><td className="pr-3 text-steel-500">{p.source}</td><td><span className={`rounded px-1.5 ${CONF[p.confidence]}`}>{p.confidence}</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                {machine.motors.length > 0 && <p className="text-sm"><b>Motors:</b> {machine.motors.map((m) => `${m.tag} ${m.description}${m.kw ? ` ${m.kw} kW` : ''}${m.reversing ? ' (reversing)' : ''}`).join('; ')}</p>}
                {machine.interlocks.length > 0 && <div className="text-sm"><b>Interlocks:</b><ul className="list-disc pl-5">{machine.interlocks.map((i) => <li key={i.description}>{i.description}</li>)}</ul></div>}
                <p className="text-sm"><b>Safety:</b> {machine.safety.description || '—'}</p>
                {machine.uncertainties.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><b>Check on the machine:</b><ul className="list-disc pl-5">{machine.uncertainties.map((u) => <li key={u}>{u}</li>)}</ul></div>}
              </Step>

              <Step n={3} title="The machine description (written from the drawings)" testid="convert-description">
                <p className="text-xs text-steel-500">{filled.length} of {SPEC_SECTIONS.length} sections written. {machine.questions.length + conv.questions.length} question{machine.questions.length + conv.questions.length === 1 ? '' : 's'} for what the drawings don't tell{applied ? <> are on the <Link to="/spec" className="underline">Machine description</Link> page</> : ' go to the Machine description page when you use this'}.</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {filled.map((s) => <div key={s.id} className="rounded border border-steel-100 p-2"><div className="text-xs font-semibold text-steel-600">{s.title}</div><p className="whitespace-pre-line text-sm text-steel-800">{machine.spec[s.id]}</p></div>)}
                </div>
                {applied && specQuestions.length > 0 && <p className="text-sm text-amber-800">{specQuestions.length} open question{specQuestions.length === 1 ? '' : 's'}: <Link to="/spec" className="underline">answer on the Machine description page</Link>.</p>}
              </Step>

              <Step n={4} title={`Conversion to ${regionSpec(conv.target.region).label}`} testid="convert-table">
                <p className="text-sm text-steel-700">{conv.supplyNote}</p>
                {conv.motors.length > 0 && <p className="text-sm">{conv.motors.map((m, i) => `${m.tag}: ${conv.motorKw[i].kw ? `${conv.motorKw[i].kw} kW → ` : ''}${m.hp} HP ${m.voltage.replace('VAC-3PH', ' V')}`).join(' · ')}</p>}
                {counts && <p className="text-xs text-steel-500">{counts.matched} parts with an equivalent, {counts.engine} chosen by the design (operator devices, sensors, PLC, overloads set for the new motor current){counts.select ? `, ${counts.select} to select` : ''}.</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr>{['Old tag', 'Old part', 'New tag', 'New part', 'What changes', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-steel-100">
                      {conv.parts.map((p) => (
                        <tr key={p.oldTag} className="align-top">
                          <td className="py-1 pr-3 font-mono">{p.oldTag}</td>
                          <td className="pr-3">{[p.from.manufacturer, p.from.partNumber].filter(Boolean).join(' ') || '—'}<div className="text-steel-500">{p.from.description}</div></td>
                          <td className="pr-3 font-mono">{p.newTag}</td>
                          <td className="pr-3">{p.to ? <>{p.to.manufacturer} <span className="font-mono">{p.to.partNumber}</span><div className="text-steel-500">{p.to.description}</div></> : <span className="text-steel-500">{p.reason}</span>}</td>
                          <td className="pr-3">{p.differences.join('; ') || (p.status === 'matched' ? 'Drop-in' : '')}</td>
                          <td className={p.status === 'to-select' ? 'text-amber-700' : 'text-steel-500'}>{STATUS_LABEL[p.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-steel-100 pt-3">
                  <button onClick={build} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700" data-testid="convert-build">
                    {applied ? 'Apply again and rebuild the design' : 'Use this and build the new design'}
                  </button>
                  <span className="text-xs text-steel-500">Replaces this project's description, I/O list and motors, then builds equipment, electrical design, HMI and PLC program for {regionSpec(conv.target.region).label}.</span>
                </div>
              </Step>
            </>
          )}

          {applied && conv && (
            <Step n={5} title="Function kept: everything the old machine did is in the new design" testid="convert-kept">
              <p className={`text-sm ${keptBad ? 'text-amber-800' : 'text-emerald-700'}`}>
                {kept.length - keptBad} of {kept.length} functions kept{keptBad ? `; ${keptBad} to fix or check (also listed in the Design review)` : ''}.
              </p>
              <table className="w-full text-xs">
                <thead><tr>{['', 'In the old machine', 'In the new design', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-steel-100">
                  {kept.map((k, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-3 text-steel-500">{k.kind === 'io' ? 'I/O' : k.kind}</td>
                      <td className="pr-3">{k.original}</td>
                      <td className="pr-3">{k.now}{k.note && <div className="text-steel-500">{k.note}</div>}</td>
                      <td className={KEPT[k.status]}>{KEPT_LABEL[k.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Step>
          )}
        </div>
      </div>
    </>
  );
}
