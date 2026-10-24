import type { ProjectSnapshot } from '../collect';
import { FIELD_DEVICE_LABEL, type FieldDeviceType } from '../../electrical/types';
import { buildModel } from '../../electrical/derive';

/**
 * The operator station: the pushbuttons, selector switches, E-stops and lamps the operator
 * uses (on the cabinet door, or at the machine). On a machine without a touch panel it is the
 * whole operator interface, and the documents describe it where they would describe the HMI.
 */

const OPERATOR_TYPES: FieldDeviceType[] = ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'pilot-light', 'stack-light'];

export interface OperatorDevice {
  tag: string;
  /** "pushbutton (NO)", "selector switch", "pilot light", … */
  kind: string;
  description: string;
  /** "Cabinet door" or the machine zone. */
  location: string;
  /** PLC address it is wired to ('' for an E-stop wired only into the safety circuit). */
  address: string;
}

/** Operator devices of the electrical design (door devices first), plus E-stops wired only into the safety circuit. */
export function operatorDevices(p: ProjectSnapshot): OperatorDevice[] {
  const wiring = (p.electrical?.ioWiring ?? []).filter((w) => OPERATOR_TYPES.includes(w.deviceType) || /door/i.test(w.location ?? ''));
  const out: OperatorDevice[] = wiring.map((w) => ({
    tag: w.deviceTag, kind: FIELD_DEVICE_LABEL[w.deviceType], description: w.description, location: w.location || 'Cabinet door', address: w.address,
  }));
  const estops = p.drawingCtx ? buildModel(p.drawingCtx).safety.estops : [];
  for (const t of estops) if (!out.some((d) => d.tag === t)) out.push({ tag: t, kind: 'emergency stop', description: 'Emergency stop (push to stop, twist to release)', location: 'Cabinet door', address: '' });
  const door = (d: OperatorDevice) => (/door/i.test(d.location) ? 0 : 1);
  return out.sort((a, b) => door(a) - door(b));
}

/** One sentence on how the operator runs the machine, for descriptions and summaries. */
export function operatorInterfaceText(p: ProjectSnapshot): string {
  if (!p.noHmi) return '';
  const n = operatorDevices(p).length;
  return `No touch panel: the operator runs the machine from the operator station${n ? ` (${n} pushbuttons, selector switches and lamps, listed below)` : ' (pushbuttons, a selector switch and lamps)'}; `
    + 'faults show on the fault lamp and are cleared with the Reset pushbutton.';
}

/** Short value for "Operator interface" / "HMI" fields: the panel, or the operator station. */
export const operatorInterfaceShort = (p: ProjectSnapshot, panelText: string) => (p.noHmi ? 'Operator station: pushbuttons, selector and lamps (no touch panel)' : panelText);

/** Rows [tag, device, function, location, PLC address] for an operator-station table. */
export const operatorStationRows = (p: ProjectSnapshot): string[][] =>
  operatorDevices(p).map((d) => [d.tag, d.kind, d.description, d.location, d.address || '—']);
export const OPERATOR_STATION_HEAD = ['Tag', 'Device', 'Function', 'Location', 'PLC address'];
