import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgramStore } from '../../store/useProgramStore';
import { generateLadder, reviseLadder, type AIConfig, type PlcContext } from '../../lib/ai/ladderAI';
import { validateProgram, type ValidationIssue } from '../../plc/validate';
import { diffPrograms, summarizeDiff, type RungChange } from '../../plc/diff';
import type { LadderProgram } from '../../plc/ladder';
import LadderView from '../ladder/LadderView';
import { Spinner, ReasoningPanel } from './common';
import StageBanner from '../StageBanner';
import { useFingerprints, useStages } from '../../spec/useStages';
import { useStageStore } from '../../store/useStageStore';
import { changedSections, specToText } from '../../spec/types';

type Tab = 'describe' | 'fix' | 'history';

interface Props {
  ai: AIConfig;
  ctx: PlcContext;
  ioAddressSet: Set<string>;
  labels: Map<string, string>;
  /** API key present. */
  ready: boolean;
}

function IssueList({ issues, rungNumber }: { issues: ValidationIssue[]; rungNumber: (id: string) => number }) {
  const [open, setOpen] = useState(false);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  if (!issues.length) {
    return <div className="px-4 py-2 text-xs text-green-700 bg-green-50 border-b border-green-200">✓ Checker: no problems found</div>;
  }
  return (
    <div className={`border-b text-xs ${errors ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left px-4 py-2 font-medium flex justify-between">
        <span className={errors ? 'text-red-800' : 'text-amber-800'}>
          Checker: {errors} error{errors !== 1 && 's'}, {warnings} warning{warnings !== 1 && 's'}
        </span>
        <span className="text-gray-500">{open ? 'Hide ▲' : 'Show ▼'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-2 space-y-0.5 max-h-40 overflow-y-auto">
          {issues.map((i, k) => (
            <li key={k} className={i.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
              {i.rungId ? `Rung ${rungNumber(i.rungId)}: ` : ''}{i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LadderWorkspace({ ai, ctx, ioAddressSet, labels, ready }: Props) {
  const store = useProgramStore();
  const { ladder, proposal, chat, versions, isGenerating, userPrompt } = store;
  const fp = useFingerprints();
  const stages = useStages();
  const { sources, markGenerated } = useStageStore();
  const specText = specToText(fp.spec);
  const machineText = [specText, userPrompt.trim() && `Additional notes for the program:\n${userPrompt}`].filter(Boolean).join('\n\n');
  const recordSource = () => markGenerated('program', { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp, hmiFp: fp.hmiFp });

  const [tab, setTab] = useState<Tab>(ladder.rungs.length ? 'fix' : 'describe');
  const [request, setRequest] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedRungId, setSelectedRungId] = useState<string | null>(null);

  const updateFromSpec = () => {
    const changed = changedSections(sources.program?.spec ?? null, fp.spec);
    setTab('fix');
    return handleRevise(
      `The machine specification and/or I/O list changed${changed.length ? ` (spec sections: ${changed.join(', ')})` : ''}. ` +
      `Update the program so it matches the current specification below, keep everything that still applies, and list each change in the explanation.\n\nCurrent specification:\n${specText}`,
      true,
    );
  };

  const issues = useMemo(() => validateProgram(ladder, ctx.profile, ioAddressSet), [ladder, ctx.profile, ioAddressSet]);

  // While reviewing an AI change, show the proposed program with removed rungs kept in place.
  const review = useMemo(() => {
    if (!proposal) return null;
    const entries = diffPrograms(ladder, proposal.program);
    const display: LadderProgram = { rungs: entries.map((e) => e.rung), tags: proposal.program.tags };
    const changes = new Map<string, RungChange>(entries.map((e) => [e.rung.id, e.change]));
    return {
      display,
      changes,
      summary: summarizeDiff(entries),
      issues: validateProgram(proposal.program, ctx.profile, ioAddressSet),
    };
  }, [proposal, ladder, ctx.profile, ioAddressSet]);

  const rungNumber = (id: string) => (review?.display ?? ladder).rungs.findIndex((r) => r.id === id) + 1;

  const runAI = async (fn: () => Promise<void>) => {
    if (!ready || isGenerating) return;
    store.setIsGenerating(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      store.setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (!machineText.trim()) return;
    if (ladder.rungs.length && !confirm('Replace the current program with a new one? (The current one is kept in History.)')) return;
    return runAI(async () => {
      const r = await generateLadder(ai, ctx, machineText);
      if (!r.program) throw new Error('The AI did not return a program. Add more detail and try again.');
      store.setGeneratedLadder(r.program, r.explanation, r.reasoning);
      recordSource();
      setTab('fix');
    });
  };

  const handleRevise = (text: string, specUpdate = false) => {
    const req = text.trim();
    if (!req || proposal) return;
    // Earlier turns as plain text; the current program is attached fresh by reviseLadder.
    // The conversation must open with a user turn, so lead with the original request.
    const history = [
      { role: 'user' as const, content: `Machine specification:\n${machineText || '(program was drawn by hand)'}` },
      ...chat.map((m) => ({ role: m.role, content: m.text })),
    ];
    return runAI(async () => {
      store.addChat({ role: 'user', text: req });
      setRequest('');
      const r = await reviseLadder(ai, ctx, ladder, issues, history, req);
      if (r.program) {
        store.addChat({ role: 'assistant', text: r.explanation });
        store.setProposal({ program: r.program, explanation: r.explanation, reasoning: r.reasoning, specUpdate });
      } else {
        store.addChat({ role: 'assistant', text: r.explanation, outcome: 'no-change' });
      }
    });
  };

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`flex-1 py-2 text-xs font-medium border-b-2 ${tab === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Assistant panel */}
      <aside className="w-96 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="flex border-b border-gray-200">
          {tabButton('describe', 'Describe')}
          {tabButton('fix', 'Fix & Ask')}
          {tabButton('history', `History (${versions.length})`)}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'describe' && (
            <>
              <p className="text-sm text-gray-600">
                The program is written from your <Link to="/spec" className="underline">spec</Link>, the I/O list and the HMI design.
                {specText ? '' : ' The spec is empty: describe the machine first, or type the requirements below.'}
              </p>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Notes for the program <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea
                id="prompt"
                value={userPrompt}
                onChange={(e) => store.setUserPrompt(e.target.value)}
                rows={6}
                placeholder="Anything program-specific that isn't in the spec, e.g. 'Use DS1 as the step register', 'Keep rung comments short'."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !ready || !machineText.trim()}
                className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? <><Spinner /> Thinking & writing ladder…</> : ladder.rungs.length ? 'Generate New Program' : 'Generate Program'}
              </button>
              <p className="text-xs text-gray-400">Uses the {ctx.profile.name} {ctx.cpu.id} rules. Deep thinking can take a few minutes.</p>
            </>
          )}

          {tab === 'fix' && (
            <>
              {!chat.length && (
                <p className="text-sm text-gray-500">
                  Describe a problem or a change in plain words, e.g. <em>"The conveyor doesn't stop when the guard door opens"</em> or
                  <em> "Add a 2 second delay before the cylinder retracts"</em>. You can also ask questions about the program.
                </p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-600 text-white ml-6' : 'bg-gray-100 text-gray-800 mr-2'}`}>
                  {m.text}
                  {m.outcome && (
                    <div className={`mt-1 text-xs font-medium ${m.outcome === 'applied' ? 'text-green-700' : m.outcome === 'rejected' ? 'text-red-600' : 'text-gray-500'}`}>
                      {m.outcome === 'applied' ? '✓ Applied' : m.outcome === 'rejected' ? '✗ Rejected' : 'No program change'}
                    </div>
                  )}
                </div>
              ))}
              {isGenerating && <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Thinking…</div>}
            </>
          )}

          {tab === 'history' && (
            <>
              {!versions.length && <p className="text-sm text-gray-500">A copy of the program is saved here before every AI change, new generation or restore.</p>}
              {[...versions].reverse().map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 border border-gray-200 rounded px-3 py-2">
                  <div>
                    <div className="text-sm text-gray-800">{v.label}</div>
                    <div className="text-xs text-gray-400">{new Date(v.at).toLocaleString()} · {v.program.rungs.length} rungs</div>
                  </div>
                  <button
                    onClick={() => { if (confirm('Restore this version? The current program is saved to History first.')) store.restoreVersion(v.id); }}
                    disabled={Boolean(proposal)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </>
          )}

          {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800"><span className="font-semibold">Failed:</span> {error}</div>}
          {!ready && <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">Add your API key in Settings to use the AI.</div>}
          {store.reasoning && tab !== 'history' && <ReasoningPanel reasoning={store.reasoning} />}
        </div>

        {tab === 'fix' && (
          <div className="border-t border-gray-200 p-3 space-y-2">
            {issues.length > 0 && !proposal && (
              <button
                onClick={() => handleRevise('Fix the problems the checker found.')}
                disabled={isGenerating || !ready || !ladder.rungs.length}
                className="w-full py-1.5 text-xs border border-amber-300 text-amber-800 bg-amber-50 rounded hover:bg-amber-100 disabled:opacity-50"
              >
                Ask AI to fix the {issues.length} checker issue{issues.length !== 1 && 's'}
              </button>
            )}
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRevise(request); } }}
              rows={3}
              disabled={Boolean(proposal) || !ladder.rungs.length}
              placeholder={proposal ? 'Approve or reject the proposed change first' : ladder.rungs.length ? 'Describe a problem or change… (Enter to send)' : 'Generate a program first'}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:bg-gray-50"
            />
            <button
              onClick={() => handleRevise(request)}
              disabled={isGenerating || !ready || !request.trim() || Boolean(proposal) || !ladder.rungs.length}
              className="w-full py-2 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </aside>

      {/* Ladder area */}
      <section className="flex-1 flex flex-col overflow-hidden bg-white">
        {!proposal && (
          <StageBanner info={stages.program} action={
            <button onClick={updateFromSpec} disabled={isGenerating || !ready} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded disabled:opacity-50">
              {isGenerating ? 'Updating…' : 'Update program'}
            </button>} />
        )}
        {review ? (
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 flex items-center gap-3">
            <div className="flex-1 text-sm text-indigo-900">
              <span className="font-semibold">Review AI change:</span> {review.summary}.
              {review.issues.some((i) => i.severity === 'error') && <span className="text-red-700"> The checker found errors in this change.</span>}
              <span className="block text-xs text-indigo-700 mt-0.5">Green = added, amber = changed, red = removed.</span>
            </div>
            <button onClick={store.rejectProposal} className="px-3 py-1.5 text-sm border border-gray-300 bg-white rounded hover:bg-gray-50">Reject</button>
            <button onClick={() => { const fromSpec = proposal?.specUpdate; store.applyProposal(); if (fromSpec) recordSource(); }} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
          </div>
        ) : (
          ladder.rungs.length > 0 && <IssueList issues={issues} rungNumber={rungNumber} />
        )}

        <div className="flex-1 overflow-auto">
          {review ? (
            <LadderView program={review.display} labels={labels} changes={review.changes} issues={review.issues} />
          ) : ladder.rungs.length ? (
            <LadderView
              program={ladder}
              onChange={store.editLadder}
              labels={labels}
              issues={issues}
              selectedRungId={selectedRungId}
              onSelectRung={setSelectedRungId}
            />
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
              <Spinner className="h-8 w-8 text-brand-500" />
              <p className="text-sm">The AI is reasoning through your machine logic — this can take a few minutes.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
              <p>No program yet.</p>
              <p>Describe the machine on the left, or start an empty program and draw it by hand.</p>
              <button
                onClick={() => store.editLadder({ rungs: [{ id: 'r_first', comment: '', branches: [[{ type: 'NO', address: '' }]], outputs: [{ type: 'OUT', address: '' }] }], tags: [] })}
                className="mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                Start empty program
              </button>
            </div>
          )}
        </div>

        {!review && ladder.rungs.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-500">
            <span className="flex-1">{ladder.rungs.length} rungs · click any instruction to edit it by hand</span>
            <button onClick={() => store.saveVersion('Saved manually')} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">Save version</button>
            <button
              onClick={() => { if (confirm('Clear the program? It is saved to History first.')) store.clearLadder(); }}
              className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
