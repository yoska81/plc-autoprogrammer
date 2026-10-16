/**
 * PLC + machine simulator: run the ladder program against a simulated
 * machine built from the I/O list and wiring, with live power flow, forces,
 * bypasses and per-block testing.
 */
import ResizablePane from '../../components/ResizablePane';
import { useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon, ForwardIcon, PauseIcon, PlayIcon, XMarkIcon } from '@heroicons/react/20/solid';
import type { IOWiring } from '../../electrical/types';
import type { LadderProgram } from '../core/ladder';
import { rungAddresses } from '../core/ladder';
import LadderView from '../ui/ladder/LadderView';
import { isBitAddress, isConstant, normAddress } from './engine';
import type { SimHandle, SimSnapshot } from './controller';
import type { SimController } from './controller';
import { deviceAddresses } from './machineModel';
import type { SimIOPoint } from './machineModel';
import { blockAddresses, devicesInBlock, programBlocks } from './blocks';
import type { SimBlock } from './blocks';
import { useSimulation } from './useSimulation';
import MachinePanel from './MachinePanel';
import type { MachineActions } from './MachinePanel';
import LiveLadder from './LiveLadder';
import IOPanel from './IOPanel';

export type { SimHandle } from './controller';

export interface SimulatorPanelProps {
  program: LadderProgram;
  io: SimIOPoint[];
  wiring: IOWiring[];
  /** Address -> nickname / description. */
  labels: Map<string, string>;
  /** Receives a live read/write handle (for an HMI screen) whenever the simulator is (re)created. */
  onHandle?: (h: SimHandle) => void;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const SKIPS: [string, number][] = [['1 min', 60_000], ['10 min', 600_000], ['1 h', 3_600_000]];

function natural(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function prefixOf(a: string) {
  return a.replace(/\d+$/, '');
}

const onOff = (v: boolean | number) => (typeof v === 'number' ? String(v) : v ? 'ON' : 'OFF');

interface BypassItem { key: string; text: string; clear: () => void }

/** Everything that makes the simulation differ from the real machine right now. */
function bypassItems(snap: SimSnapshot, ctl: SimController, program: LadderProgram, blocks: SimBlock[], labelOf: (a: string) => string): BypassItem[] {
  const items: BypassItem[] = [];
  const blockName = (id: string) => blocks.find((b) => b.id === id)?.name ?? id;
  if (snap.blockOnly && snap.block) {
    items.push({ key: 'blockonly', text: `Running block "${blockName(snap.block)}" only (${snap.skippedRungs.size} rungs skipped)`, clear: () => ctl.setBlockOnly(false) });
  }
  program.rungs.forEach((r, i) => {
    if (snap.rungBypass.has(r.id)) items.push({ key: `r:${r.id}`, text: `Rung ${i + 1} bypassed`, clear: () => ctl.bypassRung(r.id, false) });
  });
  for (const d of snap.devices) {
    if (!d.bypass?.on) continue;
    const held = ['sensor', 'pushbutton', 'selector', 'conveyor'].includes(d.kind) ? ` (held ${onOff(d.bypass.value)})` : '';
    items.push({ key: `d:${d.id}`, text: `${d.label} bypassed${held}`, clear: () => ctl.setDeviceBypass(d.id, false) });
  }
  for (const [a, v] of [...snap.forces].sort((x, y) => natural(x[0], y[0]))) {
    items.push({ key: `f:${a}`, text: `${a} ${labelOf(a) ? `${labelOf(a)} ` : ''}forced ${onOff(v)}`, clear: () => ctl.force(a, null) });
  }
  for (const s of snap.blockSignals) {
    if (!s.held) continue;
    items.push({ key: `h:${s.address}`, text: `${s.address} ${labelOf(s.address) ? `${labelOf(s.address)} ` : ''}held ${onOff(s.value)}`, clear: () => ctl.setHold(s.address, { held: false }) });
  }
  return items;
}

export default function SimulatorPanel({ program, io, wiring, labels, onHandle }: SimulatorPanelProps) {
  const { ctl, snap } = useSimulation(program, io, wiring);
  const [view, setView] = useState<'live' | 'drawing'>('live');

  useEffect(() => { onHandle?.(ctl.handle); }, [ctl, onHandle]);

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of program.tags) if (t.nickname) m.set(normAddress(t.address), t.nickname.replace(/_/g, ' '));
    for (const p of io) if (p.address && p.description) m.set(normAddress(p.address), p.description);
    for (const [a, l] of labels) if (l) m.set(normAddress(a), l);
    return (a: string) => m.get(normAddress(a)) ?? '';
  }, [program.tags, io, labels]);

  const blocks = useMemo(() => programBlocks(program), [program]);
  const hasBlocks = blocks.length > 1 || (blocks.length === 1 && blocks[0].id !== 'general');
  const block = snap.block;
  const blockAddrs = useMemo(() => (block ? blockAddresses(program, block) : null), [program, block]);
  // device membership only depends on the static device list, not on its live state
  const deviceKey = snap.devices.map((d) => d.id).join(',');
  const visibleDevices = useMemo(
    () => (blockAddrs ? devicesInBlock(snap.devices, blockAddrs) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockAddrs, deviceKey],
  );

  const addrs = useMemo(() => {
    const all = new Set<string>();
    for (const r of program.rungs) for (const a of rungAddresses(r)) if (a && !isConstant(a)) all.add(normAddress(a));
    for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'MATH') {
      for (const m of o.expression.toUpperCase().match(/[A-Z]+\d+/g) ?? []) if (m !== 'MOD') all.add(m);
    }
    for (const p of io) if (p.address) all.add(normAddress(p.address));
    let list = [...all].sort(natural);
    if (blockAddrs) {
      const keep = new Set(blockAddrs);
      for (const d of snap.devices) if (visibleDevices?.has(d.id)) {
        const { inputs, outputs } = deviceAddresses(d);
        for (const a of [...inputs, ...outputs]) keep.add(a);
      }
      list = list.filter((a) => keep.has(a));
    }
    const by = (pre: string[]) => list.filter((a) => pre.includes(prefixOf(a)));
    return {
      inputs: by(['X']),
      outputs: by(['Y']),
      cBits: by(['C']),
      timers: by(['T']),
      counters: by(['CT']),
      registers: list.filter((a) => !isBitAddress(a) && ['DS', 'DD', 'DF', 'DH'].includes(prefixOf(a))),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program.rungs, io, blockAddrs, visibleDevices]);

  const bypassedInputs = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of snap.devices) if (d.bypass?.on) for (const a of deviceAddresses(d).inputs) m.set(a, d.label);
    return m;
  }, [snap.devices]);

  const actions: MachineActions = useMemo(() => ({
    press: (id, p) => ctl.press(id, p),
    toggle: (id) => ctl.toggle(id),
    addPart: (id) => ctl.addPart(id),
    removePart: (id) => ctl.removePart(id),
    setBypass: (id, on, value) => ctl.setDeviceBypass(id, on, value),
  }), [ctl]);

  const groups = hasBlocks ? (block ? blocks.filter((b) => b.id === block) : blocks) : undefined;
  const items = bypassItems(snap, ctl, program, blocks, labelOf);
  const yOn = addrs.outputs.filter((a) => snap.bits.get(a)).length;
  const btn = 'inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[13px] font-semibold shadow-sm disabled:opacity-40';
  const blockName = (id: string) => blocks.find((b) => b.id === id)?.name ?? id;

  return (
    <div className="flex h-full min-h-0 flex-col bg-steel-100 text-[13px] text-steel-800">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-steel-200 bg-white px-3 py-1.5">
        {snap.running ? (
          <button type="button" className={`${btn} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`} onClick={() => ctl.pause()}>
            <PauseIcon className="h-4 w-4" /> Pause
          </button>
        ) : (
          <button type="button" className={`${btn} border-brand-600 bg-brand-600 text-brand-950 hover:bg-brand-700`} onClick={() => ctl.start()}>
            <PlayIcon className="h-4 w-4" /> Run
          </button>
        )}
        <button type="button" className={`${btn} border-steel-300 bg-white text-steel-700 hover:bg-steel-50`} disabled={snap.running} onClick={() => ctl.stepOnce()} title="Run exactly one 10 ms scan">
          <ForwardIcon className="h-4 w-4" /> Step scan
        </button>
        <button type="button" className={`${btn} border-steel-300 bg-white text-steel-700 hover:bg-steel-50`} onClick={() => ctl.reset()}
          title="Power-cycle the PLC and reset the machine. Retentive memory (DS registers, counters) keeps its value like a real CLICK; forces and bypasses stay">
          <ArrowPathIcon className="h-4 w-4" /> Reset
        </button>
        <button type="button" className={`${btn} border-steel-300 bg-white text-steel-700 hover:bg-steel-50`} onClick={() => ctl.reset(true)}
          title="Power-cycle and also clear retentive memory (setpoints, counters, run hours) — like a new PLC">
          Clear memory
        </button>
        <div className="flex items-center rounded border border-steel-300 bg-white p-0.5" role="group" aria-label="Skip ahead"
          title="Fast-forward simulated time (run hours, parts per minute, service interval). Long skips use 100 ms scans.">
          <span className="px-1 text-[11px] font-semibold text-steel-500">Skip</span>
          {SKIPS.map(([label, ms]) => (
            <button key={label} type="button" disabled={snap.skipLeftMs > 0} onClick={() => ctl.skipAhead(ms)}
              className="rounded px-1.5 py-0.5 text-[12px] font-semibold text-steel-600 hover:bg-steel-100 disabled:opacity-40">
              +{label}
            </button>
          ))}
          {snap.skipLeftMs > 0 && (
            <button type="button" onClick={() => ctl.cancelSkip()} className="rounded bg-amber-100 px-1.5 py-0.5 text-[12px] font-semibold text-amber-800">
              {Math.ceil(snap.skipLeftMs / 1000)} s left · cancel
            </button>
          )}
        </div>
        <div className="ml-1 flex items-center rounded border border-steel-300 bg-white p-0.5" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" onClick={() => ctl.setSpeed(s)}
              className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${snap.speed === s ? 'bg-brand-600 text-brand-950' : 'text-steel-600 hover:bg-steel-100'}`}>
              {s}x
            </button>
          ))}
        </div>
        <span className={`ml-1 rounded px-2 py-0.5 text-[11px] font-bold tracking-wide ${snap.running ? 'bg-emerald-100 text-emerald-800' : 'bg-steel-200 text-steel-600'}`}>
          {snap.running ? 'RUN' : 'STOP'}
        </span>
        <div className="ml-auto flex items-center gap-4 font-mono text-[12px] text-steel-600">
          <span title="Simulated time"><span className="text-steel-400">clock</span> <b className="text-steel-800">{(snap.timeMs / 1000).toFixed(2)} s</b></span>
          <span title="Completed scans (10 ms each)"><span className="text-steel-400">scans</span> <b className="text-steel-800">{snap.scanCount}</b></span>
          <span title="Outputs ON"><span className="text-steel-400">Y on</span> <b className="text-steel-800">{yOn}/{addrs.outputs.length}</b></span>
        </div>
      </div>

      {/* blocks */}
      {hasBlocks && (
        <div className="flex flex-wrap items-center gap-2 border-b border-steel-200 bg-white px-3 py-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-steel-500">Block</span>
          <div className="flex flex-wrap items-center rounded border border-steel-300 bg-white p-0.5" role="group" aria-label="Block">
            {[{ id: null as string | null, name: 'All', rungIds: program.rungs.map((r) => r.id) }, ...blocks].map((b) => (
              <button key={b.id ?? 'all'} type="button" onClick={() => ctl.selectBlock(b.id)}
                title={b.id ? blocks.find((x) => x.id === b.id)?.description : 'Whole program'}
                className={`rounded px-2 py-0.5 text-[12px] font-semibold ${block === b.id ? 'bg-brand-600 text-brand-950' : 'text-steel-600 hover:bg-steel-100'}`}>
                {b.name} <span className={block === b.id ? 'text-brand-800' : 'text-steel-400'}>{b.rungIds.length}</span>
              </button>
            ))}
          </div>
          {block && (
            <label className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-0.5 text-[12px] font-medium ${snap.blockOnly ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-steel-300 text-steel-700'}`}
              title="Execute only this block's rungs; every other rung is skipped (outputs hold)">
              <input type="checkbox" className="accent-amber-500" checked={snap.blockOnly} onChange={(e) => ctl.setBlockOnly(e.target.checked)} />
              Run selected block only
            </label>
          )}
          {block && (
            <span className="text-[12px] text-steel-500">
              Showing the rungs and devices of <b className="text-steel-700">{blockName(block)}</b>
              {snap.blockSignals.length > 0 && <> · {snap.blockSignals.length} signal{snap.blockSignals.length === 1 ? '' : 's'} from other blocks</>}
            </span>
          )}
        </div>
      )}

      {/* bypass banner */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-amber-300 bg-amber-50 px-3 py-1.5" role="status">
          <span className="flex items-center gap-1 text-[12px] font-bold text-amber-800">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" /> Bypasses active ({items.length})
          </span>
          {items.map((it) => (
            <span key={it.key} className="inline-flex items-center gap-0.5 rounded border border-amber-300 bg-white py-px pl-1.5 pr-0.5 text-[11.5px] text-amber-900">
              {it.text}
              <button type="button" onClick={it.clear} title="Remove" className="rounded p-px text-amber-600 hover:bg-amber-100"><XMarkIcon className="h-3.5 w-3.5" /></button>
            </span>
          ))}
          <button type="button" onClick={() => ctl.clearAll()}
            className="ml-auto rounded border border-amber-500 bg-amber-500 px-2 py-0.5 text-[12px] font-semibold text-white hover:bg-amber-600">
            Clear all bypasses / forces
          </button>
        </div>
      )}
      {snap.errors.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">{snap.errors.join(' · ')}</div>
      )}

      {/* body */}
      <div className="flex min-h-0 flex-1 overflow-y-hidden overflow-x-auto p-3">
        <ResizablePane id="sim.machine" defaultSize={300} min={220} max={760} className="min-h-0 overflow-y-auto pr-3">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-steel-500">
            Machine{block ? ` · ${blockName(block)}` : ''}
          </h2>
          <MachinePanel devices={snap.devices} bits={snap.bits} inputs={snap.inputs} actions={actions} visible={visibleDevices} />
        </ResizablePane>

        <div className="flex min-w-[260px] flex-1 flex-col overflow-hidden rounded-lg border border-steel-200 bg-white shadow-sm">
          <div className="flex items-center gap-1 border-b border-steel-200 px-2 pt-1.5">
            {(['live', 'drawing'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`-mb-px rounded-t border px-3 py-1 text-[13px] font-semibold ${view === v ? 'border-steel-200 border-b-white bg-white text-brand-800' : 'border-transparent text-steel-500 hover:text-steel-700'}`}>
                {v === 'live' ? 'Live logic' : 'Ladder drawing'}
              </button>
            ))}
            {view === 'live' && (
              <div className="ml-auto flex items-center gap-3 pb-1 text-[11px] text-steel-500">
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm border border-emerald-500 bg-emerald-100" /> conducting</span>
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm border border-dashed border-emerald-400 bg-white" /> closed, no power</span>
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm border border-steel-300 bg-white" /> open</span>
              </div>
            )}
            {view === 'drawing' && <span className="ml-auto pb-1 text-[11px] text-steel-500">Static drawing — live state is on the Live logic tab</span>}
          </div>
          {view === 'live' && block && snap.blockSignals.length > 0 && (
            <div className="border-b border-steel-200 bg-steel-50 px-3 py-1.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-steel-500">Signals from other blocks</div>
              <div className="flex flex-wrap gap-1.5">
                {snap.blockSignals.map((s) => (
                  <span key={s.address} className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[12px] ${s.held ? 'border-amber-400 bg-amber-50' : 'border-steel-300 bg-white'}`}
                    title={`Written by: ${s.fromBlocks.map(blockName).join(', ')}`}>
                    <label className="flex cursor-pointer items-center gap-1">
                      <input type="checkbox" className="accent-amber-500" checked={s.held} onChange={(e) => ctl.setHold(s.address, { held: e.target.checked })} />
                      <b className="font-mono">{s.address}</b>
                      <span className="max-w-[140px] truncate text-steel-600">{labelOf(s.address)}</span>
                    </label>
                    {s.isWord ? (
                      <input type="number" step="any" defaultValue={Number(s.value)} key={`${s.address}:${String(s.value)}`}
                        className="w-16 rounded border border-steel-300 px-1 text-right font-mono text-[11px]"
                        onKeyDown={(e) => { if (e.key === 'Enter') ctl.setHold(s.address, { value: Number(e.currentTarget.value), held: true }); }} />
                    ) : (
                      <span className="inline-flex overflow-hidden rounded border border-steel-300">
                        {[true, false].map((v) => (
                          <button key={String(v)} type="button" onClick={() => ctl.setHold(s.address, { value: v, held: true })}
                            className={`px-1.5 text-[10.5px] font-bold ${s.value === v && s.held ? 'bg-amber-500 text-white' : s.value === v ? 'bg-steel-200 text-steel-700' : 'bg-white text-steel-500 hover:bg-steel-50'}`}>
                            {v ? 'ON' : 'OFF'}
                          </button>
                        ))}
                      </span>
                    )}
                    <span className="text-[10.5px] text-steel-400">from {s.fromBlocks.map(blockName).join(', ')}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {view === 'live' ? (
              <LiveLadder program={program} power={snap.power} bits={snap.bits} words={snap.words}
                timers={snap.timers} counters={snap.counters} labelOf={labelOf}
                rungBypass={snap.rungBypass} skipped={snap.skippedRungs} onBypassRung={(id, on) => ctl.bypassRung(id, on)}
                groups={groups} />
            ) : (
              <LadderView program={block ? { ...program, rungs: program.rungs.filter((r) => groups?.[0]?.rungIds.includes(r.id)) } : program} labels={labels} />
            )}
          </div>
        </div>

        <ResizablePane id="sim.io" defaultSize={330} min={240} max={900} handle="left" className="ml-3 flex flex-col overflow-hidden rounded-lg border border-steel-200 bg-white shadow-sm">
          <IOPanel
            inputs={addrs.inputs} outputs={addrs.outputs} cBits={addrs.cBits}
            timerAddrs={addrs.timers} counterAddrs={addrs.counters} registers={addrs.registers}
            fieldInputs={snap.inputs} bits={snap.bits} words={snap.words} forces={snap.forces}
            holds={snap.holds} bypassedInputs={bypassedInputs}
            timers={snap.timers} counters={snap.counters} log={snap.log} labelOf={labelOf}
            onForce={(a, v) => ctl.force(a, v)} onWrite={(a, v) => ctl.write(a, v)}
          />
        </ResizablePane>
      </div>
    </div>
  );
}
