import type { DeviceFaultProfile } from './deviceFaults';
import { DRIVE_FAULTS } from './faults/drives';
import { IO_FIELD_FAULTS } from './faults/ioField';
import { POWER_FAULTS } from './faults/power';

/**
 * Device fault profiles (see deviceFaults.ts). Each one is taken from the maker manuals in its `sources`;
 * each fault entry cites its own page / section in `source`. One file per device group under ./faults.
 */
export const DEVICE_FAULT_DATA: DeviceFaultProfile[] = [...DRIVE_FAULTS, ...IO_FIELD_FAULTS, ...POWER_FAULTS];
