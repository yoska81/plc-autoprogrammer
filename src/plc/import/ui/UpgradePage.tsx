import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDraftStore } from '../../../store/useDraftStore';
import { useProgramStore } from '../../../store/useProgramStore';
import { usePlc } from '../../core/usePlc';
import { diffPrograms, summarizeDiff, type RungChange } from '../../core/diff';
import type { LadderProgram } from '../../core/ladder';
import LadderView from '../../ui/ladder/LadderView';
import { collectProject } from '../../../deliverables/collect';
import { programFiles, saveBlob } from '../../../deliverables/files';
import { UPGRADE_KEY } from '../upgrade';
import { upgradeOriginal } from './applyUpgrade';
import ProgramImport from './ProgramImport';

/**
 * /upgrade — "Upgrade existing program": read the machine's program, then compare the program now
 * with the original and export it again (same PLC, original names; or the PLC chosen on the PLC page).
 */
export default function UpgradePage() {
  const navigate = useNavigate();
  const original = useDraftStore((s) => upgradeOriginal(s.drafts));
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const ladder = useProgramStore((s) => s.ladder);
  const { profile, cpu, labels } = usePlc();
  const [all, setAll] = useState(false);

  const diff = useMemo(() => {
    if (!original) return null;
    const entries = diffPrograms(original.program, ladder);
    const shown = all ? entries : entries.filter((e) => e.change !== 'unchanged');
    const display: LadderProgram = { rungs: shown.map((e) => e.rung), tags: ladder.tags, blocks: ladder.blocks };
    return { entries, display, changes: new Map<string, RungChange>(entries.map((e) => [e.rung.id, e.change])), summary: summarizeDiff(entries) };
  }, [original, ladder, all]);

  const exportFiles = () => {
    for (const f of programFiles(collectProject())) saveBlob(f.name, new Blob([f.content], { type: 'text/plain' }));
  };

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">Upgrade an existing program</h2>
        <p className="text-xs text-gray-400 mt-0.5">Bring in the program of a machine that already runs. The app builds the I/O list and a machine description from it; you fix and improve it here and load it back into the PLC.</p>
      </header>
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-5xl space-y-5">
          {!original || !diff ? (
            <ProgramImport onApplied={() => navigate('/upgrade')} />
          ) : (
            <>
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3" data-testid="upgrade-original">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800">Original: {original.source.projectName}</h3>
                    <p className="text-xs text-gray-500">{original.source.fileName} · {[original.source.vendor, original.source.controller].filter(Boolean).join(' ')} · read {new Date(original.importedAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{original.report.converted} of {original.report.rungs} rungs converted · now on {profile.vendor} {profile.name} {cpu.id}</p>
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
                  <Link to="/plc" className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700">Move it to another PLC</Link>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex-1">Original vs now: <span data-testid="upgrade-diff-summary">{diff.summary}</span></h3>
                  <label className="text-xs text-gray-600 flex items-center gap-1"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show unchanged rungs</label>
                  <button data-testid="upgrade-export" onClick={exportFiles} disabled={!ladder.rungs.length} className="text-xs px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Download for {profile.vendor} {profile.name}</button>
                </div>
                <p className="text-xs text-gray-500">Green: added · amber: changed · red: removed. The files keep the original tag names.</p>
                {diff.display.rungs.length
                  ? <LadderView program={diff.display} labels={labels} changes={diff.changes} />
                  : <p className="text-sm text-gray-500">No changes yet. Open the program to change it, or ask the AI there.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
