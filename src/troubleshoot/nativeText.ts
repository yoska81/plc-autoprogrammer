/**
 * Fault-finding text in the PLC's own naming. The steps are worked out on the app's wire numbers and terminals (X001,
 * PLC:X001: what the circuit and practice mode compare); on an S7 panel the electrician finds wire marker I0.0 on PLC
 * terminal %I0.0, so the text shown and spoken says so. A point itself ("X001 still shows ON") keeps the address the
 * panel names it by; CLICK text is unchanged.
 */
import { ioLabel, renameWire, type IoNames } from '../electrical/ioNames';

const WIRE = /\b([Ww]ires?) ([XY]\d{3}[A-Z]?|DF\d+(?:\+|-|SH)?)(?!\w|\.\d)/g;
const TERMINAL = /\b(PLC(?: module \S+)? terminal) ([XY]\d{3})\b/g;
const PIN = /\b([A-Z][A-Z0-9-]*):([XY]\d{3})\b/g;

export function nativeStepText(names: IoNames, text: string): string {
  if (!names.native.size || !text) return text;
  return text
    .replace(WIRE, (_m, w: string, n: string) => `${w} ${renameWire(names, n)}`)
    .replace(TERMINAL, (_m, t: string, a: string) => `${t} ${ioLabel(names, a)}`)
    .replace(PIN, (_m, tag: string, a: string) => `${tag}:${ioLabel(names, a)}`);
}
