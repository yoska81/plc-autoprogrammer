import { Fragment, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHmiStore } from '../store/useHmiStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStageStore } from '../store/useStageStore';
import { usePlc } from '../plc/core/usePlc';
import { useFingerprints, useStages, hmiFingerprint } from '../spec/useStages';
import { HMI_MODELS, MIN_DESIGN_PX, designable, getHmi, hmiCommsText, hmiMaker, hmiMakerOf, isCmore, HMI_DESIGN_GUIDELINES, type HmiModel } from '../hmi/hmiCatalog';
import { catalogPanels } from '../hmi/panels';
import { setProjectPanel } from '../hmi/retarget';
import { hmiFit, type Need } from '../plc/core/fit';
import { generateHmiDesign, recreateScreenFromPicture } from '../lib/ai/hmiAI';
import { generateRuleBasedHmi, projectHmiContent } from '../lib/ai/hmiContentAI';
import { buildHmi } from '../hmi/engine';
import { markEdited, mergeRegenerated, rebuildScreen } from '../hmi/engine/regenerate';
import { useElectricalStore } from '../store/useElectricalStore';
import { useNoTouchPanel } from '../hmi/projectPanel';
import { operatorDevices } from '../deliverables/docs/operatorStation';
import { useProgramStore } from '../store/useProgramStore';
import { collectProject } from '../deliverables/collect';
import { plcTagNameOf } from '../deliverables/plcTagNames';
import { withTagNames } from '../hmi/tagLabels';
import { specToText } from '../spec/types';
import HmiScreenView from '../hmi/HmiScreenView';
import StageBanner from '../components/StageBanner';
import ResizablePane from '../components/ResizablePane';
import { Spinner, ReasoningPanel } from '../components/common';
import { type AccessLevel, type HmiAlarm, type HmiBackground, type HmiDesign, type HmiElement, type HmiElementKind, type HmiScreen, type HmiState, type HmiStyle, type HmiTag, type MachineSymbol } from '../hmi/types';
import ScreenEditor from '../hmi/ScreenEditor';
import HmiEditorBar from '../hmi/HmiEditorBar';
import { addNavEntry, alignElements, createElement, createImageElement, deleteElements, distributeElements, duplicateElements, renameScreen, restack, setScreenLevel as setLevelOf, syncHandTags, type Align } from '../hmi/editor';
import { backgroundAt, croppedBackground, loadPicture, panelImage, pictureRect, pictureSize } from '../hmi/background';
import { useProjectsStore } from '../store/useProjectsStore';
import { notify } from '../store/useNoticeStore';
import { checkDesign, layoutBands, MIN_TOUCH, type LayoutIssue } from '../hmi/layout';
import { defaultLookFor, LEVEL_LABEL } from '../hmi/theme';
import LookPicker from '../hmi/LookPicker';
import AssumptionsUsed from '../components/questions/AssumptionsUsed';
import { useQuestions } from '../components/questions/useQuestionStore';
import { useDraft } from '../store/useDraftStore';
import { useUi } from '../store/useUiStore';
import { withAnalogScale } from '../hmi/analogScale';
import { startAiJob, useAiJobError, useAiJobRunning, useTakeResult } from '../lib/ai/jobs';
import SpeakButton from '../voice/SpeakButton';
import { useEditsStore } from '../edits/useEditsStore';
import { alarmEdit, alarmKey } from '../edits/hmiTexts';
import { EditableCell } from '../edits/EditedMark';

/** Panels listed in the picker: those that can talk to the PLC at all (no machine-specific needs). */
const ANY_NEED: Need = { digitalInputs: 0, digitalOutputs: 0, analogInputs: 0, analogOutputs: 0, ethernetHmi: true, minHmiSizeIn: null };

const input = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
const fieldLabel = 'block text-[11px] font-medium text-gray-500 uppercase tracking-wide';

const KIND_LABEL: Record<HmiElement['kind'], string> = {
  header: 'Header bar', panel: 'Group frame', button: 'Push button', nav: 'Screen change', indicator: 'Indicator lamp', multistate: 'Multistate text',
  numeric: 'Numeric display', 'numeric-entry': 'Numeric entry (setpoint)', bar: 'Bar graph', trend: 'Trend', machine: 'Machine graphic',
  'alarm-list': 'Alarm table', 'alarm-banner': 'Alarm banner', datetime: 'Date / time', text: 'Static text', image: 'Picture',
};
const READS = new Set<HmiElement['kind']>(['header', 'button', 'indicator', 'multistate', 'numeric', 'numeric-entry', 'bar', 'trend']);
const STYLES: [HmiStyle, string][] = [['normal', 'Normal'], ['ok', 'OK (green)'], ['warning', 'Warning (amber)'], ['alarm', 'Alarm (red)']];

const statesToText = (s: HmiState[] | undefined) => (s ?? []).map((x) => `${x.value} = ${x.text}${x.style !== 'normal' ? ` : ${x.style}` : ''}`).join('\n');
function textToStates(t: string): HmiState[] {
  return t.split('\n').flatMap((line) => {
    const m = /^\s*(-?\d+)\s*=\s*([^:]+?)\s*(?::\s*(normal|ok|warning|alarm))?\s*$/i.exec(line);
    return m ? [{ value: Number(m[1]), text: m[2], style: (m[3]?.toLowerCase() ?? 'normal') as HmiStyle }] : [];
  });
}

/** A neutral memory address with the PLC's tag for it (Allen-Bradley / Siemens), else just the address. */
function AddressCell({ address, tag }: { address: string; tag?: string | null }) {
  if (!tag || tag === address) return <>{address}</>;
  return <span className="inline-flex flex-col leading-tight"><span>{tag}</span><span className="text-[10px] text-gray-400">{address}</span></span>;
}

function ElementEditor({ el, screens, onChange, onDelete, tagName }: { el: HmiElement; screens: HmiScreen[]; onChange: (e: HmiElement) => void; onDelete: () => void; tagName?: ((a: string) => string | null) | null }) {
  const [statesText, setStatesText] = useState(() => statesToText(el.states));
  const [symbolsText, setSymbolsText] = useState(() => JSON.stringify(el.symbols ?? [], null, 1));
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const num = (k: 'x' | 'y' | 'w' | 'h') => (
    <label className={fieldLabel}>{k}
      <input type="number" value={el[k]} onChange={(e) => onChange({ ...el, [k]: Number(e.target.value) })} className={`${input} w-full font-mono`} />
    </label>
  );
  const optNum = (k: 'min' | 'max', label: string) => (
    <label className={fieldLabel}>{label}
      <input type="number" value={el[k] ?? ''} onChange={(e) => onChange({ ...el, [k]: e.target.value === '' ? null : Number(e.target.value) })} className={`${input} w-full`} />
    </label>
  );
  const text = (k: 'onText' | 'offText' | 'units' | 'note', label: string) => (
    <label className={fieldLabel}>{label}
      <input value={el[k] ?? ''} onChange={(e) => onChange({ ...el, [k]: e.target.value || null })} className={`${input} w-full normal-case`} />
    </label>
  );
  const touchSmall = (el.kind === 'button' || el.kind === 'nav' || el.kind === 'numeric-entry') && (el.w < MIN_TOUCH.w || el.h < MIN_TOUCH.h);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-800">{KIND_LABEL[el.kind] ?? el.kind}</span>
        <span className="font-mono text-[11px] text-gray-400">{el.id}</span>
      </div>
      <label className={fieldLabel}>{el.kind === 'header' ? 'Machine name' : el.kind === 'panel' ? 'Group title' : 'Label'}
        <input value={el.label} onChange={(e) => onChange({ ...el, label: e.target.value })} className={`${input} w-full`} />
      </label>
      {READS.has(el.kind) && (
        <label className={fieldLabel}>{el.kind === 'header' ? 'Mode bit / register' : 'PLC address'}
          <input value={el.address ?? ''} onChange={(e) => onChange({ ...el, address: e.target.value.toUpperCase().trim() || null })} className={`${input} w-full font-mono`} placeholder="e.g. C1001, DS1001" list="hmi-address-options" aria-label="PLC address" />
          {el.address && tagName?.(el.address) && <span className="block mt-0.5 text-[11px] font-mono text-gray-600 normal-case" data-testid="plc-tag">PLC tag: {tagName(el.address)}</span>}
        </label>
      )}
      {el.kind === 'button' && (
        <div className="grid grid-cols-2 gap-2">
          <label className={fieldLabel}>Action
            <select value={el.action ?? 'momentary'} onChange={(e) => onChange({ ...el, action: e.target.value as HmiElement['action'] })} className={`${input} w-full`}>
              <option value="momentary">Momentary (hold)</option><option value="set">Set</option><option value="reset">Reset</option><option value="toggle">Toggle</option>
            </select>
          </label>
          <label className={fieldLabel}>Interlock bit
            <input value={el.interlock ?? ''} onChange={(e) => onChange({ ...el, interlock: e.target.value.toUpperCase().trim() || null })} className={`${input} w-full font-mono`} placeholder="none" list="hmi-address-options" />
          </label>
        </div>
      )}
      {(el.kind === 'nav' || el.kind === 'header') && (
        <label className={fieldLabel}>{el.kind === 'header' ? 'Alarm counter opens' : 'Goes to screen'}
          <select value={el.targetScreenId ?? ''} onChange={(e) => onChange({ ...el, targetScreenId: e.target.value || null })} className={`${input} w-full`}>
            <option value="">(none)</option>
            {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      {(el.kind === 'indicator' || (el.kind === 'button' && el.action === 'toggle')) && (
        <div className="grid grid-cols-2 gap-2">{text('onText', 'Text when ON')}{text('offText', 'Text when OFF')}</div>
      )}
      {['button', 'indicator', 'bar', 'trend', 'text'].includes(el.kind) && (
        <label className={fieldLabel}>Colour (ON / meaning)
          <select value={el.style} onChange={(e) => onChange({ ...el, style: e.target.value as HmiStyle })} className={`${input} w-full`}>
            {STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      )}
      {['numeric', 'numeric-entry', 'bar', 'trend'].includes(el.kind) && (
        <div className="grid grid-cols-3 gap-2">{text('units', 'Units')}{optNum('min', 'Min')}{optNum('max', 'Max')}</div>
      )}
      {(el.kind === 'multistate' || el.kind === 'header') && (
        <label className={fieldLabel}>{el.kind === 'header' ? 'Mode texts' : 'States'} <span className="normal-case font-normal text-gray-400">one per line: value = Text : ok|warning|alarm</span>
          <textarea rows={4} value={statesText} onChange={(e) => { setStatesText(e.target.value); onChange({ ...el, states: textToStates(e.target.value) }); }} className={`${input} w-full font-mono text-xs`} />
        </label>
      )}
      {el.kind === 'machine' && (
        <label className={fieldLabel}>Symbols (JSON, positions relative to the graphic)
          <textarea rows={6} value={symbolsText} className={`${input} w-full font-mono text-[11px]`}
            onChange={(e) => {
              setSymbolsText(e.target.value);
              try { onChange({ ...el, symbols: JSON.parse(e.target.value) as MachineSymbol[] }); setSymbolsError(null); } catch { setSymbolsError('Not valid JSON yet'); }
            }} />
          {symbolsError && <span className="text-red-600 normal-case">{symbolsError}</span>}
        </label>
      )}
      {!['header', 'panel', 'nav', 'text', 'alarm-banner', 'datetime'].includes(el.kind) && (
        <label className={fieldLabel}>Access level
          <select value={el.level ?? 'operator'} onChange={(e) => { const v = e.target.value as AccessLevel; const next = { ...el }; if (v === 'operator') delete next.level; else next.level = v; onChange(next); }} className={`${input} w-full`}>
            {(Object.keys(LEVEL_LABEL) as AccessLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}{l === 'operator' ? ' (no password)' : ' password'}</option>)}
          </select>
        </label>
      )}
      <div>
        <div className={fieldLabel}>Position and size (px)</div>
        <div className="grid grid-cols-4 gap-1 mt-0.5">{num('x')}{num('y')}{num('w')}{num('h')}</div>
        {touchSmall && <p className="text-xs text-amber-700 mt-1">Touch target is smaller than {MIN_TOUCH.w}×{MIN_TOUCH.h} px.</p>}
      </div>
      {text('note', 'Engineer note')}
      <button onClick={onDelete} className="text-xs text-red-600 hover:underline">Delete element</button>
    </div>
  );
}

function ScreenInfo({ screen, issues, onLevel, onRename, onDelete, onRebuild }: { screen: HmiScreen; issues: LayoutIssue[]; onLevel: (l: AccessLevel) => void; onRename: (name: string) => void; onDelete?: () => void; onRebuild?: () => void }) {
  const counts = new Map<string, number>();
  for (const e of screen.elements) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const addresses = new Set(screen.elements.flatMap((e) => [e.address, e.interlock ?? null].filter(Boolean)));
  return (
    <div className="space-y-3 text-sm">
      <label className={fieldLabel}>Screen name
        <input value={screen.name} onChange={(e) => onRename(e.target.value)} className={`${input} w-full normal-case`} aria-label="Screen name" />
      </label>
      {screen.purpose && <p className="text-xs text-gray-500">{screen.purpose}</p>}
      <label className={fieldLabel}>Screen access
        <select value={screen.level ?? 'operator'} onChange={(e) => onLevel(e.target.value as AccessLevel)} className={`${input} w-full`}>
          {(Object.keys(LEVEL_LABEL) as AccessLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}{l === 'operator' ? ' (open)' : ' password'}</option>)}
        </select>
      </label>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-gray-500">Elements</dt><dd className="text-gray-800 font-medium">{screen.elements.length}</dd>
        <dt className="text-gray-500">PLC addresses</dt><dd className="text-gray-800 font-medium">{addresses.size}</dd>
        <dt className="text-gray-500">Layout check</dt>
        <dd className={issues.length ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>{issues.length ? `${issues.length} to review` : 'OK'}</dd>
      </dl>
      <div className="flex flex-wrap gap-1">
        {[...counts].map(([k, n]) => <span key={k} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{n} × {KIND_LABEL[k as HmiElement['kind']] ?? k}</span>)}
      </div>
      <p className="text-xs text-gray-400">Click an element on the screen to edit it.</p>
      {screen.edited && <p className="text-xs text-gray-500">Edited by hand: kept when the screens are regenerated.</p>}
      {screen.edited && onRebuild && <button onClick={onRebuild} className="block text-xs text-brand-700 hover:underline">Rebuild this screen from scratch</button>}
      {onDelete && <button onClick={onDelete} className="text-xs text-red-600 hover:underline">Delete this screen</button>}
    </div>
  );
}

function PanelSpecs({ model, design }: { model: HmiModel; design: HmiDesign }) {
  const b = layoutBands(model.widthPx, model.heightPx);
  const gcd = (a: number, c: number): number => (c ? gcd(c, a % c) : a);
  const g = gcd(model.widthPx, model.heightPx);
  const items: [string, string][] = [
    ['Panel', `${model.partNumber} · ${isCmore(model) ? model.family : `${hmiMaker(model)} ${model.family}`}`],
    ['Display', `${model.sizeIn}" ${model.color ? 'colour' : 'mono'} ${model.touch ? 'touch' : ''}`],
    ['Resolution', `${model.widthPx} × ${model.heightPx} px (${model.widthPx / g}:${model.heightPx / g})`],
    ['Bands', `header ${b.header.h} px · nav ${b.nav.h} px`],
    ['Screens', String(design.screens.length)],
    ['Tags / alarms', `${design.tags.length} / ${design.alarms.length}`],
    ['PLC link', isCmore(model) ? (model.supportsClickEthernet ? 'CLICK Ethernet (Modbus TCP 502)' : 'Serial') : "Maker's PLC driver (Ethernet)"],
    ...(model.software ? [['Software', model.software] as [string, string]] : []),
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {items.map(([k, v]) => <Fragment key={k}><dt className="text-gray-500 whitespace-nowrap">{k}</dt><dd className="text-gray-800">{v}</dd></Fragment>)}
    </dl>
  );
}

function PictureButton({ label, onFile, small }: { label: string; onFile: (f: File) => void; small?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <button onClick={() => ref.current?.click()}
        className={small ? 'px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-brand-50' : 'px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50'}>{label}</button>
    </>
  );
}

/** Alarm message the user can rewrite; kept when the screens are generated again. */
function AlarmText({ alarm }: { alarm: HmiAlarm }) {
  const texts = useEditsStore((s) => s.texts);
  const found = alarmEdit(alarm, texts);
  const generated = found?.edit.generated ?? alarm.message;
  const setMessage = (message: string) => {
    const hmi = useHmiStore.getState();
    if (!hmi.design) return;
    hmi.setDesign({ ...hmi.design, alarms: hmi.design.alarms.map((x) => (x.address === alarm.address ? { ...x, message } : x)) }, hmi.explanation);
  };
  return (
    <EditableCell value={alarm.message} label={`Alarm message ${alarm.address}`} edited={Boolean(found)} generated={generated}
      onCommit={(v) => { if (!v.trim()) return; useEditsStore.getState().setText(alarmKey(generated), v, generated); setMessage(v); }}
      onReset={() => { useEditsStore.getState().resetText(found?.key ?? alarmKey(generated)); setMessage(generated); }} />
  );
}

type Tab = 'tags' | 'alarms' | 'check' | 'notes';

export default function HmiPage() {
  const hmi = useHmiStore();
  const settings = useSettingsStore();
  const showExperimental = !!settings.showExperimental;
  const { profile, cpu, io, addresses } = usePlc();
  const fp = useFingerprints();
  const stages = useStages();

  const [localError, setError] = useState<string | null>(null);
  // AI generation and "recreate from picture" run as global jobs (they keep going across pages).
  const genError = useAiJobError('hmi'), recreateError = useAiJobError('hmi-recreate');
  const error = localError ?? genError ?? recreateError;
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  // ?screen= wins; without it (navigating back from another page) the last screen shown.
  const [lastScreen, setLastScreen] = useUi<string | null>('hmi.screen', null);
  const screenId = params.get('screen') ?? lastScreen;
  const setScreenId = (id: string | null) => { setLastScreen(id); setParams(id ? { screen: id } : {}, { replace: true }); };
  const [sel, setSel] = useUi<string[]>('hmi.selection', []);
  const selected = sel.length === 1 ? sel[0] : null;
  const setSelected = (id: string | null) => setSel(id ? [id] : []);
  const [editing, setEditing] = useUi('hmi.editing', false);
  const [snapOn, setSnapOn] = useUi('hmi.snap', true);
  const aiBusy = useAiJobRunning('hmi-recreate');
  const [proposal, setProposal] = useDraft<{ screenId: string; elements: HmiElement[]; tags: HmiTag[]; explanation: string } | null>('hmi.proposal', null);
  const activeProject = useProjectsStore((s) => s.activeId);
  const [choosing, setChoosing] = useState(false);
  const [tab, setTab] = useUi<Tab>('hmi.tab', 'tags');
  const [tagFilter, setTagFilter] = useUi('hmi.tagFilter', '');

  // Equipment chosen with "No touch panel": pushbuttons and lamps only. Screens left from an earlier
  // panel are kept (choosing a panel again brings them back) but not shown, regenerated or exported.
  const noPanel = useNoTouchPanel();
  const leftover = noPanel ? hmi.design : null;
  const chosenPanel = noPanel ? undefined : getHmi(hmi.design?.hmiPartNumber ?? hmi.hmiPartNumber);
  // A panel too small for touch screens (e.g. a 128×64 C-more Micro text display) is not designed for.
  const model = chosenPanel && designable(chosenPanel) ? chosenPanel : undefined;
  const apiKey = settings.anthropicApiKey;
  const design = noPanel ? null : hmi.design;
  // "To confirm" items, answered under each one.
  const hmiQuestionsRaw = useQuestions('hmi');
  // Allen-Bradley / Siemens: the exported program's tag of each neutral address (null on CLICK, where they are the same).
  const ladder = useProgramStore((s) => s.ladder);
  const tagName = useMemo(() => {
    if (profile.id === 'click') return null;
    try {
      const of = plcTagNameOf(collectProject());
      return (a: string) => of(a).name || null;
    } catch { return null; }
    // collectProject reads the stores; recompute when what it names changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, ladder, design, io, addresses]);
  const tagged = (text: string) => withTagNames(text, tagName);
  const hmiQuestions = useMemo(() => hmiQuestionsRaw.map((q) => ({ ...q, text: withTagNames(q.text, tagName) })), [hmiQuestionsRaw, tagName]);
  const screen = design?.screens.find((s) => s.id === screenId) ?? design?.screens[0] ?? null;
  const selectedEl = screen?.elements.find((e) => e.id === selected) ?? null;
  const issues = useMemo(() => (design && model ? checkDesign(design, model.widthPx, model.heightPx, { text: true }) : []), [design, model]);
  const usedOn = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of design?.screens ?? []) for (const e of s.elements) {
      for (const a of [e.address, e.interlock ?? null, ...(e.symbols ?? []).map((x) => x.address)]) {
        if (!a) continue;
        const k = a.toUpperCase();
        const list = m.get(k) ?? [];
        if (!list.includes(s.name)) list.push(s.name);
        m.set(k, list);
      }
    }
    return m;
  }, [design]);

  // ── Manual editing: every change is one undo step; hand-placed addresses become HMI tags ──
  const ioDesc = useMemo(() => new Map(io.map((p) => [(addresses.get(p.id) ?? '').toUpperCase(), p.description])), [io, addresses]);
  const [hist, setHist] = useState<{ project: string | null; past: HmiDesign[]; future: HmiDesign[] }>({ project: activeProject, past: [], future: [] });
  // Undo never reaches into another project.
  if (hist.project !== activeProject) setHist({ project: activeProject, past: [], future: [] });
  const W = model?.widthPx ?? 800;
  const H = model?.heightPx ?? 480;
  const bounds = { w: W, h: H };
  const commit = (next: HmiDesign) => {
    if (design) setHist((h) => ({ ...h, past: [...h.past, design].slice(-100), future: [] }));
    // Screens changed by hand are marked edited: a regeneration keeps them.
    hmi.setDesign(syncHandTags(markEdited(design, next), (a) => ioDesc.get(a)), hmi.explanation);
  };
  /** "Rebuild this screen": the rules' version of this screen replaces the hand-edited one (one undo step). */
  const rebuildThis = (id: string) => {
    if (!design || !model) return;
    const gen = buildHmi(projectHmiContent({ io, addresses, machineName: design.machineName || useProgramStore.getState().projectName, spec: specToText(fp.spec), electrical: useElectricalStore.getState().design, panel: model }),
      { ...model, plcText: `${profile.vendor} ${cpu.label} · HMI ${model.partNumber}` });
    const next = rebuildScreen(design, gen, id);
    if (!next) { notify('This screen is not one the generator makes (you added it), so it cannot be rebuilt.'); return; }
    setHist((h) => ({ ...h, past: [...h.past, design].slice(-100), future: [] }));
    hmi.setDesign(next, hmi.explanation);
  };
  const stepHistory = (dir: 'undo' | 'redo') => {
    const from = dir === 'undo' ? hist.past : hist.future;
    if (!from.length || !design) return;
    const target = from[from.length - 1];
    setHist(dir === 'undo'
      ? { ...hist, past: hist.past.slice(0, -1), future: [...hist.future, design] }
      : { ...hist, future: hist.future.slice(0, -1), past: [...hist.past, design] });
    hmi.setDesign(target, hmi.explanation);
  };
  const updateScreen = (next: HmiScreen) => { if (design) commit({ ...design, screens: design.screens.map((x) => (x.id === next.id ? next : x)) }); };
  const usedIds = () => new Set((design?.screens ?? []).flatMap((x) => x.elements.map((e) => e.id)));
  const idMaker = (prefix = 'el') => {
    const used = usedIds();
    let n = 1;
    return () => { while (used.has(`${prefix}_${n}`)) n++; const id = `${prefix}_${n}`; used.add(id); return id; };
  };
  const addElement = (kind: HmiElementKind) => {
    if (!screen) return;
    const el = createElement(kind, idMaker()(), W / 2, H / 2, bounds, snapOn ? 8 : 1);
    updateScreen({ ...screen, elements: [...screen.elements, el] });
    setSel([el.id]);
  };
  const editorKey = (action: 'delete' | 'duplicate' | 'undo' | 'redo') => {
    if (!screen) return;
    if (action === 'undo' || action === 'redo') { stepHistory(action); return; }
    if (!sel.length) return;
    if (action === 'delete') { updateScreen(deleteElements(screen, sel)); setSel([]); return; }
    const d = duplicateElements(screen, sel, idMaker(), bounds);
    updateScreen(d.screen);
    setSel(d.ids);
  };
  const pictureFor = async (file: File) => {
    const pic = await loadPicture(file, W, H);
    if (pic.warning) notify(pic.warning);
    return { src: pic.src, fit: 'fit' as const, dim: 0.3, name: file.name } satisfies HmiBackground;
  };
  const addScreen = async (file?: File) => {
    if (!model) return;
    try {
      const background = file ? await pictureFor(file) : undefined;
      const base: HmiDesign = design ?? { hmiPartNumber: model.partNumber, screens: [], alarms: [], tags: [], notes: [], generatedAt: new Date().toISOString() };
      const ids = new Set(base.screens.map((x) => x.id));
      let n = base.screens.length + 1;
      while (ids.has(`screen_${n}`)) n++;
      const makeId = idMaker();
      // A blank screen keeps the header and navigation bar of the first screen; a picture screen starts empty.
      const frame = !file && base.screens[0] ? base.screens[0].elements.filter((e) => e.kind === 'header' || e.kind === 'nav').map((e) => ({ ...structuredClone(e), id: makeId() })) : [];
      const name = file ? file.name.replace(/\.[^.]+$/, '').slice(0, 24) || `Screen ${n}` : `Screen ${n}`;
      const sc: HmiScreen = { id: `screen_${n}`, name, purpose: file ? 'Made by hand on top of a picture.' : 'Made by hand.', elements: frame, ...(background ? { background } : {}) };
      // Reachable on the panel: a button for it in every screen's navigation bar.
      const nav = addNavEntry({ ...base, screens: [...base.screens, sc] }, sc.id, name, makeId);
      commit(nav.design);
      if (!nav.added && base.screens.length) notify(`${nav.reason} Add a "Screen button" for "${name}" by hand so it can be reached on the panel.`);
      setScreenId(sc.id);
      setSel([]);
      setEditing(true);
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    }
  };
  const deleteScreen = (id: string) => {
    if (!design || design.screens.length < 2) return;
    if (!confirm(`Delete the screen "${design.screens.find((x) => x.id === id)?.name}"? You can undo this while the page is open.`)) return;
    commit({
      ...design,
      screens: design.screens.filter((x) => x.id !== id).map((x) => ({ ...x, elements: x.elements.map((e) => (e.targetScreenId === id ? { ...e, targetScreenId: null } : e)) })),
    });
    setScreenId(null);
    setSel([]);
  };
  const setBackground = (patch: Partial<HmiBackground> | null) => {
    if (!screen) return;
    if (patch === null) { const next = { ...screen }; delete next.background; updateScreen(next); return; }
    if (screen.background) updateScreen({ ...screen, background: { ...screen.background, ...patch } });
  };
  const [pictureHint, setPictureHint] = useState<string | null>(null);
  const addPictureElement = async (file: File) => {
    if (!screen) return;
    try {
      const pic = await loadPicture(file, W, H);
      if (pic.warning) notify(pic.warning);
      const el = createImageElement(idMaker()(), pic.src, pic.width, pic.height, file.name.replace(/\.[^.]+$/, ''), bounds);
      updateScreen({ ...screen, elements: [...screen.elements, el] });
      setSel([el.id]);
      setPictureHint('Drag the picture to move it; drag a corner to resize it (hold Shift to stretch). "Send to back" puts it behind the buttons.');
    } catch (err) { notify(err instanceof Error ? err.message : String(err)); }
  };
  const backgroundToPicture = async () => {
    if (!screen?.background) return;
    const bg = screen.background, at = screen;
    // The picture keeps where and how big it was shown (Move / Zoom, fit) and its dimming.
    let src = bg.src, rect = { x: 0, y: 0, w: W, h: H };
    try {
      if (bg.fit === 'fill') src = await croppedBackground(bg, W, H);
      else { const n = await pictureSize(bg.src); rect = pictureRect(bg, W, H, n.width, n.height); }
    } catch { /* unreadable picture: whole screen */ }
    const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.max(1, Math.round(rect.w)), h: Math.max(1, Math.round(rect.h)) };
    const el = { ...createImageElement(idMaker()(), src, W, H, bg.name?.replace(/\.[^.]+$/, '') ?? 'Picture', bounds), ...r, ...(bg.dim > 0 ? { dim: bg.dim } : {}) };
    const next = { ...at, elements: [el, ...at.elements] };
    delete next.background;
    updateScreen(next);
    setSel([el.id]);
    setPictureHint('The picture is now an element: drag it to move, drag a corner to resize. "Use as background" turns it back.');
  };
  const pictureToBackground = () => {
    const el = screen?.elements.find((e) => sel.length === 1 && e.id === sel[0] && e.kind === 'image');
    if (!screen || !el?.src) return;
    updateScreen({ ...screen, elements: screen.elements.filter((e) => e.id !== el.id), background: { src: el.src, ...backgroundAt(el, W, H), dim: el.dim ?? 0, name: el.label } });
    setSel([]);
  };
  const uploadBackground = async (file: File) => {
    if (!screen) return;
    try { updateScreen({ ...screen, background: { ...(await pictureFor(file)), ...(screen.background ? { fit: screen.background.fit, dim: screen.background.dim } : {}) } }); } catch (err) { notify(err instanceof Error ? err.message : String(err)); }
  };
  const recreate = async () => {
    if (!screen?.background || !model || !design || aiBusy) return;
    setError(null);
    const bg = screen.background, target = { id: screen.id, name: screen.name }, tags = design.tags, screens = design.screens.map((x) => ({ id: x.id, name: x.name }));
    void startAiJob({
      kind: 'hmi-recreate', label: `Recreating "${target.name}" from the picture`, keepResult: true,
      run: async (h) => ({ screenId: target.id, ...(await recreateScreenFromPicture({
        apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal, hmi: model,
        panelImageJpeg: await panelImage(bg, W, H), screenName: target.name, io, addresses, tags, screens,
      })) }),
    });
  };
  useTakeResult<{ screenId: string } & Awaited<ReturnType<typeof recreateScreenFromPicture>>>('hmi-recreate', (r) => {
    const makeId = idMaker('ai');
    setProposal({ screenId: r.screenId, elements: r.elements.map((e) => ({ ...e, id: makeId() })), tags: r.tags, explanation: r.explanation });
  });
  const acceptProposal = (replace: boolean) => {
    if (!proposal || !design) return;
    const known = new Set(design.tags.map((t) => t.address.toUpperCase()));
    commit({
      ...design,
      screens: design.screens.map((x) => (x.id === proposal.screenId ? { ...x, elements: [...(replace ? x.elements.filter((e) => e.kind === 'header' || e.kind === 'nav') : x.elements), ...proposal.elements] } : x)),
      tags: [...design.tags, ...proposal.tags.filter((t) => t.address && !known.has(t.address.toUpperCase()))],
    });
    setSel(proposal.elements.map((e) => e.id));
    setProposal(null);
  };
  const addressOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of io) { const a = addresses.get(p.id); if (a) m.set(a.toUpperCase(), `${p.type === 'input' ? 'Input' : 'Output'}: ${p.description}`); }
    for (const t of design?.tags ?? []) if (!m.has(t.address.toUpperCase())) m.set(t.address.toUpperCase(), `${t.name}: ${t.description}`);
    return [...m];
  }, [io, addresses, design?.tags]);

  /**
   * Generate: the rule-based engine builds every screen from the I/O list (seconds, no key needed); with
   * a key the AI only names things and adds the cycle's machine states. `full` = the older all-AI
   * design (experimental: the AI lays out every element).
   */
  const generate = (full = false) => {
    if (!model || hmi.isGenerating || (full && !apiKey)) return;
    // An HMI the generator did not make (drawn by hand, the example, an AI full design): its unedited screens would be replaced.
    const current = useHmiStore.getState().design;
    if (!full && current?.screens.length && !current.notes?.some((n) => n.startsWith('Rule-based HMI')) && !current.screens.every((s) => s.edited)
      && !confirm('This HMI was not made by the screen generator. Redesign replaces every screen you have not edited here with generated ones; every address keeps its function. You can undo this. Continue?')) return;
    setError(null);
    const look = design?.look, snap = { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp };
    void startAiJob({
      kind: 'hmi', label: full ? 'HMI screens (full AI)' : 'HMI screens', keepResult: true,
      run: async (h) => {
        useHmiStore.getState().setIsGenerating(true);
        try {
          if (full) {
            return await generateHmiDesign({
              apiKey, model: settings.anthropicModel, effort: settings.effort, signal: h.signal,
              hmi: model, guidelines: HMI_DESIGN_GUIDELINES, comms: hmiCommsText(model, profile.id, `${profile.vendor} ${cpu.label}`),
              spec: fp.spec, io, addresses, profile, cpu,
            });
          }
          return await generateRuleBasedHmi({
            apiKey: apiKey || undefined, model: settings.anthropicModel, effort: settings.effort, signal: h.signal,
            io, addresses, spec: specToText(fp.spec), machineName: useProgramStore.getState().projectName,
            electrical: useElectricalStore.getState().design, panel: model, plcText: `${profile.vendor} ${cpu.label} · HMI ${model.partNumber}`,
            existingHmi: useHmiStore.getState().design, program: useProgramStore.getState().ladder,
          });
        } finally { useHmiStore.getState().setIsGenerating(false); }
      },
      apply: (r) => {
        // Screens edited by hand are kept (re-bound to the new tags); keep the look the user picked.
        const prev = useHmiStore.getState().design;
        const { design: merged, notes } = mergeRegenerated(prev, r.design);
        // One undo step back to the design before the redesign.
        if (prev) setHist((x) => ({ ...x, past: [...x.past, prev].slice(-100), future: [] }));
        useHmiStore.getState().setDesign(look ? { ...merged, look } : merged, r.explanation);
        if (notes.length) notify(notes.join(' '));
        useStageStore.getState().markGenerated('hmi', { ...snap, hmiFp: hmiFingerprint(merged) });
      },
    });
  };
  useTakeResult<{ design: HmiDesign; reasoning: string | null }>('hmi', (r) => {
    setReasoning(r.reasoning);
    setScreenId(r.design.screens[0]?.id ?? null);
  });

  /** Screen access (password level): one undo step; the screen counts as edited so a Redesign keeps it. */
  const setScreenLevel = (id: string, level: AccessLevel) => {
    if (!design) return;
    const next = setLevelOf(design, id, level);
    commit({ ...next, screens: next.screens.map((s) => (s.id === id ? { ...s, edited: true } : s)) });
  };

  const genButton = (label: string) => (
    <button onClick={() => generate()} disabled={hmi.isGenerating || !model}
      className="px-4 py-2 text-sm bg-brand-600 text-white font-medium rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
      {hmi.isGenerating ? <><Spinner /> Designing screens…</> : label}
    </button>
  );

  const fullButton = (
    <button onClick={() => generate(true)} disabled={hmi.isGenerating || !apiKey || !model}
      title="The AI lays out every screen element itself (slower; the standard design uses the AI only for names and cycle steps)"
      className="px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">AI full design (experimental)</button>
  );

  // Panels that can talk to this project's PLC (C-more for CLICK; other makers by their driver lists).
  const pickable = [...HMI_MODELS, ...catalogPanels().flatMap((o) => (o.model ? [o.model] : []))].filter(designable)
    .filter((m) => hmiFit(m, ANY_NEED, cpu.id).ok);
  const picker = (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">Which HMI are you using?</h3>
      <p className="text-xs text-gray-500">Touch panels that can talk to the {profile.vendor} {cpu.label} (the maker's PLC driver list), {pickable.length} in all.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {pickable.map((m) => (
          <button key={m.partNumber} onClick={() => { setProjectPanel(m.partNumber); setChoosing(false); }}
            className={`text-left rounded border p-3 ${m.partNumber === (model?.partNumber ?? '') ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
            <div className="font-mono text-sm font-semibold text-gray-800">{m.partNumber}</div>
            <div className="text-xs text-gray-600">{hmiMaker(m)} {m.family} · {m.sizeIn}" · {m.widthPx}×{m.heightPx}{m.ethernet ? ' · Ethernet' : ''}</div>
            {isCmore(m) && !m.supportsClickEthernet && <div className="text-xs text-amber-700">No built-in Ethernet to CLICK</div>}
            <div className="text-xs text-gray-400 mt-1 line-clamp-2">{m.description}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const screenIssues = screen ? issues.filter((i) => i.screenId === screen.id) : [];
  const tags = (design?.tags ?? []).filter((t) => !tagFilter || `${t.address} ${t.name} ${t.description}`.toLowerCase().includes(tagFilter.toLowerCase()));
  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button key={t} onClick={() => setTab(t)}
      className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t ? 'border-brand-600 text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
      {label}{count !== undefined && <span className={`ml-1.5 text-[11px] px-1.5 rounded-full ${t === 'check' && count ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{count}</span>}
    </button>
  );

  return (
    <>
      <header className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">5 · HMI design</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {noPanel ? 'No touch panel · the operator station (pushbuttons, selector, lamps) is wired to the PLC' : <>{model ? `${model.partNumber} · ${model.sizeIn}" · ${model.widthPx}×${model.heightPx}` : 'Choose your HMI'} · every button and lamp is linked to a PLC address the program implements</>}
          </p>
        </div>
        {design && (
          <div className="flex gap-2">
            <Link to="/simulate" className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Try it live</Link>
            <button onClick={() => setChoosing((v) => !v)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Change HMI</button>
            {genButton('Redesign screens')}
            {showExperimental && fullButton}
          </div>
        )}
      </header>
      <StageBanner info={stages.hmi} action={noPanel ? undefined : genButton('Update screens')} />

      <div className="flex-1 overflow-auto bg-gray-50 p-5 space-y-4">
        {noPanel && !choosing && (
          <div className="rounded border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-steel-800 space-y-2" data-testid="no-hmi">
            <p className="font-semibold">This machine has no touch panel.</p>
            <p>The operator uses pushbuttons, switches and lamps; the PLC program starts, stops and resets from the panel buttons, and faults show on the fault lamp. Nothing to design here: the documents describe the operator station instead of HMI screens.</p>
            <OperatorStationList />
            {leftover && (
              <p className="text-xs text-steel-700" data-testid="hmi-leftover">
                {leftover.screens.length} screen{leftover.screens.length === 1 ? '' : 's'} made earlier for the {leftover.hmiPartNumber} are kept but not used or exported.{' '}
                <button onClick={() => { if (confirm('Remove the screens made for the earlier touch panel? You can design new ones if you add a panel later.')) hmi.setDesign(null, null); }}
                  className="underline text-brand-700">Remove them</button>
              </p>
            )}
            <button onClick={() => setChoosing(true)} className="text-xs underline text-brand-700">Add a touch panel after all{leftover ? ' (brings the earlier screens back)' : ''}</button>
          </div>
        )}
        {chosenPanel && !model && (
          <p role="alert" className="text-sm rounded border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2" data-testid="hmi-too-small">
            The {chosenPanel.partNumber} ({chosenPanel.sizeIn}", {chosenPanel.widthPx}×{chosenPanel.heightPx}{chosenPanel.touch ? '' : ', no touch screen'}) is too small to lay out
            touch screens on; set it up in the maker's software (function keys and text screens). Choose a touch panel of at least {MIN_DESIGN_PX.w}×{MIN_DESIGN_PX.h} to design screens here.
          </p>
        )}
        {(choosing || (!model && !noPanel)) && picker}
        {!design && model && !choosing && (
          <p className="text-sm text-gray-700">
            Operator panel: <span className="font-mono font-medium">{model.partNumber}</span> ({model.sizeIn}", {model.widthPx}×{model.heightPx}){' '}
            <button onClick={() => setChoosing(true)} className="ml-1 text-xs underline text-gray-600 hover:text-gray-900">Change</button>
          </p>
        )}
        {!design && !(noPanel && !choosing) && (
          <div className="flex flex-wrap items-center gap-3">
            {genButton('Design the HMI screens')}
            {showExperimental && fullButton}
            {model && <span className="text-sm text-gray-500">or make screens yourself:</span>}
            {model && <button onClick={() => void addScreen()} className="px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50">New blank screen</button>}
            {model && <PictureButton label="New screen from picture…" onFile={(f) => void addScreen(f)} />}
            {!apiKey && <span className="text-xs text-gray-500">Without an API key the screens are made from the I/O list by the rules only. Add a key in <Link to="/settings" className="underline">Settings</Link> to let the AI name things and add the cycle steps.</span>}
            {!model && <span className="text-sm text-gray-500">Choose an HMI above first.</span>}
          </div>
        )}
        {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
        {reasoning && <ReasoningPanel reasoning={reasoning} />}

        {design && model && screen && (
          <>
            {hmi.explanation && <p className="text-sm text-gray-700 max-w-4xl"><SpeakButton text={hmi.explanation} label="Read aloud" size="xs" className="mr-1 align-middle" />{tagged(hmi.explanation)}</p>}
            <div className="flex gap-4 items-start">
              {/* Screen list */}
              <ResizablePane id="hmi.screens" defaultSize={200} min={140} max={420} handle="right">
              <nav aria-label="Screens" className="flex flex-col gap-2 pr-1">
                {design.screens.map((s, i) => {
                  const n = issues.filter((x) => x.screenId === s.id).length;
                  const on = s.id === screen.id;
                  return (
                    <button key={s.id} onClick={() => { setScreenId(s.id); setSelected(null); }} aria-current={on ? 'page' : undefined}
                      className={`text-left rounded-lg border p-1.5 w-full transition ${on ? 'border-brand-500 ring-2 ring-brand-200 bg-white' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                      <div className="rounded overflow-hidden bg-black">
                        <HmiScreenView screen={s} widthPx={model.widthPx} heightPx={model.heightPx} design={design} thumbnail />
                      </div>
                      <div className="flex items-center justify-between mt-1 px-0.5">
                        <span className="text-xs font-medium text-gray-800 truncate">{i + 1}. {s.name}</span>
                        <span className="flex items-center gap-1">
                          {s.level && <span title={`${LEVEL_LABEL[s.level]} password`} className="text-[10px] px-1 rounded bg-gray-100 text-gray-600">{s.level === 'engineer' ? 'ENG' : 'MAINT'}</span>}
                          {n > 0 && <span title={`${n} layout item(s) to review`} className="text-[10px] px-1 rounded bg-amber-100 text-amber-800">{n}</span>}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </nav>
              <div className="flex flex-col gap-1 mt-2 pr-1">
                <button onClick={() => void addScreen()} className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-brand-50">+ New blank screen</button>
                <PictureButton label="+ New screen from picture…" small onFile={(f) => void addScreen(f)} />
              </div>
              </ResizablePane>

              {/* Screen */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800">{screen.name}{screen.level ? <span className="ml-2 text-xs font-normal text-gray-500">· {LEVEL_LABEL[screen.level]} password</span> : null}</h3>
                    <p className="text-xs text-gray-500 truncate">{screen.purpose}</p>
                  </div>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 whitespace-nowrap font-mono">{model.widthPx}×{model.heightPx}</span>
                    {!editing && <button onClick={() => { setEditing(true); setSel([]); }} className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded hover:bg-brand-700">Edit screen</button>}
                  </span>
                </div>
                {editing && (
                  <HmiEditorBar selectedCount={sel.length} canUndo={hist.past.length > 0} canRedo={hist.future.length > 0} snap={snapOn}
                    background={screen.background} aiReady={Boolean(apiKey)} aiBusy={aiBusy}
                    onAdd={addElement} onAlign={(a: Align) => updateScreen(alignElements(screen, sel, a))} onDistribute={(ax) => updateScreen(distributeElements(screen, sel, ax))}
                    onDuplicate={() => editorKey('duplicate')} onDelete={() => editorKey('delete')} onUndo={() => stepHistory('undo')} onRedo={() => stepHistory('redo')}
                    onSnap={setSnapOn} onPicture={(f) => { void uploadBackground(f); setPictureHint('This picture fills the screen background. Use Move / Zoom to shift it, or "Make it a movable picture" to drag and resize it like a button.'); }} onBackground={setBackground} onRecreate={() => void recreate()}
                    onAddPicture={(f) => void addPictureElement(f)} onRestack={(to) => updateScreen(restack(screen, sel, to))}
                    selectedIsPicture={sel.length === 1 && screen.elements.some((e) => e.id === sel[0] && e.kind === 'image')}
                    onPictureToBackground={pictureToBackground} onBackgroundToPicture={() => void backgroundToPicture()} hint={pictureHint}
                    onDone={() => { setEditing(false); setSel([]); setProposal(null); }} />
                )}
                {proposal && proposal.screenId === screen.id && (
                  <div role="status" className="mb-2 px-3 py-2 bg-brand-50 border border-brand-300 text-sm text-steel-800 flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-64"><b>AI proposal: {proposal.elements.length} element{proposal.elements.length === 1 ? '' : 's'}</b> (dashed on the screen). {proposal.explanation}</span>
                    <button onClick={() => acceptProposal(false)} className="px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-sm hover:bg-brand-700">Add to the screen</button>
                    <button onClick={() => acceptProposal(true)} className="px-3 py-1 text-xs border border-steel-300 bg-white rounded-sm hover:bg-steel-50">Replace the screen's elements</button>
                    <button onClick={() => setProposal(null)} className="px-3 py-1 text-xs border border-steel-300 bg-white rounded-sm hover:bg-steel-50">Discard</button>
                  </div>
                )}
                <div className="rounded-2xl p-3 pb-2 shadow-xl" style={{ background: 'linear-gradient(180deg,#2a2e35,#1a1d22)' }}>
                  <div className="rounded-md overflow-hidden ring-1 ring-black" onPointerDown={editing ? undefined : () => setSelected(null)}>
                    {editing ? (
                      <ScreenEditor key={screen.id} screen={screen} design={design} widthPx={model.widthPx} heightPx={model.heightPx}
                        selected={sel} onSelect={setSel} onChange={updateScreen} snapToGrid={snapOn} onKey={editorKey}
                        proposal={proposal?.screenId === screen.id ? proposal.elements : null} />
                    ) : (
                      <HmiScreenView screen={screen} widthPx={model.widthPx} heightPx={model.heightPx} design={design}
                        onNavigate={(id) => { setScreenId(id); setSelected(null); }}
                        selectedId={selected} onSelect={setSelected} />
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-1.5 px-1 text-[10px] tracking-widest text-gray-500 uppercase">
                    <span>{isCmore(model) ? `C-more ${model.family === 'C-more' ? model.partNumber.split('-')[0] : model.family}` : `${hmiMaker(model)} ${model.family}`}</span>
                    <span>{model.sizeIn}"</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{editing
                  ? 'Click to select (Shift adds), drag to move, drag the yellow handles to resize, drag on empty space to select an area. Arrows nudge 1 px (Shift: 8 px), Del deletes, Ctrl+D duplicates, Ctrl+Z undoes.'
                  : <>Static design view: lamps show OFF and values 0. Use <Link to="/simulate" className="underline">Simulate</Link> to press the buttons against the PLC program.</>}</p>
                <datalist id="hmi-address-options">{addressOptions.map(([a, t]) => <option key={a} value={a}>{tagName?.(a) ? `${tagName(a)}: ${t}` : t}</option>)}</datalist>
              </div>

              {/* Properties */}
              <ResizablePane id="hmi.props" defaultSize={320} min={240} max={560} handle="left">
              <aside className="space-y-4 pl-1">
                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{selectedEl ? 'Element properties' : sel.length > 1 ? `${sel.length} elements selected` : 'Screen'}</h3>
                  {selectedEl ? (
                    <ElementEditor key={selectedEl.id} el={selectedEl} screens={design.screens} tagName={tagName}
                      onChange={(e) => updateScreen({ ...screen, elements: screen.elements.map((x) => (x.id === e.id ? withAnalogScale(x, e, io, addresses) : x)) })}
                      onDelete={() => { updateScreen(deleteElements(screen, [selectedEl.id])); setSelected(null); }} />
                  ) : sel.length > 1 ? (
                    <p className="text-xs text-gray-500">Use the tools above the screen to line them up, space them evenly, duplicate or delete them. Drag any of them to move all.</p>
                  ) : (
                    <ScreenInfo screen={screen} issues={screenIssues} onLevel={(l) => setScreenLevel(screen.id, l)}
                      onRename={(name) => { if (design) commit(renameScreen(design, screen.id, name)); }}
                      onDelete={design.screens.length > 1 ? () => deleteScreen(screen.id) : undefined} onRebuild={() => rebuildThis(screen.id)} />
                  )}
                </section>
                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Panel</h3>
                  <div className="flex items-center justify-between gap-3 mb-3 text-xs">
                    <span className="text-gray-500">Look</span>
                    <LookPicker value={design.look} makerLook={defaultLookFor(design.hmiPartNumber)} makerName={hmiMakerOf(design.hmiPartNumber)}
                      onChange={(look) => commit({ ...design, look })} />
                  </div>
                  <PanelSpecs model={model} design={design} />
                </section>
              </aside>
              </ResizablePane>
            </div>

            <section className="bg-white rounded-lg border border-gray-200">
              <div className="flex gap-1 px-3 border-b border-gray-200">
                {tabBtn('tags', 'Tags', design.tags.length)}
                {tabBtn('alarms', 'Alarms', design.alarms.length)}
                {tabBtn('check', 'Layout check', issues.length)}
                {tabBtn('notes', 'Assumptions used', hmiQuestions.length)}
              </div>
              <div className="p-4 overflow-x-auto">
                {tab === 'tags' && (
                  <>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs text-gray-500">{tagName
                        ? `The PLC program implements these under the tag names shown (the exported ${profile.vendor} program uses them; the grey memory address is what the simulator runs).`
                        : 'The PLC program implements these. HMI commands C1001–C1100, setpoints DS1001–DS1100, status words DS1101–DS1200, alarms C1101–C1200, status bits C1201–C1300.'}</p>
                      <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Filter tags" className={`${input} w-48`} />
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-200">
                        <tr>{[tagName ? 'PLC tag (memory)' : 'Address', 'Name', 'Type', 'Access', 'Used on', 'What the PLC does'].map((h) => <th key={h} className="text-left py-1.5 pr-3 font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tags.map((t) => (
                          <tr key={t.address + t.name} className="align-top">
                            <td className="py-1.5 pr-3 font-mono whitespace-nowrap"><AddressCell address={t.address} tag={tagName?.(t.address)} /></td>
                            <td className="pr-3 py-1.5 font-mono text-xs whitespace-nowrap">{t.name}</td>
                            <td className="pr-3 py-1.5 text-xs">{t.dataType}</td>
                            <td className="pr-3 py-1.5 text-xs whitespace-nowrap">{t.access}</td>
                            <td className="pr-3 py-1.5 text-xs text-gray-500">{(usedOn.get(t.address.toUpperCase()) ?? []).join(', ') || '—'}</td>
                            <td className="py-1.5 text-gray-600">{t.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {tab === 'alarms' && (
                  <table className="w-full text-sm">
                    <thead className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      <tr>{[tagName ? 'PLC tag (memory)' : 'Bit', 'Severity', 'Message', 'Shown on'].map((h) => <th key={h} className="text-left py-1.5 pr-3 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {design.alarms.map((a) => (
                        <tr key={a.address}>
                          <td className="py-1.5 pr-3 font-mono"><AddressCell address={a.address} tag={tagName?.(a.address)} /></td>
                          <td className="pr-3"><span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${a.severity === 'alarm' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{a.severity === 'alarm' ? 'Alarm' : 'Warning'}</span></td>
                          <td className="pr-3 text-gray-800"><AlarmText alarm={a} /></td>
                          <td className="text-xs text-gray-500">Header counter, alarm table{usedOn.get(a.address.toUpperCase())?.length ? `, ${usedOn.get(a.address.toUpperCase())!.join(', ')}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {tab === 'check' && (
                  issues.length ? (
                    <ul className="text-sm space-y-1">
                      {issues.map((i, k) => {
                        const sc = design.screens.find((s) => s.id === i.screenId);
                        return (
                          <li key={k} className="flex gap-2 items-start">
                            <span className={`mt-0.5 text-[10px] px-1.5 rounded font-semibold ${i.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{i.severity === 'error' ? 'FIX' : 'CHECK'}</span>
                            <button className="text-left hover:underline" onClick={() => { if (sc) { setScreenId(sc.id); setSelected(i.elementId); } }}>
                              {sc ? <span className="text-gray-500">{sc.name}: </span> : null}{tagged(i.message)}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="text-sm text-emerald-700">All screens pass: on-screen, no overlaps, touch targets ≥ {MIN_TOUCH.w}×{MIN_TOUCH.h} px, header and navigation present, every address tagged.</p>
                )}
                {tab === 'notes' && (
                  hmiQuestions.length ? <AssumptionsUsed questions={hmiQuestions} /> : <p className="text-sm text-gray-500">No assumptions: the description covers everything the HMI needs.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

/** The operator devices (pushbuttons, selectors, E-stops, lamps) of a machine without a touch panel. */
function OperatorStationList() {
  const electrical = useElectricalStore((s) => s.design);
  // collectProject reads the stores; the list changes with the electrical design.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const devices = useMemo(() => operatorDevices(collectProject()), [electrical]);
  if (!devices.length) return <p className="text-xs text-steel-700">The pushbuttons and lamps are listed here once the electrical design is made.</p>;
  return (
    <table className="text-xs" data-testid="operator-station">
      <tbody>
        {devices.map((d, i) => (
          <tr key={`${d.tag}:${d.address}:${i}`}>
            <td className="pr-3 font-mono font-medium">{d.tag}</td>
            <td className="pr-3 text-steel-600">{d.kind}</td>
            <td className="pr-3">{d.description}</td>
            <td className="text-steel-600">{/door/i.test(d.location) ? '' : d.location}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
