import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDraftStore } from '../../../store/useDraftStore';
import { useProgramStore } from '../../../store/useProgramStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { usePlc } from '../../core/usePlc';
import { diffPrograms, summarizeDiff, type RungChange } from '../../core/diff';
import type { LadderProgram } from '../../core/ladder';
import LadderView from '../../ui/ladder/LadderView';
import { collectProject } from '../../../deliverables/collect';
import { programFiles, saveBlob } from '../../../deliverables/files';
import { exportContext } from '../../../deliverables/exportContext';
import { useIOStore } from '../../../store/useIOStore';
import { UPGRADE_KEY } from '../upgrade';
import { exportUpgrade, upgradeChanges, type UpgradeExport } from '../exportUpgrade';
import { gunzipText } from '../gz';
import { programFindings } from '../findings';
import { upgradeOriginal } from './applyUpgrade';
import ProgramImport from './ProgramImport';
import { getProfile, PLC_PROFILES } from '../../core/profiles';
import { choosePlcBrand } from '../../core/choosePlc';
import { notify } from '../../../store/useNoticeStore';

/**
 * "Upgrade existing program" (Import → Program; /upgrade leads there): read the machine's program, then compare
 * the program now with the original and export it again (same PLC, original names; or the PLC chosen on the PLC
 * page). `embedded`: inside the Import page, without its own header.
 */
export default function UpgradePage({ embedded = false }: { embedded?: boolean }) {
  const original = useDraftStore((s) => upgradeOriginal(s.drafts));
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const ladder = useProgramStore((s) => s.ladder);
  const { profile, cpu, labels } = usePlc();
  const modules = useProjectStore((s) => s.modules);
  const io = useIOStore((s) => s.projectIO);
  const [all, setAll] = useState(false);
  // The download worked out for one version of the program: a later edit makes it stale (not shown).
  const [preparedFor, setPrepared] = useState<{ ex: UpgradeExport; ladder: LadderProgram; plcId: string } | null>(null);
  const prepared = preparedFor && preparedFor.ladder === ladder && preparedFor.plcId === profile.id ? preparedFor.ex : null;
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const changes = useMemo(() => (original ? upgradeChanges(original, io, ladder) : null), [original, io, ladder]);
  const findings = useMemo(() => programFindings(ladder, labels), [ladder, labels]);
  // A program kept read only on the machine's own PLC (the app cannot program it): no download until a PLC is chosen.
  const readOnly = Boolean(profile.readOnly);
  const fromReadOnly = Boolean(original && getProfile(original.plcId).readOnly && !readOnly);
  const moveTo = (plcId: string) => {
    const notes = choosePlcBrand(plcId);
    if (notes.length) notify(`The I/O was renumbered for the new PLC; the program and the HMI followed. ${notes.join(' ')}`);
  };

  const diff = useMemo(() => {
    if (!original) return null;
    const entries = diffPrograms(original.program, ladder);
    const shown = all ? entries : entries.filter((e) => e.change !== 'unchanged');
    const display: LadderProgram = { rungs: shown.map((e) => e.rung), tags: ladder.tags, blocks: ladder.blocks };
    return { entries, display, changes: new Map<string, RungChange>(entries.map((e) => [e.rung.id, e.change])), summary: summarizeDiff(entries) };
  }, [original, ladder, all]);

  /** Work out the download: written into the original file (same PLC), or new files with what they will not have. */
  const prepare = async () => {
    if (!original) return;
    setBusy(true);
    try {
      const file = original.fileGz ? await gunzipText(original.fileGz).catch(() => null) : null;
      // The PLC as it is now (a click right after changing the PLC may come before this page shows it).
      const plcId = useProjectStore.getState().plcId;
      const snap = collectProject();
      setPrepared({ ex: exportUpgrade(original, file, ladder, { plcId, ctx: exportContext(snap), fullFiles: () => programFiles(snap) }), ladder, plcId });
      setUnderstood(false);
    } finally { setBusy(false); }
  };
  const download = () => {
    if (!prepared) return;
    for (const f of prepared.files) saveBlob(f.name, new Blob([f.content], { type: 'text/plain' }));
    setPrepared(null);
  };

  const body = (
        <div className="max-w-5xl space-y-5">
          {!original || !diff ? (
            <ProgramImport />
          ) : (
            <>
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3" data-testid="upgrade-original">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800">Original: {original.source.projectName}</h3>
                    <p className="text-xs text-gray-500">{original.source.fileName} · {[original.source.vendor, original.source.controller].filter(Boolean).join(' ')} · read {new Date(original.importedAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-500" data-testid="upgrade-now-on">{original.report.converted} of {original.report.rungs} rungs converted · {readOnly
                      ? <>on the machine's {profile.vendor} {original.source.controller} (read only: not programmable here yet)</>
                      : <>now on {profile.vendor} {profile.name} {cpu.id}{fromReadOnly ? ` (moved from the machine's ${original.source.vendor} ${original.source.controller})` : ''}</>}</p>
                    {original.cpuNote && (readOnly || !fromReadOnly) && <p className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1" data-testid="upgrade-cpu-note">{original.cpuNote}</p>}
                    {fromReadOnly && <p className="mt-1 text-xs text-gray-600" data-testid="upgrade-cpu-note">The machine's {original.source.vendor} controller and modules{original.source.modules?.length ? ` (${original.source.modules.map((m) => m.catalog).join(', ')})` : ''} stay with the original. The app picked the {profile.name} modules{modules.length ? `: ${modules.join(', ')}` : ''}; check them on the PLC page before ordering parts.</p>}
                  </div>
                  <button
                    onClick={() => { if (window.confirm('Read another program? The comparison with this original is dropped; the project keeps its current program and I/O.')) clearDraft(UPGRADE_KEY); }}
                    className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
                  >Read another program</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/spec" className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700">Machine description and questions</Link>
                  <Link to="/io" className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700">I/O list</Link>
                  <Link to="/program" className="text-xs px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700">Change the program</Link>
                  <Link to="/simulate" className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700">Test it in the simulator</Link>
                  {!readOnly && <Link to="/plc" className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700">Move it to another PLC</Link>}
                </div>
              </div>

              {ladder.rungs.length > 0 && (
                <div className="bg-brand-50 rounded-lg border border-brand-200 p-4 flex flex-wrap items-center gap-3" data-testid="upgrade-simplify">
                  <div className="flex-1 min-w-[16rem]">
                    <h3 className="text-sm font-semibold text-gray-800">Next: simplify &amp; explain this program</h3>
                    <p className="text-xs text-gray-600">A note in plain words on every rung, dead code found, the rungs grouped by machine function. Every change is checked in the simulator and waits for your approval{readOnly ? '; the copy moved to the new PLC is the one simplified' : ''}.</p>
                  </div>
                  <Link to="/program?tidy=1" className="text-sm px-4 py-2 rounded bg-brand-600 text-white font-medium hover:bg-brand-700">Simplify &amp; explain this program</Link>
                </div>
              )}

              {readOnly && (
                <div className="bg-white rounded-lg border-2 border-brand-300 p-5 space-y-3" data-testid="upgrade-choose-plc">
                  <h3 className="text-sm font-semibold text-gray-800">Move it to another PLC: choose one</h3>
                  <p className="text-xs text-gray-600">The app cannot write {profile.vendor} files yet. Choose the PLC the machine will have: the I/O gets its addresses, the program and the HMI follow, the app picks its CPU and modules, and the download is made for it. Until then the program, the I/O list and the simulator work on the original's registers.</p>
                  <div className="flex flex-wrap gap-2">
                    {PLC_PROFILES.filter((p) => p.available).map((p) => (
                      <button key={p.id} data-testid={`upgrade-move-${p.id}`} onClick={() => moveTo(p.id)} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-700">{p.vendor} {p.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {findings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2" data-testid="upgrade-findings">
                  <h3 className="text-sm font-semibold text-amber-900">Possible problems in the program ({findings.length})</h3>
                  <ul className="list-disc ml-5 text-sm text-amber-900 space-y-1">
                    {findings.map((f) => <li key={`${f.kind}${f.rungId}${f.address}`}>{f.message} <Link to="/program" className="underline text-xs">Open the program</Link></li>)}
                  </ul>
                  <p className="text-xs text-amber-800">They are also asked on the Machine description page. Fix them in the program (or ask the AI there), then compare with the original below.</p>
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex-1">Original vs now: <span data-testid="upgrade-diff-summary">{diff.summary}</span></h3>
                  <label className="text-xs text-gray-600 flex items-center gap-1"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show unchanged rungs</label>
                  {readOnly
                    ? <span className="text-xs text-gray-500" data-testid="upgrade-export-wait">Download: choose the PLC to move it to first</span>
                    : <button data-testid="upgrade-export" onClick={() => void prepare()} disabled={!ladder.rungs.length || busy} className="text-xs px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Download for {profile.vendor} {profile.name}…</button>}
                </div>
                {prepared && (
                  <div className="border border-gray-200 rounded p-3 space-y-2 text-sm" data-testid="upgrade-prepared">
                    {prepared.mode === 'patch' ? (
                      <p data-testid="upgrade-mode-patch">Your changes go into a copy of your original file, <b>{prepared.files[0].name}</b>. {prepared.changed.length ? <>Rewritten: {prepared.changed.join(', ')}.</> : 'Nothing changed: it is your original file.'}{prepared.added.length ? <> New routines: {prepared.added.join(', ')}.</> : null}{prepared.newTags.length ? <> New tags: {prepared.newTags.join(', ')}.</> : null} {prepared.howTo}</p>
                    ) : (
                      <p>A new set of files for {profile.vendor} {profile.name}: {prepared.files.map((f) => f.name).join(', ')}.</p>
                    )}
                    {prepared.warnings.length > 0 && <ul className="text-xs text-gray-600 list-disc ml-5">{prepared.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
                    {prepared.missing.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded p-2 text-red-900" data-testid="upgrade-missing">
                        <p className="font-medium text-sm">These {prepared.missing.length} items will not be in the files:</p>
                        <ul className="list-disc ml-5 text-xs mt-1 space-y-0.5">{prepared.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
                        <label className="flex items-center gap-2 text-xs mt-2"><input data-testid="upgrade-understood" type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} /> I understand these {prepared.missing.length} items will be missing</label>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button data-testid="upgrade-download" onClick={download} disabled={prepared.missing.length > 0 && !understood} className="text-xs px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Download</button>
                      <button onClick={() => setPrepared(null)} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">Green: added · amber: changed · red: removed. The files keep the original tag names.</p>
                {changes && (changes.io.added.length + changes.io.removed.length + changes.io.renamed.length + changes.tags.added.length + changes.tags.removed.length + changes.tags.renamed.length + changes.blocksAdded.length > 0) && (
                  <div className="grid sm:grid-cols-3 gap-3 text-xs" data-testid="upgrade-other-changes">
                    <ChangeList title="I/O points" added={changes.io.added} removed={changes.io.removed} renamed={changes.io.renamed} />
                    <ChangeList title="Tags" added={changes.tags.added} removed={changes.tags.removed} renamed={changes.tags.renamed} />
                    <ChangeList title="Program parts added" added={changes.blocksAdded} removed={[]} renamed={[]} />
                  </div>
                )}
                {diff.display.rungs.length
                  ? <LadderView program={diff.display} labels={labels} changes={diff.changes} />
                  : <p className="text-sm text-gray-500">No changes yet. Open the program to change it, or ask the AI there.</p>}
              </div>
            </>
          )}
        </div>
  );
  if (embedded) return body;
  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Upgrade an existing program</h2>
        <p className="text-xs text-gray-400 mt-0.5">Bring in the program of a machine that already runs. The app builds the I/O list and a machine description from it; you fix and improve it here and load it back into the PLC.</p>
      </header>
      <div className="flex-1 overflow-auto bg-gray-50 p-6">{body}</div>
    </>
  );
}

function ChangeList({ title, added, removed, renamed }: { title: string; added: string[]; removed: string[]; renamed: { from: string; to: string }[] }) {
  if (!added.length && !removed.length && !renamed.length) return null;
  return (
    <div className="border border-gray-200 rounded p-2">
      <p className="font-medium text-gray-700 mb-1">{title}</p>
      <ul className="space-y-0.5">
        {added.map((a) => <li key={`a${a}`} className="text-green-800">+ {a}</li>)}
        {removed.map((a) => <li key={`r${a}`} className="text-red-800">− {a}</li>)}
        {renamed.map((r) => <li key={`n${r.from}`} className="text-amber-800">{r.from} → {r.to}</li>)}
      </ul>
    </div>
  );
}
