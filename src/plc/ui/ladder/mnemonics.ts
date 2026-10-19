import { createContext } from 'react';
import type { PlcNameOf } from '../../core/plcNames';

/** Vendor instruction names (PlcProfile.mnemonics) shown on the ladder symbols; undefined = the app's own names. */
export const MnemonicsContext = createContext<Record<string, string> | undefined>(undefined);

export type { PlcNameOf };
/** Provided for PLCs whose tags are not the app's operands (everything but CLICK); undefined = show the operands. */
export const PlcNamesContext = createContext<PlcNameOf | undefined>(undefined);

/** A text with operands in it ("DS1001 < 1", "DS1 + DS2"): each operand the PLC names is shown by its PLC name. */
export function withPlcNames(text: string, of: PlcNameOf | undefined): string {
  if (!of) return text;
  return text.replace(/\b[A-Z]{1,3}\d+(\.\d+)?\b/gi, (a) => of(a)?.name ?? a);
}
