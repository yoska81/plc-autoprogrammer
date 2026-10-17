import { createContext } from 'react';

/** Vendor instruction names (PlcProfile.mnemonics) shown on the ladder symbols; undefined = the app's own names. */
export const MnemonicsContext = createContext<Record<string, string> | undefined>(undefined);
