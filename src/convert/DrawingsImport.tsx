import { useMemo, useState } from 'react';
import { create } from 'zustand';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/common';
import { useSettingsStore } from '../store/useSettingsStore';
import { useProjectStore } from '../store/useProjectStore';
import { useProjectsStore } from '../store/useProjectsStore';
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
import { deriveFromUpload, MAX_UPLOAD_FILES, UPLOAD_ACCEPT } from './derive';
import { convertMachine, type ConvertTarget, type PartMatch } from './convert';
import { applyExistingMachine, MACHINE_KEY } from './apply';
import { functionKept, type KeptStatus } from './functionKept';
import { EMPTY_REVIEW, itemKey, reviewedMachine, unconfirmed, type ReviewKind, type ReviewState } from './review';
import type { ExistingMachine } from './types';

interface ReadResult { machine: ExistingMachine; reasoning: string | null; at: string; files: string[] }

/** Files chosen for upload, per project and in memory only: they never follow the user into another project. */
const useUploadFiles = create<{ byProject: Record<string, File[]>; set: (projectId: string, files: File[]) => void }>((set) => ({
  byProject: {},
  set: (projectId, files) => set((s) => ({ byProject: { ...s.byProject, [projectId]: files } })),
}));
const NO_FILES: File[] = [];

const th = 'text-left py-1.5 pr-3 font-medium text-steel-500';
const card = 'rounded-sm border border-steel-200 bg-white p-4 space-y-3';
const cell = 'w-full rounded-sm border border-transparent bg-transparent px-1 py-0.5 hover:border-steel-300 focus:border-brand-500 focus:bg-white focus:outline-none';
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
 * Import → Drawings: the user uploads an existing machine's electrical drawings; the app reads them, the
 * user reviews every reading (source, confidence, confirm / correct / leave out), the app writes the
 * machine description, converts every part to the target standard, rebuilds the design with the existing
 * engine and checks that every original function is kept.
 */
export default function DrawingsImport() {
  const settings = useSettingsStore();
  const apiKey = settings.provider === 'anthropic' ? settings.anthropicApiKey : '';
  const info = useProjectStore((s) => s.info);
  const projectId = useProjectsStore((s) => s.activeId) ?? 'default';
  const supply = useElectricalStore((s) => s.inputs.supply);
  const design = useElectricalStore((s) => s.design);
  const io = useIOStore((s) => s.projectIO);
  const sections = useSpecStore((s) => s.sections);
  const openQuestions = useQuestions('drawings').filter((q) => q.status === 'open');
  const files = useUploadFiles((s) => s.byProject[projectId]) ?? NO_FILES;
  const setFiles = (f: File[]) => useUploadFiles.getState().set(projectId, f);
  const [note, setNote] = useDraft('convert.note', '');
  const [read, setRead] = useDraft<ReadResult | null>('convert.read', null);
  const [review, setReview] = useDraft<ReviewState>('convert.review', EMPTY_REVIEW);
  const [applied] = useDraft<ExistingMachine | null>(MACHINE_KEY, null);
  const busy = useAiJobRunning('convert');
  const error = useAiJobError('convert');
  useTakeResult<ReadResult>('convert', (r) => { setRead(r); setReview(EMPTY_REVIEW); });
  const [fileError, setFileError] = useState<string | null>(null);

  const target: ConvertTarget = { region: info.region, supply, controlVolts: '24VDC' };
  const raw = read?.machine ?? applied;
  const reviewed = useMemo(() => (raw ? reviewedMachine(raw, review) : null), [raw, review]);
  const machine = reviewed?.machine ?? null;
  const conv = useMemo(() => (machine ? convertMachine(machine, target) : null), [machine, target.region, target.supply]); // eslint-disable-line react-hooks/exhaustive-deps
  // Recomputed when the design, the I/O or the description change.
  const kept = useMemo(() => (applied && conv ? functionKept(applied, convertMachine(applied, target), collectProject()) : []), [applied, conv, design, io, sections]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const toggle = (key: string, list: 'excluded' | 'confirmed') => setReview((r) => ({ ...r, [list]: r[list].includes(key) ? r[list].filter((k) => k !== key) : [...r[list], key] }));
  const confirm = (key: string) => setReview((r) => (r.confirmed.includes(key) ? r : { ...r, confirmed: [...r.confirmed, key] }));
  /** A correction: change the reading and mark it confirmed. */
  const correct = (kind: ReviewKind, id: string, patch: (m: ExistingMachine) => ExistingMachine, key = itemKey(kind, id)) => {
    if (!read) return;
    setRead({ ...read, machine: patch(read.machine) });
    confirm(key);
  };
  const build = () => {
    if (!raw || !reviewed) return;
    applyExistingMachine(reviewed.machine, convertMachine(reviewed.machine, target), reviewed.questions);
    // The original I/O stays as read: the engine builds equipment, panel, HMI and program around it.
    void runStages(['equipment', 'electrical', 'hmi', 'program'], 'Building the converted design');
  };

  const filled = machine ? SPEC_SECTIONS.filter((s) => machine.spec[s.id]) : [];
  const counts = conv ? { matched: conv.parts.filter((p) => p.status === 'matched').length, engine: conv.parts.filter((p) => p.status === 'engine').length, select: conv.parts.filter((p) => p.status === 'to-select').length } : null;
  const keptBad = kept.filter((k) => k.status !== 'kept').length;
  const toConfirm = raw ? unconfirmed(raw, review).length : 0;
  const allKeys = raw ? [...raw.io.map((p) => itemKey('io', p.address)), ...raw.components.map((c) => itemKey('part', c.tag)), ...raw.motors.map((m) => itemKey('motor', m.tag)), ...raw.axes.map((a) => itemKey('axis', a.tag))] : [];

  const Mark = ({ k, confidence }: { k: string; confidence: 'high' | 'medium' | 'low' }) => {
    const out = review.excluded.includes(k);
    const ok = review.confirmed.includes(k);
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className={`rounded px-1.5 ${CONF[confidence]}`} title="How sure the reading is">{confidence}</span>
        {ok ? <span className="text-emerald-700" title="Confirmed">✓</span>
          : !out && <button type="button" onClick={() => confirm(k)} className="text-brand-700 hover:underline" aria-label={`Confirm ${k}`}>Confirm</button>}
        <label className="flex items-center gap-1 text-steel-500" title="Leave this out of the conversion"><input type="checkbox" checked={!out} onChange={() => toggle(k, 'excluded')} aria-label={`Use ${k}`} />use</label>
      </span>
    );
  };

  return (
    <div className="max-w-6xl space-y-4">
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

      {raw && machine && conv && (
        <>
          <Step n={2} title="Review what was read" testid="convert-recognised">
            <p className="text-sm text-steel-700">{raw.summary}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
              <div><dt className="text-xs text-steel-500">Drawings</dt><dd>{raw.drawingStandard} · {raw.language || '—'}</dd></div>
              <div><dt className="text-xs text-steel-500">Supply as drawn</dt><dd>{raw.supplyDrawn.text || '—'}</dd></div>
              <div><dt className="text-xs text-steel-500">PLC</dt><dd>{raw.plc ? `${raw.plc.vendor} ${raw.plc.model}` : '—'}</dd></div>
              <div><dt className="text-xs text-steel-500">Found</dt><dd>{raw.io.length} I/O · {raw.components.length} parts · {raw.motors.length} motors{raw.axes.length ? ` · ${raw.axes.length} servo axis` : ''}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center gap-3 rounded border border-steel-200 bg-steel-50 p-2 text-xs text-steel-700" data-testid="review-status">
              <span>Check each reading against the drawing (sheet and place shown), correct it in the table or leave it out. {toConfirm ? <b className="text-red-700">{toConfirm} low-confidence reading{toConfirm === 1 ? '' : 's'} not confirmed: they become questions on the Machine description page.</b> : 'Every low-confidence reading is confirmed or left out.'}</span>
              <button type="button" onClick={() => setReview((r) => ({ ...r, confirmed: [...new Set([...r.confirmed, ...allKeys])] }))} className="ml-auto rounded border border-steel-300 bg-white px-2 py-0.5 hover:bg-steel-100">Confirm all readings</button>
            </div>
            <details open>
              <summary className="cursor-pointer text-xs font-medium text-brand-700">I/O ({raw.io.length})</summary>
              <table className="mt-2 w-full text-xs" data-testid="review-io">
                <thead><tr>{['Address', 'Function', 'Device', 'Read from', 'Reading'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-steel-100">
                  {raw.io.map((p) => {
                    const k = itemKey('io', p.address);
                    return (
                      <tr key={k} className={review.excluded.includes(k) ? 'opacity-40' : ''}>
                        <td className="w-20 py-0.5 pr-2 font-mono">{p.address}</td>
                        <td className="pr-2"><input defaultValue={p.description} aria-label={`Function of ${p.address}`} className={cell}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.description) correct('io', p.address, (m) => ({ ...m, io: m.io.map((x) => (x.address === p.address ? { ...x, description: v } : x)) })); }} /></td>
                        <td className="whitespace-nowrap pr-2">{p.deviceTag ?? ''} {p.deviceType}</td>
                        <td className="pr-2 text-steel-500">{p.source}</td>
                        <td><Mark k={k} confidence={p.confidence} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
            <details open>
              <summary className="cursor-pointer text-xs font-medium text-brand-700">Parts ({raw.components.length})</summary>
              <table className="mt-2 w-full text-xs" data-testid="review-parts">
                <thead><tr>{['Tag', 'Part number', 'Maker', 'What it is', 'Read from', 'Reading'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-steel-100">
                  {raw.components.map((c) => {
                    const k = itemKey('part', c.tag);
                    return (
                      <tr key={k} className={review.excluded.includes(k) ? 'opacity-40' : ''}>
                        <td className="w-14 py-0.5 pr-2 font-mono">{c.tag}</td>
                        <td className="w-48 pr-2"><input defaultValue={c.partNumber ?? ''} aria-label={`Part number of ${c.tag}`} className={`${cell} font-mono`}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (c.partNumber ?? '')) correct('part', c.tag, (m) => ({ ...m, components: m.components.map((x) => (x.tag === c.tag ? { ...x, partNumber: v || null } : x)) })); }} /></td>
                        <td className="pr-2">{c.manufacturer ?? ''}</td>
                        <td className="pr-2">{c.description}</td>
                        <td className="pr-2 text-steel-500">{c.source}</td>
                        <td><Mark k={k} confidence={c.confidence} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
            {raw.motors.length > 0 && (
              <table className="w-full text-xs" data-testid="review-motors">
                <thead><tr>{['Motor', 'Drives', 'kW', 'Starter', 'Read from', 'Reading'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-steel-100">
                  {raw.motors.map((x) => {
                    const k = itemKey('motor', x.tag);
                    return (
                      <tr key={k} className={review.excluded.includes(k) ? 'opacity-40' : ''}>
                        <td className="w-14 py-0.5 pr-2 font-mono">{x.tag}</td>
                        <td className="pr-2">{x.description}</td>
                        <td className="w-20 pr-2"><input defaultValue={x.kw ?? ''} inputMode="decimal" aria-label={`kW of ${x.tag}`} className={cell}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v !== x.kw) correct('motor', x.tag, (m) => ({ ...m, motors: m.motors.map((y) => (y.tag === x.tag ? { ...y, kw: v, hp: null } : y)) })); }} /></td>
                        <td className="pr-2">{x.starter ?? '—'}{x.reversing ? ', reversing' : ''}</td>
                        <td className="pr-2 text-steel-500">{x.source}</td>
                        <td><Mark k={k} confidence={x.confidence} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {raw.axes.length > 0 && (
              <table className="w-full text-xs" data-testid="review-axes">
                <thead><tr>{['Axis', 'What it does', 'Drive', 'Servo motor', 'Feedback / braking', 'Read from', 'Reading'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-steel-100">
                  {raw.axes.map((a) => {
                    const k = itemKey('axis', a.tag);
                    return (
                      <tr key={k} className={review.excluded.includes(k) ? 'opacity-40' : ''}>
                        <td className="w-14 py-0.5 pr-2 font-mono">{a.tag}</td>
                        <td className="pr-2">{a.description}<div className="text-steel-500">{a.signals.join(' · ')}</div></td>
                        <td className="pr-2">{a.driveTag}{a.drivePart ? ` ${a.drivePart}` : ''}</td>
                        <td className="pr-2">{a.motorTag} {a.motorKw ? `${a.motorKw} kW` : ''}</td>
                        <td className="pr-2">{[a.encoder, a.brakingResistor && `braking resistor ${a.brakingResistor}`].filter(Boolean).join(', ') || '—'}</td>
                        <td className="pr-2 text-steel-500">{a.source}</td>
                        <td><Mark k={k} confidence={a.confidence} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {raw.controller !== 'plc' && <p className="text-sm"><b>Control:</b> no PLC — {raw.controller === 'servo-drive' ? 'the servo drive\'s built-in controller (with the touch panel) runs the machine' : raw.controller === 'relays' ? 'relay logic' : 'its own controller'}.</p>}
            {raw.interlocks.length > 0 && <div className="text-sm"><b>Interlocks:</b><ul className="list-disc pl-5">{raw.interlocks.map((i) => <li key={i.description}>{i.description}</li>)}</ul></div>}
            <p className="text-sm"><b>Safety:</b> {raw.safety.description || '—'} {raw.safety.kind === 'control-only' && <span className="rounded bg-red-100 px-1.5 text-xs text-red-800" data-testid="not-safety-circuit">not a safety circuit</span>} <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">re-validate after the conversion</span></p>
            {raw.uncertainties.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><b>Check on the machine:</b><ul className="list-disc pl-5">{raw.uncertainties.map((u) => <li key={u}>{u}</li>)}</ul></div>}
          </Step>

          <Step n={3} title="The machine description (written from the drawings)" testid="convert-description">
            <p className="text-xs text-steel-500">{filled.length} of {SPEC_SECTIONS.length} sections written. {raw.questions.length + conv.questions.length + reviewed!.questions.length} question{raw.questions.length + conv.questions.length + reviewed!.questions.length === 1 ? '' : 's'} for what the drawings don't tell{applied ? <> are on the <Link to="/spec" className="underline">Machine description</Link> page</> : ' go to the Machine description page when you use this'}.</p>
            <div className="grid gap-2 md:grid-cols-2">
              {filled.map((s) => <div key={s.id} className="rounded border border-steel-100 p-2"><div className="text-xs font-semibold text-steel-600">{s.title}</div><p className="whitespace-pre-line text-sm text-steel-800">{machine.spec[s.id]}</p></div>)}
            </div>
            {applied && openQuestions.length > 0 && <p className="text-sm text-amber-800">{openQuestions.length} open question{openQuestions.length === 1 ? '' : 's'}: <Link to="/spec" className="underline">answer on the Machine description page</Link>.</p>}
          </Step>

          <Step n={4} title={`Conversion to ${regionSpec(conv.target.region).label}`} testid="convert-table">
            <p className="text-sm text-steel-700">{conv.supplyNote}</p>
            {conv.motors.length > 0 && <p className="text-sm">{conv.motors.map((m, i) => `${m.tag}: ${conv.motorKw[i].kw ? `${conv.motorKw[i].kw} kW → ` : ''}${m.hp} HP ${m.voltage.replace('VAC-3PH', ' V')}`).join(' · ')}</p>}
            {conv.recommendations.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900" data-testid="convert-recommendations"><b>The new design adds:</b><ul className="list-disc pl-5">{conv.recommendations.map((r) => <li key={r.text}>{r.text}</li>)}</ul></div>
            )}
            {counts && <p className="text-xs text-steel-500">{counts.matched} parts with an equivalent, {counts.engine} chosen by the design (operator devices, sensors, PLC, overloads set for the new motor current){counts.select ? `, ${counts.select} to select` : ''}.</p>}
            <p className="text-xs text-steel-500">Equivalents carry only their makers' own listings. The converted panel is not certified by this: it needs its own UL 508A listing (or a field evaluation), and every safety function is re-validated.</p>
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
              <span className="text-xs text-steel-500">Replaces this project's description, I/O list and motors with the reviewed reading, then builds equipment, electrical design, HMI and PLC program for {regionSpec(conv.target.region).label}.</span>
            </div>
          </Step>
        </>
      )}

      {applied && kept.length > 0 && (
        <Step n={5} title="Function kept: everything the old machine did is in the new design" testid="convert-kept">
          <p className={`text-sm ${keptBad ? 'text-amber-800' : 'text-emerald-700'}`}>
            {kept.length - keptBad} of {kept.length} functions kept{keptBad ? `; ${keptBad} to fix or check (also listed in the Design review)` : ''}. Safety functions are kept by the redesign and must be re-validated.
          </p>
          <table className="w-full text-xs">
            <thead><tr>{['', 'In the old machine', 'In the new design', ''].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-steel-100">
              {kept.map((k, i) => (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-3 text-steel-500">{k.kind === 'io' ? 'I/O' : k.kind === 'axis' ? 'servo axis' : k.kind}</td>
                  <td className="pr-3">{k.original}</td>
                  <td className="pr-3">{k.now}{k.note && <div className="text-steel-500">{k.note}</div>}</td>
                  <td className="whitespace-nowrap"><span className={KEPT[k.status]}>{KEPT_LABEL[k.status]}</span>{k.revalidate && <span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-900">re-validate</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Step>
      )}
    </div>
  );
}
