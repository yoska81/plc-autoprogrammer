import { Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHmiStore } from '../store/useHmiStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStageStore } from '../store/useStageStore';
import { usePlc } from '../plc/core/usePlc';
import { useFingerprints, useStages, hmiFingerprint } from '../spec/useStages';
import { HMI_MODELS, getHmi, CLICK_HMI_COMMUNICATION, HMI_DESIGN_GUIDELINES, type HmiModel } from '../hmi/hmiCatalog';
import { generateHmiDesign } from '../lib/ai/hmiAI';
import HmiScreenView from '../hmi/HmiScreenView';
import StageBanner from '../components/StageBanner';
import ResizablePane from '../components/ResizablePane';
import { Spinner, ReasoningPanel } from '../components/common';
import { type AccessLevel, type HmiDesign, type HmiElement, type HmiScreen, type HmiState, type HmiStyle, type MachineSymbol } from '../hmi/types';
import { checkDesign, layoutBands, MIN_TOUCH, type LayoutIssue } from '../hmi/layout';
import { LEVEL_LABEL } from '../hmi/theme';
import QuestionList from '../components/questions/QuestionList';
import { useQuestions, useSyncQuestions } from '../components/questions/useQuestionStore';

const input = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
const fieldLabel = 'block text-[11px] font-medium text-gray-500 uppercase tracking-wide';

const KIND_LABEL: Record<HmiElement['kind'], string> = {
  header: 'Header bar', panel: 'Group frame', button: 'Push button', nav: 'Screen change', indicator: 'Indicator lamp', multistate: 'Multistate text',
  numeric: 'Numeric display', 'numeric-entry': 'Numeric entry (setpoint)', bar: 'Bar graph', trend: 'Trend', machine: 'Machine graphic',
  'alarm-list': 'Alarm table', 'alarm-banner': 'Alarm banner', datetime: 'Date / time', text: 'Static text',
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

function ElementEditor({ el, screens, onChange, onDelete }: { el: HmiElement; screens: HmiScreen[]; onChange: (e: HmiElement) => void; onDelete: () => void }) {
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
          <input value={el.address ?? ''} onChange={(e) => onChange({ ...el, address: e.target.value.toUpperCase() || null })} className={`${input} w-full font-mono`} placeholder="e.g. C1001, DS1001" />
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
            <input value={el.interlock ?? ''} onChange={(e) => onChange({ ...el, interlock: e.target.value.toUpperCase() || null })} className={`${input} w-full font-mono`} placeholder="none" />
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

function ScreenInfo({ screen, issues, onLevel }: { screen: HmiScreen; issues: LayoutIssue[]; onLevel: (l: AccessLevel) => void }) {
  const counts = new Map<string, number>();
  for (const e of screen.elements) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const addresses = new Set(screen.elements.flatMap((e) => [e.address, e.interlock ?? null].filter(Boolean)));
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-xs font-semibold text-gray-800">{screen.name}</div>
        <p className="text-xs text-gray-500 mt-0.5">{screen.purpose}</p>
      </div>
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
    </div>
  );
}

function PanelSpecs({ model, design }: { model: HmiModel; design: HmiDesign }) {
  const b = layoutBands(model.widthPx, model.heightPx);
  const gcd = (a: number, c: number): number => (c ? gcd(c, a % c) : a);
  const g = gcd(model.widthPx, model.heightPx);
  const items: [string, string][] = [
    ['Panel', `${model.partNumber} · ${model.family}`],
    ['Display', `${model.sizeIn}" ${model.color ? 'colour' : 'mono'} ${model.touch ? 'touch' : ''}`],
    ['Resolution', `${model.widthPx} × ${model.heightPx} px (${model.widthPx / g}:${model.heightPx / g})`],
    ['Bands', `header ${b.header.h} px · nav ${b.nav.h} px`],
    ['Screens', String(design.screens.length)],
    ['Tags / alarms', `${design.tags.length} / ${design.alarms.length}`],
    ['PLC link', model.supportsClickEthernet ? 'CLICK Ethernet (Modbus TCP 502)' : 'Serial'],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {items.map(([k, v]) => <Fragment key={k}><dt className="text-gray-500 whitespace-nowrap">{k}</dt><dd className="text-gray-800">{v}</dd></Fragment>)}
    </dl>
  );
}

type Tab = 'tags' | 'alarms' | 'check' | 'notes';

export default function HmiPage() {
  const hmi = useHmiStore();
  const settings = useSettingsStore();
  const markGenerated = useStageStore((s) => s.markGenerated);
  const { profile, cpu, io, addresses } = usePlc();
  const fp = useFingerprints();
  const stages = useStages();

  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const screenId = params.get('screen');
  const setScreenId = (id: string | null) => setParams(id ? { screen: id } : {}, { replace: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [tab, setTab] = useState<Tab>('tags');
  const [tagFilter, setTagFilter] = useState('');

  const model = getHmi(hmi.design?.hmiPartNumber ?? hmi.hmiPartNumber);
  const apiKey = settings.anthropicApiKey;
  const design = hmi.design;
  // "To confirm" items, answered under each one.
  useSyncQuestions('hmi', design ? design.notes.map((n) => ({ text: n, assumption: n, section: 'operator' as const })) : null);
  const hmiQuestions = useQuestions('hmi');
  const screen = design?.screens.find((s) => s.id === screenId) ?? design?.screens[0] ?? null;
  const selectedEl = screen?.elements.find((e) => e.id === selected) ?? null;
  const issues = useMemo(() => (design && model ? checkDesign(design, model.widthPx, model.heightPx) : []), [design, model]);
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

  const generate = async () => {
    if (!apiKey || !model || hmi.isGenerating) return;
    hmi.setIsGenerating(true);
    setError(null);
    try {
      const r = await generateHmiDesign({
        apiKey, model: settings.anthropicModel, effort: settings.effort,
        hmi: model, guidelines: HMI_DESIGN_GUIDELINES, comms: CLICK_HMI_COMMUNICATION,
        spec: fp.spec, io, addresses, profile, cpu,
      });
      hmi.setDesign(r.design, r.explanation);
      setReasoning(r.reasoning);
      setScreenId(r.design.screens[0]?.id ?? null);
      markGenerated('hmi', { specFp: fp.specFp, spec: fp.spec, ioFp: fp.ioFp, hmiFp: hmiFingerprint(r.design) });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      hmi.setIsGenerating(false);
    }
  };

  const setScreenLevel = (id: string, level: AccessLevel) => {
    if (!design) return;
    hmi.setDesign({
      ...design,
      screens: design.screens.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s };
        if (level === 'operator') delete next.level; else next.level = level;
        return next;
      }),
    }, hmi.explanation);
  };

  const genButton = (label: string) => (
    <button onClick={generate} disabled={hmi.isGenerating || !apiKey || !model}
      className="px-4 py-2 text-sm bg-brand-600 text-brand-950 font-medium rounded hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
      {hmi.isGenerating ? <><Spinner /> Designing screens…</> : label}
    </button>
  );

  const picker = (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">Which HMI are you using?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {HMI_MODELS.filter((m) => m.touch).map((m) => (
          <button key={m.partNumber} onClick={() => { hmi.setHmiPartNumber(m.partNumber); setChoosing(false); }}
            className={`text-left rounded border p-3 ${m.partNumber === (model?.partNumber ?? '') ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
            <div className="font-mono text-sm font-semibold text-gray-800">{m.partNumber}</div>
            <div className="text-xs text-gray-600">{m.family} · {m.sizeIn}" · {m.widthPx}×{m.heightPx}{m.ethernet ? ' · Ethernet' : ''}</div>
            {!m.supportsClickEthernet && <div className="text-xs text-amber-700">No built-in Ethernet to CLICK</div>}
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
            {model ? `${model.partNumber} · ${model.sizeIn}" · ${model.widthPx}×${model.heightPx}` : 'Choose your HMI'} · every button and lamp is linked to a PLC address the program implements
          </p>
        </div>
        {design && (
          <div className="flex gap-2">
            <Link to="/simulate" className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Try it live</Link>
            <button onClick={() => setChoosing((v) => !v)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Change HMI</button>
            {genButton('Redesign screens')}
          </div>
        )}
      </header>
      <StageBanner info={stages.hmi} action={genButton('Update screens')} />

      <div className="flex-1 overflow-auto bg-gray-50 p-5 space-y-4">
        {(!design || choosing) && picker}
        {!design && (
          <div className="flex items-center gap-3">
            {genButton('Design the HMI screens')}
            {!apiKey && <span className="text-sm text-yellow-800">Add your Anthropic API key in <Link to="/settings" className="underline">Settings</Link>.</span>}
            {!model && <span className="text-sm text-gray-500">Choose an HMI above first.</span>}
          </div>
        )}
        {error && <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error}</div>}
        {reasoning && <ReasoningPanel reasoning={reasoning} />}

        {design && model && screen && (
          <>
            {hmi.explanation && <p className="text-sm text-gray-700 max-w-4xl">{hmi.explanation}</p>}
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
              </ResizablePane>

              {/* Screen */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800">{screen.name}{screen.level ? <span className="ml-2 text-xs font-normal text-gray-500">· {LEVEL_LABEL[screen.level]} password</span> : null}</h3>
                    <p className="text-xs text-gray-500 truncate">{screen.purpose}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap font-mono">{model.widthPx}×{model.heightPx}</span>
                </div>
                <div className="rounded-2xl p-3 pb-2 shadow-xl" style={{ background: 'linear-gradient(180deg,#2a2e35,#1a1d22)' }}>
                  <div className="rounded-md overflow-hidden ring-1 ring-black" onPointerDown={() => setSelected(null)}>
                    <HmiScreenView screen={screen} widthPx={model.widthPx} heightPx={model.heightPx} design={design}
                      onNavigate={(id) => { setScreenId(id); setSelected(null); }}
                      selectedId={selected} onSelect={setSelected} />
                  </div>
                  <div className="flex justify-between items-center mt-1.5 px-1 text-[10px] tracking-widest text-gray-500 uppercase">
                    <span>C-more {model.family === 'C-more' ? model.partNumber.split('-')[0] : model.family}</span>
                    <span>{model.sizeIn}"</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Static design view: lamps show OFF and values 0. Use <Link to="/simulate" className="underline">Simulate</Link> to press the buttons against the PLC program.</p>
              </div>

              {/* Properties */}
              <ResizablePane id="hmi.props" defaultSize={320} min={240} max={560} handle="left">
              <aside className="space-y-4 pl-1">
                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{selectedEl ? 'Element properties' : 'Screen'}</h3>
                  {selectedEl ? (
                    <ElementEditor key={selectedEl.id} el={selectedEl} screens={design.screens}
                      onChange={(e) => hmi.updateElement(screen.id, e)} onDelete={() => { hmi.removeElement(screen.id, selectedEl.id); setSelected(null); }} />
                  ) : (
                    <ScreenInfo screen={screen} issues={screenIssues} onLevel={(l) => setScreenLevel(screen.id, l)} />
                  )}
                </section>
                <section className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Panel</h3>
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
                {tabBtn('notes', 'To confirm', hmiQuestions.filter((q) => q.status === 'open').length)}
              </div>
              <div className="p-4 overflow-x-auto">
                {tab === 'tags' && (
                  <>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs text-gray-500">The PLC program implements these. HMI commands C1001–C1100, setpoints DS1001–DS1100, status words DS1101–DS1200, alarms C1101–C1200, status bits C1201–C1300.</p>
                      <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Filter tags" className={`${input} w-48`} />
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-200">
                        <tr>{['Address', 'Name', 'Type', 'Access', 'Used on', 'What the PLC does'].map((h) => <th key={h} className="text-left py-1.5 pr-3 font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tags.map((t) => (
                          <tr key={t.address + t.name} className="align-top">
                            <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{t.address}</td>
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
                      <tr>{['Bit', 'Severity', 'Message', 'Shown on'].map((h) => <th key={h} className="text-left py-1.5 pr-3 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {design.alarms.map((a) => (
                        <tr key={a.address}>
                          <td className="py-1.5 pr-3 font-mono">{a.address}</td>
                          <td className="pr-3"><span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${a.severity === 'alarm' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{a.severity === 'alarm' ? 'Alarm' : 'Warning'}</span></td>
                          <td className="pr-3 text-gray-800">{a.message}</td>
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
                              {sc ? <span className="text-gray-500">{sc.name}: </span> : null}{i.message}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="text-sm text-emerald-700">All screens pass: on-screen, no overlaps, touch targets ≥ {MIN_TOUCH.w}×{MIN_TOUCH.h} px, header and navigation present, every address tagged.</p>
                )}
                {tab === 'notes' && (
                  hmiQuestions.length ? <QuestionList questions={hmiQuestions} title="To confirm"
                    intro="Confirm each item or type the correct answer under it; answers are added to the machine description (operator station) and the HMI becomes out of date so Update uses them." /> : <p className="text-sm text-gray-500">Nothing to confirm.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
