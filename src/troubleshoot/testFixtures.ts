/**
 * Test fixtures for the troubleshooter: the user's Sealing Head (CLICK C0-11DD2E-D + C0-08ND3 + C0-04THM,
 * NEMA 4X, VFD unwinder, heater with thermocouple, two-hand, light curtain, guard door). Used by the tests only.
 */
import { generateDefaultDesign } from '../electrical/engine';
import { getPart } from '../electrical/catalog';
import type { DrawingContext } from '../electrical/derive';
import { getCpu, getProfile } from '../plc/core/profiles';
import { resolveAddresses } from '../plc/core/profile';
import { moduleSlots } from '../plc/core/modules';
import { analogSetup } from '../plc/core/analog';
import type { IOPoint } from '../types/io';

// --- the user's Sealing Head --------------------------------------------------------------------------
const pt = (description: string, type: 'input' | 'output', deviceType: string, extra: Partial<IOPoint> = {}): Omit<IOPoint, 'id'> =>
  ({ description, type, category: 'Operator/HMI', deviceType, reason: 'spec', ...extra }) as Omit<IOPoint, 'id'>;
export const SEAL = [
  pt('Safety relay OK (E-stop, guard door, light curtain)', 'input', 'safety-relay-output'),
  pt('Two-hand start button left', 'input', 'pushbutton-no'), pt('Two-hand start button right', 'input', 'pushbutton-no'),
  pt('Light curtain clear (OSSD)', 'input', 'other'), pt('Guard door closed', 'input', 'limit-switch'),
  pt('Stop button', 'input', 'pushbutton-nc'), pt('Fault reset button', 'input', 'pushbutton-no'),
  pt('Sealing head up', 'input', 'sensor-pnp'), pt('Sealing head down', 'input', 'sensor-pnp'),
  pt('Heater over-temperature limit tripped', 'input', 'other'), pt('Unwinder VFD fault', 'input', 'vfd-input'),
  pt('Seal bar temperature (thermocouple)', 'input', 'other', { signal: 'analog', analog: { range: 'thermocouple', min: 0, max: 300, units: '°C' } } as Partial<IOPoint>),
  pt('Sealing head down solenoid', 'output', 'solenoid'), pt('Sealing head up solenoid', 'output', 'solenoid'),
  pt('Seal heater on (SSR)', 'output', 'other'), pt('Unwinder VFD run', 'output', 'vfd-input'), pt('Running light', 'output', 'pilot-light'),
];
/** The user's Sealing Head; `transmitter` swaps the thermocouple for a 2-wire 4-20 mA transmitter on a C0-04AD-1, `npn` makes the head sensors NPN (their input groups then have the common on 24+). */
export function sealingHead(transmitter = false, npn = false): DrawingContext {
  const base = npn ? SEAL.map((p) => (p.deviceType === 'sensor-pnp' ? { ...p, deviceType: 'sensor-npn' } : p)) : SEAL;
  const points = transmitter
    ? base.map((p) => (/thermocouple/.test(p.description) ? { ...p, description: 'Seal bar temperature (4-20 mA transmitter)', analog: { range: '4-20mA', min: 0, max: 300, units: '°C' } } as Omit<IOPoint, 'id'> : p))
    : base;
  const io = points.map((p, i) => ({ ...p, id: `s${i + 1}` })) as IOPoint[];
  const profile = getProfile('click');
  const cpu = getCpu(profile, 'C0-11DD2E-D');
  const modules = transmitter ? ['C0-08ND3', 'C0-04AD-1'] : ['C0-08ND3', 'C0-04THM'];
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(modules));
  const plc = { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label };
  const spec = 'Sealing head: two-hand start, light curtain, interlocked guard door, E-stop. Heated seal bar with a type J thermocouple read by the PLC and a separate over-temperature limit. Film unwinder 0.5 HP on a VFD. NEMA 4X stainless panel, 480 V 3-phase.';
  const r = generateDefaultDesign({
    io, addresses, spec, inputs: { supply: '480VAC-3PH', enclosureRating: 'NEMA 4X', notes: '', motors: [{ tag: 'M1', description: 'Film unwinder', hp: 0.5, voltage: '480VAC-3PH', starter: 'vfd', reversing: false }], requiredParts: [] },
    plc, modules, region: 'US', getPart, hmiPartNumber: 'CM5-T7W', now: '2026-01-01T00:00:00.000Z', projectName: 'Sealing Head',
  });
  return {
    projectName: 'Sealing Head', design: r.design, getPart, plc, region: 'US', hmiPartNumber: 'CM5-T7W',
    io: io.map((p) => ({ address: addresses.get(p.id) ?? '', description: p.description, type: p.type })),
    analog: analogSetup(profile, cpu, moduleSlots(modules), io.map((p) => ({ ...p, address: addresses.get(p.id) }))),
  } as DrawingContext;
}

