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
import { readOnlyNote, UPGRADE_KEY } from '../upgrade';
import { exportUpgrade, upgradeChanges, type UpgradeExport } from '../exportUpgrade';
import { gunzipText } from '../gz';
import { programFindings } from '../findings';
import { removeUpload, upgradeOriginal } from './applyUpgrade';
import ProgramImport from './ProgramImport';
import { getProfile, PLC_PROFILES } from '../../core/profiles';
import { choosePlcBrand } from '../../core/choosePlc';
import { notify } from '../../../store/useNoticeStore';
import { useHmiStore } from '../../../store/useHmiStore';
import { remakeCoverageAll, remakeCoverageText, withServoPlaceholders } from '../remake';
import { recordConversion } from '../../tidy/changeLog';

/** A kept instruction in plain words ("1 call to another drawing"). */
function keptPhrase(what: string, n: number): string {
  const w = what.toUpperCase();
  const [one, many] = w === 'SEE' ? ['call to another drawing', 'calls to other drawings']
    : w === 'UNKNOWN INSTRUCTION' ? ["instruction the app can't read", "instructions the app can't read"]
      : w === 'JSR' || w === 'CALL' ? ['subroutine call', 'subroutine calls']
        : w === 'MSG' ? ['message (communication) instruction', 'message (communication) instructions']
          : w === 'SERVO REGISTER' ? ['rung that moves a servo axis (set the axis up on the new PLC)', 'rungs that move a servo axis (set the axes up on the new PLC)']
          : [`${what} instruction`, `${what} instructions`];
  return `${n} ${n === 1 ? one : many}`;
}

/** How much converts on one PLC, in plain words. */
function coverageText(c: { percent: number; converted: number; rungs: number; kept: { what: string; count: number }[]; errors: { message: string }[] }, withPercent: boolean): string {
  const parts = [`${c.converted} of ${c.rungs} rungs convert${withPercent ? ` (${c.percent}%)` : ''}`];
  if (c.kept.length) parts.push(`to redo by hand: ${c.kept.map((k) => keptPhrase(k.what, k.count)).join(', ')}`);
  if (c.errors.length) parts.push(`${c.errors.length} ${c.errors.length === 1 ? 'rung needs' : 'rungs need'} a fix for this PLC (${c.errors[0].message})`);
  return `${parts.join('; ')}.`;
}

/** A PLC's name on a button ("Generic Structured Text (any IEC PLC)" rather than the profile's vendor + name). */
const plcLabel = (id: string, label: string) => (id === 'generic-st' ? 'Generic Structured Text (any IEC PLC)' : label);

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
  // Delete the uploaded program (its confirm, and whether its I/O list goes too)
  const [deleting, setDeleting] = useState(false);
  const [deleteIo, setDeleteIo] = useState(true);
  const [busy, setBusy] = useState(false);
  const changes = useMemo(() => (original ? upgradeChanges(original, io, ladder) : null), [original, io, ladder]);
  const findings = useMemo(() => programFindings(ladder, labels), [ladder, labels]);
  // A program kept read only on the machine's own PLC (the app cannot program it): no download until a PLC is chosen.
  const readOnly = Boolean(profile.readOnly);
  const hmi = useHmiStore((s) => s.design);
  // Per target PLC, how much of the program converts (worked out without moving anything).
  const coverage = useMemo(() => (readOnly && ladder.rungs.length ? remakeCoverageAll({ io, plcId: profile.id, cpuId: cpu.id, modules, program: ladder, hmi }) : []), [readOnly, io, profile.id, cpu.id, modules, ladder, hmi]);
  // The coverage as text to share (counts and instruction kinds only): to the clipboard, and shown to select by hand.
  const [coverageShown, setCoverageShown] = useState('');
  const copyCoverage = async () => {
    const text = remakeCoverageText({ io, plcId: profile.id, cpuId: cpu.id, modules, program: ladder, hmi }, coverage);
    setCoverageShown(text);
    try { await navigator.clipboard.writeText(text); notify('Coverage numbers copied: paste them in a message.'); } catch { notify('Select the coverage numbers below and copy them.'); }
  };
  const fromReadOnly = Boolean(original && getProfile(original.plcId).readOnly && !readOnly);
  // "Also make a change report": with the move, the report of the session so far (the move included) is downloaded.
  const [moveReport, setMoveReport] = useState(false);
  // Servo axes the program drives through motion registers: a placeholder block each on the new PLC (no logic).
  const [servoBlocks, setServoBlocks] = useState(true);
  const moveTo = (plcId: string) => {
    const notes = recordConversion(plcId, () => {
      const n = choosePlcBrand(plcId);
      if (servoBlocks) {
        const axes = useProjectStore.getState().networkAxes ?? [];
        const { ladder: now, editLadder } = useProgramStore.getState();
        const next = withServoPlaceholders(now, plcId, (c, a) => axes.find((x) => x.circuit === c && x.axis === a)?.name || undefined);
        const added = next.rungs.length - now.rungs.length;
        if (added) { editLadder(next); n.push(`${added} servo axis placeholder block${added === 1 ? '' : 's'} added: set the axes up on the new PLC.`); }
      }
      return n;
    }, moveReport);
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
                    {original.cpuNote && (readOnly || !fromReadOnly) && <p className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1" data-testid="upgrade-cpu-note">{readOnly ? readOnlyNote(original.source, profile) : original.cpuNote}</p>}
                    {fromReadOnly && <p className="mt-1 text-xs text-gray-600" data-testid="upgrade-cpu-note">The machine's {original.source.vendor} controller and modules{original.source.modules?.length ? ` (${original.source.modules.map((m) => m.catalog).join(', ')})` : ''} stay with the original. The app picked the {profile.name} modules{modules.length ? `: ${modules.join(', ')}` : ''}; check them on the PLC page before ordering parts.</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => { if (window.confirm('Read another program? The comparison with this original is dropped; the project keeps its current program and I/O.')) clearDraft(UPGRADE_KEY); }}
                      className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700"
                    >Read another program</button>
                    <button onClick={() => { setDeleting(true); setDeleteIo(true); }} data-testid="upload-delete"
                      className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50">Delete this program</button>
                  </div>
                </div>
                {deleting && (
                  <div role="alertdialog" aria-label="Delete the uploaded program" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-2" data-testid="upload-delete-confirm">
                    <p className="font-semibold">Delete {original.source.fileName} from this project?</p>
                    <p className="text-xs">The program it put in ({ladder.rungs.length} rungs) is removed and kept in History (you can bring it back from there); the original kept for the comparison and its file are deleted. The PLC choice, the machine description and the drawings stay.</p>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={deleteIo} onChange={(e) => setDeleteIo(e.target.checked)} data-testid="upload-delete-io" />Also clear the I/O list it filled in ({io.length} points)</label>
                    <div className="flex gap-2">
                      <button onClick={() => { const { plcReset } = removeUpload({ io: deleteIo }); setDeleting(false); notify(`${original.source.fileName} deleted from the project${deleteIo ? ', with its I/O list' : ''}. Its program is in History.${plcReset ? ` The PLC is back to ${getProfile(useProjectStore.getState().plcId).name} (the app only reads ${plcReset}): choose another on PLC Setup.` : ''}`); }} data-testid="upload-delete-yes"
                        className="text-xs px-3 py-1.5 rounded bg-red-600 text-white font-medium hover:bg-red-700">Delete it</button>
                      <button onClick={() => setDeleting(false)} className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">Cancel</button>
                    </div>
                  </div>
                )}
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
                    <p className="text-xs text-gray-600">Adds a plain-words note to every rung, finds the parts of the program that do nothing, and puts the rest in a clear order. Every change is tried in the simulator first and waits for your approval{readOnly ? '; the copy for the new PLC is the one simplified, the original stays as it is' : ''}.</p>
                  </div>
                  <Link to="/program?tidy=1" className="text-sm px-4 py-2 rounded bg-brand-600 text-white font-medium hover:bg-brand-700">Simplify &amp; explain this program</Link>
                </div>
              )}

              {readOnly && (
                <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3" data-testid="upgrade-choose-plc">
                  <h3 className="text-sm font-semibold text-gray-800">Remake it for another PLC: choose one</h3>
                  <p className="text-xs text-gray-600">The app cannot write {profile.vendor} files yet, so choose the PLC the machine will get. The I/O gets that PLC's addresses, the program and the screens follow, and the app picks its CPU and modules. Until you choose, everything keeps working on the original's registers.</p>
                  {coverage.length > 0 ? (() => {
                    // The same result on every PLC: said once, then just the buttons.
                    const key = (c: (typeof coverage)[number]) => JSON.stringify([c.converted, c.rungs, c.kept, c.errors.length]);
                    const same = coverage.every((c) => key(c) === key(coverage[0]));
                    return (
                      <>
                        {same && <p className="text-xs text-gray-700" data-testid="upgrade-remake-same">On every PLC: {coverageText(coverage[0], false)}</p>}
                        <ul className={same ? 'flex flex-wrap gap-2' : 'space-y-1.5'} data-testid="upgrade-remake">
                          {coverage.map((c) => (
                            <li key={c.plcId} className="flex flex-wrap items-center gap-2 text-xs" data-testid={`upgrade-remake-${c.plcId}`}>
                              <button data-testid={`upgrade-move-${c.plcId}`} onClick={() => moveTo(c.plcId)} className="px-3 py-1.5 rounded border border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-700 font-medium">Remake for {plcLabel(c.plcId, c.label)}</button>
                              {!same && <span className={c.percent === 100 ? 'text-green-700' : 'text-gray-700'}>{coverageText(c, true)}</span>}
                            </li>
                          ))}
                        </ul>
                        {coverage.some((c) => c.motion.length > 0) && (
                          <label className="flex items-center gap-1.5 text-xs text-gray-700" data-testid="upgrade-remake-servo">
                            <input type="checkbox" checked={servoBlocks} onChange={(e) => setServoBlocks(e.target.checked)} />
                            Add a placeholder block per servo axis (no logic: what to set up on the new PLC, with the axis's tags)
                          </label>
                        )}
                        <label className="flex items-center gap-2 text-xs text-gray-700">
                          <input type="checkbox" data-testid="upgrade-remake-report" checked={moveReport} onChange={(e) => setMoveReport(e.target.checked)} />
                          Also make a change report (PDF and Word) with the move
                        </label>
                        <p className="text-xs text-gray-500">
                          <button data-testid="upgrade-remake-copy" onClick={() => void copyCoverage()} className="underline hover:text-brand-700">Copy coverage numbers</button>
                          {' '}(counts only, no names or values: paste them in a message to help improve the conversion)
                        </p>
                        {coverageShown && <textarea readOnly data-testid="upgrade-remake-text" value={coverageShown} onFocus={(e) => e.currentTarget.select()} className="w-full h-28 text-xs font-mono border border-gray-200 rounded p-2" />}
                      </>
                    );
                  })() : (
                    <div className="flex flex-wrap gap-2">
                      {PLC_PROFILES.filter((p) => p.available).map((p) => (
                        <button key={p.id} data-testid={`upgrade-move-${p.id}`} onClick={() => moveTo(p.id)} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:border-brand-400 hover:bg-brand-50 text-gray-700">{p.vendor} {p.name}</button>
                      ))}
                    </div>
                  )}
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
