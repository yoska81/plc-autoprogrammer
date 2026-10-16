import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { IOWiring } from '../electrical/types';
import type { LadderProgram } from '../plc/ladder';
import { SimController } from './controller';
import type { SimHandle } from './controller';
import type { SimIOPoint } from './machineModel';

export type { SimHandle, SimSnapshot, LogEntry } from './controller';

/**
 * One simulator per (program, io, wiring) *content*: a parent that rebuilds
 * equal arrays on every render does not reset the simulation.
 */
export function useSimulation(program: LadderProgram, io: SimIOPoint[], wiring: IOWiring[]) {
  const key = useMemo(() => JSON.stringify({ program, io, wiring }), [program, io, wiring]);
  const ctl = useMemo(() => {
    const d = JSON.parse(key) as { program: LadderProgram; io: SimIOPoint[]; wiring: IOWiring[] };
    return new SimController(d.program, d.io, d.wiring);
  }, [key]);
  useEffect(() => () => ctl.dispose(), [ctl]);
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot);
  return { ctl, snap };
}

const noSubscribe = () => () => {};

/** Live value of one address for HMI widgets: `const on = useSimValue(handle, 'Y001')`. */
export function useSimValue(handle: SimHandle | null | undefined, address: string): boolean | number {
  return useSyncExternalStore(
    handle ? handle.subscribe : noSubscribe,
    () => (handle ? handle.read(address) : false),
  );
}
