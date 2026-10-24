/**
 * Program flow: the whole PLC program as flow diagrams, one per function, on one zoomable map; the ladder of what
 * is selected beside it (with what each symbol means, to learn ladder from it); the machine's state on it, from
 * the simulator (Test) or read from the real PLC (Watch: read only, nothing is written to the PLC).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import ResizablePane from '../../components/ResizablePane';
import { useProgramStore } from '../../store/useProgramStore';
import { usePlc } from '../core/usePlc';
import type { LadderElement, LadderOutput, Rung } from '../core/ladder';
import { createSimulator, type CounterState, type RungPower, type Simulator, type TimerState } from '../sim/engine';
import { rungAllAddresses } from '../sim/blocks';
import LiveLadder from '../sim/LiveLadder';
import { connectPlc, disconnectPlc, modbusBridge, useOnlineStore } from '../../online/useOnline';
import { rungPowerFromValues } from '../../online/power';
import { flowMap, type FlowDiagram, type FlowNode } from './flowModel';
import { flowState, type FlowState, type StepClock } from './flowState';
import FlowCanvas, { type FlowCanvasHandle } from './FlowCanvas';

type Mode = 'diagram' | 'test' | 'watch';

interface Values {
  power: Map<string, RungPower>;
  bits: Map<string, boolean>;
  words: Map<string, number>;
  timers: Map<string, TimerState>;
  counters: Map<string, CounterState>;
  inputs: Map<string, boolean>;
  now: number;
}
interface Snapshot { mode: Mode; values: Values; state: FlowState }

/** What a ladder symbol means, in one line (shown for the symbols in the selected rungs). */
const MEANING: Record<string, string> = {
  NO: '┤ ├  Normally open contact: passes power when its bit is ON.',
  NC: '┤/├  Normally closed contact: passes power when its bit is OFF.',
  RISE: '┤↑├  Rising edge: passes power for one scan when its bit turns ON.',
  FALL: '┤↓├  Falling edge: passes power for one scan when its bit turns OFF.',
  CMP: '[ = ]  Compare: passes power when the comparison is true (a step number, a count, a value).',
  RAW: 'An instruction of the original PLC kept as it was (not drawn as a symbol).',
  OUT: '( )  Output coil: ON while the rung has power, OFF when it does not.',
  SET: '(S)  Set (latch): turns the bit ON and it stays ON until a Reset.',
  RST: '(R)  Reset (unlatch): turns the bit OFF.',
  TMR: '[TMR]  Timer: counts time while the rung has power; its bit turns ON when the time is reached.',
  CNT: '[CNT]  Counter: counts each time the rung gets power; its bit turns ON at the preset.',
  COPY: '[COPY]  Copy: puts a value into a register (here often: go to step n).',
  MATH: '[MATH]  Math: calculates a value into a register.',
};
const parallel = 'Rows one under the other are parallel paths: OR. Symbols one after another on a row are in series: AND.';

export default function FlowPage() {
  const ladder = useProgramStore((s) => s.ladder);
  const { labels, profile } = usePlc();
  const nameOf = useMemo(() => {
    const tags = new Map(ladder.tags.map((t) => [t.address.toUpperCase(), t.nickname]));
    return (a: string) => labels.get(a) || tags.get(a.toUpperCase()) || a;
  }, [labels, ladder.tags]);
  const map = useMemo(() => flowMap(ladder, nameOf), [ladder, nameOf]);
  const canvas = useRef<FlowCanvasHandle>(null);
  const [sel, setSel] = useState<{ d: FlowDiagram; n: FlowNode | null } | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('diagram');
  // window options: full screen, the functions list and the ladder panel shown or hidden, the ladder maximized
  const root = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [showList, setShowList] = useState(true);
  const [side, setSide] = useState<'shown' | 'hidden' | 'max'>('shown');
  const [ladderZoom, setLadderZoom] = useState(1);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else if (root.current?.requestFullscreen) void root.current.requestFullscreen().catch(() => setFull((f) => !f));
    else setFull((f) => !f);
  };

  // values: the simulator's (Test) or the PLC's (Watch), with the diagram's state from them; made when they come
  // (a scan, a read), kept as one snapshot
  const sim = useRef<Simulator | null>(null);
  const clock = useRef<StepClock>(new Map());
  const [running, setRunning] = useState(true);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const online = useOnlineStore();
  // only what this mode made (a simulator snapshot is never shown as the machine's)
  const shown = snap?.mode === mode ? snap : null;
  const values = shown?.values ?? null;
  const state = shown?.state ?? null;

  const publish = (m: Mode, v: Values) => setSnap({ mode: m, values: v, state: flowState(map, ladder, v.power, v.words, v.now, clock.current, nameOf) });
  const publishSim = () => {
    const s = sim.current;
    if (!s) return;
    publish('test', { power: s.rungPower(), bits: new Map(s.state.bits), words: new Map(s.state.words), timers: new Map(s.state.timers), counters: new Map(s.state.counters), inputs: new Map(s.state.inputs), now: s.state.timeMs });
  };
  const publishRef = useRef(publishSim);
  useEffect(() => { publishRef.current = publishSim; });

  useEffect(() => {
    if (mode !== 'test') return;
    sim.current = createSimulator(ladder);
    sim.current.step(10);
    clock.current = new Map();
    const first = setTimeout(() => publishRef.current(), 0);
    return () => { clearTimeout(first); sim.current = null; };
  }, [mode, ladder]);
  useEffect(() => {
    if (mode !== 'test' || !running) return;
    const h = setInterval(() => { sim.current?.run(100, 10); publishRef.current(); }, 100);
    return () => clearInterval(h);
  }, [mode, running]);

  const allAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const r of ladder.rungs) for (const a of rungAllAddresses(r)) set.add(a.toUpperCase());
    return [...set].filter((a) => !/^-?\d/.test(a));
  }, [ladder]);
  // Watch: each read from the PLC (read only: this page never writes); the connection closes with the page
  const watchRef = useRef<(st: ReturnType<typeof useOnlineStore.getState>) => void>(() => undefined);
  useEffect(() => {
    watchRef.current = (st) => {
      if (st.status !== 'connected' || !st.lastUpdate) return;
      publish('watch', { power: rungPowerFromValues(ladder, st.bits, st.words), bits: st.bits, words: st.words, timers: new Map(), counters: new Map(), inputs: new Map(), now: st.lastUpdate });
    };
  });
  useEffect(() => {
    if (mode !== 'watch') return;
    clock.current = new Map();
    const unsub = useOnlineStore.subscribe((st, prev) => { if (st.lastUpdate !== prev.lastUpdate) watchRef.current(st); });
    return () => { unsub(); void disconnectPlc(); };
  }, [mode]);

  // search: boxes whose text or rungs' addresses match
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = new Set<string>();
    if (q.length < 2) return out;
    const rungs = new Map(ladder.rungs.map((r) => [r.id, r]));
    for (const d of map.diagrams) for (const n of d.nodes) {
      const text = `${n.title} ${n.lines.join(' ')} ${n.rungIds.map((id) => rungAllAddresses(rungs.get(id)!).join(' ')).join(' ')}`.toLowerCase();
      if (text.includes(q)) out.add(n.id);
    }
    return out;
  }, [query, map, ladder]);
  const firstHit = () => {
    for (const d of map.diagrams) for (const n of d.nodes) if (hits.has(n.id)) { setSel({ d, n }); canvas.current?.show(d.id, n.id); return; }
  };

  const numberOf = useMemo(() => { const m = new Map(ladder.rungs.map((r, i) => [r.id, i + 1])); return (id: string) => m.get(id) ?? 0; }, [ladder]);
  const selRungs: Rung[] = useMemo(() => {
    if (!sel) return [];
    const ids = sel.n ? sel.n.rungIds : [...new Set(sel.d.nodes.flatMap((n) => n.rungIds))].slice(0, 20);
    return ladder.rungs.filter((r) => ids.includes(r.id));
  }, [sel, ladder]);
  const symbols = useMemo(() => {
    const kinds = new Set<string>();
    for (const r of selRungs) { r.branches.flat().forEach((e: LadderElement) => kinds.add(e.type)); r.outputs.forEach((o: LadderOutput) => kinds.add(o.type)); }
    return [...kinds].filter((k) => MEANING[k]);
  }, [selRungs]);
  // test switches: the inputs (X) and memory bits (C) the selected rungs read
  const switches = useMemo(() => [...new Set(selRungs.flatMap((r) => r.branches.flat().flatMap((e) => (e.type === 'CMP' || e.type === 'RAW' ? [] : [e.address.toUpperCase()]))))].filter((a) => /^(X|C)\d/.test(a)).slice(0, 16), [selRungs]);

  if (profile.language !== 'ladder' || !ladder.rungs.length) {
    return <div className="p-6 text-sm text-steel-600">{!ladder.rungs.length ? <span>No program yet. Write it on the <Link to="/program" className="underline">PLC Program</Link> page first.</span> : 'The flow diagram is drawn from ladder programs.'}</div>;
  }

  const why = sel?.n ? state?.why.get(sel.n.id) : undefined;
  const modeBtn = (m: Mode, text: string, hint: string) => (
    <button type="button" onClick={() => setMode(m)} title={hint} data-testid={`flow-mode-${m}`}
      className={`rounded px-3 py-1 text-xs font-semibold ${mode === m ? 'bg-brand-600 text-white' : 'border border-steel-300 bg-white text-steel-700 hover:bg-steel-50'}`}>{text}</button>
  );
  return (
    <div ref={root} className={`flex flex-col bg-white ${full ? 'fixed inset-0 z-50' : 'h-full'}`} data-testid="flow-page">
      <header className="flex flex-wrap items-center gap-3 border-b border-steel-200 bg-white px-4 py-2">
        <div className="mr-2">
          <h2 className="text-base font-semibold text-steel-900">Program flow</h2>
          <p className="text-xs text-steel-500">The whole program as diagrams, one per function. Click a box: its ladder is shown on the right.</p>
        </div>
        <div className="flex gap-1">
          {modeBtn('diagram', 'Diagram', 'The diagram only')}
          {modeBtn('test', 'Test (simulator)', 'Run the program in the simulator and click its inputs: no machine needed')}
          {modeBtn('watch', 'Watch the real PLC', 'Read the machine and show where it is: read only, nothing is changed in the PLC')}
        </div>
        {mode === 'test' && (
          <div className="flex gap-1">
            <button type="button" onClick={() => setRunning((r) => !r)} className="rounded border border-steel-300 bg-white px-2 py-1 text-xs">{running ? 'Pause' : 'Run'}</button>
            <button type="button" onClick={() => { sim.current?.reset(); sim.current?.step(10); clock.current = new Map(); publishSim(); }} className="rounded border border-steel-300 bg-white px-2 py-1 text-xs">Reset</button>
          </div>
        )}
        {mode === 'watch' && (
          <div className="flex items-center gap-2 text-xs" data-testid="flow-watch">
            {online.status === 'connected'
              ? <><span className="rounded bg-green-100 px-2 py-0.5 font-semibold text-green-900">Watching {online.settings.host} · read only</span><button type="button" onClick={() => void disconnectPlc()} className="rounded border border-steel-300 bg-white px-2 py-1">Disconnect</button></>
              : <>
                  <span className="text-steel-600">PLC {online.settings.host}{online.error ? ` · ${online.error}` : ''}</span>
                  <button type="button" disabled={!modbusBridge() || online.status === 'connecting'} onClick={() => void connectPlc(allAddresses)} className="rounded bg-brand-600 px-2 py-1 font-semibold text-white disabled:opacity-40">{online.status === 'connecting' ? 'Connecting…' : 'Connect (read only)'}</button>
                  {!modbusBridge() && <span className="text-steel-500">needs the desktop app</span>}
                  <Link to="/online" className="underline text-steel-500">PLC address</Link>
                </>}
          </div>
        )}
        <div className="flex items-center gap-1" aria-label="Window">
          {[
            [showList ? 'Hide list' : 'Show list', () => setShowList((v) => !v), 'flow-toggle-list'],
            [side === 'hidden' ? 'Show ladder' : 'Hide ladder', () => setSide((v) => (v === 'hidden' ? 'shown' : 'hidden')), 'flow-toggle-side'],
            [side === 'max' ? 'Ladder normal' : 'Ladder big', () => setSide((v) => (v === 'max' ? 'shown' : 'max')), 'flow-ladder-max'],
          ].map(([t, f, id]) => (
            <button key={id as string} type="button" onClick={f as () => void} data-testid={id as string} className="rounded border border-steel-300 bg-white px-2 py-1 text-xs text-steel-700 hover:bg-steel-50">{t as string}</button>
          ))}
          <button type="button" onClick={toggleFull} data-testid="flow-full" title={full ? 'Leave full screen (Esc)' : 'Full screen'} className="inline-flex items-center gap-1 rounded border border-steel-300 bg-white px-2 py-1 text-xs text-steel-700 hover:bg-steel-50">
            {full ? <ArrowsPointingInIcon className="h-4 w-4" /> : <ArrowsPointingOutIcon className="h-4 w-4" />}{full ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded border border-steel-300 bg-white px-2">
          <MagnifyingGlassIcon className="h-4 w-4 text-steel-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') firstHit(); }} placeholder="Find (name or address)…" aria-label="Find" data-testid="flow-find" className="w-52 py-1 text-sm outline-none" />
          {query.trim().length >= 2 && <span className="text-xs text-steel-500">{hits.size} found</span>}
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        {showList && side !== 'max' && <nav className="w-48 shrink-0 overflow-auto border-r border-steel-200 bg-white py-2 text-sm" aria-label="Functions" data-testid="flow-functions">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-steel-400">Functions</p>
          {map.diagrams.map((d) => {
            const sts = d.nodes.map((n) => state?.nodes.get(n.id));
            const dot = sts.includes('broken') ? 'bg-red-500' : sts.includes('waiting') ? 'bg-amber-500' : sts.includes('active') || sts.includes('true') ? 'bg-green-500' : 'bg-steel-300';
            return (
              <button key={d.id} type="button" onClick={() => { setSel({ d, n: null }); canvas.current?.show(d.id); }}
                className={`flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-steel-50 ${sel?.d.id === d.id ? 'bg-brand-50 font-semibold text-brand-800' : 'text-steel-700'}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto text-[10px] text-steel-400">{d.rungCount}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => canvas.current?.fit()} className="mt-2 w-full px-3 py-1 text-left text-xs text-brand-700 underline">Whole program</button>
        </nav>}
        <div className={`min-w-0 flex-1 ${side === 'max' ? 'hidden' : ''}`}>
          <FlowCanvas ref={canvas} map={map} state={state} selected={sel?.n?.id ?? null} hits={hits} onPick={(d, n) => { setSel({ d, n }); if (!n) canvas.current?.show(d.id); }} />
        </div>
        {side !== 'hidden' && <ResizablePane id="flow.side" defaultSize={440} min={300} max={2000} handle="left" fill={side === 'max'} className="overflow-auto border-l border-steel-200 bg-white p-3 text-sm">
        <aside data-testid="flow-side">
          {!sel && <p className="text-steel-500">Click a square or a diamond to see its ladder here, with what each symbol means.</p>}
          {sel && (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-steel-400">{sel.d.name}</p>
                <h3 className="font-semibold text-steel-900">{sel.n ? sel.n.title : `${sel.d.rungCount} rungs`}</h3>
                {sel.n && <ul className="mt-1 text-steel-700">{sel.n.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                {why && <p className={`mt-2 rounded px-2 py-1 text-xs font-semibold ${state?.nodes.get(sel.n!.id) === 'broken' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`} data-testid="flow-why">{why}</p>}
              </div>
              {mode === 'test' && switches.length > 0 && (
                <div data-testid="flow-switches">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-steel-400">Test: switch its inputs</p>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {switches.map((a) => {
                      const on = (a.startsWith('X') ? values?.inputs.get(a) : values?.bits.get(a)) ?? false;
                      return (
                        <button key={a} type="button" onClick={() => { const s = sim.current; if (!s) return; if (a.startsWith('X')) s.setInput(a, !on); else s.write(a, !on); s.step(10); publishSim(); }}
                          className={`truncate rounded border px-2 py-1 text-left text-xs ${on ? 'border-green-500 bg-green-50 text-green-900' : 'border-steel-300 bg-white text-steel-700'}`} title={a}>
                          {on ? '● ON ' : '○ OFF '}{nameOf(a)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-1">
                  <p className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-steel-400">The same in ladder</p>
                  <button type="button" onClick={() => setLadderZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))} title="Smaller" data-testid="flow-ladder-smaller" className="h-6 w-6 rounded border border-steel-300 text-xs font-bold">A−</button>
                  <span className="w-10 text-center text-[11px] text-steel-500">{Math.round(ladderZoom * 100)}%</span>
                  <button type="button" onClick={() => setLadderZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} title="Bigger" data-testid="flow-ladder-bigger" className="h-6 w-6 rounded border border-steel-300 text-xs font-bold">A+</button>
                </div>
                <div className="mt-1 origin-top-left" style={{ zoom: ladderZoom }} data-testid="flow-ladder">
                  <LiveLadder program={{ ...ladder, rungs: selRungs }} numberOf={numberOf} power={values?.power ?? new Map<string, RungPower>()}
                    bits={values?.bits ?? new Map()} words={values?.words ?? new Map()} timers={values?.timers ?? new Map()} counters={values?.counters ?? new Map()} labelOf={nameOf} />
                </div>
              </div>
              {symbols.length > 0 && (
                <div className="rounded border border-steel-200 bg-steel-50 p-2 text-xs text-steel-700" data-testid="flow-learn">
                  <p className="mb-1 font-semibold text-steel-800">What these symbols mean</p>
                  <ul className="space-y-0.5">{symbols.map((k) => <li key={k} className="font-mono">{MEANING[k]}</li>)}</ul>
                  <p className="mt-1">{parallel}</p>
                </div>
              )}
            </div>
          )}
        </aside>
        </ResizablePane>}
      </div>
    </div>
  );
}
