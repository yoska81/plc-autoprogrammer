/**
 * Operator I/O for a machine with no touch panel: every operator function is a physical device on the
 * cabinet door. The words match what the program engine looks for (src/plc/engine/program.ts): a Start,
 * Stop and Reset pushbutton, an Auto/Manual selector (ON = Manual), a Safety OK input from the E-stop
 * safety relay, and Running / Fault lamps.
 */
import type { GeneratedPoint } from '../lib/ai/ioAI';

type Point = { description: string; type: string; deviceType?: string };

const LAMP = (p: Point) => p.type === 'output' && (p.deviceType === 'pilot-light' || p.deviceType === 'stack-light' || /\b(lamp|light|indicator|beacon)\b/i.test(p.description));

/** What a no-touch-panel machine needs on the door, and how to recognise one already in the I/O list. */
const OPERATOR: { has: (p: Point) => boolean; point: Omit<GeneratedPoint, 'reason'>; why: string }[] = [
  {
    has: (p) => p.type === 'input' && (p.deviceType === 'safety-relay-output' || p.deviceType === 'estop-contact' || /\b(e-?stop|emergency|safety relay|safety ok)\b/i.test(p.description)),
    point: { description: 'E-stop safety relay OK', type: 'input', category: 'Safety', deviceType: 'safety-relay-output' },
    why: 'E-stop: the safety relay tells the PLC the machine may run.',
  },
  {
    has: (p) => p.type === 'input' && /\bstart\b/i.test(p.description) && !/\btwo[- ]?hand\b/i.test(p.description),
    point: { description: 'Start pushbutton', type: 'input', category: 'Operator/HMI', deviceType: 'pushbutton-no' },
    why: 'No touch panel: the cycle starts from a door pushbutton.',
  },
  {
    has: (p) => p.type === 'input' && /\bstop\b/i.test(p.description) && !/\b(e-?stop|emergency)\b/i.test(p.description),
    point: { description: 'Stop pushbutton (NC)', type: 'input', category: 'Operator/HMI', deviceType: 'pushbutton-nc' },
    why: 'No touch panel: the cycle stops from a door pushbutton (normally closed: a broken wire stops it).',
  },
  {
    has: (p) => p.type === 'input' && /\breset\b/i.test(p.description) && !/\bsafety\b/i.test(p.description),
    point: { description: 'Reset pushbutton', type: 'input', category: 'Operator/HMI', deviceType: 'pushbutton-no' },
    why: 'No touch panel: faults are reset from a door pushbutton.',
  },
  {
    has: (p) => p.type === 'input' && (p.deviceType === 'selector' || /\b(auto|manual)\b/i.test(p.description)) && !/\blimit\b/i.test(p.description),
    point: { description: 'Auto/Manual selector (ON = Manual)', type: 'input', category: 'Operator/HMI', deviceType: 'selector' },
    why: 'No touch panel: Auto / Manual mode from a door selector switch.',
  },
  {
    has: (p) => LAMP(p) && /\b(run\w*|green)\b/i.test(p.description),
    point: { description: 'Running lamp (green)', type: 'output', category: 'Operator/HMI', deviceType: 'pilot-light' },
    why: 'No touch panel: a lamp shows the cycle is running.',
  },
  {
    has: (p) => LAMP(p) && /\b(fault|alarm|red)\b/i.test(p.description),
    point: { description: 'Fault lamp (red)', type: 'output', category: 'Operator/HMI', deviceType: 'pilot-light' },
    why: 'No touch panel: a lamp shows a fault or the safety circuit open.',
  },
];

/** The operator points a no-touch-panel machine still lacks (none when the I/O list already has them all). */
export function missingOperatorIo(io: Point[]): GeneratedPoint[] {
  return OPERATOR.filter((o) => !io.some(o.has)).map((o) => ({ ...o.point, reason: o.why }));
}

/** For the I/O prompt: the machine has no touch panel, so the operator functions are physical I/O. */
export const NO_PANEL_RULE = '- This machine has NO touch panel (HMI): every operator function is physical I/O on the cabinet door — Start pushbutton, Stop pushbutton (NC), Reset pushbutton, an Auto/Manual selector (ON = Manual), the E-stop safety relay OK input, a Running lamp (green) and a Fault lamp (red); add jog / manual pushbuttons only if the spec asks for them.';
