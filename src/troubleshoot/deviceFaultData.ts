import type { DeviceFaultProfile } from './deviceFaults';
import { DRIVE_FAULTS } from './faults/drives';

/**
 * Device fault profiles (see deviceFaults.ts). Each one is taken from the maker manuals in its `sources`;
 * each fault entry cites its own page / section in `source`. One file per device group under ./faults.
 */
export const DEVICE_FAULT_DATA: DeviceFaultProfile[] = [...DRIVE_FAULTS];
