/**
 * The example machine designed by the rule-based engine, for the "Improve design" tests
 * (same inputs as the engine's golden "example" scenario).
 */
import { generateDefaultDesign, type EngineInput } from '../engine';
import { getPart } from '../catalog';
import type { DrawingContext } from '../derive';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import { SPEC } from '../../preview/sampleProject';
import { specToText } from '../../spec/types';
import type { IOPoint } from '../../types/io';
import type { DesignInputs, SupplyVoltage } from '../types';

const POINTS: [string, 'input' | 'output'][] = [
  ['E-Stop OK (safety relay)', 'input'], ['Start Button', 'input'], ['Stop Button', 'input'],
  ['Part at end photo-eye', 'input'], ['Pusher extended', 'input'], ['Pusher retracted', 'input'],
  ['Conveyor motor contactor', 'output'], ['Pusher solenoid', 'output'], ['Main air dump valve', 'output'],
];

export function exampleInput(supply: SupplyVoltage = '480VAC-3PH', hp = 1): Omit<EngineInput, 'model'> & { spec: string } {
  const io = POINTS.map(([description, type], i) => ({ id: `p${i + 1}`, category: 'Operator/HMI', description, type })) as IOPoint[];
  const profile = getProfile('click');
  const cpu = getCpu(profile, 'C0-10DD1E-D');
  const inputs: DesignInputs = { supply, enclosureRating: 'NEMA 12', notes: '', motors: [{ tag: 'M1', description: 'Conveyor motor', hp, voltage: supply, starter: 'contactor-overload', reversing: false }], requiredParts: [] };
  return {
    io, addresses: resolveAddresses(profile, cpu, io, moduleSlots([])), spec: specToText(SPEC), inputs, modules: [], region: 'US', getPart,
    hmiPartNumber: 'CM5-T7W', now: '2026-01-01T00:00:00.000Z', projectName: 'example',
    plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label },
  };
}

export function ctxFor(input: ReturnType<typeof exampleInput>, design = generateDefaultDesign(input).design): DrawingContext {
  return {
    projectName: 'example', design, getPart, plc: input.plc, region: input.region, hmiPartNumber: input.hmiPartNumber,
    io: input.io.map((p) => ({ address: input.addresses.get(p.id) ?? '', description: p.description, type: p.type })),
  };
}

export function exampleCtx(): DrawingContext {
  return ctxFor(exampleInput());
}
