/**
 * Servo axes on a motion network (Yaskawa MECHATROLINK): not I/O points. One list per project
 * (useProjectStore.networkAxes), read by the program's motion registers, the drawings and the HMI, so all
 * three number the axes the same way. Filled from an imported program's axis definitions, the spec, or by hand.
 */
export interface NetworkAxis {
  /** Stable id the program, the drawings and the HMI refer to the axis by ("ax1"). */
  key: string;
  /** "Feed roll". */
  name: string;
  /** Motion module circuit (SVC / SVR line), from 1. */
  circuit: number;
  /** Axis number on that circuit, from 1. */
  axis: number;
  /** SVR axes are virtual (no drive). */
  kind?: 'servo' | 'virtual';
  drivePartNumber?: string;
  /** MECHATROLINK station address (hex, "13"): two axes on one station are one two-axis drive (SGD7W). */
  station?: string;
  /** Axis within the station (0 / 1). */
  stationAxis?: number;
  motorPartNumber?: string;
  watts?: number;
  source?: 'import' | 'spec' | 'user';
}
