import type { DeviceFaultProfile } from './deviceFaults';
import type { MachineSymptomMap } from './machineSymptoms';

/**
 * The troubleshooting knowledge (device fault profiles and machine symptom maps) is large, so it is loaded on
 * demand and kept out of the main and preview bundles: call `await loadFaultKnowledge()` once (e.g. when the
 * Troubleshooter opens); until then the lookups in deviceFaults.ts / machineSymptoms.ts see empty data.
 */

let faults: DeviceFaultProfile[] = [];
let symptoms: MachineSymptomMap[] = [];
let pending: Promise<void> | null = null;

/** Load the knowledge (once; later calls return the same promise). */
export function loadFaultKnowledge(): Promise<void> {
  pending ??= Promise.all([import('./deviceFaultData'), import('./machineSymptomData')]).then(([f, s]) => {
    faults = f.DEVICE_FAULT_DATA;
    symptoms = s.MACHINE_SYMPTOM_DATA;
  });
  return pending;
}

/** Loaded device fault profiles (empty before loadFaultKnowledge resolves). */
export const loadedFaults = (): DeviceFaultProfile[] => faults;
/** Loaded machine symptom maps (empty before loadFaultKnowledge resolves). */
export const loadedSymptomMaps = (): MachineSymptomMap[] => symptoms;

/** The safe way to present fixes and readings (STO gate, live-work caution): re-exported so consumers find them here. */
export { fixesFor, readingsFor, needsLiveWorkCaution, LIVE_WORK_CAUTION, type SafetyContext } from './deviceFaults';
