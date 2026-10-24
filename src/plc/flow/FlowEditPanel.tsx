/**
 * Editing from the flow diagram (beside the selected box): the step's own tools (rename, add a step after, delete),
 * the rung's (add one after, delete, move), the real ladder editor for the rungs of the box (the diagram redraws from
 * it), the AI asked to change this function (its proposal shown in plain words, approved or rejected), and every
 * change made here since the page opened, in plain words. Undo / Redo as in the ladder editor (Ctrl+Z / Ctrl+Y).
 */
import { useMemo, useRef, useState } from 'react';
import { useProgramStore } from '../../store/useProgramStore';
import { useSettingsStore, activeCredentials } from '../../store/useSettingsStore';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useActiveHmiDesign } from '../../hmi/projectPanel';
import { startAiJob } from '../../lib/ai/jobs';
import { usePlc } from '../core/usePlc';
import { nativeName } from '../core/addressCheck';
import type { LadderProgram, Rung } from '../core/ladder';
import { changeScope, reviseLadder, type AIConfig } from '../ai/ladderAI';
import { GENERAL_BLOCK, scopeToBlock } from '../sim/blocks';
import LadderView from '../ui/ladder/LadderView';
import { deleteRung, insertRung, moveRung } from '../ui/ladder/ladderEdit';
import { useLadderHistory } from '../ui/program/workspaceView';
import type { AddressChoice } from '../ui/ladder/ElementEditor';
import { addStepAfter, deleteStep, flowChanges, mergeRungs, registerOf, renameStep, type FlowChange } from './flowEdit';
import type { FlowDiagram, FlowNode, NameOf } from './flowModel';

const btn = 'rounded border border-steel-300 bg-white px-2 py-1 text-xs text-steel-700 hover:bg-steel-50 disabled:opacity-40';

export function ChangeList({ changes, testId }: { changes: FlowChange[]; testId: string }) {
  if (!changes.length) return <p className="text-xs text-steel-500" data-testid={testId}>No changes.</p>;
  return (
    <ul className="space-y-2 text-xs" data-testid={testId}>
      {changes.map((c) => (
        <li key={`${c.kind}:${c.rungId}`} className={`rounded border p-2 ${c.kind === 'added' ? 'border-emerald-300 bg-emerald-50' : c.kind === 'removed' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
          <p className="font-semibold">{c.kind === 'added' ? 'Added' : c.kind === 'removed' ? 'Removed' : 'Changed'}: {c.title}</p>
          <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <pre className="whitespace-pre-wrap text-steel-500">{c.before.length ? c.before.join('\n') : '—'}</pre>
            <pre className="whitespace-pre-wrap text-steel-900">{c.after.length ? c.after.join('\n') : '—'}</pre>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function FlowEditPanel({ d, n, nameOf, onFocus }: {
  d: FlowDiagram; n: FlowNode | null; nameOf: NameOf;
  /** After an edit: the rung to show (a new step, a new rung). */
  onFocus: (rungId: string | null) => void;
}) {
  const store = useProgramStore();
  const { ladder, editLadder, isGenerating, proposal } = store;
  const set = (p: LadderProgram) => { if (!useProgramStore.getState().isGenerating) editLadder(p); };
  const history = useLadderHistory(ladder, set);
  // the program as the panel opened, for "changes made here"
  const [baseline] = useState(ladder);
  const saved = useRef(false);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState(n?.kind === 'step' ? n.title.replace(/^\d+\s*·\s*/, '') : '');
  const [ask, setAsk] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { profile, cpu, io, addresses, labels, modules } = usePlc();
  const settings = useSettingsStore();
  const wiring = useElectricalStore((s) => s.design?.ioWiring);
  const hmi = useActiveHmiDesign();
  const { apiKey, model } = activeCredentials(settings);
  const ai: AIConfig = { provider: settings.provider, apiKey, model, effort: settings.effort };

  const edit = (p: LadderProgram, message?: string) => {
    if (!saved.current) { store.saveVersion('Before edits in Program flow'); saved.current = true; }
    history.edit(p);
    setNote(message ?? null); setError(null);
  };
  const result = (r: { program: LadderProgram; message: string; focusRung?: string } | { error: string }) => {
    if ('error' in r) { setError(r.error); return; }
    edit(r.program, r.message);
    onFocus(r.focusRung ?? null);
  };

  const ids = useMemo(() => (n ? n.rungIds : [...new Set(d.nodes.flatMap((x) => x.rungIds))]), [d, n]);
  const rungs = useMemo(() => ladder.rungs.filter((r) => ids.includes(r.id)), [ladder, ids]);
  const numberOf = useMemo(() => { const m = new Map(ladder.rungs.map((r, i) => [r.id, i + 1])); return (id: string) => m.get(id) ?? 0; }, [ladder]);
  const choices: AddressChoice[] = useMemo(() => {
    const rack = { profile, cpu, modules };
    return [...labels].map(([address, label]) => ({ address, label, native: nativeName(rack, address), kind: profile.parseAddress(address)?.kind ?? (/^X\d/.test(address) ? 'input' : /^Y\d/.test(address) ? 'output' : undefined) }));
  }, [labels, profile, cpu, modules]);
  const reg = registerOf(ladder, d.id || undefined);
  const block = d.id || undefined;
  const changes = useMemo(() => flowChanges(baseline, ladder, nameOf), [baseline, ladder, nameOf]);
  const proposed = useMemo(() => (proposal ? flowChanges(ladder, proposal.program, nameOf) : []), [proposal, ladder, nameOf]);

  const rungTool = n && n.kind !== 'step' ? n.rungIds[0] : null;
  const addRungAfter = () => {
    const after = rungTool ?? rungs.at(-1)?.id ?? null;
    const r = insertRung(ladder, after, 'below');
    const p = { ...r.program, rungs: r.program.rungs.map((x: Rung) => (x.id === r.id ? { ...x, block, comment: 'New rung: say what it does' } : x)) };
    edit(p, 'A new rung added: set its conditions and outputs in the ladder below.');
    onFocus(r.id);
  };

  // the AI: this function only (a big program is sent block by block), its answer as a proposal to approve
  const askAi = () => {
    const req = ask.trim();
    if (!req || !apiKey || isGenerating || proposal) return;
    const ctx = { profile, cpu, io, addresses, wiring: new Map((wiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }])), hmi: hmi ?? undefined };
    const scopeId = d.id || GENERAL_BLOCK;
    const scope = changeScope(ladder, ctx, scopeId, d.name);
    if ('tooBig' in scope) { setError(scope.tooBig); return; }
    const text = `[Block: ${d.name}${d.id ? ` (id "${d.id}")` : ''}] ${req}`;
    store.addChat({ role: 'user', text });
    setAsk(''); setError(null);
    void startAiJob({
      kind: 'program-revise', label: `Change ${d.name}`,
      run: async (h) => {
        useProgramStore.getState().setIsGenerating(true);
        try { return await reviseLadder({ ...ai, signal: h.signal }, scope.ctx, scope.program, [], [], text); } finally { useProgramStore.getState().setIsGenerating(false); }
      },
      apply: (r) => {
        const st = useProgramStore.getState();
        if (!r.program) { st.addChat({ role: 'assistant', text: r.explanation, outcome: 'no-change' }); setError(r.explanation || 'The AI made no change.'); return; }
        const scoped = scopeToBlock(st.ladder, r.program, scopeId, scope.part);
        st.addChat({ role: 'assistant', text: r.explanation });
        st.setProposal({ program: scoped.program, explanation: r.explanation, reasoning: r.reasoning });
      },
    });
  };

  return (
    <div className="space-y-3" data-testid="flow-edit">
      {n?.kind === 'step' && reg && n.step !== undefined && (
        <div className="space-y-1" data-testid="flow-step-tools">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-steel-400">Step {n.step}</p>
          <div className="flex gap-1">
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Step name" data-testid="flow-step-name" className="min-w-0 flex-1 rounded border border-steel-300 px-2 py-1 text-xs" />
            <button type="button" className={btn} disabled={!name.trim()} onClick={() => result(renameStep(ladder, reg, n.step!, name))}>Rename</button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" className={btn} data-testid="flow-add-step" onClick={() => result(addStepAfter(ladder, reg, n.step!, 'New step'))}>Add a step after</button>
            <button type="button" className={btn} data-testid="flow-delete-step" onClick={() => { if (confirm(`Delete step ${n.step}? The steps that go to it go on to where it went.`)) result(deleteStep(ladder, reg, n.step!)); }}>Delete this step</button>
          </div>
        </div>
      )}
      {(!n || n.kind !== 'step') && (
        <div className="flex flex-wrap gap-1" data-testid="flow-rung-tools">
          <button type="button" className={btn} data-testid="flow-add-rung" onClick={addRungAfter}>Add a rung after</button>
          {rungTool && <>
            <button type="button" className={btn} onClick={() => edit(moveRung(ladder, rungTool, -1))}>Move up</button>
            <button type="button" className={btn} onClick={() => edit(moveRung(ladder, rungTool, 1))}>Move down</button>
            <button type="button" className={btn} data-testid="flow-delete-rung" onClick={() => { if (confirm('Delete this rung?')) { edit(deleteRung(ladder, rungTool), 'Rung deleted.'); onFocus(null); } }}>Delete this rung</button>
          </>}
        </div>
      )}
      <div className="flex gap-1">
        <button type="button" className={btn} disabled={!history.canUndo} onClick={history.undo} data-testid="flow-undo">Undo</button>
        <button type="button" className={btn} disabled={!history.canRedo} onClick={history.redo}>Redo</button>
      </div>
      {note && <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-900" data-testid="flow-edit-note">{note}</p>}
      {error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-900" role="alert">{error}</p>}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-steel-400">Edit in ladder (click a symbol)</p>
        <div className="mt-1" data-testid="flow-ladder-edit">
          {rungs.length
            ? <LadderView program={{ ...ladder, rungs }} onChange={isGenerating ? undefined : (p) => edit(mergeRungs(ladder, ids, p.rungs))} numberOf={numberOf} labels={labels} choices={choices} editTools />
            : <p className="text-xs text-steel-500">No rung here.</p>}
        </div>
      </div>

      <div className="space-y-1 rounded border border-steel-200 p-2" data-testid="flow-ai">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-steel-400">Ask the AI to change {d.name}</p>
        <textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={2} placeholder="e.g. after the push, wait 1 second before retracting" aria-label="Ask the AI" data-testid="flow-ai-ask" className="w-full rounded border border-steel-300 px-2 py-1 text-xs" />
        <button type="button" className={btn} disabled={!apiKey || !ask.trim() || isGenerating || Boolean(proposal)} onClick={askAi} data-testid="flow-ai-send">{isGenerating ? 'The AI is working…' : 'Ask the AI'}</button>
        {!apiKey && <p className="text-[11px] text-steel-500">Add your AI key in Settings to ask the AI.</p>}
        {proposal && (
          <div className="space-y-1" data-testid="flow-proposal">
            <p className="text-xs font-semibold">The AI proposes ({proposed.length} change{proposed.length === 1 ? '' : 's'}). Nothing is changed until you approve.</p>
            <ChangeList changes={proposed} testId="flow-proposal-changes" />
            <div className="flex gap-1">
              <button type="button" className="rounded bg-brand-600 px-2 py-1 text-xs font-semibold text-white" data-testid="flow-approve" onClick={() => { store.applyProposal(); setNote('The AI\'s change is in the program (the version before it is in History).'); }}>Approve</button>
              <button type="button" className={btn} onClick={store.rejectProposal}>Reject</button>
            </div>
          </div>
        )}
      </div>

      <details open={changes.length > 0} className="rounded border border-steel-200 p-2">
        <summary className="cursor-pointer text-xs font-semibold text-steel-700">Changes made here ({changes.length})</summary>
        <div className="mt-2"><ChangeList changes={changes} testId="flow-changes" /></div>
      </details>
    </div>
  );
}
