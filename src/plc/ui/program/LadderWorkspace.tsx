import { useSettingsStore } from '../../../store/useSettingsStore';
import { noTouchPanelNow, useActiveHmiDesign } from '../../../hmi/projectPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SPEC_SECTIONS } from '../../../spec/types';
import { useIOStore } from '../../../store/useIOStore';
import { looksLeftOver } from '../../../spec/leftovers';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, ArrowsRightLeftIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PrinterIcon } from '@heroicons/react/20/solid';
import { Link, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../../review/useReviewStore';
import { useProgramStore } from '../../../store/useProgramStore';
import { generateLadder, reviseLadder, type AIConfig, type PlcContext } from '../../ai/ladderAI';
import { generateRuleBasedProgram } from '../../ai/cycleAI';
import SequenceTable from './SequenceTable';
import { useElectricalStore } from '../../../store/useElectricalStore';
import { validateProgram, type ValidationIssue } from '../../core/validate';
import { diffPrograms, summarizeDiff, type RungChange } from '../../core/diff';
import { GENERAL_BLOCK, scopeToBlock } from '../../sim/blocks';
import type { LadderProgram, Rung } from '../../core/ladder';
import LadderView from '../ladder/LadderView';
import { Spinner, ReasoningPanel } from '../../../components/common';
import StageBanner from '../../../components/StageBanner';
import ProgramOutOfStep from '../../../components/ProgramOutOfStep';
import ResizablePane from '../../../components/ResizablePane';
import PhoneTabs from '../../../components/PhoneTabs';
import { phonePanel } from '../../../components/phoneTabIds';
import { useNarrow } from '../../../components/useNarrow';
import { useFingerprints, useStages } from '../../../spec/useStages';
import { useStageStore } from '../../../store/useStageStore';
import { changedSections, specToText } from '../../../spec/types';
import BlockTree from './BlockTree';
import CrossRefPanel from './CrossRefPanel';
import { useFullScreen, useLadderHistory } from './workspaceView';
import ProgramPrint from './ProgramPrint';
import type { AnalogSetupRow } from '../../core/analog';
import { useDraft } from '../../../store/useDraftStore';
import { useUi } from '../../../store/useUiStore';
import { startAiJob, useAiJobError } from '../../../lib/ai/jobs';
import VoiceTextarea from '../../../voice/VoiceTextarea';
import SpeakButton from '../../../voice/SpeakButton';
import { usePlcNames } from '../ladder/plcNames';

type Tab = 'describe' | 'fix' | 'history';

interface Props {
  ai: AIConfig;
  ctx: PlcContext;
  ioAddressSet: Set<string>;
  labels: Map<string, string>;
  /** API key present. */
  ready: boolean;
  /** Analog channel setup (printed with the program). */
  analog?: AnalogSetupRow[];
}

const GENERAL = '';

/** Put an edited block back into the whole program, in the block's place; new rungs join the block. */
function mergeBlock(full: LadderProgram, blockId: string, edited: LadderProgram): LadderProgram {
  const inBlock = (r: Rung) => (r.block ?? GENERAL) === blockId;
  const first = full.rungs.findIndex(inBlock);
  const rest = full.rungs.filter((r) => !inBlock(r));
  const at = first < 0 ? rest.length : full.rungs.slice(0, first).filter((r) => !inBlock(r)).length;
  const mine = edited.rungs.map((r) => {
    if (blockId) return { ...r, block: blockId };
    const x = { ...r };
    delete x.block;
    return x;
  });
  return { ...full, tags: edited.tags, rungs: [...rest.slice(0, at), ...mine, ...rest.slice(at)] };
}

function IssueList({ issues, rungNumber, plcName, onRebuild }: { issues: ValidationIssue[]; rungNumber: (id: string) => number; plcName: string; onRebuild?: () => void }) {
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
      {errors > 0 && onRebuild && (
        <div className="px-4 pb-2 flex flex-wrap items-center gap-2 text-red-800">
          <span>Exports of this program for the {plcName} will not work as they are (for example after a change of PLC).</span>
          <button onClick={onRebuild} className="px-2 py-0.5 rounded border border-red-300 bg-white font-medium hover:bg-red-100">Rebuild for the {plcName}</button>
        </div>
      )}
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

export default function LadderWorkspace({ ai, ctx, ioAddressSet, labels, ready, analog = [] }: Props) {
  const showExperimental = useSettingsStore((s) => !!s.showExperimental);
  const store = useProgramStore();
  const { ladder, proposal, chat, versions, isGenerating, userPrompt } = store;
  const fp = useFingerprints();
  const io = useIOStore((s) => s.projectIO);
  const hmiDesign = useActiveHmiDesign();
  const stages = useStages();
  const { sources, markGenerated } = useStageStore();
  const specText = specToText(fp.spec);
  // Only the machine-specific block names count (generic PLC words like alarms, modes, seal-in or first-scan are not leftovers).
  const programText = (ladder.blocks ?? []).map((b) => b.name).join(' ');
  const programLeftOver = ladder.blocks?.length ? looksLeftOver(programText, `${specText} ${io.map((p) => p.description).join(' ')}`, 1) : { leftOver: false, terms: [] as string[] };
  const notesCheck = /^the machine specification and\/or i\/o list changed|^current specification:/i.test(userPrompt.trim()) || userPrompt.length > 600 && specText && userPrompt.includes(specText.slice(0, 80))
    ? { leftOver: true, terms: ['a copy of the update message / specification'] }
    : looksLeftOver(userPrompt, specText);
  const machineText = [specText, userPrompt.trim() && `Additional notes for the program:\n${userPrompt}`].filter(Boolean).join('\n\n');
  const recordSource = () => markGenerated('program', { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp, hmiFp: fp.hmiFp });

  // A finding sent from the Design review page opens Fix & Ask with the request filled in.
  const [fromReview] = useState(() => useReviewStore.getState().fixRequest?.stage === 'program' ? useReviewStore.getState().fixRequest : null);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useUi<Tab>('program.tab', fromReview ? 'fix' : 'describe');
  const [request, setRequest] = useDraft('program.request', fromReview?.text ?? '');
  // A request from the review replaces whatever was remembered.
  useEffect(() => {
    if (!fromReview) return;
    useReviewStore.getState().requestFix(null);
    setTab('fix');
    setRequest(fromReview.text);
  }, [fromReview, setTab, setRequest]);
  const [localError, setError] = useState<string | null>(null);
  const genError = useAiJobError('program'), reviseError = useAiJobError('program-revise');
  const error = localError ?? genError ?? reviseError;
  const [selectedRungId, setSelectedRungId] = useState<string | null>(() => searchParams.get('rung'));
  /** null = whole program; '' = rungs without a block. */
  const [block, setBlock] = useUi<string | null>('program.block', null);
  const blocks = ladder.blocks ?? [];
  const blockOf = (r: Rung) => (r.block && blocks.some((b) => b.id === r.block) ? r.block : GENERAL);
  const hasGeneral = blocks.length > 0 && ladder.rungs.some((r) => blockOf(r) === GENERAL);
  const activeBlock = block !== null && (block === GENERAL ? hasGeneral : blocks.some((b) => b.id === block)) ? block : null;
  const blockName = activeBlock === null ? '' : blocks.find((b) => b.id === activeBlock)?.name ?? 'General';
  const shown: LadderProgram = activeBlock === null ? ladder : { ...ladder, rungs: ladder.rungs.filter((r) => blockOf(r) === activeBlock) };
  const realNumber = (id: string) => ladder.rungs.findIndex((r) => r.id === id) + 1;
  const [xrefOpen, setXrefOpen] = useUi('program.xrefOpen', false);
  // Phones: one pane at a time (the assistant, the program, its blocks, the cross-reference) from a tab strip.
  const narrow = useNarrow();
  const [phonePane, setPhonePane] = useState<'assistant' | 'ladder' | 'blocks' | 'xref'>('ladder');
  // Full screen (button, Ctrl+Shift+F, Esc), zoom of the diagram, undo / redo of hand edits.
  const { full, toggle: toggleFull } = useFullScreen();
  const [zoom, setZoom] = useUi('program.zoom', 1);
  const zoomBy = (f: number) => setZoom(Math.round(Math.min(2, Math.max(0.4, zoom * f)) * 100) / 100);
  const ladderBox = useRef<HTMLDivElement>(null);
  const fitZoom = () => {
    const box = ladderBox.current, w = Number(box?.querySelector('[data-ladder-width]')?.getAttribute('data-ladder-width') ?? 0);
    if (box && w) setZoom(Math.round(Math.min(2, Math.max(0.4, (box.clientWidth - 24) / w)) * 100) / 100);
  };
  const history = useLadderHistory(ladder, store.editLadder);
  // Siemens / Logix: the PLC's own tag names on the ladder (the names in the exported program).
  const plcNames = usePlcNames(ladder);
  const [xrefAddress, setXrefAddress] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [scrollTo, setScrollTo] = useState<{ id: string; n: number } | null>(() => (searchParams.get('rung') ? { id: searchParams.get('rung')!, n: 0 } : null));
  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of ladder.tags) if (t.nickname) m.set(t.address.toUpperCase(), t.nickname);
    for (const [a, l] of labels) if (l) m.set(a.toUpperCase(), l);
    return (a: string) => m.get(a.toUpperCase()) ?? '';
  }, [ladder.tags, labels]);

  /** Select a rung and scroll it into view, switching to its block if another block is shown. */
  const jumpToRung = (id: string) => {
    const r = ladder.rungs.find((x) => x.id === id);
    if (!r) return;
    if (narrow) setPhonePane('ladder');
    if (activeBlock !== null && blockOf(r) !== activeBlock) setBlock(blockOf(r));
    setSelectedRungId(id);
    setScrollTo((s) => ({ id, n: (s?.n ?? 0) + 1 }));
  };
  useEffect(() => {
    if (!scrollTo) return;
    document.querySelector(`[data-rung-id="${CSS.escape(scrollTo.id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [scrollTo]);

  const updateFromSpec = () => {
    const changed = changedSections(sources.program?.spec ?? null, fp.spec);
    setTab('fix');
    return handleRevise(
      `The machine specification and/or I/O list changed${changed.length ? ` (spec sections: ${changed.join(', ')})` : ''}. ` +
      `Update the program so it matches the current specification below, keep everything that still applies, and list each change in the explanation.\n\nCurrent specification:\n${specText}`,
      true,
    );
  };

  const issues = useMemo(() => validateProgram(ladder, ctx.profile, ioAddressSet, hmiDesign ?? undefined), [ladder, ctx.profile, ioAddressSet, hmiDesign]);

  // While reviewing an AI change, show the proposed program with removed rungs kept in place.
  const review = useMemo(() => {
    if (!proposal) return null;
    const entries = diffPrograms(ladder, proposal.program);
    const display: LadderProgram = { rungs: entries.map((e) => e.rung), tags: proposal.program.tags, blocks: proposal.program.blocks };
    const changes = new Map<string, RungChange>(entries.map((e) => [e.rung.id, e.change]));
    return {
      display,
      changes,
      summary: summarizeDiff(entries),
      issues: validateProgram(proposal.program, ctx.profile, ioAddressSet, hmiDesign ?? undefined),
    };
  }, [proposal, ladder, ctx.profile, ioAddressSet, hmiDesign]);

  const rungNumber = (id: string) => (review?.display ?? ladder).rungs.findIndex((r) => r.id === id) + 1;

  /** Run an AI step as a global job: it keeps going (and its result is applied) when the user leaves the page. */
  const runAI = <T,>(kind: 'program' | 'program-revise', label: string, run: (signal: AbortSignal) => Promise<T>, apply: (r: T) => void, needsKey = true) => {
    if ((needsKey && !ready) || isGenerating) return;
    setError(null);
    void startAiJob({
      kind, label,
      run: async (h) => {
        useProgramStore.getState().setIsGenerating(true);
        try { return await run(h.signal); } finally { useProgramStore.getState().setIsGenerating(false); }
      },
      apply,
    });
  };

  /**
   * Generate: the standard blocks (safety & modes, alarms, manual, outputs, HMI status) come from the rules
   * in milliseconds and implement every HMI tag; with a key the AI writes only the machine's cycle block.
   * `full` = the older all-AI program (experimental).
   */
  const handleGenerate = (full = false) => {
    if (full && !machineText.trim()) return;
    if (ladder.rungs.length && !programLeftOver.leftOver && !confirm('Build a new program from your project? (The current one is kept in History.)')) return;
    setTab('describe');
    if (!full) {
      return runAI('program', 'PLC program', (signal) => generateRuleBasedProgram({
        ai: ready && ai.apiKey ? { ...ai, signal } : undefined, ctx, spec: machineText,
        electrical: useElectricalStore.getState().design, hmi: hmiDesign, noPanel: noTouchPanelNow(),
      }), (r) => {
        useProgramStore.getState().setGeneratedLadder(r.program, r.explanation, r.reasoning);
        recordSource();
      }, false);
    }
    return runAI('program', 'PLC program (full AI)', async (signal) => {
      const r = await generateLadder({ ...ai, signal }, ctx, machineText);
      if (!r.program) throw new Error('The AI did not return a program. Add more detail and try again.');
      return { ...r, program: r.program };
    }, (r) => {
      useProgramStore.getState().setGeneratedLadder(r.program, r.explanation, r.reasoning);
      recordSource();
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
    const scoped = activeBlock !== null && !specUpdate ? `[Block: ${blockName}${activeBlock ? ` (id "${activeBlock}")` : ''}] ${req}` : req;
    store.addChat({ role: 'user', text: scoped });
    setRequest('');
    return runAI('program-revise', 'PLC program change', (signal) => reviseLadder({ ...ai, signal }, ctx, ladder, issues, history, scoped), (r) => {
      const st = useProgramStore.getState();
      if (r.program) {
        // A change asked for one block changes only that block; the rest of the program stays as it is.
        let program = r.program, explanation = r.explanation;
        if (activeBlock !== null && !specUpdate) {
          const scopedResult = scopeToBlock(ladder, r.program, activeBlock === GENERAL ? GENERAL_BLOCK : activeBlock);
          program = scopedResult.program;
          if (scopedResult.outside) explanation += `\n\nOnly the block ${blockName} was changed: ${scopedResult.outside} change${scopedResult.outside === 1 ? '' : 's'} the AI made to other blocks ${scopedResult.outside === 1 ? 'was' : 'were'} left out. Select "Whole program" to ask for changes there.`;
        }
        st.addChat({ role: 'assistant', text: explanation });
        st.setProposal({ program, explanation, reasoning: r.reasoning, specUpdate });
      } else {
        st.addChat({ role: 'assistant', text: r.explanation, outcome: 'no-change' });
      }
    });
  };

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`flex-1 py-2 text-xs font-medium border-b-2 ${tab === id ? 'border-brand-600 text-brand-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {label}
    </button>
  );

  const hasRungs = !review && ladder.rungs.length > 0;
  const pane = narrow && !hasRungs && (phonePane === 'blocks' || phonePane === 'xref') ? 'ladder' : phonePane;
  const xrefOn = narrow ? pane === 'xref' : xrefOpen;
  return (
    <div className={`flex-1 flex overflow-hidden${narrow ? ' flex-col' : ''}`}>
      {narrow && <PhoneTabs idBase="program" label="Program panes" value={pane} onChange={setPhonePane} tabs={[
        { id: 'assistant', label: 'Build / Change' }, { id: 'ladder', label: 'Program' },
        ...(hasRungs ? [{ id: 'blocks' as const, label: 'Blocks' }, { id: 'xref' as const, label: 'Cross-ref' }] : []),
      ]} />}
      {/* Assistant panel */}
      <ResizablePane id="program.assistant" defaultSize={384} min={260} max={800} fill={narrow} panel={phonePanel(narrow, 'program', 'assistant')}
        className={`flex flex-col border-r border-gray-200 bg-white${narrow ? ' min-h-0' : ''}${narrow && pane !== 'assistant' ? ' hidden' : ''}`}>
        <div className="flex border-b border-gray-200">
          {tabButton('describe', 'Build')}
          {tabButton('fix', 'Change')}
          {tabButton('history', `History (${versions.length})`)}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'describe' && (
            <>
              {programLeftOver.leftOver && (
                <div className="px-3 py-2 text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded" role="alert" data-testid="leftover-program">
                  <b>The current program is from another machine</b> (it mentions {programLeftOver.terms.join(', ')}, which are not in your machine description). Build a new program from your project.
                </div>
              )}
              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="w-full py-3 bg-brand-600 text-white text-sm font-semibold rounded hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? <><Spinner /> Building the program…</> : 'Build program from my project'}
              </button>
              <div className="text-sm text-gray-700 bg-brand-50 border border-brand-200 rounded px-3 py-2" data-testid="program-sources">
                <div className="font-medium text-gray-800 mb-1">The program is made directly from:</div>
                <ul className="text-xs space-y-0.5">
                  <li>✓ <Link to="/spec" className="underline">Machine description</Link> — {SPEC_SECTIONS.filter((s) => (fp.spec as Record<string, string>)[s.id]?.trim()).length} sections{fp.spec.qa?.trim() ? ' + your answers' : ''}</li>
                  <li>✓ <Link to="/io" className="underline">I/O list</Link> — {io.length} points</li>
                  <li>✓ <Link to="/hmi" className="underline">HMI design</Link>{hmiDesign ? ` — ${hmiDesign.screens.length} screens` : ' — none yet'}</li>
                </ul>
                {specText ? <div className="text-xs text-gray-500 mt-1">You don't need to copy anything here: change the machine description and press Generate.</div> : <div className="text-xs text-amber-800 mt-1">The machine description is empty: describe the machine first.</div>}
              </div>
              {ladder.rungs.length > 0 && chat[0]?.role === 'assistant' && chat[0].outcome === 'applied' && (
                <div className="text-xs text-gray-700 bg-green-50 border border-green-200 rounded px-3 py-2 whitespace-pre-wrap" data-testid="program-summary">
                  <div className="font-medium text-green-800 mb-0.5">Current program</div>{chat[0].text}
                </div>
              )}
              <p className="text-xs text-gray-500">To change something small in the existing program instead, use the <button onClick={() => setTab('fix')} className="underline">Change</button> tab.</p>
              <details className="text-sm" open={Boolean(userPrompt.trim())}>
                <summary className="cursor-pointer text-xs text-gray-500">Advanced: extra notes for the program only</summary>
                <div className="mt-2 space-y-2">
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Extra notes for the program only <span className="font-normal text-gray-400">(optional, usually empty)</span></label>
              <VoiceTextarea
                id="prompt"
                value={userPrompt}
                onValueChange={store.setUserPrompt}
                rows={6}
                placeholder="Anything program-specific that isn't in the spec, e.g. 'Use DS1 as the step register', 'Keep rung comments short'."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
              />
              {notesCheck.leftOver && (
                <div className="px-3 py-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded" role="alert" data-testid="leftover-notes">
                  These notes don't match your machine description (they mention {notesCheck.terms.join(', ')}). They may be left over from another project.
                  <button onClick={() => store.setUserPrompt('')} className="ml-2 underline font-medium">Clear the notes</button>
                </div>
              )}
                </div>
              </details>
              {showExperimental && <button onClick={() => handleGenerate(true)} disabled={isGenerating || !ready || !machineText.trim()}
                title="The AI writes the whole program itself (slower); the standard program uses the AI only for the machine's cycle"
                className="w-full py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">AI full program (experimental)</button>}
              <p className="text-xs text-gray-400">Standard blocks for the {ctx.profile.name} {ctx.cpu.id} from the I/O list and HMI in seconds{ready ? '; the AI writes the machine\'s cycle from your description.' : '.'}</p>
            </>
          )}

          {tab === 'fix' && (
            <>
              {fromReview && request === fromReview.text && (
                <div className="rounded border border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-900">
                  From the <Link to="/review" className="underline">design review</Link>: the finding is in the box below. Press Send — the AI proposes a change and you approve or reject it.
                </div>
              )}
              {!chat.length && (
                <p className="text-sm text-gray-500">
                  Describe a problem or a change in plain words, e.g. <em>"The conveyor doesn't stop when the guard door opens"</em> or
                  <em> "Add a 2 second delay before the cylinder retracts"</em>. You can also ask questions about the program.
                </p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-600 text-white ml-6' : 'bg-gray-100 text-gray-800 mr-2'}`}>
                  {m.role === 'assistant' && <SpeakButton text={m.text} label="Read the answer aloud" size="xs" className="float-right -mr-1 -mt-0.5 ml-1" />}
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
            <VoiceTextarea
              value={request}
              onValueChange={setRequest}
              aria-label="Describe a problem or change"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRevise(request); } }}
              rows={3}
              disabled={Boolean(proposal) || !ladder.rungs.length}
              placeholder={proposal ? 'Approve or reject the proposed change first' : ladder.rungs.length ? 'Describe a problem or change… (Enter to send)' : 'Generate a program first'}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:bg-gray-50"
            />
            {request.length > 600 && (
              <div className="px-3 py-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded" role="alert" data-testid="change-too-long">
                This looks like a whole machine description. You don't need to type it here: the program is built from your <Link to="/spec" className="underline">Machine description</Link>, I/O list and HMI.
                Put it there and press <button onClick={() => setTab('describe')} className="underline font-medium">Build program from my project</button>. Use Change only for small fixes, e.g. "add a 2 s delay before the cylinder goes up".
              </div>
            )}
            <button
              onClick={() => handleRevise(request)}
              disabled={isGenerating || !ready || !request.trim() || Boolean(proposal) || !ladder.rungs.length}
              className="w-full py-2 bg-brand-600 text-white text-sm font-medium rounded hover:bg-brand-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        )}
      </ResizablePane>

      {/* Ladder area */}
      <section className={`flex flex-col overflow-hidden bg-white ${full ? 'fixed inset-0 z-40' : 'flex-1 min-h-0'}${narrow && pane === 'assistant' && !full ? ' hidden' : ''}`} data-testid="ladder-workspace" data-fullscreen={full || undefined}>
        {!proposal && (
          <StageBanner info={stages.program} action={
            <button onClick={updateFromSpec} disabled={isGenerating || !ready} className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded disabled:opacity-50">
              {isGenerating ? 'Updating…' : 'Update program'}
            </button>} />
        )}
        {!proposal && <ProgramOutOfStep where="program" />}
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
          ladder.rungs.length > 0 && <IssueList issues={issues} rungNumber={rungNumber} plcName={ctx.profile.name} onRebuild={() => handleGenerate(false)} />
        )}

        {!review && ladder.rungs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[#f7f8f9] border-b border-gray-200 text-xs">
            <span className="font-semibold text-gray-700">{activeBlock === null ? 'Whole program' : blockName}</span>
            <span className="text-gray-400">{shown.rungs.length} rung{shown.rungs.length === 1 ? '' : 's'}</span>
            {activeBlock !== null && (
              <button onClick={() => { setTab('fix'); handleRevise(`Review and rewrite this block so it fully matches the specification for this part of the machine. Keep its interface (the internal bits other blocks read or write) unless it is wrong, and explain any change to it.\n\nCurrent specification:\n${specText}`); }}
                disabled={isGenerating || !ready || Boolean(proposal)}
                className="px-2.5 py-1 rounded-sm border border-brand-300 text-brand-800 bg-white hover:bg-brand-50 disabled:opacity-50">
                Regenerate this block
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button onClick={history.undo} disabled={!history.canUndo} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" title="Undo the last hand edit (Ctrl+Z)" aria-label="Undo"><ArrowUturnLeftIcon className="h-3.5 w-3.5" /></button>
              <button onClick={history.redo} disabled={!history.canRedo} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" title="Redo (Ctrl+Shift+Z / Ctrl+Y)" aria-label="Redo"><ArrowUturnRightIcon className="h-3.5 w-3.5" /></button>
              <span className="mx-1 h-4 border-l border-gray-300" />
              <button onClick={() => zoomBy(1 / 1.1)} disabled={zoom <= 0.4} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" aria-label="Zoom out"><MagnifyingGlassMinusIcon className="h-3.5 w-3.5" /></button>
              <button onClick={() => setZoom(1)} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40 w-12 justify-center tabular-nums" title="Back to 100%" aria-label="Zoom level">{Math.round(zoom * 100)}%</button>
              <button onClick={() => zoomBy(1.1)} disabled={zoom >= 2} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" aria-label="Zoom in"><MagnifyingGlassPlusIcon className="h-3.5 w-3.5" /></button>
              <button onClick={fitZoom} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" title="Fit the ladder to the width">Fit</button>
              <span className="mx-1 h-4 border-l border-gray-300" />
              <button onClick={toggleFull} aria-pressed={full} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" title={full ? 'Leave full screen (Esc or Ctrl+Shift+F)' : 'Ladder over the whole window (Ctrl+Shift+F)'}>
                {full ? <ArrowsPointingInIcon className="h-3.5 w-3.5" /> : <ArrowsPointingOutIcon className="h-3.5 w-3.5" />} {full ? 'Exit full screen' : 'Full screen'}
              </button>
              <button onClick={() => (narrow ? setPhonePane('xref') : setXrefOpen((v) => !v))} aria-pressed={xrefOn}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border ${xrefOn ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-brand-50'}`}
                title="Pick an address and see every rung that reads or writes it">
                <ArrowsRightLeftIcon className="h-3.5 w-3.5" /> Cross reference
              </button>
              <button onClick={() => setPrinting(true)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50"
                title="Printable program: structure, rung descriptions, ladder per block and the tag table">
                <PrinterIcon className="h-3.5 w-3.5" /> Print program
              </button>
            </div>
          </div>
        )}
        {!review && activeBlock !== null && (
          <div className="px-4 py-1.5 text-xs text-brand-900 bg-brand-50 border-b border-brand-200">
            Working on <span className="font-semibold">{blockName}</span>: {(blocks.find((b) => b.id === activeBlock)?.description ?? 'rungs without a block').replace(/\.$/, '')}. Requests in Fix &amp; Ask apply to this block; the simulator can run it on its own.
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
        {hasRungs && (!narrow || pane === 'blocks') && (
          <ResizablePane id="program.tree" defaultSize={230} min={160} max={480} fill={narrow} panel={phonePanel(narrow, 'program', 'blocks')} className={narrow ? 'overflow-auto' : 'border-r border-gray-200'}>
            <BlockTree program={ladder} issues={issues} active={activeBlock} selectedRungId={selectedRungId}
              onBlock={(id) => { setBlock(id); setSelectedRungId(null); if (narrow) setPhonePane('ladder'); }} onRung={jumpToRung} />
          </ResizablePane>
        )}
        {/* The ladder diagram pans both ways. */}
        <div ref={ladderBox} {...phonePanel(narrow, 'program', 'ladder')} className={`flex-1 min-w-0 overflow-auto${narrow && pane !== 'ladder' ? ' hidden' : ''}`} data-scroll-x="">
          {review ? (
            <LadderView program={review.display} labels={labels} changes={review.changes} issues={review.issues} zoom={zoom} plcNames={plcNames} />
          ) : ladder.rungs.length ? (
            <>
            {ladder.sequence && (activeBlock === null || activeBlock === 'cycle') && <SequenceTable sequence={ladder.sequence} labels={labels} plcNames={plcNames} />}
            <LadderView
              plcNames={plcNames}
              program={shown}
              onChange={activeBlock === null ? history.edit : (p) => history.edit(mergeBlock(ladder, activeBlock, p))}
              zoom={zoom}
              numberOf={activeBlock === null ? undefined : realNumber}
              labels={labels}
              issues={issues}
              selectedRungId={selectedRungId}
              onSelectRung={setSelectedRungId}
              progressive
            />
            </>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
              <Spinner className="h-8 w-8 text-brand-800" />
              <p className="text-sm">The AI is reasoning through your machine logic — this can take a few minutes.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
              <p>No program yet.</p>
              <p>Click Build program from my project on the left (it uses the machine description, I/O list and HMI), or start an empty program and draw it by hand.</p>
              <button
                onClick={() => store.editLadder({ rungs: [{ id: 'r_first', comment: '', branches: [[{ type: 'NO', address: '' }]], outputs: [{ type: 'OUT', address: '' }] }], tags: [] })}
                className="mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                Start empty program
              </button>
            </div>
          )}
        </div>
        {hasRungs && (narrow ? pane === 'xref' : xrefOpen) && (
          <ResizablePane id="program.xref" defaultSize={340} min={240} max={700} handle="left" fill={narrow} panel={phonePanel(narrow, 'program', 'xref')} className={narrow ? 'overflow-auto' : 'border-l border-gray-200'}>
            <CrossRefPanel program={ladder} labelOf={labelOf} address={xrefAddress} onAddress={setXrefAddress}
              selectedRungId={selectedRungId} onRung={jumpToRung} onClose={() => (narrow ? setPhonePane('ladder') : setXrefOpen(false))} />
          </ResizablePane>
        )}
        </div>

        {!review && ladder.rungs.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-500">
            <span className="flex-1">{activeBlock === null ? `${ladder.rungs.length} rungs` : `${shown.rungs.length} of ${ladder.rungs.length} rungs (${blockName})`} · click any instruction to edit it by hand</span>
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
      {printing && (
        <ProgramPrint program={ladder} projectName={store.projectName} plcName={`${ctx.profile.vendor} ${ctx.profile.name} · ${ctx.cpu.label}`}
          issues={issues} labels={labels} analog={analog} onClose={() => setPrinting(false)} />
      )}
    </div>
  );
}
