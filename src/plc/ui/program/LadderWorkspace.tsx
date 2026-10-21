import { useSettingsStore } from '../../../store/useSettingsStore';
import { noTouchPanelNow, useActiveHmiDesign } from '../../../hmi/projectPanel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SPEC_SECTIONS } from '../../../spec/types';
import { useIOStore } from '../../../store/useIOStore';
import { looksLeftOver } from '../../../spec/leftovers';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, ArrowsRightLeftIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon, PrinterIcon, SparklesIcon } from '@heroicons/react/20/solid';
import { Link, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../../review/useReviewStore';
import { replaceProgramQuestion, useProgramStore } from '../../../store/useProgramStore';
import { changeScope, generateLadder, reviseLadder, type AIConfig, type PlcContext } from '../../ai/ladderAI';
import { generateRuleBasedProgram } from '../../ai/cycleAI';
import SequenceTable from './SequenceTable';
import { useElectricalStore } from '../../../store/useElectricalStore';
import { validateProgram, type ValidationIssue } from '../../core/validate';
import { diffPrograms, summarizeDiff, type RungChange } from '../../core/diff';
import { GENERAL_BLOCK, scopeToBlock } from '../../sim/blocks';
import type { LadderProgram, Rung } from '../../core/ladder';
import LadderView from '../ladder/LadderView';
import { usePlc } from '../../core/usePlc';
import { nativeName } from '../../core/addressCheck';
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
import { specForAI } from '../../../lib/ai/specForAI';
import BlockTree from './BlockTree';
import CrossRefPanel from './CrossRefPanel';
import { useFullScreen, useLadderHistory } from './workspaceView';
import ProgramPrint from './ProgramPrint';
import type { AnalogSetupRow } from '../../core/analog';
import { useDraft } from '../../../store/useDraftStore';
import { useUi } from '../../../store/useUiStore';
import { startAiJob, useAiJobError } from '../../../lib/ai/jobs';
import VoiceTextarea from '../../../voice/VoiceTextarea';
import { collectProject } from '../../../deliverables/collect';
import { addComments } from '../../tidy/comments';
import { applyReorganize, externalAddresses, planReorganize, plcBaseline, type ReorgPlan, type SectionId } from '../../tidy/reorganize';
import { equivalenceSummary } from '../../tidy/equivalence';
import { checkEquivalenceOffThread } from '../../tidy/equivalenceOffThread';
import { explainWithAi } from '../../tidy/explain';
import { explainSummaries, saveExplainSummaries } from '../../tidy/explainStore';
import ExplainPanel from './ExplainPanel';
import { rewriteCandidates, simplifyBlocks, type RewriteCandidate } from '../../tidy/rewrite';
import SpeakButton from '../../../voice/SpeakButton';
import { usePlcNames } from '../ladder/plcNames';
import { useProjectStore } from '../../../store/useProjectStore';
import { ptoPointsFor } from '../../../electrical/highSpeedIo';

type Tab = 'describe' | 'fix' | 'explain' | 'history';

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
  const machineText = [specText, userPrompt.trim() && `## Additional notes for the program\n${userPrompt}`].filter(Boolean).join('\n\n');
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
  const [phonePane, setPhonePane] = useState<'assistant' | 'ladder' | 'blocks' | 'xref'>(() => (searchParams.get('tidy') === '1' ? 'assistant' : 'ladder'));
  /**
   * "Simplify & explain" (the toolbar button, or /program?tidy=1 from the Upgrade page): the Change tab with the
   * Tidy up group in view and marked for a moment.
   */
  const tidyRef = useRef<HTMLDivElement>(null);
  const [tidyAsk, setTidyAsk] = useState(() => (searchParams.get('tidy') === '1' ? 1 : 0));
  const tidyShown = useRef(0);
  const openTidy = () => { setTab('fix'); if (narrow) setPhonePane('assistant'); setTidyAsk((n) => n + 1); };
  useEffect(() => {
    if (!tidyAsk || tidyShown.current === tidyAsk) return;
    if (tab !== 'fix') { setTab('fix'); return; }
    const el = tidyRef.current;
    if (!el) return;
    tidyShown.current = tidyAsk;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const mark = ['bg-brand-50', 'ring-2', 'ring-brand-400'];
    el.classList.add(...mark);
    const t = setTimeout(() => el.classList.remove(...mark), 2000);
    return () => { clearTimeout(t); el.classList.remove(...mark); };
  }, [tidyAsk, tab, setTab]);
  // Full screen (button, Ctrl+Shift+F, Esc), zoom of the diagram, undo / redo of hand edits.
  const { full, toggle: toggleFull } = useFullScreen();
  const [zoom, setZoom] = useUi('program.zoom', 1);
  const zoomBy = (f: number) => setZoom(Math.round(Math.min(2, Math.max(0.4, zoom * f)) * 100) / 100);
  const ladderBox = useRef<HTMLDivElement>(null);
  const fitZoom = () => {
    const box = ladderBox.current, w = Number(box?.querySelector('[data-ladder-width]')?.getAttribute('data-ladder-width') ?? 0);
    if (box && w) setZoom(Math.round(Math.min(2, Math.max(0.4, (box.clientWidth - 24) / w)) * 100) / 100);
  };
  // While the AI builds or changes the program, hand edits (undo / redo too) are held: its result would replace them.
  const { editLadder } = store;
  const setLadder = useCallback((p: LadderProgram) => { if (!useProgramStore.getState().isGenerating) editLadder(p); }, [editLadder]);
  const history = useLadderHistory(ladder, setLadder);
  // History: a version before the first hand edit of the visit and before its first rung deletion (once each, so a
  // run of edits never pushes the AI and restore versions out of the history).
  const handSaved = useRef(false), deleteSaved = useRef(false);
  const handEdit = (p: LadderProgram) => {
    if (isGenerating) return;
    if (!handSaved.current && ladder.rungs.length) { store.saveVersion('Before hand edits'); handSaved.current = true; }
    else if (!deleteSaved.current && p.rungs.length < ladder.rungs.length) { store.saveVersion('Before deleting a rung'); deleteSaved.current = true; }
    history.edit(p);
  };
  // The addresses offered when a contact or coil is clicked (the I/O list first, then named tags), with what each is
  // (input, output, bit, timer …) so a coil is not offered an input, and in the PLC's own name (%I0.1 on an S7).
  const { modules } = usePlc();
  const choices = useMemo(() => {
    const rack = { profile: ctx.profile, cpu: ctx.cpu, modules };
    return [...labels].map(([address, label]) => ({ address, label, native: nativeName(rack, address), kind: ctx.profile.parseAddress(address)?.kind ?? (/^X\d/.test(address) ? 'input' : /^Y\d/.test(address) ? 'output' : undefined) }));
  }, [labels, ctx.profile, ctx.cpu, modules]);
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
      `Update the program so it matches the current specification below, keep everything that still applies, and list each change in the explanation.\n\nCurrent specification:\n${specForAI(specText, 'program')}`,
      true,
    );
  };

  // CLICK: a motion axis's pulse must be on a pulse-train output of the CPU's option-slot module.
  const moduleParts = useProjectStore((st) => st.modules);
  const yaskawaMemory = useProjectStore((st) => st.yaskawaMemory);
  const checkOpts = useMemo(() => ({ yaskawaMemory, ...(ctx.profile.id === 'click' ? { pulseOutputs: ptoPointsFor(ctx.cpu.id, moduleParts) } : {}) }), [ctx.profile.id, ctx.cpu.id, moduleParts, yaskawaMemory]);
  const issues = useMemo(() => validateProgram(ladder, ctx.profile, ioAddressSet, hmiDesign ?? undefined, checkOpts), [ladder, ctx.profile, ioAddressSet, hmiDesign, checkOpts]);

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
      issues: validateProgram(proposal.program, ctx.profile, ioAddressSet, hmiDesign ?? undefined, checkOpts),
    };
  }, [proposal, ladder, ctx.profile, ioAddressSet, hmiDesign, checkOpts]);

  const rungNumber = (id: string) => (review?.display ?? ladder).rungs.findIndex((r) => r.id === id) + 1;

  /** Run an AI step as a global job: it keeps going (and its result is applied) when the user leaves the page. */
  const runAI = <T,>(kind: 'program' | 'program-revise', label: string, run: (signal: AbortSignal, stage: (text: string) => void) => Promise<T>, apply: (r: T) => void, needsKey = true) => {
    if ((needsKey && !ready) || isGenerating) return;
    setError(null);
    void startAiJob({
      kind, label,
      run: async (h) => {
        useProgramStore.getState().setIsGenerating(true);
        try { return await run(h.signal, h.stage); } finally { useProgramStore.getState().setIsGenerating(false); }
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
    // A program kept read only on the machine's own PLC is not rebuilt for it (it would get another PLC's memory).
    if (ctx.profile.readOnly) return;
    if (full && !machineText.trim()) return;
    if (ladder.rungs.length && !programLeftOver.leftOver && !confirm(replaceProgramQuestion(useProgramStore.getState()))) return;
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

  /** Reorganize: the transforms found (each with its checkbox), then the chosen ones checked in the simulator. */
  const [reorg, setReorg] = useState<{ plan: ReorgPlan; chosen: Set<SectionId> } | null>(null);
  const openReorganize = () => {
    const plan = planReorganize(collectProject());
    setReorg({ plan, chosen: new Set(plan.sections.filter((x) => x.defaultOn).map((x) => x.id)) });
  };
  const runReorganize = () => {
    if (!reorg) return;
    const { plan, chosen } = reorg;
    setReorg(null);
    return runAI('program-revise', 'Reorganize program', async (signal, stage) => {
      const p = collectProject();
      const program = applyReorganize(p, plan, chosen);
      const plant = p.io.map((x) => ({ address: p.addresses.get(x.id) ?? '', description: x.description, type: x.type, category: x.category }));
      // In a worker: the page stays free, the job bar shows how far it got, Cancel stops it.
      // Against the program as the original PLC runs it (without the code it never runs, when that is removed).
      const check = await checkEquivalenceOffThread(plcBaseline(p, plan, chosen), program, { observe: [...externalAddresses(p)], plant }, {
        signal, onProgress: (done, total) => stage(`checking in the simulator, sequence ${done + 1} of ${total}`),
      });
      return { program, check, before: p.ladder.rungs.length, titles: plan.sections.filter((x) => chosen.has(x.id)).map((x) => x.title) };
    }, (r) => {
      const st = useProgramStore.getState();
      st.addChat({ role: 'user', text: `Reorganize the program: ${r.titles.join('; ')}.` });
      const said = equivalenceSummary(r.check);
      if (r.check.differences.length) { st.addChat({ role: 'assistant', text: `${said}\nNothing is proposed: the reorganized program would not behave the same. Choose fewer changes and try again.`, outcome: 'no-change' }); return; }
      const text = `Reorganized: ${r.titles.join('; ')} (${r.before} rungs → ${r.program.rungs.length}; a removal is kept back when a rung that stays reads it).\n${said}\nAddresses, the I/O and what the HMI reads did not move; kept instructions of the original PLC stay as they were.`;
      st.addChat({ role: 'assistant', text });
      st.setProposal({ program: r.program, explanation: text, reasoning: null });
    }, false);
  };

  /** Simplify blocks with AI: the blocks it may rewrite (each with its checkbox); each rewrite checked before it is kept. */
  const [simp, setSimp] = useState<{ cands: RewriteCandidate[]; chosen: Set<string> } | null>(null);
  const openSimplify = () => {
    const cands = rewriteCandidates(useProgramStore.getState().ladder);
    setSimp({ cands, chosen: new Set(cands.filter((c) => c.ok).map((c) => c.id)) });
  };
  const runSimplify = () => {
    if (!simp) return;
    const chosen = simp.cands.filter((c) => simp.chosen.has(c.id)).map((c) => c.id);
    setSimp(null);
    return runAI('program-revise', 'Simplify blocks with AI', async (signal, stage) => {
      let step = '';
      const r = await simplifyBlocks(collectProject(), ctx, { ...ai, signal }, chosen,
        (a, b, o) => checkEquivalenceOffThread(a, b, o, { signal, onProgress: (done, total) => stage(`${step}, sequence ${done + 1} of ${total}`) }),
        { stage: (t) => { step = t; stage(t); } });
      return { ...r, before: useProgramStore.getState().ladder.rungs.length };
    }, (r) => {
      const st = useProgramStore.getState();
      st.addChat({ role: 'user', text: `Simplify blocks with AI: ${chosen.length} block(s).` });
      const dropped = r.dropped.length ? `\nNot changed:\n${r.dropped.map((d) => `- ${d.name}: ${d.why}`).join('\n')}` : '';
      if (!r.kept.length) { st.addChat({ role: 'assistant', text: `No block was rewritten.${dropped}`, outcome: 'no-change' }); return; }
      const text = `Rewritten by the AI and checked in the simulator (${r.before} rungs → ${r.program.rungs.length}):\n${r.kept.map((k) => `- ${k.name}: ${k.rungsBefore} → ${k.rungsAfter} rungs, ${k.before} → ${k.after} parts. ${k.summary.split(' Not simulated')[0]} ${k.explanation.split('\n')[0]}`).join('\n')}${r.final ? `\nAll of them together: ${r.final.differences.length ? 'different' : r.final.sequences ? `same behaviour in ${r.final.sequences} test sequences (0 differences)` : ''}.` : ''}${dropped}\nAddresses, the I/O and what the HMI reads did not move. Approve to keep it; the current program stays in History.`;
      st.addChat({ role: 'assistant', text });
      st.setProposal({ program: r.program, explanation: text, reasoning: null });
    });
  };

  /** Explain with AI: a paragraph per block, saved with the project (kept while the block's logic stays the same). */
  const handleExplainAi = () => runAI('program-revise', 'Explain the program', (signal, stage) =>
    explainWithAi(collectProject(), { ...ai, signal }, (done, total) => stage(`part ${Math.min(done + 1, total)} of ${total}`)), (r) => {
    saveExplainSummaries({ ...explainSummaries(), ...r.summaries });
    if (r.notes.length) setError(r.notes.join(' '));
  });

  /**
   * Add comments: every blank rung comment, block description and tag comment in plain words (the AI's with a key,
   * else from the I/O names and the cross-reference). Only comments change; it comes as a proposal to approve.
   */
  const handleComments = (rewrite: boolean) => {
    if (rewrite && !confirm('Rewrite every comment of the program, also the ones already there? You approve the result first, and the current program is kept in History.')) return;
    setTab('fix');
    return runAI('program-revise', rewrite ? 'Rewrite all comments' : 'Add comments', (signal) => addComments(collectProject(), { ai: ready && ai.apiKey ? { ...ai, signal } : undefined, rewrite }), (r) => {
      const st = useProgramStore.getState();
      const n = r.rungs + r.blocks + r.tags;
      st.addChat({ role: 'user', text: rewrite ? 'Rewrite all comments.' : 'Add comments.' });
      if (!n) { st.addChat({ role: 'assistant', text: 'Every rung, block and tag already has a comment.', outcome: 'no-change' }); return; }
      const parts = [`${r.rungs} rung comment${r.rungs === 1 ? '' : 's'}`, r.blocks ? `${r.blocks} block description${r.blocks === 1 ? '' : 's'}` : '', r.tags ? `${r.tags} tag comment${r.tags === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
      const text = `Comments ${rewrite ? 'rewritten' : 'added'}: ${parts}${r.byAi ? ` (${r.byAi} written by the AI, the rest from the I/O names and the cross-reference)` : ' (from the I/O names and the cross-reference)'}. Only comments change: the logic and the addresses are the same${rewrite ? '' : ', and the comments already there are kept'}.${r.notes.length ? `\n${r.notes.join('\n')}` : ''}`;
      st.addChat({ role: 'assistant', text });
      st.setProposal({ program: r.program, explanation: text, reasoning: null });
    }, false);
  };

  const handleRevise = (text: string, specUpdate = false) => {
    const req = text.trim();
    if (!req || proposal) return;
    // Earlier turns as plain text; the current program is attached fresh by reviseLadder.
    // The conversation must open with a user turn, so lead with the original request.
    const history = [
      { role: 'user' as const, content: `Machine specification (overview):\n${specForAI(machineText, 'fix-it') || '(program was drawn by hand)'}` },
      ...chat.map((m) => ({ role: m.role, content: m.text })),
    ];
    const scoped = activeBlock !== null && !specUpdate ? `[Block: ${blockName}${activeBlock ? ` (id "${activeBlock}")` : ''}] ${req}` : req;
    store.addChat({ role: 'user', text: scoped });
    setRequest('');
    // A big program: only the chosen block is sent (the AI writes back what it is sent), or the user is told what to do.
    const simBlock = activeBlock === null || specUpdate ? null : activeBlock === GENERAL ? GENERAL_BLOCK : activeBlock;
    const scope = changeScope(ladder, ctx, simBlock, blockName);
    if ('tooBig' in scope) { store.addChat({ role: 'assistant', text: scope.tooBig, outcome: 'no-change' }); return; }
    const sentIds = scope.part ? new Set(scope.program.rungs.map((r) => r.id)) : null;
    const sentIssues = sentIds ? issues.filter((i) => !i.rungId || sentIds.has(i.rungId)) : issues;
    return runAI('program-revise', 'PLC program change', (signal) => reviseLadder({ ...ai, signal }, scope.ctx, scope.program, sentIssues, history, scoped), (r) => {
      const st = useProgramStore.getState();
      if (r.program) {
        // A change asked for one block changes only that block; the rest of the program stays as it is.
        let program = r.program, explanation = r.explanation;
        if (simBlock !== null) {
          const scopedResult = scopeToBlock(ladder, r.program, simBlock, scope.part);
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
          {tabButton('explain', 'Explain')}
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
              {ctx.profile.readOnly ? (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2" data-testid="build-read-only">
                  This program is on the machine's own {ctx.profile.vendor} controller ({ctx.cpu.id}), read only: <Link to="/upgrade" className="underline">choose the PLC to move it to</Link> first, then the program can be built for it.
                </p>
              ) : (
              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="w-full py-3 bg-brand-600 text-white text-sm font-semibold rounded hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? <><Spinner /> Building the program…</> : 'Build program from my project'}
              </button>
              )}
              <div className="text-sm text-gray-700 bg-brand-50 border border-brand-200 rounded px-3 py-2" data-testid="program-sources">
                <div className="font-medium text-gray-800 mb-1">The program is made directly from:</div>
                <ul className="text-xs space-y-0.5">
                  <li>✓ <Link to="/spec" className="underline">Machine description</Link> — {SPEC_SECTIONS.filter((s) => (fp.spec as Record<string, string>)[s.id]?.trim()).length} sections{fp.spec.qa?.trim() ? ' + your answers' : ''}</li>
                  <li>✓ <Link to="/io" className="underline">I/O list</Link> — {io.length} points</li>
                  <li>✓ <Link to="/hmi" className="underline">HMI design</Link>{hmiDesign ? ` — ${hmiDesign.screens.length} screens` : ' — none yet'}</li>
                </ul>
                {specText ? <div className="text-xs text-gray-500 mt-1">You don't need to copy anything here: change the machine description and press Build program from my project.</div> : <div className="text-xs text-amber-800 mt-1">The machine description is empty: describe the machine first.</div>}
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

          {tab === 'explain' && (
            <ExplainPanel aiReady={ready} busy={isGenerating} onExplainWithAi={handleExplainAi}
              onShowBlock={(id) => { setBlock(id || GENERAL); if (narrow) setPhonePane('ladder'); }} />
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
            {ladder.rungs.length > 0 && (
              <div ref={tidyRef} className="flex flex-wrap items-center gap-2 rounded p-1.5 -m-1.5 transition-colors" role="group" aria-label="Tidy up" data-testid="tidy-up">
                <p className="w-full text-xs font-semibold text-gray-700">Simplify &amp; explain</p>
                {proposal && <p className="w-full text-xs text-amber-800" data-testid="tidy-wait">Approve or reject the current proposal first.</p>}
                <button onClick={() => handleComments(false)} disabled={isGenerating || Boolean(proposal)}
                  title="Fill in every missing rung comment, block description and tag comment in plain words; the logic is not changed"
                  className="flex-1 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">Add comments</button>
                <button onClick={() => handleComments(true)} disabled={isGenerating || Boolean(proposal)}
                  title="Write every comment again, also the ones already there (you approve the result first)"
                  className="py-1.5 px-2 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">Rewrite all comments</button>
                <p className="w-full text-[11px] text-gray-500 -mt-1">Adds a plain-words note on every rung, then you can simplify.</p>
                <button onClick={() => (simp ? setSimp(null) : openSimplify())} disabled={isGenerating || Boolean(proposal) || !ready} aria-expanded={Boolean(simp)}
                  title={ready ? 'The AI rewrites the blocks you choose in a simpler shape; each one is kept only if the simulator finds the same behaviour' : 'Add your API key in Settings to use the AI'}
                  className="w-full py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">Simplify blocks with AI…</button>
                <button onClick={() => (reorg ? setReorg(null) : openReorganize())} disabled={isGenerating || Boolean(proposal)} aria-expanded={Boolean(reorg)}
                  title="Rebuild the same behaviour in a simpler shape: grouped by machine function, dead code out, names and comments; checked in the simulator before you approve"
                  className="w-full py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">Reorganize program…</button>
              </div>
            )}
            {simp && !proposal && (
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs space-y-1.5" role="group" aria-label="Simplify blocks">
                <p className="text-gray-600">The AI rewrites each block you choose (one request per block, only that block sent). A rewrite is kept only if it is simpler, writes nothing new and behaves the same in the simulator; nothing changes until you approve.</p>
                {simp.cands.map((c) => (
                  <label key={c.id || 'general'} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5" checked={simp.chosen.has(c.id)} disabled={!c.ok}
                      onChange={(e) => { const s2 = new Set(simp.chosen); if (e.target.checked) s2.add(c.id); else s2.delete(c.id); setSimp({ ...simp, chosen: s2 }); }} />
                    <span><span className="font-medium text-gray-800">{c.name}</span> <span className="text-gray-500">({c.rungs} rung{c.rungs === 1 ? '' : 's'}){c.why ? `: ${c.why}` : ''}</span></span>
                  </label>
                ))}
                <button onClick={runSimplify} disabled={!simp.chosen.size || isGenerating} className="w-full py-1.5 bg-brand-600 text-white rounded font-medium hover:bg-brand-700 disabled:opacity-50">Rewrite and check {simp.chosen.size} block{simp.chosen.size === 1 ? '' : 's'}</button>
              </div>
            )}
            {reorg && !proposal && (
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs space-y-1.5" role="group" aria-label="Reorganize">
                <p className="text-gray-600">Choose the changes. They are checked together in the simulator before they are proposed; nothing changes until you approve.</p>
                {reorg.plan.sections.map((sec) => (
                  <label key={sec.id} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5" checked={reorg.chosen.has(sec.id)} disabled={!sec.items.length && sec.id !== 'comment' && sec.id !== 'reorder'}
                      onChange={(e) => { const c = new Set(reorg.chosen); if (e.target.checked) c.add(sec.id); else c.delete(sec.id); setReorg({ ...reorg, chosen: c }); }} />
                    <span><span className="font-medium text-gray-800">{sec.title}</span><br /><span className="text-gray-500">{sec.note}</span>
                      {sec.items.length > 0 && sec.id !== 'reorder' && <span className="block text-gray-500">{sec.items.slice(0, 4).join(' · ')}{sec.items.length > 4 ? ` · and ${sec.items.length - 4} more` : ''}</span>}</span>
                  </label>
                ))}
                {reorg.plan.findings.length > 0 && (
                  <div className="text-gray-600" data-testid="reorg-findings"><span className="font-medium text-gray-800">Also found (nothing to change):</span>
                    <ul className="list-disc ml-5">{reorg.plan.findings.slice(0, 6).map((f, i) => <li key={i}>{f}</li>)}{reorg.plan.findings.length > 6 && <li>… and {reorg.plan.findings.length - 6} more</li>}</ul>
                  </div>
                )}
                <button onClick={runReorganize} disabled={!reorg.chosen.size || isGenerating} className="w-full py-1.5 bg-brand-600 text-white rounded font-medium hover:bg-brand-700 disabled:opacity-50">Check and propose</button>
              </div>
            )}
            <VoiceTextarea
              value={request}
              onValueChange={setRequest}
              aria-label="Describe a problem or change"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRevise(request); } }}
              rows={3}
              disabled={Boolean(proposal) || !ladder.rungs.length}
              placeholder={proposal ? 'Approve or reject the proposed change first' : ladder.rungs.length ? 'Describe a problem or change… (Enter to send)' : 'Build the program first'}
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
              {proposal?.note && <span className="block text-xs text-indigo-900 mt-0.5" data-testid="proposal-note">{proposal.note}</span>}
              <span className="block text-xs text-indigo-700 mt-0.5">Green = added, amber = changed, red = removed.</span>
            </div>
            <button onClick={store.rejectProposal} className="px-3 py-1.5 text-sm border border-gray-300 bg-white rounded hover:bg-gray-50">Reject</button>
            <button onClick={() => { const fromSpec = proposal?.specUpdate; store.applyProposal(); if (fromSpec) recordSource(); }} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
          </div>
        ) : (
          ladder.rungs.length > 0 && <IssueList issues={issues} rungNumber={rungNumber} plcName={ctx.profile.name} onRebuild={ctx.profile.readOnly ? undefined : () => handleGenerate(false)} />
        )}

        {!review && ladder.rungs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[#f7f8f9] border-b border-gray-200 text-xs">
            <span className="font-semibold text-gray-700">{activeBlock === null ? 'Whole program' : blockName}</span>
            <span className="text-gray-400">{shown.rungs.length} rung{shown.rungs.length === 1 ? '' : 's'}</span>
            {activeBlock !== null && (
              <button onClick={() => { setTab('fix'); handleRevise(`Review and rewrite this block so it fully matches the specification for this part of the machine. Keep its interface (the internal bits other blocks read or write) unless it is wrong, and explain any change to it.\n\nCurrent specification:\n${specForAI(specText, 'program')}`); }}
                disabled={isGenerating || !ready || Boolean(proposal)}
                className="px-2.5 py-1 rounded-sm border border-brand-300 text-brand-800 bg-white hover:bg-brand-50 disabled:opacity-50">
                Regenerate this block
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button onClick={openTidy} data-testid="simplify-explain"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
                title="Comments in plain words on every rung, dead code found, the program grouped by machine function; every change checked in the simulator before you approve">
                <SparklesIcon className="h-3.5 w-3.5" /> Simplify &amp; explain
              </button>
              <span className="mx-1 h-4 border-l border-gray-300" />
              <button onClick={history.undo} disabled={!history.canUndo || isGenerating} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" title="Undo the last hand edit (Ctrl+Z)"><ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Undo</button>
              <button onClick={history.redo} disabled={!history.canRedo || isGenerating} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-brand-50 disabled:opacity-40" title="Redo (Ctrl+Shift+Z / Ctrl+Y)"><ArrowUturnRightIcon className="h-3.5 w-3.5" /> Redo</button>
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
            {isGenerating && (
              <div className="sticky left-0 top-0 z-20 flex items-center gap-2 border-b border-gray-200 bg-[#f7f8f9] px-3 py-2 text-xs text-gray-700">
                <Spinner className="h-3.5 w-3.5 text-brand-800" /> The AI is working on the program. Hand edits are paused until it finishes, so they are not lost.
              </div>
            )}
            {ladder.sequence && (activeBlock === null || activeBlock === 'cycle') && <SequenceTable sequence={ladder.sequence} labels={labels} plcNames={plcNames} />}
            <LadderView
              plcNames={plcNames}
              program={shown}
              onChange={isGenerating ? undefined : activeBlock === null ? handEdit : (p) => handEdit(mergeBlock(ladder, activeBlock, p))}
              zoom={zoom}
              numberOf={activeBlock === null ? undefined : realNumber}
              labels={labels}
              issues={issues}
              selectedRungId={selectedRungId}
              onSelectRung={setSelectedRungId}
              progressive
              editTools
              choices={choices}
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
                onClick={() => handEdit({ rungs: [{ id: 'r_first', comment: '', branches: [[{ type: 'NO', address: '' }]], outputs: [{ type: 'OUT', address: '' }] }], tags: [] })}
                className="mt-2 px-3 py-1.5 text-sm rounded bg-brand-600 text-white font-medium hover:bg-brand-700"
              >
                Start empty program
              </button>
              {/* The last rung deleted by hand: one click brings it back. */}
              {history.canUndo && (
                <button onClick={history.undo} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border bg-white border-gray-300 text-gray-700 hover:bg-gray-50" title="Undo the last hand edit (Ctrl+Z)">
                  <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Undo
                </button>
              )}
            </div>
          )}
        </div>
        {hasRungs && (narrow ? pane === 'xref' : xrefOpen) && (
          <ResizablePane id="program.xref" defaultSize={340} min={240} max={700} handle="left" fill={narrow} panel={phonePanel(narrow, 'program', 'xref')} className={narrow ? 'overflow-auto' : 'border-l border-gray-200'}>
            <CrossRefPanel program={ladder} labelOf={labelOf} plcNames={plcNames} address={xrefAddress} onAddress={setXrefAddress}
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
          issues={issues} labels={labels} analog={analog} plcNames={plcNames} onClose={() => setPrinting(false)} />
      )}
    </div>
  );
}
