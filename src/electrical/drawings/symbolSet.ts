import { createContext, useContext } from 'react';
import type { SymbolSet } from '../../standards/regions';

/** Symbol set for the sheet being drawn: ANSI / IEEE 315 (JIC) or IEC 60617. */
export const SymbolSetContext = createContext<SymbolSet>('ansi');
export const useIecSymbols = () => useContext(SymbolSetContext) === 'iec60617';
