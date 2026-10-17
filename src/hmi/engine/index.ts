/**
 * Rule-based HMI: the standard screen set from the I/O list (and the electrical design's wiring) in
 * seconds, no AI. See ./content.ts (what is shown) and ./build.ts (screens, layout, tags).
 */
export { defaultHmiContent, type HmiContent, type HmiActuator, type HmiAnalog, type HmiPoint } from './content';
export { buildHmi, type BuildOptions } from './build';
