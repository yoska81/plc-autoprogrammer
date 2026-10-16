/**
 * PLC + machine simulator: run the ladder program against a simulated
 * machine built from the I/O list and wiring, with live power flow.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ForwardIcon, PauseIcon, PlayIcon } from '@heroicons/react/20/solid';
import type { IOWiring } from '../electrical/types';
import type { LadderProgram } from '../plc/ladder';
import { rungAddresses } from '../plc/ladder';
import LadderView from '../components/ladder/LadderView';
import { isBitAddress, isConstant, normAddress } from './engine';
import type { SimHandle } from './controller';
import type { SimIOPoint } from './machineModel';
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

function natural(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

function prefixOf(a: string) {
  return a.replace(/\d+$/, '');
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

  const addrs = useMemo(() => {
    const all = new Set<string>();
    for (const r of program.rungs) for (const a of rungAddresses(r)) if (a && !isConstant(a)) all.add(normAddress(a));
    for (const r of program.rungs) for (const o of r.outputs) if (o.type === 'MATH') {
      for (const m of o.expression.toUpperCase().match(/[A-Z]+\d+/g) ?? []) all.add(m);
    }
    for (const p of io) if (p.address) all.add(normAddress(p.address));
    const list = [...all].sort(natural);
    const by = (pre: string[]) => list.filter((a) => pre.includes(prefixOf(a)));
    return {
      inputs: by(['X']),
      outputs: by(['Y']),
      cBits: by(['C']),
      timers: by(['T']),
      counters: by(['CT']),
      registers: list.filter((a) => !isBitAddress(a) && ['DS', 'DD', 'DF', 'DH'].includes(prefixOf(a))),
    };
  }, [program.rungs, io]);

  const actions: MachineActions = useMemo(() => ({
    press: (id, p) => ctl.press(id, p),
    toggle: (id) => ctl.toggle(id),
    addPart: (id) => ctl.addPart(id),
    removePart: (id) => ctl.removePart(id),
  }), [ctl]);

  const yOn = addrs.outputs.filter((a) => snap.bits.get(a)).length;
  const btn = 'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm disabled:opacity-40';

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 text-slate-800">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        {snap.running ? (
          <button type="button" className={`${btn} border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`} onClick={() => ctl.pause()}>
            <PauseIcon className="h-4 w-4" /> Pause
          </button>
        ) : (
          <button type="button" className={`${btn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`} onClick={() => ctl.start()}>
            <PlayIcon className="h-4 w-4" /> Run
          </button>
        )}
        <button type="button" className={`${btn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`} disabled={snap.running} onClick={() => ctl.stepOnce()} title="Run exactly one 10 ms scan">
          <ForwardIcon className="h-4 w-4" /> Step scan
        </button>
        <button type="button" className={`${btn} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`} onClick={() => ctl.reset()} title="Power-cycle the PLC and reset the machine">
          <ArrowPathIcon className="h-4 w-4" /> Reset
        </button>
        <div className="ml-1 flex items-center rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" onClick={() => ctl.setSpeed(s)}
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${snap.speed === s ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {s}x
            </button>
          ))}
        </div>
        <span className={`ml-1 rounded px-2 py-0.5 text-[11px] font-bold tracking-wide ${snap.running ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
          {snap.running ? 'RUN' : 'STOP'}
        </span>
        <div className="ml-auto flex items-center gap-4 font-mono text-xs text-slate-600">
          <span title="Simulated time"><span className="text-slate-400">clock</span> <b className="text-slate-800">{(snap.timeMs / 1000).toFixed(2)} s</b></span>
          <span title="Completed scans (10 ms each)"><span className="text-slate-400">scans</span> <b className="text-slate-800">{snap.scanCount}</b></span>
          <span title="Outputs ON"><span className="text-slate-400">Y on</span> <b className="text-slate-800">{yOn}/{addrs.outputs.length}</b></span>
        </div>
      </div>
      {snap.errors.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">{snap.errors.join(' · ')}</div>
      )}

      {/* body */}
      <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 gap-3 overflow-y-auto p-3 lg:auto-rows-[minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_330px] lg:overflow-hidden">
        <div className="lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Machine</h2>
          <MachinePanel devices={snap.devices} bits={snap.bits} inputs={snap.inputs} actions={actions} />
        </div>

        <div className="flex h-[560px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:h-auto">
          <div className="flex items-center gap-1 border-b border-slate-200 px-2 pt-1.5">
            {(['live', 'drawing'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`-mb-px rounded-t border px-3 py-1 text-xs font-semibold ${view === v ? 'border-slate-200 border-b-white bg-white text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {v === 'live' ? 'Live logic' : 'Ladder drawing'}
              </button>
            ))}
            {view === 'live' && (
              <div className="ml-auto flex items-center gap-3 pb-1 text-[10.5px] text-slate-500">
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm border border-emerald-500 bg-emerald-100" /> conducting</span>
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm border border-dashed border-emerald-400 bg-white" /> closed, no power</span>
                <span className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm border border-slate-300 bg-white" /> open</span>
              </div>
            )}
            {view === 'drawing' && <span className="ml-auto pb-1 text-[10.5px] text-slate-500">Static drawing — live state is on the Live logic tab</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {view === 'live' ? (
              <LiveLadder program={program} power={snap.power} bits={snap.bits} words={snap.words}
                timers={snap.timers} counters={snap.counters} labelOf={labelOf} />
            ) : (
              <LadderView program={program} labels={labels} />
            )}
          </div>
        </div>

        <div className="flex h-[600px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:h-auto">
          <IOPanel
            inputs={addrs.inputs} outputs={addrs.outputs} cBits={addrs.cBits}
            timerAddrs={addrs.timers} counterAddrs={addrs.counters} registers={addrs.registers}
            fieldInputs={snap.inputs} bits={snap.bits} words={snap.words} forces={snap.forces}
            timers={snap.timers} counters={snap.counters} log={snap.log} labelOf={labelOf}
            onForce={(a, v) => ctl.force(a, v)} onWrite={(a, v) => ctl.write(a, v)}
          />
        </div>
      </div>
    </div>
  );
}
