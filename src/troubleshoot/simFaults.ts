/**
 * Fault injection for practising fault finding on the simulator: the faults sit between the plant model and the
 * PLC, so they work with any machine model.
 *   open-wire     an input's wire is broken: the PLC sees it OFF whatever the device does
 *   stuck         a sensor stuck ON (or OFF)
 *   blown-fuse    an output fuse / common is gone: the PLC turns the Ys ON, the devices get no power
 *   wrong-preset  a preset / setpoint register holds a wrong value (written once when the fault is applied)
 */
import type { Simulator } from '../plc/sim/engine';
import { machineAnalogValues, machineInputs, stepMachine, type MachineModel } from '../plc/sim/machineModel';

export type Fault =
  | { kind: 'open-wire'; input: string }
  | { kind: 'stuck'; input: string; value: boolean }
  | { kind: 'blown-fuse'; outputs: string[]; fuse?: string }
  | { kind: 'wrong-preset'; register: string; value: number };

const up = (a: string) => a.trim().toUpperCase();

/** What the PLC's input terminals see with the faults. */
export function faultyInputs(inputs: Map<string, boolean>, faults: Fault[]): Map<string, boolean> {
  const m = new Map(inputs);
  for (const f of faults) {
    if (f.kind === 'open-wire') m.set(up(f.input), false);
    else if (f.kind === 'stuck') m.set(up(f.input), f.value);
  }
  return m;
}

/** What the devices get from the PLC's outputs with the faults. */
export function faultyOutputs(outputs: Map<string, boolean>, faults: Fault[]): Map<string, boolean> {
  const dead = new Set(faults.flatMap((f) => (f.kind === 'blown-fuse' ? f.outputs.map(up) : [])));
  return new Map([...outputs].map(([a, v]) => [a, v && !dead.has(up(a))] as const));
}

/** Write the wrong-preset faults into the PLC memory (once, like an operator changing the value). */
export function applyPresetFaults(sim: Simulator, faults: Fault[]): void {
  for (const f of faults) if (f.kind === 'wrong-preset') sim.write(up(f.register), f.value);
}

/** One closed-loop slice of `ms` with the faults in place (10 ms steps). */
export function runWithFaults(sim: Simulator, model: MachineModel, faults: Fault[], ms: number, dtMs = 10): void {
  for (let t = 0; t < ms; t += dtMs) {
    stepMachine(model, faultyOutputs(sim.outputs(), faults), dtMs, (x) => sim.readWord(x));
    for (const [a, v] of faultyInputs(machineInputs(model), faults)) sim.setInput(a, v);
    for (const [a, v] of machineAnalogValues(model)) sim.write(a, v);
    sim.step(dtMs);
  }
}

/** Short text for the fault list on the Simulate page. */
export function faultText(f: Fault, name: (a: string) => string = (a) => a): string {
  switch (f.kind) {
    case 'open-wire': return `Open wire on ${name(f.input)}`;
    case 'stuck': return `${name(f.input)} stuck ${f.value ? 'ON' : 'OFF'}`;
    case 'blown-fuse': return `Blown fuse${f.fuse ? ` ${f.fuse}` : ''}: ${f.outputs.map(name).join(', ')} get no power`;
    case 'wrong-preset': return `${name(f.register)} set to ${f.value}`;
  }
}
