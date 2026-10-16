import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { IOWiring } from '../../electrical/types';
import type { LadderProgram } from '../core/ladder';
import { SimController } from './controller';
import type { SimHandle } from './controller';
import type { SimIOPoint } from './machineModel';
import { useUiStore } from '../../store/useUiStore';
import { useProjectsStore } from '../../store/useProjectsStore';

export type { SimHandle, SimSnapshot, LogEntry, BlockSignal } from './controller';

/**
 * One simulator per (program, io, wiring) *content*: a parent that rebuilds
 * equal arrays on every render does not reset the simulation.
 */
export function useSimulation(program: LadderProgram, io: SimIOPoint[], wiring: IOWiring[]) {
  const key = useMemo(() => JSON.stringify({ program, io, wiring }), [program, io, wiring]);
  const ctl = useMemo(() => {
    const d = JSON.parse(key) as { program: LadderProgram; io: SimIOPoint[]; wiring: IOWiring[] };
    const c = new SimController(d.program, d.io, d.wiring);
    // Speed and block focus the user chose last time (per project), before the first snapshot.
    const saved = savedSettings();
    if (saved) {
      c.setSpeed(saved.speed);
      if (saved.block !== null && (saved.block === '' || d.program.blocks?.some((b) => b.id === saved.block))) {
        c.selectBlock(saved.block);
        if (saved.blockOnly) c.setBlockOnly(true);
      }
    }
    return c;
  }, [key]);
  useEffect(() => () => ctl.dispose(), [ctl]);
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot);
  useEffect(() => {
    const now = { speed: snap.speed, block: snap.block, blockOnly: snap.blockOnly };
    if (JSON.stringify(now) !== JSON.stringify(savedSettings())) saveSettings(now);
  }, [snap.speed, snap.block, snap.blockOnly]);
  return { ctl, snap };
}

interface SimSettings { speed: number; block: string | null; blockOnly: boolean }
const SIM_KEY = 'sim.settings';
const projectKey = () => useProjectsStore.getState().activeId ?? '_';
const savedSettings = () => useUiStore.getState().byProject[projectKey()]?.[SIM_KEY] as SimSettings | undefined;
const saveSettings = (v: SimSettings) => useUiStore.getState().setUi(projectKey(), SIM_KEY, v);

const noSubscribe = () => () => {};

/** Live value of one address for HMI widgets: `const on = useSimValue(handle, 'Y001')`. */
export function useSimValue(handle: SimHandle | null | undefined, address: string): boolean | number {
  return useSyncExternalStore(
    handle ? handle.subscribe : noSubscribe,
    () => (handle ? handle.read(address) : false),
  );
}
